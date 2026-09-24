import React, { useState, useMemo } from 'react';
import { 
  WorkerProfile, 
  WorkerAttendanceRecord, 
  WorkerPrepAttendanceRecord, 
  SundaySchoolYear,
  QuarterNumber,
  SpecialWorkersEvent,
  SpecialEventAttendanceRecord
} from '../../types';
import { 
  getQuarterWeeklySchedule, 
  computeTop3PunctualityHonors, 
  computeQuarterWeeklyMetrics,
  computeAllWorkersQuarterPerformance,
  WorkerQuarterPerformance
} from '../../utils/quarterScheduleUtils';
import { AdmonitionCitationPrintModal } from './AdmonitionCitationPrintModal';
import { 
  Trophy, Award, Medal, Sparkles, Printer, Calendar, 
  CheckCircle2, Clock, Users, BookOpen, ChevronRight, Download,
  Flame, HeartHandshake, ShieldCheck, ShieldAlert, UserX, RefreshCw,
  Search, Info, Check, ArrowRight, UserPlus, Filter, X, Star
} from 'lucide-react';
import { GofamintLogo } from '../GofamintLogo';

interface QuarterPunctualityAdmonitionViewProps {
  workers: WorkerProfile[];
  sundayAttendance: WorkerAttendanceRecord[];
  prepAttendance: WorkerPrepAttendanceRecord[];
  sundaySchoolYear: SundaySchoolYear;
  selectedQuarterNumber: QuarterNumber;
  onSelectQuarter: (qNum: QuarterNumber) => void;
  onSaveWorkerProfile?: (worker: WorkerProfile) => Promise<void>;
  onDeleteWorker?: (id: string) => Promise<void>;
  specialEvents?: SpecialWorkersEvent[];
  specialAttendance?: SpecialEventAttendanceRecord[];
}

