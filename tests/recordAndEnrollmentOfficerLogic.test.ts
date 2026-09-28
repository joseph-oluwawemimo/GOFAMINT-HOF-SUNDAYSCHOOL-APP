import test from 'node:test';
import assert from 'node:assert/strict';
import { isMemberStudentAtWeek, getEffectiveStudentActivationWeek } from '../src/utils/calculations';
import { hasPermanentlyExitedBy } from '../src/db/indexedDB';
import { Member } from '../src/types';

/**
 * Pure calculation logic simulator for Enrollment Officer weekly progression
 */
interface WeekIntake {
  weekNumber: number;
  newlyOnboarded: number;
  newlyEnrolled: number;
}

interface WeekOutput {
  weekNumber: number;
  newlyOnboarded: number;
  previouslyOnboarded: number;
  totalOnboarded: number;
  newVisitors: number;
  currentVisitors: number;
  totalVisitors: number;
  newlyEnrolled: number;
  previouslyEnrolled: number;
  totalEnrolled: number;
}

function simulateEnrollmentProgression(
  intakes: WeekIntake[],
  initialBroughtForwardStudents = 0,
  initialBroughtForwardVisitors = 0
): WeekOutput[] {
  let prevTotalOnboarded = initialBroughtForwardStudents + initialBroughtForwardVisitors;
  let prevTotalVisitors = initialBroughtForwardVisitors;
  let prevTotalEnrolled = initialBroughtForwardStudents;

  const results: WeekOutput[] = [];

  for (const intake of intakes) {
    const newlyOnboarded = intake.newlyOnboarded;
    const previouslyOnboarded = prevTotalOnboarded;
    const totalOnboarded = newlyOnboarded + previouslyOnboarded;

    const newlyEnrolled = intake.newlyEnrolled;
    const previouslyEnrolled = prevTotalEnrolled;
    const totalEnrolled = newlyEnrolled + previouslyEnrolled;

    const newVisitors = newlyOnboarded;
    const currentVisitors = Math.max(0, prevTotalVisitors - newlyEnrolled);
    const totalVisitors = newVisitors + currentVisitors;

    // Reconciliation check
    assert.equal(
      totalOnboarded,
      totalVisitors + totalEnrolled,
      `Week ${intake.weekNumber}: Total Onboarded (${totalOnboarded}) must equal Total Visitors (${totalVisitors}) + Total Enrolled (${totalEnrolled})`
    );
    assert.equal(
      totalOnboarded,
      newlyOnboarded + previouslyOnboarded,
      `Week ${intake.weekNumber}: Total Onboarded (${totalOnboarded}) must equal Newly Onboarded (${newlyOnboarded}) + Previously Onboarded (${previouslyOnboarded})`
    );
    assert.equal(
      totalEnrolled,
      newlyEnrolled + previouslyEnrolled,
      `Week ${intake.weekNumber}: Total Enrolled (${totalEnrolled}) must equal Newly Enrolled (${newlyEnrolled}) + Previously Enrolled (${previouslyEnrolled})`
    );
    assert.equal(
      totalVisitors,
      newVisitors + currentVisitors,
      `Week ${intake.weekNumber}: Total Visitors (${totalVisitors}) must equal New Visitors (${newVisitors}) + Current Visitors (${currentVisitors})`
    );

    results.push({
      weekNumber: intake.weekNumber,
      newlyOnboarded,
      previouslyOnboarded,
      totalOnboarded,
      newVisitors,
      currentVisitors,
      totalVisitors,
      newlyEnrolled,
      previouslyEnrolled,
      totalEnrolled
    });

    prevTotalOnboarded = totalOnboarded;
    prevTotalVisitors = totalVisitors;
    prevTotalEnrolled = totalEnrolled;
  }

  return results;
}

test('Part 6 & 14 — Case 1: Week 1 (8 onboarded, 0 enrolled)', () => {
  const progression = simulateEnrollmentProgression([
    { weekNumber: 1, newlyOnboarded: 8, newlyEnrolled: 0 }
  ]);

  const w1 = progression[0];
  assert.equal(w1.newlyOnboarded, 8);
  assert.equal(w1.previouslyOnboarded, 0);
  assert.equal(w1.totalOnboarded, 8);
  assert.equal(w1.newVisitors, 8);
  assert.equal(w1.currentVisitors, 0);
  assert.equal(w1.totalVisitors, 8);
  assert.equal(w1.newlyEnrolled, 0);
  assert.equal(w1.previouslyEnrolled, 0);
  assert.equal(w1.totalEnrolled, 0);

  // Validation
  assert.equal(w1.totalOnboarded, w1.totalVisitors + w1.totalEnrolled);
  assert.equal(w1.totalOnboarded, 8);
  assert.equal(w1.totalVisitors, 8);
  assert.equal(w1.totalEnrolled, 0);
});

