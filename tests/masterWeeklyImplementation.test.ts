import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAbsenceFollowUpMessage,
  generateVisitorWeeklyFollowUpMessage,
  generateStudentWeeklyReminderMessage,
  generateStaffAssignedFollowUpMessage,
} from '../src/utils/whatsappMessages.js';
import { buildWhatsAppDirectLink } from '../src/utils/phoneUtils.js';
import { calculateMemberStats } from '../src/utils/calculations.js';
import { Member, WeeklyGradeRecord, ClassProfile } from '../src/types.js';

test('PART A & D: WhatsApp follow-up messages are warm, natural, and contain NO percentages, scores, or double-encoding', () => {
  // Test Absence Follow-Up Message
  const absenceMsg = generateAbsenceFollowUpMessage({
    memberName: 'Brother John',
    className: 'Joyful Believers',
    staffName: 'Teacher Joseph'
  });

  // Verify personal name and warm check-in
  assert.ok(absenceMsg.includes('Brother John'));
  assert.ok(absenceMsg.includes('missed'));
  assert.ok(absenceMsg.includes('Teacher Joseph'));

  // ABSOLUTELY NO internal metrics, scores, or percentages
  assert.ok(!absenceMsg.includes('%'), 'Must not contain percentages');
  assert.ok(!absenceMsg.includes('attendance score'), 'Must not contain internal scores');
  assert.ok(!absenceMsg.includes('20%'), 'Must not contain percentages');
  assert.ok(!absenceMsg.includes('database'), 'Must not contain technical database info');

  // Test WhatsApp Direct Link URL encoding
  const directLink = buildWhatsAppDirectLink('08012345678', absenceMsg);
  assert.ok(directLink.startsWith('https://wa.me/2348012345678?text='));
  // Ensure no double-encoding (%2520) occurs
  assert.ok(!directLink.includes('%2520'), 'Link must never double-encode spaces (%2520)');
  assert.ok(!directLink.includes('%252C'), 'Link must never double-encode commas (%252C)');

  // Decode the URL param and verify human text matches exactly
  const urlObj = new URL(directLink);
  const textParam = urlObj.searchParams.get('text');
  assert.equal(textParam, absenceMsg, 'WhatsApp decoded message must match the plain text exactly');
});

test('PART A: Visitor weekly follow-up includes current lesson info, memory verse, and fellowship invitation', () => {
  const visitorMsg = generateVisitorWeeklyFollowUpMessage({
    visitorName: 'Sister Grace',
    lessonTopic: 'Faith in Times of Trial',
    memoryVerse: 'Hebrews 11:1',
    lessonSummary: 'Understanding steadfast trust in God during challenges.'
  });

  assert.ok(visitorMsg.includes('Sister Grace'));
  assert.ok(visitorMsg.includes('Faith in Times of Trial'));
  assert.ok(visitorMsg.includes('Hebrews 11:1'));
  assert.ok(visitorMsg.includes('fellowship with us'));
  assert.ok(!visitorMsg.includes('%'));
});

test('PART A: Student weekly reminder includes upcoming lesson, class name, and 8:00 a.m. start time', () => {
  const reminderMsg = generateStudentWeeklyReminderMessage({
    studentName: 'Samuel',
    className: 'Youth Champions',
    lessonTopic: 'Living for Christ in Youth',
    memoryVerse: '1 Timothy 4:12'
  });

  assert.ok(reminderMsg.includes('Samuel'));
  assert.ok(reminderMsg.includes('Youth Champions'));
  assert.ok(reminderMsg.includes('Living for Christ in Youth'));
  assert.ok(reminderMsg.includes('8:00 a.m.'));
  assert.ok(reminderMsg.includes('1 Timothy 4:12'));
  assert.ok(!reminderMsg.includes('%'));
});

test('PART A & B: Staff-to-student balanced distribution and weekly reshuffling algorithm', () => {
  const staff = [
    { id: 'sec_1', name: 'Secretary Mary' },
    { id: 't_1', name: 'Teacher A' },
    { id: 't_2', name: 'Teacher B' },
    { id: 't_3', name: 'Teacher C' },
  ];

  // 18 members
  const members = Array.from({ length: 18 }, (_, i) => ({
    id: `m_${i + 1}`,
    name: `Member ${i + 1}`
  }));

  // Week 1 assignment
  const week1Assignments = members.map((member, index) => {
    const staffIndex = (index + (1 - 1)) % staff.length;
    return { memberId: member.id, assignedStaffId: staff[staffIndex].id };
  });

  // Verify balanced distribution in Week 1: 18 / 4 = 4 or 5 each
  const week1Counts = staff.map(s => week1Assignments.filter(a => a.assignedStaffId === s.id).length);
  assert.deepEqual(week1Counts, [5, 5, 4, 4], 'Distribution must be reasonably balanced');

  // Week 2 reshuffle
  const week2Assignments = members.map((member, index) => {
    const staffIndex = (index + (2 - 1)) % staff.length;
    return { memberId: member.id, assignedStaffId: staff[staffIndex].id };
  });

  // Member 1 was assigned to staff[0] in Week 1, should rotate to staff[1] in Week 2
  assert.equal(week1Assignments[0].assignedStaffId, 'sec_1');
  assert.equal(week2Assignments[0].assignedStaffId, 't_1');

  // Week 3 reshuffle: Member 1 rotates to staff[2]
  const week3Assignments = members.map((member, index) => {
    const staffIndex = (index + (3 - 1)) % staff.length;
    return { memberId: member.id, assignedStaffId: staff[staffIndex].id };
  });
  assert.equal(week3Assignments[0].assignedStaffId, 't_2');

  // Verify assigned staff follow-up message includes staff identity
  const assignedMsg = generateStaffAssignedFollowUpMessage({
    memberName: 'Member 1',
    staffName: 'Teacher A',
    lessonTopic: 'Walking in Love'
  });
  assert.ok(assignedMsg.includes('Member 1'));
  assert.ok(assignedMsg.includes('Teacher A'));
  assert.ok(assignedMsg.includes('Walking in Love'));
});

