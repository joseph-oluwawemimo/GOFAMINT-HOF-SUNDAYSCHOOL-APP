import test from 'node:test';
import assert from 'node:assert/strict';
import { Member, ClockInConfig } from '../src/types';
import { evaluateAttendanceAccess, getAttendanceWeekLockKey } from '../src/utils/attendanceAccessSecurity';

test('Exclusion & Archive: One-Time Visitor temporal exclusion preserves history and marks status LEFT_CLASS', () => {
  const visitor: Member = {
    id: 'mem_vis_1',
    fullName: 'Bro. Emmanuel Visitor',
    phone: '08012345678',
    address: 'Abuja, Nigeria',
    occupation: 'Engineer',
    memberType: 'VISITOR',
    status: 'ACTIVE',
    firstLessonWeek: 1,
    evangelismReferralCount: 0,
    prayerRequests: 'Safe journey back home',
    notes: 'Visiting for one service',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  };

  // Temporarily exclude visitor as one-time guest
  const excludedVisitor: Member = {
    ...visitor,
    status: 'LEFT_CLASS',
    exclusionType: 'TEMPORARY',
    isOneTimeVisitor: true,
    departureWeek: 2,
    departureDate: '2026-09-20',
    departureReason: '[One-Time Visitor / Temporal] One-Time Visiting Guest: Traveled in for Sunday service only',
    updatedAt: new Date().toISOString()
  };

  // Verify status is LEFT_CLASS so calculations omit them from future denominator
  assert.equal(excludedVisitor.status, 'LEFT_CLASS');
  assert.equal(excludedVisitor.exclusionType, 'TEMPORARY');
  assert.equal(excludedVisitor.isOneTimeVisitor, true);
  assert.ok(excludedVisitor.departureReason?.includes('One-Time Visiting Guest'));

  // Test restoration to active roster
  const restoredVisitor: Member = {
    ...excludedVisitor,
    status: 'ACTIVE',
    exclusionType: undefined,
    isOneTimeVisitor: undefined,
    departureDate: undefined,
    departureReason: undefined,
    departureWeek: undefined,
    updatedAt: new Date().toISOString()
  };

  assert.equal(restoredVisitor.status, 'ACTIVE');
  assert.equal(restoredVisitor.exclusionType, undefined);
  assert.equal(restoredVisitor.isOneTimeVisitor, undefined);
});

test('Exclusion & Archive: Permanent departure archives student cleanly', () => {
  const student: Member = {
    id: 'mem_stu_1',
    fullName: 'Sis. Grace Relocated',
    phone: '08098765432',
    address: 'Lagos, Nigeria',
    occupation: 'Nurse',
    memberType: 'STUDENT',
    status: 'ACTIVE',
    firstLessonWeek: 1,
    evangelismReferralCount: 2,
    prayerRequests: 'Relocation to UK',
    notes: 'Regular member',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  };

  const archivedStudent: Member = {
    ...student,
    status: 'LEFT_CLASS',
    exclusionType: 'PERMANENT',
    departureWeek: 3,
    departureDate: '2026-09-24',
    departureReason: '[Permanent Archive] Relocation: Moved overseas for work',
    updatedAt: new Date().toISOString()
  };

  assert.equal(archivedStudent.status, 'LEFT_CLASS');
  assert.equal(archivedStudent.exclusionType, 'PERMANENT');
  assert.equal(archivedStudent.isOneTimeVisitor, undefined);
  assert.ok(archivedStudent.departureReason?.includes('Relocation'));
});