test('Part 6 & 14 — Case 2: Week 2 (10 onboarded, 0 enrolled)', () => {
  const progression = simulateEnrollmentProgression([
    { weekNumber: 1, newlyOnboarded: 8, newlyEnrolled: 0 },
    { weekNumber: 2, newlyOnboarded: 2, newlyEnrolled: 0 }
  ]);

  const w2 = progression[1];
  assert.equal(w2.newlyOnboarded, 2);
  assert.equal(w2.previouslyOnboarded, 8);
  assert.equal(w2.totalOnboarded, 10);
  assert.equal(w2.newVisitors, 2);
  assert.equal(w2.currentVisitors, 8); // 8 - 0 = 8
  assert.equal(w2.totalVisitors, 10);
  assert.equal(w2.newlyEnrolled, 0);
  assert.equal(w2.previouslyEnrolled, 0);
  assert.equal(w2.totalEnrolled, 0);

  // Validation
  assert.equal(w2.totalOnboarded, w2.totalVisitors + w2.totalEnrolled);
  assert.equal(w2.totalOnboarded, 10);
  assert.equal(w2.totalVisitors, 10);
  assert.equal(w2.totalEnrolled, 0);
});

test('Part 6 & 14 — Case 3: Week 4 (11 onboarded, 3 enrolled)', () => {
  const progression = simulateEnrollmentProgression([
    { weekNumber: 1, newlyOnboarded: 8, newlyEnrolled: 0 },
    { weekNumber: 2, newlyOnboarded: 2, newlyEnrolled: 0 },
    { weekNumber: 3, newlyOnboarded: 1, newlyEnrolled: 0 },
    { weekNumber: 4, newlyOnboarded: 0, newlyEnrolled: 3 }
  ]);

  const w4 = progression[3];
  assert.equal(w4.newlyOnboarded, 0);
  assert.equal(w4.previouslyOnboarded, 11);
  assert.equal(w4.totalOnboarded, 11);
  assert.equal(w4.newVisitors, 0);
  assert.equal(w4.currentVisitors, 8); // 11 - 3 = 8
  assert.equal(w4.totalVisitors, 8);
  assert.equal(w4.newlyEnrolled, 3);
  assert.equal(w4.previouslyEnrolled, 0);
  assert.equal(w4.totalEnrolled, 3);

  // Master validation
  assert.equal(w4.totalOnboarded, w4.totalVisitors + w4.totalEnrolled);
  assert.equal(w4.totalOnboarded, 11);
  assert.equal(w4.totalVisitors, 8);
  assert.equal(w4.totalEnrolled, 3);
});

test('Part 6 & 14 — Case 4: Week 5 (12 onboarded, 4 enrolled)', () => {
  const progression = simulateEnrollmentProgression([
    { weekNumber: 1, newlyOnboarded: 8, newlyEnrolled: 0 },
    { weekNumber: 2, newlyOnboarded: 2, newlyEnrolled: 0 },
    { weekNumber: 3, newlyOnboarded: 1, newlyEnrolled: 0 },
    { weekNumber: 4, newlyOnboarded: 0, newlyEnrolled: 3 },
    { weekNumber: 5, newlyOnboarded: 1, newlyEnrolled: 1 }
  ]);

  const w5 = progression[4];
  assert.equal(w5.newlyOnboarded, 1);
  assert.equal(w5.previouslyOnboarded, 11);
  assert.equal(w5.totalOnboarded, 12);
  assert.equal(w5.newVisitors, 1);
  assert.equal(w5.currentVisitors, 7); // 8 - 1 = 7
  assert.equal(w5.totalVisitors, 8);
  assert.equal(w5.newlyEnrolled, 1);
  assert.equal(w5.previouslyEnrolled, 3);
  assert.equal(w5.totalEnrolled, 4);

  // Master validation
  assert.equal(w5.totalOnboarded, w5.totalVisitors + w5.totalEnrolled);
  assert.equal(w5.totalOnboarded, 12);
  assert.equal(w5.totalVisitors, 8);
  assert.equal(w5.totalEnrolled, 4);
});

