import React, { useState, useMemo } from 'react';
import {
  Crown,
  ShieldCheck,
  CheckCircle,
  Clock,
  Users,
  Building,
  Check,
  X,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Sparkles,
  BookOpen,
  Award,
  Lock,
  ChevronRight,
  TrendingUp,
  FileCheck,
  School,
  Building2,
  ExternalLink,
  QrCode,
  Search,
  Filter,
  ArrowUpRight,
  CheckCircle2,
  Layers,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { AdminProfile, ClassProfile, SundaySchoolYear } from '../../types';
import { DepartmentClassExplorer } from './DepartmentClassExplorer';

interface GeneralSuperintendentViewProps {
  currentAdmin: AdminProfile;
  adminProfiles: AdminProfile[];
  allClasses: ClassProfile[];
  sundaySchoolYear: SundaySchoolYear;
  onApproveAdminProfile: (id: string, email?: string, roleType?: string) => Promise<void>;
  onApproveClass: (classId: string) => Promise<void>;
  onRefreshData: () => Promise<void>;
  onEnterAdminProfile: (profile: AdminProfile) => void;
  activeTab?: 'OVERVIEW' | 'PORTAL_OVERSIGHT' | 'CLASS_PORTAL_EXPLORER' | 'ALL_CLASSES';
  onTabChange?: (tab: 'OVERVIEW' | 'PORTAL_OVERSIGHT' | 'CLASS_PORTAL_EXPLORER' | 'ALL_CLASSES') => void;
}

export const GeneralSuperintendentView: React.FC<GeneralSuperintendentViewProps> = ({
  currentAdmin,
  adminProfiles,
  allClasses,
  sundaySchoolYear,
  onApproveAdminProfile,
  onApproveClass,
  onRefreshData,
  onEnterAdminProfile,
  activeTab: controlledTab,
  onTabChange
}) => {
  const [internalTab, setInternalTab] = useState<'OVERVIEW' | 'PORTAL_OVERSIGHT' | 'CLASS_PORTAL_EXPLORER' | 'ALL_CLASSES'>('OVERVIEW');
  const activeTab = controlledTab || internalTab;
  const setActiveTab = (tab: 'OVERVIEW' | 'PORTAL_OVERSIGHT' | 'CLASS_PORTAL_EXPLORER' | 'ALL_CLASSES') => {
    if (onTabChange) onTabChange(tab);
    else setInternalTab(tab);
  };

  const [explorerInitialClassId, setExplorerInitialClassId] = useState<string | undefined>(undefined);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchDirectoryQuery, setSearchDirectoryQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');

  const [localProfiles, setLocalProfiles] = useState<AdminProfile[]>(adminProfiles);

  React.useEffect(() => {
    setLocalProfiles(adminProfiles);
  }, [adminProfiles]);

  const pendingAdmins = localProfiles.filter(p => !p.isApproved && p.roleType !== 'GENERAL_SUPERINTENDENT');
  const approvedAdmins = localProfiles.filter(p => p.isApproved);
  const authorizedOfficerTotal = new Set(localProfiles.map(p => p.id)).size;
  const authorizedOfficerApproved = new Set(approvedAdmins.map(p => p.id)).size;
  const pendingClasses = allClasses.filter(c => String(c.approvalStatus || '').trim().toUpperCase() === 'PENDING_APPROVAL');
  const approvedClasses = allClasses.filter(c => String(c.approvalStatus || '').trim().toUpperCase() === 'APPROVED');

  // Department distribution calculation
  const deptStats = useMemo(() => {
    const map: Record<string, { name: string; count: number; approved: number }> = {};
    allClasses.forEach(cls => {
      const deptName = String(cls.department || 'General').trim();
      if (!map[deptName]) {
        map[deptName] = { name: deptName, count: 0, approved: 0 };
      }
      map[deptName].count += 1;
      if (cls.approvalStatus === 'APPROVED') {
        map[deptName].approved += 1;
      }
    });
    return Object.values(map);
  }, [allClasses]);

  // Filtered classes for Class Directory
  const filteredClasses = useMemo(() => {
    return allClasses.filter(cls => {
      const matchesSearch =
        searchDirectoryQuery === '' ||
        cls.className.toLowerCase().includes(searchDirectoryQuery.toLowerCase()) ||
        String(cls.secretaryName || '').toLowerCase().includes(searchDirectoryQuery.toLowerCase()) ||
        String(cls.department || '').toLowerCase().includes(searchDirectoryQuery.toLowerCase());
      
      const matchesDept =
        selectedDeptFilter === 'ALL' ||
        String(cls.department || '').trim().toLowerCase() === selectedDeptFilter.trim().toLowerCase();

      return matchesSearch && matchesDept;
    });
  }, [allClasses, searchDirectoryQuery, selectedDeptFilter]);

  const handleApproveAdmin = async (id: string, name: string, email?: string, roleType?: string) => {
    setProcessingId(id);
    setActionError(null);
    try {
      setLocalProfiles(prev => prev.map(p => p.id === id ? { ...p, isApproved: true, approvedBy: currentAdmin.profileName, approvedAt: new Date().toISOString() } : p));
      await onApproveAdminProfile(id, email, roleType);
      setActionSuccess(`Official appointment and administrative access successfully granted for ${name}.`);
      setTimeout(() => setActionSuccess(null), 5000);
      await onRefreshData();
    } catch (err: any) {
      console.error('Failed to approve admin profile:', err);
      setActionError(err?.message || `Failed to approve ${name}. Please retry.`);
      setTimeout(() => setActionError(null), 6000);
      await onRefreshData();
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveClass = async (classId: string, className: string) => {
    setProcessingId(classId);
    try {
      await onApproveClass(classId);
      setActionSuccess(`Class "${className}" has been approved and registered for active Sunday School lesson distribution.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await onRefreshData();
    } catch (err: any) {
      console.error('Failed to approve class:', err);
      setActionError(err?.message || `Failed to approve class ${className}.`);
      setTimeout(() => setActionError(null), 6000);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Feedback Toasts */}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-500/25 border border-emerald-400 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 backdrop-blur-md">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 bg-rose-500/25 border border-rose-400 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2 backdrop-blur-md">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TAB: EXECUTIVE OVERVIEW (ONLY Tab with Primary Authority Banner)       */}
      {/* ========================================================================= */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          
          {/* Hero Banner (Streamlined, punchy text, no verbosity) */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#290870] via-[#350e9e] to-[#4318ff] p-6 sm:p-7 text-white shadow-[0px_20px_50px_rgba(50,11,134,0.18)]">
            <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />
            <div className="absolute right-1/3 -bottom-16 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              {/* Top Authority & Academic Year Pill Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1 text-xs font-bold text-amber-300 backdrop-blur-md border border-white/20">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span className="uppercase tracking-wider">Primary Administrative Authority</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold text-purple-200 border border-white/15">
                    <span>Academic Year:</span>
                    <strong className="text-white font-bold">{sundaySchoolYear.yearName}</strong>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 border border-emerald-400/40 px-3 py-1 text-xs font-bold text-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Active Executive Session
                  </span>
                </div>
              </div>

              {/* Quick Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-purple-200 tracking-wider block">Active Quarter</span>
                  <span className="text-lg sm:text-xl font-black text-white mt-0.5 block">Q{sundaySchoolYear.activeQuarterNumber}</span>
                  <span className="text-[10px] text-amber-300 font-medium truncate block">Curriculum Active</span>
                </div>
                <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-purple-200 tracking-wider block">Council Officers</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-300 mt-0.5 block">{authorizedOfficerApproved}/{authorizedOfficerTotal}</span>
                  <span className="text-[10px] text-emerald-200 font-medium block">100% Operational</span>
                </div>
                <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-purple-200 tracking-wider block">Classes Approved</span>
                  <span className="text-lg sm:text-xl font-black text-white mt-0.5 block">{approvedClasses.length}</span>
                  <span className="text-[10px] text-purple-200 font-medium block">All Departments</span>
                </div>
                <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-purple-200 tracking-wider block">Pending Actions</span>
                  <span className={`text-lg sm:text-xl font-black mt-0.5 block ${pendingAdmins.length + pendingClasses.length > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {pendingAdmins.length + pendingClasses.length}
                  </span>
                  <span className="text-[10px] text-purple-200 font-medium block">
                    {pendingAdmins.length + pendingClasses.length === 0 ? 'All Cleared' : 'Needs Review'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Jobie KPI Stat Cards Grid (3 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            <div className="jobie-card p-5 flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Active Curriculum
                </span>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  Quarter {sundaySchoolYear.activeQuarterNumber}
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">
                  <Check className="w-3 h-3" /> Lessons Active
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
            </div>

            <div className="jobie-card p-5 flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Directorate Council
                </span>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {authorizedOfficerApproved} / {authorizedOfficerTotal}
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">
                  100% Operational
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="jobie-card p-5 flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Sunday School Classes
                </span>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {approvedClasses.length} Classes
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full mt-1">
                  All Approved
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <School className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Pending Action Required Banner (if any) */}
          {(pendingAdmins.length > 0 || pendingClasses.length > 0) && (
            <div className="jobie-card p-5 bg-gradient-to-r from-amber-50 to-amber-100/50 border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-amber-900">
                    Pending General Superintendent Authorizations
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    {pendingAdmins.length > 0 && `${pendingAdmins.length} officer credentials require confirmation. `}
                    {pendingClasses.length > 0 && `${pendingClasses.length} class registrations waiting for lesson dispatch.`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {pendingAdmins.length > 0 && (
                  <button
                    onClick={() => setActiveTab('PORTAL_OVERSIGHT')}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    Review Officers ({pendingAdmins.length})
                  </button>
                )}
                {pendingClasses.length > 0 && (
                  <button
                    onClick={() => setActiveTab('ALL_CLASSES')}
                    className="px-4 py-2 bg-[#320b86] hover:bg-[#290870] text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    Review Classes ({pendingClasses.length})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Jobie Visual Analytics Section (Charts) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Chart (7 cols): Department Coverage & Class Distribution */}
            <div className="lg:col-span-7 jobie-card p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Department Distribution & School Health
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real-time class spread and active Sunday School departments
                  </p>
                </div>
                <span className="text-xs font-bold text-[#320b86] bg-purple-50 px-3 py-1 rounded-full">
                  {allClasses.length} Total Units
                </span>
              </div>

              {/* Department Progress Bars */}
              <div className="space-y-4 pt-1">
                {deptStats.map((dept, idx) => {
                  const percentage = allClasses.length > 0 ? Math.round((dept.count / allClasses.length) * 100) : 0;
                  const colors = [
                    { bar: 'bg-[#320b86]', text: 'text-[#320b86]', bg: 'bg-purple-50' },
                    { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
                    { bar: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50' },
                    { bar: 'bg-amber-500', text: 'text-amber-800', bg: 'bg-amber-50' }
                  ];
                  const color = colors[idx % colors.length];

                  return (
                    <div key={dept.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">{dept.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-500">{dept.count} Classes</span>
                          <span className={`font-black text-[11px] px-2 py-0.5 rounded-full ${color.bg} ${color.text}`}>
                            {percentage}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${color.bar}`}
                          style={{ width: `${Math.max(percentage, 8)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end text-xs text-slate-500">
                <button
                  onClick={() => setActiveTab('ALL_CLASSES')}
                  className="text-xs font-bold text-[#320b86] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  View Class Directory <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right Chart (5 cols): Jobie Circular Donut Gauge */}
            <div className="lg:col-span-5 jobie-card p-6 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-slate-900">
                    Council Operational Strength
                  </h3>
                  <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Verified
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Credential verification rate across all officer portfolios
                </p>
              </div>

              <div className="py-2 flex items-center justify-center">
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#f1f5f9"
                      strokeWidth="12"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#320b86"
                      strokeWidth="12"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 * (1 - authorizedOfficerApproved / Math.max(authorizedOfficerTotal, 1))}
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-black text-slate-900">
                      {Math.round((authorizedOfficerApproved / Math.max(authorizedOfficerTotal, 1)) * 100)}%
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Authorized
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#320b86]" />
                    <span className="text-slate-600 font-medium">Approved Credentials</span>
                  </div>
                  <strong className="text-slate-900 font-bold">{authorizedOfficerApproved} Officers</strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="text-slate-600 font-medium">Pending Authorization</span>
                  </div>
                  <strong className="text-slate-900 font-bold">{pendingAdmins.length} Officers</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Directorate Executive Council (Compact: Showing only 2-3 officers + Oversight CTA) */}
          <div className="jobie-card p-6 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 font-['Cinzel',serif]">
                  Directorate Executive Council ({authorizedOfficerTotal} Portfolios)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Key secretariat & department leaders presiding over Sunday School operations
                </p>
              </div>
              <button
                onClick={() => setActiveTab('PORTAL_OVERSIGHT')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#320b86] bg-purple-50 px-4 py-2 rounded-xl hover:bg-purple-100 transition cursor-pointer"
              >
                <span>Full Oversight Panel ({authorizedOfficerTotal})</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Exactly 2 or 3 Officers Displayed (as requested) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminProfiles.slice(0, 3).map((profile) => (
                <div
                  key={profile.id}
                  className="rounded-2xl border border-slate-150 p-4 bg-white hover:border-[#320b86]/40 hover:shadow-md transition-all duration-200 space-y-3 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#320b86] to-[#4318ff] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                        {profile.profileName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#320b86] block truncate">
                          {profile.title}
                        </span>
                        <h4 className="text-sm font-black text-slate-900 truncate">
                          {profile.profileName}
                        </h4>
                      </div>
                    </div>

                    {profile.isApproved ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                    <code className="text-xs font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md truncate max-w-[160px]">
                      {profile.username}
                    </code>
                    {profile.roleType !== currentAdmin.roleType && profile.isApproved && (
                      <button
                        type="button"
                        onClick={() => onEnterAdminProfile(profile)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#320b86] group-hover:text-[#4318ff] hover:underline cursor-pointer"
                      >
                        <span>Oversight</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TAB: OFFICER PORTALS & APPROVALS (MERGED!)                             */}
      {/* ========================================================================= */}
      {activeTab === 'PORTAL_OVERSIGHT' && (
        <div className="space-y-6">
          
          {/* Header Title (Clean, NO Primary Administrative Authority banner) */}
          <div className="jobie-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
                Officer Portals & Credential Approvals
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Executive oversight access into administrative portals and credential authorizations
              </p>
            </div>
            {pendingAdmins.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>All Officer Credentials Authorized</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-black border border-amber-300">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                <span>{pendingAdmins.length} Credential(s) Awaiting Approval</span>
              </span>
            )}
          </div>

          {/* Pending Officer Approvals Section (Prominently displayed at top if any exist) */}
          {pendingAdmins.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <h4 className="text-sm font-black text-amber-900 uppercase tracking-wider">
                  Pending Officer Authorizations ({pendingAdmins.length})
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingAdmins.map((admin) => (
                  <div key={admin.id} className="jobie-card border-2 border-amber-300 p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                          {admin.title}
                        </span>
                        <h4 className="text-base font-black text-slate-900 mt-1">{admin.profileName}</h4>
                        <p className="text-xs text-slate-500">
                          Username: <strong className="text-blue-900">{admin.username}</strong>
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(admin.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        disabled={processingId === admin.id}
                        onClick={() => handleApproveAdmin(admin.id, admin.profileName, admin.username, admin.roleType)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>{processingId === admin.id ? 'Authorizing...' : 'Grant Official Authorization'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved Officer Portals Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Active Authorized Officer Portals ({approvedAdmins.filter(p => p.roleType !== currentAdmin.roleType).length})
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approvedAdmins.filter(profile => profile.roleType !== currentAdmin.roleType).map(profile => (
                <div
                  key={profile.id}
                  className="jobie-card p-5 hover:border-[#320b86] transition bg-white flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#320b86] bg-purple-50 px-2.5 py-0.5 rounded-full">
                        {profile.title}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Ready
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-black text-slate-900 group-hover:text-[#320b86] transition">
                        {profile.profileName}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Account: <code className="text-slate-800 font-bold">{profile.username}</code>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onEnterAdminProfile(profile)}
                    className="w-full py-2.5 px-4 bg-[#320b86] hover:bg-[#28076e] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span>Enter in Oversight Mode</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TAB: CLASS INSPECTION (STANDALONE & STREAMLINED)                       */}
      {/* ========================================================================= */}
      {activeTab === 'CLASS_PORTAL_EXPLORER' && (
        <DepartmentClassExplorer
          currentAdmin={currentAdmin}
          allClasses={allClasses}
          sundaySchoolYear={sundaySchoolYear}
          initialClassId={explorerInitialClassId}
          onBackToOverview={() => setActiveTab('OVERVIEW')}
        />
      )}

      {/* ========================================================================= */}
      {/* 4. TAB: CLASS DIRECTORY & APPROVALS (MERGED!)                             */}
      {/* ========================================================================= */}
      {activeTab === 'ALL_CLASSES' && (
        <div className="space-y-6">
          
          {/* Header Title (Clean, NO Primary Administrative Authority banner) */}
          <div className="jobie-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
                Class Directory & Authorizations
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete registry of Sunday School classes across all departments, and pending class authorizations
              </p>
            </div>
            {pendingClasses.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>All {allClasses.length} Classes Authorized</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-black border border-amber-300">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                <span>{pendingClasses.length} Class(es) Awaiting Approval</span>
              </span>
            )}
          </div>

          {/* Pending Class Approvals (Prominently shown at top if any exist) */}
          {pendingClasses.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <h4 className="text-sm font-black text-amber-900 uppercase tracking-wider">
                  Classes Awaiting Authorization ({pendingClasses.length})
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingClasses.map((cls) => (
                  <div key={cls.id} className="jobie-card border-2 border-amber-300 p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                          {cls.department}
                        </span>
                        <h4 className="text-base font-black text-slate-900 mt-1">{cls.className}</h4>
                        <p className="text-xs text-slate-600">Secretary: <strong>{cls.secretaryName || 'Not Assigned'}</strong> {cls.secretaryPhone ? `(${cls.secretaryPhone})` : ''}</p>
                        <p className="text-xs text-slate-500">
                          Teachers: {(cls.teachers || []).map(t => t.name).join(', ') || 'Not Assigned'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Awaiting authorization
                      </span>
                      <button
                        disabled={processingId === cls.id}
                        onClick={() => handleApproveClass(cls.id, cls.className)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                      >
                        {processingId === cls.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Authorizing...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Approve & Activate Class</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="jobie-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchDirectoryQuery}
                  onChange={(e) => setSearchDirectoryQuery(e.target.value)}
                  placeholder="Search by class name, teacher, secretary, or department..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white focus:border-[#320b86] focus:outline-none transition"
                />
              </div>

              {/* Department Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {['ALL', ...deptStats.map(d => d.name)].map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setSelectedDeptFilter(dept)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      selectedDeptFilter === dept
                        ? 'bg-[#320b86] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Classes Directory Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClasses.map((cls) => (
              <div
                key={cls.id}
                className="jobie-card p-5 space-y-4 flex flex-col justify-between hover:border-[#320b86]/40 transition group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-[#320b86] bg-purple-50 px-2.5 py-0.5 rounded-full">
                      {cls.department}
                    </span>
                    {cls.approvalStatus === 'APPROVED' ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                        Pending
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-base font-black text-slate-900 group-hover:text-[#320b86] transition">
                      {cls.className}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Secretary: <strong>{cls.secretaryName || 'Not Assigned'}</strong>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Teachers: {(cls.teachers || []).map(t => t.name).join(', ') || 'None assigned'}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-400">
                    5 Dashboards Ready
                  </span>
                  <button
                    onClick={() => {
                      setExplorerInitialClassId(cls.id);
                      setActiveTab('CLASS_PORTAL_EXPLORER');
                    }}
                    className="px-3.5 py-2 bg-[#320b86] hover:bg-[#28076e] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span>Inspect Class</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredClasses.length === 0 && (
            <div className="jobie-card p-10 text-center space-y-2">
              <p className="text-sm font-bold text-slate-700">No classes match your search query</p>
              <p className="text-xs text-slate-400">Try searching for a different name, teacher, or clearing the filter.</p>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
