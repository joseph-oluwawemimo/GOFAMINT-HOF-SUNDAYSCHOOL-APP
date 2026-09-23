/**
 * GOFAMINT School Intelligence Board (SIB) Types
 */

import { QuarterNumber } from '../../types';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';
export type PriorityLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type TrendDirection = 'IMPROVING' | 'DECLINING' | 'STABLE' | 'VOLATILE' | 'INSUFFICIENT_DATA';
export type AttentionLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type ActionCategory = 'URGENT' | 'WATCH' | 'POSITIVE' | 'INFORMATION';

export interface ScoreComponentBreakdown {
  label: string;
  value: number; // raw percentage or normalized score (0-100)
  weight: number; // decimal weight e.g. 0.30
  weightedContribution: number; // value * weight
  status: 'STRONG' | 'ACCEPTABLE' | 'WEAK' | 'INSUFFICIENT_DATA';
  explanation: string;
}

export interface EvidenceObject {
  id: string;
  targetType: 'SCHOOL' | 'CLASS' | 'STUDENT' | 'DEPARTMENT';
  targetId: string;
  targetName?: string;
  metricName: string;
  calculatedValue: number | string;
  calculationFormula: string;
  componentBreakdown?: ScoreComponentBreakdown[];
  periodLabel: string;
  comparisonPeriodLabel?: string;
  comparisonChange?: number;
  supportingRecordCount: number;
  sampleRecords?: Array<Record<string, unknown>>;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  limitations: string[];
  recommendedOperationalAction?: {
    label: string;
    targetPortal: 'ADMIN' | 'CLASS_REGISTER' | 'WORKERS';
    reason: string;
    linkContext?: Record<string, unknown>;
  };
}

export interface ScoreExplanation {
  targetId: string;
  targetName: string;
  scoreName: string;
  finalScore: number;
  maxScore: number;
  calculationFormula: string;
  components: ScoreComponentBreakdown[];
  positiveContributors: string[];
  negativeContributors: string[];
  trend: TrendDirection;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  limitations: string[];
  evidenceIds: string[];
  recommendedAction: string;
  comparisonSummary?: string;
}

export interface TrendAnalysis {
  direction: TrendDirection;
  currentValue: number;
  previousValue: number | null;
  changeAmount: number; // percentage points or delta
  changePercentage: number;
  periodLabel: string;
  previousPeriodLabel: string;
  isPositiveDevelopment: boolean;
  explanation: string;
  confidence: ConfidenceLevel;
}

export interface ClassHealthResult {
  classId: string;
  className: string;
  department: string;
  quarterNumber: QuarterNumber;
  healthScore: number; // 0 - 100
  attendanceRate: number;
  attendanceTrend: TrendAnalysis;
  studentRetentionRate: number;
  visitorProgressionRate: number;
  followUpCompletionRate: number;
  recordCompletenessRate: number;
  totalStudents: number;
  totalVisitors: number;
  activeStudentsPresent: number;
  registeredClassMembers: number;
  consecutiveAbsenceCount: number;
  attentionLevel: AttentionLevel;
  priority: PriorityLevel;
  confidence: ConfidenceLevel;
  explanation: ScoreExplanation;
  positiveDevelopments: string[];
  concerns: string[];
}

export interface StudentAttentionItem {
  studentId: string;
  fullName: string;
  classId: string;
  className: string;
  department: string;
  memberType: 'STUDENT' | 'VISITOR';
  consecutiveAbsences: number;
  recentAttendancePattern: Array<'PRESENT' | 'ABSENT' | 'EXEMPT' | 'UNRECORDED'>;
  overallAttendanceRate: number;
  punctualityRate?: number;
  participationRate?: number;
  memoryVerseRate?: number;
  hasRecentFollowUp: boolean;
  lastFollowUpDate?: string;
  lastFollowUpOutcome?: string;
  attentionLevel: AttentionLevel;
  priority: PriorityLevel;
  confidence: ConfidenceLevel;
  whyBreakdown: {
    primaryReason: string;
    contributingFactors: string[];
    riskScore: number; // 0-100
  };
  recommendedCareAction: string;
}

