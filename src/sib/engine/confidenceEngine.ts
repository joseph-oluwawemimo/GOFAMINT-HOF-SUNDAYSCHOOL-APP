/**
 * GOFAMINT SIB Confidence Engine
 * 
 * Determines confidence level ('HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA')
 * based on verified data volume, recency, and completeness.
 * Strictly generates an explainable reason for each rating.
 */

import { ConfidenceLevel } from '../types/sibTypes';

export interface ConfidenceEvaluationInput {
  recordCount: number;
  expectedRecordCount?: number;
  periodDurationLessons: number;
  hasRecentData: boolean;
  missingDataGapsCount?: number;
}

export interface ConfidenceResult {
  level: ConfidenceLevel;
  reason: string;
  score: number; // 0 - 100
}

export function evaluateConfidence(input: ConfidenceEvaluationInput): ConfidenceResult {
  const {
    recordCount,
    expectedRecordCount = recordCount,
    periodDurationLessons,
    hasRecentData,
    missingDataGapsCount = 0,
  } = input;

  if (recordCount === 0 || periodDurationLessons === 0) {
    return {
      level: 'INSUFFICIENT_DATA',
      reason: 'No records exist for the evaluated period; metrics cannot be established.',
      score: 0,
    };
  }

  // Calculate completeness percentage
  const completeness = expectedRecordCount > 0
    ? Math.min(100, Math.max(0, (recordCount / expectedRecordCount) * 100))
    : 100;

  let score = 50;

  // Record volume weighting
  if (recordCount >= 20) score += 20;
  else if (recordCount >= 8) score += 10;
  else if (recordCount < 3) score -= 20;

  // Period duration weighting
  if (periodDurationLessons >= 4) score += 15;
  else if (periodDurationLessons >= 2) score += 5;
  else score -= 10;

  // Recency weighting
  if (hasRecentData) score += 15;
  else score -= 15;

  // Missing data penalty
  if (missingDataGapsCount > 3) score -= 15;
  else if (missingDataGapsCount > 0) score -= 5;

  score = Math.min(100, Math.max(0, score));

  let level: ConfidenceLevel = 'MEDIUM';
  let reason = '';

  if (score >= 75 && completeness >= 75) {
    level = 'HIGH';
    reason = `High confidence supported by ${recordCount} recorded entries across ${periodDurationLessons} lessons with ${Math.round(completeness)}% record completeness.`;
  } else if (score >= 45) {
    level = 'MEDIUM';
    reason = `Moderate confidence based on ${recordCount} entries (${periodDurationLessons} lessons). Some data gaps or limited observation length exist.`;
  } else if (recordCount >= 1) {
    level = 'LOW';
    reason = `Low confidence due to sparse records (${recordCount} entries) or missing recent reports. Treat indications with caution.`;
  } else {
    level = 'INSUFFICIENT_DATA';
    reason = 'Insufficient data volume to draw reliable conclusions.';
  }

  return {
    level,
    reason,
    score,
  };
}
