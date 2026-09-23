/**
 * GOFAMINT SIB Anomaly Detection Engine
 * 
 * Strict Principle:
 * Identifies statistically unusual patterns, sudden shifts, and data gaps.
 * Every anomaly defines baseline vs observed value, severity, and why it matters.
 */

import {
  ClassProfile,
  Member,
  WeeklyGradeRecord,
  AbsenceLogRecord
} from '../../types';

import { AnomalyItem, ConfidenceLevel } from '../types/sibTypes';
import { SIB_CONFIG } from '../config/sibConfig';

export interface AnomalyDetectionInput {
  classes: ClassProfile[];
  members: Member[];
  grades: WeeklyGradeRecord[];
  absenceLogs: AbsenceLogRecord[];
}

export function detectAnomalies(input: AnomalyDetectionInput): AnomalyItem[] {
  const { classes, members, grades, absenceLogs } = input;
  const anomalies: AnomalyItem[] = [];

  for (const cls of classes) {
    const classMembers = members.filter(m => m.classId === cls.id);
    const classGrades = grades.filter(g => g.classId === cls.id && !g.isNoRecordWeek);
    const classAbsences = absenceLogs.filter(a => a.classId === cls.id);

    const recordedWeeks = Array.from(new Set(classGrades.map(g => g.weekNumber))).sort((a, b) => a - b);
    if (recordedWeeks.length < 2) continue;

    // 1. Detect sudden attendance drop between consecutive lessons
    for (let i = 1; i < recordedWeeks.length; i++) {
      const prevWeek = recordedWeeks[i - 1];
      const currWeek = recordedWeeks[i];

      const prevGrades = classGrades.filter(g => g.weekNumber === prevWeek);
      const currGrades = classGrades.filter(g => g.weekNumber === currWeek);

      const prevPresent = prevGrades.filter(g => g.attendance === 'PRESENT').length;
      const prevTotal = prevGrades.filter(g => g.attendance === 'PRESENT' || g.attendance === 'ABSENT').length;
      const prevRate = prevTotal > 0 ? (prevPresent / prevTotal) * 100 : 0;

      const currPresent = currGrades.filter(g => g.attendance === 'PRESENT').length;
      const currTotal = currGrades.filter(g => g.attendance === 'PRESENT' || g.attendance === 'ABSENT').length;
      const currRate = currTotal > 0 ? (currPresent / currTotal) * 100 : 0;

      const delta = Math.round((currRate - prevRate) * 10) / 10;

      // Drop >= 15%
      if (delta <= -SIB_CONFIG.anomaly.suddenAttendanceDropPercent && prevTotal >= 4) {
        anomalies.push({
          id: `anomaly_drop_${cls.id}_w${currWeek}`,
          type: 'ATTENDANCE_DROP',
          targetType: 'CLASS',
          targetId: cls.id,
          targetName: cls.className,
          severity: delta <= -25 ? 'CRITICAL' : 'WARNING',
          description: `Sudden attendance drop of ${Math.abs(delta)} percentage points in Lesson ${currWeek}.`,
          detectedAt: new Date().toISOString(),
          baselineValue: `${Math.round(prevRate)}% (Lesson ${prevWeek})`,
          observedValue: `${Math.round(currRate)}% (Lesson ${currWeek})`,
          whyItMatters: 'Sudden attendance drops may indicate a class disruption, outreach gap, or seasonal conflict needing teacher support.',
          confidence: 'HIGH',
          recommendedNextStep: `Consult with ${cls.className} secretary (${cls.secretaryName || 'assigned secretary'}) regarding Lesson ${currWeek} absences.`,
        });
      }

      // Surge >= 25%
      if (delta >= SIB_CONFIG.anomaly.unusualAttendanceSpikePercent && currTotal >= 4) {
        anomalies.push({
          id: `anomaly_surge_${cls.id}_w${currWeek}`,
          type: 'ATTENDANCE_SURGE',
          targetType: 'CLASS',
          targetId: cls.id,
          targetName: cls.className,
          severity: 'WARNING',
          description: `Unusual attendance surge of +${delta} percentage points in Lesson ${currWeek}.`,
          detectedAt: new Date().toISOString(),
          baselineValue: `${Math.round(prevRate)}% (Lesson ${prevWeek})`,
          observedValue: `${Math.round(currRate)}% (Lesson ${currWeek})`,
          whyItMatters: 'Identifies notable evangelism outreach or event attendance to document and encourage.',
          confidence: 'HIGH',
          recommendedNextStep: 'Acknowledge class growth and identify factors that contributed to this surge.',
        });
      }
    }

    // 2. Follow-Up Gap Anomaly
    const prolongedAbsenceCount = classMembers.filter(m => (m.consecutiveAbsences || 0) >= 2).length;
    const completedFollowUps = classAbsences.filter(a => a.decisionMade).length;

    if (prolongedAbsenceCount >= 3 && completedFollowUps === 0) {
      anomalies.push({
        id: `anomaly_followup_gap_${cls.id}`,
        type: 'FOLLOW_UP_GAP',
        targetType: 'CLASS',
        targetId: cls.id,
        targetName: cls.className,
        severity: 'CRITICAL',
        description: `${prolongedAbsenceCount} students have repeated absences with 0 completed pastoral follow-up logs.`,
        detectedAt: new Date().toISOString(),
        baselineValue: 'Active pastoral follow-up logged',
        observedValue: '0 records logged',
        whyItMatters: 'Prolonged absences without timely follow-up significantly increase student dropout risk.',
        confidence: 'HIGH',
        recommendedNextStep: 'Notify the General Secretary and assign pastoral care follow-up immediately.',
      });
    }

    // 3. Data Inconsistency Anomaly: grades with no matching member
    const orphanGrades = classGrades.filter(g => !classMembers.some(m => m.id === g.memberId));
    if (orphanGrades.length > 0) {
      anomalies.push({
        id: `anomaly_datagap_${cls.id}`,
        type: 'DATA_INCONSISTENCY',
        targetType: 'CLASS',
        targetId: cls.id,
        targetName: cls.className,
        severity: 'WARNING',
        description: `${orphanGrades.length} grade entries reference member IDs not currently in class roster.`,
        detectedAt: new Date().toISOString(),
        baselineValue: '100% matched roster records',
        observedValue: `${orphanGrades.length} unlinked grade records`,
        whyItMatters: 'Unlinked records indicate member transfer or incomplete roster synchronization.',
        confidence: 'HIGH',
        recommendedNextStep: 'Review roster synchronization in the administrative console.',
      });
    }
  }

  return anomalies;
}