export interface VisitorIntelligenceResult {
  quarterNumber: QuarterNumber;
  totalVisitors: number;
  activeVisitors: number;
  returningVisitors: number;
  returnRate: number; // percentage
  convertedStudentsCount: number;
  conversionRate: number; // percentage
  consecutiveVisitCandidatesCount: number;
  visitorsRequiringFollowUp: number;
  evangelismReferralsCount: number;
  trend: TrendAnalysis;
  confidence: ConfidenceLevel;
  explanation: string;
  evidence: EvidenceObject;
  classBreakdown: Array<{
    classId: string;
    className: string;
    visitorCount: number;
    returnRate: number;
  }>;
}

export interface FollowUpIntelligenceResult {
  quarterNumber: QuarterNumber;
  requiredFollowUps: number;
  completedFollowUps: number;
  completionRate: number; // percentage
  outstandingFollowUps: number;
  urgencyBreakdown: {
    yellow: number;
    orange: number;
    red: number;
    critical: number;
  };
  trend: TrendAnalysis;
  classesWithGaps: Array<{
    classId: string;
    className: string;
    missingCount: number;
  }>;
  confidence: ConfidenceLevel;
  explanation: string;
  evidence: EvidenceObject;
}

export interface DepartmentIntelResult {
  departmentName: string;
  classCount: number;
  totalStudents: number;
  totalVisitors: number;
  averageAttendanceRate: number;
  averageHealthScore: number;
  trend: TrendAnalysis;
  attentionStudentCount: number;
  followUpRate: number;
  confidence: ConfidenceLevel;
  strongestClass: string;
  classRequiringAttention: string;
  positiveDevelopments: string[];
  concerns: string[];
}

export interface AnomalyItem {
  id: string;
  type: 'ATTENDANCE_DROP' | 'ATTENDANCE_SURGE' | 'FOLLOW_UP_GAP' | 'DATA_INCONSISTENCY' | 'UNUSUAL_ABSENCE_BURST';
  targetType: 'SCHOOL' | 'CLASS' | 'STUDENT';
  targetId: string;
  targetName: string;
  severity: 'WARNING' | 'CRITICAL';
  description: string;
  detectedAt: string;
  baselineValue: number | string;
  observedValue: number | string;
  whyItMatters: string;
  confidence: ConfidenceLevel;
  recommendedNextStep: string;
}

export interface ActionItem {
  id: string;
  category: ActionCategory; // URGENT (red), WATCH (orange), POSITIVE (green), INFORMATION (blue)
  title: string;
  subtitle: string;
  whyExplanation: string;
  priority: PriorityLevel;
  confidence: ConfidenceLevel;
  impactedCount: number;
  targetPortal?: 'ADMIN' | 'CLASS_REGISTER' | 'WORKERS';
  actionLabel?: string;
  evidenceId: string;
}

export interface SIBDataQualityResult {
  quarterNumber: QuarterNumber;
  overallQualityScore: number; // 0-100
  totalClassesEvaluated: number;
  classesWithCompleteAttendance: number;
  missingAttendanceWeeksCount: number;
  totalGradesRecorded: number;
  totalExpectedGrades: number;
  unrecordedGradesCount: number;
  missingFollowUpLogsCount: number;
  dataGaps: Array<{
    classId: string;
    className: string;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  sufficiencyStatus: 'SUFFICIENT' | 'MODERATE' | 'INSUFFICIENT';
  limitationsNotice: string;
}

export interface SIBOverviewData {
  quarterNumber: QuarterNumber;
  ruleVersion: string;
  calculatedAt: string;
  schoolHealthScore: number;
  schoolHealthExplanation: ScoreExplanation;
  
  attendance: {
    currentRate: number;
    previousRate: number | null;
    trend: TrendAnalysis;
    totalPresent: number;
    totalEligible: number;
  };

  studentAttention: {
    totalRequiringAttention: number;
    criticalCount: number;
    highCount: number;
    moderateCount: number;
    items: StudentAttentionItem[];
  };

  classes: {
    totalClasses: number;
    strongestClasses: ClassHealthResult[];
    classesNeedingAttention: ClassHealthResult[];
    allClassHealth: ClassHealthResult[];
  };

  departments: DepartmentIntelResult[];

  visitors: VisitorIntelligenceResult;

  followUp: FollowUpIntelligenceResult;

  anomalies: AnomalyItem[];

  actionCenter: ActionItem[];

  dataQuality: SIBDataQualityResult;

  positiveDevelopments: string[];

  topPriority: {
    title: string;
    description: string;
    priority: PriorityLevel;
    confidence: ConfidenceLevel;
    whyExplanation: string;
    evidence: EvidenceObject;
    recommendedNextStep: string;
  };
}
