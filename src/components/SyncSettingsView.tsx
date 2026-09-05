import React, { useState } from 'react';
import {
  CloudUpload,
  CloudDownload,
  Wifi,
  WifiOff,
  Server,
  Save,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Settings,
  Database,
  Download,
  Upload,
  Shield,
  Sparkles
} from 'lucide-react';
import {
  ClassProfile,
  Member,
  WeeklyGradeRecord,
  WeeklyOfferingRecord,
  AbsenceLogRecord,
  SyncQueueItem
} from '../types';
import { DatabaseBackupModal } from './DatabaseBackupModal';

interface SyncSettingsViewProps {
  classProfile: ClassProfile | null;
  members: Member[];
  grades: WeeklyGradeRecord[];
  offerings: WeeklyOfferingRecord[];
  absenceLogs: AbsenceLogRecord[];
  syncQueue: SyncQueueItem[];
  isOnline: boolean;
  isSyncing: boolean;
  onPushSync: () => Promise<void>;
  onPullSync: () => Promise<void>;
  onUpdateClassProfile: (profile: ClassProfile) => void;
  onClearDatabase?: () => void;
  onImportFullBackup?: (data: any) => void;
  onDatabaseRestored?: () => void;
}

export const SyncSettingsView: React.FC<SyncSettingsViewProps> = ({
  classProfile,
  members,
  grades,
  offerings,
  absenceLogs,
  syncQueue,
  isOnline,
  isSyncing,
  onPushSync,
  onPullSync,
  onUpdateClassProfile,
  onDatabaseRestored
}) => {
  const [hostIp, setHostIp] = useState(
    localStorage.getItem('gofamint_host_ip') || 'http://192.168.1.150:5000'
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Backup Modal Controls
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupModalInitialTab, setBackupModalInitialTab] = useState<'SAVE' | 'LOAD' | 'RESET'>('SAVE');

  // Edit Class Profile form fields
  const [className, setClassName] = useState(classProfile?.className || '');
  const [department, setDepartment] = useState(classProfile?.department || 'Young Adults');
  const [secretaryName, setSecretaryName] = useState(classProfile?.secretaryName || '');
  const [secretaryPhone, setSecretaryPhone] = useState(classProfile?.secretaryPhone || '');
  const [currencySymbol, setCurrencySymbol] = useState(classProfile?.currencySymbol || '₦');

  const handleSaveHostIp = () => {
    localStorage.setItem('gofamint_host_ip', hostIp.trim());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleTriggerPush = async () => {
    setSyncStatusMsg('Pushing local IndexedDB changes to Host Laptop central server...');
    try {
      await onPushSync();
      setSyncStatusMsg('Successfully synchronized local changes with central host database!');
    } catch (e: any) {
      setSyncStatusMsg(`Sync note: ${e.message || 'Host server unreachable over local Wi-Fi.'}`);
    }
  };

  const handleTriggerPull = async () => {
    setSyncStatusMsg('Pulling central roster & grades from host server...');
    try {
      await onPullSync();
      setSyncStatusMsg('Successfully pulled latest records into local IndexedDB!');
    } catch (e: any) {
      setSyncStatusMsg(`Pull note: ${e.message || 'Host server unreachable over local Wi-Fi.'}`);
    }
  };

  const handleSaveProfileChanges = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classProfile) return;

    const updated: ClassProfile = {
      ...classProfile,
      className: className.trim(),
      department: department as any,
      secretaryName: secretaryName.trim(),
      secretaryPhone: secretaryPhone.trim(),
      currencySymbol: currencySymbol.trim(),
      updatedAt: new Date().toISOString()
    };

    onUpdateClassProfile(updated);
    setSaveSuccess(true);
    setSyncStatusMsg('Class profile updated successfully!');
    setTimeout(() => {
      setSaveSuccess(false);
      setSyncStatusMsg(null);
    }, 3000);
  };

  const openExportModal = () => {
    setBackupModalInitialTab('SAVE');
    setIsBackupModalOpen(true);
  };

  const openImportModal = () => {
    setBackupModalInitialTab('LOAD');
    setIsBackupModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-lg p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
              DATA MANAGEMENT & SYNC ENGINE
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1 font-['Cinzel',serif]">
            Church Data Backup & Local Network Sync
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Export/import pure persistent records or synchronize over local Wi-Fi with the Central Host Server.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${
            isOnline
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-600" /> : <WifiOff className="w-3.5 h-3.5 text-red-600" />}
            <span>{isOnline ? 'Local Network Connected' : 'Offline / Standalone Mode'}</span>
          </div>
        </div>
      </div>

      {/* PROMINENT DATA-ONLY EXPORT & IMPORT HERO CARD */}
      <div className="bg-gradient-to-br from-blue-900 via-indigo-900 to-blue-950 text-white rounded-2xl p-5 sm:p-6 shadow-lg border border-blue-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-blue-950 text-[10px] font-black uppercase px-2 py-0.5 rounded">
                PURE DATA EXPORT & IMPORT
              </span>
              <span className="text-xs text-blue-200">Account & Remix Independent</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white mt-1 font-['Cinzel',serif]">
              Data-Only Backup & Transfer System
            </h3>
            <p className="text-xs text-blue-200 mt-1 max-w-xl leading-relaxed">
              Export your church records (students, workers, grades, offerings, accounts) to a standard JSON file. When you remix the app or open it under a different Google account, import your data without overwriting the newer code, UI, or features!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              id="btn-sync-export-data"
              onClick={openExportModal}
              className="px-4 py-3 bg-amber-500 hover:bg-amber-400 text-blue-950 font-black rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4 text-blue-950" />
              <span>Export Data (JSON)</span>
            </button>

            <button
              id="btn-sync-import-data"
              onClick={openImportModal}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-amber-300" />
              <span>Import Data</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-blue-800/80 flex items-center gap-2 text-xs text-blue-300">
          <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Strict separation: <strong>Application code remains master</strong>; only user/church records are transferred.</span>
        </div>
      </div>

      {syncStatusMsg && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
          <span>{syncStatusMsg}</span>
          <button onClick={() => setSyncStatusMsg(null)} className="text-slate-500 hover:text-slate-800 font-bold ml-3">
            Dismiss
          </button>
        </div>
      )}

      {/* Storage & Queue Statistics Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        
        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">IndexedDB Members</span>
            <HardDrive className="w-4 h-4 text-blue-900" />
          </div>
          <div className="text-2xl font-black text-slate-900">{members.length}</div>
          <span className="text-[10px] text-slate-500">Active Class Roster</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Quarter Grades</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{grades.length}</div>
          <span className="text-[10px] text-slate-500">Student & Visitor Records</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Offerings Logged</span>
            <Save className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{offerings.length}</div>
          <span className="text-[10px] text-slate-500">Weekly Sunday Collections</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Absence Logs</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{absenceLogs.length}</div>
          <span className="text-[10px] text-slate-500">Pastoral Follow-Up Records</span>
        </div>

      </div>

      {/* Sync Host Server Settings */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <Server className="w-5 h-5 text-blue-900" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Host Laptop Server Endpoint</h3>
            <p className="text-xs text-slate-500">Configure central database IP address on the church local Wi-Fi router.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <input
              type="text"
              value={hostIp}
              onChange={(e) => setHostIp(e.target.value)}
              placeholder="e.g. http://192.168.1.150:5000"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-blue-600 shadow-inner"
            />
          </div>

          <div>
            <button
              onClick={handleSaveHostIp}
              className="w-full h-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Save className="w-4 h-4 text-amber-400" />
              <span>{saveSuccess ? 'Saved Endpoint!' : 'Save Endpoint'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            id="btn-sync-push"
            onClick={handleTriggerPush}
            disabled={isSyncing}
            className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <CloudUpload className="w-4 h-4 text-amber-300" />
            <span>Push Local to Central Host</span>
          </button>

          <button
            id="btn-sync-pull"
            onClick={handleTriggerPull}
            disabled={isSyncing}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            <CloudDownload className="w-4 h-4 text-emerald-600" />
            <span>Pull Latest from Host</span>
          </button>
        </div>
      </div>

      {/* Class Profile Settings Form */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <Settings className="w-5 h-5 text-slate-500" />
          <h3 className="text-base font-bold text-slate-900">Class Profile & Configuration</h3>
        </div>

        <form onSubmit={handleSaveProfileChanges} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Class Name</label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Secretary Name</label>
              <input
                type="text"
                value={secretaryName}
                onChange={(e) => setSecretaryName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Secretary Phone</label>
              <input
                type="text"
                value={secretaryPhone}
                onChange={(e) => setSecretaryPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Currency Symbol</label>
              <input
                type="text"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-300" />
              <span>Save Class Profile Changes</span>
            </button>
          </div>
        </form>
      </div>

      {/* Embedded Data Backup & Restore Modal. This is a class-level settings
          screen, not an executive admin context — reset must never be
          offered here (canAccessReset defaults to false). */}
      <DatabaseBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        initialTab={backupModalInitialTab}
        onDatabaseRestored={() => {
          if (onDatabaseRestored) {
            onDatabaseRestored();
          }
        }}
      />

    </div>
  );
};
