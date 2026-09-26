import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  WorkerProfile, 
  WorkerAttendanceRecord, 
  WorkerPrepAttendanceRecord, 
  ClockInConfig, 
  WorkerCategoryDef,
  SundaySchoolYear,
  QuarterNumber,
  AdminProfile,
  SpecialWorkersEvent,
  SpecialEventAttendanceRecord
} from '../../types';
import { 
  getAllWorkers, 
  saveWorker, 
  deleteWorker, 
  saveBulkWorkers, 
  getAllWorkerAttendance, 
  recordWorkerAttendance, 
  recordBulkWorkerAttendance,
  getAllWorkerPrepAttendance, 
  recordWorkerPrepAttendance, 
  recordBulkWorkerPrepAttendance,
  getClockInConfig, 
  saveClockInConfig, 
  getAllWorkerCategories, 
  saveWorkerCategory,
  deleteWorkerCategory,
  getAllDepartmentsList,
  addDepartmentToYear,
  getSundaySchoolYear,
  getAllAdminProfiles,
  saveAdminProfile,
  getAllSpecialEvents,
  getAllSpecialEventAttendance
} from '../../db/indexedDB';
import { 
  DEFAULT_WORKERS_SEED, 
  DEFAULT_WORKER_CATEGORIES, 
  DEFAULT_CLOCK_IN_CONFIG 
} from '../../data/mockWorkersData';
import { INITIAL_SUNDAY_SCHOOL_YEAR } from '../../data/mockQuarterLessons';

import { WorkersDirectoryView } from './WorkersDirectoryView';
import { SundayClockInKiosk } from './SundayClockInKiosk';
import { PreparatoryAttendanceView } from './PreparatoryAttendanceView';
import { WorkerMyAttendanceView } from './WorkerMyAttendanceView';
import { WorkersDashboardView } from './WorkersDashboardView';
import { QuarterPunctualityAdmonitionView } from './QuarterPunctualityAdmonitionView';
import { SpecialEventsView } from './SpecialEventsView';

import { WorkerProfileModal } from './WorkerProfileModal';
import { BulkWorkerImportModal } from './BulkWorkerImportModal';
import { WorkerQrPassModal } from './WorkerQrPassModal';

import { 
  Users, QrCode, BookOpen, Layers, UserCheck, 
  BarChart3, Plus, Upload, Sparkles, ArrowLeft,
  KeyRound, ShieldAlert, LogOut, Eye, EyeOff, CheckCircle2,
  Trophy, Calendar, ChevronRight, ShieldCheck, Home, ClipboardList
} from 'lucide-react';
import { GofamintLogo } from '../GofamintLogo';
import { usePersistedState } from '../../hooks/usePersistedState';
import { useScrollRestoration } from '../../hooks/useScrollRestoration';
import { getRealtimeHealthStatus, RealtimeHealthStatus } from '../../services/supabaseDatabase';

export type WorkersModuleTab = 
  | 'INSPECTION'
  | 'DIRECTORY' 
  | 'SUNDAY_CLOCK_IN' 
  | 'PREP_ATTENDANCE' 
  | 'SPECIAL_EVENTS' 
  | 'ADMONITION_HONORS' 
  | 'MY_ATTENDANCE' 
  | 'DASHBOARD';

const DIRECTORATE_NAV_ITEMS = [
  { id: 'DASHBOARD', label: 'Executive Dashboard', shortLabel: 'Overview', detail: 'Live workforce intelligence', icon: BarChart3 },
  { id: 'INSPECTION', label: 'Attendance Inspection', shortLabel: 'Inspect', detail: 'Dates, reports and exports', icon: ClipboardList },
  { id: 'DIRECTORY', label: 'Workers Directory', shortLabel: 'Directory', detail: 'People, roles and profiles', icon: Users },
  { id: 'SUNDAY_CLOCK_IN', label: 'Sunday Clock-In', shortLabel: 'Sunday', detail: 'Terminal and attendance register', icon: QrCode },
  { id: 'PREP_ATTENDANCE', label: 'Thursday Preparatory', shortLabel: 'Thursday', detail: 'Class terminal and register', icon: BookOpen },
  { id: 'SPECIAL_EVENTS', label: 'Special Events & Training', shortLabel: 'Events', detail: 'Programs, sessions and records', icon: Sparkles },
  { id: 'ADMONITION_HONORS', label: 'Honours & Admonition', shortLabel: 'Honours', detail: 'Recognition and accountability', icon: Trophy },
  { id: 'MY_ATTENDANCE', label: 'My Workers Pass', shortLabel: 'My Pass', detail: 'Digital pass and history', icon: UserCheck }
] as const;

