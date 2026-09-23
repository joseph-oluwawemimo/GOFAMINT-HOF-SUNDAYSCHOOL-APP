import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  evaluateAttendanceAccess, 
  getAttendanceWeekLockKey,
  getThursdayClockInSecurity,
  getAttendanceSecurityState
} from '../src/utils/attendanceAccessSecurity';
import { 
  ClockInConfig, 
  Member, 
  StudentTransferRecord,
  WeekLockRecord 
} from '../src/types';

// =========================================================================
// 1. Unified Attendance Access Controller: THURSDAY Matrix
// =========================================================================
test('Thursday Security: Future Thursday is automatically locked for both clock-in and manual attendance', () => {
  // Current date: 2026-09-17 (Thursday W2), scheduled date: 2026-09-24 (Thursday W3)
  const simulatedNow = new Date('2026-09-17T17:30:00Z'); // Thursday within time window, but for past week
  const evalResult = evaluateAttendanceAccess({
    sessionType: 'THURSDAY',
    weekNumber: 3,
    scheduledDate: '2026-09-24',
    openTime: '16:00',
    closeTime: '19:00',
    now: simulatedNow
  });

  assert.equal(evalResult.status, 'FUTURE_LOCKED');
  assert.equal(evalResult.canClockIn, false, 'Future Thursday cannot clock in');
  assert.equal(evalResult.canManualAttendance, false, 'Future Thursday cannot take manual attendance');
  assert.equal(evalResult.isFuture, true);
  assert.equal(evalResult.allowedActions.clockIn, false);
  assert.equal(evalResult.allowedActions.manualEdit, false);
  assert.ok(evalResult.lockReason?.includes('before the date arrives'));
});

test('Thursday Security: Before opening time on scheduled Thursday locks BOTH clock-in and manual attendance', () => {
  // Nigeria is UTC+1. 09:00 UTC = 10:00 WAT. Opening time is 16:00 WAT.
  const simulatedNow = new Date('2026-09-24T09:00:00Z');
  const evalResult = evaluateAttendanceAccess({
    sessionType: 'THURSDAY',
    weekNumber: 3,
    scheduledDate: '2026-09-24',
    openTime: '16:00',
    closeTime: '19:00',
    now: simulatedNow
  });

  assert.equal(evalResult.status, 'BEFORE_WINDOW_LOCKED');
  assert.equal(evalResult.canClockIn, false, 'Cannot clock in before opening window');
  assert.equal(evalResult.canManualAttendance, false, 'Manual attendance CANNOT open before clock-in opens');
  assert.equal(evalResult.isToday, true);
  assert.equal(evalResult.allowedActions.clockIn, false);
  assert.equal(evalResult.allowedActions.manualEdit, false);
  assert.ok(evalResult.lockReason?.includes('16:00 WAT'));
});

test('Thursday Security: During window on scheduled Thursday OPENS both clock-in and manual attendance', () => {
  // 16:30 UTC = 17:30 WAT (between 16:00 and 19:00 WAT)
  const simulatedNow = new Date('2026-09-24T16:30:00Z');
  const evalResult = evaluateAttendanceAccess({
    sessionType: 'THURSDAY',
    weekNumber: 3,
    scheduledDate: '2026-09-24',
    openTime: '16:00',
    closeTime: '19:00',
    now: simulatedNow
  });

  assert.equal(evalResult.status, 'CLOCK_IN_AND_MANUAL_OPEN');
  assert.equal(evalResult.canClockIn, true, 'Clock-in is OPEN');
  assert.equal(evalResult.canManualAttendance, true, 'Manual attendance is OPEN');
  assert.equal(evalResult.isToday, true);
  assert.equal(evalResult.allowedActions.clockIn, true);
  assert.equal(evalResult.allowedActions.manualEdit, true);
});

