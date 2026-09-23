/**
 * GOFAMINT SIB Deterministic Metric Engine
 * 
 * Strict Principle:
 * Calculates verified facts using explicit mathematical formulas.
 * Never invents numbers. Checks data sufficiency to avoid false precision.
 */

import { SIB_CONFIG } from '../config/sibConfig';
import { ConfidenceLevel } from '../types/sibTypes';

export interface CalculatedRate {
  rate: number; // 0 to 100 rounded to 1 decimal place
  numerator: number;
  denominator: number;
  isAvailable: boolean;
  sufficiencyStatus: 'SUFFICIENT' | 'INSUFFICIENT';
  reasonIfUnavailable?: string;
  confidence: ConfidenceLevel;
}

/**
 * Attendance Rate:
 * present_count ÷ eligible_count × 100
 */
export function calculateAttendanceRate(
  presentCount: number,
  eligibleCount: number
): CalculatedRate {
  if (eligibleCount <= 0) {
    return {
      rate: 0,
      numerator: 0,
      denominator: 0,
      isAvailable: false,
      sufficiencyStatus: 'INSUFFICIENT',
      reasonIfUnavailable: 'No eligible student records found for attendance calculation.',
      confidence: 'INSUFFICIENT_DATA',
    };
  }

  const normalizedPresent = Math.min(eligibleCount, Math.max(0, presentCount));
  const rawRate = (normalizedPresent / eligibleCount) * 100;
  const rate = Math.round(rawRate * 10) / 10;

  return {
    rate,
    numerator: normalizedPresent,
    denominator: eligibleCount,
    isAvailable: true,
    sufficiencyStatus: 'SUFFICIENT',
    confidence: eligibleCount >= 5 ? 'HIGH' : 'MEDIUM',
  };
}

/**
 * Punctuality Rate:
 * total_punctuality_score ÷ (15 × eligible_lessons) × 100
 */
export function calculatePunctualityRate(
  totalPunctualityScore: number,
  eligibleLessons: number
): CalculatedRate {
  const maxPossible = eligibleLessons * 15;
  if (maxPossible <= 0) {
    return {
      rate: 0,
      numerator: 0,
      denominator: 0,
      isAvailable: false,
      sufficiencyStatus: 'INSUFFICIENT',
      reasonIfUnavailable: 'Insufficient lesson records to calculate punctuality.',
      confidence: 'INSUFFICIENT_DATA',
    };
  }

  const normalizedScore = Math.min(maxPossible, Math.max(0, totalPunctualityScore));
  const rate = Math.round((normalizedScore / maxPossible) * 1000) / 10;

  return {
    rate,
    numerator: normalizedScore,
    denominator: maxPossible,
    isAvailable: true,
    sufficiencyStatus: 'SUFFICIENT',
    confidence: eligibleLessons >= 3 ? 'HIGH' : 'MEDIUM',
  };
}

/**
 * Student Retention Rate:
 * active_students_remaining ÷ registered_students_at_start × 100
 */
export function calculateRetentionRate(
  activeStudentsRemaining: number,
  totalRegistered: number
): CalculatedRate {
  if (totalRegistered <= 0) {
    return {
      rate: 100, // No dropouts recorded when roster is empty
      numerator: 0,
      denominator: 0,
      isAvailable: false,
      sufficiencyStatus: 'INSUFFICIENT',
      reasonIfUnavailable: 'No registered students in class roster.',
      confidence: 'INSUFFICIENT_DATA',
    };
  }

  const remaining = Math.min(totalRegistered, Math.max(0, activeStudentsRemaining));
  const rate = Math.round((remaining / totalRegistered) * 1000) / 10;

  return {
    rate,
    numerator: remaining,
    denominator: totalRegistered,
    isAvailable: true,
    sufficiencyStatus: 'SUFFICIENT',
    confidence: totalRegistered >= 5 ? 'HIGH' : 'MEDIUM',
  };
}

/**
 * Visitor Return Rate:
 * visitors_with_consecutive_or_return_visits ÷ total_visitors × 100
 */
export function calculateVisitorReturnRate(
  returningVisitors: number,
  totalVisitors: number
): CalculatedRate {
  if (totalVisitors <= 0) {
    return {
      rate: 0,
      numerator: 0,
      denominator: 0,
      isAvailable: false,
      sufficiencyStatus: 'INSUFFICIENT',
      reasonIfUnavailable: 'No visitors recorded for this period.',
      confidence: 'INSUFFICIENT_DATA',
    };
  }

  const validReturning = Math.min(totalVisitors, Math.max(0, returningVisitors));
  const rate = Math.round((validReturning / totalVisitors) * 1000) / 10;

  return {
    rate,
    numerator: validReturning,
    denominator: totalVisitors,
    isAvailable: true,
    sufficiencyStatus: 'SUFFICIENT',
    confidence: totalVisitors >= 3 ? 'HIGH' : 'MEDIUM',
  };
}

/**
 * Follow-Up Completion Rate:
 * completed_followups ÷ required_followups × 100
 */
export function calculateFollowUpRate(
  completedFollowUps: number,
  requiredFollowUps: number
): CalculatedRate {
  if (requiredFollowUps <= 0) {
    return {
      rate: 100,
      numerator: 0,
      denominator: 0,
      isAvailable: true,
      sufficiencyStatus: 'SUFFICIENT',
      reasonIfUnavailable: 'No follow-up action was required for this period.',
      confidence: 'HIGH',
    };
  }

  const validCompleted = Math.min(requiredFollowUps, Math.max(0, completedFollowUps));
  const rate = Math.round((validCompleted / requiredFollowUps) * 1000) / 10;

  return {
    rate,
    numerator: validCompleted,
    denominator: requiredFollowUps,
    isAvailable: true,
    sufficiencyStatus: 'SUFFICIENT',
    confidence: 'HIGH',
  };
}

/**
 * Record Completeness Rate:
 * recorded_entries ÷ expected_entries × 100
 */
export function calculateRecordCompleteness(
  recordedEntries: number,
  expectedEntries: number
): CalculatedRate {
  if (expectedEntries <= 0) {
    return {
      rate: 100,
      numerator: 0,
      denominator: 0,
      isAvailable: false,
      sufficiencyStatus: 'INSUFFICIENT',
      reasonIfUnavailable: 'No expected entries determined.',
      confidence: 'INSUFFICIENT_DATA',
    };
  }

  const validRecorded = Math.min(expectedEntries, Math.max(0, recordedEntries));
  const rate = Math.round((validRecorded / expectedEntries) * 1000) / 10;

  return {
    rate,
    numerator: validRecorded,
    denominator: expectedEntries,
    isAvailable: true,
    sufficiencyStatus: 'SUFFICIENT',
    confidence: expectedEntries >= 10 ? 'HIGH' : 'MEDIUM',
  };
}
