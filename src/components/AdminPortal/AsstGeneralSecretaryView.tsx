import React, { useState, useEffect } from 'react';
import {
  BookCheck,
  Calendar,
  Users,
  CheckCircle2,
  FileSpreadsheet,
  BookOpen,
  Download,
  Building,
  Sparkles,
  ClipboardCheck,
  Plus,
  Trash2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Layers,
  GraduationCap,
  Baby,
  Smile,
  ShieldAlert,
  Loader2,
  KeyRound,
  X
} from 'lucide-react';
import { AdminProfile, ClassProfile, DepartmentType, SundaySchoolYear } from '../../types';
import { createBatchClasses, deleteClassFromDirectory, getAllWorkers } from '../../db/indexedDB';
import { useDatabaseSync } from '../../hooks/useDatabaseSync';

interface AsstGeneralSecretaryViewProps {
  currentAdmin: AdminProfile;
  allClasses?: ClassProfile[];
  sundaySchoolYear?: SundaySchoolYear;
  onEnterWorkersModule?: () => void;
  onRefreshData?: () => Promise<void>;
}

interface DraftClassItem {
  id: string;
  department: string;
  className: string;
  uniqueId: string;
  password: string;
}

export const AsstGeneralSecretaryView: React.FC<AsstGeneralSecretaryViewProps> = ({
  currentAdmin,
  allClasses = [],
  sundaySchoolYear,
  onEnterWorkersModule,
  onRefreshData
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationFeedback, setGenerationFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
  const [totalWorkersCount, setTotalWorkersCount] = useState<number>(0);

  // Streamlined Pattern Class Creator State
  const [selectedDept, setSelectedDept] = useState<string>('Adult');
  const [draftClasses, setDraftClasses] = useState<DraftClassItem[]>([
    { id: '1', department: 'Adult', className: 'Adult A', uniqueId: 'ADULT_A', password: '' }
  ]);

  const refreshWorkerCount = async () => {
    const workers = await getAllWorkers(true);
    setTotalWorkersCount(workers.length);
  };

  useDatabaseSync(refreshWorkerCount, ['workers']);

  useEffect(() => {
    refreshWorkerCount().catch(error => {
      console.error('Could not load the worker count:', error);
      setTotalWorkersCount(0);
    });
  }, []);

  const safeYear = sundaySchoolYear || {
    id: 'DEFAULT',
    yearName: `${new Date().getFullYear()}–${new Date().getFullYear() + 1}`,
    activeQuarterNumber: 1,
    quarters: [1, 2, 3, 4].map(q => ({
      id: `Q${q}`,
      quarterNumber: q as any,
      totalLessonWeeks: 12,
      lessons: []
    }))
  };

  const totalTeachers = (allClasses || []).reduce((sum, c) => sum + (c.teachers?.length || 0), 0);

  // Filtered classes
  const filteredClasses = (allClasses || []).filter((cls) => {
    const matchesDept = selectedDeptFilter === 'ALL' || cls.department.toLowerCase() === selectedDeptFilter.toLowerCase();
    const matchesSearch =
      !searchQuery.trim() ||
      cls.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cls.secretaryName && cls.secretaryName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (cls.teachers && cls.teachers.some(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesDept && matchesSearch;
  });

  // Handle department change for pattern generator
  const handleDepartmentChange = (newDept: string) => {
    setSelectedDept(newDept);
    setDraftClasses([
      {
        id: Date.now().toString(),
        department: newDept,
        className: `${newDept} A`,
        uniqueId: `${newDept.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_A`,
        password: ''
      }
    ]);
  };

  // Add next class following pattern (Adult A -> + -> Adult B -> + -> Adult C)
  const handleAddNextClassPattern = () => {
    const lastClass = draftClasses[draftClasses.length - 1];
    let nextSuffix = 'B';
    let basePrefix = selectedDept;

    if (lastClass && lastClass.className) {
      const match = lastClass.className.trim().match(/^(.*?)\s+([A-Za-z0-9]+)$/);
      if (match) {
        basePrefix = match[1];
        const suffix = match[2];
        if (suffix.length === 1 && /[A-Y]/i.test(suffix)) {
          nextSuffix = String.fromCharCode(suffix.toUpperCase().charCodeAt(0) + 1);
        } else if (!isNaN(Number(suffix))) {
          nextSuffix = (Number(suffix) + 1).toString();
        }
      }
    }

    const newClassName = `${basePrefix} ${nextSuffix}`;
    const newUniqueId = newClassName.toUpperCase().replace(/[^A-Z0-9]/g, '_');

    setDraftClasses(prev => [
      ...prev,
      {
        id: Date.now().toString() + Math.random().toString().slice(2, 6),
        department: selectedDept,
        className: newClassName,
        uniqueId: newUniqueId,
        password: ''
      }
    ]);
  };

  // Update specific draft class
  const handleUpdateDraft = (id: string, field: keyof DraftClassItem, val: string) => {
    setDraftClasses(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };
        if (field === 'className') {
          updated.uniqueId = val.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
        }
        return updated;
      })
    );
  };

  // Remove draft class row
  const handleRemoveDraftRow = (id: string) => {
    if (draftClasses.length <= 1) return;
    setDraftClasses(prev => prev.filter(c => c.id !== id));
  };

  // Submit and create the drafted classes together
  const handleCreateDraftedClasses = async () => {
    setIsGenerating(true);
    setGenerationFeedback(null);
    try {
      const invalidClass = draftClasses.find(d => !d.className.trim() || !d.department.trim() || !d.uniqueId.trim() || d.password.length < 6);
      if (invalidClass) {
        throw new Error('Every class requires a name, department, unique ID, and temporary password of at least 6 characters.');
      }
      const payload = draftClasses.map(d => ({
        className: d.className.trim(),
        department: d.department.trim(),
        classId: d.uniqueId.trim(),
        password: d.password
      }));

      const created = await createBatchClasses(payload);
      if (onRefreshData) {
        await onRefreshData();
      }

      setGenerationFeedback({
        type: 'success',
        message: `Successfully created ${created.length} class(es)! Class IDs have been established with status "Pending Registration". Teachers & Secretaries can now sign in using their Unique Class ID and Password to complete registration.`
      });

      // Reset to next base class
      setDraftClasses([
        {
          id: Date.now().toString(),
          department: selectedDept,
          className: `${selectedDept} A`,
          uniqueId: `${selectedDept.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_A`,
          password: ''
        }
      ]);
    } catch (err: any) {
      console.error('Error creating drafted classes:', err);
      setGenerationFeedback({
        type: 'error',
        message: err?.message || 'Failed to create classes. Please check your network connection.'
      });
    } finally {
      setIsGenerating(false);
      setTimeout(() => setGenerationFeedback(null), 8000);
    }
  };

  const handleDeleteClass = async (classId: string, className: string) => {
    if (!window.confirm(`Are you sure you want to delete "${className}" (ID: ${classId}) from the Sunday School directory?`)) {
      return;
    }
    setDeletingClassId(classId);
    try {
      await deleteClassFromDirectory(classId);
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (e) {
      alert('Could not delete class from directory.');
    } finally {
      setDeletingClassId(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-indigo-400/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-400/20 border border-indigo-400/40 rounded-full text-xs font-black text-indigo-300 uppercase tracking-wider">
              <BookCheck className="w-3.5 h-3.5" />
              <span>Assistant General Secretary Directorate</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Cinzel',serif] tracking-wide text-white">
              Workers' Directorate & Class Architecture
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100 max-w-2xl leading-relaxed">
              Asst. General Secretary: <strong>{currentAdmin.profileName}</strong> ({currentAdmin.username}) • Managing Sunday School class creation, unique Class IDs, passwords, and workers' oversight.
            </p>
          </div>

          {onEnterWorkersModule && (
            <div className="shrink-0">
              <button
                onClick={onEnterWorkersModule}
                className="px-5 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-2xl text-xs font-black transition flex items-center gap-2 shadow-xl hover:scale-105 transform cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Open Workers Directorate & Terminal →</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Highlights: Registered Classes, Total Teachers Roster, Number of Workers (Item 24) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Registered Classes</span>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{allClasses.length} Classes</h3>
          <p className="text-xs text-slate-500 mt-1">Established in Sunday School directory</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Teacher Rosters</span>
          <h3 className="text-2xl font-black text-indigo-900 mt-1">{totalTeachers} Teachers</h3>
          <p className="text-xs text-slate-500 mt-1">Assigned across classes</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Number of Workers</span>
          <h3 className="text-2xl font-black text-emerald-700 mt-1">{totalWorkersCount} Workers</h3>
          <p className="text-xs text-slate-500 mt-1">Active in Sunday School directory</p>
        </div>
      </div>

      {/* Generation Feedback Toast */}
      {generationFeedback && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 text-xs font-bold animate-in fade-in ${
            generationFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          {generationFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p>{generationFeedback.message}</p>
          </div>
        </div>
      )}

      {/* ----------------- SECTION 1: STREAMLINED CLASS PROFILE CREATOR (Items 3, 4, 5) ----------------- */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-900 flex items-center justify-center font-bold">
                <Building className="w-4 h-4" />
              </div>
              <h2 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                Class Profile Creation
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Only the Assistant General Secretary creates class profiles. Select department, specify the class pattern, and use the <strong>+</strong> button to add more classes. Created classes are placed in <strong>Pending Registration</strong> for teachers to register their staff.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-slate-500">Department:</span>
            <select
              value={selectedDept}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-600 cursor-pointer shadow-xs"
            >
              <option value="Adult">Adult Department</option>
              <option value="Youth">Youth Department</option>
              <option value="Intermediate">Intermediate Department</option>
              <option value="Children">Children Department</option>
              <option value="Primary/Juniors">Primary / Juniors</option>
              <option value="Special">Special Department</option>
            </select>
          </div>
        </div>

        {/* Pattern-Based Class Rows */}
        <div className="space-y-3">
          <div className="hidden sm:grid sm:grid-cols-12 gap-3 text-[11px] font-black uppercase tracking-wider text-slate-400 px-2">
            <div className="col-span-3">Department</div>
            <div className="col-span-3">Class Name</div>
            <div className="col-span-3">Unique ID (Auto-Generated)</div>
            <div className="col-span-2">Password</div>
            <div className="col-span-1 text-center">Action</div>
          </div>

          {draftClasses.map((item, index) => (
            <div
              key={item.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl items-center hover:border-indigo-300 transition"
            >
              <div className="col-span-3">
                <span className="sm:hidden text-[10px] font-bold text-slate-400 block mb-1">Department:</span>
                <input
                  type="text"
                  value={item.department}
                  onChange={(e) => handleUpdateDraft(item.id, 'department', e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-600"
                />
              </div>

              <div className="col-span-3">
                <span className="sm:hidden text-[10px] font-bold text-slate-400 block mb-1">Class Name:</span>
                <input
                  type="text"
                  value={item.className}
                  onChange={(e) => handleUpdateDraft(item.id, 'className', e.target.value)}
                  placeholder="e.g. Adult A"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-indigo-600"
                />
              </div>

              <div className="col-span-3">
                <span className="sm:hidden text-[10px] font-bold text-slate-400 block mb-1">Unique ID:</span>
                <div className="relative">
                  <input
                    type="text"
                    value={item.uniqueId}
                    onChange={(e) => handleUpdateDraft(item.id, 'uniqueId', e.target.value)}
                    placeholder="e.g. ADULT_A"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-black text-indigo-900 outline-none focus:border-indigo-600 uppercase"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <span className="sm:hidden text-[10px] font-bold text-slate-400 block mb-1">Password:</span>
                <input
                  type="password"
                  value={item.password}
                  onChange={(e) => handleUpdateDraft(item.id, 'password', e.target.value)}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-indigo-600 font-mono"
                />
              </div>

              <div className="col-span-1 text-center">
                {draftClasses.length > 1 && (
                  <button
                    onClick={() => handleRemoveDraftRow(item.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    title="Remove class from creation batch"
                  >
                    <X className="w-4 h-4 mx-auto" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pattern Creator Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            id="btn-add-class-pattern"
            type="button"
            onClick={handleAddNextClassPattern}
            className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-300 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer active:scale-95 shadow-2xs"
          >
            <Plus className="w-4 h-4 text-indigo-700" />
            <span>+ Add Next Class Pattern (e.g. B, C...)</span>
          </button>

          <button
            id="btn-create-classes-batch"
            type="button"
            onClick={handleCreateDraftedClasses}
            disabled={isGenerating || draftClasses.length === 0}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-xl text-xs font-black flex items-center gap-2 transition shadow-md disabled:opacity-50 cursor-pointer active:scale-95"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin text-amber-300" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
            <span>Create {draftClasses.length} Class(es) Together</span>
          </button>
        </div>
      </div>

      {/* ----------------- SECTION 2: CLASS DIRECTORY & VERIFICATION ----------------- */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
              Sunday School Class Directory & Status
            </h3>
            <p className="text-xs text-slate-500">
              Full registry of generated classes, designated Unique IDs, appointed teachers, and secretarial assignments.
            </p>
          </div>

          {/* Search & Department Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ID, class, teacher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-600 w-48 sm:w-60"
              />
            </div>

            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-600"
            >
              <option value="ALL">All Departments</option>
              <option value="Adult">Adult</option>
              <option value="Youth">Youth</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Children">Children</option>
            </select>
          </div>
        </div>

        {filteredClasses.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Building className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-black text-slate-700">No Classes Found</h4>
            <p className="text-xs text-slate-500">
              {allClasses.length === 0
                ? 'No Sunday School classes generated yet. Use the Class Profile Creator above to establish classes.'
                : 'No classes match the current search or filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredClasses.map((cls) => {
              const isApproved = cls.approvalStatus === 'APPROVED';
              const isPending = cls.approvalStatus === 'PENDING_APPROVAL';

              return (
                <div key={cls.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 px-2 rounded-xl transition">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-indigo-950 bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded font-mono">
                        ID: {cls.id}
                      </span>
                      <span className="text-xs font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded">
                        {cls.department}
                      </span>
                      <h4 className="text-sm font-black text-slate-900">{cls.className}</h4>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
                      <div>
                        <strong>Secretary:</strong>{' '}
                        {cls.secretaryName ? (
                          <span>{cls.secretaryName} {cls.secretaryPhone && `(${cls.secretaryPhone})`}</span>
                        ) : (
                          <span className="text-amber-700 italic">Not yet assigned (Pending registration)</span>
                        )}
                      </div>
                      <div>
                        <strong>Teacher(s):</strong>{' '}
                        {cls.teachers && cls.teachers.length > 0 ? (
                          <span>{cls.teachers.map(t => t.name).join(', ')}</span>
                        ) : (
                          <span className="text-amber-700 italic">No teachers attached yet</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {isApproved ? (
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Approved & Active</span>
                      </span>
                    ) : isPending ? (
                      <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-2xs">
                        <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                        <span>Pending General Secretary Approval</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1 rounded-xl flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
                        <span>Pending Registration (Awaiting Teacher Setup)</span>
                      </span>
                    )}

                    <button
                      onClick={() => handleDeleteClass(cls.id, cls.className)}
                      disabled={deletingClassId === cls.id}
                      title="Delete class from directory"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
