import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Upload,
  Database,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  RefreshCw,
  Trash2,
  History,
  ShieldCheck,
  Users,
  Award,
  BookOpen,
  Calendar,
  Sparkles,
  X,
  Clock,
  ArrowRight,
  Loader2,
  Shield,
  Layers,
  FileText,
  UserCheck,
  Briefcase,
  Coins,
  MessageSquare
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  getDatabaseStatisticsSummary,
  saveLocalBrowserSnapshot,
  getLocalBrowserSnapshots,
  deleteLocalBrowserSnapshot,
  restoreLocalBrowserSnapshot,
  LocalSnapshotItem
} from '../db/indexedDB';
import {
  downloadDataOnlyBackupFile,
  validateAndPreviewDataBackup,
  executeDataOnlyImport,
  ValidationPreviewResult,
  DataBackupSummary,
  DataImportResult
} from '../services/dataBackupService';
import { cloudGetSundaySchoolYear } from '../services/supabaseDatabase';
import { resetYearOnServer } from '../services/resetYearApi';
import { downloadDatabaseArchive, factoryReset, listDatabaseArchives, stagedReset, type DatabaseArchiveMetadata } from '../services/adminUserApi';
import { hydrateLocalFromCloud } from '../services/cloudSyncManager';
import { performLocalFactoryReset } from '../db/indexedDB';
import { signOutUser } from '../services/authService';


interface DatabaseBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'SAVE' | 'LOAD' | 'RESET';
  onDatabaseRestored?: () => void;
  // Controls whether the "Start New Year" (reset) tab is shown at all. This is
  // a UX convenience only — the real authorization check happens server-side
  // in /api/admin/reset-year, which re-verifies the signed-in user's role
  // against Supabase regardless of what this prop is set to. Defaults to
  // false so any caller that doesn't explicitly opt in (pre-login screens,
  // class-level settings) never shows the tab.
  canAccessReset?: boolean;
}

// Gentle success chime using Web Audio API
const playSuccessSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    
    // 3-note harmonic arpeggio (C5 -> E5 -> G5)
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24);
    
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // Audio optional
  }
};