test('Thursday Security: After window on scheduled Thursday CLOSES clock-in but manual attendance REMAINS OPEN', () => {
  // 18:30 UTC = 19:30 WAT (after 19:00 WAT closing cutoff)
  const simulatedNow = new Date('2026-09-24T18:30:00Z');
  const evalResult = evaluateAttendanceAccess({
    sessionType: 'THURSDAY',
    weekNumber: 3,
    scheduledDate: '2026-09-24',
    openTime: '16:00',
    closeTime: '19:00',
    now: simulatedNow
  });

  assert.equal(evalResult.status, 'CLOCK_IN_CLOSED_MANUAL_OPEN');
  assert.equal(evalResult.canClockIn, false, 'Clock-in is CLOSED after window');
  assert.equal(evalResult.canManualAttendance, true, 'Manual attendance REMAINS OPEN after clock-in closes');
  assert.equal(evalResult.isToday, true);
  assert.equal(evalResult.allowedActions.clockIn, false);
  assert.equal(evalResult.allowedActions.manualEdit, true);
});

test('Thursday Security: Past Thursday not manually locked allows manual entry and shows Lock Entry action', () => {
  // Simulated now: 2026-09-26 (Saturday), target Thursday: 2026-09-24
  const simulatedNow = new Date('2026-09-26T10:00:00Z');
  const evalResult = evaluateAttendanceAccess({
    sessionType: 'THURSDAY',
    weekNumber: 3,
    scheduledDate: '2026-09-24',
    openTime: '16:00',
    closeTime: '19:00',
    now: simulatedNow
  });

  assert.equal(evalResult.status, 'PAST_UNLOCKED_MANUAL_OPEN');
  assert.equal(evalResult.canClockIn, false);
  assert.equal(evalResult.canManualAttendance, true);
  assert.equal(evalResult.allowedActions.lockEntry, true, 'Secretary can click Lock Entry');
  assert.equal(evalResult.allowedActions.requestChanges, false);
});

test('Thursday Security: Past Thursday manually locked requires Request Changes workflow', () => {
  const simulatedNow = new Date('2026-09-26T10:00:00Z');
  const weekKey = getAttendanceWeekLockKey('THURSDAY', 1, 3);
  const mockConfig: ClockInConfig = {
    id: 'cfg_1',
    serviceName: 'Test',
    serviceStartTime: '08:00',
    gracePeriodMinutes: 30,
    serviceDate: '2026-09-24',
    thursdayOpenTime: '16:00',
    thursdayCloseTime: '19:00',
    autoSoundFeedback: false,
    showCelebration: false,
    lockedWeeks: {
      [weekKey]: {
        isLocked: true,
        lockedAt: '2026-09-25T12:00:00Z',
        lockedBy: 'Workers Coordinator'
      }
    }
  };

  const evalResult = evaluateAttendanceAccess({
    sessionType: 'THURSDAY',
    weekNumber: 3,
    scheduledDate: '2026-09-24',
    quarterNumber: 1,
    config: mockConfig,
    now: simulatedNow
  });

  assert.equal(evalResult.status, 'PAST_MANUALLY_LOCKED');
  assert.equal(evalResult.canClockIn, false);
  assert.equal(evalResult.canManualAttendance, false, 'Manual editing blocked while locked');
  assert.equal(evalResult.allowedActions.requestChanges, true, 'User must request changes');
  assert.equal(evalResult.allowedActions.lockEntry, false);
  assert.ok(evalResult.lockReason?.includes('Submit a change request'));
});

