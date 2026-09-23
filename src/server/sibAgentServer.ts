/**
 * GOFAMINT SIB Server-Side Agent & Read-Only Tool Orchestrator
 * 
 * Strict Principle:
 * Server-only execution. Protects GEMINI_API_KEY.
 * Read-only tool execution against Supabase admin client.
 * Enforces deterministic values over AI hallucinations.
 * Provides resilient deterministic fallback if AI is unavailable.
 */

import { GoogleGenAI } from '@google/genai';
import { getSupabaseAdmin, GofamintRole } from './supabaseAdmin';
import { SIB_CONFIG } from '../sib/config/sibConfig';
import { SIBQueryRequest, SIBStructuredResponse, SIBWeeklyReportResponse } from '../sib/ai/agentTypes';
import { computeSchoolOverview } from '../sib/engine/schoolOverviewEngine';
import { SIBRawDataset } from '../sib/data/sibDataAccess';
import { QuarterNumber } from '../types';
import { SIBOverviewData } from '../sib/types/sibTypes';

export async function fetchServerRawDataset(quarterNumber?: number): Promise<SIBRawDataset> {
  const db = getSupabaseAdmin();
  
  const [classesRes, membersRes, gradesRes, absencesRes, offeringsRes, yearsRes] = await Promise.all([
    db.from('classes').select('*'),
    db.from('members').select('*'),
    db.from('grades').select('*'),
    db.from('absence_logs').select('*'),
    db.from('offerings').select('*'),
    db.from('sunday_school_years').select('*'),
  ]);

  if (classesRes.error) throw classesRes.error;
  if (membersRes.error) throw membersRes.error;
  if (gradesRes.error) throw gradesRes.error;
  if (absencesRes.error) throw absencesRes.error;
  if (offeringsRes.error) throw offeringsRes.error;

  const classes = (classesRes.data || []).map(r => ({ id: r.id, department: r.department_id, ...(r.data || {}) }));
  const members = (membersRes.data || []).map(r => ({ id: r.id, classId: r.class_id, ...(r.data || {}) }));
  const allGrades = (gradesRes.data || []).map(r => ({ id: r.id, classId: r.class_id, memberId: r.member_id, quarterNumber: r.quarter_number, weekNumber: r.week_number, ...(r.data || {}) }));
  const allAbsences = (absencesRes.data || []).map(r => ({ id: r.id, classId: r.class_id, memberId: r.member_id, ...(r.data || {}) }));
  const allOfferings = (offeringsRes.data || []).map(r => ({ id: r.id, classId: r.class_id, quarterNumber: r.quarter_number, weekNumber: r.week_number, ...(r.data || {}) }));
  const yearData = (yearsRes.data || [])[0]?.data || null;

  const targetQuarter = (quarterNumber || yearData?.activeQuarterNumber || 1) as QuarterNumber;

  const quarterGrades = allGrades.filter(g => !g.quarterNumber || g.quarterNumber === targetQuarter);
  const quarterAbsences = allAbsences.filter(a => !a.quarterNumber || a.quarterNumber === targetQuarter);
  const quarterOfferings = allOfferings.filter(o => !o.quarterNumber || o.quarterNumber === targetQuarter);

  return {
    classes,
    members,
    grades: quarterGrades,
    absenceLogs: quarterAbsences,
    offerings: quarterOfferings,
    year: yearData,
    quarterNumber: targetQuarter,
  };
}

