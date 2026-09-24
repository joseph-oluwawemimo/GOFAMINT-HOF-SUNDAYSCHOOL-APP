import React, { useState, useEffect, useMemo } from 'react';
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
  Edit2,
  X,
  Phone,
  UserCheck,
  ShieldCheck,
  TrendingUp,
  School,
  ArrowRight,
  PlusCircle,
  Check
} from 'lucide-react';
import { AdminProfile, ClassProfile, DepartmentType, SundaySchoolYear } from '../../types';
import {
  createBatchClasses,
  deleteClassFromDirectory,
  getAllWorkers,
  getAllDepartmentsList,
  saveClassToDirectory
} from '../../db/indexedDB';
import { updateClassApi } from '../../services/adminUserApi';
import { useDatabaseSync } from '../../hooks/useDatabaseSync';

export type AsstGsecTab = 'OVERVIEW' | 'CREATE_CLASSES' | 'CLASS_DIRECTORY' | 'TEACHER_ROSTER';

interface AsstGeneralSecretaryViewProps {
  currentAdmin: AdminProfile;
  allClasses?: ClassProfile[];
  sundaySchoolYear?: SundaySchoolYear;
  onEnterWorkersModule?: () => void;
  onRefreshData?: () => Promise<void>;
  activeTab?: AsstGsecTab;
  onTabChange?: (tab: AsstGsecTab) => void;
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
  onRefreshData,
  activeTab: controlledActiveTab,
  onTabChange
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<AsstGsecTab>('OVERVIEW');
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const setActiveTab = (tab: AsstGsecTab) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationFeedback, setGenerationFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
  const [totalWorkersCount, setTotalWorkersCount] = useState<number>(0);

  // Authoritative approved departments from General Secretary / General Superintendent
  const [approvedDepartments, setApprovedDepartments] = useState<string[]>(['Adult', 'Youth', 'Children']);

