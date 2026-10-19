import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  VISITATION_COOLDOWN_WEEKS,
  VISITATION_TARGET_PER_CLASS_PER_WEEK,
  VISITATION_MAX_PER_CLASS_PER_WEEK,
  getMemberVisitationCooldown,
  evaluateMemberVisitationEligibility,
  getClassWeeklyVisitationCandidates,
  computeClassFollowUpSummary,
  computeFollowUpIntelligence,
  freezeWeeklyVisitationSlate,
  mergeVisitationAssignments,
} from '../src/utils/visitationEngine';
import {
  Member,
  WeeklyGradeRecord,
  AbsenceLogRecord,
  ClassProfile,
  VisitationAssignmentRecord,
} from '../src/types';

describe('Evangelism & Follow-Up — Visitation Engine', () => {
  const mockClassId = 'class-adult-a';

  const mockClassProfile = {
    id: mockClassId,
    className: 'Adult A',
    department: 'Adults',
    teacherName: 'Elder John',
    secretaryName: 'Brother Mark',
  } as any as ClassProfile;

  const createMockMember = (id: string, fullName: string, memberType: 'STUDENT' | 'VISITOR' = 'STUDENT'): Member => ({
    id,
    fullName,
    classId: mockClassId,
    memberType,
    gender: 'MALE',
    firstLessonWeek: 1,
    status: 'ACTIVE',
  } as any as Member);

  const createWeeklyGrades = (presentMemberIdsByWeek: Record<number, string[]>): WeeklyGradeRecord[] => {
    const grades: WeeklyGradeRecord[] = [];
    for (const [wStr, pIds] of Object.entries(presentMemberIdsByWeek)) {
      const weekNumber = Number(wStr);
      for (const mId of pIds) {
        grades.push({
          id: `grade-${mId}-w${weekNumber}`,
          memberId: mId,
          classId: mockClassId,
          weekNumber,
          attendance: 'PRESENT',
        } as any as WeeklyGradeRecord);
      }
    }
    return grades;
  };

  it('verifies constants for visitation limits and cooldown', () => {
    assert.strictEqual(VISITATION_COOLDOWN_WEEKS, 4);
    assert.strictEqual(VISITATION_TARGET_PER_CLASS_PER_WEEK, 3);
    assert.strictEqual(VISITATION_MAX_PER_CLASS_PER_WEEK, 4);
  });

  it('verifies visitation cooldown calculation logic', () => {
    const assignments: Record<string, VisitationAssignmentRecord> = {
      'va-1': {
        id: 'va-1',
        classId: mockClassId,
        memberId: 'm-1',
        memberName: 'John Doe',
        assignedStaffId: 'w-1',
        assignedStaffName: 'Brother Paul',
        assignedDate: '2026-09-06',
        weekNumber: 2,
        priority: 'HIGH',
        status: 'COMPLETED',
        completedAt: '2026-09-08',
      },
    };

    // Week 3 is within 4-week cooldown (week 2 completed, week 2 + 4 = 6)
    const cooldownW3 = getMemberVisitationCooldown('m-1', 3, [], assignments);
    assert.strictEqual(cooldownW3.isInCooldown, true);
    assert.strictEqual(cooldownW3.cooldownWeeksRemaining, 3);
    assert.strictEqual(cooldownW3.lastVisitedWeek, 2);

    // Week 6 is the 4th week after week 2 (diff = 4 <= 4) -> still in cooldown
    const cooldownW6 = getMemberVisitationCooldown('m-1', 6, [], assignments);
    assert.strictEqual(cooldownW6.isInCooldown, true);
    assert.strictEqual(cooldownW6.cooldownWeeksRemaining, 0);

    // Week 7 is 5 weeks after week 2 (diff = 5 > 4) -> cooldown expired!
    const cooldownW7 = getMemberVisitationCooldown('m-1', 7, [], assignments);
    assert.strictEqual(cooldownW7.isInCooldown, false);
    assert.strictEqual(cooldownW7.cooldownWeeksRemaining, 0);
  });

  it('determines correct priorities based on consecutive absences', () => {
    // Current week: 5
    // Member 1 absent weeks 2, 3, 4 (3 consecutive weeks absent) -> Priority 1 (HIGH)
    // Member 2 absent weeks 3, 4 (2 consecutive weeks absent) -> Priority 2 (MEDIUM)
    // Member 3 absent week 4 (1 week absent) -> Priority 3 (LOW)
    // Member 4 present in week 4 -> Eligible = false (0 consecutive absences)
    const m1 = createMockMember('m-1', 'Absent Three Weeks');
    const m2 = createMockMember('m-2', 'Absent Two Weeks');
    const m3 = createMockMember('m-3', 'Absent One Week');
    const m4 = createMockMember('m-4', 'Present Member');

    const grades = createWeeklyGrades({
      1: ['m-1', 'm-2', 'm-3', 'm-4'],
      2: ['m-2', 'm-3', 'm-4'], // m-1 absent
      3: ['m-3', 'm-4'],        // m-1, m-2 absent
      4: ['m-4'],               // m-1, m-2, m-3 absent
    });

    const elig1 = evaluateMemberVisitationEligibility(m1, 4, grades, [], {});
    assert.ok(elig1 !== null);
    assert.strictEqual(elig1.priority, 'HIGH');
    assert.strictEqual(elig1.priorityRank, 1);
    assert.strictEqual(elig1.consecutiveWeeksAbsent, 3);

    const elig2 = evaluateMemberVisitationEligibility(m2, 4, grades, [], {});
    assert.ok(elig2 !== null);
    assert.strictEqual(elig2.priority, 'MEDIUM');
    assert.strictEqual(elig2.priorityRank, 2);
    assert.strictEqual(elig2.consecutiveWeeksAbsent, 2);

    const elig3 = evaluateMemberVisitationEligibility(m3, 4, grades, [], {});
    assert.ok(elig3 !== null);
    assert.strictEqual(elig3.priority, 'LOW');
    assert.strictEqual(elig3.priorityRank, 3);
    assert.strictEqual(elig3.consecutiveWeeksAbsent, 1);

    const elig4 = evaluateMemberVisitationEligibility(m4, 4, grades, [], {});
    assert.strictEqual(elig4, null); // Not absent, not eligible
  });

  it('excludes candidates currently in 4-week cooldown from weekly queue', () => {
    const m1 = createMockMember('m-1', 'Absent Three Weeks In Cooldown');
    const m2 = createMockMember('m-2', 'Absent Two Weeks Not In Cooldown');

    const grades = createWeeklyGrades({
      1: ['m-1', 'm-2'],
      2: ['m-2'], // m-1 absent
      3: [],      // both absent
      4: [],      // both absent
    });

    // m-1 was visited and completed in week 3
    const assignments: Record<string, VisitationAssignmentRecord> = {
      'va-m1': {
        id: 'va-m1',
        classId: mockClassId,
        memberId: 'm-1',
        memberName: 'Absent Three Weeks In Cooldown',
        assignedStaffId: 'w-1',
        assignedStaffName: 'Brother Timothy',
        assignedDate: '2026-09-13',
        weekNumber: 3,
        priority: 'HIGH',
        status: 'COMPLETED',
        completedAt: '2026-09-15',
      },
    };

    // Current week: 5 (diff from week 3 is 2 <= 4 -> in cooldown)
    const result = getClassWeeklyVisitationCandidates(
      [m1, m2],
      5,
      grades,
      [],
      assignments,
      { includeCooldown: false }
    );

    // Only m-2 should be a candidate because m-1 is in cooldown!
    assert.strictEqual(result.candidates.length, 1);
    assert.strictEqual(result.candidates[0].memberId, 'm-2');
    assert.strictEqual(result.excludedByCooldownCount, 1);
  });

  it('enforces maximum 3–4 candidates cap deterministically', () => {
    const members = [
      createMockMember('m-a', 'Aaron (1 week absent)'),
      createMockMember('m-b', 'Barnabas (3 weeks absent)'),
      createMockMember('m-c', 'Caleb (4 weeks absent)'),
      createMockMember('m-d', 'Daniel (2 weeks absent)'),
      createMockMember('m-e', 'Elijah (3 weeks absent)'),
      createMockMember('m-f', 'Francis (2 weeks absent)'),
    ];

    const grades = createWeeklyGrades({
      1: ['m-a', 'm-b', 'm-c', 'm-d', 'm-e', 'm-f'],
      2: ['m-a', 'm-b', 'm-d', 'm-e', 'm-f'], // m-c absent
      3: ['m-a', 'm-d', 'm-f'],               // m-c, m-b, m-e absent
      4: ['m-a'],                             // m-c, m-b, m-e, m-d, m-f absent
      5: [],                                  // all absent
    });

    // Week 6:
    // m-c: 4 weeks absent (Priority Rank 1)
    // m-b: 3 weeks absent (Priority Rank 1)
    // m-e: 3 weeks absent (Priority Rank 1)
    // m-d: 2 weeks absent (Priority Rank 2)
    // m-f: 2 weeks absent (Priority Rank 2)
    // m-a: 1 week absent (Priority Rank 3)

    // With target/default cap of 3 (using purePrioritySort for deterministic absentee ranking)
    const top3 = getClassWeeklyVisitationCandidates(members, 5, grades, [], {}, { maxCap: 3, purePrioritySort: true });
    assert.strictEqual(top3.candidates.length, 3);
    assert.strictEqual(top3.candidates[0].memberId, 'm-c'); // 4 weeks absent
    // m-b and m-e both 3 weeks; deterministic ordering by name: 'Barnabas' comes before 'Elijah'
    assert.strictEqual(top3.candidates[1].memberId, 'm-b');
    assert.strictEqual(top3.candidates[2].memberId, 'm-e');

    // With max cap of 4
    const top4 = getClassWeeklyVisitationCandidates(members, 5, grades, [], {}, { maxCap: 4, purePrioritySort: true });
    assert.strictEqual(top4.candidates.length, 4);
    assert.strictEqual(top4.candidates[3].priority, 'MEDIUM');
  });

  it('enforces the 4-slot operational rule: 2 Priority Need, 1 Consistent Student, 1 Newly Onboarded Student', () => {
    // Current week: 5
    // 3 members absent for 3+ weeks (m-abs1, m-abs2, m-abs3) -> only top 2 get Priority Need spots
    // 1 member consistent and present (m-consistent) -> gets Consistent Student spot
    // 1 member newly onboarded who joined in Week 4 (m-new) -> gets Newly Onboarded spot
    // 1 one-time visitor (m-otv) -> excluded from visitation
    const mAbs1 = createMockMember('m-abs1', 'Alice (3 weeks absent)');
    const mAbs2 = createMockMember('m-abs2', 'Bob (3 weeks absent)');
    const mAbs3 = createMockMember('m-abs3', 'Charles (3 weeks absent)');
    const mConsistent = createMockMember('m-const', 'Daniel (Consistent Student)');
    const mNew = {
      ...createMockMember('m-new', 'Esther (Joined last week)'),
      firstLessonWeek: 4, // Joined last week (Week 4, current is Week 5)
    };
    const mOtv = {
      ...createMockMember('m-otv', 'Visitor Frank (One-Time Visitor)'),
      isOneTimeVisitor: true,
    };

    const grades = createWeeklyGrades({
      1: ['m-abs1', 'm-abs2', 'm-abs3', 'm-const'],
      2: ['m-const'], // abs1, abs2, abs3 absent
      3: ['m-const'], // abs1, abs2, abs3 absent
      4: ['m-const', 'm-new'], // new joined, abs1, abs2, abs3 absent
      5: ['m-const', 'm-new'], // abs1, abs2, abs3 absent
    });

    const result = getClassWeeklyVisitationCandidates(
      [mAbs1, mAbs2, mAbs3, mConsistent, mNew, mOtv],
      5,
      grades,
      [],
      {},
      { maxCap: 4 }
    );

    // Candidates count = 4: 2 Priority Need, 1 Consistent, 1 Newly Onboarded
    assert.strictEqual(result.candidates.length, 4);

    // Top 2 are Priority Need (Alice and Bob alphabetically since both 4 consecutive absences)
    assert.strictEqual(result.candidates[0].slotType, 'PRIORITY_NEED');
    assert.strictEqual(result.candidates[0].memberId, 'm-abs1');
    assert.strictEqual(result.candidates[1].slotType, 'PRIORITY_NEED');
    assert.strictEqual(result.candidates[1].memberId, 'm-abs2');

    // Slot 3 is Consistent Student
    assert.strictEqual(result.candidates[2].slotType, 'CONSISTENT_STUDENT');
    assert.strictEqual(result.candidates[2].memberId, 'm-const');

    // Slot 4 is Newly Onboarded Student
    assert.strictEqual(result.candidates[3].slotType, 'NEWLY_ONBOARDED');
    assert.strictEqual(result.candidates[3].memberId, 'm-new');

    // One-time visitor Frank and 3rd absentee Charles are excluded from the capped queue
    assert.ok(!result.candidates.some(c => c.memberId === 'm-otv'));
    assert.ok(!result.candidates.some(c => c.memberId === 'm-abs3'));
  });

  it('keeps the same weekly slate after one candidate is completed', () => {
    const members = [
      createMockMember('m-1', 'First'), createMockMember('m-2', 'Second'),
      createMockMember('m-3', 'Third'), createMockMember('m-4', 'Fourth'),
      createMockMember('m-5', 'Replacement Must Not Appear')
    ];
    const grades = createWeeklyGrades({ 1: members.map(m => m.id), 2: [], 3: [] });
    const initial = getClassWeeklyVisitationCandidates(members, 3, grades, [], {}, { maxCap: 4, purePrioritySort: true });
    const assignments: Record<string, VisitationAssignmentRecord> = {};
    initial.candidates.forEach((candidate, index) => {
      assignments[`slot-${index + 1}`] = {
        id: `slot-${index + 1}`, classId: mockClassId, memberId: candidate.memberId,
        memberName: candidate.fullName, assignedStaffName: '', weekNumber: 3,
        selectedSlotIndex: index + 1, priority: candidate.priority,
        status: index === 0 ? 'COMPLETED' : 'PENDING'
      };
    });
    const afterCompletion = getClassWeeklyVisitationCandidates(members, 3, grades, [], assignments, { maxCap: 4 });
    assert.deepEqual(afterCompletion.candidates.map(c => c.memberId), initial.candidates.map(c => c.memberId));
    assert.equal(afterCompletion.candidates[0].visitStatus, 'COMPLETED');
    assert.ok(!afterCompletion.candidates.some(c => c.memberId === 'm-5' && !initial.candidates.some(i => i.memberId === 'm-5')));
  });

  it('persists one fixed slate and progresses from 1/4 to 4/4 without refilling in either portal query', () => {
    const members = [
      createMockMember('absent-a', 'Absent A'), createMockMember('absent-b', 'Absent B'),
      createMockMember('absent-c', 'Replacement'), createMockMember('consistent', 'Consistent'),
      { ...createMockMember('new', 'New Member'), firstLessonWeek: 4 },
    ];
    const grades = createWeeklyGrades({ 1: ['absent-a', 'absent-b', 'absent-c', 'consistent'], 2: ['consistent'], 3: ['consistent'], 4: ['consistent', 'new'], 5: ['consistent', 'new'] });
    const initial = getClassWeeklyVisitationCandidates(members, 5, grades).candidates;
    assert.equal(initial.length, 4);
    let assignments = freezeWeeklyVisitationSlate(mockClassId, 1, 5, initial, {}, '2026-10-18T08:00:00Z');
    const frozenIds = initial.map(candidate => candidate.memberId);
    for (let index = 0; index < 4; index++) {
      const record = Object.values(assignments).find(item => item.memberId === frozenIds[index])!;
      assignments = { ...assignments, [record.id]: { ...record, status: 'COMPLETED', completedAt: '2026-10-18', updatedAt: '2026-10-18T09:00:00Z' } };
      for (const purePrioritySort of [false, true]) {
        const result = getClassWeeklyVisitationCandidates(members, 5, grades, [], assignments, { purePrioritySort, quarterNumber: 1 });
        assert.deepEqual(result.candidates.map(candidate => candidate.memberId), frozenIds);
        assert.equal(result.candidates.filter(candidate => candidate.visitStatus === 'COMPLETED').length, index + 1);
      }
      const summary = computeClassFollowUpSummary(mockClassProfile, members, 5, 1, grades, [], assignments);
      assert.equal(summary.membersRequiringVisitation, 4);
      assert.equal(summary.visitationCompleted, index + 1);
      assert.equal(summary.pendingVisitation, 3 - index);
    }
  });

  it('retains a smaller frozen slate and unavailable members rather than introducing replacements', () => {
    const members = [createMockMember('a', 'A'), createMockMember('b', 'B'), createMockMember('c', 'C')];
    const grades = createWeeklyGrades({ 1: members.map(member => member.id) });
    const candidates = getClassWeeklyVisitationCandidates(members, 3, grades).candidates;
    const assignments = freezeWeeklyVisitationSlate(mockClassId, 1, 3, candidates.slice(0, 1), {});
    const selectedId = candidates[0].memberId;
    const result = getClassWeeklyVisitationCandidates(members.filter(member => member.id !== selectedId), 3, grades, [], assignments);
    assert.deepEqual(result.candidates.map(candidate => candidate.memberId), [selectedId]);
    assert.equal(result.candidates[0].fullName, candidates[0].fullName);
  });

  it('keeps completed records when an obsolete device snapshot is merged and preserves slot metadata', () => {
    const base: VisitationAssignmentRecord = { id: 'visit', classId: mockClassId, memberId: 'a', assignedStaffName: 'Teacher', weekNumber: 5, status: 'COMPLETED', selectedSlotIndex: 1, completedAt: '2026-10-18', updatedAt: '2026-10-18T09:00:00Z' };
    const stale = { ...base, status: 'PENDING' as const, assignedStaffName: '', selectedSlotIndex: undefined, completedAt: undefined, updatedAt: '2026-10-18T08:00:00Z' };
    const merged = mergeVisitationAssignments({ visit: base }, { visit: stale });
    assert.equal(merged.visit.status, 'COMPLETED');
    assert.equal(merged.visit.completedAt, '2026-10-18');
    assert.equal(merged.visit.assignedStaffName, 'Teacher');
    assert.equal(merged.visit.selectedSlotIndex, 1);
  });

  it('does not reuse another quarter slate and never exceeds four candidates', () => {
    const members = Array.from({ length: 7 }, (_, index) => createMockMember(`m-${index}`, `Member ${index}`));
    const grades = createWeeklyGrades({ 1: members.map(member => member.id) });
    const initial = getClassWeeklyVisitationCandidates(members, 3, grades, [], {}, { purePrioritySort: true, maxCap: 20 });
    assert.equal(initial.candidates.length, 4);
    const assignments = freezeWeeklyVisitationSlate(mockClassId, 1, 3, initial.candidates, {});
    const nextQuarter = getClassWeeklyVisitationCandidates(members, 3, grades, [], assignments, { purePrioritySort: true, quarterNumber: 2 });
    assert.ok(nextQuarter.candidates.every(candidate => candidate.visitStatus === 'PENDING'));
    assert.equal(nextQuarter.candidates.length, 4);
    assert.equal(getClassWeeklyVisitationCandidates(members, 3, grades, [], assignments, { maxCap: 0 }).candidates.length, 0);
  });

  it('counts completed members once even when both visit logs and assignments exist', () => {
    const members = [createMockMember('a', 'A'), createMockMember('b', 'B')];
    const grades = createWeeklyGrades({ 1: ['a', 'b'] });
    const initial = getClassWeeklyVisitationCandidates(members, 3, grades).candidates;
    const assignments = freezeWeeklyVisitationSlate(mockClassId, 1, 3, initial, {});
    const first = Object.values(assignments)[0];
    assignments[first.id] = { ...first, status: 'COMPLETED' };
    const logs = [0, 1].map(index => ({ id: `log-${index}`, classId: mockClassId, memberId: first.memberId, weekNumber: 3, contactMethod: 'PASTORAL_VISIT' } as AbsenceLogRecord));
    const summary = computeClassFollowUpSummary(mockClassProfile, members, 3, 1, grades, logs, assignments);
    assert.equal(summary.visitationCompleted, 1);
    assert.equal(summary.pendingVisitation, 1);
  });

  it('computes class follow up summary accurately without inventing data', () => {
    const m1 = createMockMember('m-1', 'Member 1');
    const m2 = createMockMember('m-2', 'Member 2');
    const m3 = createMockMember('m-3', 'Member 3');
    const m4 = createMockMember('m-4', 'Member 4');

    const grades = createWeeklyGrades({
      1: ['m-1', 'm-2', 'm-3', 'm-4'],
      2: ['m-1', 'm-2'], // m-3, m-4 absent in week 2
    });

    const summary = computeClassFollowUpSummary(
      mockClassProfile,
      [m1, m2, m3, m4],
      2,
      1,
      grades,
      [],
      {}
    );

    assert.strictEqual(summary.totalClassMembers, 4);
    assert.strictEqual(summary.present, 2);
    assert.strictEqual(summary.absent, 2);
    assert.strictEqual(summary.membersRequiringFollowUp, 2); // m-3, m-4 absent
    assert.strictEqual(summary.membersRequiringVisitation, 2);
    assert.strictEqual(summary.visitationCompleted, 0);
    assert.strictEqual(summary.pendingVisitation, 2);
  });

  it('computes follow up intelligence across classes', () => {
    const classA = {
      id: 'c-1',
      className: 'Adult A',
      department: 'Adults',
    } as any as ClassProfile;
    const classB = {
      id: 'c-2',
      className: 'Youth B',
      department: 'Youths',
    } as any as ClassProfile;

    const membersClassA = [
      createMockMember('m-a1', 'A1'),
      createMockMember('m-a2', 'A2'),
    ];
    membersClassA.forEach(m => m.classId = 'c-1');

    const membersClassB = [
      createMockMember('m-b1', 'B1'),
      createMockMember('m-b2', 'B2'),
      createMockMember('m-b3', 'B3'),
      createMockMember('m-b4', 'B4'),
    ];
    membersClassB.forEach(m => m.classId = 'c-2');

    const allMembers = [...membersClassA, ...membersClassB];

    // In week 2:
    // class A: m-a1, m-a2 present
    // class B: m-b1 present, m-b2, m-b3, m-b4 absent
    const grades: WeeklyGradeRecord[] = [
      { id: 'g1', memberId: 'm-a1', classId: 'c-1', weekNumber: 2, attendance: 'PRESENT' } as any,
      { id: 'g2', memberId: 'm-a2', classId: 'c-1', weekNumber: 2, attendance: 'PRESENT' } as any,
      { id: 'g3', memberId: 'm-b1', classId: 'c-2', weekNumber: 2, attendance: 'PRESENT' } as any,
    ];

    const intelligence = computeFollowUpIntelligence(
      [classA, classB],
      allMembers,
      2,
      1,
      grades,
      []
    );

    assert.strictEqual(intelligence.classWithHighestNeed?.className, 'Youth B');
    assert.strictEqual(intelligence.classWithHighestNeed?.count, 3);
    assert.strictEqual(intelligence.totalMembersNeedingFollowUp, 3);
  });
});
