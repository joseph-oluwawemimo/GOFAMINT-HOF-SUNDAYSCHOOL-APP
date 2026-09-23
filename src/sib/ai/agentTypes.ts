/**
 * GOFAMINT SIB AI Agent Types and Tool Declarations
 */

import { ConfidenceLevel, PriorityLevel, TrendDirection } from '../types/sibTypes';

export interface SIBQueryRequest {
  question: string;
  quarterNumber?: number;
  classId?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface SIBStructuredResponse {
  answer: string;
  summary: string;
  findings: string[];
  metrics: Array<{
    name: string;
    value: string | number;
    benchmark?: string | number;
    status?: 'GOOD' | 'NEUTRAL' | 'WARNING';
  }>;
  evidence: Array<{
    statement: string;
    recordReference: string;
    verifiedFact: string;
  }>;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  priority: PriorityLevel;
  trend: TrendDirection;
  recommended_actions: Array<{
    action: string;
    reason: string;
    targetRole?: string;
  }>;
  limitations: string[];
  sources: string[];
  ruleVersion: string;
  toolsUsed: string[];
}

export interface SIBWeeklyReportResponse {
  title: string;
  quarterLabel: string;
  dateGenerated: string;
  executiveSummary: string;
  majorDevelopments: string[];
  areasRequiringAttention: string[];
  topPriority: {
    title: string;
    urgency: PriorityLevel;
    whyEvidence: string;
    recommendedNextStep: string;
  };
  metricsSummary: {
    attendanceRate: number;
    schoolHealthScore: number;
    prolongedAbsencesCount: number;
    followUpCompletionRate: number;
    visitorReturnRate: number;
  };
  confidence: ConfidenceLevel;
  dataLimitations: string[];
}
