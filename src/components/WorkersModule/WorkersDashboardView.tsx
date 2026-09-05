import React, { useState, useMemo } from 'react';
import { 
  WorkerProfile, 
  WorkerAttendanceRecord, 
  WorkerPrepAttendanceRecord,
  ClockInConfig,
  SundaySchoolYear,
  QuarterNumber
} from '../../types';
import { 
  BarChart3, Users, Clock, AlertTriangle, CheckCircle2, 
  Filter, Download, Printer, MessageSquare, ExternalLink, 
  Calendar, ArrowUpRight, Search, ShieldCheck, Sparkles,
  Trophy, Medal, Edit3, Lock, ChevronRight, BookOpen, Layers,
  Archive, ArrowRight
} from 'lucide-react';
import { 
  getQuarterWeeklySchedule, 
  computeQuarterWeeklyMetrics, 
  computeTop3PunctualityHonors,
  WeekScheduleInfo
} from '../../utils/quarterScheduleUtils';
import { ManualPastAttendanceModal } from './ManualPastAttendanceModal';

interface WorkersDashboardViewProps {
  workers: WorkerProfile[];
  sundayAttendance: WorkerAttendanceRecord[];
  prepAttendance: WorkerPrepAttendanceRecord[];
  departmentsList: string[];
  config: ClockInConfig;
  sundaySchoolYear: SundaySchoolYear;
  onNavigateToTab: (tab: any) => void;
  onViewQrPass: (worker: WorkerProfile) => void;
  onSaveSundayAttendance: (records: WorkerAttendanceRecord[]) => Promise<void>;
  onSavePrepAttendance: (records: WorkerPrepAttendanceRecord[]) => Promise<void>;
}

