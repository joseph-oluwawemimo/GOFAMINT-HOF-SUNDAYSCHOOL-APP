import React, { useState, useEffect } from 'react';
import {
  Shield,
  Crown,
  FileSpreadsheet,
  Coins,
  UserCheck,
  Briefcase,
  Lock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRightLeft,
  UserPlus,
  LogIn,
  KeyRound,
  LogOut,
  Sparkles,
  Users,
  ClipboardList,
  BookCheck,
  Info,
  Download,
  Upload,
  Database,
  Trash2,
  Clock,
  Eye,
  MoreVertical,
  X,
  ChevronRight,
  TrendingUp,
  School,
  Building,
  BookOpen,
  Search,
  ShieldCheck,
  Menu,
  Bell,
  MoreHorizontal,
  Layers,
  Receipt,
  ArrowUpRight,
  UserX,
  FileCheck,
  Award
} from 'lucide-react';
import { GofamintLogo } from '../GofamintLogo';
import {
  AdminProfile,
  AdminRoleType,
  SundaySchoolYear,
  QuarterNumber,
  ClassProfile
} from '../../types';
import {
  getAllAdminProfiles,
  approveAdminProfile,
  getSundaySchoolYear,
  saveSundaySchoolYear,
  distributeQuarterLessonsToClasses,
  archiveQuarterAndActivateNext,
  getAllClassesDirectory,
  approveClassById,
  addDepartmentToYear,
  updateDepartmentNameInYear,
  deleteDepartmentFromYear,
  replaceStoreContents
} from '../../db/indexedDB';
import { GeneralSuperintendentView } from './GeneralSuperintendentView';
import { CloudUserManagementPanel } from './CloudUserManagementPanel';
import { GeneralSecretaryView } from './GeneralSecretaryView';
import { TreasurerView } from './TreasurerView';
import { RecordOfficerView } from './RecordOfficerView';
import { EnrollmentOfficerView, EnrollmentOfficerTab } from './EnrollmentOfficerView';
import { AsstGeneralSecretaryView } from './AsstGeneralSecretaryView';
import { DepartmentSuperintendentView } from './DepartmentSuperintendentView';
import { DatabaseBackupModal } from '../DatabaseBackupModal';
import { approveStaffUser, logOversightAccess } from '../../services/adminUserApi';
import type { ApplicationProfile } from '../../services/profileService';
import { cloudGetSundaySchoolYear, cloudGetAllAdminProfiles } from '../../services/supabaseDatabase';
import { usePersistedState } from '../../hooks/usePersistedState';

function buildAdminProfile(authProfile: ApplicationProfile, matchedExisting?: AdminProfile): AdminProfile {
  const role = authProfile.role as AdminRoleType;
  return {
    id: matchedExisting?.id || authProfile.id,
    roleType: role,
    title: matchedExisting?.title || (role === 'GENERAL_SECRETARY'
      ? 'General Secretary ID'
      : role === 'GENERAL_SUPERINTENDENT'
        ? 'General Superintendent ID'
        : `${role.replace(/_/g, ' ')} ID`),
    profileName: matchedExisting?.profileName || authProfile.displayName || authProfile.email || 'Officer',
    username: authProfile.email || matchedExisting?.username || 'officer',
    photoBase64: matchedExisting?.photoBase64,
    departmentId: authProfile.departmentId || matchedExisting?.departmentId || undefined,
    isApproved: authProfile.isApproved || matchedExisting?.isApproved === true,
    approvedBy: authProfile.approvedBy || matchedExisting?.approvedBy || undefined,
    approvedAt: authProfile.approvedAt || matchedExisting?.approvedAt || undefined,
    createdAt: matchedExisting?.createdAt || authProfile.createdAt,
    updatedAt: matchedExisting?.updatedAt || authProfile.createdAt,
  };
}

interface AdminPortalRootProps {
  authProfile: ApplicationProfile | null;
  onBackToPortalSelect: () => void;
  onBackToWelcome?: () => void;
  onEnterClassRegister?: (classId?: string) => void;
  onEnterWorkersModule?: () => void;
  onLockProfile?: () => void;
  onEnterOversight?: (targetPortal: string, targetClassId?: string) => void;
}

