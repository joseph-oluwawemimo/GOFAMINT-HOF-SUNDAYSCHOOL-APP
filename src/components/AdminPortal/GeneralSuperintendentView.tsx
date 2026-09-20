import React, { useState } from 'react';
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
  QrCode
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
}

export const GeneralSuperintendentView: React.FC<GeneralSuperintendentViewProps> = ({
  currentAdmin,
  adminProfiles,
  allClasses,
  sundaySchoolYear,
  onApproveAdminProfile,
  onApproveClass,
  onRefreshData,
  onEnterAdminProfile
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PORTAL_OVERSIGHT' | 'CLASS_PORTAL_EXPLORER' | 'ADMIN_APPROVALS' | 'CLASS_APPROVALS' | 'ALL_CLASSES'>('OVERVIEW');
  const [explorerInitialClassId, setExplorerInitialClassId] = useState<string | undefined>(undefined);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const handleApproveAdmin = async (id: string, name: string, email?: string, roleType?: string) => {
    setProcessingId(id);
    setActionError(null);
    try {
      // Optimistic update so UI instantly approves
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
      
      {/* Top Presiding Authority Banner */}
      <div className="bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-amber-400/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/15 border border-amber-400/40 rounded-full text-xs font-bold text-amber-300 uppercase tracking-wider w-fit">
              <Crown className="w-3.5 h-3.5" />
              <span>Primary Administrative Authority</span>
            </div>
            <div className="text-xs text-slate-300/80 font-medium">
              Academic Year: <strong className="text-amber-300 font-bold">{sundaySchoolYear.yearName}</strong>
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-['Cinzel',serif] tracking-wide text-white">
              General Superintendent Council
            </h1>
            <p className="text-xs text-blue-200/90 mt-1 max-w-2xl leading-relaxed">
              Presiding Officer: <strong className="text-white">{currentAdmin.profileName}</strong> ({currentAdmin.username}) • Highest administrative oversight for credential approvals, governance, and curriculum dispatch.
            </p>
          </div>

          {/* Quick Metric Strip */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 pt-1">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 px-3 sm:px-4 py-2.5 rounded-2xl text-center">
              <span className="text-[10px] uppercase font-bold text-amber-300 block truncate">Active Quarter</span>
              <span className="text-base sm:text-lg font-black text-white">Q{sundaySchoolYear.activeQuarterNumber}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/15 px-3 sm:px-4 py-2.5 rounded-2xl text-center">
              <span className="text-[10px] uppercase font-bold text-amber-300 block truncate">Officers</span>
              <span className="text-base sm:text-lg font-black text-emerald-300">{authorizedOfficerApproved}/{authorizedOfficerTotal}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/15 px-3 sm:px-4 py-2.5 rounded-2xl text-center">
              <span className="text-[10px] uppercase font-bold text-amber-300 block truncate">Classes</span>
              <span className="text-base sm:text-lg font-black text-white">{approvedClasses.length}</span>
            </div>
          </div>
        </div>

        {actionSuccess && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-400 text-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-300" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div className="mt-4 p-3 bg-rose-500/20 border border-rose-400 text-rose-200 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-300" />
            <span>{actionError}</span>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs - Mobile-Optimized Horizontal Scroll Bar */}
      <div className="overflow-x-auto no-scrollbar py-1 -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-slate-200">
        <div className="inline-flex items-center gap-2 min-w-max p-1 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`h-10 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'OVERVIEW'
                ? 'bg-blue-950 text-white shadow-sm ring-1 ring-blue-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Executive Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('PORTAL_OVERSIGHT')}
            className={`h-10 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'PORTAL_OVERSIGHT'
                ? 'bg-emerald-900 text-white shadow-sm ring-1 ring-emerald-800'
                : 'text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            <ExternalLink className="w-4 h-4 text-emerald-500" />
            <span>Officer Portals</span>
          </button>

          <button
            onClick={() => setActiveTab('CLASS_PORTAL_EXPLORER')}
            className={`h-10 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'CLASS_PORTAL_EXPLORER'
                ? 'bg-amber-900 text-white shadow-sm ring-1 ring-amber-800'
                : 'text-amber-900 hover:bg-amber-50'
            }`}
          >
            <Building2 className="w-4 h-4 text-amber-600" />
            <span>Class Dashboards (5)</span>
          </button>

          <button
            onClick={() => setActiveTab('ADMIN_APPROVALS')}
            className={`h-10 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'ADMIN_APPROVALS'
                ? 'bg-blue-950 text-white shadow-sm ring-1 ring-blue-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Officer Approvals</span>
            {pendingAdmins.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-black rounded-full">
                {pendingAdmins.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('CLASS_APPROVALS')}
            className={`h-10 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'CLASS_APPROVALS'
                ? 'bg-blue-950 text-white shadow-sm ring-1 ring-blue-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Class Approvals</span>
            {pendingClasses.length > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full">
                {pendingClasses.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ALL_CLASSES')}
            className={`h-10 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'ALL_CLASSES'
                ? 'bg-blue-950 text-white shadow-sm ring-1 ring-blue-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <School className="w-4 h-4" />
            <span>National Directory ({allClasses.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'PORTAL_OVERSIGHT' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div>
            <h3 className="text-base font-black text-slate-900">Executive Portal Oversight</h3>
            <p className="text-xs text-slate-500 mt-1">Enter any approved officer portal without that officer's password. Your General Superintendent identity and audit trail remain active.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {approvedAdmins.filter(profile => profile.roleType !== currentAdmin.roleType).map(profile => (
              <button
                key={profile.id}
                type="button"
                onClick={() => onEnterAdminProfile(profile)}
                className="p-4 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-left transition group"
              >
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">{profile.title}</span>
                <h4 className="text-sm font-black text-slate-900 mt-2">{profile.profileName}</h4>
                <p className="text-xs text-slate-500 mt-1">{profile.username}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-900 group-hover:text-emerald-800">
                  Enter in Oversight Mode <ExternalLink className="w-3.5 h-3.5" />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Department & Class Portal Explorer (5 Dashboards) */}
      {activeTab === 'CLASS_PORTAL_EXPLORER' && (
        <DepartmentClassExplorer
          currentAdmin={currentAdmin}
          allClasses={allClasses}
          sundaySchoolYear={sundaySchoolYear}
          initialClassId={explorerInitialClassId}
          onBackToOverview={() => setActiveTab('OVERVIEW')}
        />
      )}

      {/* Tab 1: Executive Overview */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sunday School Year</span>
              <h3 className="text-xl font-black text-slate-900 mt-1">{sundaySchoolYear.yearName}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-1">{sundaySchoolYear.overallTheme}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Quarter</span>
              <h3 className="text-xl font-black text-blue-900 mt-1">Quarter {sundaySchoolYear.activeQuarterNumber}</h3>
              <p className="text-xs text-slate-500 mt-1">
                {sundaySchoolYear.quarters.find(q => q.quarterNumber === sundaySchoolYear.activeQuarterNumber)?.quarterTheme || 'Active Curriculum'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Approvals</span>
              <h3 className="text-xl font-black text-amber-600 mt-1">
                {pendingAdmins.length + pendingClasses.length} Requests
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {pendingAdmins.length} Officers • {pendingClasses.length} Classes
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Authorized Officers</span>
              <h3 className="text-xl font-black text-emerald-700 mt-1">{authorizedOfficerApproved} / {authorizedOfficerTotal} Profiles</h3>
              <p className="text-xs text-slate-500 mt-1">
                {pendingAdmins.length > 0
                  ? `Awaiting: ${pendingAdmins.map(profile => profile.title).join(', ')}`
                  : 'Every created officer profile is active'}
              </p>
            </div>
          </div>

          {/* Pending Alerts Banner */}
          {(pendingAdmins.length > 0 || pendingClasses.length > 0) && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
              <AlertCircle className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <h4 className="text-sm font-black text-amber-900">
                  Action Required: Pending Approvals Awaiting General Superintendent Authority
                </h4>
                <p className="text-xs text-amber-800">
                  {pendingAdmins.length > 0 && `• ${pendingAdmins.length} administrative officer profile(s) awaiting credentials verification. `}
                  {pendingClasses.length > 0 && `• ${pendingClasses.length} Sunday School class registration(s) awaiting approval for lesson distribution.`}
                </p>
                <div className="pt-2 flex items-center gap-3">
                  {pendingAdmins.length > 0 && (
                    <button
                      onClick={() => setActiveTab('ADMIN_APPROVALS')}
                      className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition"
                    >
                      Review Officer Profiles →
                    </button>
                  )}
                  {pendingClasses.length > 0 && (
                    <button
                      onClick={() => setActiveTab('CLASS_APPROVALS')}
                      className="px-3 py-1.5 bg-blue-900 text-white rounded-lg text-xs font-bold hover:bg-blue-800 transition"
                    >
                      Review Classes →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Administrative Hierarchy Cards */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
              Administrative Council Status ({authorizedOfficerTotal} Created Profiles)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className={`p-4 rounded-xl border-2 transition ${
                    profile.isApproved
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-amber-50/60 border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      {profile.title}
                    </span>
                    {profile.isApproved ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-black text-slate-900 mt-2">{profile.profileName}</h4>
                  <p className="text-xs text-slate-500">Username: <code className="text-blue-900 font-bold">{profile.username}</code></p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Admin Profile Approvals */}
      {activeTab === 'ADMIN_APPROVALS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Administrative Officer Credential Approvals
              </h3>
              <p className="text-xs text-slate-500">
                All administrative accounts created with General Secretary, Treasurer, Enrollment Officer, or Workers' IDs require General Superintendent authorization.
              </p>
            </div>
          </div>

          {pendingAdmins.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">No Pending Administrative Approvals</h4>
              <p className="text-xs text-slate-500">All registered administrative profiles are active and approved.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingAdmins.map((admin) => (
                <div key={admin.id} className="bg-white rounded-2xl border-2 border-amber-300 p-5 shadow-sm space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                        {admin.title}
                      </span>
                      <h4 className="text-base font-black text-slate-900 mt-1">{admin.profileName}</h4>
                      <p className="text-xs text-slate-500">
                        Generated Username: <strong className="text-blue-900">{admin.username}</strong>
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(admin.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      disabled={processingId === admin.id}
                      onClick={() => handleApproveAdmin(admin.id, admin.profileName, admin.username, admin.roleType)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                    >
                      <Check className="w-4 h-4" />
                      <span>{processingId === admin.id ? 'Approving...' : 'Grant Official Approval'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Approved Officers List */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 mt-6">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider text-slate-500">
              Active Authorized Officers ({approvedAdmins.length})
            </h4>
            <div className="divide-y divide-slate-100">
              {approvedAdmins.map((admin) => (
                <div key={admin.id} className="py-3 flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">{admin.profileName}</h5>
                    <p className="text-xs text-slate-500">{admin.title} • Username: <code className="text-blue-900 font-semibold">{admin.username}</code></p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    Approved
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Class Approvals */}
      {activeTab === 'CLASS_APPROVALS' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-black text-slate-900">
              Sunday School Class Authorizations
            </h3>
            <p className="text-xs text-slate-500">
              Newly created classes submitted by teachers require General Superintendent or General Secretary authorization to receive lesson curriculum and official status.
            </p>
          </div>

          {actionSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm animate-in fade-in">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="font-semibold">{actionSuccess}</p>
            </div>
          )}

          {actionError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-sm animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <p className="font-semibold">{actionError}</p>
            </div>
          )}

          {pendingClasses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">All Registered Classes Are Approved</h4>
              <p className="text-xs text-slate-500">There are no pending class authorization requests at this time.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingClasses.map((cls) => (
                <div key={cls.id} className="bg-white rounded-2xl border-2 border-red-300 p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-red-800 bg-red-100 px-2.5 py-0.5 rounded-full">
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
                      <Clock className="w-3 h-3" /> Awaiting approval
                    </span>
                    <button
                      disabled={processingId === cls.id}
                      onClick={() => handleApproveClass(cls.id, cls.className)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                    >
                      {processingId === cls.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Approving...</span>
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
          )}
        </div>
      )}

      {/* Tab 4: National Class Directory */}
      {activeTab === 'ALL_CLASSES' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-black text-slate-900">
              National Sunday School Class Directory ({allClasses.length})
            </h3>
            <p className="text-xs text-slate-500">
              Comprehensive list of all registered Sunday School classes across all departments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allClasses.map((cls) => (
              <div key={cls.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-full">
                    {cls.department}
                  </span>
                  {cls.approvalStatus === 'APPROVED' ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      Approved
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      Pending
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-black text-slate-900">{cls.className}</h4>
                  <p className="text-xs text-slate-600 mt-1">Secretary: {cls.secretaryName}</p>
                  <p className="text-xs text-slate-500">
                    Teachers: {cls.teachers.map(t => t.name).join(', ') || 'None assigned'}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">5 Permitted Dashboards</span>
                  <button
                    onClick={() => {
                      setExplorerInitialClassId(cls.id);
                      setActiveTab('CLASS_PORTAL_EXPLORER');
                    }}
                    className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    <span>Enter Class Portal</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
