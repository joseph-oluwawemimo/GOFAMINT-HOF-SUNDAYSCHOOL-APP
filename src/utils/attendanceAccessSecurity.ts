/**
 * GOFAMINT Unified Attendance Access Controller
 * 
 * Strict Principle:
 * Reusable attendance security engine for BOTH Thursday and Sunday.
 * Enforces:
 * 1. Dual Date + Time checks in Nigeria Timezone (WAT).
 * 2. Clock-in terminal opens ONLY on the exact scheduled date during [openTime, closeTime].
 * 3. Manual attendance CANNOT open before the clock-in terminal opens.
 * 4. When clock-in terminal closes on the session date, manual attendance REMAINS OPEN.
 * 5. Future weeks are strictly locked.
 * 6. Past weeks can be locked manually ("Lock Entry") and unlocked only via a controlled
 *    "Request Changes" workflow with reason and audit history.
 */

import { ClockInConfig, QuarterNumber, WeekLockRecord } from '../types';
import { getNigeriaDateISO, getNigeriaTimeParts } from './quarterScheduleUtils';

export type AttendanceSessionType = 'THURSDAY' | 'SUNDAY';

export type AttendanceAccessStatus =
  | 'FUTURE_LOCKED'
  | 'BEFORE_WINDOW_LOCKED'
  | 'CLOCK_IN_AND_MANUAL_OPEN'
  | 'CLOCK_IN_CLOSED_MANUAL_OPEN'
  | 'PAST_UNLOCKED_MANUAL_OPEN'
  | 'PAST_MANUALLY_LOCKED'
  | 'PAST_CHANGE_REQUEST_APPROVED'
  | 'DATE_MISMATCH'
  | 'TEST_MODE';

export interface AttendanceAccessParams {
  sessionType: AttendanceSessionType;
  weekNumber: number;
  scheduledDate: string; // YYYY-MM-DD
  quarterNumber?: QuarterNumber;
  openTime?: string;     // e.g. "16:00" for Thu, "07:00" for Sun
  closeTime?: string;    // e.g. "19:00" for Thu, "11:30" for Sun
  now?: Date;
  isManuallyLocked?: boolean;
  hasApprovedChangeRequest?: boolean;
  config?: ClockInConfig;
  adminTestOverride?: boolean;
}

export interface AttendanceAccessEvaluation {
  status: AttendanceAccessStatus;
  sessionType: AttendanceSessionType;
  weekNumber: number;
  scheduledDate: string;
  canClockIn: boolean;
  canManualAttendance: boolean;
  isDateMatch: boolean;
  isToday: boolean;
  isFuture: boolean;
  isPast: boolean;
  isManuallyLocked: boolean;
  isChangeRequestRequired: boolean;
  isChangeModeActive: boolean;
  badgeLabel: string;
  badgeColor: 'green' | 'amber' | 'red' | 'blue' | 'slate';
  lockReason?: string;
  allowedActions: {
    clockIn: boolean;
    manualEdit: boolean;
    lockEntry: boolean;
    requestChanges: boolean;
    completeChanges: boolean;
  };
}

/**
 * Generate week lock key e.g. "THURSDAY_1_3" or "SUNDAY_1_3"
 */
export function getAttendanceWeekLockKey(
  sessionType: AttendanceSessionType,
  quarterNumber: number,
  weekNumber: number
): string {
  return `${sessionType}_${quarterNumber}_${weekNumber}`;
}

/**
 * Master evaluation function for Thursday & Sunday Attendance Access
 */
