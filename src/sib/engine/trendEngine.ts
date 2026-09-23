/**
 * GOFAMINT SIB Deterministic Trend & Comparison Engine
 * 
 * Compares periods, lessons, or quarters and derives verified trend direction,
 * delta, and plain-English context.
 */

import { TrendAnalysis, TrendDirection, ConfidenceLevel } from '../types/sibTypes';

export interface TrendEvaluationParams {
  currentValue: number;
  previousValue: number | null;
  periodLabel: string;
  previousPeriodLabel: string;
  series?: number[]; // optional historical series for volatility check
  higherIsBetter?: boolean; // default true (e.g. attendance). False for e.g. absence count.
  thresholdDelta?: number; // minimum change to consider non-stable, default 2.0%
}

/**
 * Analyzes trend between two numerical values or across a series.
 */
export function analyzeTrend(params: TrendEvaluationParams): TrendAnalysis {
  const {
    currentValue,
    previousValue,
    periodLabel,
    previousPeriodLabel,
    series = [],
    higherIsBetter = true,
    thresholdDelta = 2.0,
  } = params;

  if (previousValue === null || previousValue === undefined || Number.isNaN(previousValue)) {
    return {
      direction: 'INSUFFICIENT_DATA',
      currentValue,
      previousValue: null,
      changeAmount: 0,
      changePercentage: 0,
      periodLabel,
      previousPeriodLabel,
      isPositiveDevelopment: false,
      explanation: `No prior baseline available to establish a comparative trend for ${periodLabel}.`,
      confidence: 'INSUFFICIENT_DATA',
    };
  }

  const delta = Math.round((currentValue - previousValue) * 10) / 10;
  const changePercentage = previousValue > 0
    ? Math.round(((currentValue - previousValue) / previousValue) * 1000) / 10
    : 0;

  // Check for volatility if series is provided and has at least 3 points
  let isVolatile = false;
  if (series.length >= 3) {
    let reversals = 0;
    for (let i = 1; i < series.length - 1; i++) {
      const d1 = series[i] - series[i - 1];
      const d2 = series[i + 1] - series[i];
      if ((d1 > 3 && d2 < -3) || (d1 < -3 && d2 > 3)) {
        reversals++;
      }
    }
    if (reversals >= 2) isVolatile = true;
  }

  let direction: TrendDirection = 'STABLE';
  if (isVolatile) {
    direction = 'VOLATILE';
  } else if (Math.abs(delta) < thresholdDelta) {
    direction = 'STABLE';
  } else if (delta > 0) {
    direction = 'IMPROVING';
  } else {
    direction = 'DECLINING';
  }

  const isPositive = higherIsBetter ? delta > 0 : delta < 0;

  let explanation = '';
  if (direction === 'STABLE') {
    explanation = `Performance remained stable in ${periodLabel} compared with ${previousPeriodLabel} (delta: ${delta > 0 ? '+' : ''}${delta} pp).`;
  } else if (direction === 'VOLATILE') {
    explanation = `Performance showed fluctuating volatility across recent recorded lessons (current: ${currentValue}%, previous: ${previousValue}%).`;
  } else if (direction === 'IMPROVING') {
    explanation = higherIsBetter
      ? `Performance improved by ${delta > 0 ? '+' : ''}${delta} percentage points compared with ${previousPeriodLabel}.`
      : `Metrics increased by ${delta > 0 ? '+' : ''}${delta} points (requiring attention).`;
  } else {
    explanation = higherIsBetter
      ? `Performance declined by ${Math.abs(delta)} percentage points compared with ${previousPeriodLabel}.`
      : `Favorable reduction of ${Math.abs(delta)} points recorded compared with ${previousPeriodLabel}.`;
  }

  const confidence: ConfidenceLevel = series.length >= 4 ? 'HIGH' : 'MEDIUM';

  return {
    direction,
    currentValue,
    previousValue,
    changeAmount: delta,
    changePercentage,
    periodLabel,
    previousPeriodLabel,
    isPositiveDevelopment: isPositive,
    explanation,
    confidence,
  };
}