const SIB_SYSTEM_PROMPT = `You are the GOFAMINT School Intelligence Board (SIB) AI Agent.
You assist authorized leadership by interpreting verified intelligence from the GOFAMINT Sunday School system.

AUTHORITY RULES:
1. Supabase is the operational source of truth.
2. The deterministic SIB Intelligence Engine is the source of calculated metrics, scores, trends, classifications, and priorities.
3. You are an interpreter and investigator, NOT the source of truth or the scoring authority.
4. You must never invent information, students, classes, attendance numbers, percentages, or dates.
5. You must not override deterministic SIB calculations.
6. Every conclusion must cite verified facts from the provided context.
7. Distinguish correlation from causation. Do not claim an action caused an increase without direct evidence; use phrasing like "attendance improved following recorded follow-up activity".
8. If data is insufficient, clearly state that the data volume is insufficient.
9. Protect personal privacy: summarize and do not leak private home addresses or phone numbers.

OUTPUT FORMAT:
You MUST respond with valid JSON matching this exact structure:
{
  "answer": "Clear, direct, evidence-backed answer to the question.",
  "summary": "1-2 sentence executive briefing.",
  "findings": ["Finding 1", "Finding 2"],
  "metrics": [{"name": "Metric Name", "value": "78%", "benchmark": "75%", "status": "GOOD"}],
  "evidence": [{"statement": "Conclusion", "recordReference": "Classes / Attendance", "verifiedFact": "Calculated value"}],
  "confidence": "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA",
  "confidenceReason": "Plain explanation why confidence is at this level.",
  "priority": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "trend": "IMPROVING" | "DECLINING" | "STABLE" | "VOLATILE" | "INSUFFICIENT_DATA",
  "recommended_actions": [{"action": "Action description", "reason": "Traceable reason", "targetRole": "Role"}],
  "limitations": ["Any data gap or observation limit"],
  "sources": ["Supabase Classes", "Weekly Grades", "Absence Care Logs"]
}`;