interface WorkersModuleViewProps {
  onBackToMain?: () => void;
  onBack?: () => void;
  onBackToWelcome?: () => void;
  onLockProfile?: () => void;
  currentUserRole?: string;
  currentWorkerId?: string;
  isOversight?: boolean;
}

export const WorkersModuleView: React.FC<WorkersModuleViewProps> = ({
  onBackToMain,
  onBack,
  onBackToWelcome,
  onLockProfile,
  currentUserRole,
  currentWorkerId,
  isOversight = false
}) => {
  const handleExit = onBack || onBackToMain;
  const isPersonalWorker = currentUserRole === 'WORKER' && !isOversight;
  
  // Persist and restore activeTab on page refresh (Complaint 8)
  const workersStateScope = currentWorkerId || currentUserRole || 'directorate';
  const [activeTab, setActiveTabState] = usePersistedState<WorkersModuleTab>(
    `gofamint_workers_${workersStateScope}_active_tab`,
    isPersonalWorker ? 'MY_ATTENDANCE' : 'DASHBOARD',
    {
      validate: (value): value is WorkersModuleTab => typeof value === 'string' && ['DIRECTORY', 'SUNDAY_CLOCK_IN', 'PREP_ATTENDANCE', 'SPECIAL_EVENTS', 'ADMONITION_HONORS', 'MY_ATTENDANCE', 'DASHBOARD', 'INSPECTION'].includes(value),
      legacyKeys: ['gofamint_workers_active_tab'],
    }
  );

  const setActiveTab = (tab: WorkersModuleTab) => {
    if (isPersonalWorker && tab !== 'MY_ATTENDANCE') return;
    setActiveTabState(tab);
  };

  useScrollRestoration(`workers_${workersStateScope}_${activeTab}`);
  
  const [adminProfiles, setAdminProfiles] = useState<AdminProfile[]>([]);

  // Controlled Exit Confirmation Modal state (Complaint 8)
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [pendingExitType, setPendingExitType] = useState<'LOCK' | 'PORTAL' | null>(null);

  const handleAdminLogout = () => {
    sessionStorage.setItem('gofamint_profile_locked', 'true');
    sessionStorage.removeItem('gofamint_workers_active_tab');
    if (onLockProfile) {
      onLockProfile();
    } else {
      window.location.reload();
    }
  };

  const handleRequestExit = (type: 'LOCK' | 'PORTAL') => {
    setPendingExitType(type);
    setIsExitConfirmOpen(true);
  };

  const handleConfirmExit = () => {
    setIsExitConfirmOpen(false);
    sessionStorage.removeItem('gofamint_workers_active_tab');
    if (pendingExitType === 'LOCK') {
      handleAdminLogout();
    } else if (handleExit) {
      handleExit();
    }
  };

  const handleCancelExit = () => {
    setIsExitConfirmOpen(false);
    setPendingExitType(null);
  };

  // Data State
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [categories, setCategories] = useState<WorkerCategoryDef[]>([]);
  const [sundayAttendance, setSundayAttendance] = useState<WorkerAttendanceRecord[]>([]);
  const [prepAttendance, setPrepAttendance] = useState<WorkerPrepAttendanceRecord[]>([]);
  const [config, setConfig] = useState<ClockInConfig>(DEFAULT_CLOCK_IN_CONFIG);
  const [sundaySchoolYear, setSundaySchoolYear] = useState<SundaySchoolYear>(INITIAL_SUNDAY_SCHOOL_YEAR);
  const [selectedAdmonitionQuarter, setSelectedAdmonitionQuarter] = useState<QuarterNumber>(1);
  const [specialEvents, setSpecialEvents] = useState<SpecialWorkersEvent[]>([]);
  const [specialAttendance, setSpecialAttendance] = useState<SpecialEventAttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [realtimeHealth, setRealtimeHealth] = useState<RealtimeHealthStatus>(() => navigator.onLine ? getRealtimeHealthStatus() : 'ERROR');
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  // Modal states
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerProfile | null>(null);

  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  
  const [isQrPassModalOpen, setIsQrPassModalOpen] = useState(false);
  const [selectedPassWorker, setSelectedPassWorker] = useState<WorkerProfile | null>(null);

  const [adminDepartments, setAdminDepartments] = useState<string[]>([]);

  // Load all initial data from IndexedDB
  const refreshAllData = useCallback((forceCloudRefresh = false): Promise<void> => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const refreshTask = (async () => {
      try {
        setLoadError(null);
      const [
        loadedWorkers,
        loadedCats,
        loadedSundayAtt,
        loadedPrepAtt,
        loadedConfig,
        loadedDepts,
        loadedYear,
        loadedProfiles,
        loadedSpecialEvts,
        loadedSpecialAtt
      ] = await Promise.all([
        getAllWorkers(forceCloudRefresh),
        getAllWorkerCategories(),
        getAllWorkerAttendance(),
        getAllWorkerPrepAttendance(undefined, forceCloudRefresh),
        getClockInConfig(),
        getAllDepartmentsList(),
        getSundaySchoolYear(),
        getAllAdminProfiles(),
        getAllSpecialEvents(forceCloudRefresh),
        getAllSpecialEventAttendance(forceCloudRefresh)
      ]);

      setWorkers(loadedWorkers);
      setCategories(loadedCats);
      setSundayAttendance(loadedSundayAtt);
      setPrepAttendance(loadedPrepAtt);
      setConfig(loadedConfig);
      setAdminDepartments(loadedDepts);
      setAdminProfiles(loadedProfiles);
      setSpecialEvents(loadedSpecialEvts);
      setSpecialAttendance(loadedSpecialAtt);

      if (loadedYear) {
        setSundaySchoolYear(loadedYear);
        setSelectedAdmonitionQuarter(loadedYear.activeQuarterNumber || 1);
      }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Error loading workers module data:', err);
        setLoadError(`Workers Directorate data could not be loaded: ${message}`);
      } finally {
        setIsLoading(false);
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = refreshTask;
    return refreshTask;
  }, []);

  const refreshWorkerStores = useCallback(async (stores: string[]): Promise<void> => {
    if (stores.length === 0) {
      await refreshAllData(false);
      return;
    }

    const changed = new Set(stores);
    const tasks: Promise<unknown>[] = [];
    if (changed.has('workers')) tasks.push(getAllWorkers(false).then(setWorkers));
    if (changed.has('workerAttendance')) tasks.push(getAllWorkerAttendance().then(setSundayAttendance));
    if (changed.has('workerPrepAttendance')) tasks.push(getAllWorkerPrepAttendance().then(setPrepAttendance));
    if (changed.has('workerCategories')) tasks.push(getAllWorkerCategories().then(setCategories));
    if (changed.has('clockInConfig')) tasks.push(getClockInConfig().then(setConfig));
    if (changed.has('specialEvents')) tasks.push(getAllSpecialEvents(false).then(setSpecialEvents));
    if (changed.has('specialEventAttendance')) tasks.push(getAllSpecialEventAttendance(false).then(setSpecialAttendance));
    await Promise.all(tasks);
  }, [refreshAllData]);

  useEffect(() => {
    // App-level scoped hydration owns the network pull. Render immediately
    // from IndexedDB here, then consume the worker-sync event it emits. This
    // avoids downloading the complete Workers dataset twice on every entry.
    void refreshAllData(false);
  }, [refreshAllData]);

  // Reactive listener: When any other admin or background sync modifies worker data in real-time,
  // immediately refresh state without needing a page refresh or manual reload.
  useEffect(() => {
    let refreshTimer: number | undefined;
    const handleWorkerSync = (e: any) => {
      const store = e?.detail?.store;
      const stores: string[] = Array.isArray(e?.detail?.stores) ? e.detail.stores : (store ? [store] : []);
      if (stores.length === 0 || stores.some(changedStore => ['workers', 'workerAttendance', 'workerPrepAttendance', 'specialEvents', 'specialEventAttendance', 'workerCategories', 'clockInConfig'].includes(changedStore))) {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => void refreshWorkerStores(stores).catch(error => {
          console.error('Could not refresh the changed Workers Directorate stores:', error);
          setLoadError(`Workers Directorate could not display a saved change: ${error instanceof Error ? error.message : String(error)}`);
        }), 50);
      }
    };
    window.addEventListener('gofamint:worker-sync', handleWorkerSync);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener('gofamint:worker-sync', handleWorkerSync);
    };
  }, [refreshWorkerStores]);

  useEffect(() => {
    const handleRealtimeStatus = (event: Event) => {
      const overall = (event as CustomEvent).detail?.overall;
      if (overall) setRealtimeHealth(overall);
    };
    const handleOffline = () => setRealtimeHealth('ERROR');
    const handleOnline = () => setRealtimeHealth('CONNECTING');
    window.addEventListener('gofamint:realtime-status', handleRealtimeStatus);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('gofamint:realtime-status', handleRealtimeStatus);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const asstGsecProfile = adminProfiles.find(p => p.roleType === 'ASST_GENERAL_SECRETARY');
  const gsProfile = adminProfiles.find(p => p.roleType === 'GENERAL_SUPERINTENDENT');
  const gsecProfile = adminProfiles.find(p => p.roleType === 'GENERAL_SECRETARY');

  // Distinct departments (Strictly 4 recognized: Adult, Youth, Teenagers, Children + any custom added ones)
  const legacyDeptsToRemove = new Set([
    'Sunday School', 'Ministers Council', 'Choir', 'Youth Ministry', 'Good Women', 'Men Fellowship',
    'Evangelism Board', 'Ushering Unit', 'Prayer Band', 'Sanctuary Keepers', 'Welfare Board',
    'Media & Technical Unit', 'Young Adults', 'Teens', 'Elders', 'Searchers / Believers',
    'Follow-Up Unit', 'Protocol Unit', 'Music Ministry', 'Christian Education', 'ADMIN', 'ADULT', 'YOUTH', 'TEENS', 'CHILDREN'
  ]);

  const departmentsList = Array.from(
    new Set([
      'Adult',
      'Youth',
      'Teenagers',
      'Children',
      ...adminDepartments.filter(d => !legacyDeptsToRemove.has(d)),
      ...workers.map(w => w.department).filter(d => !legacyDeptsToRemove.has(d))
    ].filter(Boolean))
  );

  const visibleNavItems = isPersonalWorker
    ? DIRECTORATE_NAV_ITEMS.filter(item => item.id === 'MY_ATTENDANCE')
    : DIRECTORATE_NAV_ITEMS;
  const activeNavItem = visibleNavItems.find(item => item.id === activeTab) || visibleNavItems[0];
  const activeWorkersCount = workers.filter(worker => worker.status === 'ACTIVE').length;

  // Handlers for Worker Profiles
  const handleOpenAddWorker = () => {
    setEditingWorker(null);
    setIsProfileModalOpen(true);
  };

  const handleOpenEditWorker = (worker: WorkerProfile) => {
    setEditingWorker(worker);
    setIsProfileModalOpen(true);
  };

  const handleSaveWorkerProfile = async (workerData: WorkerProfile) => {
    await saveWorker(workerData);
    await refreshAllData(false);
  };

  const handleDeleteWorker = async (id: string) => {
    // 1. Optimistic removal - immediate 0ms UI update
    const previousWorkers = workers;
    setWorkers(prev => prev.filter(w => w.id !== id));

    try {
      await deleteWorker(id);
    } catch (err) {
      console.error('Failed to delete worker:', err);
      setWorkers(previousWorkers);
      alert('Failed to delete worker. Please try again.');
    }
  };

  const handleSaveBulkWorkers = async (newWorkers: WorkerProfile[]) => {
    await saveBulkWorkers(newWorkers);
    await refreshAllData(false);
  };

  // Handlers for QR Pass
  const handleOpenQrPass = (worker: WorkerProfile) => {
    setSelectedPassWorker(worker);
    setIsQrPassModalOpen(true);
  };

  // Handlers for Sunday Attendance
  const handleSundayClockIn = async (record: WorkerAttendanceRecord) => {
    // 1. Optimistic update (0ms instant UI responsiveness)
    const previousAttendance = sundayAttendance;
    setSundayAttendance(prev => {
      const filtered = prev.filter(a => a.id !== record.id);
      return [...filtered, record];
    });
    try {
      await recordWorkerAttendance(record);
    } catch (err) {
      console.error('Failed to record worker attendance:', err);
      setSundayAttendance(previousAttendance);
      alert('Worker attendance was not saved. The previous register has been restored.');
    }
  };

  useEffect(() => {
    if (isPersonalWorker && activeTab !== 'MY_ATTENDANCE') setActiveTab('MY_ATTENDANCE');
  }, [isPersonalWorker, activeTab]);

  const handleSaveSundayBulkRecords = async (records: WorkerAttendanceRecord[]) => {
    // 1. Optimistic update (0ms instant UI responsiveness)
    const previousAttendance = sundayAttendance;
    const recordIds = new Set(records.map(r => r.id));
    setSundayAttendance(prev => {
      const filtered = prev.filter(a => !recordIds.has(a.id));
      return [...filtered, ...records];
    });
    try {
      await recordBulkWorkerAttendance(records);
    } catch (err) {
      console.error('Failed to record bulk worker attendance:', err);
      setSundayAttendance(previousAttendance);
      alert('Bulk worker attendance was not saved. The previous register has been restored.');
    }
  };

  const handleUpdateConfig = async (newConfig: ClockInConfig) => {
    await saveClockInConfig(newConfig);
    setConfig(newConfig);
  };

  // Handlers for Preparatory Attendance
  const handleSavePrepRecord = async (record: WorkerPrepAttendanceRecord) => {
    // 1. Optimistic update (0ms instant UI responsiveness)
    const previousAttendance = prepAttendance;
    setPrepAttendance(prev => {
      const filtered = prev.filter(p => p.id !== record.id);
      return [...filtered, record];
    });
    try {
      await recordWorkerPrepAttendance(record);
    } catch (err) {
      console.error('Failed to record prep attendance:', err);
      setPrepAttendance(previousAttendance);
      alert('Preparatory attendance was not saved. The previous register has been restored.');
    }
  };

  const handleSaveBulkPrepRecords = async (records: WorkerPrepAttendanceRecord[]) => {
    // 1. Optimistic update (0ms instant UI responsiveness)
    const previousAttendance = prepAttendance;
    const recordIds = new Set(records.map(r => r.id));
    setPrepAttendance(prev => {
      const filtered = prev.filter(p => !recordIds.has(p.id));
      return [...filtered, ...records];
    });
    try {
      await recordBulkWorkerPrepAttendance(records);
    } catch (err) {
      console.error('Failed to record bulk prep attendance:', err);
      setPrepAttendance(previousAttendance);
      alert('Bulk preparatory attendance was not saved. The previous register has been restored.');
    }
  };

  const handleAddNewDepartment = async (deptName: string) => {
    await addDepartmentToYear(deptName);
    await refreshAllData(false);
  };

  return (
    <div className="workers-directorate-shell min-h-screen bg-[#eef3fb] text-slate-900 font-sans selection:bg-blue-900 selection:text-white pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_90%_5%,rgba(37,99,235,0.12),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(220,38,38,0.06),transparent_34%)]" />

      {/* Jobie-inspired desktop command sidebar */}
      <aside aria-label="Workers Directorate navigation" className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-72 flex-col overflow-hidden bg-linear-to-b from-[#06142f] via-[#0a2b63] to-[#123f8f] text-white shadow-[18px_0_50px_rgba(15,42,85,0.18)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-red-600 via-white to-amber-400" />
        <div className="px-6 pt-7 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3.5">
            <div className="rounded-2xl bg-white p-2 shadow-xl shadow-slate-950/20">
              <GofamintLogo size={42} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">GOFAMINT · HOF</span>
              <h1 className="mt-0.5 text-base font-black leading-tight font-['Cinzel',serif]">Workers Directorate</h1>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/8 px-3.5 py-3 backdrop-blur-sm">
            <div>
              <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-blue-200">Live workforce</span>
              <span className="text-lg font-black tabular-nums">{activeWorkersCount}</span>
              <span className="ml-1 text-[10px] text-blue-100">active</span>
            </div>
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${
              realtimeHealth === 'LIVE'
                ? 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/20'
                : realtimeHealth === 'ERROR'
                  ? 'bg-red-400/15 text-red-200 ring-red-300/20'
                  : 'bg-amber-400/15 text-amber-100 ring-amber-300/20'
            }`} title={`Realtime status: ${realtimeHealth.toLowerCase()}`}>
              <span className={`h-2 w-2 rounded-full ${realtimeHealth === 'LIVE' ? 'bg-emerald-300 animate-pulse' : realtimeHealth === 'ERROR' ? 'bg-red-300' : 'bg-amber-300 animate-pulse'}`} />
              {realtimeHealth === 'LIVE' ? 'Live' : realtimeHealth === 'ERROR' ? 'Sync issue' : 'Connecting'}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto no-scrollbar px-4 py-5">
          <p className="px-3 pb-2 text-[9px] font-black uppercase tracking-[0.2em] text-blue-200/70">Directorate workspace</p>
          <div className="space-y-1.5">
            {visibleNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  id={`workers-nav-${item.id.toLowerCase()}`}
                  key={item.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveTab(item.id)}
                  className={`group relative w-full overflow-hidden rounded-2xl px-3.5 py-3 text-left transition-all duration-200 cursor-pointer ${isActive
                    ? 'bg-white text-blue-950 shadow-xl shadow-slate-950/20'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {isActive && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-red-600" />}
                  <span className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${isActive ? 'bg-blue-50 text-blue-900 ring-1 ring-blue-100' : 'bg-white/8 text-blue-100 group-hover:bg-white/15'}`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-black leading-tight">{item.label}</span>
                      <span className={`mt-0.5 block truncate text-[9px] font-semibold ${isActive ? 'text-slate-500' : 'text-blue-200/70'}`}>{item.detail}</span>
                    </span>
                    <ChevronRight className={`h-4 w-4 shrink-0 transition ${isActive ? 'text-red-500' : 'text-blue-300/30 group-hover:text-white'}`} />
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="space-y-2 border-t border-white/10 p-4">
          {asstGsecProfile && (
            <div className="mb-3 flex items-center gap-3 rounded-2xl bg-slate-950/20 p-3 ring-1 ring-white/10">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-blue-950">{asstGsecProfile.profileName.slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0">
                <span className="block truncate text-xs font-black">{asstGsecProfile.profileName}</span>
                <span className="block text-[9px] font-bold uppercase tracking-wide text-blue-200">Assistant General Secretary</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {onBackToWelcome && (
              <button type="button" onClick={onBackToWelcome} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/8 px-3 py-2.5 text-[10px] font-bold text-blue-100 ring-1 ring-white/10 transition hover:bg-white/15 hover:text-white cursor-pointer">
                <Home className="h-3.5 w-3.5" /> Welcome
              </button>
            )}
            <button type="button" onClick={() => handleRequestExit('LOCK')} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/8 px-3 py-2.5 text-[10px] font-bold text-blue-100 ring-1 ring-white/10 transition hover:bg-white/15 hover:text-white cursor-pointer">
              <LogOut className="h-3.5 w-3.5" /> Lock
            </button>
          </div>
          {handleExit && (
            <button type="button" onClick={() => handleRequestExit('PORTAL')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-[10px] font-black text-white shadow-lg shadow-red-950/20 transition hover:bg-red-500 cursor-pointer">
              <ArrowLeft className="h-3.5 w-3.5" /> Return to Admin Portal
            </button>
          )}
        </div>
      </aside>

      <div className="relative flex min-h-screen flex-col lg:pl-72">
        {/* Compact mobile command header */}
        <header className="sticky top-0 z-40 border-b border-blue-100/80 bg-white/92 px-3 py-2.5 shadow-sm backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="rounded-xl bg-blue-950 p-1.5 shadow-sm"><GofamintLogo size={28} /></div>
              <div className="min-w-0">
                <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-red-600">Workers Directorate</span>
                <h2 className="truncate text-sm font-black text-blue-950">{activeNavItem.label}</h2>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {onBackToWelcome && (
                <button type="button" onClick={onBackToWelcome} className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-900 ring-1 ring-blue-100 cursor-pointer" aria-label="Return to welcome page"><Home className="h-4 w-4" /></button>
              )}
              {handleExit && (
                <button type="button" onClick={() => handleRequestExit('PORTAL')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200 cursor-pointer" aria-label="Return to admin portal"><ArrowLeft className="h-4 w-4" /></button>
              )}
              <button type="button" onClick={() => handleRequestExit('LOCK')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-700 ring-1 ring-red-100 cursor-pointer" aria-label="Lock Workers Directorate"><LogOut className="h-4 w-4" /></button>
            </div>
          </div>
        </header>

        {/* Desktop page context bar */}
        <header className="sticky top-0 z-40 hidden items-center justify-between border-b border-slate-200/80 bg-white/88 px-7 py-4 shadow-[0_8px_30px_rgba(15,42,85,0.06)] backdrop-blur-xl lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-950 text-white shadow-lg shadow-blue-950/15">
              {React.createElement(activeNavItem.icon, { className: 'h-5 w-5' })}
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                <span>Workers Directorate</span><span className="h-1 w-1 rounded-full bg-red-500" /><span className="text-blue-700">Live operations</span>
              </div>
              <h2 className="text-xl font-black tracking-tight text-blue-950">{activeNavItem.label}</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden xl:flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-100">
              <ShieldCheck className="h-3.5 w-3.5" /><span>Directorate data protected</span>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-2 text-right ring-1 ring-slate-200">
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Sunday School Year</span>
              <span className="block text-xs font-black text-blue-950">{sundaySchoolYear.yearName || 'Active programme year'}</span>
            </div>
          </div>
        </header>

      {/* Main Content Body */}
      <main className="workers-directorate-main flex-1 w-full max-w-[1600px] mx-auto p-3 sm:p-5 lg:p-7 xl:p-8">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-blue-900 border-t-amber-400 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-bold">
              Loading GOFAMINT_HOF Workers Directory & Records...
            </p>
          </div>
        ) : loadError ? (
          <div role="alert" className="max-w-xl mx-auto py-14 text-center space-y-4">
            <ShieldAlert className="w-10 h-10 text-red-600 mx-auto" />
            <p className="text-sm font-bold text-red-800">{loadError}</p>
            <button
              type="button"
              onClick={() => void refreshAllData(true)}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
            >
              Retry data load
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'DASHBOARD' && (
              <WorkersDashboardView
                workers={workers}
                sundayAttendance={sundayAttendance}
                prepAttendance={prepAttendance}
                departmentsList={departmentsList}
                config={config}
                sundaySchoolYear={sundaySchoolYear}
                onNavigateToTab={setActiveTab}
                onViewQrPass={handleOpenQrPass}
                onSaveSundayAttendance={handleSaveSundayBulkRecords}
                onSavePrepAttendance={handleSaveBulkPrepRecords}
              />
            )}

            {activeTab === 'INSPECTION' && (
              <WorkersDashboardView
                viewMode="INSPECTION"
                workers={workers}
                sundayAttendance={sundayAttendance}
                prepAttendance={prepAttendance}
                departmentsList={departmentsList}
                config={config}
                sundaySchoolYear={sundaySchoolYear}
                onNavigateToTab={setActiveTab}
                onViewQrPass={handleOpenQrPass}
                onSaveSundayAttendance={handleSaveSundayBulkRecords}
                onSavePrepAttendance={handleSaveBulkPrepRecords}
              />
            )}

            {activeTab === 'DIRECTORY' && (
              <WorkersDirectoryView
                workers={workers}
                categoriesList={categories}
                departmentsList={departmentsList}
                onAddWorker={handleOpenAddWorker}
                onBulkImport={() => setIsBulkImportOpen(true)}
                onEditWorker={handleOpenEditWorker}
                onDeleteWorker={handleDeleteWorker}
                onSaveWorkerProfile={handleSaveWorkerProfile}
                onViewQrPass={handleOpenQrPass}
                onQuickClockIn={(worker) => {
                  setActiveTab('SUNDAY_CLOCK_IN');
                }}
                onNavigateToTab={setActiveTab}
              />
            )}

            {activeTab === 'SUNDAY_CLOCK_IN' && (
              <SundayClockInKiosk
                workers={workers}
                todayAttendance={sundayAttendance.filter(a => a.serviceDate === (config.serviceDate || new Date().toISOString().split('T')[0]))}
                allSundayAttendance={sundayAttendance}
                config={config}
                sundaySchoolYear={sundaySchoolYear}
                departmentsList={departmentsList}
                onClockIn={handleSundayClockIn}
                onUpdateConfig={handleUpdateConfig}
                onUpdateWorkerProfile={handleSaveWorkerProfile}
                onNavigateToTab={setActiveTab}
                onSaveSundayRecord={handleSundayClockIn}
                onSaveBulkSundayRecords={handleSaveSundayBulkRecords}
              />
            )}

            {activeTab === 'PREP_ATTENDANCE' && (
              <PreparatoryAttendanceView
                workers={workers}
                prepRecords={prepAttendance}
                sundayAttendance={sundayAttendance}
                departmentsList={departmentsList}
                config={config}
                sundaySchoolYear={sundaySchoolYear}
                onSavePrepRecord={handleSavePrepRecord}
                onSaveBulkPrepRecords={handleSaveBulkPrepRecords}
                onSaveSundayRecord={handleSundayClockIn}
                onSaveBulkSundayRecords={handleSaveSundayBulkRecords}
                onUpdateWorkerProfile={handleSaveWorkerProfile}
                onNavigateToTab={setActiveTab}
              />
            )}

            {activeTab === 'SPECIAL_EVENTS' && (
              <SpecialEventsView
                workers={workers}
                onViewQrPass={handleOpenQrPass}
              />
            )}

            {activeTab === 'ADMONITION_HONORS' && (
              <QuarterPunctualityAdmonitionView
                workers={workers}
                sundayAttendance={sundayAttendance}
                prepAttendance={prepAttendance}
                sundaySchoolYear={sundaySchoolYear}
                selectedQuarterNumber={selectedAdmonitionQuarter}
                onSelectQuarter={setSelectedAdmonitionQuarter}
                onSaveWorkerProfile={handleSaveWorkerProfile}
                onDeleteWorker={handleDeleteWorker}
                specialEvents={specialEvents}
                specialAttendance={specialAttendance}
              />
            )}

            {activeTab === 'MY_ATTENDANCE' && (
              <WorkerMyAttendanceView
                workers={workers}
                sundayAttendance={sundayAttendance}
                prepAttendance={prepAttendance}
                onViewQrPass={handleOpenQrPass}
                lockedWorkerId={isPersonalWorker ? currentWorkerId : undefined}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-blue-100/80 bg-white/70 px-5 py-6 text-center text-xs text-slate-500 backdrop-blur-sm">
        <p className="font-bold text-slate-700">
          The Gospel Faith Mission International (House of Favour) (GOFAMINT_HOF) — Dedicated Workers Directorate Module
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          High-throughput Sunday Service QR Clock-In • Thursday Preparatory Class Roster • Pastoral Care
        </p>
      </footer>
      </div>

      {/* Mobile taskbar: always within thumb reach, horizontally scrollable for all seven workspaces */}
      <nav aria-label="Mobile Workers Directorate navigation" className="fixed inset-x-0 bottom-0 z-50 overflow-x-auto border-t border-blue-100 bg-white/96 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-12px_35px_rgba(15,42,85,0.16)] backdrop-blur-xl no-scrollbar lg:hidden">
        <div className={`mx-auto flex min-w-max items-stretch gap-1.5 ${isPersonalWorker ? 'justify-center' : 'justify-start'}`}>
          {visibleNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                id={`workers-mobile-nav-${item.id.toLowerCase()}`}
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex min-h-[55px] min-w-[70px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1.5 text-[9px] font-black transition-all cursor-pointer ${isActive
                  ? 'bg-blue-950 text-white shadow-lg shadow-blue-950/20'
                  : 'text-slate-500 hover:bg-blue-50 hover:text-blue-900'
                }`}
              >
                {isActive && <span className="absolute -top-1 h-1 w-7 rounded-full bg-red-500" />}
                <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-amber-300' : 'text-blue-800'}`} />
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Worker Profile Modal (Add/Edit) */}
      <WorkerProfileModal
        isOpen={isProfileModalOpen}
        worker={editingWorker}
        categoriesList={categories}
        departmentsList={departmentsList}
        sundaySchoolYear={sundaySchoolYear}
        sundayAttendance={sundayAttendance}
        prepAttendance={prepAttendance}
        onClose={() => setIsProfileModalOpen(false)}
        onSave={handleSaveWorkerProfile}
        onSaveSundayAttendance={handleSaveSundayBulkRecords}
        onSavePrepAttendance={handleSaveBulkPrepRecords}
        onAddNewDepartment={handleAddNewDepartment}
      />

      {/* Bulk Worker Import Modal */}
      <BulkWorkerImportModal
        isOpen={isBulkImportOpen}
        existingWorkers={workers}
        categoriesList={categories}
        departmentsList={departmentsList}
        onClose={() => setIsBulkImportOpen(false)}
        onSaveBulk={handleSaveBulkWorkers}
        onImportSuccess={handleSaveBulkWorkers}
      />

      {/* Worker Official QR Pass Modal */}
      <WorkerQrPassModal
        isOpen={isQrPassModalOpen}
        worker={selectedPassWorker}
        onClose={() => setIsQrPassModalOpen(false)}
        onQuickClockIn={(worker) => {
          setActiveTab('SUNDAY_CLOCK_IN');
        }}
      />

      {/* Controlled Departure / Exit Confirmation Modal (Complaint 8) */}
      {isExitConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border-2 border-slate-200 space-y-5 animate-scale-in text-slate-800">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 block">
                  Workers Directorate Exit Verification
                </span>
                <h3 className="text-base font-black font-['Cinzel',serif] text-slate-900">
                  Do you want to leave this page?
                </h3>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <p>
                You are currently working inside the <strong>Sunday School Workers Directorate</strong>.
              </p>
              <p className="text-[11px] text-slate-500">
                Choosing to return will lock the Directorate session and navigate you back to your administrative dashboard. If you choose to stay, your active tab and current work will remain open.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleCancelExit}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer order-2 sm:order-1"
              >
                <span>No — Stay on This Page</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmExit}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer order-1 sm:order-2"
              >
                <span>Yes — Lock and Return to your Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
