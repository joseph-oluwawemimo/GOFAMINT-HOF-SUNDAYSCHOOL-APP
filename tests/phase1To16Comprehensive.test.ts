import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSundayRegisterOpenForWeek,
  getActiveSundayRegisterWeek,
  getLatestCompletedSundayWeek,
  getThursdayClockInSecurity,
  getAttendanceSecurityState,
  getNigeriaDate
} from '../src/utils/quarterScheduleUtils';
import { getStudentClassForWeek } from '../src/db/indexedDB';
import { QuarterData, Member, StudentTransferRecord } from '../src/types';

// Mock Quarter Data: Week 3 Sunday = 2026-09-20, Week 4 Sunday = 2026-09-27
const mockQuarter: QuarterData = {
  id: 'Q3_2026',
  quarterNumber: 3,
  quarterName: 'Quarter 3 (Jul - Sep 2026)',
  quarterTheme: 'Christian Diligence',
  totalLessonWeeks: 12,
  hasSharingAdmonitionWeek: true,
  status: 'ACTIVE',
  startDate: '2026-09-06',
  week1SundayDate: '2026-09-06',
  endDate: '2026-11-29',
  updatedAt: '2026-09-01T00:00:00Z',
  lessons: [
    {
      weekNumber: 3,
      topic: 'Walking in the Spirit',
      memoryVerse: 'Galatians 5:16',
      scriptureReading: 'Galatians 5:16-26'
    },
    {
      weekNumber: 4,
      topic: 'Faith and Works',
      memoryVerse: 'James 2:17',
      scriptureReading: 'James 2:14-26'
    }
  ]
};

test('Phase 1.1 - 1.3: Active Week logic locks register until Sunday 12:00 AM WAT', () => {
  // Tuesday Sep 22, 2026: Week 4 Sunday has NOT arrived yet (Sep 27)
  const tuesdayDate = new Date('2026-09-22T14:30:00+01:00');
  const isWeek4OpenOnTuesday = isSundayRegisterOpenForWeek(mockQuarter, 4, tuesdayDate);
  assert.equal(isWeek4OpenOnTuesday, false, 'Week 4 register must remain LOCKED on Tuesday before Sunday');

  // Saturday Sep 26, 2026 at 23:59:59 WAT: Week 4 register remains LOCKED
  const saturdayNight = new Date('2026-09-26T23:59:59+01:00');
  const isWeek4OpenOnSaturdayNight = isSundayRegisterOpenForWeek(mockQuarter, 4, saturdayNight);
  assert.equal(isWeek4OpenOnSaturdayNight, false, 'Week 4 register must remain LOCKED on Saturday 11:59 PM');

  // Sunday Sep 27, 2026 at 00:00:01 WAT: Week 4 register OPENS
  const sundayMidnight = new Date('2026-09-27T00:00:01+01:00');
  const isWeek4OpenOnSunday = isSundayRegisterOpenForWeek(mockQuarter, 4, sundayMidnight);
  assert.equal(isWeek4OpenOnSunday, true, 'Week 4 register must OPEN at Sunday 12:00 AM WAT');
});

test('Phase 1.4: Follow-up logic automatically defaults to latest completed Sunday register', () => {
  // On Tuesday Sep 22, Week 3 Sunday (Sep 20) is the latest completed Sunday
  const tuesdayDate = new Date('2026-09-22T12:00:00+01:00');
  const latestCompleted = getLatestCompletedSundayWeek(mockQuarter, tuesdayDate);
  assert.equal(latestCompleted, 3, 'Before Week 4 Sunday arrives, follow-up must default to Week 3');

  // On Sunday Sep 27, Week 4 is active
  const sundayDate = new Date('2026-09-27T10:00:00+01:00');
  const activeRegisterWeek = getActiveSundayRegisterWeek(mockQuarter, sundayDate);
  assert.equal(activeRegisterWeek.activeRegisterWeek, 4, 'On Sunday Sep 27, active register week must be Week 4');
});

test('Phase 3 & 3.1: Thursday Clock-In terminal checks BOTH date and time window in Nigeria timezone', () => {
  // Target Week 4 Thursday = 2026-09-24. Clock-in window: 17:00 to 19:30
  const thursdayDateStr = '2026-09-24';
  const config = { thursdayOpenTime: '17:00', thursdayCloseTime: '19:30' };

  // Test 1: Wrong day (Wednesday 2026-09-23) even during window hours 17:30
  const wednesdayDuringTime = new Date('2026-09-23T17:30:00+01:00');
  const wrongDayResult = getThursdayClockInSecurity(thursdayDateStr, config, wednesdayDuringTime);
  assert.equal(wrongDayResult.isDateMatch, false);
  assert.equal(wrongDayResult.isOpen, false);
  assert.equal(wrongDayResult.status, 'DATE_MISMATCH');

  // Test 2: Correct Thursday before clocking window (16:30)
  const thursdayBeforeWindow = new Date('2026-09-24T16:30:00+01:00');
  const beforeWindowResult = getThursdayClockInSecurity(thursdayDateStr, config, thursdayBeforeWindow);
  assert.equal(beforeWindowResult.isDateMatch, true);
  assert.equal(beforeWindowResult.isOpen, false);
  assert.equal(beforeWindowResult.status, 'BEFORE_WINDOW');

  // Test 3: Correct Thursday inside clocking window (17:45)
  const thursdayInWindow = new Date('2026-09-24T17:45:00+01:00');
  const inWindowResult = getThursdayClockInSecurity(thursdayDateStr, config, thursdayInWindow);
  assert.equal(inWindowResult.isDateMatch, true);
  assert.equal(inWindowResult.isOpen, true);
  assert.equal(inWindowResult.status, 'OPEN');

  // Test 4: Correct Thursday after clocking window (20:00)
  const thursdayAfterWindow = new Date('2026-09-24T20:00:00+01:00');
  const afterWindowResult = getThursdayClockInSecurity(thursdayDateStr, config, thursdayAfterWindow);
  assert.equal(afterWindowResult.isDateMatch, true);
  assert.equal(afterWindowResult.isOpen, false);
  assert.equal(afterWindowResult.status, 'AFTER_WINDOW');
});