export function evaluateAttendanceAccess(params: AttendanceAccessParams): AttendanceAccessEvaluation {
  const {
    sessionType,
    weekNumber,
    scheduledDate,
    quarterNumber = 1,
    now = new Date(),
    adminTestOverride = false,
    config
  } = params;

  // Resolve open & close times based on session type and config
  const defaultOpen = sessionType === 'THURSDAY' ? '16:00' : '07:00';
  const defaultClose = sessionType === 'THURSDAY' ? '19:00' : '11:30';
  const openTime = params.openTime || (sessionType === 'THURSDAY' ? config?.thursdayOpenTime : config?.sundayOpenTime) || defaultOpen;
  const closeTime = params.closeTime || (sessionType === 'THURSDAY' ? config?.thursdayCloseTime : config?.sundayCloseTime) || defaultClose;

  // Check manual lock status from config or explicit param
  const weekLockKey = getAttendanceWeekLockKey(sessionType, quarterNumber, weekNumber);
  const weekLockRecord: WeekLockRecord | undefined = config?.lockedWeeks?.[weekLockKey];
  const isManuallyLocked = params.isManuallyLocked !== undefined
    ? params.isManuallyLocked
    : !!weekLockRecord?.isLocked;
  const hasApprovedChangeRequest = params.hasApprovedChangeRequest !== undefined
    ? params.hasApprovedChangeRequest
    : (weekLockRecord?.activeChangeRequest?.status === 'APPROVED');

  // Admin rehearsal override
  if (adminTestOverride) {
    return {
      status: 'TEST_MODE',
      sessionType,
      weekNumber,
      scheduledDate,
      canClockIn: true,
      canManualAttendance: true,
      isDateMatch: true,
      isToday: true,
      isFuture: false,
      isPast: false,
      isManuallyLocked: false,
      isChangeRequestRequired: false,
      isChangeModeActive: false,
      badgeLabel: 'Admin Test Mode',
      badgeColor: 'blue',
      lockReason: undefined,
      allowedActions: {
        clockIn: true,
        manualEdit: true,
        lockEntry: false,
        requestChanges: false,
        completeChanges: false,
      }
    };
  }

  // 1. DATE EVALUATION in Nigeria Timezone
  const todayIso = getNigeriaDateISO(now);
  const isToday = todayIso === scheduledDate;
  const isFuture = todayIso < scheduledDate;
  const isPast = todayIso > scheduledDate;

  // 1A. FUTURE DATE: Automatically and completely locked
  if (isFuture) {
    const dayName = sessionType === 'THURSDAY' ? 'Thursday Preparatory Class' : 'Sunday Service';
    return {
      status: 'FUTURE_LOCKED',
      sessionType,
      weekNumber,
      scheduledDate,
      canClockIn: false,
      canManualAttendance: false,
      isDateMatch: false,
      isToday: false,
      isFuture: true,
      isPast: false,
      isManuallyLocked: false,
      isChangeRequestRequired: false,
      isChangeModeActive: false,
      badgeLabel: 'Future Date Locked',
      badgeColor: 'slate',
      lockReason: `${dayName} for Week ${weekNumber} is scheduled for ${scheduledDate}. Attendance cannot be recorded before the date arrives.`,
      allowedActions: {
        clockIn: false,
        manualEdit: false,
        lockEntry: false,
        requestChanges: false,
        completeChanges: false,
      }
    };
  }

  // 1B. PAST DATE: Live clock-in is closed; manual attendance depends on lock status
  if (isPast) {
    // If change request is approved, allow corrections
    if (hasApprovedChangeRequest) {
      return {
        status: 'PAST_CHANGE_REQUEST_APPROVED',
        sessionType,
        weekNumber,
        scheduledDate,
        canClockIn: false,
        canManualAttendance: true,
        isDateMatch: false,
        isToday: false,
        isFuture: false,
        isPast: true,
        isManuallyLocked: true,
        isChangeRequestRequired: false,
        isChangeModeActive: true,
        badgeLabel: 'Changes Mode Active',
        badgeColor: 'amber',
        lockReason: undefined,
        allowedActions: {
          clockIn: false,
          manualEdit: true,
          lockEntry: false,
          requestChanges: false,
          completeChanges: true, // "Changes Done" button visible
        }
      };
    }

    // If manually locked, completely prevent editing
    if (isManuallyLocked) {
      return {
        status: 'PAST_MANUALLY_LOCKED',
        sessionType,
        weekNumber,
        scheduledDate,
        canClockIn: false,
        canManualAttendance: false,
        isDateMatch: false,
        isToday: false,
        isFuture: false,
        isPast: true,
        isManuallyLocked: true,
        isChangeRequestRequired: true,
        isChangeModeActive: false,
        badgeLabel: 'Past Record Locked',
        badgeColor: 'red',
        lockReason: `Historical attendance for Week ${weekNumber} has been finalized and locked. Submit a change request to make authorized corrections.`,
        allowedActions: {
          clockIn: false,
          manualEdit: false,
          lockEntry: false,
          requestChanges: true, // "Request Changes" button visible
          completeChanges: false,
        }
      };
    }

    // Past date not yet locked: Live clock-in closed, but manual attendance available
    return {
      status: 'PAST_UNLOCKED_MANUAL_OPEN',
      sessionType,
      weekNumber,
      scheduledDate,
      canClockIn: false,
      canManualAttendance: true,
      isDateMatch: false,
      isToday: false,
      isFuture: false,
      isPast: true,
      isManuallyLocked: false,
      isChangeRequestRequired: false,
      isChangeModeActive: false,
      badgeLabel: 'Past Record (Open for Entry)',
      badgeColor: 'blue',
      lockReason: undefined,
      allowedActions: {
        clockIn: false,
        manualEdit: true,
        lockEntry: true, // Secretary can click "Lock Entry"
        requestChanges: false,
        completeChanges: false,
      }
    };
  }

  // 1C. CURRENT DATE: Check time window in Nigeria timezone
  const ngParts = getNigeriaTimeParts(now);
  const [oH, oM] = openTime.split(':').map(Number);
  const [cH, cM] = closeTime.split(':').map(Number);
  const openMinutes = (oH || 0) * 60 + (oM || 0);
  const closeMinutes = (cH || 0) * 60 + (cM || 0);
  const nowMinutes = ngParts.hours * 60 + ngParts.minutes;

  // RULE: Manual attendance CANNOT open before the clock-in terminal opens
  if (nowMinutes < openMinutes) {
    const dayLabel = sessionType === 'THURSDAY' ? 'Thursday Preparatory Class' : 'Sunday Service';
    return {
      status: 'BEFORE_WINDOW_LOCKED',
      sessionType,
      weekNumber,
      scheduledDate,
      canClockIn: false,
      canManualAttendance: false,
      isDateMatch: true,
      isToday: true,
      isFuture: false,
      isPast: false,
      isManuallyLocked: false,
      isChangeRequestRequired: false,
      isChangeModeActive: false,
      badgeLabel: `Opens at ${openTime}`,
      badgeColor: 'amber',
      lockReason: `${dayLabel} attendance is locked. Terminal and manual attendance will open at ${openTime} WAT.`,
      allowedActions: {
        clockIn: false,
        manualEdit: false,
        lockEntry: false,
        requestChanges: false,
        completeChanges: false,
      }
    };
  }

  // RULE: When clock-in window closes, clock-in is CLOSED but manual attendance REMAINS OPEN
  if (nowMinutes > closeMinutes) {
    return {
      status: 'CLOCK_IN_CLOSED_MANUAL_OPEN',
      sessionType,
      weekNumber,
      scheduledDate,
      canClockIn: false,
      canManualAttendance: true,
      isDateMatch: true,
      isToday: true,
      isFuture: false,
      isPast: false,
      isManuallyLocked: false,
      isChangeRequestRequired: false,
      isChangeModeActive: false,
      badgeLabel: 'Terminal Closed • Manual Open',
      badgeColor: 'amber',
      lockReason: undefined,
      allowedActions: {
        clockIn: false,
        manualEdit: true,
        lockEntry: true,
        requestChanges: false,
        completeChanges: false,
      }
    };
  }

  // Active Clock-in and Manual Window
  return {
    status: 'CLOCK_IN_AND_MANUAL_OPEN',
    sessionType,
    weekNumber,
    scheduledDate,
    canClockIn: true,
    canManualAttendance: true,
    isDateMatch: true,
    isToday: true,
    isFuture: false,
    isPast: false,
    isManuallyLocked: false,
    isChangeRequestRequired: false,
    isChangeModeActive: false,
    badgeLabel: 'Live Clock-In Active',
    badgeColor: 'green',
    lockReason: undefined,
    allowedActions: {
      clockIn: true,
      manualEdit: true,
      lockEntry: false,
      requestChanges: false,
      completeChanges: false,
    }
  };
}

