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

    // With target/default cap of 3
    const top3 = getClassWeeklyVisitationCandidates(members, 5, grades, [], {}, { maxCap: 3 });
    assert.strictEqual(top3.candidates.length, 3);
    assert.strictEqual(top3.candidates[0].memberId, 'm-c'); // 4 weeks absent
    // m-b and m-e both 3 weeks; deterministic ordering by name: 'Barnabas' comes before 'Elijah'
    assert.strictEqual(top3.candidates[1].memberId, 'm-b');
    assert.strictEqual(top3.candidates[2].memberId, 'm-e');

    // With max cap of 4
    const top4 = getClassWeeklyVisitationCandidates(members, 5, grades, [], {}, { maxCap: 4 });
    assert.strictEqual(top4.candidates.length, 4);
    assert.strictEqual(top4.candidates[3].priority, 'MEDIUM');
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
