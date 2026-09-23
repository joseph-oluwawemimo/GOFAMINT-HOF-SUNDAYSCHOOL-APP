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
  ChevronRight
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
import { EnrollmentOfficerView } from './EnrollmentOfficerView';
import { AsstGeneralSecretaryView } from './AsstGeneralSecretaryView';
import { DepartmentSuperintendentView } from './DepartmentSuperintendentView';
import { DatabaseBackupModal } from '../DatabaseBackupModal';
import { approveStaffUser, logOversightAccess } from '../../services/adminUserApi';
import type { ApplicationProfile } from '../../services/profileService';
import { cloudGetSundaySchoolYear, cloudGetAllAdminProfiles } from '../../services/supabaseDatabase';

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
  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(null);
  const [sundaySchoolYear, setSundaySchoolYear] = useState<SundaySchoolYear | null>(null);
  const [allClasses, setAllClasses] = useState<ClassProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [profileResolutionError, setProfileResolutionError] = useState<string | null>(null);
  const [oversightAdminProfile, setOversightAdminProfile] = useState<AdminProfile | null>(null);

  // Data Backup / Restore Modal State
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupModalTab, setBackupModalTab] = useState<'SAVE' | 'LOAD' | 'RESET'>('SAVE');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Refresh and load all data from IndexedDB and Supabase.
  const refreshAdminData = async (silent = false, forceCloudRefresh = true) => {
    if (!silent) {
      setLoading(true);
      setCurrentAdmin(null);
    }
    setProfileResolutionError(null);
    setIsPendingApproval(false);
    try {
      let profiles = await getAllAdminProfiles();
      let year = await getSundaySchoolYear();
      const classes = await getAllClassesDirectory(forceCloudRefresh);

      // Merge with cloud admin profiles if accessible
      try {
        const cloudProfs = await cloudGetAllAdminProfiles();
        // The protected server/database is authoritative for account approval.
        // Replacing prevents a previously-approved browser cache from reviving a
        // suspended profile, and skip-cloud caching avoids unauthorized writes.
        profiles = cloudProfs || [];
        await replaceStoreContents('adminProfiles', profiles);
      } catch (cloudErr) {
        console.warn('Could not sync cloud admin profiles:', cloudErr);
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

        const activeProfile: AdminProfile = {
          id: matchedExisting?.id || authProfile.id,
          roleType: uRole,
          title: matchedExisting?.title || (uRole === 'GENERAL_SECRETARY'
            ? 'General Secretary ID'
            : uRole === 'GENERAL_SUPERINTENDENT'
            ? 'General Superintendent ID'
            : `${uRole.replace(/_/g, ' ')} ID`),
          profileName: matchedExisting?.profileName || authProfile.displayName || authProfile.email || 'Officer',
          username: authProfile.email || matchedExisting?.username || 'officer',
          photoBase64: matchedExisting?.photoBase64,
          departmentId: authProfile.departmentId || matchedExisting?.departmentId || undefined,
          isApproved: authProfile.isApproved || matchedExisting?.isApproved === true,
          approvedBy: authProfile.approvedBy || matchedExisting?.approvedBy || undefined,
          approvedAt: authProfile.approvedAt || matchedExisting?.approvedAt || undefined,
          createdAt: matchedExisting?.createdAt || authProfile.createdAt,
          updatedAt: new Date().toISOString()
        };

        if (!profiles.some(p => p.id === activeProfile.id || p.roleType === uRole)) {
          profiles = [activeProfile, ...profiles];
        }

        setCurrentAdmin(activeProfile);
        setIsPendingApproval(!activeProfile.isApproved);
      }

      // If Sunday School Year is not yet in IndexedDB, fetch it through the
      // authenticated Supabase client and retain the existing local cache.
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
    // The listener is rebound when the authenticated identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authProfile?.id]);

  // Approval is security-sensitive: update the local cache only after the
  // authenticated server confirms that the exact account was activated.
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

  // Approve Class Registration
  const handleApproveClass = async (classId: string) => {
    // 1. Optimistic update so pending list updates immediately without delay
    setAllClasses(prev => prev.map(c => c.id === classId ? { ...c, approvalStatus: 'APPROVED' } : c));
    const approved = await approveClassById(classId);
    if (!approved) throw new Error('The class could not be approved because it was not found.');
    // 2. Authoritative update
    setAllClasses(prev => prev.map(c => c.id === classId ? { ...c, ...approved, approvalStatus: 'APPROVED' } : c));
    // 3. Silent refresh so views don't unmount and active tab is preserved
    await refreshAdminData(true);
  };

  // Distribute 12 Lessons to All Classes
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

  // Archive Quarter and Activate Next
  const handleArchiveAndActivateNextQuarter = async (currentQ: QuarterNumber) => {
    const updated = await archiveQuarterAndActivateNext(currentQ);
    if (updated) {
      setSundaySchoolYear(updated);
      alert(`Quarter ${currentQ} has been archived. Quarter ${updated.activeQuarterNumber} is now active.`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold font-['Cinzel',serif] tracking-wide">
          THE GOSPEL FAITH MISSION INTL
        </h2>
        <p className="text-xs text-slate-400 mt-1">Connecting to Directorate Central Authority…</p>
      </div>
    );
  }

  if (profileResolutionError || !currentAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/95 rounded-2xl p-8 text-center shadow-2xl space-y-4 border border-amber-400/40">
          <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center mx-auto text-amber-800 font-black text-xl">!</div>
          <h2 className="text-lg font-bold text-slate-900 font-['Cinzel',serif]">Administrative account setup required</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {profileResolutionError || 'Your administrative role could not be resolved.'}
          </p>
          <button
            type="button"
            onClick={() => void refreshAdminData()}
            className="px-5 py-2.5 bg-blue-950 hover:bg-blue-900 text-white font-bold rounded-xl text-xs transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // If officer account is pending General Superintendent approval
  if (isPendingApproval) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/95 rounded-2xl p-8 text-center shadow-2xl space-y-4 border border-amber-400/40">
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
              className="px-5 py-2.5 bg-blue-950 hover:bg-blue-900 text-white font-bold rounded-xl text-xs transition"
            >
              Lock Console
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activePortalAdmin = oversightAdminProfile || currentAdmin;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      
      {/* Top Directorate Navigation Header */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-amber-400/30 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <GofamintLogo size={36} />
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-amber-300 uppercase font-['Cinzel',serif] block truncate">
                THE GOSPEL FAITH MISSION INTL
              </span>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-white font-['Cinzel',serif] tracking-wide truncate">
                  Directorate Council
                </h1>
                {currentAdmin && (
                  <span className="hidden xs:inline-block text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/30 whitespace-nowrap">
                    {currentAdmin.title}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Navigation Action Buttons */}
          <div className="hidden sm:flex items-center gap-2">
            {onBackToPortalSelect && (
              <button
                onClick={onBackToPortalSelect}
                className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/90 text-slate-200 hover:text-white border border-slate-700/80 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Return to Portal Destination Selection"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                <span>Switch Portal</span>
              </button>
            )}

            {onBackToWelcome && (
              <button
                onClick={onBackToWelcome}
                className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/90 text-slate-200 hover:text-white border border-slate-700/80 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Return to Welcome Screen"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                <span>Exit to Welcome</span>
              </button>
            )}

            {onEnterWorkersModule && (
              <button
                onClick={onEnterWorkersModule}
                className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/90 text-emerald-300 hover:text-emerald-200 border border-emerald-700/40 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Workers Directorate</span>
              </button>
            )}

            {!oversightAdminProfile && currentAdmin?.roleType === 'GENERAL_SUPERINTENDENT' && (
              <button
                type="button"
                onClick={() => {
                  setBackupModalTab('SAVE');
                  setIsBackupModalOpen(true);
                }}
                className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/90 text-blue-200 hover:text-white border border-blue-700/40 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Export, restore, archive, or reset database records"
              >
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span>Database Control</span>
              </button>
            )}

            {onLockProfile && (
              <button
                onClick={onLockProfile}
                className="px-3 py-1.5 bg-slate-800/80 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-amber-400/30 hover:border-amber-400/60 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Lock profile session (requires password to resume)"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Lock Profile</span>
              </button>
            )}
          </div>

          {/* Mobile Compact Header Controls */}
          <div className="flex sm:hidden items-center gap-1.5">
            {onLockProfile && (
              <button
                onClick={onLockProfile}
                className="p-2 bg-slate-800/80 hover:bg-amber-500/20 text-amber-300 border border-amber-400/30 rounded-xl transition cursor-pointer"
                title="Lock Profile"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition cursor-pointer"
              title="Toggle Menu"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <MoreVertical className="w-4 h-4" />}
            </button>
          </div>

        </div>

        {/* Mobile Slide-down Action Drawer */}
        {isMobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-800 bg-slate-900/98 px-4 py-3 space-y-2 animate-in slide-in-from-top duration-200">
            {onBackToPortalSelect && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onBackToPortalSelect();
                }}
                className="w-full px-3.5 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                  <span>Switch Portal</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            )}
            {onEnterWorkersModule && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onEnterWorkersModule();
                }}
                className="w-full px-3.5 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-emerald-300 border border-emerald-700/40 rounded-xl text-xs font-semibold transition flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Workers Directorate</span>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-400/60" />
              </button>
            )}
            {!oversightAdminProfile && currentAdmin?.roleType === 'GENERAL_SUPERINTENDENT' && (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setBackupModalTab('SAVE');
                  setIsBackupModalOpen(true);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-blue-200 border border-blue-700/40 rounded-xl text-xs font-semibold transition flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-400" />
                  <span>Database Control</span>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-400/60" />
              </button>
            )}
            {onBackToWelcome && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onBackToWelcome();
                }}
                className="w-full px-3.5 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4 text-amber-400" />
                  <span>Exit to Welcome</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main Administrative Views */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {oversightAdminProfile && (
          <div className="bg-emerald-950 border border-emerald-500/50 rounded-2xl px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div>
              <span className="text-[10px] uppercase font-black tracking-wider text-emerald-300">General Superintendent Oversight Mode</span>
              <p className="text-sm font-bold text-white">Viewing {oversightAdminProfile.title}: {oversightAdminProfile.profileName}</p>
            </div>
            <button type="button" onClick={() => setOversightAdminProfile(null)} className="px-4 py-2 rounded-xl bg-white text-emerald-950 text-xs font-black hover:bg-emerald-50">
              Return to General Superintendent
            </button>
          </div>
        )}
        
        {/* Staff & Officer Account Creation / Management Panel (Executive Admins Only) */}
        {!oversightAdminProfile && (['GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY', 'SUPER_ADMIN'].includes(currentAdmin?.roleType || '')) && (
          <CloudUserManagementPanel adminRole={currentAdmin?.roleType} />
        )}

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
              {/* View by Role */}
              {(activePortalAdmin?.roleType === 'GENERAL_SUPERINTENDENT' || activePortalAdmin?.roleType === 'SUPER_ADMIN') && (
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
                />
              )}

              {activePortalAdmin?.roleType === 'DEPARTMENT_SUPERINTENDENT' && (
                <DepartmentSuperintendentView
                  currentAdmin={activePortalAdmin}
                  allClasses={allClasses.filter(item => String(item.department || '').trim() === String(activePortalAdmin.departmentId || '').trim())}
                  sundaySchoolYear={effectiveYear}
                />
              )}

              {activePortalAdmin?.roleType === 'TREASURER' && (
                <TreasurerView
                  currentAdmin={activePortalAdmin}
                  allClasses={allClasses}
                  sundaySchoolYear={effectiveYear}
                />
              )}

              {activePortalAdmin?.roleType === 'RECORD_OFFICER' && (
                <RecordOfficerView
                  currentAdmin={activePortalAdmin}
                  allClasses={allClasses}
                  sundaySchoolYear={effectiveYear}
                />
              )}

              {activePortalAdmin?.roleType === 'ENROLLMENT_OFFICER' && (
                <EnrollmentOfficerView
                  currentAdmin={activePortalAdmin}
                  allClasses={allClasses}
                  sundaySchoolYear={effectiveYear}
                />
              )}

              {(activePortalAdmin?.roleType === 'ASST_GENERAL_SECRETARY' || activePortalAdmin?.roleType === 'ASSISTANT_GENERAL_SECRETARY') && (
                <AsstGeneralSecretaryView
                  currentAdmin={activePortalAdmin}
                  allClasses={allClasses}
                  sundaySchoolYear={effectiveYear}
                  onEnterWorkersModule={onEnterWorkersModule}
                  onRefreshData={() => refreshAdminData(true)}
                />
              )}
            </>
          );
        })()}

      </main>

      {/* Database Backup & Restore Modal */}
      <DatabaseBackupModal
        isOpen={isBackupModalOpen}
        initialTab={backupModalTab}
        onClose={() => setIsBackupModalOpen(false)}
        onDatabaseRestored={refreshAdminData}
        canAccessReset={currentAdmin?.roleType === 'GENERAL_SUPERINTENDENT'}
      />

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-slate-600 border-t border-slate-900">
        The Gospel Faith Mission International (House of Favour) • Sunday School Directorate
      </footer>

    </div>
  );
};