export const DatabaseBackupModal: React.FC<DatabaseBackupModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'SAVE',
  onDatabaseRestored,
  canAccessReset = false
}) => {
  const [activeTab, setActiveTab] = useState<'SAVE' | 'LOAD' | 'RESET'>(initialTab === 'RESET' && !canAccessReset ? 'SAVE' : initialTab);
  const [stats, setStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [customLabel, setCustomLabel] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Local Snapshots
  const [localSnapshots, setLocalSnapshots] = useState<LocalSnapshotItem[]>([]);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [confirmDeleteSnapshotId, setConfirmDeleteSnapshotId] = useState<string | null>(null);

  // Load / Import States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawParsedJson, setRawParsedJson] = useState<any | null>(null);
  const [previewResult, setPreviewResult] = useState<ValidationPreviewResult | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  
  // Real-time Restore Progress States
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStepText, setRestoreStepText] = useState<string>('');
  const [restoreProgressPct, setRestoreProgressPct] = useState<number>(0);
  const [restoreSuccess, setRestoreSuccess] = useState<DataImportResult | null>(null);
  const [importMode, setImportMode] = useState<'REPLACE_DATA' | 'MERGE_DATA'>('REPLACE_DATA');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset ("Start New Year") States — this now performs a real server-side
  // reset against the centralized Supabase database (see resetYearApi.ts),
  // scoped to the current Sunday School year, not a local-only wipe.
  const [isResetting, setIsResetting] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetStepText, setResetStepText] = useState<string>('');
  const [resetProgressPct, setResetProgressPct] = useState<number>(0);
  const [currentYearId, setCurrentYearId] = useState<string | null>(null);
  const [currentYearName, setCurrentYearName] = useState<string>('');
  const [isLoadingCurrentYear, setIsLoadingCurrentYear] = useState(false);
  const [newYearName, setNewYearName] = useState('');
  const [newOverallTheme, setNewOverallTheme] = useState('');
  const [factoryResetConfirm, setFactoryResetConfirm] = useState('');
  const [fullResetConfirm, setFullResetConfirm] = useState('');
  const [isFactoryResetting, setIsFactoryResetting] = useState(false);
  const [factoryResetError, setFactoryResetError] = useState('');
  const [stagedResetSuccess, setStagedResetSuccess] = useState('');
  const [stagedResetScope, setStagedResetScope] = useState<'CLASSES' | 'WORKERS' | 'ADMINS'>('CLASSES');
  const [serverArchives, setServerArchives] = useState<DatabaseArchiveMetadata[]>([]);
  const [archiveListError, setArchiveListError] = useState('');
  const [isLoadingArchives, setIsLoadingArchives] = useState(false);

  const loadServerArchives = async () => {
    if (!canAccessReset) return;
    setIsLoadingArchives(true);
    setArchiveListError('');
    try {
      const result = await listDatabaseArchives();
      if (!result.success) throw new Error(result.error || 'Archive list request failed.');
      setServerArchives(result.archives || []);
    } catch (error) {
      console.error('[Database Control] Could not load server archives:', error);
      setArchiveListError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingArchives(false);
    }
  };

  // Refresh DB stats and local snapshots
  const refreshData = async () => {
    try {
      setIsLoadingStats(true);
      const [summary, snapshots] = await Promise.all([
        getDatabaseStatisticsSummary(),
        Promise.resolve(getLocalBrowserSnapshots())
      ]);
      setStats(summary);
      setLocalSnapshots(snapshots);
    } catch (err) {
      console.error('Error fetching database summary:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Loads the CURRENT year directly from the centralized database (not the
  // local cache) so the admin is always confirming against the live state —
  // the server re-validates this same id before making any changes.
  const loadCurrentYearForReset = async () => {
    setIsLoadingCurrentYear(true);
    try {
      const year = await cloudGetSundaySchoolYear();
      setCurrentYearId(year?.id || null);
      setCurrentYearName(year?.yearName || '(Unnamed Year)');
    } catch (err) {
      console.error('Error loading current Sunday School year:', err);
      setCurrentYearId(null);
      setCurrentYearName('');
    } finally {
      setIsLoadingCurrentYear(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const safeInitialTab = initialTab === 'RESET' && !canAccessReset ? 'SAVE' : initialTab;
      setActiveTab(safeInitialTab);
      setFileError(null);
      setSelectedFile(null);
      setRawParsedJson(null);
      setPreviewResult(null);
      setRestoreSuccess(null);
      setResetSuccess(null);
      setExportSuccessMsg(null);
      setIsRestoring(false);
      setIsResetting(false);
      setResetConfirmInput('');
      setRestoreStepText('');
      setResetStepText('');
      setRestoreProgressPct(0);
      setResetProgressPct(0);
      setConfirmDeleteSnapshotId(null);
      setNewYearName('');
      setNewOverallTheme('');
      setFactoryResetConfirm('');
      setFullResetConfirm('');
      setFactoryResetError('');
      setStagedResetSuccess('');
      refreshData();
      if (canAccessReset) {
        loadCurrentYearForReset();
        void loadServerArchives();
      }
    }
  }, [isOpen, initialTab, canAccessReset]);

  if (!isOpen) return null;

  // Handle Pure Data Export File Download
  const handleDownloadFile = async () => {
    try {
      setIsExporting(true);
      setExportSuccessMsg(null);
      const res = await downloadDataOnlyBackupFile(customLabel.trim() || undefined);
      setExportSuccessMsg(`Successfully exported data to "${res.filename}" (${Math.round(res.sizeBytes / 1024)} KB)`);
      setCustomLabel('');
      playSuccessSound();
    } catch (err: any) {
      setExportSuccessMsg(`Export error: ${err.message || 'Failed to export data'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Save In-Browser Snapshot
  const handleSaveLocalSnapshot = async () => {
    try {
      setIsSavingSnapshot(true);
      await saveLocalBrowserSnapshot(snapshotLabel.trim() || undefined);
      setSnapshotLabel('');
      setLocalSnapshots(getLocalBrowserSnapshots());
      setExportSuccessMsg('Local instant safety snapshot saved into browser storage.');
      setTimeout(() => setExportSuccessMsg(null), 3500);
      playSuccessSound();
    } catch (err: any) {
      setExportSuccessMsg(`Snapshot error: ${err.message}`);
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  // Handle Delete Snapshot with safety
  const handleDeleteSnapshot = (id: string) => {
    deleteLocalBrowserSnapshot(id);
    setLocalSnapshots(getLocalBrowserSnapshots());
    setConfirmDeleteSnapshotId(null);
  };

  // Handle File Selection & Instant Validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setSelectedFile(file);
    setFileError(null);
    setRestoreSuccess(null);
    setRestoreStepText('');
    setRestoreProgressPct(0);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);
        setRawParsedJson(json);

        // Validate and generate structured preview
        const validation = validateAndPreviewDataBackup(json);
        if (!validation.isValid) {
          setFileError(validation.errorMessage || 'Invalid backup file format.');
          setPreviewResult(null);
        } else {
          setPreviewResult(validation);
          setFileError(null);
        }
      } catch (err: any) {
        setFileError(`Failed to parse JSON file: ${err.message}`);
        setPreviewResult(null);
        setRawParsedJson(null);
      }
    };
    reader.onerror = () => {
      setFileError('Could not read the selected file from disk.');
      setPreviewResult(null);
      setRawParsedJson(null);
    };
    reader.readAsText(file);
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Trigger Data-Only Import
  const handleExecuteImport = async () => {
    if (!rawParsedJson || isRestoring || !previewResult?.isValid) return;

    setFileError(null);
    setRestoreSuccess(null);
    setIsRestoring(true);

    try {
      const result = await executeDataOnlyImport(
        rawParsedJson,
        importMode,
        (stepText, progressPct) => {
          setRestoreStepText(stepText);
          setRestoreProgressPct(progressPct);
        }
      );

      await sleep(300);
      setRestoreSuccess(result);

      // Play success chime & celebratory particles
      playSuccessSound();
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 }
      });

      // Refresh local database summary
      await refreshData();

      // Notify parent app
      if (onDatabaseRestored) {
        onDatabaseRestored();
      }
    } catch (err: any) {
      setFileError(`Data import failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Trigger Restore from Local Snapshot
  const handleRestoreSnapshot = async (id: string) => {
    if (isRestoring) return;

    setFileError(null);
    setRestoreSuccess(null);
    setIsRestoring(true);

    try {
      setRestoreStepText('📦 Reading saved local safety snapshot...');
      setRestoreProgressPct(30);
      await sleep(200);

      setRestoreStepText('⚡ Restoring local database stores & profiles...');
      setRestoreProgressPct(75);

      const result = await restoreLocalBrowserSnapshot(id, true);

      setRestoreProgressPct(100);
      setRestoreStepText('✅ Snapshot restored successfully!');

      setRestoreSuccess({
        success: true,
        message: result.message,
        mode: 'REPLACE_DATA',
        restoredCounts: {
          totalAdminProfiles: result.restoredCounts.adminProfiles,
          totalClasses: result.restoredCounts.classes,
          totalStudents: result.restoredCounts.members,
          totalVisitors: 0,
          totalMembers: result.restoredCounts.members,
          totalWorkers: result.restoredCounts.workers,
          totalGrades: result.restoredCounts.grades,
          totalOfferings: result.restoredCounts.offerings,
          totalAbsenceLogs: result.restoredCounts.absenceLogs,
          totalReferrals: result.restoredCounts.referrals,
          totalWorkerAttendance: result.restoredCounts.workerAttendance,
          totalWorkerPrepAttendance: result.restoredCounts.workerPrepAttendance,
          totalSpecialEvents: 0,
          totalSpecialEventAttendance: 0,
          totalAdminComments: 0,
          totalTreasuryExpenditures: 0,
          totalDepartments: result.restoredCounts.departments,
          totalWorkerCategories: result.restoredCounts.categories,
          totalLessons: result.restoredCounts.lessons,
          className: 'Restored Snapshot',
          department: 'General'
        }
      });

      playSuccessSound();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });

      await refreshData();
      if (onDatabaseRestored) {
        onDatabaseRestored();
      }
    } catch (err: any) {
      setFileError(`Snapshot restore failed: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle Server-Side Year Reset ("Start New Year")
  const handleExecuteReset = async () => {
    if (isResetting || isRestoring) return;
    if (resetConfirmInput.trim().toUpperCase() !== 'RESET') {
      setFileError('Security confirmation required: Please type the word RESET to confirm.');
      return;
    }
    if (!currentYearId) {
      setFileError('Could not confirm the current Sunday School year from the server. Please close and reopen this dialog and try again.');
      return;
    }
    if (!newYearName.trim()) {
      setFileError('Please enter a name for the new Sunday School year (e.g. "2026–2027").');
      return;
    }

    setFileError(null);
    setResetSuccess(null);
    setRestoreSuccess(null);
    setIsResetting(true);

    try {
      setResetStepText('🗄️ Archiving the current year\'s records...');
      setResetProgressPct(20);

      setResetStepText('🧹 Clearing this year\'s rosters, grades, offerings, and attendance from the central database...');
      setResetProgressPct(45);

      const result = await resetYearOnServer({
        confirmYearId: currentYearId,
        newYearName: newYearName.trim(),
        newOverallTheme: newOverallTheme.trim()
      });

      if (!result.success) {
        throw new Error(result.error || 'The server rejected the reset request.');
      }

      setResetStepText('☁️ Syncing the new year down to this device...');
      setResetProgressPct(80);
      await hydrateLocalFromCloud();

      setResetProgressPct(100);
      setResetStepText('✅ New year started!');
      setResetSuccess(
        `"${result.newYearName}" is now the active Sunday School year. The previous year's records have been safely archived and cleared from every device. ${result.classesReassigned || 0} class(es) have had their secretary, teachers, and password cleared — each will be asked to set up fresh when next opened. ${result.workersReassigned || 0} worker(s) have had their duty assignments cleared and are ready to be reassigned. Users, roles, the worker directory, and the class list itself were not affected — use the Workers Directory separately to add new workers or remove departing ones.`
      );

      playSuccessSound();
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 }
      });

      setResetConfirmInput('');
      setNewYearName('');
      setNewOverallTheme('');
      await refreshData();

      if (onDatabaseRestored) {
        onDatabaseRestored();
      }
    } catch (err: any) {
      setFileError(`Reset failed: ${err.message || 'Unknown error'}. No changes were applied — your data is intact.`);
    } finally {
      setIsResetting(false);
    }
  };

  const handleStagedReset = async () => {
    const expected = `RESET ${stagedResetScope}`;
    if (factoryResetConfirm.trim().toUpperCase() !== expected) {
      setFactoryResetError(`Type ${expected} exactly.`);
      return;
    }
    setIsFactoryResetting(true);
    setFactoryResetError('');
    try {
      const result = await stagedReset(stagedResetScope, expected);
      if (!result.success) throw new Error(result.error || 'The server rejected the staged reset.');
      await hydrateLocalFromCloud();
      setStagedResetSuccess(`${result.message} Recovery archive: ${result.archiveId || 'created by server'}.`);
      setFactoryResetConfirm('');
      await refreshData();
      await loadServerArchives();
      onDatabaseRestored?.();
    } catch (error) {
      console.error(`[Database Control] ${stagedResetScope} reset failed:`, error);
      setFactoryResetError(`${error instanceof Error ? error.message : String(error)} No unarchived reset is reported as successful.`);
    } finally {
      setIsFactoryResetting(false);
    }
  };

  const handleFullFactoryReset = async () => {
    if (fullResetConfirm !== 'FACTORY RESET GOFAMINT') {
      setFactoryResetError('Type FACTORY RESET GOFAMINT exactly.');
      return;
    }
    setIsFactoryResetting(true);
    setFactoryResetError('');
    try {
      const result = await factoryReset(fullResetConfirm);
      if (!result.success) throw new Error(result.error || 'The server rejected the full reset.');
      await performLocalFactoryReset();
      await signOutUser();
      window.location.reload();
    } catch (error) {
      console.error('[Database Control] Full factory reset failed:', error);
      setFactoryResetError(error instanceof Error ? error.message : String(error));
      setIsFactoryResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-blue-900 text-white px-5 py-4 flex items-center justify-between border-b-4 border-amber-500 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-700 flex items-center justify-center text-amber-400 shadow-inner">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-blue-950 px-2 py-0.5 rounded border border-blue-800">
                  DATA-ONLY BACKUP & RESTORE
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight font-['Cinzel',serif] text-white">
                Export & Import Church Data
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-blue-950/60 hover:bg-blue-800 text-blue-200 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative Separation Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center gap-2.5 text-xs text-amber-900 shrink-0">
          <Shield className="w-4 h-4 text-amber-700 shrink-0" />
          <p className="leading-snug">
            <strong>Data & Application are strictly separated:</strong> Exporting/importing transfers persistent church records only. It will <strong>never</strong> revert or overwrite newer application features, UI, or code across accounts.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 border-b border-slate-200 px-5 pt-3 flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            id="tab-save-db"
            onClick={() => {
              if (!isRestoring && !isResetting) setActiveTab('SAVE');
            }}
            className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-black flex items-center gap-2 transition border-t border-x shrink-0 ${
              activeTab === 'SAVE'
                ? 'bg-white text-blue-950 border-slate-200 -mb-px shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Download className="w-4 h-4 text-amber-600" />
            <span>💾 Export Data (JSON)</span>
          </button>

          <button
            id="tab-load-db"
            onClick={() => {
              if (!isRestoring && !isResetting) setActiveTab('LOAD');
            }}
            className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-black flex items-center gap-2 transition border-t border-x shrink-0 ${
              activeTab === 'LOAD'
                ? 'bg-white text-blue-950 border-slate-200 -mb-px shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>📂 Import Data</span>
          </button>

          {canAccessReset && (
            <button
              id="tab-reset-db"
              onClick={() => {
                if (!isRestoring && !isResetting) setActiveTab('RESET');
              }}
              className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-black flex items-center gap-2 transition border-t border-x shrink-0 ${
                activeTab === 'RESET'
                  ? 'bg-white text-rose-950 border-slate-200 -mb-px shadow-xs ring-1 ring-rose-300'
                  : 'text-rose-700 hover:text-rose-900 border-transparent hover:bg-rose-100/60'
              }`}
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>🗓️ Start New Year</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: EXPORT DATA */}
          {activeTab === 'SAVE' && (
            <div className="space-y-6">
              
              {/* Current Database Summary Grid */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <HardDrive className="w-4 h-4 text-blue-900" />
                    <span>Church Records Ready for Data-Only Export</span>
                  </div>
                  <button
                    onClick={refreshData}
                    className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingStats ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {isLoadingStats ? (
                  <div className="py-6 text-center text-xs text-slate-500">Calculating database records...</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                      <div className="text-xl font-black text-slate-900">{stats?.totalMembers || 0}</div>
                      <div className="text-[10px] font-bold uppercase text-slate-500 mt-0.5">Students & Visitors</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                      <div className="text-xl font-black text-emerald-700">{stats?.totalGrades || 0}</div>
                      <div className="text-[10px] font-bold uppercase text-slate-500 mt-0.5">12-Week Grades</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                      <div className="text-xl font-black text-blue-900">{stats?.totalWorkers || 0}</div>
                      <div className="text-[10px] font-bold uppercase text-slate-500 mt-0.5">Workers Enrolled</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                      <div className="text-xl font-black text-amber-700">{stats?.totalWorkerAttendance || 0}</div>
                      <div className="text-[10px] font-bold uppercase text-slate-500 mt-0.5">Attendance Records</div>
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
                  <div>
                    Active Class: <strong className="text-slate-900">{stats?.className || 'None'}</strong> ({stats?.department || 'General'})
                  </div>
                  <div>
                    Admin Profiles: <strong className="text-blue-950">{stats?.totalAdminProfiles || 0}</strong>
                  </div>
                  <div>
                    Theme: <span className="font-semibold text-blue-900">{stats?.yearTheme || 'Sunday School Year'}</span>
                  </div>
                </div>
              </div>

              {/* Main Action: Download JSON Data Backup */}
              <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white rounded-xl p-5 sm:p-6 shadow-md border border-blue-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-400 text-blue-950 text-[10px] font-black uppercase px-2 py-0.5 rounded">
                        DATA-ONLY EXPORT
                      </span>
                      <span className="text-xs text-blue-200">Filename: gofamint-data-backup-YYYY-MM-DD.json</span>
                    </div>
                    <h3 className="text-lg font-black text-white mt-1 font-['Cinzel',serif]">
                      Export Data to JSON File
                    </h3>
                    <p className="text-xs text-blue-200 mt-1 max-w-md leading-relaxed">
                      Exports all persistent church records (members, workers, weekly grades, offerings, accounts, curriculum). Contains <strong>no code or UI state</strong> so it can be safely transferred to remixed versions.
                    </p>
                  </div>

                  <button
                    id="btn-export-data-only"
                    onClick={handleDownloadFile}
                    disabled={isExporting}
                    className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-blue-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 shrink-0 cursor-pointer"
                  >
                    <Download className="w-5 h-5 text-blue-950" />
                    <span>{isExporting ? 'Exporting Data...' : 'Export Data (JSON)'}</span>
                  </button>
                </div>

                {/* Optional Custom Label */}
                <div className="mt-4 pt-4 border-t border-blue-800/80 flex flex-col sm:flex-row items-center gap-2 text-xs">
                  <span className="text-blue-300 whitespace-nowrap">Optional Note/Label:</span>
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="e.g. 2026_End_Quarter_1"
                    className="flex-1 bg-blue-950/70 border border-blue-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-blue-400/60 focus:outline-none focus:border-amber-400 w-full"
                  />
                </div>
              </div>

              {exportSuccessMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{exportSuccessMsg}</span>
                  </div>
                  <button onClick={() => setExportSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-950">
                    ✕
                  </button>
                </div>
              )}

              {/* In-Browser Safety Snapshots */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-900" />
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                      Instant In-Browser Safety Snapshots
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">Quick 1-click offline checkpoints</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <input
                    type="text"
                    value={snapshotLabel}
                    onChange={(e) => setSnapshotLabel(e.target.value)}
                    placeholder="Snapshot label (e.g. Before Week 7 Entry)..."
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 w-full"
                  />
                  <button
                    onClick={handleSaveLocalSnapshot}
                    disabled={isSavingSnapshot}
                    className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs whitespace-nowrap w-full sm:w-auto justify-center"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>{isSavingSnapshot ? 'Saving...' : 'Save Safety Snapshot'}</span>
                  </button>
                </div>

                {/* Saved Snapshots List */}
                {localSnapshots.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    No browser snapshots saved yet. Create one above for quick rollback points.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {localSnapshots.map((snap) => (
                      <div
                        key={snap.id}
                        className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{snap.label}</span>
                            <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                              {new Date(snap.createdAt).toLocaleDateString()} {new Date(snap.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {snap.summary?.className || 'Database'} • {snap.summary?.totalMembers || 0} Members • {snap.summary?.totalGrades || 0} Grades • {snap.summary?.totalWorkers || 0} Workers
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {confirmDeleteSnapshotId === snap.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-red-600 font-bold">Delete?</span>
                              <button
                                onClick={() => handleDeleteSnapshot(snap.id)}
                                className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmDeleteSnapshotId(null)}
                                className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleRestoreSnapshot(snap.id)}
                                disabled={isRestoring}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                              >
                                <Upload className="w-3 h-3" />
                                <span>Load</span>
                              </button>
                              <button
                                onClick={() => setConfirmDeleteSnapshotId(snap.id)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                                title="Delete snapshot"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: IMPORT DATA */}
          {activeTab === 'LOAD' && (
            <div className="space-y-6">
              
              {/* File Drop & Select Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => !isRestoring && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition flex flex-col items-center justify-center space-y-3 ${
                  isRestoring
                    ? 'border-slate-300 bg-slate-50 cursor-not-allowed opacity-60'
                    : 'border-blue-400/80 bg-blue-50/50 hover:bg-blue-50/90 cursor-pointer'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-white border border-blue-200 flex items-center justify-center text-blue-900 shadow-xs">
                  <FileJson className="w-7 h-7 text-blue-900" />
                </div>

                <div>
                  <h4 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                    {selectedFile ? selectedFile.name : 'Select or Drag & Drop Backup File (.json)'}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    {selectedFile
                      ? `File size: ${Math.round(selectedFile.size / 1024)} KB`
                      : 'Choose your previously exported GOFAMINT_HOF data backup JSON file.'}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isRestoring}
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-300" />
                  <span>Browse Device Files</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isRestoring}
                />
              </div>

              {fileError && (
                <div className="p-4 bg-red-50 border border-red-300 rounded-xl text-xs text-red-800 flex items-start gap-2 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Backup File Issue:</strong> {fileError}
                  </div>
                </div>
              )}

              {/* LIVE IMPORT IN PROGRESS BANNER */}
              {isRestoring && (
                <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white border-2 border-amber-400 rounded-2xl p-5 shadow-xl space-y-3.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-400 text-blue-950 flex items-center justify-center font-black animate-spin shadow-md">
                        <Loader2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-amber-300 bg-blue-950 px-2 py-0.5 rounded border border-blue-800">
                            DATA IMPORT IN PROGRESS
                          </span>
                          <span className="text-xs text-amber-200 font-bold">{restoreProgressPct}%</span>
                        </div>
                        <h4 className="text-sm sm:text-base font-black text-white mt-0.5">
                          Populating Church Records into Current Application...
                        </h4>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-blue-950/80 rounded-full h-3 p-0.5 border border-blue-700 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-sm"
                      style={{ width: `${restoreProgressPct}%` }}
                    />
                  </div>

                  {/* Current Active Sub-task Step */}
                  <div className="bg-blue-950/60 rounded-lg px-3 py-2 border border-blue-800/80 flex items-center gap-2 text-xs text-blue-100 font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0 animate-pulse" />
                    <span>{restoreStepText || 'Importing church records...'}</span>
                  </div>
                </div>
              )}

              {/* DETAILED IMPORT PREVIEW (PREVIEW REQUIREMENTS MET) */}
              {previewResult && previewResult.isValid && !isRestoring && !restoreSuccess && (
                <div className="bg-slate-50 border-2 border-emerald-500/60 rounded-2xl p-5 space-y-4 animate-fade-in shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      <div>
                        <h4 className="text-sm font-black text-slate-900">
                          Data Backup Verified & Ready for Import
                        </h4>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {previewResult.backupDate ? `Exported on: ${new Date(previewResult.backupDate).toLocaleString()}` : 'Valid format'} • Schema v{previewResult.schemaVersion || '2.0'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300">
                      Validated
                    </span>
                  </div>

                  {/* Detailed Entity Counts Grid */}
                  <div>
                    <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                      <span>Records to be imported:</span>
                      <span className="text-slate-500 font-normal">IDs will be preserved</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                        <div className="text-lg font-black text-blue-900">
                          {previewResult.summary.totalStudents}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Students</div>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                        <div className="text-lg font-black text-purple-700">
                          {previewResult.summary.totalVisitors}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Visitors</div>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                        <div className="text-lg font-black text-emerald-700">
                          {previewResult.summary.totalGrades}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">12-Week Grades</div>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                        <div className="text-lg font-black text-amber-700">
                          {previewResult.summary.totalOfferings}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Offerings Logged</div>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                        <div className="text-lg font-black text-slate-900">
                          {previewResult.summary.totalWorkers}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Workers Directory</div>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                        <div className="text-lg font-black text-indigo-700">
                          {previewResult.summary.totalWorkerAttendance}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Sunday Clock-Ins</div>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                        <div className="text-lg font-black text-teal-700">
                          {previewResult.summary.totalWorkerPrepAttendance}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Thursday Prep Logs</div>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                        <div className="text-lg font-black text-rose-700">
                          {previewResult.summary.totalAdminProfiles}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Admin Profiles</div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Metadata Breakdown */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <strong>Class Name:</strong> {previewResult.summary.className} ({previewResult.summary.department})
                      </div>
                      <div>
                        <strong>Classes:</strong> {previewResult.summary.totalClasses} registered
                      </div>
                    </div>
                    {previewResult.summary.yearTheme && (
                      <div>
                        <strong>Year Theme:</strong> {previewResult.summary.yearTheme}
                      </div>
                    )}
                    <div className="text-slate-500 text-[11px] pt-1">
                      Absence Logs: {previewResult.summary.totalAbsenceLogs} • Referrals: {previewResult.summary.totalReferrals} • Discussions: {previewResult.summary.totalAdminComments} • Expenditures: {previewResult.summary.totalTreasuryExpenditures}
                    </div>
                  </div>

                  {/* Import Mode Options */}
                  <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-2">
                    <div className="text-xs font-bold text-blue-950">Select Import Mode:</div>
                    <div className="space-y-1.5">
                      <label className="flex items-start gap-2 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'REPLACE_DATA'}
                          onChange={() => setImportMode('REPLACE_DATA')}
                          className="mt-0.5 text-blue-900 focus:ring-blue-600"
                        />
                        <div>
                          <strong className="text-slate-900">Clean Data Populate (Recommended)</strong>
                          <div className="text-slate-500 text-[11px]">
                            Clears data records and populates with backup. Application code and new features remain 100% untouched.
                          </div>
                        </div>
                      </label>

                      <label className="flex items-start gap-2 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'MERGE_DATA'}
                          onChange={() => setImportMode('MERGE_DATA')}
                          className="mt-0.5 text-blue-900 focus:ring-blue-600"
                        />
                        <div>
                          <strong className="text-slate-900">Merge & Upsert Data</strong>
                          <div className="text-slate-500 text-[11px]">
                            Merges backup records with existing data by unique ID without creating duplicate entries.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-100 p-2.5 rounded-lg">
                    <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Automatic safety backup will be created in your browser before import.</span>
                  </div>

                  {/* Dual Action Buttons: Import Data & Cancel */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                    <button
                      id="btn-execute-data-import"
                      onClick={handleExecuteImport}
                      disabled={isRestoring}
                      className="w-full sm:flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-98 cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-amber-300" />
                      <span>⚡ Import Data Now</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewResult(null);
                        setRawParsedJson(null);
                      }}
                      className="w-full sm:w-auto px-5 py-3.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* IMPORT SUCCESS NOTIFICATION CARD */}
              {restoreSuccess && (
                <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-6 space-y-4 shadow-xl animate-fade-in">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-emerald-900 bg-emerald-200 px-2 py-0.5 rounded border border-emerald-300">
                          DATA IMPORT SUCCESSFUL
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-emerald-950 mt-1">
                        Church Records Successfully Loaded!
                      </h3>
                      <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
                        {restoreSuccess.message}
                      </p>
                    </div>
                  </div>

                  {/* Summary Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    <div className="bg-white p-2 rounded-lg border border-emerald-200 text-center">
                      <div className="text-base font-black text-emerald-800">{restoreSuccess.restoredCounts.totalMembers}</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Members</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-200 text-center">
                      <div className="text-base font-black text-emerald-800">{restoreSuccess.restoredCounts.totalGrades}</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Grades</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-200 text-center">
                      <div className="text-base font-black text-emerald-800">{restoreSuccess.restoredCounts.totalWorkers}</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Workers</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-200 text-center">
                      <div className="text-base font-black text-emerald-800">{restoreSuccess.restoredCounts.totalAdminProfiles}</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Admin Profiles</div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      id="btn-confirm-import-done"
                      onClick={onClose}
                      className="w-full sm:w-auto px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
                    >
                      <span>🚀 Continue & View Data</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: START NEW YEAR (server-side reset) */}
          {activeTab === 'RESET' && canAccessReset && (
            <div className="space-y-6 animate-fade-in">

              <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-rose-950 font-['Cinzel',serif]">
                      Start New Sunday School Year
                    </h4>
                    <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                      This clears the CURRENT year's operational records from the central database — on every device, for everyone — and rotates in a new year. It is not a full data wipe.
                    </p>
                  </div>
                </div>

                <div className="bg-white/80 rounded-xl p-3 border border-rose-200 text-xs text-slate-700 space-y-2">
                  <div>
                    <div className="font-bold text-rose-800">Will be cleared for the new year:</div>
                    <ul className="list-disc pl-5 space-y-0.5 text-slate-600">
                      <li>Member & visitor rosters, quarter enrollments</li>
                      <li>Weekly grades, offerings, and absence/welfare logs</li>
                      <li>Evangelism referrals and admin comments</li>
                      <li>Worker Sunday & preparatory-class attendance</li>
                      <li>Special events and their attendance</li>
                      <li>Treasury expenditures and the lesson curriculum</li>
                      <li>Teacher/Class Secretary login identities and each class's annual teacher, secretary, and password assignment — new class logins must be provisioned for the new year</li>
                      <li>Each worker's assigned class, duty, and category roles (cleared for reassignment — their directory profile stays, so you can still add new workers or remove departing ones separately in the Workers Directory)</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-bold text-emerald-800">Will NOT be touched:</div>
                    <ul className="list-disc pl-5 space-y-0.5 text-slate-600">
                      <li>General Superintendent, administrative officer, and worker login identities and roles</li>
                      <li>The list of classes and departments</li>
                      <li>The worker directory (names, phone, QR code, status) and worker categories/clock-in settings</li>
                      <li>The outgoing year — it is archived, not deleted, along with who held each class/duty this past year</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* LIVE RESET PROGRESS */}
              {isResetting && (
                <div className="bg-gradient-to-r from-rose-950 via-red-900 to-rose-950 text-white border-2 border-rose-400 rounded-2xl p-5 shadow-xl space-y-3.5 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center font-black animate-spin shadow-md">
                      <Loader2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-rose-200 bg-rose-950 px-2 py-0.5 rounded border border-rose-800">
                          RESET IN PROGRESS
                        </span>
                        <span className="text-xs text-rose-200 font-bold">{resetProgressPct}%</span>
                      </div>
                      <h4 className="text-sm sm:text-base font-black text-white mt-0.5">
                        Resetting the Central Database...
                      </h4>
                    </div>
                  </div>

                  <div className="w-full bg-rose-950/80 rounded-full h-3 p-0.5 border border-rose-800 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-rose-400 to-amber-400 h-full rounded-full transition-all duration-300 shadow-sm"
                      style={{ width: `${resetProgressPct}%` }}
                    />
                  </div>

                  <div className="bg-rose-950/60 rounded-lg px-3 py-2 border border-rose-800/80 flex items-center gap-2 text-xs text-rose-100 font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0 animate-pulse" />
                    <span>{resetStepText || 'Working...'}</span>
                  </div>
                </div>
              )}

              {/* RESET SUCCESS */}
              {resetSuccess && (
                <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-6 space-y-4 shadow-xl animate-fade-in">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] font-black uppercase text-emerald-900 bg-emerald-200 px-2 py-0.5 rounded border border-emerald-300">
                        NEW YEAR STARTED
                      </span>
                      <h3 className="text-lg font-black text-emerald-950 mt-1">
                        The New Sunday School Year Is Active!
                      </h3>
                      <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
                        {resetSuccess}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end">
                    <button
                      id="btn-confirm-reset-done"
                      onClick={onClose}
                      className="w-full sm:w-auto px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
                    >
                      <span>🚀 Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* New Year Details & Confirmation */}
              {!isResetting && !resetSuccess && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Current year (confirmed against the live database):
                    </label>
                    <div className="px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 font-mono">
                      {isLoadingCurrentYear
                        ? 'Checking with the server...'
                        : currentYearId
                          ? currentYearName
                          : 'Could not confirm the current year — close and reopen this dialog.'}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      New Sunday School Year name:
                    </label>
                    <input
                      type="text"
                      value={newYearName}
                      onChange={(e) => {
                        setNewYearName(e.target.value);
                        setFileError(null);
                      }}
                      placeholder="e.g. 2026–2027"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Overall theme <span className="font-normal text-slate-400">(optional)</span>:
                    </label>
                    <input
                      type="text"
                      value={newOverallTheme}
                      onChange={(e) => setNewOverallTheme(e.target.value)}
                      placeholder="e.g. Walking in Divine Light and Truth (1 John 1:7)"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl text-xs text-slate-900"
                    />
                  </div>

                  {fileError && (
                    <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>{fileError}</div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-800 block mb-1">
                        Type <code className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded font-black">RESET</code> to confirm:
                      </label>
                      <input
                        type="text"
                        value={resetConfirmInput}
                        onChange={(e) => {
                          setResetConfirmInput(e.target.value);
                          setFileError(null);
                        }}
                        placeholder="Type RESET here"
                        className="w-full px-3.5 py-2.5 bg-white border-2 border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 rounded-xl text-xs font-mono text-slate-900"
                      />
                    </div>

                    <button
                      id="btn-execute-reset-database"
                      onClick={handleExecuteReset}
                      disabled={isResetting || !currentYearId || !newYearName.trim() || resetConfirmInput.trim().toUpperCase() !== 'RESET'}
                      className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-98 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Reset {currentYearName || 'Current Year'} & Start New Year</span>
                    </button>
                  </div>
                </div>
              )}

              {!isResetting && !resetSuccess && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div><h4 className="font-black text-blue-950">Historical Server Archives</h4><p className="text-xs text-blue-800">Metadata is lightweight; full archive data downloads only when requested.</p></div>
                    <button type="button" onClick={() => void loadServerArchives()} disabled={isLoadingArchives} className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-900 disabled:opacity-50"><RefreshCw className={`inline h-3.5 w-3.5 mr-1 ${isLoadingArchives ? 'animate-spin' : ''}`} />Refresh</button>
                  </div>
                  {archiveListError && <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">Archive list failed: {archiveListError}</div>}
                  <div className="max-h-44 space-y-2 overflow-y-auto">
                    {serverArchives.map(archive => <div key={archive.id} className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white p-3"><div className="min-w-0"><div className="truncate text-xs font-black text-slate-900">{archive.scope} • {archive.archive_type.replace(/_/g, ' ')}</div><div className="text-[11px] text-slate-500">{new Date(archive.archived_at).toLocaleString()} • {archive.id}</div></div><button type="button" onClick={() => void downloadDatabaseArchive(archive.id).catch(error => setArchiveListError(error instanceof Error ? error.message : String(error)))} className="shrink-0 rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-bold text-white"><Download className="inline h-3.5 w-3.5 mr-1" />Download</button></div>)}
                    {!isLoadingArchives && serverArchives.length === 0 && !archiveListError && <p className="py-3 text-center text-xs text-slate-500">No server archive has been created yet.</p>}
                  </div>
                </div>
              )}

              {!isResetting && !resetSuccess && (
                <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-6 h-6 text-red-700 shrink-0" />
                    <div>
                      <h4 className="font-black text-red-950">Staged Database Reset Controls</h4>
                      <p className="mt-1 text-xs leading-relaxed text-red-800">Every operation first writes a complete server-side recovery archive in the same database transaction. Only the General Superintendent can execute these controls.</p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {([
                      ['CLASSES', 'Classes DB', 'Class logins, classes, rosters and linked class records'],
                      ['WORKERS', 'Workers DB', 'Worker logins, directory, attendance, events and settings'],
                      ['ADMINS', 'Admin DB', 'Administrative accounts except the General Superintendent'],
                    ] as const).map(([scope, label, description]) => (
                      <button key={scope} type="button" onClick={() => { setStagedResetScope(scope); setFactoryResetConfirm(''); setFactoryResetError(''); }} className={`rounded-xl border p-3 text-left transition ${stagedResetScope === scope ? 'border-red-700 bg-white ring-2 ring-red-200' : 'border-red-200 bg-red-50/50 hover:bg-white'}`}>
                        <span className="block text-xs font-black text-red-950">{label}</span>
                        <span className="mt-1 block text-[11px] text-slate-600">{description}</span>
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-red-950">Type <code>RESET {stagedResetScope}</code> exactly:</label>
                    <input value={factoryResetConfirm} onChange={event => { setFactoryResetConfirm(event.target.value); setFactoryResetError(''); }} className="w-full rounded-xl border-2 border-red-300 bg-white px-3.5 py-2.5 font-mono text-xs text-slate-950 focus:border-red-600 outline-hidden" />
                  </div>
                  <button type="button" onClick={() => void handleStagedReset()} disabled={isFactoryResetting || factoryResetConfirm.trim().toUpperCase() !== `RESET ${stagedResetScope}`} className="w-full rounded-xl bg-red-700 py-3 text-xs font-black text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40">
                    {isFactoryResetting ? 'Archiving and resetting…' : `Archive & Reset ${stagedResetScope}`}
                  </button>

                  <div className="border-t-2 border-red-200 pt-4 space-y-3">
                    <div className="text-xs font-black uppercase tracking-wide text-red-950">Full reset to first-time initialization</div>
                    <p className="text-xs text-red-800">Use only after all demo testing is complete and immediately before real deployment. The server keeps this disabled unless <code>FACTORY_RESET_ENABLED=true</code>.</p>
                    <input value={fullResetConfirm} onChange={event => { setFullResetConfirm(event.target.value); setFactoryResetError(''); }} placeholder="FACTORY RESET GOFAMINT" className="w-full rounded-xl border-2 border-red-400 bg-white px-3.5 py-2.5 font-mono text-xs text-slate-950 outline-hidden" />
                    <button type="button" onClick={() => void handleFullFactoryReset()} disabled={isFactoryResetting || fullResetConfirm !== 'FACTORY RESET GOFAMINT'} className="w-full rounded-xl bg-slate-950 py-3 text-xs font-black text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40">Archive & Return Entire System to Initialization</button>
                  </div>
                  {factoryResetError && <div className="rounded-xl border border-red-300 bg-white p-3 text-xs font-bold text-red-800">{factoryResetError}</div>}
                  {stagedResetSuccess && <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-900">{stagedResetSuccess}</div>}
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-blue-900" />
            <span>Encrypted local storage • Pure Data-Only backup guarantee</span>
          </div>

          <button
            onClick={onClose}
            disabled={isRestoring}
            className="px-4 py-1.5 bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 disabled:opacity-50 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
