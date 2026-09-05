import React, { useState, useEffect, useCallback } from 'react';
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
  Lock, KeyRound, ShieldAlert, LogOut, Eye, EyeOff, CheckCircle2,
  Trophy, Calendar
} from 'lucide-react';
import { GofamintLogo } from '../GofamintLogo';

export type WorkersModuleTab = 
  | 'DIRECTORY' 
  | 'SUNDAY_CLOCK_IN' 
  | 'PREP_ATTENDANCE' 
  | 'SPECIAL_EVENTS' 
  | 'ADMONITION_HONORS' 
  | 'MY_ATTENDANCE' 
  | 'DASHBOARD';

interface WorkersModuleViewProps {
  onBackToMain?: () => void;
  onBack?: () => void;
  onLockProfile?: () => void;
}

export const WorkersModuleView: React.FC<WorkersModuleViewProps> = ({
  onBackToMain,
  onBack,
  onLockProfile
}) => {
  const handleExit = onBack || onBackToMain;
  
  // Persist and restore activeTab on page refresh (Complaint 8)
  const [activeTab, setActiveTabState] = useState<WorkersModuleTab>(() => {
    const saved = sessionStorage.getItem('gofamint_workers_active_tab');
    if (saved && ['DIRECTORY', 'SUNDAY_CLOCK_IN', 'PREP_ATTENDANCE', 'SPECIAL_EVENTS', 'ADMONITION_HONORS', 'MY_ATTENDANCE', 'DASHBOARD'].includes(saved)) {
      return saved as WorkersModuleTab;
    }
    return 'DASHBOARD';
  });

  const setActiveTab = (tab: WorkersModuleTab) => {
    setActiveTabState(tab);
    sessionStorage.setItem('gofamint_workers_active_tab', tab);
  };
  
  // Workers Directorate access is established by the resolved Supabase profile.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
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
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerProfile | null>(null);

  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  
  const [isQrPassModalOpen, setIsQrPassModalOpen] = useState(false);
  const [selectedPassWorker, setSelectedPassWorker] = useState<WorkerProfile | null>(null);

  const [adminDepartments, setAdminDepartments] = useState<string[]>([]);

  // Load all initial data from IndexedDB
  const refreshAllData = useCallback(async () => {
    try {
      setIsLoading(true);
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
        getAllWorkers(),
        getAllWorkerCategories(),
        getAllWorkerAttendance(),
        getAllWorkerPrepAttendance(),
        getClockInConfig(),
        getAllDepartmentsList(),
        getSundaySchoolYear(),
        getAllAdminProfiles(),
        getAllSpecialEvents(),
        getAllSpecialEventAttendance()
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
      console.error('Error loading workers module data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

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
    await refreshAllData();
  };

  const handleDeleteWorker = async (id: string) => {
    await deleteWorker(id);
    await refreshAllData();
  };

  const handleSaveBulkWorkers = async (newWorkers: WorkerProfile[]) => {
    await saveBulkWorkers(newWorkers);
    await refreshAllData();
  };

  // Handlers for QR Pass
  const handleOpenQrPass = (worker: WorkerProfile) => {
    setSelectedPassWorker(worker);
    setIsQrPassModalOpen(true);
  };

  // Handlers for Sunday Attendance
  const handleSundayClockIn = async (record: WorkerAttendanceRecord) => {
    await recordWorkerAttendance(record);
    const updated = await getAllWorkerAttendance();
    setSundayAttendance(updated);
  };

  const handleSaveSundayBulkRecords = async (records: WorkerAttendanceRecord[]) => {
    await recordBulkWorkerAttendance(records);
    const updated = await getAllWorkerAttendance();
    setSundayAttendance(updated);
  };

  const handleUpdateConfig = async (newConfig: ClockInConfig) => {
    await saveClockInConfig(newConfig);
    setConfig(newConfig);
  };

  // Handlers for Preparatory Attendance
  const handleSavePrepRecord = async (record: WorkerPrepAttendanceRecord) => {
    await recordWorkerPrepAttendance(record);
    const updated = await getAllWorkerPrepAttendance();
    setPrepAttendance(updated);
  };

  const handleSaveBulkPrepRecords = async (records: WorkerPrepAttendanceRecord[]) => {
    await recordBulkWorkerPrepAttendance(records);
    const updated = await getAllWorkerPrepAttendance();
    setPrepAttendance(updated);
  };

  const handleAddNewDepartment = async (deptName: string) => {
    await addDepartmentToYear(deptName);
    await refreshAllData();
  };

  // If Not Authenticated, show access restricted notice
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-white p-4 font-sans">
        <div className="max-w-md w-full bg-slate-900 rounded-3xl border border-slate-800 p-8 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center mx-auto text-amber-400">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white font-['Cinzel',serif]">Workers Directorate</h2>
          <p className="text-xs text-slate-400">
            Access to the Workers Directorate is restricted to authorized personnel (Assistant General Secretary, General Secretary, General Superintendent, or Workers).
          </p>
          {handleExit && (
            <button
              type="button"
              onClick={handleExit}
              className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-bold transition shadow-md"
            >
              Return to Portals
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-900 selection:text-white">
      
      {/* Top Header Navigation */}
      <header className="bg-slate-900 text-white border-b-2 border-amber-500 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Brand & Exit */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GofamintLogo size={36} />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    GOFAMINT_HOF National
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500 text-white rounded-full font-bold">
                    Authenticated
                  </span>
                  {asstGsecProfile && (
                    <span className="text-[9px] px-1.5 py-0.2 bg-blue-800 text-amber-300 rounded-full font-bold">
                      👤 {asstGsecProfile.profileName} (Asst. Gen. Sec)
                    </span>
                  )}
                </div>
                <h1 className="text-base font-black font-['Cinzel',serif] text-slate-100">
                  Sunday School Workers Directorate
                </h1>
              </div>
            </div>

            {/* Mobile Exit Button */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={() => handleRequestExit('LOCK')}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition cursor-pointer"
                title="Lock Session"
              >
                <LogOut className="w-4 h-4" />
              </button>
              {handleExit && (
                <button
                  onClick={() => handleRequestExit('PORTAL')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Portal</span>
                </button>
              )}
            </div>
          </div>

          {/* Action Links & Session Lock */}
          <div className="hidden md:flex items-center gap-3">
            {asstGsecProfile && (
              <div className="px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-amber-300 font-bold">Officer:</span>
                <span>{asstGsecProfile.profileName}</span>
              </div>
            )}

            <button
              onClick={() => handleRequestExit('LOCK')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-amber-400" />
              <span>Lock Directorate</span>
            </button>

            {handleExit && (
              <button
                onClick={() => handleRequestExit('PORTAL')}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Portal</span>
              </button>
            )}
          </div>

        </div>

        {/* Sub-Navigation Tabs - Executive Pill Design without Scrollbar (Screenshot 5555 / Complaint 5) */}
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 border-t border-slate-800/80 bg-slate-950/80">
          <div className="flex items-center gap-1.5 py-2 overflow-x-auto no-scrollbar scroll-smooth">
            
            <button
              onClick={() => setActiveTab('DASHBOARD')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer border ${
                activeTab === 'DASHBOARD'
                  ? 'bg-linear-to-r from-blue-900 to-indigo-900 text-white border-blue-500 shadow-md font-black ring-1 ring-amber-400/40'
                  : 'border-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800/70 hover:border-slate-700'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
              <span>Executive Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('DIRECTORY')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer border ${
                activeTab === 'DIRECTORY'
                  ? 'bg-linear-to-r from-blue-900 to-indigo-900 text-white border-blue-500 shadow-md font-black ring-1 ring-amber-400/40'
                  : 'border-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800/70 hover:border-slate-700'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Workers Directory</span>
            </button>

            <button
              onClick={() => setActiveTab('SUNDAY_CLOCK_IN')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer border ${
                activeTab === 'SUNDAY_CLOCK_IN'
                  ? 'bg-linear-to-r from-emerald-800 to-teal-900 text-white border-emerald-500 shadow-md font-black ring-1 ring-amber-400/40'
                  : 'border-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800/70 hover:border-slate-700'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-amber-300" />
              <span>Sunday Clock-In Terminal & Register</span>
            </button>

            <button
              onClick={() => setActiveTab('PREP_ATTENDANCE')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer border ${
                activeTab === 'PREP_ATTENDANCE'
                  ? 'bg-linear-to-r from-blue-900 to-indigo-900 text-white border-blue-500 shadow-md font-black ring-1 ring-amber-400/40'
                  : 'border-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800/70 hover:border-slate-700'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Thursday Preparatory Class</span>
            </button>

            <button
              onClick={() => setActiveTab('SPECIAL_EVENTS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer border ${
                activeTab === 'SPECIAL_EVENTS'
                  ? 'bg-linear-to-r from-blue-900 to-indigo-900 text-white border-blue-500 shadow-md font-black ring-1 ring-amber-400/40'
                  : 'border-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800/70 hover:border-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Special Events & Training</span>
            </button>

            <button
              onClick={() => setActiveTab('ADMONITION_HONORS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer border ${
                activeTab === 'ADMONITION_HONORS'
                  ? 'bg-linear-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-md border-amber-400 ring-1 ring-amber-300'
                  : 'border-slate-800/60 text-amber-300 hover:text-white hover:bg-slate-800/70 hover:border-slate-700'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Punctuality Honors & Admonition</span>
            </button>

            <button
              onClick={() => setActiveTab('MY_ATTENDANCE')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer border ${
                activeTab === 'MY_ATTENDANCE'
                  ? 'bg-linear-to-r from-blue-900 to-indigo-900 text-white border-blue-500 shadow-md font-black ring-1 ring-amber-400/40'
                  : 'border-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800/70 hover:border-slate-700'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>My Worker Pass</span>
            </button>

          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-blue-900 border-t-amber-400 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-bold">
              Loading GOFAMINT_HOF Workers Directory & Records...
            </p>
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
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <p className="font-bold text-slate-700">
          The Gospel Faith Mission International (House of Favour) (GOFAMINT_HOF) — Dedicated Workers Directorate Module
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          High-throughput Sunday Service QR Clock-In • Thursday Preparatory Class Roster • Pastoral Care
        </p>
      </footer>

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