test('Part 1 & 14 — Record Officer Mathematical Verification', () => {
  // Example from prompt:
  // CLASS: Adult A
  // Students: 14, Visitors: 6 => Total Members: 20
  // Present: 17 (12 Students + 5 Visitors)
  // Absent: 3 (2 Students + 1 Visitor)
  // Offering: 25,500
  const studentsCount = 14;
  const visitorsCount = 6;
  const totalMembers = studentsCount + visitorsCount;

  const studentPresent = 12;
  const visitorPresent = 5;
  const totalPresent = studentPresent + visitorPresent;

  const studentAbsent = studentsCount - studentPresent; // 2
  const visitorAbsent = visitorsCount - visitorPresent; // 1
  const totalAbsent = studentAbsent + visitorAbsent; // 3

  assert.equal(totalMembers, 20);
  assert.equal(totalPresent, 17);
  assert.equal(totalAbsent, 3);
  assert.equal(studentAbsent, 2);
  assert.equal(visitorAbsent, 1);

  // Check Non-Negotiable Equations:
  assert.equal(totalPresent + totalAbsent, totalMembers, 'TOTAL PRESENT + TOTAL ABSENT = TOTAL MEMBERS');
  assert.equal(studentsCount + visitorsCount, totalMembers, 'STUDENTS + VISITORS = TOTAL MEMBERS');
  assert.equal(studentPresent + studentAbsent, studentsCount, 'STUDENT PRESENT + STUDENT ABSENT = STUDENTS');
  assert.equal(visitorPresent + visitorAbsent, visitorsCount, 'VISITOR PRESENT + VISITOR ABSENT = VISITORS');
});

test('Section 4 — Concise Record Male/Female Breakdown', () => {
  const members = [
    { id: '1', gender: 'MALE', isPresent: true },
    { id: '2', gender: 'MALE', isPresent: false },
    { id: '3', gender: 'FEMALE', isPresent: true },
    { id: '4', gender: 'FEMALE', isPresent: true },
    { id: '5', gender: 'FEMALE', isPresent: false }
  ];

  const maleCount = members.filter(m => m.gender === 'MALE').length; // 2
  const femaleCount = members.filter(m => m.gender === 'FEMALE').length; // 3
  const malePresent = members.filter(m => m.gender === 'MALE' && m.isPresent).length; // 1
  const femalePresent = members.filter(m => m.gender === 'FEMALE' && m.isPresent).length; // 2
  const maleAbsent = maleCount - malePresent; // 1
  const femaleAbsent = femaleCount - femalePresent; // 1

  assert.equal(maleCount + femaleCount, 5);
  assert.equal(malePresent + femalePresent, 3);
  assert.equal(maleAbsent + femaleAbsent, 2);
  assert.equal(malePresent + maleAbsent, maleCount);
  assert.equal(femalePresent + femaleAbsent, femaleCount);
});