export const QuarterPunctualityAdmonitionView: React.FC<QuarterPunctualityAdmonitionViewProps> = ({
  workers,
  sundayAttendance,
  prepAttendance,
  sundaySchoolYear,
  selectedQuarterNumber,
  onSelectQuarter,
  onSaveWorkerProfile,
  specialEvents = [],
  specialAttendance = []
}) => {
  const activeWorkers = useMemo(() => workers.filter(w => w.status === 'ACTIVE'), [workers]);

  const currentQuarter = useMemo(() => {
    return sundaySchoolYear.quarters.find(q => q.quarterNumber === selectedQuarterNumber) || sundaySchoolYear.quarters[0];
  }, [sundaySchoolYear, selectedQuarterNumber]);

  const schedule = useMemo(() => {
    return getQuarterWeeklySchedule(currentQuarter);
  }, [currentQuarter]);

  const weeklyMetrics = useMemo(() => {
    return computeQuarterWeeklyMetrics(schedule, activeWorkers, sundayAttendance, prepAttendance);
  }, [schedule, activeWorkers, sundayAttendance, prepAttendance]);

  // Real-time Top 3 Rankings (Automatically skips all exempted workers)
  const { top3PrepClass, top3SundayService } = useMemo(() => {
    return computeTop3PunctualityHonors(activeWorkers, schedule, sundayAttendance, prepAttendance);
  }, [activeWorkers, schedule, sundayAttendance, prepAttendance]);

  // Comprehensive 12-week performance for all active workers
  const allPerformances = useMemo(() => {
    return computeAllWorkersQuarterPerformance(workers, schedule, sundayAttendance, prepAttendance);
  }, [workers, schedule, sundayAttendance, prepAttendance]);

  // Overall quarter summary
  const averageSundayPunctuality = useMemo(() => {
    const valid = weeklyMetrics.filter(m => m.sundayTurnoutCount > 0);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, m) => acc + m.sundayPunctualityRate, 0);
    return Math.round(sum / valid.length);
  }, [weeklyMetrics]);

  const averagePrepPunctuality = useMemo(() => {
    const valid = weeklyMetrics.filter(m => m.prepTurnoutCount > 0);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, m) => acc + m.prepPunctualityRate, 0);
    return Math.round(sum / valid.length);
  }, [weeklyMetrics]);

  // State for Honors Sub-Navigation Mode (Complaint 7)
  const [honorsTab, setHonorsTab] = useState<'12_WEEK' | 'SPECIAL_EVENTS' | 'CUMULATIVE'>('12_WEEK');

  // Special Events search & filter state
  const [searchSpecialQuery, setSearchSpecialQuery] = useState<string>('');
  const [filterSpecialDept, setFilterSpecialDept] = useState<string>('ALL');

  // Cumulative Grand Honors search & filter state
  const [searchCumulativeQuery, setSearchCumulativeQuery] = useState<string>('');
  const [filterCumulativeDept, setFilterCumulativeDept] = useState<string>('ALL');

  // Included Special Events for evaluation (Complaint 6: includes events with includeInPunctualityHonors !== false)
  const eligibleSpecialEvents = useMemo(() => {
    return specialEvents.filter(e => e.includeInPunctualityHonors !== false);
  }, [specialEvents]);

  const eligibleSpecialEventIds = useMemo(() => {
    return new Set(eligibleSpecialEvents.map(e => e.id));
  }, [eligibleSpecialEvents]);

  // Special events attendance filtered to eligible events
  const eligibleSpecialAttendance = useMemo(() => {
    return specialAttendance.filter(a => eligibleSpecialEventIds.has(a.eventId));
  }, [specialAttendance, eligibleSpecialEventIds]);

  // Special Event Performance for each active worker
  const specialEventPerformances = useMemo(() => {
    const totalEvents = eligibleSpecialEvents.length;

    return activeWorkers.map(w => {
      const records = eligibleSpecialAttendance.filter(a => a.workerId === w.id);
      const attendedCount = records.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
      const onTimeCount = records.filter(a => a.status === 'PRESENT').length;
      const punctualityRate = attendedCount > 0 ? Math.round((onTimeCount / attendedCount) * 100) : 0;
      const attendanceRate = totalEvents > 0 ? Math.round((attendedCount / totalEvents) * 100) : 0;
      const compositeScore = (onTimeCount * 15) + (attendedCount * 10);

      let honorBadge = 'Participant';
      if (attendedCount > 0) {
        if (punctualityRate === 100 && attendedCount === totalEvents) {
          honorBadge = 'Gold Star Exemplary (100%)';
        } else if (punctualityRate >= 80) {
          honorBadge = 'Premier Punctuality Honor';
        } else if (punctualityRate >= 60) {
          honorBadge = 'Faithful & Commended';
        } else {
          honorBadge = 'Encouragement Candidate';
        }
      }

      return {
        worker: w,
        workerId: w.id,
        workerName: w.fullName,
        department: w.department,
        duty: w.duty,
        phone: w.phone,
        attendedCount,
        onTimeCount,
        totalEvents,
        punctualityRate,
        attendanceRate,
        compositeScore,
        honorBadge,
        isExempt: !!w.exemptFromHonors,
        exemptionReason: w.exemptionReason
      };
    });
  }, [activeWorkers, eligibleSpecialEvents, eligibleSpecialAttendance]);

  // Filtered special event performances for table
  const filteredSpecialPerformances = useMemo(() => {
    return specialEventPerformances.filter(p => {
      const q = (searchSpecialQuery || '').toLowerCase();
      const matchesSearch = p.workerName.toLowerCase().includes(q) || p.department.toLowerCase().includes(q);
      const matchesDept = filterSpecialDept === 'ALL' || p.department === filterSpecialDept;
      return matchesSearch && matchesDept;
    });
  }, [specialEventPerformances, searchSpecialQuery, filterSpecialDept]);

  // Top 3 Special Events Workers (Exemptions excluded)
  const top3SpecialEvents = useMemo(() => {
    const eligible = specialEventPerformances
      .filter(p => !p.isExempt && p.attendedCount > 0)
      .sort((a, b) => {
        if (b.punctualityRate !== a.punctualityRate) return b.punctualityRate - a.punctualityRate;
        if (b.attendedCount !== a.attendedCount) return b.attendedCount - a.attendedCount;
        return b.compositeScore - a.compositeScore;
      });

    return eligible.slice(0, 3).map((c, idx) => ({
      ...c,
      rank: idx + 1,
      citation: idx === 0
        ? "Premier Laureate of Special Event Punctuality: Honored for prompt attendance and faithful diligence across special conferences and convocations."
        : idx === 1
        ? "Second Place Citation: Commended for stellar promptness and dedication in special church gatherings."
        : "Third Place Citation: Recognized for steadfast attendance and commendable punctuality in special training events."
    }));
  }, [specialEventPerformances]);

  // Average Special Event Punctuality across all workers
  const averageSpecialPunctuality = useMemo(() => {
    const withAtt = specialEventPerformances.filter(p => p.attendedCount > 0);
    if (withAtt.length === 0) return 0;
    const totalPunct = withAtt.reduce((sum, p) => sum + p.punctualityRate, 0);
    return Math.round(totalPunct / withAtt.length);
  }, [specialEventPerformances]);

  // Cumulative Grand Performances combining 12-week + Special Events
  const cumulativeGrandPerformances = useMemo(() => {
    const regularWeeks = schedule.filter(s => !s.isSharingAdmonitionWeek).length || 12;
    const totalSpecialEvents = eligibleSpecialEvents.length;
    const totalPossibleSessions = (regularWeeks * 2) + totalSpecialEvents; // Sundays + Thursdays + Special Events

    type SpecialPerfItem = typeof specialEventPerformances[number];
    const specialMap = new Map<string, SpecialPerfItem>();
    specialEventPerformances.forEach(sp => specialMap.set(sp.workerId, sp));

    return allPerformances.map(p => {
      const sp = specialMap.get(p.workerId) || {
        attendedCount: 0,
        onTimeCount: 0,
        punctualityRate: 0,
        attendanceRate: 0
      };

      const regularAttended = p.sundayAttendedCount + p.prepAttendedCount;
      const regularOnTime = p.sundayOnTimeCount + p.prepOnTimeCount;

      const grandAttended = regularAttended + sp.attendedCount;
      const grandOnTime = regularOnTime + sp.onTimeCount;

      const grandAttendanceRate = totalPossibleSessions > 0
        ? Math.min(100, Math.round((grandAttended / totalPossibleSessions) * 100))
        : 0;

      const grandPunctualityRate = grandAttended > 0
        ? Math.round((grandOnTime / grandAttended) * 100)
        : 0;

      const grandCompositeScore = (grandOnTime * 20) + (grandAttended * 10);

      let grandTier = 'Devoted Minister';
      if (grandPunctualityRate >= 95 && grandAttendanceRate >= 85) {
        grandTier = 'Grand Pillar of Dedication (Triple Gold)';
      } else if (grandPunctualityRate >= 85 && grandAttendanceRate >= 75) {
        grandTier = 'Exemplary Minister (Distinction)';
      } else if (grandPunctualityRate >= 70) {
        grandTier = 'Faithful & Commended Servant';
      } else {
        grandTier = 'Encouragement Candidate';
      }

      return {
        ...p,
        specialAttended: sp.attendedCount,
        specialOnTime: sp.onTimeCount,
        specialPunctualityRate: sp.punctualityRate,
        grandAttended,
        grandOnTime,
        totalPossibleSessions,
        grandAttendanceRate,
        grandPunctualityRate,
        grandCompositeScore,
        grandTier
      };
    });
  }, [schedule, eligibleSpecialEvents, specialEventPerformances, allPerformances]);

  // Filtered Cumulative Grand Performances
  const filteredCumulativePerformances = useMemo(() => {
    return cumulativeGrandPerformances.filter(p => {
      const q = (searchCumulativeQuery || '').toLowerCase();
      const matchesSearch = (p.worker?.fullName || '').toLowerCase().includes(q) || (p.worker?.department || '').toLowerCase().includes(q);
      const matchesDept = filterCumulativeDept === 'ALL' || p.worker?.department === filterCumulativeDept;
      return matchesSearch && matchesDept;
    });
  }, [cumulativeGrandPerformances, searchCumulativeQuery, filterCumulativeDept]);

  // Top 3 Cumulative Grand Champions
  const top3GrandChampions = useMemo(() => {
    const candidates = cumulativeGrandPerformances
      .filter(p => !p.isExempt && p.grandAttended > 0)
      .sort((a, b) => {
        if (b.grandPunctualityRate !== a.grandPunctualityRate) return b.grandPunctualityRate - a.grandPunctualityRate;
        if (b.grandAttendanceRate !== a.grandAttendanceRate) return b.grandAttendanceRate - a.grandAttendanceRate;
        return b.grandCompositeScore - a.grandCompositeScore;
      });

    return candidates.slice(0, 3).map((c, idx) => ({
      ...c,
      rank: idx + 1,
      grandCitation: idx === 0
        ? "Supreme Grand Laureate: Bestowed Highest Honorary Distinction for paramount punctuality and unwavering attendance across all Sunday Services, Thursday Preparatory Classes, and Special Convocations."
        : idx === 1
        ? "Grand Runner-Up of Excellence: Commended with high honors for exemplary consistency and outstanding punctuality church-wide."
        : "Grand Third Place of Diligent Stewardship: Recognized for distinguished fidelity and steadfast promptness across all ministerial assemblies."
    }));
  }, [cumulativeGrandPerformances]);

  // Grand Average Punctuality church-wide
  const averageGrandPunctuality = useMemo(() => {
    const withAtt = cumulativeGrandPerformances.filter(p => p.grandAttended > 0);
    if (withAtt.length === 0) return 0;
    const sum = withAtt.reduce((acc, p) => acc + p.grandPunctualityRate, 0);
    return Math.round(sum / withAtt.length);
  }, [cumulativeGrandPerformances]);

  // State for Exemption Modal
  const [exemptModalWorker, setExemptModalWorker] = useState<WorkerProfile | null>(null);
  const [exemptionReasonInput, setExemptionReasonInput] = useState<string>('Pastor / Minister in Charge');
  const [customReason, setCustomReason] = useState<string>('');

  // State for Reassignment Modal
  const [reassignModalWorker, setReassignModalWorker] = useState<WorkerProfile | null>(null);
  const [newDepartmentInput, setNewDepartmentInput] = useState<string>('');
  const [newDutyInput, setNewDutyInput] = useState<string>('');
  const [reassignReasonInput, setReassignReasonInput] = useState<string>('');

  // State for Official Printable Citation & Certificate Modal
  const [isPrintCitationModalOpen, setIsPrintCitationModalOpen] = useState<boolean>(false);

  // Search filter for full roster
  const [searchRosterQuery, setSearchRosterQuery] = useState<string>('');
  const [filterRosterStatus, setFilterRosterStatus] = useState<'ALL' | 'ELIGIBLE' | 'EXEMPTED'>('ALL');

  const filteredPerformances = useMemo(() => {
    return allPerformances.filter(p => {
      const q = (searchRosterQuery || '').toLowerCase();
      const matchesSearch = 
        (p.worker?.fullName || '').toLowerCase().includes(q) ||
        (p.worker?.department || '').toLowerCase().includes(q);
      
      if (filterRosterStatus === 'ELIGIBLE') {
        return matchesSearch && !p.isExempt;
      }
      if (filterRosterStatus === 'EXEMPTED') {
        return matchesSearch && p.isExempt;
      }
      return matchesSearch;
    });
  }, [allPerformances, searchRosterQuery, filterRosterStatus]);

  // List of exempted workers
  const exemptedPerformances = useMemo(() => {
    return allPerformances.filter(p => p.isExempt);
  }, [allPerformances]);

  // Handle Quick Toggle / Save Exemption
  const handleToggleExemption = async (worker: WorkerProfile, shouldExempt: boolean, reason?: string) => {
    if (!onSaveWorkerProfile) return;

    const updated: WorkerProfile = {
      ...worker,
      exemptFromHonors: shouldExempt,
      exemptionReason: shouldExempt ? (reason || 'Exempted from honorary award ranking') : undefined,
      updatedAt: new Date().toISOString()
    };

    await onSaveWorkerProfile(updated);
    setExemptModalWorker(null);
    setCustomReason('');
  };

  // Handle Reassign Worker
  const handleSaveReassignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignModalWorker || !onSaveWorkerProfile) return;

    const updated: WorkerProfile = {
      ...reassignModalWorker,
      department: newDepartmentInput.trim() || reassignModalWorker.department,
      duty: newDutyInput.trim() || reassignModalWorker.duty,
      reassignmentReason: reassignReasonInput.trim(),
      updatedAt: new Date().toISOString()
    };

    await onSaveWorkerProfile(updated);
    setReassignModalWorker(null);
    setNewDepartmentInput('');
    setNewDutyInput('');
    setReassignReasonInput('');
  };

  return (
    <div className="workers-page workers-page-honours space-y-5 sm:space-y-7 animate-fade-in pb-12">
      
      {/* Header Banner */}
      <div className="workers-page-hero workers-page-hero-dark bg-linear-to-r from-blue-950 via-slate-900 to-red-950 text-white rounded-3xl p-5 sm:p-8 shadow-xl border-2 border-amber-400/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 border border-amber-400/40 rounded-full text-xs font-black text-amber-300 uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5" />
              <span>Quarter 12-Week Admonition & Recognition Ceremony</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black font-['Cinzel',serif] tracking-wide text-white">
              Punctuality Honors & Brotherly Admonition
            </h1>
            <p className="text-xs sm:text-sm text-amber-100 max-w-2xl leading-relaxed">
              In accordance with the 12-week Sunday School review and Sharing & Admonition guidelines, recognizing the top 3 workers demonstrating premier punctuality in Ministerial Preparatory Class and Sunday Morning Service separately.
            </p>
          </div>

          <button
            onClick={() => setIsPrintCitationModalOpen(true)}
            className="px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition shrink-0 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Admonition Citation</span>
          </button>
        </div>
      </div>

      {/* Honors System Mode Navigation (Complaint 7) */}
      <div className="bg-slate-900 border-2 border-amber-500/50 p-2.5 rounded-2xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 px-2">
          <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-100 block">
              Punctuality Honors Mode
            </span>
            <span className="text-[10px] text-slate-400">
              Select evaluation domain (12-Week Regular, Special Events, or Cumulative Grand Ranking)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setHonorsTab('12_WEEK')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
              honorsTab === '12_WEEK'
                ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>12-Week Punctuality Honors</span>
          </button>

          <button
            onClick={() => setHonorsTab('SPECIAL_EVENTS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
              honorsTab === 'SPECIAL_EVENTS'
                ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Special Event Punctuality Honors</span>
          </button>

          <button
            onClick={() => setHonorsTab('CUMULATIVE')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
              honorsTab === 'CUMULATIVE'
                ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-amber-300" />
            <span>Cumulative Grand Honors</span>
          </button>
        </div>
      </div>

      {honorsTab === '12_WEEK' && (
        <div className="space-y-8">
      {/* Quarter Selector (1st Quarter to 4th Quarter) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-900" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-700">
            Select Evaluation Quarter:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sundaySchoolYear.quarters.map(q => {
            const isSelected = q.quarterNumber === selectedQuarterNumber;
            return (
              <button
                key={q.id}
                onClick={() => onSelectQuarter(q.quarterNumber)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-blue-900 text-white shadow-md ring-2 ring-amber-400'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{q.quarterName}</span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                  q.status === 'ACTIVE' 
                    ? 'bg-emerald-500 text-white' 
                    : q.status === 'ARCHIVED' 
                    ? 'bg-slate-400 text-white' 
                    : 'bg-amber-400 text-slate-950'
                }`}>
                  {q.status}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quarter Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Quarter Theme</span>
          <h3 className="text-base font-bold font-['Cinzel',serif] text-slate-100">
            {currentQuarter.quarterTheme || 'General Faith & Holy Service'}
          </h3>
          <span className="text-[11px] text-slate-400 block pt-1">
            Weeks evaluated: {schedule.filter(s => !s.isSharingAdmonitionWeek).length} regular study weeks
          </span>
        </div>

        <div className="bg-emerald-950 text-white p-5 rounded-2xl border border-emerald-800 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Sunday Service Punctuality</span>
          <div className="text-3xl font-black text-emerald-300 font-mono">
            {averageSundayPunctuality}%
          </div>
          <span className="text-[11px] text-emerald-200 block">
            Average on-time arrival rate across active workers
          </span>
        </div>

        <div className="bg-blue-950 text-white p-5 rounded-2xl border border-blue-800 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Thursday Prep Class Punctuality</span>
          <div className="text-3xl font-black text-blue-300 font-mono">
            {averagePrepPunctuality}%
          </div>
          <span className="text-[11px] text-blue-200 block">
            Average study attendance punctuality rate
          </span>
        </div>

      </div>

      {/* SEPARATE LIST 1: TOP 3 WORKERS FOR THURSDAY PREPARATORY CLASS */}
      <div className="bg-white border-2 border-blue-200 rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 border border-blue-300 text-blue-900 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded-md text-[10px] font-black uppercase tracking-wider">
                  Thursday Prep Class
                </span>
                <span className="text-xs text-slate-500 font-bold">12-Week Evaluation</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black font-['Cinzel',serif] text-slate-900">
                Top 3 Workers: Ministerial Preparatory Class
              </h2>
            </div>
          </div>

          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            Ranked by Prep Timeliness & Attendance Rate (Exemptions Excluded)
          </span>
        </div>

        {top3PrepClass.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No preparatory class attendance data recorded for this quarter yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {top3PrepClass.map((worker) => {
              const isGold = worker.rank === 1;
              const isSilver = worker.rank === 2;
              const isBronze = worker.rank === 3;

              return (
                <div 
                  key={worker.workerId}
                  className={`p-5 rounded-2xl border-2 flex flex-col justify-between relative transition hover:shadow-lg ${
                    isGold
                      ? 'bg-linear-to-b from-amber-50 to-amber-100/50 border-amber-400 shadow-md ring-2 ring-amber-400/50'
                      : isSilver
                      ? 'bg-linear-to-b from-slate-50 to-slate-100/60 border-slate-300 shadow-sm'
                      : 'bg-linear-to-b from-orange-50 to-orange-100/40 border-orange-300 shadow-sm'
                  }`}
                >
                  {/* Medal Ribbon Badge */}
                  <div className="flex items-center justify-between">
                    <div className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                      isGold
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : isSilver
                        ? 'bg-slate-300 text-slate-900 shadow-xs'
                        : 'bg-orange-300 text-orange-950 shadow-xs'
                    }`}>
                      <Medal className="w-4 h-4" />
                      <span>{isGold ? '1st Place • Gold' : isSilver ? '2nd Place • Silver' : '3rd Place • Bronze'}</span>
                    </div>

                    <span className="text-xl font-black font-mono text-slate-900">
                      {worker.punctualityRate}%
                    </span>
                  </div>

                  {/* Worker Information */}
                  <div className="my-4 space-y-2">
                    <h3 className="text-lg font-black text-slate-900 leading-tight">
                      {worker.workerName}
                    </h3>
                    
                    <div className="space-y-1">
                      <span className="inline-block px-2.5 py-0.5 bg-white border border-slate-300 rounded-md text-[11px] font-bold text-blue-950">
                        {worker.department} Department
                      </span>
                      <div className="text-xs text-slate-600 font-mono">
                        {worker.onTimeCount} of {worker.attendedCount} sessions on-time
                      </div>
                    </div>
                  </div>

                  {/* Admonition & Scriptural Citation */}
                  <div className="pt-3 border-t border-slate-200/80 bg-white/70 p-3 rounded-xl space-y-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Admonition Citation:
                      </span>
                      <p className="text-xs text-slate-800 italic leading-relaxed">
                        "{worker.admonitionCitation}"
                      </p>
                    </div>
                    <button
                      onClick={() => setIsPrintCitationModalOpen(true)}
                      className="w-full py-1.5 bg-blue-900/10 hover:bg-blue-900 hover:text-white text-blue-950 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Official Citation</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* SEPARATE LIST 2: TOP 3 WORKERS FOR SUNDAY MORNING SERVICE */}
      <div className="bg-white border-2 border-emerald-200 rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-900 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md text-[10px] font-black uppercase tracking-wider">
                  Sunday Morning Service
                </span>
                <span className="text-xs text-slate-500 font-bold">12-Week Evaluation</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black font-['Cinzel',serif] text-slate-900">
                Top 3 Workers: Sunday Morning Service Punctuality
              </h2>
            </div>
          </div>

          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            Ranked by Sunday Clock-In Timeliness (Exemptions Excluded)
          </span>
        </div>

        {top3SundayService.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No Sunday service clock-in attendance data recorded for this quarter yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {top3SundayService.map((worker) => {
              const isGold = worker.rank === 1;
              const isSilver = worker.rank === 2;
              const isBronze = worker.rank === 3;

              return (
                <div 
                  key={worker.workerId}
                  className={`p-5 rounded-2xl border-2 flex flex-col justify-between relative transition hover:shadow-lg ${
                    isGold
                      ? 'bg-linear-to-b from-amber-50 to-amber-100/50 border-amber-400 shadow-md ring-2 ring-amber-400/50'
                      : isSilver
                      ? 'bg-linear-to-b from-slate-50 to-slate-100/60 border-slate-300 shadow-sm'
                      : 'bg-linear-to-b from-emerald-50 to-emerald-100/40 border-emerald-300 shadow-sm'
                  }`}
                >
                  {/* Medal Ribbon Badge */}
                  <div className="flex items-center justify-between">
                    <div className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                      isGold
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : isSilver
                        ? 'bg-slate-300 text-slate-900 shadow-xs'
                        : 'bg-emerald-300 text-emerald-950 shadow-xs'
                    }`}>
                      <Medal className="w-4 h-4" />
                      <span>{isGold ? '1st Place • Gold' : isSilver ? '2nd Place • Silver' : '3rd Place • Bronze'}</span>
                    </div>

                    <span className="text-xl font-black font-mono text-slate-900">
                      {worker.punctualityRate}%
                    </span>
                  </div>

                  {/* Worker Information */}
                  <div className="my-4 space-y-2">
                    <h3 className="text-lg font-black text-slate-900 leading-tight">
                      {worker.workerName}
                    </h3>
                    
                    <div className="space-y-1">
                      <span className="inline-block px-2.5 py-0.5 bg-white border border-slate-300 rounded-md text-[11px] font-bold text-emerald-950">
                        {worker.department} Department
                      </span>
                      <div className="text-xs text-slate-600 font-mono">
                        {worker.onTimeCount} of {worker.attendedCount} Sundays on-time
                      </div>
                    </div>
                  </div>

                  {/* Admonition & Scriptural Citation */}
                  <div className="pt-3 border-t border-slate-200/80 bg-white/70 p-3 rounded-xl space-y-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Admonition Citation:
                      </span>
                      <p className="text-xs text-slate-800 italic leading-relaxed">
                        "{worker.admonitionCitation}"
                      </p>
                    </div>
                    <button
                      onClick={() => setIsPrintCitationModalOpen(true)}
                      className="w-full py-1.5 bg-emerald-900/10 hover:bg-emerald-900 hover:text-white text-emerald-950 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Official Citation</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* 3. DEDICATED EXEMPTED WORKERS ROSTER & MANAGEMENT */}
      {exemptedPerformances.length > 0 && (
        <div className="bg-white border-2 border-amber-200 rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black font-['Cinzel',serif] text-slate-900">
                  Exempted Workers Record & Performance
                </h3>
                <p className="text-xs text-slate-600">
                  Workers excluded from honorary award rankings (e.g. Pastors, Presiding Ministers, Sabbaticals). Full attendance logs and performance metrics are strictly preserved.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-xl text-xs font-black border border-amber-300 self-start sm:self-auto">
              {exemptedPerformances.length} Worker{exemptedPerformances.length === 1 ? '' : 's'} Exempted
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-amber-50 text-amber-950 font-bold uppercase tracking-wider border-b border-amber-200">
                <tr>
                  <th className="py-3 px-3">Worker Name</th>
                  <th className="py-3 px-3">Department & Duty</th>
                  <th className="py-3 px-3 text-center">Sunday Service Rate</th>
                  <th className="py-3 px-3 text-center">Thursday Prep Rate</th>
                  <th className="py-3 px-3">Exemption Reason</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {exemptedPerformances.map(({ worker, sunPunctualityRate, sunOnTime, sunAttended, prepPunctualityRate, prepOnTime, prepAttended, exemptionReason }) => (
                  <tr key={worker.id} className="hover:bg-amber-50/40 transition">
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {worker.fullName}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-semibold text-[10px]">
                        {worker.department}
                      </span>
                      {worker.duty && (
                        <span className="text-[10px] text-slate-500 block mt-0.5">{worker.duty}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      <span className="font-bold text-emerald-800">{sunPunctualityRate}%</span>
                      <span className="text-[10px] text-slate-500 block">({sunOnTime}/{sunAttended})</span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      <span className="font-bold text-blue-800">{prepPunctualityRate}%</span>
                      <span className="text-[10px] text-slate-500 block">({prepOnTime}/{prepAttended})</span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 italic">
                      {exemptionReason || 'Ministerial Exemption'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleExemption(worker, false)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-black transition cursor-pointer"
                      >
                        Restore to Ranking
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. FULL 12-WEEK WORKER PERFORMANCE ROSTER WITH EXEMPTION TOGGLE */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-xl font-black font-['Cinzel',serif] text-slate-900">
              12-Week Active Workers Performance Roster
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Comprehensive 12-week punctuality evaluation. Administrators can exempt workers (e.g. Pastors) or reassign duties with full record persistence.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <label className="font-bold text-slate-700">Filter:</label>
              <select
                value={filterRosterStatus}
                onChange={e => setFilterRosterStatus(e.target.value as any)}
                className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800 text-xs focus:outline-hidden focus:border-blue-900"
              >
                <option value="ALL">All Active Workers ({allPerformances.length})</option>
                <option value="ELIGIBLE">Eligible for Awards ({allPerformances.filter(p => !p.isExempt).length})</option>
                <option value="EXEMPTED">Exempted from Awards ({exemptedPerformances.length})</option>
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchRosterQuery}
                onChange={e => setSearchRosterQuery(e.target.value)}
                placeholder="Search worker..."
                className="bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-900 w-40 sm:w-52"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-300">
              <tr>
                <th className="py-3 px-3">Worker Name</th>
                <th className="py-3 px-3">Department & Duty</th>
                <th className="py-3 px-3 text-center">Sunday Service Punctuality</th>
                <th className="py-3 px-3 text-center">Thursday Prep Punctuality</th>
                <th className="py-3 px-3 text-center">Combined Score</th>
                <th className="py-3 px-3 text-center">Award Eligibility</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPerformances.map(({ worker, sunPunctualityRate, sunOnTime, sunAttended, prepPunctualityRate, prepOnTime, prepAttended, overallPunctualityRate, isExempt, exemptionReason }) => (
                <tr key={worker.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900 text-sm">
                      {worker.fullName}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {worker.phone}
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded font-bold text-[10px]">
                      {worker.department}
                    </span>
                    {worker.duty && (
                      <div className="text-[10px] text-slate-500 mt-0.5">{worker.duty}</div>
                    )}
                  </td>

                  <td className="py-3 px-3 text-center font-mono">
                    <span className="font-bold text-emerald-800 text-sm">{sunPunctualityRate}%</span>
                    <span className="text-[10px] text-slate-500 block">({sunOnTime}/{sunAttended} on-time)</span>
                  </td>

                  <td className="py-3 px-3 text-center font-mono">
                    <span className="font-bold text-blue-800 text-sm">{prepPunctualityRate}%</span>
                    <span className="text-[10px] text-slate-500 block">({prepOnTime}/{prepAttended} on-time)</span>
                  </td>

                  <td className="py-3 px-3 text-center font-mono">
                    <span className="font-black text-slate-900 text-sm">{overallPunctualityRate}%</span>
                  </td>

                  <td className="py-3 px-3 text-center">
                    {isExempt ? (
                      <div className="space-y-0.5">
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[9px] font-black uppercase tracking-wider">
                          Exempt from Award
                        </span>
                        <div className="text-[10px] text-slate-500 italic max-w-xs mx-auto truncate">
                          {exemptionReason || 'Pastoral / Ministerial'}
                        </div>
                      </div>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-[9px] font-black uppercase tracking-wider">
                        Eligible for Honors
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {isExempt ? (
                        <button
                          type="button"
                          onClick={() => handleToggleExemption(worker, false)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setExemptModalWorker(worker);
                            setExemptionReasonInput('Pastor / Minister in Charge');
                          }}
                          className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-lg text-[10px] font-black transition cursor-pointer"
                        >
                          Exempt from Award
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setReassignModalWorker(worker);
                          setNewDepartmentInput(worker.department);
                          setNewDutyInput(worker.duty || '');
                          setReassignReasonInput('');
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
                        title="Reassign Department or Duty"
                      >
                        Reassign
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
      )}

      {honorsTab === 'SPECIAL_EVENTS' && (
        <div className="space-y-8">
          {/* Special Events Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Included Special Events</span>
              <div className="text-3xl font-black text-amber-300 font-mono">
                {eligibleSpecialEvents.length}
              </div>
              <span className="text-[11px] text-slate-400 block pt-1">
                Special programs contributing to punctuality honors
              </span>
            </div>

            <div className="bg-blue-950 text-white p-5 rounded-2xl border border-blue-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Special Events Overall Punctuality</span>
              <div className="text-3xl font-black text-blue-300 font-mono">
                {averageSpecialPunctuality}%
              </div>
              <span className="text-[11px] text-blue-200 block">
                Average prompt arrival rate across special events
              </span>
            </div>

            <div className="bg-emerald-950 text-white p-5 rounded-2xl border border-emerald-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Total Special Attendances</span>
              <div className="text-3xl font-black text-emerald-300 font-mono">
                {eligibleSpecialAttendance.length}
              </div>
              <span className="text-[11px] text-emerald-200 block">
                Clock-in and attendance records logged in special events
              </span>
            </div>
          </div>

          {/* Included Special Events Status Strip */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Evaluated Special Events & Assemblies:
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Managed under Special Events & Training tab
              </span>
            </div>

            {eligibleSpecialEvents.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                No special events are currently configured to contribute to punctuality honors. Go to <strong>Special Events & Training</strong> and toggle "Include in Punctuality Honors" on any completed or active event.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {eligibleSpecialEvents.map(evt => (
                  <div key={evt.id} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center gap-2">
                    <span className="font-bold text-slate-800">{evt.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({evt.startDate})</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase ${
                      evt.isArchived 
                        ? 'bg-slate-200 text-slate-700' 
                        : evt.status === 'ACTIVE' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {evt.isArchived ? 'ARCHIVED' : evt.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* TOP 3 SPECIAL EVENTS WORKERS PODIUM */}
          <div className="bg-white border-2 border-blue-200 rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 border border-blue-300 text-blue-900 flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded-md text-[10px] font-black uppercase tracking-wider">
                      Special Events & Training
                    </span>
                    <span className="text-xs text-slate-500 font-bold">Punctuality Honors</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black font-['Cinzel',serif] text-slate-900">
                    Top 3 Workers: Special Events Punctuality
                  </h2>
                </div>
              </div>

              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                Ranked by Special Event Timeliness & Turnout (Exemptions Excluded)
              </span>
            </div>

            {top3SpecialEvents.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No special event attendance recorded yet or no eligible workers found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {top3SpecialEvents.map((worker) => {
                  const isGold = worker.rank === 1;
                  const isSilver = worker.rank === 2;

                  return (
                    <div 
                      key={worker.workerId}
                      className={`p-5 rounded-2xl border-2 flex flex-col justify-between relative transition hover:shadow-lg ${
                        isGold
                          ? 'bg-linear-to-b from-amber-50 to-amber-100/50 border-amber-400 shadow-md ring-2 ring-amber-400/50'
                          : isSilver
                          ? 'bg-linear-to-b from-slate-50 to-slate-100/60 border-slate-300 shadow-sm'
                          : 'bg-linear-to-b from-blue-50 to-blue-100/40 border-blue-300 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                          isGold
                            ? 'bg-amber-400 text-slate-950 shadow-xs'
                            : isSilver
                            ? 'bg-slate-300 text-slate-900 shadow-xs'
                            : 'bg-blue-300 text-blue-950 shadow-xs'
                        }`}>
                          <Medal className="w-4 h-4" />
                          <span>{isGold ? '1st Place • Gold' : isSilver ? '2nd Place • Silver' : '3rd Place • Bronze'}</span>
                        </div>

                        <span className="text-xl font-black font-mono text-slate-900">
                          {worker.punctualityRate}%
                        </span>
                      </div>

                      <div className="my-4 space-y-2">
                        <h3 className="text-lg font-black text-slate-900 leading-tight">
                          {worker.workerName}
                        </h3>
                        
                        <div className="space-y-1">
                          <span className="inline-block px-2.5 py-0.5 bg-white border border-slate-300 rounded-md text-[11px] font-bold text-blue-950">
                            {worker.department} Department
                          </span>
                          <div className="text-xs text-slate-600 font-mono">
                            {worker.onTimeCount} of {worker.attendedCount} special events on-time
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200/80 bg-white/70 p-3 rounded-xl space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                          Honorary Citation:
                        </span>
                        <p className="text-xs text-slate-800 italic leading-relaxed">
                          "{worker.citation}"
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* FULL SPECIAL EVENTS ROSTER */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-xl font-black font-['Cinzel',serif] text-slate-900">
                  Special Events Workers Roster & Punctuality
                </h3>
                <p className="text-xs text-slate-500">
                  Complete list of all active workers and their special event attendance record
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchSpecialQuery}
                    onChange={e => setSearchSpecialQuery(e.target.value)}
                    placeholder="Search name or department..."
                    className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-blue-900 w-52"
                  />
                </div>

                <select
                  value={filterSpecialDept}
                  onChange={e => setFilterSpecialDept(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden"
                >
                  <option value="ALL">All Departments</option>
                  {Array.from(new Set(workers.map(w => w.department))).filter(Boolean).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-800 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Worker Name</th>
                    <th className="py-3 px-3">Department & Duty</th>
                    <th className="py-3 px-3 text-center">Events Attended</th>
                    <th className="py-3 px-3 text-center">On-Time Count</th>
                    <th className="py-3 px-3 text-center">Special Punctuality</th>
                    <th className="py-3 px-3 text-center">Distinction Badge</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredSpecialPerformances.map((p) => (
                    <tr key={p.workerId} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 text-sm">
                          {p.workerName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {p.phone}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded font-bold text-[10px]">
                          {p.department}
                        </span>
                        {p.duty && (
                          <div className="text-[10px] text-slate-500 mt-0.5">{p.duty}</div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <span className="font-bold text-slate-900 text-sm">{p.attendedCount}</span>
                        <span className="text-[10px] text-slate-500 block">of {p.totalEvents} included</span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <span className="font-bold text-emerald-800 text-sm">{p.onTimeCount}</span>
                        <span className="text-[10px] text-slate-500 block">on-time</span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <span className="font-black text-slate-900 text-sm">{p.punctualityRate}%</span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                          p.punctualityRate >= 80 && p.attendedCount > 0
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : p.attendedCount > 0
                            ? 'bg-blue-100 text-blue-900 border-blue-300'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}>
                          {p.honorBadge}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {p.isExempt ? (
                            <button
                              type="button"
                              onClick={() => handleToggleExemption(p.worker, false)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setExemptModalWorker(p.worker);
                                setExemptionReasonInput('Pastor / Minister in Charge');
                              }}
                              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-lg text-[10px] font-black transition cursor-pointer"
                            >
                              Exempt
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {honorsTab === 'CUMULATIVE' && (
        <div className="space-y-8">
          {/* Cumulative Grand Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Total Program Assemblies</span>
              <div className="text-3xl font-black text-amber-300 font-mono">
                {cumulativeGrandPerformances[0]?.totalPossibleSessions || 24}
              </div>
              <span className="text-[11px] text-slate-400 block pt-1">
                Sundays + Thursday Preparatory + Special Events
              </span>
            </div>

            <div className="bg-emerald-950 text-white p-5 rounded-2xl border border-emerald-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Church-Wide Grand Punctuality</span>
              <div className="text-3xl font-black text-emerald-300 font-mono">
                {averageGrandPunctuality}%
              </div>
              <span className="text-[11px] text-emerald-200 block">
                Aggregated arrival timeliness across all church meetings
              </span>
            </div>

            <div className="bg-purple-950 text-white p-5 rounded-2xl border border-purple-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">Grand Distinction Ministers</span>
              <div className="text-3xl font-black text-purple-200 font-mono">
                {cumulativeGrandPerformances.filter(p => p.grandPunctualityRate >= 80).length}
              </div>
              <span className="text-[11px] text-purple-300 block">
                Workers attaining 80%+ cumulative on-time rate
              </span>
            </div>
          </div>

          {/* TOP 3 GRAND CHAMPIONS PODIUM */}
          <div className="bg-white border-2 border-amber-300 rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-400 text-amber-900 flex items-center justify-center">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-950 rounded-md text-[10px] font-black uppercase tracking-wider">
                      Overall Grand Punctuality Champions
                    </span>
                    <span className="text-xs text-slate-500 font-bold">Cumulative 12-Week + Special Events</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black font-['Cinzel',serif] text-slate-900">
                    Grand Laureates of Faithful Ministerial Punctuality
                  </h2>
                </div>
              </div>

              <span className="text-xs font-bold text-amber-950 bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-300">
                Combined Evaluation Across All Sunday School & Church Convocations
              </span>
            </div>

            {top3GrandChampions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No cumulative attendance records recorded for this evaluation cycle yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {top3GrandChampions.map((worker) => {
                  const isGold = worker.rank === 1;
                  const isSilver = worker.rank === 2;

                  return (
                    <div 
                      key={worker.workerId}
                      className={`p-5 rounded-2xl border-2 flex flex-col justify-between relative transition hover:shadow-lg ${
                        isGold
                          ? 'bg-linear-to-b from-amber-100 via-amber-50 to-yellow-100/60 border-amber-400 shadow-md ring-2 ring-amber-400'
                          : isSilver
                          ? 'bg-linear-to-b from-slate-50 to-slate-100/60 border-slate-300 shadow-sm'
                          : 'bg-linear-to-b from-orange-50 to-orange-100/40 border-orange-300 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                          isGold
                            ? 'bg-amber-400 text-slate-950 shadow-xs'
                            : isSilver
                            ? 'bg-slate-300 text-slate-900 shadow-xs'
                            : 'bg-orange-300 text-orange-950 shadow-xs'
                        }`}>
                          <Trophy className="w-4 h-4" />
                          <span>{isGold ? 'Grand Champion • Gold' : isSilver ? '2nd Place • Silver' : '3rd Place • Bronze'}</span>
                        </div>

                        <span className="text-xl font-black font-mono text-slate-900">
                          {worker.grandPunctualityRate}%
                        </span>
                      </div>

                      <div className="my-4 space-y-2">
                        <h3 className="text-lg font-black text-slate-900 leading-tight">
                          {worker.worker?.fullName}
                        </h3>
                        
                        <div className="space-y-1">
                          <span className="inline-block px-2.5 py-0.5 bg-white border border-slate-300 rounded-md text-[11px] font-bold text-amber-950">
                            {worker.worker?.department} Department
                          </span>
                          <div className="text-xs text-slate-600 font-mono">
                            {worker.grandOnTime} of {worker.grandAttended} church sessions on-time
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200/80 bg-white/70 p-3 rounded-xl space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                          Grand Laureate Citation:
                        </span>
                        <p className="text-xs text-slate-800 italic leading-relaxed">
                          "{worker.grandCitation}"
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* COMPREHENSIVE CUMULATIVE LEADERBOARD */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-xl font-black font-['Cinzel',serif] text-slate-900">
                  Comprehensive Cumulative Performance Leaderboard
                </h3>
                <p className="text-xs text-slate-500">
                  Synthesized ministerial records combining 12-week Sunday services, Thursday preparatory classes, and special training assemblies
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchCumulativeQuery}
                    onChange={e => setSearchCumulativeQuery(e.target.value)}
                    placeholder="Search name or department..."
                    className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-blue-900 w-52"
                  />
                </div>

                <select
                  value={filterCumulativeDept}
                  onChange={e => setFilterCumulativeDept(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden"
                >
                  <option value="ALL">All Departments</option>
                  {Array.from(new Set(workers.map(w => w.department))).filter(Boolean).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-800 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Worker Name</th>
                    <th className="py-3 px-3">Department & Duty</th>
                    <th className="py-3 px-3 text-center">Thursday Prep</th>
                    <th className="py-3 px-3 text-center">Sunday Service</th>
                    <th className="py-3 px-3 text-center">Special Events</th>
                    <th className="py-3 px-3 text-center">Grand Attendance</th>
                    <th className="py-3 px-3 text-center">Grand Punctuality</th>
                    <th className="py-3 px-3 text-center">Honor Distinction</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCumulativePerformances.map((p) => (
                    <tr key={p.workerId} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 text-sm">
                          {p.worker?.fullName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {p.worker?.phone}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded font-bold text-[10px]">
                          {p.worker?.department}
                        </span>
                        {p.worker?.duty && (
                          <div className="text-[10px] text-slate-500 mt-0.5">{p.worker.duty}</div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <span className="font-bold text-blue-900">{p.prepOnTimeCount}/{p.prepAttendedCount}</span>
                        <span className="text-[10px] text-slate-500 block">({p.prepPunctualityRate}%)</span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <span className="font-bold text-emerald-900">{p.sundayOnTimeCount}/{p.sundayAttendedCount}</span>
                        <span className="text-[10px] text-slate-500 block">({p.sundayPunctualityRate}%)</span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <span className="font-bold text-purple-900">{p.specialOnTime}/{p.specialAttended}</span>
                        <span className="text-[10px] text-slate-500 block">({p.specialPunctualityRate}%)</span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <span className="font-bold text-slate-900">{p.grandAttended}</span>
                        <span className="text-[10px] text-slate-500 block">({p.grandAttendanceRate}%)</span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <span className="font-black text-slate-900 text-sm">{p.grandPunctualityRate}%</span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                          p.grandPunctualityRate >= 85
                            ? 'bg-amber-100 text-amber-900 border-amber-400'
                            : p.grandPunctualityRate >= 70
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}>
                          {p.grandTier}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {p.isExempt ? (
                            <button
                              type="button"
                              onClick={() => handleToggleExemption(p.worker!, false)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setExemptModalWorker(p.worker!);
                                setExemptionReasonInput('Pastor / Minister in Charge');
                              }}
                              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-lg text-[10px] font-black transition cursor-pointer"
                            >
                              Exempt
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EXEMPTION DIALOG MODAL */}
      {exemptModalWorker && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-amber-900">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
                <h3 className="font-black font-['Cinzel',serif] text-base">
                  Exempt from Honorary Award
                </h3>
              </div>
              <button
                onClick={() => setExemptModalWorker(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p>
                Exempting <strong>{exemptModalWorker.fullName}</strong> will exclude them from the 1st, 2nd, and 3rd place award rankings.
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-amber-950">
                <div className="font-bold">Record Persistence Guarantee:</div>
                <p className="text-[11px] leading-relaxed">
                  All 12-week attendance logs, clock-in timestamps, and punctuality percentages are <strong>strictly preserved</strong> and will continue to be tracked accurately.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 block uppercase tracking-wider text-[10px]">
                  Select Exemption Category / Reason:
                </label>
                <select
                  value={exemptionReasonInput}
                  onChange={e => setExemptionReasonInput(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-800 text-xs focus:outline-hidden focus:border-blue-900"
                >
                  <option value="Pastor / Minister in Charge">Pastor / Minister in Charge</option>
                  <option value="Presiding Minister / Ordained Clergy">Presiding Minister / Ordained Clergy</option>
                  <option value="General Executive Committee Member">General Executive Committee Member</option>
                  <option value="Regional / District Overseer">Regional / District Overseer</option>
                  <option value="Transferred to Regional Post">Transferred to Regional Post</option>
                  <option value="Health / Sabbatical Leave">Health / Sabbatical Leave</option>
                  <option value="CUSTOM">Custom Specific Reason...</option>
                </select>
              </div>

              {exemptionReasonInput === 'CUSTOM' && (
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block text-[10px]">
                    Enter Specific Reason:
                  </label>
                  <input
                    type="text"
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                    placeholder="e.g. Special Advisory Council..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800 focus:outline-hidden focus:border-blue-900"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setExemptModalWorker(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const finalReason = exemptionReasonInput === 'CUSTOM' ? customReason.trim() || 'Custom Exemption' : exemptionReasonInput;
                  handleToggleExemption(exemptModalWorker, true, finalReason);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition cursor-pointer"
              >
                Confirm Exemption
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REASSIGNMENT DIALOG MODAL */}
      {reassignModalWorker && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-blue-900">
                <RefreshCw className="w-5 h-5" />
                <h3 className="font-black font-['Cinzel',serif] text-base">
                  Reassign Worker Ministry Portfolio
                </h3>
              </div>
              <button
                onClick={() => setReassignModalWorker(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReassignment} className="space-y-3 text-xs text-slate-700">
              <div>
                Reassigning: <strong>{reassignModalWorker.fullName}</strong>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 block text-[10px] uppercase">
                  New Department:
                </label>
                <input
                  type="text"
                  value={newDepartmentInput}
                  onChange={e => setNewDepartmentInput(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-blue-900"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 block text-[10px] uppercase">
                  New Duty / Primary Role:
                </label>
                <input
                  type="text"
                  value={newDutyInput}
                  onChange={e => setNewDutyInput(e.target.value)}
                  placeholder="e.g. Assistant Choir Leader, Usher In-Charge"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800 focus:outline-hidden focus:border-blue-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 block text-[10px] uppercase">
                  Reassignment Reason / Resolution:
                </label>
                <textarea
                  value={reassignReasonInput}
                  onChange={e => setReassignReasonInput(e.target.value)}
                  placeholder="e.g. Approved by Pastoral Board for Q2 ministry restructuring..."
                  rows={2}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800 focus:outline-hidden focus:border-blue-900"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReassignModalWorker(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-black transition cursor-pointer"
                >
                  Save Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Admonition Citation Print Modal */}
      <AdmonitionCitationPrintModal
        isOpen={isPrintCitationModalOpen}
        onClose={() => setIsPrintCitationModalOpen(false)}
        activeQuarter={currentQuarter}
        top3PrepClass={top3PrepClass}
        top3Sunday={top3SundayService}
        averageSundayPunctuality={averageSundayPunctuality}
        averagePrepPunctuality={averagePrepPunctuality}
      />

    </div>
  );
};