export const WorkersDashboardView: React.FC<WorkersDashboardViewProps> = ({
  workers,
  sundayAttendance,
  prepAttendance,
  departmentsList,
  config,
  sundaySchoolYear,
  onNavigateToTab,
  onViewQrPass,
  onSaveSundayAttendance,
  onSavePrepAttendance
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Active quarter selection (synced with General Secretary)
  const [selectedQuarterNumber, setSelectedQuarterNumber] = useState<QuarterNumber>(
    sundaySchoolYear.activeQuarterNumber || 1
  );

  const activeQuarter = useMemo(() => {
    return sundaySchoolYear.quarters.find(q => q.quarterNumber === selectedQuarterNumber) || sundaySchoolYear.quarters[0];
  }, [sundaySchoolYear, selectedQuarterNumber]);

  // Quarter weekly schedule (Week 1 to Week 12/13 with Sunday and Thursday dates)
  const quarterSchedule = useMemo(() => {
    return getQuarterWeeklySchedule(activeQuarter);
  }, [activeQuarter]);

  // Active workers list
  const activeWorkers = useMemo(() => {
    return workers.filter(w => w.status === 'ACTIVE');
  }, [workers]);

  // Weekly metrics summary for all 12 weeks
  const weeklyMetrics = useMemo(() => {
    return computeQuarterWeeklyMetrics(quarterSchedule, activeWorkers, sundayAttendance, prepAttendance);
  }, [quarterSchedule, activeWorkers, sundayAttendance, prepAttendance]);

  // Top 3 honors for Preparatory Class and Sunday Service separately
  const { top3PrepClass, top3SundayService } = useMemo(() => {
    return computeTop3PunctualityHonors(activeWorkers, quarterSchedule, sundayAttendance, prepAttendance);
  }, [activeWorkers, quarterSchedule, sundayAttendance, prepAttendance]);

  // Selected date for day-specific inspection (defaults to today or week 1 Sunday)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date().toISOString().split('T')[0];
    const match = quarterSchedule.find(s => s.sundayDate === today);
    return match ? match.sundayDate : (quarterSchedule[0]?.sundayDate || today);
  });

  // Department Filter ONLY (No Ministry Roles or Categories)
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'LATE' | 'ABSENT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Manual Past Attendance Modal State
  const [pastModalOpen, setPastModalOpen] = useState(false);
  const [pastModalServiceType, setPastModalServiceType] = useState<'SUNDAY_SERVICE' | 'PREP_CLASS'>('SUNDAY_SERVICE');
  const [pastModalDate, setPastModalDate] = useState<string>(selectedDate);
  const [pastModalWeek, setPastModalWeek] = useState<number>(1);

  // Attendance for the selected date
  const dateAttendance = useMemo(() => {
    return sundayAttendance.filter(a => a.serviceDate === selectedDate);
  }, [sundayAttendance, selectedDate]);

  // Map of workerId -> AttendanceRecord
  const attendanceMap = useMemo(() => {
    const map = new Map<string, WorkerAttendanceRecord>();
    dateAttendance.forEach(a => map.set(a.workerId, a));
    return map;
  }, [dateAttendance]);

  // Combined status roster for all active workers
  const combinedRoster = useMemo(() => {
    return activeWorkers.map(w => {
      const att = attendanceMap.get(w.id);
      const status: 'PRESENT' | 'LATE' | 'ABSENT' = att 
        ? (att.isLate || att.status === 'LATE' ? 'LATE' : 'PRESENT')
        : 'ABSENT';

      return {
        worker: w,
        attendance: att || null,
        status,
        clockInTime: att ? att.clockInTime : '—',
        method: att ? att.method : '—'
      };
    });
  }, [activeWorkers, attendanceMap]);

  // Filtered roster based on UI controls (Grouped strictly by Department)
  const filteredRoster = useMemo(() => {
    return combinedRoster.filter(item => {
      const matchesDept = selectedDept === 'ALL' || item.worker.department === selectedDept;
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch = 
        (item.worker?.fullName || '').toLowerCase().includes(q) ||
        (item.worker?.phone || '').includes(searchQuery || '') ||
        (item.worker?.department || '').toLowerCase().includes(q);

      return matchesDept && matchesStatus && matchesSearch;
    });
  }, [combinedRoster, selectedDept, statusFilter, searchQuery]);

  // Active Departments from actual workers + default list
  const effectiveDepartments = useMemo(() => {
    const set = new Set([...departmentsList, ...workers.map(w => w.department)]);
    return Array.from(set).filter(Boolean).sort();
  }, [departmentsList, workers]);

  // Department breakdown (Exclusive grouping by Department)
  const departmentBreakdown = useMemo(() => {
    return effectiveDepartments.map(dept => {
      const deptWorkers = combinedRoster.filter(r => r.worker.department === dept);
      const total = deptWorkers.length;
      const present = deptWorkers.filter(r => r.status === 'PRESENT').length;
      const late = deptWorkers.filter(r => r.status === 'LATE').length;
      const absent = deptWorkers.filter(r => r.status === 'ABSENT').length;
      const clocked = present + late;
      const turnoutRate = total > 0 ? Math.round((clocked / total) * 100) : 0;
      const punctualityRate = clocked > 0 ? Math.round((present / clocked) * 100) : 0;

      return { dept, total, present, late, absent, clocked, turnoutRate, punctualityRate };
    }).filter(d => d.total > 0);
  }, [effectiveDepartments, combinedRoster]);

  // Day Statistics
  const totalActive = combinedRoster.length;
  const presentCount = combinedRoster.filter(r => r.status === 'PRESENT').length;
  const lateCount = combinedRoster.filter(r => r.status === 'LATE').length;
  const absentCount = combinedRoster.filter(r => r.status === 'ABSENT').length;
  const totalClockedIn = presentCount + lateCount;
  const attendanceRate = totalActive > 0 ? Math.round((totalClockedIn / totalActive) * 100) : 0;
  const punctualityRate = totalClockedIn > 0 ? Math.round((presentCount / totalClockedIn) * 100) : 0;

  // Selected date status
  const isSelectedDateToday = selectedDate === todayStr;
  const isSelectedDatePast = selectedDate < todayStr;

  const handleOpenPastDataModal = (serviceType: 'SUNDAY_SERVICE' | 'PREP_CLASS', date: string, week: number) => {
    setPastModalServiceType(serviceType);
    setPastModalDate(date);
    setPastModalWeek(week);
    setPastModalOpen(true);
  };

  const handleExportCsv = () => {
    const headers = ['Worker Full Name', 'Department', 'Phone', 'WhatsApp', 'Service Date', 'Status', 'Clock-In Time', 'Method'];
    const rows = filteredRoster.map(item => [
      `"${item.worker.fullName}"`,
      `"${item.worker.department}"`,
      `"${item.worker.phone}"`,
      `"${item.worker.whatsappNumber || item.worker.phone}"`,
      `"${selectedDate}"`,
      `"${item.status}"`,
      `"${item.clockInTime}"`,
      `"${item.method}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GOFAMINT_HOF_Workers_Attendance_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 rounded-full text-xs font-black uppercase tracking-wider">
              Executive Directorate
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              Departmental Oversight & Quarterly Analytics
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-['Cinzel',serif] tracking-tight mt-1">
            Workers Attendance & Departmental Matrix
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mt-1">
            Synced with General Secretary Curriculum • Grouped strictly by Department • 12-Week Turnout & Punctuality rate tracking with separate Admonition honors.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigateToTab('SUNDAY_CLOCK_IN')}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Open Clock-In Terminal</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            title="Print Attendance Report"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 1ST QUARTER TO 4TH QUARTER SYNCHRONIZER (Synced with General Secretary) */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border-2 border-slate-800 space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                General Secretary Quarterly Sync
              </span>
              <h2 className="text-lg font-black font-['Cinzel',serif] text-white">
                {activeQuarter.quarterName}: {activeQuarter.quarterTheme || 'Kingdom Service & Discipleship'}
              </h2>
            </div>
          </div>

          {/* Quarter Tabs (Q1, Q2, Q3, Q4) */}
          <div className="flex flex-wrap items-center gap-2">
            {sundaySchoolYear.quarters.map(q => {
              const isSelected = q.quarterNumber === selectedQuarterNumber;
              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setSelectedQuarterNumber(q.quarterNumber);
                    const newSched = getQuarterWeeklySchedule(q);
                    if (newSched.length > 0) {
                      setSelectedDate(newSched[0].sundayDate);
                    }
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <span>Q{q.quarterNumber}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                    q.status === 'ACTIVE' 
                      ? 'bg-emerald-500 text-white' 
                      : q.status === 'ARCHIVED' 
                      ? 'bg-slate-600 text-slate-200' 
                      : 'bg-blue-600 text-white'
                  }`}>
                    {q.status}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date / Inspection Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          
          <div className="flex flex-wrap items-center gap-4">
            {/* Quick Service Date Pick within this quarter */}
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active Date Inspection:
              </label>
              <select
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 font-bold text-amber-300 focus:outline-hidden focus:border-amber-400"
              >
                {quarterSchedule.map(item => (
                  <option key={item.weekNumber} value={item.sundayDate}>
                    Week {item.weekNumber} (Sun: {item.sundayDate} • Thu Prep: {item.prepDate})
                  </option>
                ))}
              </select>
            </div>

            {/* Department Filter ONLY (No Ministry Roles / Categories) */}
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Department:
              </label>
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 font-bold text-white focus:outline-hidden focus:border-amber-400"
              >
                <option value="ALL">All Departments ({activeWorkers.length})</option>
                {effectiveDepartments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Immutability & Past Data Entry Status */}
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
              isSelectedDateToday
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}>
              {isSelectedDateToday ? <Lock className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              {isSelectedDateToday ? 'Live Real-Time Data (Protected)' : 'Past Record (Editable)'}
            </span>

            {isSelectedDatePast && (
              <button
                onClick={() => {
                  const currWeek = quarterSchedule.find(s => s.sundayDate === selectedDate)?.weekNumber || 1;
                  handleOpenPastDataModal('SUNDAY_SERVICE', selectedDate, currWeek);
                }}
                className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Input / Edit Past Data</span>
              </button>
            )}
          </div>

        </div>

      </div>

      {/* Archived Workers Executive Notice */}
      {workers.filter(w => w.status === 'ARCHIVED').length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black text-amber-950 uppercase tracking-wider">
                {workers.filter(w => w.status === 'ARCHIVED').length} Archived Worker Records
              </div>
              <p className="text-xs text-amber-900">
                Inactive workers (relocated, traveled abroad, transferred church) are automatically excluded from weekly ledgers, Sunday clock-in, and upcoming quarters.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('DIRECTORY')}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
          >
            <span>View Archived Workers</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TOP 3 WORKERS WITH HIGHEST PUNCTUALITY RATE (AFTER 12 WEEKS / ON SHARING & ADMONITION) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-black font-['Cinzel',serif] text-slate-900">
              Top 3 Punctuality Laureates ({activeQuarter.quarterName})
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-bold">
            Evaluated across 12 weeks for Preparatory Class & Sunday Service Separately
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 1. TOP 3 FOR THURSDAY PREPARATORY CLASS */}
          <div className="bg-white border-2 border-blue-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center font-bold">
                  <BookOpen className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">
                    Thursday Preparatory Class
                  </h3>
                  <span className="text-[10px] text-slate-500">
                    Highest Study Punctuality Rate
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-900 rounded-full text-[10px] font-bold border border-blue-200">
                12-Week Study
              </span>
            </div>

            <div className="space-y-2.5">
              {top3PrepClass.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs italic">
                  No preparatory class records available yet.
                </div>
              ) : (
                top3PrepClass.map((worker) => {
                  const isGold = worker.rank === 1;
                  const isSilver = worker.rank === 2;
                  return (
                    <div 
                      key={worker.workerId}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                        isGold 
                          ? 'bg-amber-50/80 border-amber-300' 
                          : isSilver 
                          ? 'bg-slate-50 border-slate-200' 
                          : 'bg-orange-50/60 border-orange-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                          isGold 
                            ? 'bg-amber-400 text-slate-950 shadow-xs' 
                            : isSilver 
                            ? 'bg-slate-300 text-slate-900' 
                            : 'bg-orange-300 text-orange-950'
                        }`}>
                          {isGold ? '🥇' : isSilver ? '🥈' : '🥉'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs sm:text-sm">
                            {worker.workerName}
                          </div>
                          <div className="text-[10px] text-slate-600">
                            <span className="font-semibold text-blue-900">{worker.department}</span> • {worker.onTimeCount} of {worker.attendedCount} sessions on-time
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-black font-mono text-slate-900">
                          {worker.punctualityRate}%
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase">
                          Punctuality
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 2. TOP 3 FOR SUNDAY MORNING SERVICE */}
          <div className="bg-white border-2 border-emerald-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">
                    Sunday Morning Service
                  </h3>
                  <span className="text-[10px] text-slate-500">
                    Highest Sunday Clock-In Punctuality
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-900 rounded-full text-[10px] font-bold border border-emerald-200">
                12-Week Sanctuary
              </span>
            </div>

            <div className="space-y-2.5">
              {top3SundayService.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs italic">
                  No Sunday service records available yet.
                </div>
              ) : (
                top3SundayService.map((worker) => {
                  const isGold = worker.rank === 1;
                  const isSilver = worker.rank === 2;
                  return (
                    <div 
                      key={worker.workerId}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                        isGold 
                          ? 'bg-amber-50/80 border-amber-300' 
                          : isSilver 
                          ? 'bg-slate-50 border-slate-200' 
                          : 'bg-emerald-50/60 border-emerald-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                          isGold 
                            ? 'bg-amber-400 text-slate-950 shadow-xs' 
                            : isSilver 
                            ? 'bg-slate-300 text-slate-900' 
                            : 'bg-emerald-300 text-emerald-950'
                        }`}>
                          {isGold ? '🥇' : isSilver ? '🥈' : '🥉'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs sm:text-sm">
                            {worker.workerName}
                          </div>
                          <div className="text-[10px] text-slate-600">
                            <span className="font-semibold text-emerald-900">{worker.department}</span> • {worker.onTimeCount} of {worker.attendedCount} services on-time
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-black font-mono text-slate-900">
                          {worker.punctualityRate}%
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase">
                          Punctuality
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 12-WEEK METRICS MATRIX (EVERY WEEK HAS TOTAL TURNOUT AND PUNCTUALITY RATE) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-900">
              Weekly Attendance & Punctuality Breakdown
            </span>
            <h2 className="text-xl font-black font-['Cinzel',serif] text-slate-900">
              12-Week Quarter Schedule & Performance
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-xl">
            Thursday Prep Date = Sunday Date - 3 Days
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-300">
              <tr>
                <th className="py-3 px-3">Week / Dates</th>
                <th className="py-3 px-3">Curriculum Topic</th>
                <th className="py-3 px-3 text-center">Sunday Turnout</th>
                <th className="py-3 px-3 text-center">Sunday Punctuality</th>
                <th className="py-3 px-3 text-center">Thursday Prep Turnout</th>
                <th className="py-3 px-3 text-center">Prep Punctuality</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {weeklyMetrics.map(item => {
                const isItemPast = item.sundayDate < todayStr;
                const isSelected = item.sundayDate === selectedDate;

                return (
                  <tr 
                    key={item.weekNumber} 
                    className={`transition hover:bg-slate-50 ${isSelected ? 'bg-amber-50/60 font-semibold' : ''}`}
                  >
                    
                    {/* Week / Dates */}
                    <td className="py-3.5 px-3">
                      <div className="font-black text-slate-900">
                        Week {item.weekNumber} {item.isSharingAdmonitionWeek ? '(Admonition)' : ''}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Sun: <strong>{item.sundayDate}</strong>
                      </div>
                      <div className="text-[10px] text-blue-800 font-mono">
                        Thu: <strong>{item.prepDate}</strong>
                      </div>
                    </td>

                    {/* Curriculum Topic */}
                    <td className="py-3.5 px-3 max-w-xs">
                      <div className="text-slate-800 font-medium line-clamp-2">
                        {item.topic}
                      </div>
                    </td>

                    {/* Sunday Turnout */}
                    <td className="py-3.5 px-3 text-center">
                      <div className="font-bold text-slate-900 font-mono text-sm">
                        {item.sundayTurnoutRate}%
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.sundayTurnoutCount} of {item.sundayTotalActive}
                      </div>
                    </td>

                    {/* Sunday Punctuality */}
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono border ${
                        item.sundayPunctualityRate >= 80 
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : item.sundayPunctualityRate >= 50
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {item.sundayPunctualityRate}%
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {item.sundayOnTimeCount} on-time
                      </div>
                    </td>

                    {/* Prep Turnout */}
                    <td className="py-3.5 px-3 text-center">
                      <div className="font-bold text-slate-900 font-mono text-sm">
                        {item.prepTurnoutRate}%
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.prepTurnoutCount} of {item.prepTotalActive}
                      </div>
                    </td>

                    {/* Prep Punctuality */}
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono border ${
                        item.prepPunctualityRate >= 80 
                          ? 'bg-blue-100 text-blue-900 border-blue-300'
                          : item.prepPunctualityRate >= 50
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {item.prepPunctualityRate}%
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {item.prepOnTimeCount} on-time
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedDate(item.sundayDate)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[10px] font-bold transition cursor-pointer"
                        >
                          View Day
                        </button>

                        {isItemPast && (
                          <button
                            onClick={() => handleOpenPastDataModal('SUNDAY_SERVICE', item.sundayDate, item.weekNumber)}
                            className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Input / Edit former attendance data"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit Past</span>
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* DEPARTMENTAL GROUPING MATRIX (EXCLUSIVE GROUPING BY DEPARTMENT ONLY) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-900">
              Departmental Turnout & Punctuality Breakdown
            </span>
            <h2 className="text-xl font-black font-['Cinzel',serif] text-slate-900">
              Department Directorate Summary ({selectedDate})
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-xl">
            {departmentBreakdown.length} Departments Registered
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departmentBreakdown.map(d => (
            <div 
              key={d.dept}
              onClick={() => setSelectedDept(selectedDept === d.dept ? 'ALL' : d.dept)}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer ${
                selectedDept === d.dept 
                  ? 'bg-blue-50 border-blue-900 shadow-md ring-2 ring-blue-900/20' 
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">
                  {d.dept}
                </h3>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded-md text-[10px] font-black">
                  {d.total} Workers
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 my-3 text-center">
                <div className="p-2 bg-slate-50 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Turnout</span>
                  <span className="text-base font-black text-slate-900 font-mono">{d.turnoutRate}%</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Punctuality</span>
                  <span className="text-base font-black text-emerald-800 font-mono">{d.punctualityRate}%</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 flex items-center justify-between pt-2 border-t border-slate-100">
                <span>Present: <strong className="text-emerald-700">{d.present}</strong></span>
                <span>Late: <strong className="text-amber-700">{d.late}</strong></span>
                <span>Absent: <strong className="text-rose-700">{d.absent}</strong></span>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* DETAILED WORKERS ROSTER TABLE FOR SELECTED DATE */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-xl font-black font-['Cinzel',serif] text-slate-900">
              Worker Attendance Records for {selectedDate}
            </h2>
            <p className="text-xs text-slate-500">
              Showing {filteredRoster.length} active workers {selectedDept !== 'ALL' ? `in ${selectedDept}` : 'across all departments'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search worker name..."
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-900 w-44 sm:w-56"
            />

            {/* Status Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {(['ALL', 'PRESENT', 'LATE', 'ABSENT'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition cursor-pointer ${
                    statusFilter === s 
                      ? 'bg-white text-slate-900 shadow-2xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-300">
              <tr>
                <th className="py-3 px-3">Worker Name</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Clock-In Time</th>
                <th className="py-3 px-3 text-center">Verification Method</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRoster.map(item => (
                <tr key={item.worker.id} className="hover:bg-slate-50 transition">
                  
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900 text-sm">
                      {item.worker.fullName}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {item.worker.phone}
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded font-bold text-[10px]">
                      {item.worker.department}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      item.status === 'PRESENT'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : item.status === 'LATE'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-rose-100 text-rose-900 border-rose-300'
                    }`}>
                      {item.status}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                    {item.clockInTime}
                  </td>

                  <td className="py-3 px-3 text-center">
                    <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {item.method === 'QR_SCAN' ? '📷 QR Verified' : item.method === 'PIN_VERIFIED' ? '🔢 PIN Verified' : item.method === 'MANUAL_OVERRIDE' ? '✏️ Past/Manual Entry' : '—'}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => onViewQrPass(item.worker)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[10px] font-bold transition cursor-pointer"
                    >
                      Pass Card
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* Manual Past Attendance Modal */}
      <ManualPastAttendanceModal
        isOpen={pastModalOpen}
        onClose={() => setPastModalOpen(false)}
        serviceType={pastModalServiceType}
        targetDate={pastModalDate}
        weekNumber={pastModalWeek}
        quarterName={activeQuarter.quarterName}
        workers={workers}
        sundayAttendance={sundayAttendance}
        prepAttendance={prepAttendance}
        onSaveSundayAttendance={onSaveSundayAttendance}
        onSavePrepAttendance={onSavePrepAttendance}
      />

    </div>
  );
};