  // Class Editing Modal State
  const [editingClass, setEditingClass] = useState<ClassProfile | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassDept, setEditClassDept] = useState('');
  const [editClassPassword, setEditClassPassword] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Streamlined Pattern Class Creator State
  const [selectedDept, setSelectedDept] = useState<string>('Adult');
  const [draftClasses, setDraftClasses] = useState<DraftClassItem[]>([
    { id: '1', department: 'Adult', className: 'Adult A', uniqueId: 'ADULT_A', password: '' }
  ]);

  const loadApprovedDepartments = async () => {
    try {
      const depts = await getAllDepartmentsList();
      if (depts && depts.length > 0) {
        setApprovedDepartments(depts);
        if (!depts.includes(selectedDept)) {
          setSelectedDept(depts[0]);
        }
      }
    } catch (e) {
      console.warn('Could not load approved departments list:', e);
    }
  };

  const refreshWorkerCount = async () => {
    const workers = await getAllWorkers(true);
    setTotalWorkersCount(workers.length);
    await loadApprovedDepartments();
  };

  useDatabaseSync(refreshWorkerCount, ['workers', 'sundaySchoolYear', 'departments', 'allClasses']);

  useEffect(() => {
    loadApprovedDepartments();
    refreshWorkerCount().catch(error => {
      console.error('Could not load the worker count:', error);
      setTotalWorkersCount(0);
    });
  }, []);

  const totalTeachers = (allClasses || []).reduce((sum, c) => sum + (c.teachers?.length || 0), 0);
  const approvedClassesCount = (allClasses || []).filter(c => c.approvalStatus === 'APPROVED').length;
  const pendingClassesCount = (allClasses || []).filter(c => String(c.approvalStatus || '').trim().toUpperCase() === 'PENDING_APPROVAL').length;
  const pendingRegistrationCount = (allClasses || []).filter(c => !c.approvalStatus || c.approvalStatus === 'PENDING_REGISTRATION').length;

  // Filtered classes for Directory
  const filteredClasses = useMemo(() => {
    return (allClasses || []).filter((cls) => {
      const matchesDept = selectedDeptFilter === 'ALL' || cls.department.toLowerCase() === selectedDeptFilter.toLowerCase();
      
      let matchesStatus = true;
      if (selectedStatusFilter === 'APPROVED') {
        matchesStatus = cls.approvalStatus === 'APPROVED';
      } else if (selectedStatusFilter === 'PENDING_APPROVAL') {
        matchesStatus = cls.approvalStatus === 'PENDING_APPROVAL';
      } else if (selectedStatusFilter === 'PENDING_REGISTRATION') {
        matchesStatus = !cls.approvalStatus || cls.approvalStatus === 'PENDING_REGISTRATION';
      }

      const matchesSearch =
        !searchQuery.trim() ||
        cls.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cls.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cls.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cls.secretaryName && cls.secretaryName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (cls.teachers && cls.teachers.some(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())));

      return matchesDept && matchesStatus && matchesSearch;
    });
  }, [allClasses, selectedDeptFilter, selectedStatusFilter, searchQuery]);

  // Department Stats Breakdown
  interface DeptStatInfo {
    count: number;
    teachers: number;
    classes: ClassProfile[];
  }

  const departmentBreakdown = useMemo<Record<string, DeptStatInfo>>(() => {
    const map: Record<string, DeptStatInfo> = {};
    approvedDepartments.forEach(d => {
      map[d] = { count: 0, teachers: 0, classes: [] };
    });

    (allClasses || []).forEach(cls => {
      const deptName = cls.department || 'Adult';
      if (!map[deptName]) {
        map[deptName] = { count: 0, teachers: 0, classes: [] };
      }
      map[deptName].count += 1;
      map[deptName].teachers += cls.teachers?.length || 0;
      map[deptName].classes.push(cls);
    });

    return map;
  }, [approvedDepartments, allClasses]);

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
      setActiveTab('CLASS_DIRECTORY');
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

  const handleStartEditClass = (cls: ClassProfile) => {
    setEditingClass(cls);
    setEditClassName(cls.className || '');
    setEditClassDept(cls.department || approvedDepartments[0] || 'Adult');
    setEditClassPassword('');
    setEditError(null);
  };

  const handleSaveEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    if (!editClassName.trim()) {
      setEditError('Class name cannot be empty.');
      return;
    }
    if (!editClassDept.trim()) {
      setEditError('Please select an authorized department.');
      return;
    }
    if (editClassPassword && editClassPassword.length < 6) {
      setEditError('Password must be at least 6 characters.');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);
    try {
      // 1. Persist to server
      const res = await updateClassApi(editingClass.id, {
        className: editClassName.trim(),
        department: editClassDept.trim(),
        password: editClassPassword || undefined
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to update class.');
      }

      // 2. Persist to local directory
      const updatedClass: ClassProfile = {
        ...editingClass,
        className: editClassName.trim(),
        department: editClassDept.trim() as any,
        updatedAt: new Date().toISOString()
      };
      await saveClassToDirectory(updatedClass);

      if (onRefreshData) {
        await onRefreshData();
      }

      setEditingClass(null);
      setGenerationFeedback({
        type: 'success',
        message: `Class "${editClassName.trim()}" (ID: ${editingClass.id}) updated successfully!`
      });
      setTimeout(() => setGenerationFeedback(null), 6000);
    } catch (err: any) {
      console.error('Error updating class:', err);
      setEditError(err.message || 'Could not update class.');
    } finally {
      setIsSavingEdit(false);
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
      
      {/* ----------------------------------------------------------------------- */}
      {/* 1. JOBIE ROYAL PURPLE HERO BANNER (ASSISTANT GENERAL SECRETARY)        */}
      {/* ----------------------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-[#250664] via-[#320b86] to-[#451093] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-white/10 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 rounded-full text-xs font-black text-amber-300 uppercase tracking-wider">
              <BookCheck className="w-3.5 h-3.5 text-amber-300" />
              <span>Assistant General Secretary Directorate</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Cinzel',serif] tracking-wide text-white">
              SUNDAY SCHOOL CLASS ARCHITECTURE & CREDENTIALS
            </h1>
            <p className="text-xs sm:text-sm text-purple-100 max-w-2xl leading-relaxed">
              Assistant General Secretary: <strong>{currentAdmin.profileName}</strong> ({currentAdmin.username}) • Authoritative class identities, unique credentials provisioning, teacher staffing, and workers oversight.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('CREATE_CLASSES')}
              className="px-5 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-2xl text-xs font-black transition flex items-center gap-2 shadow-lg hover:scale-105 transform cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>+ Create New Class</span>
            </button>

            {onEnterWorkersModule && (
              <button
                onClick={onEnterWorkersModule}
                className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Workers Directorate →</span>
              </button>
            )}
          </div>
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

      {/* ----------------------------------------------------------------------- */}
      {/* TAB 1: ARCHITECTURE OVERVIEW                                            */}
      {/* ----------------------------------------------------------------------- */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          
          {/* 4 Prominent KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Registered Classes */}
            <div 
              onClick={() => setActiveTab('CLASS_DIRECTORY')}
              className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-purple-200 transition cursor-pointer group"
            >
              <div className="flex items-center justify-between pb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Established Classes
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#320b86] flex items-center justify-center font-bold">
                  <Building className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <h3 className="text-3xl font-black text-slate-900 font-sans tracking-tight">
                  {allClasses.length}
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">Classes registered in church directory</span>
              </div>
              <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-[#320b86]">
                <span>{approvedClassesCount} Approved</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>

            {/* Card 2: Total Teachers */}
            <div 
              onClick={() => setActiveTab('TEACHER_ROSTER')}
              className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-purple-200 transition cursor-pointer group"
            >
              <div className="flex items-center justify-between pb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Teaching Roster
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <h3 className="text-3xl font-black text-slate-900 font-sans tracking-tight">
                  {totalTeachers}
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">Assigned teaching staff across classes</span>
              </div>
              <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-blue-700">
                <span>View Full Roster</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>

            {/* Card 3: Workers Directorate */}
            <div 
              onClick={onEnterWorkersModule}
              className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-purple-200 transition cursor-pointer group"
            >
              <div className="flex items-center justify-between pb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Workers Directorate
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <h3 className="text-3xl font-black text-slate-900 font-sans tracking-tight">
                  {totalWorkersCount}
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">Workers in active Sunday School directory</span>
              </div>
              <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-emerald-700">
                <span>Open Terminal & Kiosk</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>

            {/* Card 4: Approvals & Setup Readiness */}
            <div 
              onClick={() => setActiveTab('CLASS_DIRECTORY')}
              className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-purple-200 transition cursor-pointer group"
            >
              <div className="flex items-center justify-between pb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Setup Status
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <h3 className="text-3xl font-black text-slate-900 font-sans tracking-tight">
                  {pendingRegistrationCount}
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">Awaiting teacher sign-in or approval</span>
              </div>
              <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-amber-700">
                <span>{pendingClassesCount > 0 ? `${pendingClassesCount} Pending GS Approval` : 'Ready to Deploy'}</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>

          </div>

          {/* Department Distribution Section */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                  Department Class Allocation & Staffing
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Distribution of classrooms and assigned teachers by authorized Sunday School departments.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('CREATE_CLASSES')}
                className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-[#320b86] font-bold text-xs rounded-xl border border-purple-100/80 transition cursor-pointer self-start sm:self-auto"
              >
                + Add Class Pattern
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {(Object.entries(departmentBreakdown) as [string, DeptStatInfo][]).map(([deptName, info]) => {
                const isChildren = deptName.toLowerCase().includes('child');
                const isYouth = deptName.toLowerCase().includes('youth');
                const isAdult = deptName.toLowerCase().includes('adult');

                return (
                  <div
                    key={deptName}
                    className="p-5 rounded-2xl bg-slate-50/70 border border-slate-100/90 flex flex-col justify-between hover:border-purple-200 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-black text-slate-900">{deptName}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-[#320b86]">
                          {info.count} Class{info.count !== 1 ? 'es' : ''}
                        </span>
                      </div>
                      <div className="space-y-1 mb-3">
                        <div className="text-xs text-slate-500">
                          <strong>{info.teachers}</strong> Assigned Teacher{info.teachers !== 1 ? 's' : ''}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {info.classes.slice(0, 4).map(c => (
                            <span key={c.id} className="text-[10px] bg-white border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                              {c.className}
                            </span>
                          ))}
                          {info.classes.length > 4 && (
                            <span className="text-[10px] bg-white text-slate-400 px-1.5 py-0.5 rounded">
                              +{info.classes.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        handleDepartmentChange(deptName);
                        setActiveTab('CREATE_CLASSES');
                      }}
                      className="w-full mt-3 py-1.5 text-center text-xs font-bold text-[#320b86] bg-white hover:bg-purple-50 rounded-xl border border-purple-100 transition cursor-pointer"
                    >
                      + Add {deptName} Class
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Class Directory List Preview */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-50">
              <div>
                <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                  Class Registry Overview
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Recent class identities established in the directory.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('CLASS_DIRECTORY')}
                className="text-xs font-bold text-[#320b86] hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>View Full Directory ({allClasses.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {allClasses.slice(0, 6).map(cls => (
                <div key={cls.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-100 to-indigo-50 text-[#320b86] font-black text-xs flex items-center justify-center shrink-0">
                      {cls.className.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900">{cls.className}</span>
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {cls.id}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {cls.department} • Secretary: {cls.secretaryName || 'Pending Registration'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      cls.approvalStatus === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : cls.approvalStatus === 'PENDING_APPROVAL'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}>
                      {cls.approvalStatus === 'APPROVED' ? 'Approved & Active' : cls.approvalStatus === 'PENDING_APPROVAL' ? 'Pending Approval' : 'Pending Registration'}
                    </span>
                    <button
                      onClick={() => handleStartEditClass(cls)}
                      className="p-1.5 text-slate-400 hover:text-[#320b86] rounded-lg transition"
                      title="Edit class"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* TAB 2: STREAMLINED CLASS PROFILE CREATOR                                */}
      {/* ----------------------------------------------------------------------- */}
      {activeTab === 'CREATE_CLASSES' && (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#320b86] flex items-center justify-center font-bold">
                  <Building className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 font-['Cinzel',serif]">
                  Class Profile Creation & Credentials Provisioning
                </h2>
              </div>
              <p className="text-xs text-slate-500 max-w-2xl">
                As the Assistant General Secretary, select the target department, specify the class name pattern, and use <strong>+ Add Next Class Pattern</strong> to batch-generate classrooms with unique IDs and passwords.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-slate-500">Department:</span>
              <select
                value={selectedDept}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-600 cursor-pointer shadow-2xs"
              >
                {approvedDepartments.map(dept => (
                  <option key={dept} value={dept}>{dept} Department</option>
                ))}
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

            {draftClasses.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl items-center hover:border-purple-300 transition"
              >
                <div className="col-span-3">
                  <span className="sm:hidden text-[10px] font-bold text-slate-400 block mb-1">Department:</span>
                  <select
                    value={item.department}
                    onChange={(e) => handleUpdateDraft(item.id, 'department', e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-[#320b86] cursor-pointer"
                  >
                    {approvedDepartments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-3">
                  <span className="sm:hidden text-[10px] font-bold text-slate-400 block mb-1">Class Name:</span>
                  <input
                    type="text"
                    value={item.className}
                    onChange={(e) => handleUpdateDraft(item.id, 'className', e.target.value)}
                    placeholder="e.g. Adult A"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-[#320b86]"
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
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-black text-[#320b86] outline-none focus:border-[#320b86] uppercase"
                    />
                  </div>
                </div>

                <div className="col-span-2">
                  <span className="sm:hidden text-[10px] font-bold text-slate-400 block mb-1">Password:</span>
                  <input
                    type="password"
                    value={item.password}
                    onChange={(e) => handleUpdateDraft(item.id, 'password', e.target.value)}
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-[#320b86] font-mono"
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <button
              id="btn-add-class-pattern"
              type="button"
              onClick={handleAddNextClassPattern}
              className="w-full sm:w-auto px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-[#320b86] border border-purple-200 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 shadow-2xs"
            >
              <Plus className="w-4 h-4 text-[#320b86]" />
              <span>+ Add Next Class Pattern (e.g. B, C...)</span>
            </button>

            <button
              id="btn-create-classes-batch"
              type="button"
              onClick={handleCreateDraftedClasses}
              disabled={isGenerating || draftClasses.length === 0}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#320b86] hover:bg-[#28076e] text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition shadow-md disabled:opacity-50 cursor-pointer active:scale-95"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
              <span>Create {draftClasses.length} Class(es) Together</span>
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* TAB 3: CLASS DIRECTORY & VERIFICATION                                   */}
      {/* ----------------------------------------------------------------------- */}
      {activeTab === 'CLASS_DIRECTORY' && (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-7 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 font-['Cinzel',serif]">
                Sunday School Class Directory & Status
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
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
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-[#320b86] w-48 sm:w-60"
                />
              </div>

              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#320b86]"
              >
                <option value="ALL">All Departments</option>
                {approvedDepartments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#320b86]"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Approved & Active</option>
                <option value="PENDING_REGISTRATION">Pending Registration</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
              </select>
            </div>
          </div>

          {filteredClasses.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Building className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-sm font-black text-slate-700">No Classes Found</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {allClasses.length === 0
                  ? 'No Sunday School classes generated yet. Use the Class Profile Creator to establish classes.'
                  : 'No classes match your current search or filter criteria.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredClasses.map((cls) => {
                const isApproved = cls.approvalStatus === 'APPROVED';
                const isPending = cls.approvalStatus === 'PENDING_APPROVAL';

                return (
                  <div key={cls.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 px-3 rounded-2xl transition">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-[#320b86] bg-purple-100 border border-purple-200 px-2 py-0.5 rounded font-mono">
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
                          <span>Pending GS Approval</span>
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1 rounded-xl flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
                          <span>Pending Registration</span>
                        </span>
                      )}

                      <button
                        onClick={() => handleStartEditClass(cls)}
                        title="Edit class profile (Department, Name, Password)"
                        className="p-1.5 text-slate-400 hover:text-[#320b86] hover:bg-purple-50 rounded-lg transition cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

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
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* TAB 4: TEACHER ROSTER & SECRETARIAL DEPLOYMENT                          */}
      {/* ----------------------------------------------------------------------- */}
      {activeTab === 'TEACHER_ROSTER' && (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-7 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 font-['Cinzel',serif]">
                Teaching Personnel & Secretarial Roster
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Staffing oversight of all Sunday School classes, identifying assigned personnel and staffing vacancies.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-[#320b86] bg-purple-50 border border-purple-200 px-3 py-1 rounded-xl">
                {totalTeachers} Teachers Assigned
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allClasses.map(cls => {
              const hasTeachers = cls.teachers && cls.teachers.length > 0;
              const hasSecretary = Boolean(cls.secretaryName);

              return (
                <div
                  key={cls.id}
                  className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3 hover:border-purple-200 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">{cls.className}</h4>
                      <span className="text-[10px] font-mono font-bold text-slate-400">ID: {cls.id} • {cls.department}</span>
                    </div>
                    <button
                      onClick={() => handleStartEditClass(cls)}
                      className="p-1 text-slate-400 hover:text-[#320b86]"
                      title="Edit class"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs border-t border-slate-200/60 pt-3">
                    <div className="flex items-start gap-2">
                      <UserCheck className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-700">Class Secretary:</span>{' '}
                        {hasSecretary ? (
                          <span className="text-slate-900 font-medium">
                            {cls.secretaryName} {cls.secretaryPhone && `(${cls.secretaryPhone})`}
                          </span>
                        ) : (
                          <span className="text-amber-700 font-medium italic">Unassigned (Pending Registration)</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <GraduationCap className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-700">Teachers:</span>{' '}
                        {hasTeachers ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {cls.teachers?.map((t, idx) => (
                              <span key={idx} className="bg-white border border-slate-200 text-slate-800 text-[11px] px-2 py-0.5 rounded-md font-medium">
                                {t.name} {t.role && <span className="text-slate-400 text-[9px]">({t.role})</span>}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-amber-700 font-medium italic">No teachers attached yet</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Class Modal */}
      {editingClass && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#320b86] flex items-center justify-center font-bold">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 font-['Cinzel',serif]">Edit Class Profile</h3>
                  <p className="text-[11px] text-slate-500 font-mono">Class ID: {editingClass.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEditClass} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Class Name</label>
                <input
                  type="text"
                  value={editClassName}
                  onChange={(e) => setEditClassName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-[#320b86]"
                  placeholder="e.g. Adult B"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Department</label>
                <select
                  value={editClassDept}
                  onChange={(e) => setEditClassDept(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-[#320b86] cursor-pointer"
                >
                  {approvedDepartments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Reset Password <span className="text-slate-400 font-normal">(Leave blank to keep existing password)</span>
                </label>
                <input
                  type="password"
                  value={editClassPassword}
                  onChange={(e) => setEditClassPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 outline-none focus:border-[#320b86]"
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-[#320b86] hover:bg-[#28076e] text-white font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