/**
 * Backward compatibility adapter for getThursdayClockInSecurity
 */
export function getThursdayClockInSecurity(
  targetPrepDate: string,
  configOrDate?: { thursdayOpenTime?: string; thursdayCloseTime?: string } | Date,
  nowInput?: Date,
  adminTestOverride: boolean = false
): {
  allowed: boolean;
  isOpen: boolean;
  isDateMatch: boolean;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  status: 'OPEN' | 'DATE_MISMATCH' | 'BEFORE_WINDOW' | 'AFTER_WINDOW' | 'TEST_MODE';
  reason: string;
} {
  const config = (configOrDate instanceof Date ? {} : configOrDate) || {};
  const now = (configOrDate instanceof Date ? configOrDate : nowInput) || new Date();

  const evalResult = evaluateAttendanceAccess({
    sessionType: 'THURSDAY',
    weekNumber: 1,
    scheduledDate: targetPrepDate,
    openTime: config.thursdayOpenTime,
    closeTime: config.thursdayCloseTime,
    now,
    adminTestOverride
  });

  let mappedStatus: 'OPEN' | 'DATE_MISMATCH' | 'BEFORE_WINDOW' | 'AFTER_WINDOW' | 'TEST_MODE';
  if (evalResult.status === 'TEST_MODE') {
    mappedStatus = 'TEST_MODE';
  } else if (evalResult.status === 'FUTURE_LOCKED' || evalResult.isPast) {
    mappedStatus = 'DATE_MISMATCH';
  } else if (evalResult.status === 'BEFORE_WINDOW_LOCKED') {
    mappedStatus = 'BEFORE_WINDOW';
  } else if (evalResult.status === 'CLOCK_IN_CLOSED_MANUAL_OPEN') {
    mappedStatus = 'AFTER_WINDOW';
  } else {
    mappedStatus = 'OPEN';
  }

  return {
    allowed: evalResult.canClockIn,
    isOpen: evalResult.canClockIn,
    isDateMatch: evalResult.isDateMatch,
    isToday: evalResult.isToday,
    isPast: evalResult.isPast,
    isFuture: evalResult.isFuture,
    status: mappedStatus,
    reason: evalResult.lockReason || (evalResult.canClockIn ? 'Thursday Preparatory Session Active' : 'Clock-in is closed.')
  };
}

