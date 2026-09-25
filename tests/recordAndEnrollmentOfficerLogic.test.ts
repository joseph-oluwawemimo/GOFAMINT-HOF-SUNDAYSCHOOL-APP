import test from 'node:test';
import assert from 'node:assert/strict';

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
