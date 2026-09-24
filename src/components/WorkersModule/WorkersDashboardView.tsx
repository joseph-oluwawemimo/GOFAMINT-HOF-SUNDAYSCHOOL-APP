import React, { useMemo, useState } from 'react';
import {
  WorkerProfile, WorkerAttendanceRecord, WorkerPrepAttendanceRecord,
  ClockInConfig, SundaySchoolYear, QuarterNumber
} from '../../types';
import {
  BarChart3, Users, Clock, CheckCircle2, Download, Printer,
  Trophy, Edit3, ChevronRight, BookOpen, QrCode, Search, SlidersHorizontal
} from 'lucide-react';
import {
  computeQuarterWeeklyMetrics, computeTop3PunctualityHonors,
  formatDateDisplay, getQuarterWeeklySchedule
} from '../../utils/quarterScheduleUtils';
import { ManualPastAttendanceModal } from './ManualPastAttendanceModal';

type DashboardMode = 'DASHBOARD' | 'INSPECTION';
type SessionType = 'SUNDAY' | 'THURSDAY';

interface WorkersDashboardViewProps {
  workers: WorkerProfile[];
  sundayAttendance: WorkerAttendanceRecord[];
  prepAttendance: WorkerPrepAttendanceRecord[];
  departmentsList: string[];
  config: ClockInConfig;
  sundaySchoolYear: SundaySchoolYear;
  viewMode?: DashboardMode;
  onNavigateToTab: (tab: any) => void;
  onViewQrPass: (worker: WorkerProfile) => void;
  onSaveSundayAttendance: (records: WorkerAttendanceRecord[]) => Promise<void>;
  onSavePrepAttendance: (records: WorkerPrepAttendanceRecord[]) => Promise<void>;
}

const sessionLabel: Record<SessionType, string> = {
  SUNDAY: 'Sunday morning service',
  THURSDAY: 'Thursday preparatory class'
};

const safeCsvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const WorkersDashboardView: React.FC<WorkersDashboardViewProps> = ({
  workers, sundayAttendance, prepAttendance, departmentsList, config,
  sundaySchoolYear, viewMode = 'DASHBOARD', onNavigateToTab, onViewQrPass,
  onSaveSundayAttendance, onSavePrepAttendance
}) => {
  const isInspectionMode = viewMode === 'INSPECTION';
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedQuarterNumber, setSelectedQuarterNumber] = useState<QuarterNumber>(sundaySchoolYear.activeQuarterNumber || 1);
  const activeQuarter = useMemo(
    () => sundaySchoolYear.quarters.find(q => q.quarterNumber === selectedQuarterNumber) || sundaySchoolYear.quarters[0],
    [sundaySchoolYear, selectedQuarterNumber]
  );
  const quarterSchedule = useMemo(() => getQuarterWeeklySchedule(activeQuarter), [activeQuarter]);
  const activeWorkers = useMemo(() => workers.filter(worker => worker.status === 'ACTIVE'), [workers]);
  const weeklyMetrics = useMemo(
    () => computeQuarterWeeklyMetrics(quarterSchedule, activeWorkers, sundayAttendance, prepAttendance),
    [quarterSchedule, activeWorkers, sundayAttendance, prepAttendance]
  );
  const { top3PrepClass, top3SundayService } = useMemo(
    () => computeTop3PunctualityHonors(activeWorkers, quarterSchedule, sundayAttendance, prepAttendance),
    [activeWorkers, quarterSchedule, sundayAttendance, prepAttendance]
  );

  const initialWeek = useMemo(() => {
    const completed = quarterSchedule.filter(item => item.sundayDate <= todayStr || item.prepDate <= todayStr);
    return completed[completed.length - 1]?.weekNumber || quarterSchedule[0]?.weekNumber || 1;
  }, [quarterSchedule, todayStr]);
  const [summaryWeek, setSummaryWeek] = useState(initialWeek);
  const [inspectionWeek, setInspectionWeek] = useState(initialWeek);
  const [inspectionSession, setInspectionSession] = useState<SessionType>(() => new Date().getDay() === 4 ? 'THURSDAY' : 'SUNDAY');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'LATE' | 'ABSENT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [pastModalOpen, setPastModalOpen] = useState(false);

  // The executive pulse deliberately follows the latest real record. On a service
  // day with no arrivals yet, the previous service remains visible until clock-in starts.
  const latestSession = useMemo(() => {
    const sessions = [
      ...sundayAttendance
        .filter(record => record.status === 'PRESENT' || record.status === 'LATE' || record.isLate)
        .map(record => ({
        type: 'SUNDAY' as SessionType,
        date: record.serviceDate,
        timestamp: record.timestamp || new Date(`${record.serviceDate}T12:00:00`).getTime()
      })),
      ...prepAttendance
        .filter(record => record.status === 'PRESENT' || record.status === 'LATE')
        .map(record => ({
        type: 'THURSDAY' as SessionType,
        date: record.prepDate,
        timestamp: new Date(`${record.prepDate}T12:00:00`).getTime()
      }))
    ].filter(session => session.date <= todayStr).sort((a, b) => b.timestamp - a.timestamp);
    return sessions[0] || { type: 'SUNDAY' as SessionType, date: config.serviceDate || todayStr, timestamp: Date.now() };
  }, [sundayAttendance, prepAttendance, config.serviceDate, todayStr]);

  const pulseMetrics = useMemo(() => {
    const map = new Map<string, 'PRESENT' | 'LATE'>();
    if (latestSession.type === 'SUNDAY') {
      sundayAttendance.filter(record => record.serviceDate === latestSession.date).forEach(record => {
        if (record.status === 'PRESENT' || record.status === 'LATE') {
          map.set(record.workerId, record.status === 'LATE' || record.isLate ? 'LATE' : 'PRESENT');
        }
      });
    } else {
      prepAttendance.filter(record => record.prepDate === latestSession.date).forEach(record => {
        if (record.status === 'PRESENT' || record.status === 'LATE') map.set(record.workerId, record.status);
      });
    }
    const present = Array.from(map.values()).filter(value => value === 'PRESENT').length;
    const late = Array.from(map.values()).filter(value => value === 'LATE').length;
    const clocked = present + late;
    const absent = Math.max(activeWorkers.length - clocked, 0);
    return {
      total: activeWorkers.length, present, late, clocked, absent,
      attendanceRate: activeWorkers.length ? Math.round((clocked / activeWorkers.length) * 100) : 0,
      punctualityRate: clocked ? Math.round((present / clocked) * 100) : 0
    };
  }, [latestSession, activeWorkers, sundayAttendance, prepAttendance]);

  const effectiveDepartments = useMemo(
    () => Array.from(new Set([...departmentsList, ...activeWorkers.map(worker => worker.department)])).filter(Boolean).sort(),
    [departmentsList, activeWorkers]
  );

  const summaryDepartments = useMemo(() => {
    const week = quarterSchedule.find(item => item.weekNumber === summaryWeek);
    if (!week) return [];
    const sundayMap = new Map<string, WorkerAttendanceRecord>(sundayAttendance.filter(r => r.serviceDate === week.sundayDate).map(r => [r.workerId, r]));
    const prepMap = new Map<string, WorkerPrepAttendanceRecord>(prepAttendance.filter(r => r.prepDate === week.prepDate).map(r => [r.workerId, r]));
    return effectiveDepartments.map(department => {
      const departmentWorkers = activeWorkers.filter(worker => worker.department === department);
      let attended = 0; let onTime = 0; let late = 0;
      departmentWorkers.forEach(worker => {
        const sunday = sundayMap.get(worker.id);
        const prep = prepMap.get(worker.id);
        if (sunday?.status === 'PRESENT' && !sunday.isLate) { attended += 1; onTime += 1; }
        if (sunday?.status === 'LATE' || sunday?.isLate) { attended += 1; late += 1; }
        if (prep?.status === 'PRESENT') { attended += 1; onTime += 1; }
        if (prep?.status === 'LATE') { attended += 1; late += 1; }
      });
      const possible = departmentWorkers.length * 2;
      return {
        department, workers: departmentWorkers.length, onTime, late,
        missed: Math.max(possible - attended, 0),
        turnoutRate: possible ? Math.round((attended / possible) * 100) : 0,
        punctualityRate: attended ? Math.round((onTime / attended) * 100) : 0
      };
    }).filter(item => item.workers > 0);
  }, [summaryWeek, quarterSchedule, sundayAttendance, prepAttendance, effectiveDepartments, activeWorkers]);

  const selectedSchedule = quarterSchedule.find(item => item.weekNumber === inspectionWeek) || quarterSchedule[0];
  const inspectionDate = inspectionSession === 'SUNDAY' ? selectedSchedule?.sundayDate || todayStr : selectedSchedule?.prepDate || todayStr;

  const inspectionRoster = useMemo(() => {
    const sundayMap = new Map<string, WorkerAttendanceRecord>(sundayAttendance.filter(r => r.serviceDate === inspectionDate).map(r => [r.workerId, r]));
    const prepMap = new Map<string, WorkerPrepAttendanceRecord>(prepAttendance.filter(r => r.prepDate === inspectionDate).map(r => [r.workerId, r]));
    return activeWorkers.map(worker => {
      const sunday = sundayMap.get(worker.id);
      const prep = prepMap.get(worker.id);
      const record = inspectionSession === 'SUNDAY' ? sunday : prep;
      const status: 'PRESENT' | 'LATE' | 'ABSENT' = record?.status === 'LATE' ? 'LATE' : record?.status === 'PRESENT' ? 'PRESENT' : 'ABSENT';
      return {
        worker, status,
        clockInTime: inspectionSession === 'SUNDAY' ? sunday?.clockInTime : prep?.clockInTime,
        method: inspectionSession === 'SUNDAY' ? sunday?.method : prep?.clockInMethod
      };
    });
  }, [activeWorkers, sundayAttendance, prepAttendance, inspectionDate, inspectionSession]);

  const filteredInspectionRoster = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return inspectionRoster.filter(item => (
      (selectedDept === 'ALL' || item.worker.department === selectedDept) &&
      (statusFilter === 'ALL' || item.status === statusFilter) &&
      (!query || item.worker.fullName.toLowerCase().includes(query) || item.worker.department.toLowerCase().includes(query))
    ));
  }, [inspectionRoster, selectedDept, statusFilter, searchQuery]);

  const inspectionStats = useMemo(() => {
    const present = inspectionRoster.filter(item => item.status === 'PRESENT').length;
    const late = inspectionRoster.filter(item => item.status === 'LATE').length;
    const absent = inspectionRoster.filter(item => item.status === 'ABSENT').length;
    const turnout = present + late;
    return {
      present, late, absent, turnout,
      turnoutRate: inspectionRoster.length ? Math.round((turnout / inspectionRoster.length) * 100) : 0,
      punctualityRate: turnout ? Math.round((present / turnout) * 100) : 0
    };
  }, [inspectionRoster]);

  const chartWidth = 760; const chartHeight = 230; const plotTop = 22; const plotBottom = 184;
  const toPoints = (values: number[]) => values.map((value, index) => {
    const x = values.length <= 1 ? 40 : 40 + (index * (chartWidth - 80)) / (values.length - 1);
    const y = plotBottom - ((Math.max(0, Math.min(100, value)) / 100) * (plotBottom - plotTop));
    return `${x},${y}`;
  }).join(' ');
  const sundayTrend = toPoints(weeklyMetrics.map(metric => metric.sundayTurnoutRate));
  const prepTrend = toPoints(weeklyMetrics.map(metric => metric.prepTurnoutRate));

  const handleExportCsv = () => {
    const rows = filteredInspectionRoster.map(item => [
      item.worker.fullName, item.worker.department, inspectionDate, sessionLabel[inspectionSession],
      item.status, item.clockInTime || '', item.method || ''
    ]);
    const csv = [['Worker', 'Department', 'Date', 'Session', 'Status', 'Clock In', 'Method'], ...rows]
      .map(row => row.map(safeCsvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `GOFAMINT_HOF_Attendance_${inspectionSession}_${inspectionDate}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };

  const renderTrendChart = (title: string, eyebrow: string) => (
    <article className="overflow-hidden rounded-3xl bg-blue-950 p-4 text-white shadow-[0_18px_55px_rgba(7,30,72,0.22)] sm:p-6 xl:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">{eyebrow}</span><h3 className="mt-0.5 text-lg font-black">{title}</h3></div>
        <div className="flex items-center gap-4 text-[10px] font-bold text-blue-100"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-400" /> Sunday</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Thursday</span></div>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 sm:p-3">
        <svg role="img" aria-label="Sunday and Thursday attendance rates across the quarter" viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-[210px] w-full" preserveAspectRatio="none">
          {[0, 25, 50, 75, 100].map(rate => { const y = plotBottom - ((rate / 100) * (plotBottom - plotTop)); return <g key={rate}><line x1="40" x2="720" y1={y} y2={y} stroke="rgba(191,219,254,0.14)" strokeDasharray="4 7" /><text x="6" y={y + 4} fill="rgba(219,234,254,0.55)" fontSize="10">{rate}%</text></g>; })}
          <polyline points={sundayTrend} fill="none" stroke="#60a5fa" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={prepTrend} fill="none" stroke="#f87171" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {weeklyMetrics.map((metric, index) => { const x = weeklyMetrics.length <= 1 ? 40 : 40 + (index * (chartWidth - 80)) / (weeklyMetrics.length - 1); return <text key={metric.weekNumber} x={x} y="215" textAnchor="middle" fill="rgba(219,234,254,0.62)" fontSize="9">W{metric.weekNumber}</text>; })}
        </svg>
      </div>
    </article>
  );

  if (isInspectionMode) {
    return (
      <div className="workers-page workers-page-inspection space-y-5 pb-12 sm:space-y-7 animate-fade-in">
        <section className="workers-page-hero overflow-hidden rounded-3xl bg-blue-950 p-5 text-white shadow-[0_18px_55px_rgba(7,30,72,0.2)] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Reports & inspection</span>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Attendance Inspection</h1>
              <p className="mt-1 max-w-xl text-xs font-medium text-blue-100 sm:text-sm">Inspect one service, compare all 12 weeks, and export only when needed.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleExportCsv} className="flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-black text-blue-950 transition hover:bg-amber-300"><Download className="h-4 w-4" /> Export CSV</button>
              <button onClick={() => window.print()} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/20"><Printer className="h-4 w-4" /> Print</button>
            </div>
          </div>
          <div className="mt-6 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-blue-200">Quarter
              <select value={selectedQuarterNumber} onChange={event => { setSelectedQuarterNumber(Number(event.target.value) as QuarterNumber); setInspectionWeek(1); }} className="block min-h-11 w-full rounded-xl border border-white/10 bg-blue-900 px-3 text-xs font-bold text-white">
                {sundaySchoolYear.quarters.map(quarter => <option key={quarter.id} value={quarter.quarterNumber}>Q{quarter.quarterNumber} · {quarter.quarterName}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-blue-200">Week
              <select value={inspectionWeek} onChange={event => setInspectionWeek(Number(event.target.value))} className="block min-h-11 w-full rounded-xl border border-white/10 bg-blue-900 px-3 text-xs font-bold text-white">
                {quarterSchedule.map(item => <option key={item.weekNumber} value={item.weekNumber}>Week {item.weekNumber}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-blue-200">Session
              <select value={inspectionSession} onChange={event => setInspectionSession(event.target.value as SessionType)} className="block min-h-11 w-full rounded-xl border border-white/10 bg-blue-900 px-3 text-xs font-bold text-white">
                <option value="SUNDAY">Sunday service</option><option value="THURSDAY">Thursday class</option>
              </select>
            </label>
            <label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-blue-200">Department
              <select value={selectedDept} onChange={event => setSelectedDept(event.target.value)} className="block min-h-11 w-full rounded-xl border border-white/10 bg-blue-900 px-3 text-xs font-bold text-white">
                <option value="ALL">All departments</option>{effectiveDepartments.map(department => <option key={department}>{department}</option>)}
              </select>
            </label>
            <div className="flex items-end"><button disabled={inspectionDate >= todayStr} onClick={() => setPastModalOpen(true)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-3 text-xs font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"><Edit3 className="h-4 w-4" /> Edit past entry</button></div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Selected attendance statistics">
          {[
            ['Turnout', inspectionStats.turnout, `${inspectionStats.turnoutRate}% of active workers`, Users],
            ['On time', inspectionStats.present, `${inspectionStats.punctualityRate}% punctuality`, CheckCircle2],
            ['Late', inspectionStats.late, sessionLabel[inspectionSession], Clock],
            ['Absent', inspectionStats.absent, formatDateDisplay(inspectionDate, { showDayOfWeek: true }), BarChart3]
          ].map(([label, value, note, Icon]) => (
            <article key={String(label)} className="rounded-3xl border border-blue-100 bg-white p-4 shadow-[0_12px_35px_rgba(15,42,85,0.08)] sm:p-5">
              <div className="flex items-start justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{String(label)}</span><Icon className="h-4 w-4 text-blue-900" /></div>
              <strong className="mt-2 block text-2xl font-black text-blue-950">{String(value)}</strong><span className="mt-1 block text-[10px] font-semibold text-slate-400">{String(note)}</span>
            </article>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {renderTrendChart('12-week service comparison', activeQuarter.quarterName)}
          <article className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-red-600">Selected entry</span><h2 className="mt-1 text-lg font-black text-blue-950">{sessionLabel[inspectionSession]}</h2><p className="mt-1 text-xs font-bold text-slate-500">{formatDateDisplay(inspectionDate, { showDayOfWeek: true })}</p>
            <div className="mt-6 flex justify-center"><div className="relative flex h-36 w-36 items-center justify-center rounded-full" style={{ background: `conic-gradient(#163f8f 0 ${inspectionStats.turnoutRate}%, #e2e8f0 ${inspectionStats.turnoutRate}% 100%)` }}><div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white"><strong className="text-3xl font-black text-blue-950">{inspectionStats.turnoutRate}%</strong><span className="text-[9px] font-black uppercase text-slate-400">Turnout</span></div></div></div>
          </article>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><span className="text-[10px] font-black uppercase tracking-wider text-blue-900">Quarter performance</span><h2 className="text-xl font-black text-slate-900">12-week attendance breakdown</h2></div><span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">Sunday + Thursday</span></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-amber-300"><tr><th className="px-4 py-3">Week / Dates</th><th className="px-4 py-3">Topic</th><th className="px-4 py-3 text-center">Sunday turnout</th><th className="px-4 py-3 text-center">Sunday punctuality</th><th className="px-4 py-3 text-center">Thursday turnout</th><th className="px-4 py-3 text-center">Thursday punctuality</th></tr></thead><tbody className="divide-y divide-slate-100">
            {weeklyMetrics.map(metric => <tr key={metric.weekNumber} className={metric.weekNumber === inspectionWeek ? 'bg-amber-50' : 'hover:bg-slate-50'}><td className="px-4 py-3"><strong className="block text-slate-900">Week {metric.weekNumber}</strong><span className="block font-mono text-[10px] text-slate-500">Sun {metric.sundayDate}</span><span className="block font-mono text-[10px] text-blue-800">Thu {metric.prepDate}</span></td><td className="max-w-xs px-4 py-3 font-semibold text-slate-700">{metric.topic}</td><td className="px-4 py-3 text-center font-black text-blue-950">{metric.sundayTurnoutRate}%<span className="block text-[9px] font-semibold text-slate-400">{metric.sundayTurnoutCount}/{metric.sundayTotalActive}</span></td><td className="px-4 py-3 text-center font-black text-emerald-700">{metric.sundayPunctualityRate}%</td><td className="px-4 py-3 text-center font-black text-blue-950">{metric.prepTurnoutRate}%<span className="block text-[9px] font-semibold text-slate-400">{metric.prepTurnoutCount}/{metric.prepTotalActive}</span></td><td className="px-4 py-3 text-center font-black text-red-600">{metric.prepPunctualityRate}%</td></tr>)}
          </tbody></table></div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-3 border-b border-slate-100 p-5"><div className="flex items-center gap-2"><Search className="h-4 w-4 text-blue-900" /><div><span className="text-[10px] font-black uppercase tracking-wider text-blue-900">Detailed inspection</span><h2 className="text-xl font-black text-slate-900">Worker attendance records</h2></div></div><div className="grid gap-2 sm:grid-cols-[1fr_auto]"><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search worker or department" className="min-h-11 rounded-xl border border-slate-300 px-3 text-xs font-bold outline-none focus:border-blue-900" /><div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">{(['ALL', 'PRESENT', 'LATE', 'ABSENT'] as const).map(status => <button key={status} onClick={() => setStatusFilter(status)} className={`min-h-9 rounded-lg px-2 text-[10px] font-black ${statusFilter === status ? 'bg-blue-900 text-white' : 'text-slate-600'}`}>{status}</button>)}</div></div></div>
          <div className="divide-y divide-slate-100 md:hidden">{filteredInspectionRoster.map(item => <div key={item.worker.id} className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><strong className="block truncate text-sm text-slate-900">{item.worker.fullName}</strong><span className="block truncate text-[10px] font-semibold text-slate-500">{item.worker.department} · {item.clockInTime || 'No clock-in'}</span></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${item.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' : item.status === 'LATE' ? 'bg-amber-100 text-amber-800' : 'bg-red-50 text-red-700'}`}>{item.status}</span></div>)}</div>
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-600"><tr><th className="px-4 py-3">Worker</th><th className="px-4 py-3">Department</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3">Clock-in</th><th className="px-4 py-3">Method</th><th className="px-4 py-3 text-right">Pass</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredInspectionRoster.map(item => <tr key={item.worker.id}><td className="px-4 py-3 font-bold text-slate-900">{item.worker.fullName}</td><td className="px-4 py-3 text-slate-600">{item.worker.department}</td><td className="px-4 py-3 text-center font-black">{item.status}</td><td className="px-4 py-3 font-mono">{item.clockInTime || '—'}</td><td className="px-4 py-3">{item.method || '—'}</td><td className="px-4 py-3 text-right"><button onClick={() => onViewQrPass(item.worker)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold hover:bg-slate-200">Pass card</button></td></tr>)}</tbody></table></div>
        </section>

        <ManualPastAttendanceModal isOpen={pastModalOpen} onClose={() => setPastModalOpen(false)} serviceType={inspectionSession === 'SUNDAY' ? 'SUNDAY_SERVICE' : 'PREP_CLASS'} targetDate={inspectionDate} weekNumber={inspectionWeek} quarterName={activeQuarter.quarterName} workers={workers} sundayAttendance={sundayAttendance} prepAttendance={prepAttendance} onSaveSundayAttendance={onSaveSundayAttendance} onSavePrepAttendance={onSavePrepAttendance} />
      </div>
    );
  }

  return (
    <div className="workers-page workers-page-dashboard space-y-5 pb-12 sm:space-y-7 animate-fade-in">
      <section className="workers-page-hero relative overflow-hidden rounded-3xl bg-blue-950 p-5 text-white shadow-[0_18px_55px_rgba(7,30,72,0.2)] sm:p-7">
        <span className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[34px] border-red-500/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Executive Directorate</span><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Workers Command Centre</h1><p className="mt-1 max-w-xl text-xs font-medium text-blue-100 sm:text-sm">Today’s workforce pulse and the decisions that need attention.</p></div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button onClick={() => onNavigateToTab('SUNDAY_CLOCK_IN')} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black text-blue-950 shadow-lg transition hover:bg-blue-50"><QrCode className="h-4 w-4 text-red-600" /> Sunday clock-in</button>
            <button onClick={() => onNavigateToTab('PREP_ATTENDANCE')} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-xs font-black text-white shadow-lg transition hover:bg-red-500"><BookOpen className="h-4 w-4 text-amber-300" /> Thursday clock-in</button>
          </div>
        </div>
      </section>

      <section aria-labelledby="workers-executive-pulse" className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600">Live command centre</span><h2 id="workers-executive-pulse" className="text-xl font-black tracking-tight text-blue-950 sm:text-2xl">Workforce pulse</h2></div><span className="text-[11px] font-bold text-slate-500">Latest entry · {sessionLabel[latestSession.type]} · {formatDateDisplay(latestSession.date, { showDayOfWeek: true })}</span></div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: 'Active workers', value: pulseMetrics.total, note: 'Current duty roster', icon: Users, tone: 'blue' },
            { label: 'Clocked in', value: pulseMetrics.clocked, note: `${pulseMetrics.present} on time · ${pulseMetrics.late} late`, icon: CheckCircle2, tone: 'navy' },
            { label: 'Attendance rate', value: `${pulseMetrics.attendanceRate}%`, note: `${pulseMetrics.absent} require follow-up`, icon: BarChart3, tone: 'red' },
            { label: 'Punctuality', value: `${pulseMetrics.punctualityRate}%`, note: 'Of recorded arrivals', icon: Clock, tone: 'gold' }
          ].map(metric => {
            const Icon = metric.icon;
            const tone = metric.tone === 'red' ? 'bg-red-50 text-red-700' : metric.tone === 'gold' ? 'bg-amber-50 text-amber-700' : metric.tone === 'navy' ? 'bg-blue-950 text-white' : 'bg-blue-50 text-blue-800';
            return <article key={metric.label} className="relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-4 shadow-[0_14px_40px_rgba(15,42,85,0.08)] sm:p-5"><span className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-blue-900 via-red-600 to-amber-400" /><div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{metric.label}</span><strong className="mt-2 block text-2xl font-black tracking-tight text-blue-950 sm:text-3xl">{metric.value}</strong><span className="mt-1 block text-[10px] font-semibold text-slate-400">{metric.note}</span></div><span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-4 w-4" /></span></div></article>;
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {renderTrendChart('12-week turnout trend', 'Quarter attendance analytics')}
          <article className="rounded-3xl border border-blue-100 bg-white p-5 shadow-[0_14px_40px_rgba(15,42,85,0.08)] sm:p-6">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-red-600">Latest recorded session</span><h3 className="mt-1 text-lg font-black text-blue-950">Attendance composition</h3><p className="mt-1 text-[10px] font-bold text-slate-400">{sessionLabel[latestSession.type]} · {formatDateDisplay(latestSession.date)}</p>
            <div className="mt-6 flex items-center gap-5"><div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#163f8f 0 ${pulseMetrics.attendanceRate}%, #dc2626 ${pulseMetrics.attendanceRate}% 100%)` }}><div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white"><strong className="text-2xl font-black text-blue-950">{pulseMetrics.attendanceRate}%</strong><span className="text-[9px] font-black uppercase text-slate-400">Turnout</span></div></div><div className="min-w-0 flex-1 space-y-3">{[['On time', pulseMetrics.present, 'bg-blue-900'], ['Late', pulseMetrics.late, 'bg-amber-400'], ['Absent', pulseMetrics.absent, 'bg-red-600']].map(([label, value, color]) => <div key={String(label)}><div className="flex justify-between text-[10px] font-bold"><span className="text-slate-500">{String(label)}</span><strong className="text-blue-950">{String(value)}</strong></div><div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className={`h-full rounded-full ${String(color)}`} style={{ width: `${pulseMetrics.total ? Math.round((Number(value) / pulseMetrics.total) * 100) : 0}%` }} /></div></div>)}</div></div>
            <button onClick={() => onNavigateToTab('INSPECTION')} className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-xs font-black text-white transition hover:bg-red-500">Inspect attendance <ChevronRight className="h-4 w-4" /></button>
          </article>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><span className="text-[10px] font-black uppercase tracking-wider text-blue-900">Departmental directorate summary</span><h2 className="text-xl font-black text-slate-900">Week {summaryWeek} performance</h2></div><div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" aria-label="Select summary week">{quarterSchedule.slice(0, 12).map(item => <button key={item.weekNumber} onClick={() => setSummaryWeek(item.weekNumber)} className={`h-8 min-w-8 rounded-lg text-[10px] font-black ${summaryWeek === item.weekNumber ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}>{item.weekNumber}</button>)}</div></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{summaryDepartments.map(item => <article key={item.department} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-black text-slate-900">{item.department}</h3><span className="text-[10px] font-semibold text-slate-400">{item.workers} workers · 2 sessions</span></div><strong className="rounded-xl bg-blue-900 px-2.5 py-1 text-xs text-white">{item.turnoutRate}%</strong></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white p-2"><strong className="block text-sm text-emerald-700">{item.onTime}</strong><span className="text-[8px] font-black uppercase text-slate-400">On time</span></div><div className="rounded-xl bg-white p-2"><strong className="block text-sm text-amber-600">{item.late}</strong><span className="text-[8px] font-black uppercase text-slate-400">Late</span></div><div className="rounded-xl bg-white p-2"><strong className="block text-sm text-red-600">{item.missed}</strong><span className="text-[8px] font-black uppercase text-slate-400">Missed</span></div></div><div className="mt-3 flex justify-between text-[10px] font-bold text-slate-500"><span>Punctuality</span><span className="text-blue-950">{item.punctualityRate}%</span></div><div className="mt-1 h-1.5 rounded-full bg-slate-200"><div className="h-full rounded-full bg-linear-to-r from-blue-900 to-red-500" style={{ width: `${item.punctualityRate}%` }} /></div></article>)}</div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3"><div className="flex items-center gap-2.5"><Trophy className="h-5 w-5 text-amber-500" /><div><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current quarter</span><h2 className="text-xl font-black text-slate-900">Punctuality leaders</h2></div></div><span className="hidden text-xs font-bold text-slate-500 sm:block">First place in each service</span></div>
        <div className="grid gap-4 lg:grid-cols-2">{[
          { title: 'Thursday preparatory class', icon: BookOpen, leader: top3PrepClass[0], color: 'blue' },
          { title: 'Sunday morning service', icon: Clock, leader: top3SundayService[0], color: 'red' }
        ].map(item => { const Icon = item.icon; return <article key={item.title} className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.color === 'red' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-900'}`}><Icon className="h-5 w-5" /></span><div><span className="text-[9px] font-black uppercase tracking-wider text-amber-600">Leading worker</span><h3 className="text-sm font-black text-slate-900">{item.title}</h3></div></div>{item.leader ? <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-lg">🥇</span><div className="min-w-0"><strong className="block truncate text-sm text-slate-900">{item.leader.workerName}</strong><span className="block truncate text-[10px] font-semibold text-slate-500">{item.leader.department} · {item.leader.onTimeCount}/{item.leader.attendedCount} on time</span></div></div><div className="text-right"><strong className="block text-xl font-black text-blue-950">{item.leader.punctualityRate}%</strong><span className="text-[8px] font-black uppercase text-slate-400">Punctuality</span></div></div> : <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-center text-xs font-semibold text-slate-400">No attendance records yet.</div>}</article>; })}</div>
      </section>

      <button onClick={() => onNavigateToTab('INSPECTION')} className="flex w-full items-center justify-between rounded-3xl border border-blue-100 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"><span className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-950 text-amber-300"><SlidersHorizontal className="h-5 w-5" /></span><span><strong className="block text-sm text-blue-950">Open attendance inspection</strong><span className="block text-[10px] font-semibold text-slate-500">Date filters, 12-week breakdown, worker records and exports</span></span></span><ChevronRight className="h-5 w-5 text-red-600" /></button>
    </div>
  );
};