test('Section 5 & 6 — Elaborate Inspection: Answering the 4 Composition Questions and Preserving Historical Status', () => {
  // Scenario:
  // Alice is an existing student. Present in Week 1, Absent in Week 4.
  // Bob is a visitor who attended Weeks 1, 2, 3 and qualifies as a Student in Week 4.
  // Charlie is a visitor who joins in Week 1, Present in Week 1, Absent in Week 4.
  // David is an existing student. Absent in Week 1, Present in Week 4.

  interface RosterMember {
    id: string;
    fullName: string;
    statusAtWeek: (w: number) => 'STUDENT' | 'VISITOR';
    attendanceAtWeek: (w: number) => 'PRESENT' | 'ABSENT';
  }

  const roster: RosterMember[] = [
    {
      id: 'alice',
      fullName: 'Alice Student',
      statusAtWeek: () => 'STUDENT',
      attendanceAtWeek: (w) => (w === 1 ? 'PRESENT' : 'ABSENT')
    },
    {
      id: 'bob',
      fullName: 'Bob Converted',
      // In Weeks 1, 2, 3 Bob is 100% VISITOR. Only in Week 4 does Bob become STUDENT.
      statusAtWeek: (w) => (w >= 4 ? 'STUDENT' : 'VISITOR'),
      attendanceAtWeek: () => 'PRESENT'
    },
    {
      id: 'charlie',
      fullName: 'Charlie Visitor',
      statusAtWeek: () => 'VISITOR',
      attendanceAtWeek: (w) => (w === 1 ? 'PRESENT' : 'ABSENT')
    },
    {
      id: 'david',
      fullName: 'David Student',
      statusAtWeek: () => 'STUDENT',
      attendanceAtWeek: (w) => (w === 1 ? 'ABSENT' : 'PRESENT')
    }
  ];

  // WEEK 1 INSPECTION
  const w1Members = roster.map(m => ({
    fullName: m.fullName,
    category: m.statusAtWeek(1),
    attendance: m.attendanceAtWeek(1)
  }));

  // Week 1 historical status check: Bob MUST be a VISITOR in Week 1
  const bobW1 = w1Members.find(m => m.fullName === 'Bob Converted');
  assert.equal(bobW1?.category, 'VISITOR', 'Bob MUST remain a Visitor in Week 1');

  // Question 1: "Who were the students that came?" (Week 1)
  const w1StudentsPresent = w1Members.filter(m => m.category === 'STUDENT' && m.attendance === 'PRESENT');
  assert.deepEqual(w1StudentsPresent.map(m => m.fullName), ['Alice Student']);

  // Question 2: "Who were the visitors that came?" (Week 1)
  const w1VisitorsPresent = w1Members.filter(m => m.category === 'VISITOR' && m.attendance === 'PRESENT');
  assert.deepEqual(w1VisitorsPresent.map(m => m.fullName), ['Bob Converted', 'Charlie Visitor']);

  // Question 3: "Who were the students that did not come?" (Week 1)
  const w1StudentsAbsent = w1Members.filter(m => m.category === 'STUDENT' && m.attendance === 'ABSENT');
  assert.deepEqual(w1StudentsAbsent.map(m => m.fullName), ['David Student']);

  // Question 4: "Who were the visitors that did not come?" (Week 1)
  const w1VisitorsAbsent = w1Members.filter(m => m.category === 'VISITOR' && m.attendance === 'ABSENT');
  assert.deepEqual(w1VisitorsAbsent.map(m => m.fullName), []);

  // WEEK 4 INSPECTION (After Bob qualifies as Student)
  const w4Members = roster.map(m => ({
    fullName: m.fullName,
    category: m.statusAtWeek(4),
    attendance: m.attendanceAtWeek(4)
  }));

  // Week 4 status check: Bob is now a STUDENT in Week 4
  const bobW4 = w4Members.find(m => m.fullName === 'Bob Converted');
  assert.equal(bobW4?.category, 'STUDENT', 'Bob is now a Student in Week 4');

  // Question 1: "Who were the students that came?" (Week 4)
  const w4StudentsPresent = w4Members.filter(m => m.category === 'STUDENT' && m.attendance === 'PRESENT');
  assert.deepEqual(w4StudentsPresent.map(m => m.fullName).sort(), ['Bob Converted', 'David Student'].sort());

  // Question 2: "Who were the visitors that came?" (Week 4)
  const w4VisitorsPresent = w4Members.filter(m => m.category === 'VISITOR' && m.attendance === 'PRESENT');
  assert.deepEqual(w4VisitorsPresent.map(m => m.fullName), []);

  // Question 3: "Who were the students that did not come?" (Week 4)
  const w4StudentsAbsent = w4Members.filter(m => m.category === 'STUDENT' && m.attendance === 'ABSENT');
  assert.deepEqual(w4StudentsAbsent.map(m => m.fullName), ['Alice Student']);

  // Question 4: "Who were the visitors that did not come?" (Week 4)
  const w4VisitorsAbsent = w4Members.filter(m => m.category === 'VISITOR' && m.attendance === 'ABSENT');
  assert.deepEqual(w4VisitorsAbsent.map(m => m.fullName), ['Charlie Visitor']);
});

test('Section 6 & 15 — Critical Historical Status Rule (isMemberStudentAtWeek)', () => {
  const visitorConvertedWeek4: Member = {
    id: 'mem_1',
    fullName: 'Bob Converted',
    memberType: 'STUDENT',
    status: 'ACTIVE',
    firstLessonWeek: 1,
    convertedFromVisitorAtLesson: 4,
    conversionStatus: 'APPROVED',
    phone: '08012345678',
    address: 'Church Road',
    occupation: 'Teacher',
    prayerRequests: '',
    notes: '',
    evangelismReferralCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-22T00:00:00Z'
  };

  // Week 1 -> Visitor
  assert.equal(isMemberStudentAtWeek(visitorConvertedWeek4, 1), false, 'Week 1 must remain Visitor');
  // Week 2 -> Visitor
  assert.equal(isMemberStudentAtWeek(visitorConvertedWeek4, 2), false, 'Week 2 must remain Visitor');
  // Week 3 -> Visitor
  assert.equal(isMemberStudentAtWeek(visitorConvertedWeek4, 3), false, 'Week 3 must remain Visitor');
  // Week 4 -> Student
  assert.equal(isMemberStudentAtWeek(visitorConvertedWeek4, 4), true, 'Week 4 is the first week treated as Student');
  // Week 5 -> Student
  assert.equal(isMemberStudentAtWeek(visitorConvertedWeek4, 5), true, 'Week 5 continues as Student');

  // Pre-existing student from prior quarters
  const preExistingStudent: Member = {
    id: 'mem_2',
    fullName: 'Alice Pre-existing',
    memberType: 'STUDENT',
    status: 'ACTIVE',
    firstLessonWeek: 1,
    phone: '08012345679',
    address: 'Main St',
    occupation: 'Engineer',
    prayerRequests: '',
    notes: '',
    evangelismReferralCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  };
  assert.equal(isMemberStudentAtWeek(preExistingStudent, 1), true, 'Pre-existing student is student from week 1');

  // Permanent exit check
  assert.equal(hasPermanentlyExitedBy(visitorConvertedWeek4, 1, 1, 'ACTIVE'), false);
  const exitedMember: Member = {
    ...visitorConvertedWeek4,
    status: 'LEFT_CLASS',
    departureQuarter: 1,
    departureWeek: 3
  };
  assert.equal(hasPermanentlyExitedBy(exitedMember, 1, 2, 'ACTIVE'), false, 'Not exited in week 2');
  assert.equal(hasPermanentlyExitedBy(exitedMember, 1, 3, 'ACTIVE'), true, 'Exited by week 3');
});

