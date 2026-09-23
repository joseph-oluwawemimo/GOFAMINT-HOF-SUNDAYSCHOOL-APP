/**
 * GOFAMINT SIB Priority Engine
 * 
 * Classifies operational priority ('LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL')
 * based on severity, persistence, and size of impacted population.
 * Strictly generates an explainable reason for each classification.
 */

import { PriorityLevel } from '../types/sibTypes';

export interface PriorityEvaluationInput {
  severityScore: number; // 0 (benign) to 100 (critical emergency)
  impactedCount: number; // number of affected students, classes, or records
  consecutiveOccurrences?: number; // e.g. weeks persistent
  isUrgentCareNeeded?: boolean;
}

export interface PriorityResult {
  level: PriorityLevel;
  reason: string;
  score: number; // 0 - 100
}

export function evaluatePriority(input: PriorityEvaluationInput): PriorityResult {
  const {
    severityScore,
    impactedCount,
    consecutiveOccurrences = 1,
    isUrgentCareNeeded = false,
  } = input;

  let totalScore = severityScore * 0.5;

  // Scale based on people impacted
  if (impactedCount >= 10) totalScore += 25;
  else if (impactedCount >= 4) totalScore += 18;
  else if (impactedCount >= 1) totalScore += 10;

  // Scale based on persistence
  if (consecutiveOccurrences >= 3) totalScore += 25;
  else if (consecutiveOccurrences >= 2) totalScore += 15;

  // Immediate care flag
  if (isUrgentCareNeeded) totalScore += 15;

  totalScore = Math.min(100, Math.max(0, Math.round(totalScore)));

  let level: PriorityLevel = 'LOW';
  let reason = '';

  if (totalScore >= 75 || (consecutiveOccurrences >= 3 && impactedCount >= 2)) {
    level = 'CRITICAL';
    reason = `Critical priority: High severity issue persisting across ${consecutiveOccurrences} recorded weeks affecting ${impactedCount} individual(s). Requires immediate pastoral attention.`;
  } else if (totalScore >= 50 || impactedCount >= 5) {
    level = 'HIGH';
    reason = `High priority: Significant operational pattern detected affecting ${impactedCount} individual(s) over ${consecutiveOccurrences} week(s).`;
  } else if (totalScore >= 25 || impactedCount >= 1) {
    level = 'MODERATE';
    reason = `Moderate priority: Developing pattern affecting ${impactedCount} individual(s); monitor and schedule routine follow-up.`;
  } else {
    level = 'LOW';
    reason = 'Low priority: Metric within normal operational bounds; no immediate intervention required.';
  }

  return {
    level,
    reason,
    score: totalScore,
  };
}