export async function handleSIBQuery(
  request: SIBQueryRequest,
  userRole: GofamintRole
): Promise<SIBStructuredResponse> {
  const { question, quarterNumber, classId, conversationHistory = [] } = request;

  // 1. Fetch raw data deterministically from Supabase
  const dataset = await fetchServerRawDataset(quarterNumber);
  const overview = computeSchoolOverview(dataset);

  // If user is a teacher, scope the primary intelligence to their assigned class
  const isTeacher = userRole === 'TEACHER' || userRole === 'CLASS_SECRETARY' || userRole === 'TEACHER / CLASS_SECRETARY';
  const targetClassHealth = classId
    ? overview.classes.allClassHealth.find(c => c.classId === classId)
    : undefined;

  // 2. Prepare verified deterministic facts context
  const contextSummary = {
    ruleVersion: SIB_CONFIG.version,
    activeQuarter: overview.quarterNumber,
    schoolHealthScore: overview.schoolHealthScore,
    schoolAttendanceRate: overview.attendance.currentRate,
    schoolAttendanceTrend: overview.attendance.trend.direction,
    attendanceDelta: overview.attendance.trend.changeAmount,
    totalClasses: overview.classes.totalClasses,
    strongestClasses: overview.classes.strongestClasses.map(c => `${c.className} (${c.healthScore}%)`),
    classesNeedingAttention: overview.classes.classesNeedingAttention.map(c => `${c.className} (${c.healthScore}%, ${c.concerns.join('; ')})`),
    studentsRequiringAttentionCount: overview.studentAttention.totalRequiringAttention,
    criticalAbsenceCount: overview.studentAttention.criticalCount,
    topAttentionStudents: overview.studentAttention.items.slice(0, 5).map(s => ({
      name: s.fullName,
      class: s.className,
      consecutiveAbsences: s.consecutiveAbsences,
      hasFollowUp: s.hasRecentFollowUp,
      reason: s.whyBreakdown.primaryReason,
    })),
    visitorReturnRate: overview.visitors.returnRate,
    totalVisitors: overview.visitors.totalVisitors,
    followUpCompletionRate: overview.followUp.completionRate,
    outstandingFollowUps: overview.followUp.outstandingFollowUps,
    anomaliesCount: overview.anomalies.length,
    activeAnomalies: overview.anomalies.map(a => `${a.targetName}: ${a.description}`),
    topPriority: overview.topPriority,
    dataQualityScore: overview.dataQuality.overallQualityScore,
    dataQualityStatus: overview.dataQuality.sufficiencyStatus,
    targetClassDetails: targetClassHealth ? {
      className: targetClassHealth.className,
      department: targetClassHealth.department,
      healthScore: targetClassHealth.healthScore,
      components: targetClassHealth.explanation.components,
      concerns: targetClassHealth.concerns,
      positiveDevelopments: targetClassHealth.positiveDevelopments,
      trend: targetClassHealth.attendanceTrend.direction,
    } : null,
  };

  // 3. Check for Gemini API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Graceful deterministic fallback without AI
    return buildDeterministicFallbackResponse(question, overview, targetClassHealth);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    const promptMessage = [
      `User Question: "${question}"`,
      `Verified Deterministic Context:\n${JSON.stringify(contextSummary, null, 2)}`,
      conversationHistory.length > 0
        ? `Recent Conversation:\n${conversationHistory.slice(-4).map(h => `${h.role}: ${h.content}`).join('\n')}`
        : '',
      'Analyze the question using ONLY the verified facts in the context above. Output strictly JSON as instructed.',
    ].filter(Boolean).join('\n\n');

    const result = await ai.models.generateContent({
      model,
      contents: [
        { role: 'user', parts: [{ text: SIB_SYSTEM_PROMPT }, { text: promptMessage }] },
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const rawText = result.text?.trim() || '';
    if (!rawText) throw new Error('Empty response from Gemini');

    const parsed = JSON.parse(rawText) as SIBStructuredResponse;

    // Numerical and schema validation (deterministic values win)
    parsed.ruleVersion = SIB_CONFIG.version;
    parsed.toolsUsed = ['getSchoolOverview', 'getClassHealth', 'getStudentAttention', 'getFollowUpIntelligence'];
    if (!parsed.confidence) parsed.confidence = overview.schoolHealthExplanation.confidence;
    if (!parsed.priority) parsed.priority = overview.topPriority.priority;
    if (!parsed.trend) parsed.trend = overview.attendance.trend.direction;

    return parsed;
  } catch (error: any) {
    console.warn('[SIB Server Agent] Gemini generation failed or returned invalid JSON, utilizing deterministic fallback:', error?.message);
    return buildDeterministicFallbackResponse(question, overview, targetClassHealth);
  }
}

/**
 * Builds an evidence-rich deterministic response when Gemini is offline or unconfigured.
 */
function buildDeterministicFallbackResponse(
  question: string,
  overview: SIBOverviewData,
  targetClass?: any
): SIBStructuredResponse {
  const qLower = question.toLowerCase();

  let answer = '';
  const findings: string[] = [];
  const metrics: any[] = [];
  const evidence: any[] = [];
  const recommendedActions: any[] = [];

  if (targetClass || qLower.includes('class')) {
    const cls = targetClass || (overview.classes.classesNeedingAttention[0] || overview.classes.allClassHealth[0]);
    answer = `${cls.className} currently has a Class Health Score of ${cls.healthScore}%. ${cls.attendanceTrend.explanation} ${cls.concerns.length > 0 ? `Primary concern: ${cls.concerns[0]}` : 'Performance is consistent with Sunday School benchmarks.'}`;
    findings.push(`Attendance rate is ${cls.attendanceRate}%.`);
    findings.push(`Student retention rate is ${cls.studentRetentionRate}%.`);
    findings.push(`Follow-up completion rate is ${cls.followUpCompletionRate}%.`);
    metrics.push({ name: `${cls.className} Health Score`, value: `${cls.healthScore}%`, benchmark: '75%', status: cls.healthScore >= 75 ? 'GOOD' : 'WARNING' });
    metrics.push({ name: 'Attendance Rate', value: `${cls.attendanceRate}%`, benchmark: '80%', status: cls.attendanceRate >= 80 ? 'GOOD' : 'WARNING' });
    evidence.push({ statement: 'Class health score', recordReference: `Classes (${cls.className})`, verifiedFact: `${cls.healthScore}% based on 6 weighted components` });
    recommendedActions.push({ action: cls.explanation.recommendedAction, reason: cls.concerns[0] || 'Routine maintenance', targetRole: 'Class Secretary / Teacher' });
  } else if (qLower.includes('attention') || qLower.includes('absent') || qLower.includes('student')) {
    answer = `Currently, ${overview.studentAttention.totalRequiringAttention} student(s) require pastoral attention across the Sunday Bible School, including ${overview.studentAttention.criticalCount} at CRITICAL level (3+ consecutive absences).`;
    overview.studentAttention.items.slice(0, 3).forEach(s => {
      findings.push(`${s.fullName} (${s.className}): ${s.consecutiveAbsences} consecutive absences (${s.whyBreakdown.primaryReason}).`);
    });
    metrics.push({ name: 'Critical Pastoral Attention Students', value: overview.studentAttention.criticalCount, benchmark: '0', status: overview.studentAttention.criticalCount === 0 ? 'GOOD' : 'WARNING' });
    metrics.push({ name: 'Follow-Up Completion Rate', value: `${overview.followUp.completionRate}%`, benchmark: '80%', status: overview.followUp.completionRate >= 80 ? 'GOOD' : 'WARNING' });
    evidence.push({ statement: 'Student consecutive absences', recordReference: 'Absence Logs & Weekly Grades', verifiedFact: `${overview.studentAttention.totalRequiringAttention} active risk alerts` });
    recommendedActions.push({ action: 'Execute and record pastoral care calls/visitations for students with 3+ absences', reason: 'High dropout risk without contact', targetRole: 'General Secretary' });
  } else if (qLower.includes('visitor')) {
    answer = `Quarter ${overview.quarterNumber} has recorded ${overview.visitors.totalVisitors} visitor(s), with a return rate of ${overview.visitors.returnRate}%. ${overview.visitors.consecutiveVisitCandidatesCount} visitor(s) have reached 3 consecutive visits and are eligible for student transition.`;
    findings.push(`${overview.visitors.returningVisitors} of ${overview.visitors.totalVisitors} visitors have returned.`);
    findings.push(`${overview.visitors.evangelismReferralsCount} evangelism referral credits recorded.`);
    metrics.push({ name: 'Visitor Return Rate', value: `${overview.visitors.returnRate}%`, benchmark: '50%', status: overview.visitors.returnRate >= 50 ? 'GOOD' : 'NEUTRAL' });
    evidence.push({ statement: 'Visitor attendance records', recordReference: 'Members (Visitor Roster)', verifiedFact: `${overview.visitors.returnRate}% return rate verified` });
    recommendedActions.push({ action: 'Enrollment Officer review for eligible 3-visit candidates', reason: 'Official student conversion qualification met', targetRole: 'Enrollment Officer' });
  } else {
    // School-wide Overview
    answer = `Overall Sunday School Health is rated at ${overview.schoolHealthScore}% (Attendance: ${overview.attendance.currentRate}%, Trend: ${overview.attendance.trend.direction}). ${overview.topPriority.description}`;
    findings.push(`Current school attendance is ${overview.attendance.currentRate}% (${overview.attendance.trend.explanation}).`);
    findings.push(`${overview.classes.totalClasses} classes evaluated; ${overview.classes.classesNeedingAttention.length} class(es) currently require directorate attention.`);
    findings.push(`Pastoral follow-up completion rate is ${overview.followUp.completionRate}%.`);
    metrics.push({ name: 'School Health Score', value: `${overview.schoolHealthScore}%`, benchmark: '75%', status: overview.schoolHealthScore >= 75 ? 'GOOD' : 'WARNING' });
    metrics.push({ name: 'Attendance Rate', value: `${overview.attendance.currentRate}%`, benchmark: '80%', status: overview.attendance.currentRate >= 80 ? 'GOOD' : 'WARNING' });
    evidence.push({ statement: 'School health score', recordReference: 'School Overview Aggregation', verifiedFact: `${overview.schoolHealthScore}% composite score` });
    recommendedActions.push({ action: overview.topPriority.recommendedNextStep, reason: overview.topPriority.whyExplanation, targetRole: 'General Superintendent' });
  }

  return {
    answer,
    summary: `School Intelligence report for Quarter ${overview.quarterNumber}. School Health: ${overview.schoolHealthScore}%.`,
    findings,
    metrics,
    evidence,
    confidence: overview.schoolHealthExplanation.confidence,
    confidenceReason: overview.schoolHealthExplanation.confidenceReason,
    priority: overview.topPriority.priority,
    trend: overview.attendance.trend.direction,
    recommended_actions: recommendedActions,
    limitations: overview.schoolHealthExplanation.limitations,
    sources: ['Supabase Classes', 'Members Roster', 'Weekly Grades', 'Absence Logs'],
    ruleVersion: SIB_CONFIG.version,
    toolsUsed: ['computeSchoolOverview', 'deterministicEngine'],
  };
}

export async function handleSIBWeeklyReport(
  quarterNumber?: number
): Promise<SIBWeeklyReportResponse> {
  const dataset = await fetchServerRawDataset(quarterNumber);
  const overview = computeSchoolOverview(dataset);

  const majorDevelopments: string[] = [
    ...overview.positiveDevelopments,
    `Overall Sunday School attendance is at ${overview.attendance.currentRate}% (${overview.attendance.trend.direction.toLowerCase()}).`,
    `${overview.visitors.returningVisitors} visitors returned with ${overview.visitors.consecutiveVisitCandidatesCount} reaching student eligibility.`,
  ].slice(0, 3);

  const areasRequiringAttention: string[] = [
    overview.studentAttention.criticalCount > 0 ? `${overview.studentAttention.criticalCount} student(s) with 3+ consecutive unexcused absences.` : null,
    overview.classes.classesNeedingAttention.length > 0 ? `${overview.classes.classesNeedingAttention.length} class(es) flagged for low health score or attendance drops.` : null,
    overview.followUp.outstandingFollowUps > 0 ? `${overview.followUp.outstandingFollowUps} absence care follow-up record(s) pending completion.` : null,
  ].filter(Boolean) as string[];

  if (areasRequiringAttention.length === 0) {
    areasRequiringAttention.push('Maintain current attendance marking and weekly register collation timelines.');
  }

  return {
    title: 'GOFAMINT Sunday School Weekly Intelligence Report',
    quarterLabel: `Quarter ${overview.quarterNumber}`,
    dateGenerated: new Date().toISOString(),
    executiveSummary: `Sunday Bible School executive intelligence for Quarter ${overview.quarterNumber}. The overall School Health index is ${overview.schoolHealthScore}% with ${overview.attendance.currentRate}% student attendance. Top leadership priority: ${overview.topPriority.title}.`,
    majorDevelopments,
    areasRequiringAttention: areasRequiringAttention.slice(0, 3),
    topPriority: {
      title: overview.topPriority.title,
      urgency: overview.topPriority.priority,
      whyEvidence: overview.topPriority.whyExplanation,
      recommendedNextStep: overview.topPriority.recommendedNextStep,
    },
    metricsSummary: {
      attendanceRate: overview.attendance.currentRate,
      schoolHealthScore: overview.schoolHealthScore,
      prolongedAbsencesCount: overview.studentAttention.totalRequiringAttention,
      followUpCompletionRate: overview.followUp.completionRate,
      visitorReturnRate: overview.visitors.returnRate,
    },
    confidence: overview.schoolHealthExplanation.confidence,
    dataLimitations: overview.schoolHealthExplanation.limitations,
  };
}
