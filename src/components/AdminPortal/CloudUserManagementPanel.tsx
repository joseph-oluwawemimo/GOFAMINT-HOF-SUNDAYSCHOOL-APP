import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Users,
  Trash2,
  Shield,
  Lock,
  Info,
  Loader2,
  BookOpen,
  KeyRound,
  Building,
  RefreshCw,
  Pencil
} from 'lucide-react';
import { createStaffLogin, listStaffUsers, deleteStaffUser, approveStaffUser, updateStaffLogin } from '../../services/adminUserApi';
import { getAllClassesDirectory } from '../../db/indexedDB';
import { ClassProfile } from '../../types';

const ASSIGNABLE_ADMIN_ROLES = [
  { value: 'GENERAL_SUPERINTENDENT', label: 'General Superintendent (Chief Executive)' },
  { value: 'GENERAL_SECRETARY', label: 'General Secretary' },
  { value: 'DEPARTMENT_SUPERINTENDENT', label: 'Departmental Superintendent (Read-only Analytics)' },
  { value: 'ASST_GENERAL_SECRETARY', label: 'Asst. General Secretary (Workers Directorate)' },
  { value: 'TREASURER', label: 'Treasurer (Finance & Collections)' },
  { value: 'RECORD_OFFICER', label: 'Record Officer (Sunday School Collation)' },
  { value: 'ENROLLMENT_OFFICER', label: 'Enrollment Officer (Student Registration)' },
  { value: 'WORKER', label: 'Worker (Directorate Member)' },
];
const isClassAccount = (roleType?: string) => ['TEACHER', 'CLASS_SECRETARY', 'TEACHER / CLASS_SECRETARY'].includes(roleType || '');

interface CloudUserManagementPanelProps {
  recoveryOnly?: boolean;
  adminRole?: string;
}