test('Section 10, 11, 12, 13, 14 — Authoritative 5-Week Enrollment Progression & Master Reconciliation', () => {
  const intakeSchedule: WeekIntake[] = [
    { weekNumber: 1, newlyOnboarded: 8, newlyEnrolled: 0 },
    { weekNumber: 2, newlyOnboarded: 2, newlyEnrolled: 0 },
    { weekNumber: 3, newlyOnboarded: 1, newlyEnrolled: 0 },
    { weekNumber: 4, newlyOnboarded: 0, newlyEnrolled: 3 },
    { weekNumber: 5, newlyOnboarded: 1, newlyEnrolled: 1 }
  ];

  const results = simulateEnrollmentProgression(intakeSchedule);

  // WEEK 1
  assert.deepEqual(results[0], {
    weekNumber: 1,
    newlyOnboarded: 8,
    previouslyOnboarded: 0,
    totalOnboarded: 8,
    newVisitors: 8,
    currentVisitors: 0,
    totalVisitors: 8,
    newlyEnrolled: 0,
    previouslyEnrolled: 0,
    totalEnrolled: 0
  });
  assert.equal(results[0].totalOnboarded, results[0].totalVisitors + results[0].totalEnrolled); // 8 = 8 + 0

  // WEEK 2
  assert.deepEqual(results[1], {
    weekNumber: 2,
    newlyOnboarded: 2,
    previouslyOnboarded: 8,
    totalOnboarded: 10,
    newVisitors: 2,
    currentVisitors: 8,
    totalVisitors: 10,
    newlyEnrolled: 0,
    previouslyEnrolled: 0,
    totalEnrolled: 0
  });
  assert.equal(results[1].totalOnboarded, results[1].totalVisitors + results[1].totalEnrolled); // 10 = 10 + 0

  // WEEK 3
  assert.deepEqual(results[2], {
    weekNumber: 3,
    newlyOnboarded: 1,
    previouslyOnboarded: 10,
    totalOnboarded: 11,
    newVisitors: 1,
    currentVisitors: 10,
    totalVisitors: 11,
    newlyEnrolled: 0,
    previouslyEnrolled: 0,
    totalEnrolled: 0
  });
  assert.equal(results[2].totalOnboarded, results[2].totalVisitors + results[2].totalEnrolled); // 11 = 11 + 0

  // WEEK 4 (Crucial Qualification Week)
  assert.deepEqual(results[3], {
    weekNumber: 4,
    newlyOnboarded: 0,
    previouslyOnboarded: 11,
    totalOnboarded: 11,
    newVisitors: 0,
    currentVisitors: 8, // 11 - 3 = 8
    totalVisitors: 8,   // 0 + 8 = 8
    newlyEnrolled: 3,
    previouslyEnrolled: 0,
    totalEnrolled: 3    // 3 + 0 = 3
  });
  assert.equal(results[3].totalOnboarded, results[3].totalVisitors + results[3].totalEnrolled); // 11 = 8 + 3

  // WEEK 5
  assert.deepEqual(results[4], {
    weekNumber: 5,
    newlyOnboarded: 1,
    previouslyOnboarded: 11,
    totalOnboarded: 12,
    newVisitors: 1,
    currentVisitors: 7, // 8 - 1 = 7
    totalVisitors: 8,   // 1 + 7 = 8
    newlyEnrolled: 1,
    previouslyEnrolled: 3,
    totalEnrolled: 4    // 1 + 3 = 4
  });
  assert.equal(results[4].totalOnboarded, results[4].totalVisitors + results[4].totalEnrolled); // 12 = 8 + 4
});