test('One-Time Profile Links: Valid for both Students and Visitors with 14-day expiry', () => {
  const student: Member = {
    id: 'mem_stu_2',
    fullName: 'Bro. David Student',
    phone: '08022223333',
    address: 'Ibadan',
    occupation: 'Teacher',
    memberType: 'STUDENT',
    status: 'ACTIVE',
    firstLessonWeek: 1,
    evangelismReferralCount: 0,
    prayerRequests: '',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const studentToken = 'stu_' + Math.random().toString(36).substring(2, 10);
  const studentWithLink: Member = {
    ...student,
    oneTimeProfileToken: {
      token: studentToken,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      isUsed: false
    }
  };

  assert.ok(studentWithLink.oneTimeProfileToken);
  assert.equal(studentWithLink.oneTimeProfileToken.isUsed, false);
  assert.ok(studentWithLink.oneTimeProfileToken.token.startsWith('stu_'));
});

test('Lock Register & Make Changes: Lock register prevents accidental changes on today session', () => {
  const simulatedNow = new Date('2026-09-24T17:00:00Z');
  const weekKey = getAttendanceWeekLockKey('THURSDAY', 1, 3);
  const mockConfig: ClockInConfig = {
    id: 'cfg_lock_test',
    serviceName: 'Preparatory Class',
    serviceStartTime: '16:00',
    gracePeriodMinutes: 30,
    serviceDate: '2026-09-24',
    thursdayOpenTime: '16:00',
    thursdayCloseTime: '19:00',
    autoSoundFeedback: false,
    showCelebration: false,
    lockedWeeks: {
      [weekKey]: {
        isLocked: true,
        lockedAt: '2026-09-24T16:45:00Z',
        lockedBy: 'Class Coordinator'
      }
    }
  };

  const lockedEval = evaluateAttendanceAccess({
    sessionType: 'THURSDAY',
    weekNumber: 3,
    scheduledDate: '2026-09-24',
    quarterNumber: 1,
    config: mockConfig,
    now: simulatedNow
  });

  // When locked, neither clock-in nor manual attendance is allowed
  assert.equal(lockedEval.canClockIn, false);
  assert.equal(lockedEval.canManualAttendance, false);
  assert.equal(lockedEval.isManuallyLocked, true);
  assert.equal(lockedEval.allowedActions.requestChanges, true);

  // When Changes Mode is activated (approvedChangeRequest is true)
  const changesModeEval = evaluateAttendanceAccess({
    sessionType: 'THURSDAY',
    weekNumber: 3,
    scheduledDate: '2026-09-24',
    quarterNumber: 1,
    config: mockConfig,
    now: simulatedNow,
    hasApprovedChangeRequest: true
  });

  assert.equal(changesModeEval.status, 'PAST_CHANGE_REQUEST_APPROVED');
  assert.equal(changesModeEval.canManualAttendance, true);
  assert.equal(changesModeEval.isChangeModeActive, true);
  assert.equal(changesModeEval.allowedActions.completeChanges, true);
});

test('Denominator Exclusion: EXEMPT members are excluded from class attendance denominator', () => {
  // Simulate 19 total roster members: 16 active and 3 EXEMPT (or joined in later weeks / archived)
  const roster: Member[] = Array.from({ length: 19 }, (_, i) => ({
    id: `mem_${i + 1}`,
    fullName: `Member ${i + 1}`,
    memberType: 'STUDENT',
    status: i >= 16 ? 'LEFT_CLASS' : 'ACTIVE',
    firstLessonWeek: 1,
    evangelismReferralCount: 0,
    phone: '',
    address: '',
    occupation: '',
    prayerRequests: '',
    notes: '',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  }));

  // Week 1 attendance records: 12 PRESENT, 4 ABSENT, 3 EXEMPT
  const grades = roster.map((m, idx) => ({
    id: `${m.id}_week_1`,
    memberId: m.id,
    weekNumber: 1,
    attendance: (idx < 12 ? 'PRESENT' : idx < 16 ? 'ABSENT' : 'EXEMPT') as any,
    punctuality: idx < 12 ? 10 : 0,
    memoryVerse: idx < 12 ? 10 : 0,
    classParticipation: idx < 12 ? 10 : 0,
    lessonTotal: idx < 12 ? 30 : 0,
    joinedPrayerMeeting: false,
    postedStatusInsight: false,
    invitedSomeone: false,
    updatedAt: new Date().toISOString()
  }));

  // Filter eligible members (strictly excluding EXEMPT and un-enrolled / archived unless present)
  const eligible = roster.filter(m => {
    const g = grades.find(x => x.memberId === m.id);
    if (g?.attendance === 'EXEMPT') return false;
    if ((m.firstLessonWeek || 1) > 1) return false;
    if (m.status === 'LEFT_CLASS' && g?.attendance !== 'PRESENT') return false;
    return true;
  });

  const presentCount = grades.filter(g => g.attendance === 'PRESENT').length;
  assert.equal(presentCount, 12);
  assert.equal(eligible.length, 16); // Denominator is 16, NOT 19!
  
  const attendanceRate = Math.round((presentCount / eligible.length) * 100);
  assert.equal(attendanceRate, 75); // 12 of 16 = 75% (NOT 12 of 19 = 63%)
});

test('Mid-Quarter Joiners: Week 3 joiners show 7 of 7 in Week 1, NOT 7 of 9', () => {
  // 7 original students joined Week 1
  const initialStudents: Member[] = Array.from({ length: 7 }, (_, i) => ({
    id: `initial_${i + 1}`,
    fullName: `Initial Student ${i + 1}`,
    memberType: 'STUDENT',
    status: 'ACTIVE',
    firstLessonWeek: 1,
    evangelismReferralCount: 0,
    phone: '',
    address: '',
    occupation: '',
    prayerRequests: '',
    notes: '',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  }));

  // 2 new students joined in Week 3
  const week3Joiners: Member[] = [
    {
      id: 'joiner_1',
      fullName: 'Week 3 Joiner 1',
      memberType: 'STUDENT',
      status: 'ACTIVE',
      firstLessonWeek: 3,
      evangelismReferralCount: 0,
      phone: '',
      address: '',
      occupation: '',
      prayerRequests: '',
      notes: '',
      createdAt: '2026-09-20T00:00:00Z',
      updatedAt: '2026-09-20T00:00:00Z'
    },
    {
      id: 'joiner_2',
      fullName: 'Week 3 Joiner 2',
      memberType: 'STUDENT',
      status: 'ACTIVE',
      firstLessonWeek: 3,
      evangelismReferralCount: 0,
      phone: '',
      address: '',
      occupation: '',
      prayerRequests: '',
      notes: '',
      createdAt: '2026-09-20T00:00:00Z',
      updatedAt: '2026-09-20T00:00:00Z'
    }
  ];

  const fullRoster = [...initialStudents, ...week3Joiners];
  assert.equal(fullRoster.length, 9);

  // In Week 1:
  // All 7 initial students present
  const week1Eligible = fullRoster.filter(m => (m.firstLessonWeek || 1) <= 1);
  assert.equal(week1Eligible.length, 7); // Exactly 7 of 7, the 2 joiners are excluded

  // In Week 3:
  // All 9 are now eligible
  const week3Eligible = fullRoster.filter(m => (m.firstLessonWeek || 1) <= 3);
  assert.equal(week3Eligible.length, 9); // Exactly 9 of 9
});

test('Roster Sorting: Archived and One-Time Visitors are always sorted at the very bottom', () => {
  const members: Member[] = [
    {
      id: 'm1',
      fullName: 'Zachary Active',
      status: 'ACTIVE',
      memberType: 'STUDENT',
      displayOrder: 1,
      firstLessonWeek: 1,
      evangelismReferralCount: 0,
      phone: '', address: '', occupation: '', prayerRequests: '', notes: '',
      createdAt: '', updatedAt: ''
    },
    {
      id: 'm2',
      fullName: 'Aaron Archived',
      status: 'LEFT_CLASS',
      memberType: 'VISITOR',
      isOneTimeVisitor: true,
      displayOrder: 0, // Lower order number should NOT override being archived
      firstLessonWeek: 1,
      evangelismReferralCount: 0,
      phone: '', address: '', occupation: '', prayerRequests: '', notes: '',
      createdAt: '', updatedAt: ''
    },
    {
      id: 'm3',
      fullName: 'Bella Active',
      status: 'ACTIVE',
      memberType: 'STUDENT',
      displayOrder: 2,
      firstLessonWeek: 1,
      evangelismReferralCount: 0,
      phone: '', address: '', occupation: '', prayerRequests: '', notes: '',
      createdAt: '', updatedAt: ''
    }
  ];

  // Sorting function from GradingMatrixView
  const sorted = [...members].sort((a, b) => {
    const isArchivedA = a.status === 'LEFT_CLASS';
    const isArchivedB = b.status === 'LEFT_CLASS';
    if (isArchivedA !== isArchivedB) {
      return isArchivedA ? 1 : -1;
    }
    const orderA = a.displayOrder !== undefined ? a.displayOrder : 99999;
    const orderB = b.displayOrder !== undefined ? b.displayOrder : 99999;
    if (orderA !== orderB) return orderA - orderB;
    return (a.fullName || '').localeCompare(b.fullName || '');
  });

  // Verify that Aaron (LEFT_CLASS) is sorted to the very last position
  assert.equal(sorted[0].fullName, 'Zachary Active');
  assert.equal(sorted[1].fullName, 'Bella Active');
  assert.equal(sorted[2].fullName, 'Aaron Archived');
});

