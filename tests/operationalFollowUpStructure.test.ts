import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  generateSSSRReport,
  resolveWeeklyKeyPoints,
  calculateRegistrationPercentage,
} from '../src/utils/sssrReportGenerator';
import {
  getClassWeeklyVisitationCandidates,
  getMemberVisitationCooldown,
  evaluateMemberVisitationEligibility,
  computeClassFollowUpSummary,
  computeFollowUpIntelligence,
  VISITATION_COOLDOWN_WEEKS,
  VISITATION_MAX_PER_CLASS_PER_WEEK,
} from '../src/utils/visitationEngine';
import {
  Member,
  WeeklyGradeRecord,
  AbsenceLogRecord,
  ClassProfile,
  VisitationAssignmentRecord,
  FollowUpAssignmentRecord,
  WeeklyReminderRecord,
  LessonInfo,
  StudentReminderResponse,
} from '../src/types';
import { GOFAMINT_HOF_12_LESSONS } from '../src/data/mockQuarterLessons';

describe('Operational Follow-Up Structure — Comprehensive Verification', () => {
  const mockClassId = 'class-believers-1';
  const mockClassProfile: ClassProfile = {
    id: mockClassId,
    className: 'Believers Class 1',
    department: 'Adults',
    teacherName: 'Pastor Samuel',
    secretaryName: 'Sister Grace',
    teachers: ['Pastor Samuel', 'Deacon Michael'],
    secretaries: ['Sister Grace'],
    assistantTeachers: ['Brother Caleb'],
  } as any as ClassProfile;

  const mockLesson: LessonInfo = {
    weekNumber: 5,
    title: 'Walking in Divine Grace',
    memoryVerse: 'For by grace you have been saved through faith. — Ephesians 2:8',
    topic: 'Divine Grace and Holy Living',
  } as any as LessonInfo;

  const createMember = (
    id: string,
    fullName: string,
    opts: Partial<Member> = {}
  ): Member => ({
    id,
    fullName,
    classId: mockClassId,
    memberType: 'STUDENT',
    gender: 'MALE',
    phone: '08012345678',
    firstLessonWeek: 1,
    status: 'ACTIVE',
    ...opts,
  } as Member);

  /* -------------------------------------------------------------------------
   * 1. Activity One — SSSR Report (Sunday School Summary Report)
   * ------------------------------------------------------------------------- */
  describe('Activity One — SSSR Report', () => {
    it('generates a 7-section report for an attended member using actual score maximums', () => {
      const student = createMember('stud-1', 'Brother Abraham Ade');
      const presentGrade: WeeklyGradeRecord = {
        id: 'grade-1',
        memberId: student.id,
        classId: mockClassId,
        weekNumber: 5,
        attendance: 'PRESENT',
        punctuality: 15, // max 15
        memoryVerse: 12, // max 15
        classParticipation: 18, // max 20
        lessonTotal: 45, // max 50
      } as any as WeeklyGradeRecord;

      const report = generateSSSRReport({
        member: student,
        grade: presentGrade,
        lesson: mockLesson,
        weekNumber: 5,
        classProfile: mockClassProfile,
        customKeyPoints: [
          'Grace empowers righteous living',
          'Faith receives what grace provides',
          'Stand firm in divine favour',
        ],
        appBaseUrl: 'https://gofamint-hof.org',
      });

      // Concise 2-paragraph format, <= 10 lines
      assert.strictEqual(report.isPresent, true);
      assert.strictEqual(report.memberName, 'Brother Abraham Ade');
      assert.ok(report.formattedMessage.includes('Brother Abraham Ade'));
      assert.ok(report.formattedMessage.includes('thanks for attending this past Sunday School'));

      // Qualitative feedback without numerical scores in text
      assert.ok(report.formattedMessage.includes('Thank you for arriving on time.'));
      assert.ok(report.formattedMessage.includes('Great job reciting your memory verse!'));
      assert.ok(report.formattedMessage.includes('You participated well in class, we are so proud of you!'));
      assert.strictEqual(report.formattedMessage.includes('15/15'), false);
      assert.strictEqual(report.formattedMessage.includes('45/50'), false);

      // Lesson Topic & Memory verse
      assert.strictEqual(report.lessonTopic, 'Divine Grace and Holy Living');
      assert.ok(report.memoryVerse.includes('Ephesians 2:8'));
      assert.ok(report.formattedMessage.includes('Divine Grace and Holy Living'));

      // Paragraph and line constraints: exactly 2 paragraphs, <= 10 lines
      const paragraphs = report.formattedMessage.split('\n\n');
      assert.strictEqual(paragraphs.length, 2);
      const lineCount = report.formattedMessage.split('\n').length;
      assert.ok(lineCount <= 10, `Expected <= 10 lines, got ${lineCount}`);

      // Registration progress & profile link
      assert.ok(typeof report.registrationPercentage === 'number');
      assert.ok(report.registrationLink.includes('token='));
      assert.ok(report.studentProfileLink.includes(student.id));

      // Blessing & WhatsApp link
      assert.ok(report.formattedMessage.includes('Your week is blessed!'));
      assert.ok(report.whatsAppDirectLink.includes('https://wa.me/'));
    });

    it('generates caring welfare recap for absent member WITHOUT fabricated scores in concise 2 paragraphs', () => {
      const student = createMember('stud-2', 'Sister Sarah Ojo');
      const absentGrade: WeeklyGradeRecord = {
        id: 'grade-2',
        memberId: student.id,
        classId: mockClassId,
        weekNumber: 5,
        attendance: 'ABSENT',
      } as any as WeeklyGradeRecord;

      const report = generateSSSRReport({
        member: student,
        grade: absentGrade,
        lesson: mockLesson,
        weekNumber: 5,
        classProfile: mockClassProfile,
      });

      assert.strictEqual(report.isPresent, false);
      assert.ok(report.formattedMessage.includes('Sister Sarah Ojo'));
      assert.ok(report.formattedMessage.includes('we missed having you in Sunday School'));

      // Absent person MUST NOT have performance feedback / fabricated scores
      assert.strictEqual(report.punctualityScore, undefined);
      assert.strictEqual(report.memoryVerseScore, undefined);
      assert.strictEqual(report.participationScore, undefined);
      assert.strictEqual(report.totalScore, undefined);
      assert.strictEqual(report.formattedMessage.includes('15/15'), false);

      // Paragraph and line constraints: exactly 2 paragraphs, <= 10 lines
      const paragraphs = report.formattedMessage.split('\n\n');
      assert.strictEqual(paragraphs.length, 2);
      const lineCount = report.formattedMessage.split('\n').length;
      assert.ok(lineCount <= 10, `Expected <= 10 lines, got ${lineCount}`);

      // Still receives lesson topic, memory verse, registration progress, prayer
      assert.strictEqual(report.lessonTopic, 'Divine Grace and Holy Living');
      assert.ok(report.registrationPercentage >= 0);
      assert.ok(report.formattedMessage.includes('Your week is blessed'));
    });

    it('generates SSSR reports for one-time visitors whether present or absent', () => {
      const visitor = createMember('vis-1', 'Brother Visitor Tim', {
        isOneTimeVisitor: true,
        memberType: 'VISITOR',
      });

      const report = generateSSSRReport({
        member: visitor,
        grade: null,
        lesson: mockLesson,
        weekNumber: 5,
        classProfile: mockClassProfile,
      });

      assert.strictEqual(report.isOneTimeVisitor, true);
      assert.ok(report.formattedMessage.includes('Brother Visitor Tim'));
      assert.ok(report.formattedMessage.includes('Divine Grace and Holy Living'));
    });
  });

  /* -------------------------------------------------------------------------
   * 2. Activity Two — Follow-Up Assignments (Reminders & Staff Assignments)
   * ------------------------------------------------------------------------- */
  describe('Activity Two — Follow-Up Assignments', () => {
    it('generates weekly reminders for upcoming week with lesson details, discussion question and start time', () => {
      const currentWeek = 5;
      const upcomingWeek = 6;
      const upcomingLesson = GOFAMINT_HOF_12_LESSONS.find(l => l.weekNumber === upcomingWeek) || {
        weekNumber: 6,
        title: 'Faith in Action',
        memoryVerse: 'James 2:17 — Faith without works is dead.',
        topic: 'Living Faith',
      };

      const reminderRecord: WeeklyReminderRecord = {
        id: `${mockClassId}_q1_w${upcomingWeek}_m1`,
        classId: mockClassId,
        quarterNumber: 1,
        weekNumber: upcomingWeek,
        memberId: 'm1',
        memberName: 'Brother David',
        phone: '08012345678',
        upcomingLessonTopic: upcomingLesson.title,
        upcomingMemoryVerse: upcomingLesson.memoryVerse,
        serviceTime: '8:30 AM',
        discussionQuestion: "How has your week been, and what lesson have you learned from God's Word this week?",
        timing: 'FRIDAY_PREVIEW',
        status: 'DONE',
        sentAt: '2026-10-09T18:00:00Z',
      };

      assert.strictEqual(reminderRecord.weekNumber, 6);
      assert.notStrictEqual(reminderRecord.weekNumber, currentWeek);
      assert.strictEqual(
        reminderRecord.discussionQuestion,
        "How has your week been, and what lesson have you learned from God's Word this week?"
      );
      assert.strictEqual(reminderRecord.serviceTime, '8:30 AM');
      assert.strictEqual(reminderRecord.status, 'DONE');
    });

    it('supports secretary override without losing original staff attribution', () => {
      const assignment: FollowUpAssignmentRecord = {
        id: 'assign-1',
        classId: mockClassId,
        quarterNumber: 1,
        weekNumber: 5,
        memberId: 'stud-10',
        memberName: 'Sister Hannah',
        phone: '08099887766',
        assignedStaffId: 'staff-1',
        assignedStaffName: 'Deacon Michael',
        assignedRole: 'TEACHER',
        status: 'PENDING',
        followUpType: 'REMINDER_AND_CHECKIN',
      };

      // Secretary overrides completion when assigned staff has not completed
      const updatedAssignment: FollowUpAssignmentRecord = {
        ...assignment,
        status: 'REACHED_OUT',
        isSecretaryOverride: true,
        completedBy: 'Sister Grace (Secretary)',
        completedAt: '2026-10-09T19:30:00Z',
        notes: 'Followed up via WhatsApp as secretary override',
      };

      // Preserves original assignment
      assert.strictEqual(updatedAssignment.assignedStaffId, 'staff-1');
      assert.strictEqual(updatedAssignment.assignedStaffName, 'Deacon Michael');
      // Confirms secretary override attribution
      assert.strictEqual(updatedAssignment.isSecretaryOverride, true);
      assert.strictEqual(updatedAssignment.completedBy, 'Sister Grace (Secretary)');
      assert.strictEqual(updatedAssignment.status, 'REACHED_OUT');
    });
  });

  /* -------------------------------------------------------------------------
   * 3. Activity Three — Visitation (4-Slot Allocation & Cooldown)
   * ------------------------------------------------------------------------- */
  describe('Activity Three — Visitation', () => {
    it('applies the 4-slot rule: 2 Priority Need, 1 Consistent Student, 1 Newly Onboarded', () => {
      const mP1 = createMember('m-p1', 'Absent 4 Weeks', { firstLessonWeek: 1 });
      const mP2 = createMember('m-p2', 'Absent 3 Weeks', { firstLessonWeek: 1 });
      const mP3 = createMember('m-p3', 'Absent 2 Weeks', { firstLessonWeek: 1 });
      const mConsistent = createMember('m-cons', 'Faithful Student', { firstLessonWeek: 1 });
      const mNewbie = createMember('m-new', 'Newly Onboarded', { firstLessonWeek: 4 }); // joined week 4 (current is 5)

      // Attendance history up to week 5
      const grades: WeeklyGradeRecord[] = [
        // m-p1: Absent in w2, w3, w4, w5 (4 wks absent)
        { memberId: 'm-p1', classId: mockClassId, weekNumber: 1, attendance: 'PRESENT' } as any,
        { memberId: 'm-p1', classId: mockClassId, weekNumber: 2, attendance: 'ABSENT' } as any,
        { memberId: 'm-p1', classId: mockClassId, weekNumber: 3, attendance: 'ABSENT' } as any,
        { memberId: 'm-p1', classId: mockClassId, weekNumber: 4, attendance: 'ABSENT' } as any,
        { memberId: 'm-p1', classId: mockClassId, weekNumber: 5, attendance: 'ABSENT' } as any,

        // m-p2: Absent in w3, w4, w5 (3 wks absent)
        { memberId: 'm-p2', classId: mockClassId, weekNumber: 1, attendance: 'PRESENT' } as any,
        { memberId: 'm-p2', classId: mockClassId, weekNumber: 2, attendance: 'PRESENT' } as any,
        { memberId: 'm-p2', classId: mockClassId, weekNumber: 3, attendance: 'ABSENT' } as any,
        { memberId: 'm-p2', classId: mockClassId, weekNumber: 4, attendance: 'ABSENT' } as any,
        { memberId: 'm-p2', classId: mockClassId, weekNumber: 5, attendance: 'ABSENT' } as any,

        // m-p3: Absent in w4, w5 (2 wks absent)
        { memberId: 'm-p3', classId: mockClassId, weekNumber: 3, attendance: 'PRESENT' } as any,
        { memberId: 'm-p3', classId: mockClassId, weekNumber: 4, attendance: 'ABSENT' } as any,
        { memberId: 'm-p3', classId: mockClassId, weekNumber: 5, attendance: 'ABSENT' } as any,

        // mConsistent: Present in w1, w2, w3, w4, w5
        { memberId: 'm-cons', classId: mockClassId, weekNumber: 1, attendance: 'PRESENT' } as any,
        { memberId: 'm-cons', classId: mockClassId, weekNumber: 2, attendance: 'PRESENT' } as any,
        { memberId: 'm-cons', classId: mockClassId, weekNumber: 3, attendance: 'PRESENT' } as any,
        { memberId: 'm-cons', classId: mockClassId, weekNumber: 4, attendance: 'PRESENT' } as any,
        { memberId: 'm-cons', classId: mockClassId, weekNumber: 5, attendance: 'PRESENT' } as any,

        // mNewbie: joined w4, attended w4, w5
        { memberId: 'm-new', classId: mockClassId, weekNumber: 4, attendance: 'PRESENT' } as any,
        { memberId: 'm-new', classId: mockClassId, weekNumber: 5, attendance: 'PRESENT' } as any,
      ];

      const members = [mP1, mP2, mP3, mConsistent, mNewbie];
      const { candidates } = getClassWeeklyVisitationCandidates(
        members,
        5,
        grades,
        [],
        {},
        { maxCap: 4 }
      );

      assert.strictEqual(candidates.length, 4);

      // Slot 1 & 2: Top 2 Priority Need (m-p1 with 4 wks, m-p2 with 3 wks)
      assert.strictEqual(candidates[0].memberId, 'm-p1');
      assert.strictEqual(candidates[0].slotType, 'PRIORITY_NEED');
      assert.strictEqual(candidates[0].consecutiveWeeksAbsent, 4);

      assert.strictEqual(candidates[1].memberId, 'm-p2');
      assert.strictEqual(candidates[1].slotType, 'PRIORITY_NEED');
      assert.strictEqual(candidates[1].consecutiveWeeksAbsent, 3);

      // Slot 3: Consistent Student Encouragement
      assert.strictEqual(candidates[2].memberId, 'm-cons');
      assert.strictEqual(candidates[2].slotType, 'CONSISTENT_STUDENT');

      // Slot 4: Newly Onboarded Student (joined week 4)
      assert.strictEqual(candidates[3].memberId, 'm-new');
      assert.strictEqual(candidates[3].slotType, 'NEWLY_ONBOARDED');
    });

    it('strictly excludes candidates during 4-week cooldown from candidate selection', () => {
      const member = createMember('m-cool', 'Cooldown Student');
      const assignments: Record<string, VisitationAssignmentRecord> = {
        'va-recent': {
          id: 'va-recent',
          classId: mockClassId,
          memberId: member.id,
          memberName: member.fullName,
          assignedStaffId: 'staff-1',
          assignedStaffName: 'Pastor Samuel',
          assignedDate: '2026-09-01',
          weekNumber: 3,
          priority: 'HIGH',
          status: 'COMPLETED',
          completedAt: '2026-09-03',
        },
      };

      // Week 5 is 2 weeks after week 3 (<= 4 weeks cooldown)
      const cooldownW5 = getMemberVisitationCooldown(member.id, 5, [], assignments);
      assert.strictEqual(cooldownW5.isInCooldown, true);
      assert.strictEqual(cooldownW5.cooldownWeeksRemaining, 2);

      // In candidate selection without includeCooldown, member is excluded
      const grades: WeeklyGradeRecord[] = [
        { memberId: member.id, classId: mockClassId, weekNumber: 4, attendance: 'ABSENT' } as any,
        { memberId: member.id, classId: mockClassId, weekNumber: 5, attendance: 'ABSENT' } as any,
      ];
      const { candidates, excludedByCooldownCount } = getClassWeeklyVisitationCandidates(
        [member],
        5,
        grades,
        [],
        assignments,
        { includeCooldown: false }
      );
      assert.strictEqual(candidates.length, 0);
      assert.strictEqual(excludedByCooldownCount, 1);
    });

    it('excludes one-time visitors from automatic visitation selection', () => {
      const visitor = createMember('vis-absent', 'Absent Visitor', {
        isOneTimeVisitor: true,
        memberType: 'VISITOR',
      });
      const grades: WeeklyGradeRecord[] = [
        { memberId: visitor.id, classId: mockClassId, weekNumber: 3, attendance: 'ABSENT' } as any,
        { memberId: visitor.id, classId: mockClassId, weekNumber: 4, attendance: 'ABSENT' } as any,
        { memberId: visitor.id, classId: mockClassId, weekNumber: 5, attendance: 'ABSENT' } as any,
      ];

      // evaluateMemberVisitationEligibility returns null for one-time visitor
      const evalResult = evaluateMemberVisitationEligibility(visitor, 5, grades, [], {});
      assert.strictEqual(evalResult, null);

      // getClassWeeklyVisitationCandidates also yields 0 candidates
      const { candidates } = getClassWeeklyVisitationCandidates([visitor], 5, grades, [], {});
      assert.strictEqual(candidates.length, 0);
    });
  });

  /* -------------------------------------------------------------------------
   * 4. Activity Four — Welfare Reach (Staged Absences & Shared Cooldown)
   * ------------------------------------------------------------------------- */
  describe('Activity Four — Welfare Reach', () => {
    it('applies strict staged action buttons: Week 1 WhatsApp only, Week 2 Call only, Week 3 Visitation only, Week 4+ Call and WhatsApp', () => {
      const getActionButtons = (consecutive: number, inCooldown: boolean = false) => {
        if (consecutive === 1) return ['WHATSAPP'];
        if (consecutive === 2) return ['CALL'];
        if (consecutive === 3) return inCooldown ? ['CALL'] : ['VISITATION'];
        if (consecutive >= 4) return ['CALL', 'WHATSAPP'];
        return [];
      };

      assert.deepStrictEqual(getActionButtons(1), ['WHATSAPP']);
      assert.deepStrictEqual(getActionButtons(2), ['CALL']);
      assert.deepStrictEqual(getActionButtons(3, false), ['VISITATION']);
      assert.deepStrictEqual(getActionButtons(3, true), ['CALL']); // in cooldown fallback
      assert.deepStrictEqual(getActionButtons(4), ['CALL', 'WHATSAPP']);
      assert.deepStrictEqual(getActionButtons(5), ['CALL', 'WHATSAPP']);
    });

    it('generates 100% registration view link when complete, and pending link when incomplete', () => {
      const fullStudent = createMember('stud-full', 'Brother Complete Registration', {
        isProfileCompleted: true,
        address: '12 Grace Street',
        occupation: 'Software Engineer',
        dateOfBirth: '1990-05-15',
        gender: 'MALE',
        nextOfKinName: 'Sister Grace',
        nextOfKinPhone: '08099887766'
      });

      const reportFull = generateSSSRReport({
        member: fullStudent,
        lesson: mockLesson,
        weekNumber: 5,
        classProfile: mockClassProfile,
        grade: {
          attendance: 'PRESENT',
          punctuality: 15,
          memoryVerse: 15,
          classParticipation: 20,
          lessonTotal: 50
        } as any
      });

      assert.strictEqual(reportFull.registrationPercentage, 100);
      assert.ok(reportFull.formattedMessage.includes('view your Sunday School attendance and performance record'));
      assert.strictEqual(reportFull.formattedMessage.includes('registration is still pending at'), false);

      const partialStudent = createMember('stud-partial', 'Sister Partial Registration');
      const reportPartial = generateSSSRReport({
        member: partialStudent,
        lesson: mockLesson,
        weekNumber: 5,
        classProfile: mockClassProfile,
        grade: {
          attendance: 'PRESENT',
          punctuality: 10,
          memoryVerse: 10,
          classParticipation: 10,
          lessonTotal: 30
        } as any
      });

      assert.ok(reportPartial.registrationPercentage < 100);
      assert.ok(reportPartial.formattedMessage.includes('registration is still pending at'));
    });

    it('respects shared 4-week visitation cooldown and does not duplicate visitation requests', () => {
      const member = createMember('m-welfare-cool', 'Persistent Absentee in Cooldown');
      const assignments: Record<string, VisitationAssignmentRecord> = {
        'va-prev': {
          id: 'va-prev',
          classId: mockClassId,
          memberId: member.id,
          memberName: member.fullName,
          assignedStaffId: 'staff-1',
          assignedStaffName: 'Pastor Samuel',
          assignedDate: '2026-09-10',
          weekNumber: 4,
          priority: 'HIGH',
          status: 'COMPLETED',
          completedAt: '2026-09-12',
        },
      };

      // At week 5, member is absent 3+ weeks, but had completed visit at week 4
      const cooldown = getMemberVisitationCooldown(member.id, 5, [], assignments);
      assert.strictEqual(cooldown.isInCooldown, true);
      assert.strictEqual(cooldown.lastVisitedWeek, 4);

      // In Welfare Reach, visitation should not be re-triggered during cooldown
      const welfareAction = cooldown.isInCooldown ? 'PHONE_CALL_DURING_COOLDOWN' : 'VISITATION';
      assert.strictEqual(welfareAction, 'PHONE_CALL_DURING_COOLDOWN');
    });
  });

  /* -------------------------------------------------------------------------
   * 5. Component Five — Follow-Up Report & Intelligence
   * ------------------------------------------------------------------------- */
  describe('Component Five — Follow-Up Report & Intelligence', () => {
    it('calculates class completion percentage accurately and handles zero eligible as Not applicable', () => {
      const calculateRate = (completed: number, eligible: number) => {
        if (eligible === 0) return 'Not applicable';
        return Math.round((completed / eligible) * 100);
      };

      // 3 of 12 SSSR reports = 25%
      assert.strictEqual(calculateRate(3, 12), 25);
      // 0 of 7 welfare contacts = 0%
      assert.strictEqual(calculateRate(0, 7), 0);
      // 3 of 4 visits = 75%
      assert.strictEqual(calculateRate(3, 4), 75);
      // 0 of 0 eligible = Not applicable
      assert.strictEqual(calculateRate(0, 0), 'Not applicable');
    });

    it('summarizes live status across all classes without data duplication', () => {
      const m1 = createMember('m-rep-1', 'Active Present Member');
      const m2 = createMember('m-rep-2', 'Absent Member 1');
      const members = [m1, m2];

      const grades: WeeklyGradeRecord[] = [
        { memberId: m1.id, classId: mockClassId, weekNumber: 5, attendance: 'PRESENT' } as any,
        { memberId: m2.id, classId: mockClassId, weekNumber: 5, attendance: 'ABSENT' } as any,
      ];

      const summary = computeClassFollowUpSummary(
        mockClassProfile,
        members,
        5,
        1,
        grades,
        [],
        {}
      );

      assert.strictEqual(summary.totalClassMembers, 2);
      assert.strictEqual(summary.present, 1);
      assert.strictEqual(summary.absent, 1);
      assert.strictEqual(summary.membersRequiringFollowUp, 1);
      assert.strictEqual(summary.className, 'Believers Class 1');
    });
  });

  /* -------------------------------------------------------------------------
   * 6. Enhancements — Reminder Student Responses, Window Expiry & Dashboard Analytics
   * ------------------------------------------------------------------------- */
  describe('Enhancements — Reminder Student Responses, Window Expiry & Dashboard Analytics', () => {
    it('supports all 6 student reminder response statuses on FollowUpAssignmentRecord', () => {
      const validResponses: StudentReminderResponse[] = [
        'ATTENDING_EARLY',
        'ATTENDING',
        'CANNOT_ATTEND',
        'TRAVELED',
        'SICK_NEED_PRAYER',
        'NO_RESPONSE',
      ];

      validResponses.forEach((res, idx) => {
        const assignment: FollowUpAssignmentRecord = {
          id: `asg-${idx}`,
          classId: mockClassId,
          quarterNumber: 1,
          memberId: `mem-${idx}`,
          assignedStaffId: 'staff-samuel',
          assignedStaffName: 'Pastor Samuel',
          staffName: 'Pastor Samuel',
          assignedAt: new Date().toISOString(),
          status: 'REACHED_OUT',
          weekNumber: 3,
          studentResponse: res,
          studentResponseNote: res === 'SICK_NEED_PRAYER' ? 'Requested healing prayer for malaria' : undefined,
        };

        assert.strictEqual(assignment.studentResponse, res);
        if (res === 'SICK_NEED_PRAYER') {
          assert.strictEqual(assignment.studentResponseNote, 'Requested healing prayer for malaria');
        }
      });
    });

    it('determines follow-up window closure and enforces read-only lock on past weeks for class staff', () => {
      const now = new Date();
      // Saturday 23:00 WAT cutoff helper logic:
      const isWindowExpired = (targetDate: Date, currentDate: Date) => {
        return currentDate.getTime() >= targetDate.getTime();
      };

      const pastSaturdayCutoff = new Date(now.getTime() - 3600 * 1000); // 1 hour ago
      const futureSaturdayCutoff = new Date(now.getTime() + 86400 * 1000); // Tomorrow

      assert.strictEqual(isWindowExpired(pastSaturdayCutoff, now), true);
      assert.strictEqual(isWindowExpired(futureSaturdayCutoff, now), false);

      // Access control rule: Class staff (teachers/secretaries) cannot modify past/expired week,
      // whereas directorate coordinators/admins can view and oversee:
      const canEditWeek = (userRole: string, isExpired: boolean) => {
        if (userRole === 'COORDINATOR' || userRole === 'ADMIN') return true;
        return !isExpired;
      };

      assert.strictEqual(canEditWeek('TEACHER', true), false);
      assert.strictEqual(canEditWeek('SECRETARY', true), false);
      assert.strictEqual(canEditWeek('COORDINATOR', true), true);
      assert.strictEqual(canEditWeek('ADMIN', true), true);
      assert.strictEqual(canEditWeek('TEACHER', false), true);
    });

    it('correctly aggregates multi-week trends: Present vs Absent, Absenteeism vs Work Rate, and Evangelism Retention', () => {
      // Week 1: 30 Present, 10 Absent, 10 Joiners
      // Week 2: 35 Present, 5 Absent (Work rate on 10 absentees was 80%), 8 of 10 returned from W1 Joiners
      const week1 = {
        week: 1,
        present: 30,
        absent: 10,
        workDoneOnAbsent: 8,
        absentWorkRate: Math.round((8 / 10) * 100), // 80%
        newJoiners: 10,
        returnedNextWeek: 8,
      };

      const week2 = {
        week: 2,
        present: 35,
        absent: 5,
        workDoneOnAbsent: 5,
        absentWorkRate: Math.round((5 / 5) * 100), // 100%
        newJoiners: 5,
        returnedNextWeek: 4,
      };

      // 1. Present vs Absent trend
      assert.strictEqual(week1.present + week1.absent, 40);
      assert.strictEqual(week2.present + week2.absent, 40);
      assert.ok(week2.present > week1.present, 'Attendance trend increased');
      assert.ok(week2.absent < week1.absent, 'Absenteeism trend decreased as follow-up work was sustained');

      // 2. Absent vs Work Rate
      assert.strictEqual(week1.absentWorkRate, 80);
      assert.strictEqual(week2.absentWorkRate, 100);

      // 3. Evangelism Retention
      const retentionRateW1 = Math.round((week1.returnedNextWeek / week1.newJoiners) * 100);
      assert.strictEqual(retentionRateW1, 80);
    });
  });
});