test('Phase 4: Attendance security locks future attendance entry while manual remains open after window today', () => {
  const targetSundayDate = '2026-09-27';

  // If today is Tuesday Sep 22, target date Sep 27 is FUTURE -> completely LOCKED
  const tuesdayToday = new Date('2026-09-22T10:00:00+01:00');
  const futureSec = getAttendanceSecurityState(targetSundayDate, '08:00', '11:00', tuesdayToday);
  assert.equal(futureSec.isFuture, true);
  assert.equal(futureSec.canTakeManualAttendance, false, 'Manual attendance must be locked for future dates');
  assert.equal(futureSec.status, 'LOCKED_FUTURE');

  // If today is Sunday Sep 27 at 12:30 PM (after 11:00 window):
  // Clock-in is closed, but manual attendance REMAINS OPEN for authorized users (Phase 4.2)
  const sundayAfternoon = new Date('2026-09-27T12:30:00+01:00');
  const todayAfterWindow = getAttendanceSecurityState(targetSundayDate, '08:00', '11:00', sundayAfternoon);
  assert.equal(todayAfterWindow.isToday, true);
  assert.equal(todayAfterWindow.canClockIn, false, 'Clocking is closed after window');
  assert.equal(todayAfterWindow.canTakeManualAttendance, true, 'Manual attendance REMAINS OPEN after window on attendance day');
  assert.equal(todayAfterWindow.status, 'AFTER_WINDOW_MANUAL_OPEN');
});

test('Phase 10.5 & 10.7: Historical Member Transfer preserves previous classes in earlier weeks', () => {
  const transferRecord: StudentTransferRecord = {
    id: 'transfer_001',
    memberId: 'student_123',
    studentId: 'student_123',
    memberName: 'Oluwaseun Adeyemi',
    studentName: 'Oluwaseun Adeyemi',
    previousDepartment: 'Youth',
    fromDepartment: 'Youth',
    previousClassId: 'class_youth_b',
    fromClassId: 'class_youth_b',
    previousClassName: 'Youth B',
    fromClassName: 'Youth B',
    destinationDepartment: 'Adult',
    toDepartment: 'Adult',
    destinationClassId: 'class_adult_e',
    toClassId: 'class_adult_e',
    destinationClassName: 'Adult E',
    toClassName: 'Adult E',
    status: 'APPROVED',
    reason: 'Age progression to Adult class',
    effectiveWeekNumber: 4,
    effectiveWeek: 4,
    requestingOfficer: 'Teacher John',
    requestedBy: 'Teacher John',
    requestedAt: '2026-09-21T10:00:00Z',
    approvingOfficer: 'Enrollment Officer Sarah',
    reviewedBy: 'Enrollment Officer Sarah',
    approvalDate: '2026-09-22T08:00:00Z',
    reviewedAt: '2026-09-22T08:00:00Z',
    createdAt: '2026-09-21T10:00:00Z',
    updatedAt: '2026-09-22T08:00:00Z'
  };

  const student: Member = {
    id: 'student_123',
    fullName: 'Oluwaseun Adeyemi',
    gender: 'MALE',
    phone: '08012345678',
    address: '12 Faith Street, Lagos',
    occupation: 'Student',
    department: 'Adult',
    classId: 'class_adult_e',
    className: 'Adult E',
    memberType: 'STUDENT',
    status: 'ACTIVE',
    prayerRequests: 'Academic success',
    notes: 'Transferred from Youth B',
    firstLessonWeek: 1,
    evangelismReferralCount: 0,
    transferHistory: [transferRecord],
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-09-22T08:00:00Z'
  };

  // Lesson 1-3: Student historically belonged to Youth B
  const week1Class = getStudentClassForWeek(student, 1);
  assert.equal(week1Class.classId, 'class_youth_b');
  assert.equal(week1Class.department, 'Youth');

  const week2Class = getStudentClassForWeek(student, 2);
  assert.equal(week2Class.classId, 'class_youth_b');
  assert.equal(week2Class.className, 'Youth B');

  const week3Class = getStudentClassForWeek(student, 3);
  assert.equal(week3Class.classId, 'class_youth_b');

  // Lesson 4+: Transfer effective point — student belongs to Adult E
  const week4Class = getStudentClassForWeek(student, 4);
  assert.equal(week4Class.classId, 'class_adult_e');
  assert.equal(week4Class.department, 'Adult');
  assert.equal(week4Class.className, 'Adult E');

  const week5Class = getStudentClassForWeek(student, 5);
  assert.equal(week5Class.classId, 'class_adult_e');
});