test('Thursday Security: Approved change request enables Changes Mode and provides Changes Done button', () => {
  const simulatedNow = new Date('2026-09-26T10:00:00Z');
  const weekKey = getAttendanceWeekLockKey('THURSDAY', 1, 3);
  const mockConfig: ClockInConfig = {
    id: 'cfg_2',
    serviceName: 'Test',
    serviceStartTime: '08:00',
    gracePeriodMinutes: 30,
    serviceDate: '2026-09-24',
    thursdayOpenTime: '16:00',
    thursdayCloseTime: '19:00',
    autoSoundFeedback: false,
    showCelebration: false,
    lockedWeeks: {
      [weekKey]: {
        isLocked: true,
        activeChangeRequest: {
          id: 'cr_1',
          sessionType: 'THURSDAY',
          quarterNumber: 1,
          weekNumber: 3,
          requestedBy: 'Bro John',
          requestedAt: '2026-09-26T08:00:00Z',
          reason: 'Typo in sound engineer attendance',
          status: 'APPROVED',
          reviewedBy: 'General Coordinator',
          reviewedAt: '2026-09-26T09:00:00Z'
        }
      }
    }
  };

  const evalResult = evaluateAttendanceAccess({
    sessionType: 'THURSDAY',
    weekNumber: 3,
    scheduledDate: '2026-09-24',
    quarterNumber: 1,
    config: mockConfig,
    now: simulatedNow
  });

  assert.equal(evalResult.status, 'PAST_CHANGE_REQUEST_APPROVED');
  assert.equal(evalResult.isChangeModeActive, true);
  assert.equal(evalResult.canManualAttendance, true, 'Unlocked for corrections in Changes Mode');
  assert.equal(evalResult.allowedActions.completeChanges, true, 'Changes Done button available to re-lock');
  assert.equal(evalResult.canClockIn, false, 'Clock-in remains closed for past sessions');
});

// =========================================================================
// 2. Unified Attendance Access Controller: SUNDAY Matrix
// =========================================================================
test('Sunday Security: Wednesday is NOT Sunday -> Sunday terminal is locked even during matching clock hours', () => {
  // Wednesday 2026-09-23 at 08:30 WAT (07:30 UTC).
  // Even though 08:30 is within 07:00-11:30, today is Wednesday, NOT Sunday!
  const wednesdayNow = new Date('2026-09-23T07:30:00Z');
  const evalResult = evaluateAttendanceAccess({
    sessionType: 'SUNDAY',
    weekNumber: 3,
    scheduledDate: '2026-09-27', // Sunday is 4 days away
    openTime: '07:00',
    closeTime: '11:30',
    now: wednesdayNow
  });

  assert.equal(evalResult.status, 'FUTURE_LOCKED');
  assert.equal(evalResult.canClockIn, false, 'Must not open on Wednesday');
  assert.equal(evalResult.canManualAttendance, false, 'Must not take manual attendance on Wednesday for Sunday');
  assert.equal(evalResult.isToday, false);
});

test('Sunday Security: Sunday at 06:00 WAT before 07:00 opening window locks BOTH terminal and manual register', () => {
  // Sunday 2026-09-27 at 05:00 UTC = 06:00 WAT (before 07:00 WAT)
  const sundayMorningEarly = new Date('2026-09-27T05:00:00Z');
  const evalResult = evaluateAttendanceAccess({
    sessionType: 'SUNDAY',
    weekNumber: 3,
    scheduledDate: '2026-09-27',
    openTime: '07:00',
    closeTime: '11:30',
    now: sundayMorningEarly
  });

  assert.equal(evalResult.status, 'BEFORE_WINDOW_LOCKED');
  assert.equal(evalResult.canClockIn, false);
  assert.equal(evalResult.canManualAttendance, false, 'Manual attendance CANNOT open before clock-in opens on Sunday');
  assert.equal(evalResult.isToday, true);
  assert.ok(evalResult.lockReason?.includes('07:00 WAT'));
});

test('Sunday Security: Sunday at 08:30 WAT during window OPENS both terminal and manual register', () => {
  // Sunday 2026-09-27 at 07:30 UTC = 08:30 WAT (within 07:00 to 11:30 WAT)
  const sundayMorningLive = new Date('2026-09-27T07:30:00Z');
  const evalResult = evaluateAttendanceAccess({
    sessionType: 'SUNDAY',
    weekNumber: 3,
    scheduledDate: '2026-09-27',
    openTime: '07:00',
    closeTime: '11:30',
    now: sundayMorningLive
  });

  assert.equal(evalResult.status, 'CLOCK_IN_AND_MANUAL_OPEN');
  assert.equal(evalResult.canClockIn, true);
  assert.equal(evalResult.canManualAttendance, true);
  assert.equal(evalResult.isToday, true);
});

