/**
 * GOFAMINT School Intelligence Board (SIB) Central Rules & Configuration
 * Version: 1.0.0
 * 
 * All scoring weights, thresholds, attention levels, and data sufficiency rules
 * are centralized here to prevent hardcoding across multiple components.
 */

export const SIB_RULE_VERSION = '1.0.0';

export interface ClassHealthWeights {
  attendanceRate: number;       // e.g. 0.30 (30%)
  attendanceTrend: number;      // e.g. 0.20 (20%)
  studentRetention: number;     // e.g. 0.15 (15%)
  visitorProgression: number;   // e.g. 0.10 (10%)
  followUpCompletion: number;   // e.g. 0.15 (15%)
  recordCompleteness: number;   // e.g. 0.10 (10%)
}

export const SIB_CONFIG = {
  version: SIB_RULE_VERSION,

  // Weights for composite Class Health Score (sum = 1.0)
  classHealthWeights: {
    attendanceRate: 0.30,
    attendanceTrend: 0.20,
    studentRetention: 0.15,
    visitorProgression: 0.10,
    followUpCompletion: 0.15,
    recordCompleteness: 0.10,
  } as ClassHealthWeights,

  // Data Sufficiency Thresholds (preventing false precision)
  sufficiency: {
    minLessonsForTrend: 2,
    minLessonsForHealthScore: 1,
    minStudentsForClassMetrics: 1,
    minClassesForDepartmentRanking: 2,
    minLessonsForLongTermTrend: 4,
  },

  // Student Pastoral Attention Thresholds
  studentAttention: {
    moderateConsecutiveAbsences: 2,
    criticalConsecutiveAbsences: 3,
    significantScoreDropPercent: 20, // drop of 20 percentage points
    unaddressedFollowUpDays: 14,    // 2 weeks without logged follow-up
  },

  // Class Anomaly Thresholds
  anomaly: {
    suddenAttendanceDropPercent: 15, // drop >= 15% between consecutive lessons
    unusualAttendanceSpikePercent: 25, // jump >= 25%
    criticalFollowUpGapRate: 0.50, // more than 50% needed followups missing
  },

  // Confidence Thresholds
  confidence: {
    highRecordCompletenessPercent: 85,
    mediumRecordCompletenessPercent: 60,
  },

  // Priority thresholds
  priority: {
    criticalAbsenceCount: 4, // 4+ students with critical absence triggers high/critical priority
    urgentAttentionClassCount: 2,
  },

  // Benchmark standards for Sunday School health
  benchmarks: {
    excellentAttendanceRate: 85,
    goodAttendanceRate: 70,
    concerningAttendanceRate: 50,

    excellentFollowUpRate: 80,
    acceptableFollowUpRate: 60,

    healthyVisitorReturnRate: 50,
  }
} as const;
