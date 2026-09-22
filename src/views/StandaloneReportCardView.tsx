import React, { useState, useEffect } from 'react';
import { VisitorReportCardView } from '../components/VisitorReportCardView';
import { Member, WeeklyGradeRecord, ClassProfile } from '../types';
import { getAllMembers, getAllFromStore, getClassProfile } from '../db/indexedDB';
import { GofamintLogo } from '../components/GofamintLogo';
import { AlertCircle, Lock } from 'lucide-react';

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

  useEffect(() => {
    let isMounted = true;

    async function loadReportCard() {
      setLoading(true);
      setError(null);

      try {
        // 1. Check local IndexedDB first
        try {
          const allMembers = await getAllMembers();
          const matched = allMembers.find(m => m.reportCardToken?.token === token);
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
            setLoading(false);
            return;
          }
        } catch {
          // Fall through to server API
        }

        // 2. Fetch from authoritative server endpoint
        const res = await fetch(`/api/report-card/${encodeURIComponent(token)}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Report card not found or link has expired.');
        }

        const data = await res.json();
        if (!data.success || !data.reportCard) {
          throw new Error('Report card data is unavailable.');
        }

        if (isMounted) {
          const rc = data.reportCard;
          const syntheticMember: Member = {
            id: `rc_${token}`,
            fullName: rc.fullName,
            phone: rc.phone || '',
            address: '',
            occupation: '',
            gender: rc.gender,
            department: rc.department,
            className: rc.className,
            classId: rc.classId,
            memberType: rc.memberType || 'VISITOR',
            status: rc.status || 'ACTIVE',
            firstLessonWeek: rc.firstLessonWeek || 1,
            evangelismReferralCount: 0,
            prayerRequests: '',
            notes: '',
            photoBase64: rc.photoBase64,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          setMember(syntheticMember);
          setGrades(Array.isArray(rc.grades) ? rc.grades : []);
          setClassProfile({
            id: rc.classId || 'my-class',
            className: rc.className || 'Sunday School Class',
            department: rc.department || 'General',
            teacherName: 'Class Teacher',
            secretaries: [],
            assignedWorkers: [],
            approvalStatus: 'APPROVED'
          });
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to load report card.');
          setLoading(false);
        }
      }
    }

    loadReportCard();

    return () => {
      isMounted = false;
    };
  }, [token]);

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
        onBack={onBack}
      />
    </div>
  );
};
