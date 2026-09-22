import React, { useState, useMemo } from 'react';
import { 
  WorkerProfile, 
  WorkerPrepAttendanceRecord, 
  WorkerAttendanceRecord,
  PrepAttendanceStatus,
  SundaySchoolYear,
  QuarterNumber,
  ClockInConfig
} from '../../types';
import { 
  Calendar, Check, X, Clock, Filter, 
  Download, Printer, Sparkles, BookOpen, UserCheck, Search, 
  CheckCircle2, Lock, Edit3, ChevronRight, Layers, Award,
  QrCode, AlertCircle, ShieldCheck, Settings
} from 'lucide-react';
import { 
  getQuarterWeeklySchedule, 
  computeQuarterWeeklyMetrics,
  getAttendanceSecurityState
} from '../../utils/quarterScheduleUtils';
import { ThursdayClockInTerminalModal } from './ThursdayClockInTerminalModal';
import { ClockInScheduleSettingsModal } from './ClockInScheduleSettingsModal';

interface PreparatoryAttendanceViewProps {
  workers: WorkerProfile[];
  prepRecords: WorkerPrepAttendanceRecord[];
  departmentsList: string[];
  config: ClockInConfig;
  sundaySchoolYear: SundaySchoolYear;
  onSavePrepRecord: (record: WorkerPrepAttendanceRecord) => Promise<void>;
  onSaveBulkPrepRecords: (records: WorkerPrepAttendanceRecord[]) => Promise<void>;
  onUpdateConfig?: (config: ClockInConfig) => Promise<void>;
  onUpdateWorkerProfile?: (worker: WorkerProfile) => Promise<void>;
  onNavigateToTab?: (tab: any) => void;
  // Optional compatibility props
  sundayAttendance?: WorkerAttendanceRecord[];
  onSaveSundayRecord?: (record: WorkerAttendanceRecord) => Promise<void>;
  onSaveBulkSundayRecords?: (records: WorkerAttendanceRecord[]) => Promise<void>;
}