/**
 * Backward compatibility adapter for getAttendanceSecurityState
 */
export function getAttendanceSecurityState(
  serviceDate: string,
  openTime: string = '07:00',
  closeTime: string = '11:30',
  now: Date = new Date(),
  adminTestOverride: boolean = false
): {
  isFuture: boolean;
  isToday: boolean;
  isPast: boolean;
  clockingAllowed: boolean;
  canClockIn: boolean;
  manualAttendanceAllowed: boolean;
  canTakeManualAttendance: boolean;
  status: 'LOCKED_FUTURE' | 'BEFORE_WINDOW' | 'OPEN' | 'AFTER_WINDOW_MANUAL_OPEN' | 'PAST_MANUAL_OPEN' | 'TEST_MODE';
  lockReason?: string;
} {
  const evalResult = evaluateAttendanceAccess({
    sessionType: 'SUNDAY',
    weekNumber: 1,
    scheduledDate: serviceDate,
    openTime,
    closeTime,
    now,
    adminTestOverride
  });

  let mappedStatus: 'LOCKED_FUTURE' | 'BEFORE_WINDOW' | 'OPEN' | 'AFTER_WINDOW_MANUAL_OPEN' | 'PAST_MANUAL_OPEN' | 'TEST_MODE';
  if (evalResult.status === 'TEST_MODE') {
    mappedStatus = 'TEST_MODE';
  } else if (evalResult.status === 'FUTURE_LOCKED') {
    mappedStatus = 'LOCKED_FUTURE';
  } else if (evalResult.status === 'BEFORE_WINDOW_LOCKED') {
    mappedStatus = 'BEFORE_WINDOW';
  } else if (evalResult.status === 'CLOCK_IN_CLOSED_MANUAL_OPEN') {
    mappedStatus = 'AFTER_WINDOW_MANUAL_OPEN';
  } else if (evalResult.isPast) {
    mappedStatus = 'PAST_MANUAL_OPEN';
  } else {
    mappedStatus = 'OPEN';
  }

  return {
    isFuture: evalResult.isFuture,
    isToday: evalResult.isToday,
    isPast: evalResult.isPast,
    clockingAllowed: evalResult.canClockIn,
    canClockIn: evalResult.canClockIn,
    manualAttendanceAllowed: evalResult.canManualAttendance,
    canTakeManualAttendance: evalResult.canManualAttendance,
    status: mappedStatus,
    lockReason: evalResult.lockReason
  };
}
