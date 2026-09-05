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
}

export const GeneralSuperintendentView: React.FC<GeneralSuperintendentViewProps> = ({
  currentAdmin,
  adminProfiles,
  allClasses,
  sundaySchoolYear,
  onApproveAdminProfile,
  onApproveClass,
  onRefreshData
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CLASS_PORTAL_EXPLORER' | 'ADMIN_APPROVALS' | 'CLASS_APPROVALS' | 'ALL_CLASSES'>('OVERVIEW');
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
  const pendingClasses = allClasses.filter(c => String(c.approvalStatus || '').trim().toUpperCase() === 'PENDING_APPROVAL');
  const approvedClasses = allClasses.filter(c => String(c.approvalStatus || '').trim().toUpperCase() === 'APPROVED' || !c.approvalStatus);

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
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-amber-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-amber-400/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 border border-amber-400/50 rounded-full text-xs font-black text-amber-300 uppercase tracking-wider">
              <Crown className="w-3.5 h-3.5" />
              <span>Primary Administrative Authority</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Cinzel',serif] tracking-wide text-white">
              General Superintendent Council
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 max-w-2xl leading-relaxed">
              Presiding Officer: <strong>{currentAdmin.profileName}</strong> ({currentAdmin.username}) • Highest administrative oversight for GOFAMINT_HOF Sunday School Directorate, officer credential approvals, and national class authorizations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2.5 rounded-2xl text-center">
              <span className="text-[10px] uppercase font-bold text-amber-300 block">Active Year</span>
              <span className="text-sm font-black text-white">{sundaySchoolYear.yearName}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2.5 rounded-2xl text-center">
              <span className="text-[10px] uppercase font-bold text-amber-300 block">Approved Classes</span>
              <span className="text-sm font-black text-white">{approvedClasses.length}</span>
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

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'OVERVIEW'
              ? 'bg-blue-900 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Executive Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('CLASS_PORTAL_EXPLORER')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
            activeTab === 'CLASS_PORTAL_EXPLORER'
              ? 'bg-amber-900 text-white shadow-sm ring-2 ring-amber-400/50'
              : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
          }`}
        >
          <Building2 className="w-4 h-4 text-amber-600" />
          <span>Department & Class Portals (5 Dashboards)</span>
        </button>

        <button
          onClick={() => setActiveTab('ADMIN_APPROVALS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'ADMIN_APPROVALS'
              ? 'bg-blue-900 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Officer Profile Approvals</span>
          {pendingAdmins.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-400 text-slate-900 text-[10px] font-black rounded-full">
              {pendingAdmins.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('CLASS_APPROVALS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'CLASS_APPROVALS'
              ? 'bg-blue-900 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
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
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'ALL_CLASSES'
              ? 'bg-blue-900 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <School className="w-4 h-4" />
          <span>National Class Directory ({allClasses.length})</span>
        </button>
      </div>

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
              <h3 className="text-xl font-black text-emerald-700 mt-1">{approvedAdmins.length} / 5 Roles</h3>
              <p className="text-xs text-slate-500 mt-1">One Active Profile per ID</p>
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
              Administrative Council Status (5 ID Structure)
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
                  {cls.approvalStatus === 'APPROVED' || !cls.approvalStatus ? (
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