export const PreparatoryAttendanceView: React.FC<PreparatoryAttendanceViewProps> = ({
  workers,
  prepRecords,
  departmentsList,
  config,
  sundaySchoolYear,
  onSavePrepRecord,
  onSaveBulkPrepRecords,
  onUpdateConfig,
  onUpdateWorkerProfile,
  onNavigateToTab
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [showThursdayTerminal, setShowThursdayTerminal] = useState<boolean>(false);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);

  // Quarter selection (Synced with General Executive)
  const [selectedQuarterNumber, setSelectedQuarterNumber] = useState<QuarterNumber>(
    sundaySchoolYear.activeQuarterNumber || 1
  );

  const activeQuarter = useMemo(() => {
    return sundaySchoolYear.quarters.find(q => q.quarterNumber === selectedQuarterNumber) || sundaySchoolYear.quarters[0];
  }, [sundaySchoolYear, selectedQuarterNumber]);

  // Quarter Weekly Schedule
  const quarterSchedule = useMemo(() => {
    return getQuarterWeeklySchedule(activeQuarter);
  }, [activeQuarter]);

  // Selected week (1 to 13)
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  // Active week info
  const activeWeekInfo = useMemo(() => {
    return quarterSchedule.find(s => s.weekNumber === selectedWeek) || quarterSchedule[0];
  }, [quarterSchedule, selectedWeek]);

  // Target Prep Date
  const targetPrepDate = activeWeekInfo?.prepDate || todayStr;
  const isTargetDatePast = targetPrepDate < todayStr;
  const isTargetDateToday = targetPrepDate === todayStr;
  const isTargetDateFuture = targetPrepDate > todayStr;

  const securityState = useMemo(() => {
    return getAttendanceSecurityState(
      targetPrepDate,
      config.thursdayOpenTime || '16:00',
      config.thursdayCloseTime || '19:00',
      new Date()
    );
  }, [targetPrepDate, config]);

  // Filters
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [markedByName, setMarkedByName] = useState<string>('Workers Coordinator');

  // Filter workers based on search and department
  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      if (w.status !== 'ACTIVE') return false;
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch = 
        (w.fullName || '').toLowerCase().includes(q) ||
        (w.phone || '').includes(searchQuery || '') ||
        (w.department || '').toLowerCase().includes(q);
      const matchesDept = selectedDept === 'ALL' || w.department === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [workers, searchQuery, selectedDept]);

  // Thursday Prep Map (workerId -> WorkerPrepAttendanceRecord)
  const prepAttendanceMap = useMemo(() => {
    const map = new Map<string, WorkerPrepAttendanceRecord>();
    prepRecords
      .filter(r => r.prepDate === targetPrepDate)
      .forEach(r => {
        map.set(r.workerId, r);
      });
    return map;
  }, [prepRecords, targetPrepDate]);

  // Compute stats for Thursday Prep
  const stats = useMemo(() => {
    let present = 0;
    let late = 0;
    let excused = 0;
    let absent = 0;

    filteredWorkers.forEach(w => {
      const rec = prepAttendanceMap.get(w.id);
      const status = rec ? rec.status : 'ABSENT';
      if (status === 'PRESENT') present++;
      else if (status === 'LATE') late++;
      else if (status === 'EXCUSED') excused++;
      else absent++;
    });

    const total = filteredWorkers.length;
    const turnoutCount = present + late;
    const turnoutRate = total > 0 ? Math.round((turnoutCount / total) * 100) : 0;
    const punctualityRate = turnoutCount > 0 ? Math.round((present / turnoutCount) * 100) : 0;

    return { total, present, late, excused, absent, turnoutCount, turnoutRate, punctualityRate };
  }, [filteredWorkers, prepAttendanceMap]);

  // Thursday status update
  const handleSetPrepStatus = async (worker: WorkerProfile, status: PrepAttendanceStatus) => {
    if (!securityState.manualAttendanceAllowed) {
      alert(`Manual attendance is locked: ${securityState.reason}`);
      return;
    }
    const existing = prepAttendanceMap.get(worker.id);
    const newRecord: WorkerPrepAttendanceRecord = {
      id: `${worker.id}_prep_${targetPrepDate}`,
      workerId: worker.id,
      workerName: worker.fullName,
      department: worker.department,
      prepDate: targetPrepDate,
      sessionTitle: `Thursday Preparatory Class - Week ${selectedWeek}`,
      weekNumber: selectedWeek,
      status,
      syllabusPrepared: existing?.syllabusPrepared ?? true,
      clockInTime: existing?.clockInTime || (status === 'PRESENT' || status === 'LATE' ? '18:00 (Manual)' : undefined),
      markedBy: markedByName,
      notes: existing?.notes,
      updatedAt: new Date().toISOString()
    };
    await onSavePrepRecord(newRecord);
  };

  // Mark all visible workers as PRESENT for Thursday
  const handleMarkAllVisiblePrepPresent = async () => {
    if (!securityState.manualAttendanceAllowed) {
      alert(`Manual attendance is locked: ${securityState.reason}`);
      return;
    }
    const recordsToSave: WorkerPrepAttendanceRecord[] = filteredWorkers.map(w => {
      const existing = prepAttendanceMap.get(w.id);
      return {
        id: `${w.id}_prep_${targetPrepDate}`,
        workerId: w.id,
        workerName: w.fullName,
        department: w.department,
        prepDate: targetPrepDate,
        sessionTitle: `Thursday Preparatory Class - Week ${selectedWeek}`,
        weekNumber: selectedWeek,
        status: 'PRESENT',
        syllabusPrepared: existing?.syllabusPrepared ?? true,
        clockInTime: existing?.clockInTime || '18:00 (Bulk Manual)',
        markedBy: markedByName,
        updatedAt: new Date().toISOString()
      };
    });

    await onSaveBulkPrepRecords(recordsToSave);
  };

  // Export CSV Handler
  const handleExportCsv = () => {
    const headers = ['Worker Full Name', 'Department', 'Phone', 'Prep Date', 'Week', 'Topic', 'Thursday Status', 'Clock-In Time', 'Marked By'];
    const rows = filteredWorkers.map(w => {
      const rec = prepAttendanceMap.get(w.id);
      return [
        `"${w.fullName}"`,
        `"${w.department}"`,
        `"${w.phone || '-'}"`,
        `"${targetPrepDate}"`,
        `"Week ${selectedWeek}"`,
        `"${activeWeekInfo?.topic || '-'}"`,
        `"${rec ? rec.status : 'ABSENT'}"`,
        `"${rec?.clockInTime || '-'}"`,
        `"${rec?.markedBy || markedByName}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GOFAMINT_HOF_Thursday_Prep_Week_${selectedWeek}_${targetPrepDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* 1. TOP HEADER BANNER (Complaint 2: Pure Thursday Preparatory Class) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 rounded-full text-xs font-black uppercase tracking-wider">
              Study & Preparation
            </span>
            <span className="text-slate-300 font-bold">•</span>
            <span className="text-xs text-slate-700 font-bold">
              Thursday Ministerial Preparatory Class
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-['Cinzel',serif] tracking-tight mt-1">
            Thursday Preparatory Class Register & Terminal
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mt-1">
            Independent Thursday Preparatory Class study tracking, syllabus preparation verification, and strict clock-in terminal window management.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowThursdayTerminal(true)}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-amber-300" />
            <span>Launch Thursday Terminal</span>
          </button>

          {securityState.isFuture ? (
            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <span>Future Date Locked</span>
            </div>
          ) : isTargetDatePast ? (
            <button
              onClick={handleMarkAllVisiblePrepPresent}
              className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-300" />
              <span>Mark All Filtered Present</span>
            </button>
          ) : (
            <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Live Mode (Terminal Protected)</span>
            </div>
          )}

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            title="Print Attendance Register"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. ADJUST SCHEDULE BAR (Complaint 3) */}
      <div className="bg-white border-2 border-amber-200/80 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-amber-500/10 text-amber-700 rounded-2xl border border-amber-500/30">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Thursday Preparatory Schedule Window
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase">
                Active Policy
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 mt-1 font-semibold">
              <span>Terminal Window: <strong className="text-slate-900 font-mono">{config.thursdayOpenTime || '16:00'} – {config.thursdayCloseTime || '19:00'}</strong></span>
              <span>•</span>
              <span>Meeting Starts: <strong className="text-slate-900 font-mono">{config.thursdayMeetingStartTime || '18:00'}</strong></span>
              <span>•</span>
              <span>Late Cutoff: <strong className="text-amber-700 font-mono font-black">{config.thursdayLateCutoffTime || '18:15'}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {onUpdateConfig && (
            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-black rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-xs"
            >
              <Settings className="w-4 h-4" />
              <span>Adjust Schedule</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. GENERAL EXECUTIVE QUARTER SYNC & 12-WEEK SELECTOR (Complaint 4: Thursday's own 12-Week bar) */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border-2 border-slate-800 space-y-4">
        
        {/* Quarter Select Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                Thursday Executive 12-Week Schedule Sync
              </span>
              <h2 className="text-lg font-black font-['Cinzel',serif] text-white">
                {activeQuarter.quarterName}: {activeQuarter.quarterTheme || 'Kingdom Study & Ministry Service'}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sundaySchoolYear.quarters.map(q => {
              const isSelected = q.quarterNumber === selectedQuarterNumber;
              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setSelectedQuarterNumber(q.quarterNumber);
                    setSelectedWeek(1);
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

        {/* Thursday 12-Week Tabs Horizontal Scroller */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">
              Select Thursday Evaluation Week (Week 1–{quarterSchedule.length}):
            </span>
            <span className="text-[11px] text-amber-300 font-mono">
              Thursday Prep Date: {targetPrepDate}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {quarterSchedule.map(item => {
              const isSelected = item.weekNumber === selectedWeek;
              return (
                <button
                  key={item.weekNumber}
                  onClick={() => setSelectedWeek(item.weekNumber)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition flex flex-col items-center cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md ring-2 ring-amber-400'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span className="font-black text-xs">
                    {item.isSharingAdmonitionWeek ? `Week ${item.weekNumber} (Admonition)` : `Week ${item.weekNumber}`}
                  </span>
                  <span className="text-[9px] opacity-80 font-mono mt-0.5">
                    Thu: {item.prepDate.slice(5)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lesson Topic & Punctuality Banner */}
        <div className="bg-slate-800/90 rounded-2xl p-3 sm:p-4 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Thursday Preparatory Session (Week {selectedWeek}):
            </span>
            <div className="text-sm font-bold text-white line-clamp-1">
              {activeWeekInfo?.topic || `Lesson ${selectedWeek}`}
            </div>
            <span className="text-[11px] text-amber-300 font-mono">
              Date: {targetPrepDate} ({isTargetDatePast ? 'Past Date' : isTargetDateToday ? 'Today' : 'Future Date'})
            </span>
          </div>

          <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-slate-700 pt-2 sm:pt-0 sm:pl-4 shrink-0">
            <div className="text-center sm:text-right">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Turnout Rate</span>
              <span className="text-base font-black text-white font-mono">{stats.turnoutRate}%</span>
            </div>
            <div className="text-center sm:text-right">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Punctuality</span>
              <span className="text-base font-black text-emerald-400 font-mono">{stats.punctualityRate}%</span>
            </div>
          </div>
        </div>

      </div>

      {/* 4. FILTER AND METRICS ROW */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        
        {/* Department Filter & Search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <label className="font-bold text-slate-700">Department:</label>
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800 text-xs focus:outline-hidden focus:border-blue-900"
            >
              <option value="ALL">All Departments ({workers.filter(w => w.status === 'ACTIVE').length})</option>
              {departmentsList.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search worker by name..."
            className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-900 w-48 sm:w-60"
          />
        </div>

        {/* 4 Summary Stat Pills */}
        <div className="flex items-center gap-2 text-xs">
          <div className="px-3 py-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl font-bold">
            Present: <strong>{stats.present}</strong>
          </div>
          <div className="px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl font-bold">
            Late: <strong>{stats.late}</strong>
          </div>
          <div className="px-3 py-1.5 bg-rose-50 text-rose-900 border border-rose-200 rounded-xl font-bold">
            Absent: <strong>{stats.absent}</strong>
          </div>
          <div className="px-3 py-1.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-xl font-bold">
            Excused: <strong>{stats.excused}</strong>
          </div>
        </div>

      </div>

      {/* 5. THURSDAY ATTENDANCE REGISTER TABLE */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-300">
              <tr>
                <th className="py-3 px-3">Worker Name</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3 text-center">Thursday Status</th>
                <th className="py-3 px-3 text-right">Quick Set Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    No active workers found matching the selected filter.
                  </td>
                </tr>
              ) : (
                filteredWorkers.map(worker => {
                  const rec = prepAttendanceMap.get(worker.id);
                  const currentStatus = rec ? rec.status : 'ABSENT';

                  return (
                    <tr key={worker.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 text-xs">{worker.fullName}</div>
                        <div className="text-[10px] text-slate-500">{worker.phone || 'No phone'}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">{worker.department}</td>
                      
                      {/* Thursday Status Badge */}
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase inline-block ${
                          currentStatus === 'PRESENT' 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : currentStatus === 'LATE'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : currentStatus === 'EXCUSED'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {currentStatus}
                          {rec?.clockInTime && (
                            <span className="block font-mono text-[9px] font-normal mt-0.5 opacity-90">
                              {rec.clockInTime}
                            </span>
                          )}
                        </span>
                      </td>

                      {/* Quick Set Attendance Buttons */}
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={!securityState.manualAttendanceAllowed}
                            onClick={() => handleSetPrepStatus(worker, 'PRESENT')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              currentStatus === 'PRESENT'
                                ? 'bg-emerald-700 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-900'
                            }`}
                          >
                            Present
                          </button>

                          <button
                            type="button"
                            disabled={!securityState.manualAttendanceAllowed}
                            onClick={() => handleSetPrepStatus(worker, 'LATE')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              currentStatus === 'LATE'
                                ? 'bg-amber-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-900'
                            }`}
                          >
                            Late
                          </button>

                          <button
                            type="button"
                            disabled={!securityState.manualAttendanceAllowed}
                            onClick={() => handleSetPrepStatus(worker, 'ABSENT')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              currentStatus === 'ABSENT'
                                ? 'bg-rose-700 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-rose-100 hover:text-rose-900'
                            }`}
                          >
                            Absent
                          </button>

                          <button
                            type="button"
                            disabled={!securityState.manualAttendanceAllowed}
                            onClick={() => handleSetPrepStatus(worker, 'EXCUSED')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              currentStatus === 'EXCUSED'
                                ? 'bg-blue-700 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-900'
                            }`}
                          >
                            Excused
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Thursday Clock-In Terminal Modal */}
      <ThursdayClockInTerminalModal
        isOpen={showThursdayTerminal}
        targetDate={targetPrepDate}
        weekNumber={selectedWeek}
        topic={activeWeekInfo?.topic}
        workers={workers}
        prepRecords={prepRecords}
        config={config}
        onClose={() => setShowThursdayTerminal(false)}
        onClockInPrep={onSavePrepRecord}
        onUpdateConfig={onUpdateConfig}
        onUpdateWorkerProfile={onUpdateWorkerProfile}
      />

      {/* Thursday Schedule Settings Modal (Complaint 3) */}
      {showScheduleModal && onUpdateConfig && (
        <ClockInScheduleSettingsModal
          isOpen={showScheduleModal}
          activeTab="THURSDAY"
          currentConfig={config}
          onClose={() => setShowScheduleModal(false)}
          onSave={async (newConfig) => {
            await onUpdateConfig(newConfig);
            setShowScheduleModal(false);
          }}
        />
      )}

    </div>
  );
};
