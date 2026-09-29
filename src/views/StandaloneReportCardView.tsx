import React, { useState, useEffect } from 'react';
import { VisitorReportCardView } from '../components/VisitorReportCardView';
import { Member, WeeklyGradeRecord, ClassProfile } from '../types';
import { getAllMembers, getAllFromStore, getClassProfile } from '../db/indexedDB';
import { GofamintLogo } from '../components/GofamintLogo';
import { AlertCircle, Lock } from 'lucide-react';
import { computeClassFairnessRankings, generateMemberClusterWeeks, MemberFairnessMetrics, WeekClusterPoint } from '../utils/fairnessScoring';

interface StandaloneReportCardViewProps {
  token: string;
  onBack?: () => void;
}

export const StandaloneReportCardView: React.FC<StandaloneReportCardViewProps> = ({
  token,
  onBack
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [grades, setGrades] = useState<WeeklyGradeRecord[]>([]);
  const [classProfile, setClassProfile] = useState<ClassProfile | null>(null);
  const [fairnessMetrics, setFairnessMetrics] = useState<MemberFairnessMetrics | null>(null);
  const [clusterWeeks, setClusterWeeks] = useState<WeekClusterPoint[]>([]);
  const [classSummary, setClassSummary] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadReportCard() {
      setLoading(true);
      setError(null);

      // 1. Prioritize authoritative Central Database API for live, accurate records
      try {
        const res = await fetch(`/api/report-card/${encodeURIComponent(token)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.reportCard && isMounted) {
            const rc = data.reportCard;
            const memberRealId = rc.id || `rc_${token}`;
            const syntheticMember: Member = {
              id: memberRealId,
              fullName: rc.fullName,
              phone: rc.phone || '',
              address: '',
              occupation: '',
              gender: rc.gender,
              department: rc.department,
              className: rc.className,
              classId: rc.classId,
              memberType: rc.memberType || 'STUDENT',
              status: rc.status || 'ACTIVE',
              firstLessonWeek: rc.firstLessonWeek || 1,
              evangelismReferralCount: 0,
              prayerRequests: '',
              notes: '',
              photoBase64: rc.photoBase64,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            const normalizedGrades: WeeklyGradeRecord[] = (Array.isArray(rc.grades) ? rc.grades : []).map((g: any) => ({
              ...g,
              memberId: memberRealId,
              weekNumber: Number(g.weekNumber || g.week_number || 1),
              quarterNumber: Number(g.quarterNumber || g.quarter_number || 1),
              attendance: g.attendance || g.attendanceMark || 'PRESENT',
              punctuality: Number(g.punctuality ?? 0),
              memoryVerse: Number(g.memoryVerse ?? 0),
              classParticipation: Number(g.classParticipation ?? 0)
            }));

            setMember(syntheticMember);
            setGrades(normalizedGrades);
            setClassProfile({
              id: rc.classId || 'my-class',
              className: rc.className || 'Sunday School Class',
              department: rc.department || 'General',
              teacherName: 'Class Teacher',
              secretaries: [],
              assignedWorkers: [],
              approvalStatus: 'APPROVED'
            });
            setFairnessMetrics(rc.fairnessMetrics || null);
            setClusterWeeks(rc.clusterWeeks || []);
            setClassSummary(rc.classSummary || null);
            setLoading(false);
            return;
          }
        }
      } catch (networkErr) {
        console.warn('Authoritative report card fetch warning, attempting offline cache:', networkErr);
      }

      // 2. Offline fallback to local IndexedDB
      try {
        const allMembers = await getAllMembers();
        const matched = allMembers.find(m =>
          m.reportCardToken?.token === token ||
          (m as any).reportCardToken === token ||
          (m as any).oneTimeProfileToken === token ||
          (m as any).oneTimeProfileToken?.token === token ||
          m.id === token
        );

        if (matched && isMounted) {
          setMember(matched);
          const allGrades = await getAllFromStore<WeeklyGradeRecord>('grades');
          const memberGrades = allGrades.filter(g => g.memberId === matched.id);
          setGrades(memberGrades);

          const profile = await getClassProfile();
          setClassProfile(profile || {
            id: matched.classId || 'my-class',
            className: matched.className || 'Sunday School Class',
            department: matched.department || 'General',
            teacherName: 'Class Teacher',
            secretaries: [],
            assignedWorkers: [],
            approvalStatus: 'APPROVED'
          });

          // Compute fairness and cluster weeks from local grades
          const classMembers = allMembers.filter(m => m.classId === matched.classId);
          const classGrades = allGrades.filter(g => g.classId === matched.classId);
          const fairness = computeClassFairnessRankings(
            classMembers.length > 0 ? classMembers : [matched],
            classGrades.length > 0 ? classGrades : memberGrades,
            12
          );
          const myMetrics = fairness.memberMetrics.find(m => m.memberId === matched.id) || null;
          setFairnessMetrics(myMetrics);
          setClusterWeeks(generateMemberClusterWeeks(matched, memberGrades, 12));
          setClassSummary({
            rankings: myMetrics?.rankings,
            classAverages: fairness.classAverages
          });
          setLoading(false);
          return;
        }
      } catch (localErr) {
        console.warn('Local database lookup error:', localErr);
      }

      if (isMounted) {
        setError('Report card not found or link has expired. Please verify your student profile link.');
        setLoading(false);
      }
    }

    loadReportCard();

    return () => {
      isMounted = false;
    };
  }, [token, refreshKey]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-300">Loading Sunday School Report Card...</p>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-red-800/50 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-red-300 mb-2 font-['Cinzel',serif]">
            Report Card Unavailable
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed mb-6">
            {error || 'The report card token is invalid or does not match any student record.'}
          </p>
          <div className="bg-slate-800/80 rounded-2xl p-4 text-xs text-slate-400 border border-slate-700 leading-relaxed">
            Please verify the access link or request a new report card link from your Sunday School teacher.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <VisitorReportCardView
        memberId={member.id}
        members={[member]}
        grades={grades}
        classProfile={classProfile}
        fairnessMetrics={fairnessMetrics}
        clusterWeeks={clusterWeeks}
        classSummary={classSummary}
        onBack={onBack}
        onRefresh={() => setRefreshKey(k => k + 1)}
      />
    </div>
  );
};