export const AdminPortalRoot: React.FC<AdminPortalRootProps> = ({
  authProfile,
  onBackToPortalSelect,
  onBackToWelcome,
  onEnterClassRegister,
  onEnterWorkersModule,
  onLockProfile,
  onEnterOversight
}) => {
  const [adminProfiles, setAdminProfiles] = useState<AdminProfile[]>([]);
  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(() => authProfile ? buildAdminProfile(authProfile) : null);
  const [sundaySchoolYear, setSundaySchoolYear] = useState<SundaySchoolYear | null>(null);
  const [allClasses, setAllClasses] = useState<ClassProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPendingApproval, setIsPendingApproval] = useState(() => authProfile ? !authProfile.isApproved : false);
  const [profileResolutionError, setProfileResolutionError] = useState<string | null>(null);
  const [oversightAdminProfile, setOversightAdminProfile] = useState<AdminProfile | null>(null);

  // GS Sub-tab Navigation state (Jobie active tab)
  const stateScope = authProfile?.id || 'unresolved';
  const [gsActiveTab, setGsActiveTab] = usePersistedState<'OVERVIEW' | 'PORTAL_OVERSIGHT' | 'CLASS_PORTAL_EXPLORER' | 'ADMIN_APPROVALS' | 'CLASS_APPROVALS' | 'ALL_CLASSES' | 'CLOUD_USERS'>(`gofamint_admin_${stateScope}_gs_tab`, 'OVERVIEW');

  // GSEC Sub-tab Navigation state (Jobie active tab)
  const [gsecActiveTab, setGsecActiveTab] = usePersistedState<'SUNDAY_SCHOOL_SETUP' | 'CLASS_PORTAL_EXPLORER' | 'DEPARTMENTS' | 'CLASS_APPROVALS'>(`gofamint_admin_${stateScope}_gsec_tab`, 'SUNDAY_SCHOOL_SETUP');

  // Treasurer Sub-tab Navigation state (Jobie active tab)
  const [treasurerActiveTab, setTreasurerActiveTab] = usePersistedState<'OVERVIEW' | 'PENDING_AUDIT' | 'WEEKLY_AUDIT' | 'QUARTERLY_MATRIX' | 'EXPENDITURES' | 'AUDITED_TRAIL' | 'CHILDREN_ACCOUNT'>(`gofamint_admin_${stateScope}_treasurer_tab`, 'OVERVIEW');

  // Record Officer Sub-tab Navigation state (Jobie active tab)
  const [recordOfficerActiveTab, setRecordOfficerActiveTab] = usePersistedState<'WEEKLY_COLLATION' | 'WEEKLY_ONBOARDED' | 'QUARTER_ANALYSIS' | 'DEPARTED_MEMBERS'>(`gofamint_admin_${stateScope}_record_tab`, 'WEEKLY_COLLATION');

  // Enrollment Officer Sub-tab Navigation state (Jobie active tab)
  const [enrollmentOfficerActiveTab, setEnrollmentOfficerActiveTab] = usePersistedState<EnrollmentOfficerTab>(`gofamint_admin_${stateScope}_eo_tab`, 'WEEKLY_ENROLLMENT');

  // Assistant General Secretary Sub-tab Navigation state (Jobie active tab)
  const [asstGsecActiveTab, setAsstGsecActiveTab] = usePersistedState<'OVERVIEW' | 'CREATE_CLASSES' | 'CLASS_DIRECTORY' | 'TEACHER_ROSTER'>(`gofamint_admin_${stateScope}_asst_tab`, 'OVERVIEW');

  // Data Backup / Restore Modal State
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupModalTab, setBackupModalTab] = useState<'SAVE' | 'LOAD' | 'RESET'>('SAVE');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  // Refresh and load all data from IndexedDB and Supabase.
  const refreshAdminData = async (silent = false, forceCloudRefresh = false) => {
    if (!silent) {
      setLoading(true);
    }
    setProfileResolutionError(null);
    setIsPendingApproval(false);
    try {
      let [profiles, year, classes] = await Promise.all([
        getAllAdminProfiles(),
        getSundaySchoolYear(),
        getAllClassesDirectory(forceCloudRefresh),
      ]);

      // Normal portal entry is cache-first; the app-level hydration owns cloud
      // revalidation. Explicit administrative refreshes can still force it.
      if (forceCloudRefresh) {
        try {
          const cloudProfs = await cloudGetAllAdminProfiles();
          profiles = cloudProfs || [];
          await replaceStoreContents('adminProfiles', profiles);
        } catch (cloudErr) {
          console.error('Could not sync cloud admin profiles:', cloudErr);
          throw cloudErr;
        }
      }

      const supportedRoles: AdminRoleType[] = [
        'SUPER_ADMIN',
        'GENERAL_SUPERINTENDENT',
        'DEPARTMENT_SUPERINTENDENT',
        'GENERAL_SECRETARY',
        'TREASURER',
        'RECORD_OFFICER',
        'ENROLLMENT_OFFICER',
        'ASST_GENERAL_SECRETARY',
        'ASSISTANT_GENERAL_SECRETARY',
      ];

      if (!authProfile) {
        setProfileResolutionError('No Supabase application profile is available for this session.');
      } else if (!supportedRoles.includes(authProfile.role as AdminRoleType)) {
        setProfileResolutionError(`Your account has an unsupported administrative role (${authProfile.role}).`);
      } else {
        const uRole = authProfile.role as AdminRoleType;
        const matchedExisting = profiles.find(p =>
          p.id === authProfile.id ||
          p.username.toLowerCase() === (authProfile.email || '').toLowerCase() ||
          (uRole !== 'DEPARTMENT_SUPERINTENDENT' && p.roleType === uRole)
        );

        const activeProfile = buildAdminProfile(authProfile, matchedExisting);

        if (!profiles.some(p => p.id === activeProfile.id || p.roleType === uRole)) {
          profiles = [activeProfile, ...profiles];
        }

        setCurrentAdmin(activeProfile);
        setIsPendingApproval(!activeProfile.isApproved);
      }

      if (!year) {
        try {
          year = await cloudGetSundaySchoolYear();
          if (year) {
            await saveSundaySchoolYear(year);
          }
        } catch (yearErr) {
          console.warn('Could not load year from Supabase:', yearErr);
        }
      }

      setAdminProfiles(profiles);
      setSundaySchoolYear(year);
      setAllClasses(classes);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      setProfileResolutionError('The administrative portal could not load its account data. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAdminData();
  }, [authProfile?.id]);

  useEffect(() => {
    let refreshTimer: number | undefined;
    const handleSyncUpdate = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void refreshAdminData(true, false);
      }, 80);
    };
    window.addEventListener('gofamint:sync-update', handleSyncUpdate);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener('gofamint:sync-update', handleSyncUpdate);
    };
  }, [authProfile?.id]);

  const handleApproveAdminProfile = async (id: string, _email?: string, _roleType?: string) => {
    const approverName = currentAdmin?.profileName || 'General Superintendent';
    try {
      const result = await approveStaffUser({ targetUid: id });
      if (!result.success) throw new Error(result.error || 'The server did not approve this officer.');
      await approveAdminProfile(id, approverName);
      await refreshAdminData();
    } catch (err) {
      console.error('Failed to approve admin profile:', err);
      throw err;
    }
  };

  const handleApproveClass = async (classId: string) => {
    setAllClasses(prev => prev.map(c => c.id === classId ? { ...c, approvalStatus: 'APPROVED' } : c));
    const approved = await approveClassById(classId);
    if (!approved) throw new Error('The class could not be approved because it was not found.');
    setAllClasses(prev => prev.map(c => c.id === classId ? { ...c, ...approved, approvalStatus: 'APPROVED' } : c));
    await refreshAdminData(true);
  };

  const handleDistributeQuarterLessons = async (quarterNumber: QuarterNumber) => {
    if (!sundaySchoolYear) return;
    const qData = sundaySchoolYear.quarters.find(q => q.quarterNumber === quarterNumber);
    if (!qData || !qData.lessons || qData.lessons.length === 0) {
      alert(`Quarter ${quarterNumber} has no lessons entered yet.`);
      return;
    }

    await distributeQuarterLessonsToClasses(quarterNumber);
    const updatedYear: SundaySchoolYear = {
      ...sundaySchoolYear,
      quarters: sundaySchoolYear.quarters.map(q =>
        q.quarterNumber === quarterNumber ? { ...q, isDistributed: true } : q
      ),
      updatedAt: new Date().toISOString()
    };
    await saveSundaySchoolYear(updatedYear);
    setSundaySchoolYear(updatedYear);
    alert(`Successfully distributed Quarter ${quarterNumber} lessons to all registered Sunday School classes!`);
  };

  const handleArchiveAndActivateNextQuarter = async (currentQ: QuarterNumber) => {
    const updated = await archiveQuarterAndActivateNext(currentQ);
    if (updated) {
      setSundaySchoolYear(updated);
      alert(`Quarter ${currentQ} has been archived. Quarter ${updated.activeQuarterNumber} is now active.`);
    }
  };

  if (loading && !currentAdmin) {
    return (
      <div className="min-h-screen bg-[#320b86] flex flex-col items-center justify-center text-white p-4">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold font-['Cinzel',serif] tracking-wide">
          THE GOSPEL FAITH MISSION INTL
        </h2>
        <p className="text-xs text-purple-200 mt-1">Connecting to Directorate Central Authority…</p>
      </div>
    );
  }

  if (profileResolutionError || !currentAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-2xl space-y-4 border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center mx-auto text-amber-800 font-black text-xl">!</div>
          <h2 className="text-lg font-bold text-slate-900 font-['Cinzel',serif]">Administrative account setup required</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {profileResolutionError || 'Your administrative role could not be resolved.'}
          </p>
          <button
            type="button"
            onClick={() => void refreshAdminData()}
            className="px-5 py-2.5 bg-[#320b86] hover:bg-[#28076e] text-white font-bold rounded-xl text-xs transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isPendingApproval) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-2xl space-y-4 border border-slate-200">
          <div className="w-16 h-16 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center mx-auto text-amber-800">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 font-['Cinzel',serif]">Account Pending Approval</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your officer account (<strong>{currentAdmin?.profileName}</strong> • {currentAdmin?.title}) has been registered and is awaiting authorization from the General Superintendent.
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
            Once the General Superintendent reviews and activates your credentials in the Executive Council, your administrative portal will be unlocked.
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={onBackToPortalSelect}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
            >
              Back to Portals
            </button>
            <button
              onClick={onLockProfile}
              className="px-5 py-2.5 bg-[#320b86] hover:bg-[#28076e] text-white font-bold rounded-xl text-xs transition"
            >
              Lock Console
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activePortalAdmin = oversightAdminProfile || currentAdmin;
  const isGeneralSuperintendent = activePortalAdmin?.roleType === 'GENERAL_SUPERINTENDENT' || activePortalAdmin?.roleType === 'SUPER_ADMIN';
  const isGeneralSecretary = activePortalAdmin?.roleType === 'GENERAL_SECRETARY';

  // Badge counts
  const pendingAdminsCount = adminProfiles.filter(p => !p.isApproved && p.roleType !== 'GENERAL_SUPERINTENDENT').length;
  const pendingClassesCount = allClasses.filter(c => String(c.approvalStatus || '').trim().toUpperCase() === 'PENDING_APPROVAL').length;
  const totalPendingCount = pendingAdminsCount + pendingClassesCount;

  // Navigation Items for General Superintendent (5 Consolidated Sections)
  const gsNavItems = [
    { id: 'OVERVIEW', label: 'Executive Overview', icon: TrendingUp },
    { id: 'PORTAL_OVERSIGHT', label: 'Office Portal & Approvals', icon: Users, badge: pendingAdminsCount },
    { id: 'CLASS_PORTAL_EXPLORER', label: 'Class Inspection', icon: School },
    { id: 'ALL_CLASSES', label: 'Class Directory & Approvals', icon: BookOpen, badge: pendingClassesCount },
    { id: 'CLOUD_USERS', label: 'Staff Logins', icon: UserPlus },
  ];

  // Navigation Items for General Secretary (4 Consolidated Sections)
  const gsecNavItems = [
    { id: 'SUNDAY_SCHOOL_SETUP', label: 'Curriculum & Setup', icon: Layers },
    { id: 'CLASS_PORTAL_EXPLORER', label: 'Class Inspection', icon: School },
    { id: 'DEPARTMENTS', label: 'Department Directorate', icon: Building, badge: Array.isArray(sundaySchoolYear?.departments) ? sundaySchoolYear.departments.length : undefined },
    { id: 'CLASS_APPROVALS', label: 'Class Approvals', icon: CheckCircle2, badge: pendingClassesCount },
  ];

  // Navigation Items for Treasurer (7 Treasury & Financial Sections)
  const isTreasurer = activePortalAdmin?.roleType === 'TREASURER';

  const treasurerNavItems = [
    { id: 'OVERVIEW', label: 'Financial Overview', icon: TrendingUp },
    { id: 'PENDING_AUDIT', label: 'Pending Remittances', icon: Receipt },
    { id: 'WEEKLY_AUDIT', label: 'Weekly Collation', icon: Coins },
    { id: 'QUARTERLY_MATRIX', label: '12-Week Matrix', icon: FileSpreadsheet },
    { id: 'EXPENDITURES', label: 'Disbursements', icon: ArrowUpRight },
    { id: 'CHILDREN_ACCOUNT', label: 'Children Account', icon: Layers },
    { id: 'AUDITED_TRAIL', label: 'Audited Ledger', icon: ShieldCheck },
  ];

  // Navigation Items for Record Officer (4 Collation & Census Sections)
  const isRecordOfficer = activePortalAdmin?.roleType === 'RECORD_OFFICER';

  const recordOfficerNavItems = [
    { id: 'WEEKLY_COLLATION', label: 'Weekly Collation', icon: ClipboardList },
    { id: 'WEEKLY_ONBOARDED', label: 'New Onboarded', icon: UserPlus },
    { id: 'QUARTER_ANALYSIS', label: 'Quarterly Analysis', icon: TrendingUp },
    { id: 'DEPARTED_MEMBERS', label: 'Departed Registry', icon: UserX },
  ];

  // Navigation Items for Enrollment Officer (6 Pipeline & Certification Sections)
  const isEnrollmentOfficer = activePortalAdmin?.roleType === 'ENROLLMENT_OFFICER';

  const enrollmentOfficerNavItems = [
    { id: 'WEEKLY_ENROLLMENT', label: 'Weekly Enrollment Collation', icon: FileCheck },
    { id: 'CONSISTENCY_CERTIFICATION', label: 'Consistency & Certification Review', icon: Award },
    { id: 'AUDIT_TRAIL', label: 'Conversion Audit Trail', icon: ShieldCheck },
    { id: 'DEPARTMENTAL_CENSUS', label: 'Departmental Census Breakdown', icon: Building },
    { id: 'DEPARTED_MEMBERS', label: 'Departed Members', icon: UserX },
    { id: 'STUDENT_TRANSFERS', label: 'Student Transfers', icon: ArrowRightLeft },
  ];

  // Navigation Items for Assistant General Secretary (4 Class Architecture & Workers Sections)
  const isAsstGeneralSecretary = activePortalAdmin?.roleType === 'ASST_GENERAL_SECRETARY' || activePortalAdmin?.roleType === 'ASSISTANT_GENERAL_SECRETARY';

  const asstGsecNavItems = [
    { id: 'OVERVIEW', label: 'Architecture Overview', icon: TrendingUp },
    { id: 'CREATE_CLASSES', label: 'Create Classes', icon: Layers },
    { id: 'CLASS_DIRECTORY', label: 'Class Directory', icon: Building, badge: pendingClassesCount > 0 ? pendingClassesCount : undefined },
    { id: 'TEACHER_ROSTER', label: 'Teacher Rosters', icon: Users },
  ];

  return (
    <div className="jobie-admin-canvas flex min-h-screen font-sans selection:bg-[#320b86] selection:text-white relative">
      
      {/* ========================================================================= */}
      {/* 1. DESKTOP SIDEBAR (JOBIE BRAND VIOLET WITH CARVED-OUT ACTIVE TAB NOTCH)     */}
      {/* ========================================================================= */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 jobie-sidebar shrink-0 sticky top-0 h-screen z-30 shadow-2xl overflow-hidden">
        
        {/* Top Logo & Directorate Brand */}
        <div className="p-6 flex items-center gap-3 border-b border-white/10 shrink-0">
          <GofamintLogo size={42} />
          <div className="min-w-0">
            <span className="text-[10px] font-black tracking-widest text-amber-300 uppercase font-['Cinzel',serif] block truncate">
              GOFAMINT HOF
            </span>
            <h2 className="text-sm font-black text-white font-['Cinzel',serif] tracking-wide truncate">
              Directorate Portal
            </h2>
            {currentAdmin && (
              <span className="inline-block text-[9px] font-bold text-purple-200 bg-white/15 px-2 py-0.5 rounded-full mt-1 truncate max-w-full">
                {currentAdmin.title}
              </span>
            )}
          </div>
        </div>

        {/* Navigation Section with Carved Notch */}
        <div className="flex-1 py-6 space-y-1 overflow-y-auto no-scrollbar">
          {isGeneralSuperintendent && (
            <>
              <div className="px-6 pb-2 text-[10px] font-black uppercase tracking-wider text-purple-300/70">
                Executive Council
              </div>
              {gsNavItems.map((item) => {
                const isActive = gsActiveTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setGsActiveTab(item.id as any)}
                    className={`w-full flex items-center gap-3 pl-6 pr-4 py-3.5 text-xs font-black transition-all cursor-pointer text-left ${
                      isActive
                        ? 'jobie-notch-item active'
                        : 'text-purple-200/80 hover:text-white hover:bg-white/10 rounded-2xl mx-3 my-0.5 px-4 py-3'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#320b86]' : 'text-purple-300'}`} />
                    <span className="truncate">{item.label}</span>
                    {item.badge != null && item.badge > 0 && (
                      <span className={`ml-auto px-2 py-0.5 text-[10px] font-black rounded-full shrink-0 ${
                        isActive ? 'bg-[#320b86] text-white' : 'bg-amber-400 text-slate-900'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          {isGeneralSecretary && (
            <>
              <div className="px-6 pb-2 text-[10px] font-black uppercase tracking-wider text-purple-300/70">
                Secretariat Council
              </div>
              {gsecNavItems.map((item) => {
                const isActive = gsecActiveTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setGsecActiveTab(item.id as any)}
                    className={`w-full flex items-center gap-3 pl-6 pr-4 py-3.5 text-xs font-black transition-all cursor-pointer text-left ${
                      isActive
                        ? 'jobie-notch-item active'
                        : 'text-purple-200/80 hover:text-white hover:bg-white/10 rounded-2xl mx-3 my-0.5 px-4 py-3'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#320b86]' : 'text-purple-300'}`} />
                    <span className="truncate">{item.label}</span>
                    {item.badge != null && item.badge > 0 && (
                      <span className={`ml-auto px-2 py-0.5 text-[10px] font-black rounded-full shrink-0 ${
                        isActive ? 'bg-[#320b86] text-white' : 'bg-amber-400 text-slate-900'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          {isTreasurer && (
            <>
              <div className="px-6 pb-2 text-[10px] font-black uppercase tracking-wider text-purple-300/70">
                Treasury Directorate
              </div>
              {treasurerNavItems.map((item) => {
                const isActive = treasurerActiveTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTreasurerActiveTab(item.id as any)}
                    className={`w-full flex items-center gap-3 pl-6 pr-4 py-3.5 text-xs font-black transition-all cursor-pointer text-left ${
                      isActive
                        ? 'jobie-notch-item active'
                        : 'text-purple-200/80 hover:text-white hover:bg-white/10 rounded-2xl mx-3 my-0.5 px-4 py-3'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#320b86]' : 'text-purple-300'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </>
          )}

          {isRecordOfficer && (
            <>
              <div className="px-6 pb-2 text-[10px] font-black uppercase tracking-wider text-purple-300/70">
                Record Directorate
              </div>
              {recordOfficerNavItems.map((item) => {
                const isActive = recordOfficerActiveTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRecordOfficerActiveTab(item.id as any)}
                    className={`w-full flex items-center gap-3 pl-6 pr-4 py-3.5 text-xs font-black transition-all cursor-pointer text-left ${
                      isActive
                        ? 'jobie-notch-item active'
                        : 'text-purple-200/80 hover:text-white hover:bg-white/10 rounded-2xl mx-3 my-0.5 px-4 py-3'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#320b86]' : 'text-purple-300'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </>
          )}

          {isEnrollmentOfficer && (
            <>
              <div className="px-6 pb-2 text-[10px] font-black uppercase tracking-wider text-purple-300/70">
                Enrollment Directorate
              </div>
              {enrollmentOfficerNavItems.map((item) => {
                const isActive = enrollmentOfficerActiveTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setEnrollmentOfficerActiveTab(item.id as any)}
                    className={`w-full flex items-center gap-3 pl-6 pr-4 py-3.5 text-xs font-black transition-all cursor-pointer text-left ${
                      isActive
                        ? 'jobie-notch-item active'
                        : 'text-purple-200/80 hover:text-white hover:bg-white/10 rounded-2xl mx-3 my-0.5 px-4 py-3'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#320b86]' : 'text-purple-300'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </>
          )}

          {isAsstGeneralSecretary && (
            <>
              <div className="px-6 pb-2 text-[10px] font-black uppercase tracking-wider text-purple-300/70">
                Class Architecture Directorate
              </div>
              {asstGsecNavItems.map((item) => {
                const isActive = asstGsecActiveTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAsstGsecActiveTab(item.id as any)}
                    className={`w-full flex items-center gap-3 pl-6 pr-4 py-3.5 text-xs font-black transition-all cursor-pointer text-left ${
                      isActive
                        ? 'jobie-notch-item active'
                        : 'text-purple-200/80 hover:text-white hover:bg-white/10 rounded-2xl mx-3 my-0.5 px-4 py-3'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#320b86]' : 'text-purple-300'}`} />
                    <span className="truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Sidebar Utilities & Actions */}
        <div className="p-4 border-t border-white/10 space-y-2 bg-[#250664]/80 shrink-0">
          {!oversightAdminProfile && currentAdmin?.roleType === 'GENERAL_SUPERINTENDENT' && (
            <button
              type="button"
              onClick={() => {
                setBackupModalTab('SAVE');
                setIsBackupModalOpen(true);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/20 transition flex items-center gap-2 cursor-pointer"
            >
              <Database className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Database Control</span>
            </button>
          )}

          {onEnterWorkersModule && (
            <button
              type="button"
              onClick={onEnterWorkersModule}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Workers Directorate</span>
            </button>
          )}

          {onBackToPortalSelect && (
            <button
              type="button"
              onClick={onBackToPortalSelect}
              className="w-full px-3.5 py-2 rounded-xl text-xs font-semibold text-purple-200 hover:text-white hover:bg-white/10 transition flex items-center gap-2 cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
              <span>Switch Portal</span>
            </button>
          )}

          {onLockProfile && (
            <button
              type="button"
              onClick={onLockProfile}
              className="w-full px-3.5 py-2 rounded-xl text-xs font-semibold text-purple-200 hover:text-white hover:bg-white/10 transition flex items-center gap-2 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-purple-300 shrink-0" />
              <span>Lock Console</span>
            </button>
          )}

          {onBackToWelcome && (
            <button
              type="button"
              onClick={onBackToWelcome}
              className="w-full px-3.5 py-2 rounded-xl text-xs font-semibold text-purple-300/70 hover:text-white hover:bg-white/10 transition flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>Exit to Welcome</span>
            </button>
          )}
        </div>

      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT AREA                                                      */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Top Header Bar (Jobie Style) */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4 shadow-xs">
          
          {/* Left: Mobile Drawer Trigger + Brand / Section Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 text-[#320b86]" />
            </button>

            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                Directorate Central Council
              </span>
              <h2 className="text-sm sm:text-base font-black text-slate-900 font-['Cinzel',serif] tracking-wide truncate">
                {activePortalAdmin?.title || 'Executive Portal'}
              </h2>
            </div>
          </div>

          {/* Center: Search Bar */}
          <div className="hidden md:flex items-center gap-2.5 bg-slate-100/90 rounded-full px-4 py-2 border border-slate-200/70 max-w-sm w-full">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search officers, classes, records..."
              className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-full"
            />
          </div>

          {/* Right: Quick Action Controls & User Profile Chip */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Notifications / Approvals Shortcut */}
            <button
              type="button"
              onClick={() => {
                if (isGeneralSuperintendent) {
                  setGsActiveTab(pendingAdminsCount > 0 ? 'PORTAL_OVERSIGHT' : 'ALL_CLASSES');
                } else if (isGeneralSecretary) {
                  setGsecActiveTab('CLASS_APPROVALS');
                }
              }}
              className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              title={`${totalPendingCount} Pending Approvals`}
            >
              <ShieldCheck className="w-5 h-5 text-[#320b86]" />
              {totalPendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full flex items-center justify-center shadow-xs">
                  {totalPendingCount}
                </span>
              )}
            </button>

            {/* Database Control Shortcut */}
            {!oversightAdminProfile && currentAdmin?.roleType === 'GENERAL_SUPERINTENDENT' && (
              <button
                type="button"
                onClick={() => {
                  setBackupModalTab('SAVE');
                  setIsBackupModalOpen(true);
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-xl transition cursor-pointer border border-blue-200"
              >
                <Database className="w-3.5 h-3.5 text-[#320b86]" />
                <span>Database</span>
              </button>
            )}

            {/* Quick Lock Profile */}
            {onLockProfile && (
              <button
                type="button"
                onClick={onLockProfile}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer border border-slate-200"
                title="Lock Console"
              >
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Lock</span>
              </button>
            )}

            {/* User Profile Chip */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#320b86] to-[#4318ff] text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0 ring-2 ring-[#320b86]/20">
                {currentAdmin.profileName.charAt(0)}
              </div>
              <div className="hidden sm:block text-left min-w-0">
                <span className="text-xs font-bold text-slate-900 block truncate leading-tight">
                  {currentAdmin.profileName}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {currentAdmin.title}
                </span>
              </div>
            </div>
          </div>

        </header>

        {/* Main Administrative Views Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8 space-y-6">
          
          {/* Oversight Active Banner */}
          {oversightAdminProfile && (
            <div className="bg-emerald-900 text-white border border-emerald-700 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div>
                <span className="text-[10px] uppercase font-black tracking-wider text-emerald-300">General Superintendent Oversight Mode</span>
                <p className="text-sm font-bold text-white">Viewing {oversightAdminProfile.title}: {oversightAdminProfile.profileName}</p>
              </div>
              <button
                type="button"
                onClick={() => setOversightAdminProfile(null)}
                className="px-4 py-2 rounded-xl bg-white text-emerald-950 text-xs font-black hover:bg-emerald-50 transition cursor-pointer"
              >
                Return to General Superintendent
              </button>
            </div>
          )}

          {/* Resolve Effective Year for Portal Management & Views */}
          {(() => {
            const effectiveYear: SundaySchoolYear = sundaySchoolYear || {
              id: 'DEFAULT',
              yearName: `${new Date().getFullYear()}–${new Date().getFullYear() + 1}`,
              overallTheme: '',
              startDate: '',
              endDate: '',
              activeQuarterNumber: 1,
              isInitialized: true,
              departments: [],
              updatedAt: new Date().toISOString(),
              quarters: [1, 2, 3, 4].map(q => ({
                id: `Q${q}`,
                quarterNumber: q as QuarterNumber,
                quarterName: `Quarter ${q}`,
                quarterTheme: '',
                startDate: '',
                endDate: '',
                sharingAdmonitionDate: '',
                totalLessonWeeks: 12,
                hasSharingAdmonitionWeek: true,
                status: q === 1 ? 'ACTIVE' : 'UPCOMING',
                isDistributed: false,
                lessons: [],
                updatedAt: new Date().toISOString()
              }))
            };

            return (
              <>
                {/* GS Staff & Logins tab */}
                {isGeneralSuperintendent && gsActiveTab === 'CLOUD_USERS' && !oversightAdminProfile ? (
                  <div className="jobie-card p-6 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-900 font-['Cinzel',serif]">
                          Staff & Officer Login Directorate
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Create, approve, and manage administrative officers and Sunday School class logins
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGsActiveTab('OVERVIEW')}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                      >
                        Back to Overview
                      </button>
                    </div>
                    <CloudUserManagementPanel adminRole={currentAdmin?.roleType} sundaySchoolYear={effectiveYear} />
                  </div>
                ) : (
                  /* Standard Role Execution */
                  <>
                  {/* View by Role */}
                  {isGeneralSuperintendent && (
                    <GeneralSuperintendentView
                      currentAdmin={activePortalAdmin}
                      adminProfiles={adminProfiles}
                      allClasses={allClasses}
                      sundaySchoolYear={effectiveYear}
                      onApproveAdminProfile={handleApproveAdminProfile}
                      onApproveClass={handleApproveClass}
                      onRefreshData={() => refreshAdminData(true)}
                      onEnterAdminProfile={(profile) => {
                        setOversightAdminProfile(profile);
                        void onEnterOversight?.(`ADMIN_${profile.roleType}`, profile.id);
                      }}
                      activeTab={gsActiveTab as any}
                      onTabChange={(tab) => setGsActiveTab(tab as any)}
                    />
                  )}

                  {activePortalAdmin?.roleType === 'GENERAL_SECRETARY' && (
                    <GeneralSecretaryView
                      currentAdmin={activePortalAdmin}
                      sundaySchoolYear={effectiveYear}
                      allClasses={allClasses}
                      onSaveSundaySchoolYear={async (updated) => {
                        await saveSundaySchoolYear(updated);
                        setSundaySchoolYear(updated);
                      }}
                      onDistributeLessons={handleDistributeQuarterLessons}
                      onArchiveAndActivateNextQuarter={handleArchiveAndActivateNextQuarter}
                      onAddDepartment={async (dept) => {
                        await addDepartmentToYear(dept);
                        setSundaySchoolYear(await getSundaySchoolYear());
                      }}
                      onUpdateDepartment={async (oldName, newName) => {
                        await updateDepartmentNameInYear(oldName, newName);
                        setSundaySchoolYear(await getSundaySchoolYear());
                        setAllClasses(await getAllClassesDirectory());
                      }}
                      onDeleteDepartment={async (dept) => {
                        const remainingDepts = await deleteDepartmentFromYear(dept);
                        const freshYear = await getSundaySchoolYear();
                        setSundaySchoolYear({
                          ...freshYear,
                          departments: remainingDepts
                        });
                        setAllClasses(await getAllClassesDirectory());
                      }}
                      onApproveClass={handleApproveClass}
                      onRefreshData={() => refreshAdminData(true)}
                      activeTab={gsecActiveTab}
                      onTabChange={setGsecActiveTab}
                    />
                  )}

                  {activePortalAdmin?.roleType === 'DEPARTMENT_SUPERINTENDENT' && (
                    <DepartmentSuperintendentView
                      currentAdmin={activePortalAdmin}
                      allClasses={allClasses}
                      sundaySchoolYear={effectiveYear}
                    />
                  )}

                  {activePortalAdmin?.roleType === 'TREASURER' && (
                    <TreasurerView
                      currentAdmin={activePortalAdmin}
                      allClasses={allClasses}
                      sundaySchoolYear={effectiveYear}
                      activeTab={treasurerActiveTab}
                      onTabChange={setTreasurerActiveTab}
                    />
                  )}

                  {activePortalAdmin?.roleType === 'RECORD_OFFICER' && (
                    <RecordOfficerView
                      currentAdmin={activePortalAdmin}
                      allClasses={allClasses}
                      sundaySchoolYear={effectiveYear}
                      activeTab={recordOfficerActiveTab}
                      onTabChange={setRecordOfficerActiveTab}
                    />
                  )}

                  {activePortalAdmin?.roleType === 'ENROLLMENT_OFFICER' && (
                    <EnrollmentOfficerView
                      currentAdmin={activePortalAdmin}
                      allClasses={allClasses}
                      sundaySchoolYear={effectiveYear}
                      activeTab={enrollmentOfficerActiveTab}
                      onTabChange={setEnrollmentOfficerActiveTab}
                    />
                  )}

                  {(activePortalAdmin?.roleType === 'ASST_GENERAL_SECRETARY' || activePortalAdmin?.roleType === 'ASSISTANT_GENERAL_SECRETARY') && (
                    <AsstGeneralSecretaryView
                      currentAdmin={activePortalAdmin}
                      allClasses={allClasses}
                      sundaySchoolYear={effectiveYear}
                      onEnterWorkersModule={onEnterWorkersModule}
                      onRefreshData={() => refreshAdminData(true)}
                      activeTab={asstGsecActiveTab}
                      onTabChange={setAsstGsecActiveTab}
                    />
                  )}
                </>
              )}
            </>
          );
        })()}

        </main>

        {/* Footer */}
        <footer className="p-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white/50">
          The Gospel Faith Mission International (House of Favour) • Sunday School Directorate
        </footer>

      </div>

      {/* ========================================================================= */}
      {/* 3. MOBILE STICKY BOTTOM NAVIGATION BAR (Fixed at viewport bottom)        */}
      {/* ========================================================================= */}
      {isGeneralSuperintendent && (
        <nav className="lg:hidden jobie-mobile-bottom-nav">
          <div className="flex items-center justify-around px-2 py-1.5">
            <button
              onClick={() => setGsActiveTab('OVERVIEW')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                gsActiveTab === 'OVERVIEW'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span className="text-[10px]">Overview</span>
            </button>

            <button
              onClick={() => setGsActiveTab('PORTAL_OVERSIGHT')}
              className={`relative flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                gsActiveTab === 'PORTAL_OVERSIGHT'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="text-[10px]">Portals</span>
              {pendingAdminsCount > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setGsActiveTab('CLASS_PORTAL_EXPLORER')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                gsActiveTab === 'CLASS_PORTAL_EXPLORER'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <School className="w-4 h-4" />
              <span className="text-[10px]">Inspection</span>
            </button>

            <button
              onClick={() => setGsActiveTab('ALL_CLASSES')}
              className={`relative flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                gsActiveTab === 'ALL_CLASSES'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-[10px]">Directory</span>
              {pendingClassesCount > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setIsMobileMoreOpen(true)}
              className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl text-slate-500 font-medium transition cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
              <span className="text-[10px]">More</span>
            </button>
          </div>
        </nav>
      )}

      {/* General Secretary Mobile Sticky Bottom Nav */}
      {isGeneralSecretary && (
        <nav className="lg:hidden jobie-mobile-bottom-nav">
          <div className="flex items-center justify-around px-2 py-1.5">
            <button
              onClick={() => setGsecActiveTab('SUNDAY_SCHOOL_SETUP')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                gsecActiveTab === 'SUNDAY_SCHOOL_SETUP'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span className="text-[10px]">Curriculum</span>
            </button>

            <button
              onClick={() => setGsecActiveTab('CLASS_PORTAL_EXPLORER')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                gsecActiveTab === 'CLASS_PORTAL_EXPLORER'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <School className="w-4 h-4" />
              <span className="text-[10px]">Inspection</span>
            </button>

            <button
              onClick={() => setGsecActiveTab('DEPARTMENTS')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                gsecActiveTab === 'DEPARTMENTS'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <Building className="w-4 h-4" />
              <span className="text-[10px]">Departments</span>
            </button>

            <button
              onClick={() => setGsecActiveTab('CLASS_APPROVALS')}
              className={`relative flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                gsecActiveTab === 'CLASS_APPROVALS'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-[10px]">Approvals</span>
              {pendingClassesCount > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setIsMobileMoreOpen(true)}
              className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl text-slate-500 font-medium transition cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
              <span className="text-[10px]">More</span>
            </button>
          </div>
        </nav>
      )}

      {/* Treasurer Mobile Sticky Bottom Nav */}
      {isTreasurer && (
        <nav className="lg:hidden jobie-mobile-bottom-nav">
          <div className="flex items-center justify-around px-2 py-1.5">
            <button
              onClick={() => setTreasurerActiveTab('OVERVIEW')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                treasurerActiveTab === 'OVERVIEW'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span className="text-[10px]">Overview</span>
            </button>

            <button
              onClick={() => setTreasurerActiveTab('PENDING_AUDIT')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                treasurerActiveTab === 'PENDING_AUDIT'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span className="text-[10px]">Pending</span>
            </button>

            <button
              onClick={() => setTreasurerActiveTab('WEEKLY_AUDIT')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                treasurerActiveTab === 'WEEKLY_AUDIT'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span className="text-[10px]">Weekly</span>
            </button>

            <button
              onClick={() => setTreasurerActiveTab('EXPENDITURES')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                treasurerActiveTab === 'EXPENDITURES'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span className="text-[10px]">Expenses</span>
            </button>

            <button
              onClick={() => setIsMobileMoreOpen(true)}
              className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl text-slate-500 font-medium transition cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
              <span className="text-[10px]">More</span>
            </button>
          </div>
        </nav>
      )}

      {/* Record Officer Mobile Sticky Bottom Nav */}
      {isRecordOfficer && (
        <nav className="lg:hidden jobie-mobile-bottom-nav">
          <div className="flex items-center justify-around px-2 py-1.5">
            <button
              onClick={() => setRecordOfficerActiveTab('WEEKLY_COLLATION')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                recordOfficerActiveTab === 'WEEKLY_COLLATION'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span className="text-[10px]">Collation</span>
            </button>

            <button
              onClick={() => setRecordOfficerActiveTab('WEEKLY_ONBOARDED')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                recordOfficerActiveTab === 'WEEKLY_ONBOARDED'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span className="text-[10px]">Onboarded</span>
            </button>

            <button
              onClick={() => setRecordOfficerActiveTab('QUARTER_ANALYSIS')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                recordOfficerActiveTab === 'QUARTER_ANALYSIS'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span className="text-[10px]">Analysis</span>
            </button>

            <button
              onClick={() => setRecordOfficerActiveTab('DEPARTED_MEMBERS')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                recordOfficerActiveTab === 'DEPARTED_MEMBERS'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <UserX className="w-4 h-4" />
              <span className="text-[10px]">Departed</span>
            </button>

            <button
              onClick={() => setIsMobileMoreOpen(true)}
              className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl text-slate-500 font-medium transition cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
              <span className="text-[10px]">More</span>
            </button>
          </div>
        </nav>
      )}

      {/* Assistant General Secretary Mobile Sticky Bottom Nav */}
      {isAsstGeneralSecretary && (
        <nav className="lg:hidden jobie-mobile-bottom-nav">
          <div className="flex items-center justify-around px-2 py-1.5">
            <button
              onClick={() => setAsstGsecActiveTab('OVERVIEW')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                asstGsecActiveTab === 'OVERVIEW'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span className="text-[10px]">Overview</span>
            </button>

            <button
              onClick={() => setAsstGsecActiveTab('CREATE_CLASSES')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                asstGsecActiveTab === 'CREATE_CLASSES'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span className="text-[10px]">Create</span>
            </button>

            <button
              onClick={() => setAsstGsecActiveTab('CLASS_DIRECTORY')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                asstGsecActiveTab === 'CLASS_DIRECTORY'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <Building className="w-4 h-4" />
              <span className="text-[10px]">Classes</span>
            </button>

            <button
              onClick={() => setAsstGsecActiveTab('TEACHER_ROSTER')}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition cursor-pointer ${
                asstGsecActiveTab === 'TEACHER_ROSTER'
                  ? 'bg-purple-100 text-[#320b86] font-black'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="text-[10px]">Teachers</span>
            </button>

            {onEnterWorkersModule && (
              <button
                onClick={onEnterWorkersModule}
                className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl text-emerald-600 font-bold transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px]">Workers</span>
              </button>
            )}
          </div>
        </nav>
      )}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[82vw] jobie-sidebar h-full max-h-[100dvh] flex flex-col shadow-2xl z-10 overflow-hidden">
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <GofamintLogo size={30} />
                <h3 className="text-sm font-black text-white font-['Cinzel',serif]">Directorate</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close Directorate navigation"
                className="p-1.5 rounded-lg text-purple-200 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 py-3 px-3 space-y-1 overflow-y-auto no-scrollbar overscroll-contain">
              {isGeneralSuperintendent && gsNavItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setGsActiveTab(item.id as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left cursor-pointer ${
                    gsActiveTab === item.id
                      ? 'bg-white text-[#320b86] shadow-sm'
                      : 'text-purple-100 hover:bg-white/10'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="ml-auto px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-400 text-slate-900 shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}

              {isGeneralSecretary && gsecNavItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setGsecActiveTab(item.id as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left cursor-pointer ${
                    gsecActiveTab === item.id
                      ? 'bg-white text-[#320b86] shadow-sm'
                      : 'text-purple-100 hover:bg-white/10'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="ml-auto px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-400 text-slate-900 shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}

              {isTreasurer && treasurerNavItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTreasurerActiveTab(item.id as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left cursor-pointer ${
                    treasurerActiveTab === item.id
                      ? 'bg-white text-[#320b86] shadow-sm'
                      : 'text-purple-100 hover:bg-white/10'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}

              {isRecordOfficer && recordOfficerNavItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setRecordOfficerActiveTab(item.id as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left cursor-pointer ${
                    recordOfficerActiveTab === item.id
                      ? 'bg-white text-[#320b86] shadow-sm'
                      : 'text-purple-100 hover:bg-white/10'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}

              {isEnrollmentOfficer && enrollmentOfficerNavItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setEnrollmentOfficerActiveTab(item.id as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left cursor-pointer ${
                    enrollmentOfficerActiveTab === item.id
                      ? 'bg-white text-[#320b86] shadow-sm'
                      : 'text-purple-100 hover:bg-white/10'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="p-3.5 border-t border-white/10 space-y-1.5 bg-[#250664]/90 shrink-0 pb-6">
              {onBackToPortalSelect && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onBackToPortalSelect();
                  }}
                  className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-purple-200 hover:text-white bg-white/5 flex items-center gap-2 cursor-pointer"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Switch Portal</span>
                </button>
              )}
              {onEnterWorkersModule && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onEnterWorkersModule();
                  }}
                  className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-500/10 flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Workers Directorate</span>
                </button>
              )}
              {onLockProfile && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onLockProfile();
                  }}
                  className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-amber-300 hover:text-white bg-amber-500/10 flex items-center gap-2 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock Profile</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MOBILE "MORE" BOTTOM DRAWER SHEET                                      */}
      {/* ========================================================================= */}
      {isMobileMoreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMoreOpen(false)}
          />
          <div className="relative bg-white rounded-t-3xl p-6 shadow-2xl z-10 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 font-['Cinzel',serif]">
                Additional Executive Controls
              </h3>
              <button
                type="button"
                onClick={() => setIsMobileMoreOpen(false)}
                aria-label="Close additional executive controls"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {isTreasurer && (
                <>

                  <button
                    type="button"
                    onClick={() => {
                      setTreasurerActiveTab('CHILDREN_ACCOUNT');
                      setIsMobileMoreOpen(false);
                    }}
                    className="p-3.5 rounded-2xl bg-purple-50 hover:bg-purple-100 text-[#320b86] flex flex-col items-center gap-2 text-center transition cursor-pointer"
                  >
                    <Layers className="w-5 h-5" />
                    <span className="text-xs font-bold">Children Account</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTreasurerActiveTab('AUDITED_TRAIL');
                      setIsMobileMoreOpen(false);
                    }}
                    className="p-3.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 flex flex-col items-center gap-2 text-center transition cursor-pointer"
                  >
                    <ShieldCheck className="w-5 h-5 text-[#320b86]" />
                    <span className="text-xs font-bold">Audited Ledger</span>
                  </button>
                </>
              )}

              {isRecordOfficer && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setRecordOfficerActiveTab('DEPARTED_MEMBERS');
                      setIsMobileMoreOpen(false);
                    }}
                    className="p-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-900 flex flex-col items-center gap-2 text-center transition cursor-pointer"
                  >
                    <UserX className="w-5 h-5 text-rose-600" />
                    <span className="text-xs font-bold">Departed Registry</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRecordOfficerActiveTab('QUARTER_ANALYSIS');
                      setIsMobileMoreOpen(false);
                    }}
                    className="p-3.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 flex flex-col items-center gap-2 text-center transition cursor-pointer"
                  >
                    <TrendingUp className="w-5 h-5 text-[#320b86]" />
                    <span className="text-xs font-bold">Quarter Analysis</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setGsActiveTab('CLOUD_USERS');
                  setIsMobileMoreOpen(false);
                }}
                className="p-3.5 rounded-2xl bg-purple-50 hover:bg-purple-100 text-[#320b86] flex flex-col items-center gap-2 text-center transition cursor-pointer"
              >
                <UserPlus className="w-5 h-5" />
                <span className="text-xs font-bold">Staff Logins</span>
              </button>

              {!oversightAdminProfile && currentAdmin?.roleType === 'GENERAL_SUPERINTENDENT' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMoreOpen(false);
                    setBackupModalTab('SAVE');
                    setIsBackupModalOpen(true);
                  }}
                  className="p-3.5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-900 flex flex-col items-center gap-2 text-center transition cursor-pointer"
                >
                  <Database className="w-5 h-5 text-[#320b86]" />
                  <span className="text-xs font-bold">Database Backup</span>
                </button>
              )}

              {onEnterWorkersModule && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMoreOpen(false);
                    onEnterWorkersModule();
                  }}
                  className="p-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 flex flex-col items-center gap-2 text-center transition cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-bold">Workers Module</span>
                </button>
              )}

              {onBackToPortalSelect && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMoreOpen(false);
                    onBackToPortalSelect();
                  }}
                  className="p-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex flex-col items-center gap-2 text-center transition cursor-pointer"
                >
                  <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                  <span className="text-xs font-bold">Switch Portal</span>
                </button>
              )}

              {onLockProfile && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMoreOpen(false);
                    onLockProfile();
                  }}
                  className="p-3.5 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 flex flex-col items-center gap-2 text-center transition cursor-pointer"
                >
                  <Lock className="w-5 h-5 text-amber-600" />
                  <span className="text-xs font-bold">Lock Console</span>
                </button>
              )}

              {onBackToWelcome && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMoreOpen(false);
                    onBackToWelcome();
                  }}
                  className="p-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex flex-col items-center gap-2 text-center transition cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-500" />
                  <span className="text-xs font-bold">Exit to Welcome</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Database Backup & Restore Modal */}
      <DatabaseBackupModal
        isOpen={isBackupModalOpen}
        initialTab={backupModalTab}
        onClose={() => setIsBackupModalOpen(false)}
        onDatabaseRestored={refreshAdminData}
        canAccessReset={currentAdmin?.roleType === 'GENERAL_SUPERINTENDENT'}
      />

    </div>
  );
};