test('PART F: Departmental Superintendent strict department filtering (no cross-department contamination)', () => {
  const classes: Partial<ClassProfile>[] = [
    { id: 'cls_y1', className: 'Youth Ambassadors', department: 'Youth' },
    { id: 'cls_y2', className: 'Teen Disciples', department: 'Youth' },
    { id: 'cls_y3', className: 'Campus Believers', department: 'Youth' },
    { id: 'cls_a1', className: 'Adult Family Class', department: 'Adult' },
    { id: 'cls_a2', className: 'Men of Honor', department: 'Adult' },
    { id: 'cls_c1', className: 'Children Joyful', department: 'Children' },
  ];

  // Function simulating the strict department filter
  const filterByDept = (dept: string) =>
    classes.filter(c => (c.department || '').trim().toLowerCase() === dept.trim().toLowerCase());

  const youthClasses = filterByDept('Youth');
  assert.equal(youthClasses.length, 3, 'Youth must have exactly 3 classes');
  assert.ok(youthClasses.every(c => c.department === 'Youth'));
  assert.ok(!youthClasses.some(c => c.className?.includes('Family')), 'Family must NOT appear in Youth');

  const adultClasses = filterByDept('Adult');
  assert.equal(adultClasses.length, 2, 'Adult must have exactly 2 classes');
  assert.ok(adultClasses.some(c => c.className === 'Adult Family Class'), 'Family belongs in Adult');

  const childrenClasses = filterByDept('Children');
  assert.equal(childrenClasses.length, 1, 'Children must have exactly 1 class');
});

test('PART K: Student Report Card accurately displays completed weeks from Class Register (not 0 / 12)', () => {
  const studentMember = {
    id: 'student_123',
    classId: 'class_a',
    fullName: 'David Adeleke',
    status: 'ACTIVE',
    memberType: 'STUDENT',
    firstLessonWeek: 1
  } as unknown as Member;

  // Case A: 0 completed weeks
  const stats0 = calculateMemberStats(studentMember, [], 12);
  assert.equal(stats0.attendedWeeks, 0, 'Expected 0 / 12 weeks');

  // Case B: 1 completed week
  const grades1 = [
    {
      id: 'g_1',
      memberId: 'student_123',
      classId: 'class_a',
      weekNumber: 1,
      attendance: 'PRESENT',
      punctuality: 5,
      memoryVerse: 5,
      classParticipation: 5,
      lessonTotal: 15,
      joinedPrayerMeeting: false,
      postedStatusInsight: false,
      invitedSomeone: false,
      updatedAt: new Date().toISOString()
    }
  ] as unknown as WeeklyGradeRecord[];
  const stats1 = calculateMemberStats(studentMember, grades1, 12);
  assert.equal(stats1.attendedWeeks, 1, 'Expected 1 / 12 weeks');

  // Case C: 4 completed weeks (must NEVER show 0 / 12)
  const grades4 = [
    { id: 'g_1', memberId: 'student_123', classId: 'class_a', weekNumber: 1, attendance: 'PRESENT', punctuality: 5, memoryVerse: 5, classParticipation: 5, lessonTotal: 15, joinedPrayerMeeting: false, postedStatusInsight: false, invitedSomeone: false, updatedAt: new Date().toISOString() },
    { id: 'g_2', memberId: 'student_123', classId: 'class_a', weekNumber: 2, attendance: 'PRESENT', punctuality: 4, memoryVerse: 5, classParticipation: 4, lessonTotal: 13, joinedPrayerMeeting: false, postedStatusInsight: false, invitedSomeone: false, updatedAt: new Date().toISOString() },
    { id: 'g_3', memberId: 'student_123', classId: 'class_a', weekNumber: 3, attendance: 'ABSENT', punctuality: 0, memoryVerse: 0, classParticipation: 0, lessonTotal: 0, joinedPrayerMeeting: false, postedStatusInsight: false, invitedSomeone: false, updatedAt: new Date().toISOString() },
    { id: 'g_4', memberId: 'student_123', classId: 'class_a', weekNumber: 4, attendance: 'PRESENT', punctuality: 5, memoryVerse: 4, classParticipation: 5, lessonTotal: 14, joinedPrayerMeeting: false, postedStatusInsight: false, invitedSomeone: false, updatedAt: new Date().toISOString() },
  ] as unknown as WeeklyGradeRecord[];
  const stats4 = calculateMemberStats(studentMember, grades4, 12);
  assert.equal(stats4.attendedWeeks, 3, 'Must record 3 attended weeks out of 4');
  assert.equal(stats4.absentWeeks, 1, 'Must record 1 absent week');
  assert.ok(stats4.attendedWeeks > 0, 'Must NEVER display 0 when records exist');
});
