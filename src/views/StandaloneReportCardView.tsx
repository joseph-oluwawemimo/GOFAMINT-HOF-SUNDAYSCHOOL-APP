import React, { useCallback, useEffect, useRef, useState } from 'react';
import { VisitorReportCardView } from '../components/VisitorReportCardView';
import { Member, WeeklyGradeRecord, ClassProfile } from '../types';
import { AlertCircle, Lock } from 'lucide-react';
import { MemberFairnessMetrics, WeekClusterPoint } from '../utils/fairnessScoring';

interface StandaloneReportCardViewProps {
  token: string;
  onBack?: () => void;
}

export const StandaloneReportCardView: React.FC<StandaloneReportCardViewProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [grades, setGrades] = useState<WeeklyGradeRecord[]>([]);
  const [classProfile, setClassProfile] = useState<ClassProfile | null>(null);
  const [fairnessMetrics, setFairnessMetrics] = useState<MemberFairnessMetrics | null>(null);
  const [clusterWeeks, setClusterWeeks] = useState<WeekClusterPoint[]>([]);
  const [classSummary, setClassSummary] = useState<any>(null);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  const loadReportCard = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      const response = await fetch(`/api/report-card/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success || !body.reportCard) {
        throw new Error(body.error || `Live report service failed (${response.status}).`);
      }
      if (!mountedRef.current || request !== requestRef.current) return;
      const rc = body.reportCard;
      if (!rc.id || !Array.isArray(rc.grades)) throw new Error('Live report service returned incomplete data.');
      setMember({
        id: rc.id,
        fullName: rc.fullName,
        phone: rc.phone || '',
        gender: rc.gender,
        address: '',
        occupation: '',
        prayerRequests: '',
        notes: '',
        department: rc.department,
        className: rc.className,
        classId: rc.classId,
        memberType: rc.memberType || 'STUDENT',
        status: rc.status || 'ACTIVE',
        firstLessonWeek: rc.firstLessonWeek || 1,
        evangelismReferralCount: 0,
        photoBase64: rc.photoBase64,
        createdAt: '',
        updatedAt: ''
      });
      setGrades(rc.grades.map((grade: any) => ({
        ...grade,
        memberId: rc.id,
        weekNumber: Number(grade.weekNumber || grade.week_number || 1),
        quarterNumber: Number(grade.quarterNumber || grade.quarter_number || 1),
        attendance: grade.attendance || grade.attendanceMark || 'ABSENT',
        punctuality: Number(grade.punctuality ?? 0),
        memoryVerse: Number(grade.memoryVerse ?? 0),
        classParticipation: Number(grade.classParticipation ?? 0)
      })));
      setClassProfile({
        id: rc.classId || 'my-class',
        className: rc.className || 'Sunday School Class',
        department: rc.department || 'General',
        secretaryName: rc.secretaryName || '',
        secretaryPhone: rc.secretaryPhone || '',
        teachers: rc.teachers || [],
        quarterTitle: rc.quarterTitle || 'Sunday School Curriculum',
        year: rc.year || new Date().getFullYear(),
        currencySymbol: '₦',
        isSetupComplete: true,
        approvalStatus: 'APPROVED',
        createdAt: '',
        updatedAt: ''
      });
      setFairnessMetrics(rc.fairnessMetrics || null);
      setClusterWeeks(rc.clusterWeeks || []);
      setClassSummary(rc.classSummary || null);
      setError(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      console.error('[ReportCard] Authoritative live data could not be read:', cause);
      if (mountedRef.current && request === requestRef.current) setError(message);
      throw cause;
    } finally {
      if (mountedRef.current && request === requestRef.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setMember(null);
    void loadReportCard().catch(() => undefined);
    const refreshVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void loadReportCard().catch(() => undefined);
    };
    const interval = window.setInterval(refreshVisible, 60_000);
    window.addEventListener('online', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      mountedRef.current = false;
      ++requestRef.current;
      window.clearInterval(interval);
      window.removeEventListener('online', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [loadReportCard]);

  if (loading && !member) {
    return (
      <div role="status" className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-300">Opening your live Sunday School report card…</p>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-5">
        <div role="alert" className="max-w-md w-full bg-slate-900 border border-red-800/50 rounded-3xl p-7 text-center">
          <Lock className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-black text-red-300">Report Card Unavailable</h1>
          <p className="mt-3 text-sm text-slate-300">{error || 'The private report link could not be verified.'}</p>
          <button type="button" onClick={() => void loadReportCard().catch(() => undefined)} className="mt-5 min-h-11 rounded-xl bg-amber-400 px-5 text-sm font-black text-slate-950">Retry live data</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-6">
      {error && (
        <div role="alert" className="mx-auto mb-4 flex max-w-3xl items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Live refresh failed: {error} The last successfully loaded report remains visible.</span>
        </div>
      )}
      <VisitorReportCardView
        memberId={member.id}
        members={[member]}
        grades={grades}
        classProfile={classProfile}
        fairnessMetrics={fairnessMetrics}
        clusterWeeks={clusterWeeks}
        classSummary={classSummary}
        onRefresh={loadReportCard}
      />
    </div>
  );
};
