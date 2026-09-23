/**
 * GOFAMINT SIB Evidence Engine
 * 
 * Strict Principle:
 * NO INTELLIGENCE WITHOUT EVIDENCE.
 * Every important fact, score, alert, and recommendation creates a structured
 * EvidenceObject identifying the underlying records and calculation formula.
 */

import {
  EvidenceObject,
  ConfidenceLevel,
  ClassHealthResult,
  StudentAttentionItem
} from '../types/sibTypes';

export class SIBEvidenceRegistry {
  private static evidenceStore = new Map<string, EvidenceObject>();

  public static registerEvidence(evidence: EvidenceObject): EvidenceObject {
    this.evidenceStore.set(evidence.id, evidence);
    return evidence;
  }

  public static getEvidence(id: string): EvidenceObject | null {
    return this.evidenceStore.get(id) || null;
  }

  public static clear(): void {
    this.evidenceStore.clear();
  }

  /**
   * Generates a standardized EvidenceObject for a Class Health Score.
   */
  public static createClassHealthEvidence(classHealth: ClassHealthResult): EvidenceObject {
    const evidence: EvidenceObject = {
      id: `evidence_class_health_${classHealth.classId}_q${classHealth.quarterNumber}`,
      targetType: 'CLASS',
      targetId: classHealth.classId,
      targetName: classHealth.className,
      metricName: 'Class Health Score',
      calculatedValue: `${classHealth.healthScore}%`,
      calculationFormula: classHealth.explanation.calculationFormula,
      componentBreakdown: classHealth.explanation.components,
      periodLabel: `Quarter ${classHealth.quarterNumber}`,
      comparisonPeriodLabel: classHealth.attendanceTrend.previousPeriodLabel,
      comparisonChange: classHealth.attendanceTrend.changeAmount,
      supportingRecordCount: classHealth.registeredClassMembers,
      confidence: classHealth.confidence,
      confidenceReason: classHealth.explanation.confidenceReason,
      limitations: classHealth.explanation.limitations,
      recommendedOperationalAction: {
        label: 'Open Class Register in Directorate Mode',
        targetPortal: 'CLASS_REGISTER',
        reason: 'Review weekly lesson grades and member rosters for this class.',
        linkContext: { classId: classHealth.classId },
      },
    };

    return this.registerEvidence(evidence);
  }

  /**
   * Generates a standardized EvidenceObject for Student Pastoral Attention.
   */
  public static createStudentAttentionEvidence(item: StudentAttentionItem): EvidenceObject {
    const evidence: EvidenceObject = {
      id: `evidence_student_attention_${item.studentId}`,
      targetType: 'STUDENT',
      targetId: item.studentId,
      targetName: item.fullName,
      metricName: 'Student Pastoral Attention Risk',
      calculatedValue: `${item.attentionLevel} (${item.whyBreakdown.riskScore}/100)`,
      calculationFormula: 'Risk = (Consecutive Absences Weight) + (Attendance Drop) + (Follow-Up Gaps)',
      periodLabel: 'Recent Recorded Lessons',
      supportingRecordCount: item.recentAttendancePattern.length,
      confidence: item.confidence,
      confidenceReason: `Verified from ${item.recentAttendancePattern.length} lesson records in ${item.className}.`,
      limitations: ['Follow-up records reflect formal logged entries in system.'],
      recommendedOperationalAction: {
        label: 'Open Welfare & Follow-Up Console',
        targetPortal: 'CLASS_REGISTER',
        reason: item.recommendedCareAction,
        linkContext: { classId: item.classId, memberId: item.studentId },
      },
    };

    return this.registerEvidence(evidence);
  }
}