test('Sunday Security: Sunday after 11:30 WAT closes terminal but manual register REMAINS OPEN', () => {
  // Sunday 2026-09-27 at 11:00 UTC = 12:00 WAT (after 11:30 WAT closing)
  const sundayAfternoon = new Date('2026-09-27T11:00:00Z');
  const evalResult = evaluateAttendanceAccess({
    sessionType: 'SUNDAY',
    weekNumber: 3,
    scheduledDate: '2026-09-27',
    openTime: '07:00',
    closeTime: '11:30',
    now: sundayAfternoon
  });

  assert.equal(evalResult.status, 'CLOCK_IN_CLOSED_MANUAL_OPEN');
  assert.equal(evalResult.canClockIn, false, 'Terminal closed after 11:30');
  assert.equal(evalResult.canManualAttendance, true, 'Manual attendance remains open');
  assert.equal(evalResult.isToday, true);
});

// =========================================================================
// 3. Visitor and Student Transfer Data Model Integrity
// =========================================================================
test('Transfer Data Model: Transfer record preserves memberType for both STUDENT and VISITOR', () => {
  const studentTransfer: StudentTransferRecord = {
    id: 'tr_1',
    memberId: 'm_student_1',
    studentId: 'm_student_1',
    memberType: 'STUDENT',
    memberName: 'Brother Enoch',
    previousDepartment: 'Youth',
    previousClassId: 'cls_youth_1',
    previousClassName: 'Youth Class A',
    destinationDepartment: 'Adult',
    destinationClassId: 'cls_adult_1',
    destinationClassName: 'Adult Class A',
    reason: 'Age graduation',
    requestingOfficer: 'Teacher David',
    requestedAt: '2026-09-23T08:00:00Z',
    effectiveWeekNumber: 4,
    status: 'PENDING',
    createdAt: '2026-09-23T08:00:00Z',
    updatedAt: '2026-09-23T08:00:00Z'
  };

  const visitorTransfer: StudentTransferRecord = {
    id: 'tr_2',
    memberId: 'm_visitor_1',
    studentId: 'm_visitor_1',
    memberType: 'VISITOR',
    memberName: 'Sister Mary (Visitor)',
    previousDepartment: 'Intermediate',
    previousClassId: 'cls_inter_1',
    previousClassName: 'Intermediate Class A',
    destinationDepartment: 'Youth',
    destinationClassId: 'cls_youth_2',
    destinationClassName: 'Youth Class B',
    reason: 'Family relocated to youth peer group',
    requestingOfficer: 'Secretary Ruth',
    requestedAt: '2026-09-23T08:15:00Z',
    effectiveWeekNumber: 4,
    status: 'PENDING',
    createdAt: '2026-09-23T08:15:00Z',
    updatedAt: '2026-09-23T08:15:00Z'
  };

  assert.equal(studentTransfer.memberType, 'STUDENT');
  assert.equal(visitorTransfer.memberType, 'VISITOR');
  assert.equal(visitorTransfer.destinationDepartment, 'Youth');
  assert.equal(visitorTransfer.reason, 'Family relocated to youth peer group');
});

test('Backward Compatibility Adapters: getThursdayClockInSecurity & getAttendanceSecurityState match engine', () => {
  const targetDate = '2026-09-24';
  const liveNow = new Date('2026-09-24T16:30:00Z'); // 17:30 WAT

  const thuResult = getThursdayClockInSecurity(targetDate, { thursdayOpenTime: '16:00', thursdayCloseTime: '19:00' }, liveNow);
  assert.equal(thuResult.allowed, true);
  assert.equal(thuResult.isOpen, true);
  assert.equal(thuResult.status, 'OPEN');

  const sunTarget = '2026-09-27';
  const sunNow = new Date('2026-09-27T07:30:00Z'); // 08:30 WAT
  const sunResult = getAttendanceSecurityState(sunTarget, '07:00', '11:30', sunNow);
  assert.equal(sunResult.clockingAllowed, true);
  assert.equal(sunResult.manualAttendanceAllowed, true);
  assert.equal(sunResult.status, 'OPEN');
});