export const CloudUserManagementPanel: React.FC<CloudUserManagementPanelProps> = ({
  recoveryOnly = false,
  adminRole
}) => {
  const canCreateClassLogins = adminRole === 'ASST_GENERAL_SECRETARY' || adminRole === 'ASSISTANT_GENERAL_SECRETARY';
  const [activeTab, setActiveTab] = useState<'CREATE_STAFF' | 'CREATE_CLASS_LOGIN' | 'LIST'>('CREATE_STAFF');
  const [isOpen, setIsOpen] = useState(false);

  // Staff creation form state
  const [displayName, setDisplayName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [roleType, setRoleType] = useState('ASST_GENERAL_SECRETARY');
  const [departmentId, setDepartmentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Class login form state
  const [availableClasses, setAvailableClasses] = useState<ClassProfile[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classPassword, setClassPassword] = useState('');
  const [customClassId, setCustomClassId] = useState('');
  const [customClassName, setCustomClassName] = useState('');
  const [customClassDept, setCustomClassDept] = useState('Adult');
  const [useCustomClass, setUseCustomClass] = useState(false);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);

  // Staff accounts list
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const loadClasses = async () => {
    setIsLoadingClasses(true);
    try {
      const cls = await getAllClassesDirectory(true);
      setAvailableClasses(cls);
      if (cls.length > 0) {
        if (!selectedClassId || !cls.some(c => c.id === selectedClassId)) {
          setSelectedClassId(cls[0].id);
        }
        const departments = Array.from(new Set(cls.map(c => String(c.department || '').trim()).filter(Boolean))).sort();
        if (!departmentId || !departments.includes(departmentId)) setDepartmentId(departments[0] || '');
      }
    } catch (e) {
      console.warn('Could not load classes directory:', e);
    } finally {
      setIsLoadingClasses(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadClasses();
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    setDeleteMessage(null);
    try {
      const res = await listStaffUsers();
      if (res.success && res.users) {
        setStaffUsers(res.users);
      } else {
        setStaffUsers([]);
        setDeleteMessage(res.error || 'The account directory could not be loaded.');
      }
    } catch (e: any) {
      console.error('Failed to load users:', e);
      setStaffUsers([]);
      setDeleteMessage(e?.message || 'The account directory could not be loaded.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleApproveStaff = async (u: any) => {
    setApprovingId(u.uid);
    try {
      const res = await approveStaffUser({
        targetUid: u.uid,
      });
      if (!res.success) throw new Error(res.error || 'Approval failed.');
      setDeleteMessage(`Approved and activated login for ${u.displayName || u.email}.`);
      await fetchUsers();
    } catch (e: any) {
      alert(e.message || 'Approval failed.');
    } finally {
      setApprovingId(null);
    }
  };

  // Create Administrative Staff Login
  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (!identifier.trim() || !password) {
      setResult({ ok: false, message: 'Email and password are required.' });
      return;
    }
    if (password.length < 6) {
      setResult({ ok: false, message: 'Password must be at least 6 characters.' });
      return;
    }
    if (roleType === 'DEPARTMENT_SUPERINTENDENT' && !departmentId) {
      setResult({ ok: false, message: 'Select the department this superintendent will oversee.' });
      return;
    }

    setIsSubmitting(true);
    const params: any = {
      email: identifier.trim(),
      password,
      roleType,
      displayName: displayName.trim() || undefined,
      departmentId: roleType === 'DEPARTMENT_SUPERINTENDENT' ? departmentId : undefined
    };

    const res = await createStaffLogin(params);
    setIsSubmitting(false);

    if (res.success) {
      setResult({
        ok: true,
        message: res.message || `Administrative login created for ${identifier} as ${roleType}.`
      });
      setDisplayName('');
      setIdentifier('');
      setPassword('');
      fetchUsers();
    } else {
      setResult({ ok: false, message: res.error || 'Failed to create staff login.' });
    }
  };

  // Create Dedicated Class Login (No Email Required)
  const handleClassLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    let targetId = selectedClassId;
    let targetName = '';

    if (useCustomClass) {
      targetId = customClassId.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      targetName = customClassName.trim() || targetId;
      if (!targetId) {
        setResult({ ok: false, message: 'Please provide a valid Unique Class ID (e.g. YOUTH_A).' });
        return;
      }
    } else {
      const found = availableClasses.find(c => c.id === selectedClassId);
      if (!found) {
        setResult({ ok: false, message: 'Please select an existing Sunday School class from the list.' });
        return;
      }
      targetName = found.className;
    }

    if (!classPassword || classPassword.length < 6) {
      setResult({ ok: false, message: 'Temporary password must be at least 6 characters.' });
      return;
    }

    setIsSubmitting(true);
    const res = await createStaffLogin({
      email: targetId, // Automatically mapped without requiring personal email
      password: classPassword,
      roleType: 'TEACHER',
      displayName: targetName,
      classId: targetId
    });
    setIsSubmitting(false);

    if (res.success) {
      setResult({
        ok: true,
        message: `Class Login provisioned successfully for ${targetName}! Teachers & Secretaries can sign in using Unique Class ID: "${targetId}" and the designated password.`
      });
      if (useCustomClass) {
        setCustomClassId('');
        setCustomClassName('');
      }
      setClassPassword('');
      loadClasses();
      fetchUsers();
    } else {
      setResult({ ok: false, message: res.error || 'Failed to provision class login.' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteMessage(null);
    try {
      const res = await deleteStaffUser(deleteTarget.uid);
      if (res.success) {
        setDeleteMessage(res.message || 'Login identity deleted.');
        setDeleteTarget(null);
        await fetchUsers();
      } else {
        setDeleteMessage(res.error || 'Failed to delete login.');
      }
    } catch (err: any) {
      setDeleteMessage(err.message || 'Error deleting login.');
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditLogin = (user: any) => {
    setEditTarget(user);
    setEditDisplayName(user.displayName || '');
    setEditEmail(user.email || '');
    setEditPassword('');
    setDeleteMessage(null);
  };

  const handleEditLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editTarget || !editDisplayName.trim()) return;
    const isClassLogin = isClassAccount(editTarget.roleType);
    if (!isClassLogin && !editEmail.trim()) {
      setDeleteMessage('A valid staff email is required.');
      return;
    }
    if (editPassword && editPassword.length < 6) {
      setDeleteMessage('A new password must contain at least 6 characters.');
      return;
    }

    setIsEditing(true);
    try {
      const response = await updateStaffLogin(editTarget.uid, {
        displayName: editDisplayName.trim(),
        email: isClassLogin ? undefined : editEmail.trim(),
        password: editPassword || undefined,
      });
      if (!response.success) throw new Error(response.error || 'Login update failed.');
      setDeleteMessage(response.message || 'Staff login details updated successfully.');
      setEditTarget(null);
      setEditPassword('');
      await fetchUsers();
    } catch (error: any) {
      console.error('Failed to update staff login:', error);
      setDeleteMessage(error?.message || 'Failed to update staff login.');
    } finally {
      setIsEditing(false);
    }
  };

  const selectedClassObj = availableClasses.find(c => c.id === selectedClassId);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-6 overflow-hidden">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-950 text-amber-400 flex items-center justify-center font-bold">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <span className="font-black text-slate-900 text-sm font-['Cinzel',serif]">
              Staff & Officer Login Directorate
            </span>
            <p className="text-[11px] text-slate-500">Create, approve, and manage administrative officers and Sunday School class logins.</p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </div>

      {isOpen && (
        <div className="border-t border-slate-100 p-5 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
            Staff and class identities are created securely through the server. Administrative officers use official emails, while Sunday School classes use <strong>Unique Class IDs with zero email requirement</strong>.
          </div>

          {/* Sub Navigation */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => {
                setActiveTab('CREATE_STAFF');
                setResult(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'CREATE_STAFF'
                  ? 'bg-blue-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              + Create Administrative Staff Login
            </button>
            {canCreateClassLogins && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('CREATE_CLASS_LOGIN');
                  setResult(null);
                  loadClasses();
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'CREATE_CLASS_LOGIN'
                    ? 'bg-indigo-900 text-amber-300 shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>+ Create Class Login (No Email)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setActiveTab('LIST');
                setResult(null);
                fetchUsers();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'LIST'
                  ? 'bg-blue-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Active Accounts Directory</span>
            </button>
          </div>

          {/* TAB 1: ADMINISTRATIVE STAFF CREATION */}
          {activeTab === 'CREATE_STAFF' && (
            <form onSubmit={handleStaffSubmit} className="space-y-3.5">
              <div className="grid sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-400 outline-hidden transition"
                    placeholder="e.g. Sister Grace Adeyemi"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Administrative Role</label>
                  <select
                    value={roleType}
                    onChange={(e) => setRoleType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-400 outline-hidden font-medium"
                    disabled={isSubmitting}
                  >
                    {ASSIGNABLE_ADMIN_ROLES.filter((r) => !recoveryOnly || r.value === 'GENERAL_SUPERINTENDENT').map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {roleType === 'DEPARTMENT_SUPERINTENDENT' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-400 outline-hidden font-medium"
                    disabled={isSubmitting || availableClasses.length === 0}
                  >
                    {Array.from(new Set(availableClasses.map(c => String(c.department || '').trim()).filter(Boolean))).sort().map(department => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </select>
                  {availableClasses.length === 0 && <p className="mt-1 text-xs text-red-700">No department is available. Create its classes first.</p>}
                  <p className="mt-1 text-xs text-slate-500">This account can only read analytics for classes and records in the selected department.</p>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Official Staff Email
                  </label>
                  <input
                    type="email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-400 outline-hidden transition"
                    placeholder="officer@example.com"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Temporary Password</label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-400 outline-hidden transition"
                    placeholder="At least 6 characters"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {result && (
                <div
                  className={`flex items-start gap-2 text-xs rounded-xl p-3 border ${
                    result.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'
                  }`}
                >
                  {result.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  <span>{result.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-950 hover:bg-blue-900 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Creating Login Identity…</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 text-amber-400" />
                    <span>Create & Provision Staff Login</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: DEDICATED CLASS LOGIN CREATION (NO EMAIL REQUIRED) */}
          {activeTab === 'CREATE_CLASS_LOGIN' && (
            <form onSubmit={handleClassLoginSubmit} className="space-y-4">
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-950 leading-relaxed space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-purple-900">
                  <KeyRound className="w-4 h-4 text-purple-700" />
                  <span>Dedicated Class Access — Zero Email Address Required</span>
                </div>
                <p>
                  Sunday School teachers and class secretaries do not need personal emails. They will log in to their class register using their <strong>Unique Class ID</strong> (e.g. <code>ADULT_A</code> or <code>YOUTH_A</code>) and password.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700">Class Source:</label>
                  <button
                    type="button"
                    onClick={() => setUseCustomClass(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      !useCustomClass ? 'bg-indigo-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Select from Generated Directory ({availableClasses.length} available)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseCustomClass(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      useCustomClass ? 'bg-indigo-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Enter Custom Class ID
                  </button>
                </div>
                <button
                  type="button"
                  onClick={loadClasses}
                  disabled={isLoadingClasses}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition flex items-center gap-1 shrink-0"
                  title="Reload classes from cloud database"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingClasses ? 'animate-spin' : ''}`} />
                  <span>{isLoadingClasses ? 'Refreshing…' : 'Refresh Classes'}</span>
                </button>
              </div>

              {!useCustomClass ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Choose Sunday School Class <span className="text-purple-600">*</span>
                    </label>
                    {availableClasses.length === 0 ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>No classes found in directory yet. Please ask the Asst. General Secretary to mass-generate classes in her dashboard first.</span>
                        </div>
                        <button
                          type="button"
                          onClick={loadClasses}
                          disabled={isLoadingClasses}
                          className="px-2.5 py-1 bg-amber-200/60 hover:bg-amber-200 text-amber-900 font-bold rounded-lg text-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0 transition"
                        >
                          <RefreshCw className={`w-3 h-3 ${isLoadingClasses ? 'animate-spin' : ''}`} />
                          <span>Check Again</span>
                        </button>
                      </div>
                    ) : (
                      <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600"
                        disabled={isSubmitting}
                      >
                        {availableClasses.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            [{cls.id}] {cls.className} ({cls.department} Department)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {selectedClassObj && (
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 font-bold block text-[10px] uppercase">Unique Sign-in ID</span>
                        <code className="font-black text-indigo-950 text-sm bg-white px-2 py-0.5 rounded border border-slate-200 block mt-0.5">
                          {selectedClassObj.id}
                        </code>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block text-[10px] uppercase">Class Name</span>
                        <span className="font-bold text-slate-900 block mt-0.5">{selectedClassObj.className}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block text-[10px] uppercase">Department</span>
                        <span className="font-bold text-indigo-900 block mt-0.5">{selectedClassObj.department}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Unique Class ID</label>
                    <input
                      type="text"
                      value={customClassId}
                      onChange={(e) => setCustomClassId(e.target.value.toUpperCase())}
                      placeholder="e.g. YOUTH_A"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Class Display Name</label>
                    <input
                      type="text"
                      value={customClassName}
                      onChange={(e) => setCustomClassName(e.target.value)}
                      placeholder="e.g. Youth Class A"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                    <select
                      value={customClassDept}
                      onChange={(e) => setCustomClassDept(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-600 font-semibold"
                    >
                      <option value="Adult">Adult</option>
                      <option value="Youth">Youth</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Children">Children</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Class Access Password (for Teachers & Secretary) <span className="text-purple-600">*</span>
                </label>
                <input
                  type="password"
                  value={classPassword}
                  onChange={(e) => setClassPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-hidden font-mono"
                  placeholder="Minimum 6 characters (e.g. 123456)"
                  disabled={isSubmitting}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Share this password with the appointed teachers and secretary for this Sunday School class.
                </p>
              </div>

              {result && (
                <div
                  className={`flex items-start gap-2 text-xs rounded-xl p-3 border ${
                    result.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'
                  }`}
                >
                  {result.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  <span>{result.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || (!useCustomClass && availableClasses.length === 0)}
                className="w-full bg-indigo-950 hover:bg-indigo-900 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                    <span>Provisioning Class Identity…</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 text-amber-300" />
                    <span>Provision Dedicated Class Login</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: ACTIVE ACCOUNTS DIRECTORY */}
          {activeTab === 'LIST' && (
            <div className="space-y-4">
              {deleteMessage && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-medium">
                  {deleteMessage}
                </div>
              )}

              {isLoadingUsers ? (
                <div className="py-8 flex justify-center items-center gap-2 text-slate-500 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-900" />
                  <span>Loading accounts…</span>
                </div>
              ) : staffUsers.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No accounts found.</p>
              ) : (
                <div className="space-y-4">
                  {/* Category A: Administrative Officers */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-blue-900" />
                      <span>Administrative Officers & Council Staff</span>
                    </h4>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                      {staffUsers
                        .filter(u => !isClassAccount(u.roleType))
                        .map((u) => (
                          <div key={u.uid} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{u.displayName || u.email}</span>
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded text-[10px] font-black uppercase">
                                  {(u.roleType || '').replace(/_/g, ' ')}
                                </span>
                                {u.isApproved === false ? (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                                    Pending Approval
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                                    Active
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500">{u.email}</p>
                            </div>

                            <div className="flex items-center gap-2">
                              {u.isApproved === false && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveStaff(u)}
                                  disabled={approvingId === u.uid}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-xs"
                                  title="Approve and activate this staff account"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{approvingId === u.uid ? 'Approving...' : 'Approve'}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEditLogin(u)}
                                className="px-2.5 py-1 text-blue-800 hover:bg-blue-50 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                                title="Edit staff details or reset the password"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Edit Login</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(u)}
                                className="px-2.5 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                                title="Delete this login identity"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Category B: Sunday School Class Logins */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-700" />
                      <span>Sunday School Class Logins</span>
                    </h4>
                    <div className="divide-y divide-slate-100 border border-indigo-200 rounded-xl overflow-hidden bg-white">
                      {staffUsers
                        .filter(u => isClassAccount(u.roleType))
                        .map((u) => (
                          <div key={u.uid} className="p-3.5 flex items-center justify-between hover:bg-indigo-50/50 transition">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{u.displayName || u.email}</span>
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded text-[10px] font-mono font-black uppercase">
                                  Class ID: {u.classId || 'Not Bound'}
                                </span>
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                                  Provisioned
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500">
                                Login Identifier: <code className="font-bold text-slate-800">{u.classId || u.email}</code>
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditLogin(u)}
                              className="px-2.5 py-1 text-blue-800 hover:bg-blue-50 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                              title="Edit class display name or reset the password"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Edit Login</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(u)}
                              className="px-2.5 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                              title="Delete this class login identity"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                            </div>
                          </div>
                        ))}
                      {staffUsers.filter(u => isClassAccount(u.roleType)).length === 0 && (
                        <p className="p-4 text-xs text-slate-500 text-center">No class logins provisioned yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleEditLogin} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left border border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">Edit Login Details</h3>
              <p className="text-xs text-slate-500 mt-1">{String(editTarget.roleType || '').replace(/_/g, ' ')}</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full / Display Name</label>
              <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" disabled={isEditing} />
            </div>
            {!isClassAccount(editTarget.roleType) && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Login Email</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" disabled={isEditing} />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
              <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Leave blank to keep the current password" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" disabled={isEditing} />
              <p className="text-[11px] text-slate-500 mt-1">Minimum 6 characters when changing the password.</p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button type="button" onClick={() => setEditTarget(null)} disabled={isEditing} className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold">Cancel</button>
              <button type="submit" disabled={isEditing || !editDisplayName.trim()} className="px-4 py-2 bg-blue-950 hover:bg-blue-900 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-2">
                {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4 text-amber-300" />}
                <span>{isEditing ? 'Saving…' : 'Save Login Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal (Identity Only) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Login Identity?</h3>
                <p className="text-xs text-slate-500">{deleteTarget.displayName || deleteTarget.email} ({deleteTarget.roleType})</p>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
              <p className="font-bold">✓ Organizational Data Protection Guarantee:</p>
              <p className="leading-relaxed">
                This action only deletes the authentication credentials and profile identity. All classes, students, grades, offerings, workers, and attendance records remain permanently preserved.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Confirm Delete Login</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
