import React, { useState } from 'react';
import {
  FileSpreadsheet,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  CheckCircle,
  Archive,
  ArrowRight,
  Plus,
  Edit3,
  Save,
  Send,
  Building,
  Check,
  AlertTriangle,
  FolderArchive,
  FileText,
  Clock,
  Trash2,
  Building2,
  School,
  ChevronRight,
  Loader2
} from 'lucide-react';
import {
  AdminProfile,
  SundaySchoolYear,
  QuarterData,
  QuarterLesson,
  QuarterNumber,
  ClassProfile
} from '../../types';
import { DepartmentClassExplorer } from './DepartmentClassExplorer';
import {
  calculatePrepDateFromSunday,
  calculateSundayFromPrepDate,
  formatDateDisplay,
  formatDateISO,
  parseDateSafe,
  getQuarterWeeklySchedule
} from '../../utils/quarterScheduleUtils';

interface GeneralSecretaryViewProps {
  currentAdmin: AdminProfile;
  sundaySchoolYear: SundaySchoolYear;
  allClasses: ClassProfile[];
  onSaveSundaySchoolYear: (year: SundaySchoolYear) => Promise<void>;
  onDistributeLessons: (quarterNumber: QuarterNumber) => Promise<void>;
  onArchiveAndActivateNextQuarter: (currentQuarter: QuarterNumber) => Promise<void>;
  onAddDepartment: (name: string) => Promise<void>;
  onUpdateDepartment?: (oldName: string, newName: string) => Promise<void>;
  onDeleteDepartment?: (name: string) => Promise<void>;
  onApproveClass: (classId: string) => Promise<void>;
  onRefreshData: () => Promise<void>;
}

export const GeneralSecretaryView: React.FC<GeneralSecretaryViewProps> = ({
  currentAdmin,
  sundaySchoolYear,
  allClasses,
  onSaveSundaySchoolYear,
  onDistributeLessons,
  onArchiveAndActivateNextQuarter,
  onAddDepartment,
  onUpdateDepartment,
  onDeleteDepartment,
  onApproveClass,
  onRefreshData
}) => {
  const [activeTab, setActiveTab] = useState<'SUNDAY_SCHOOL_SETUP' | 'CLASS_PORTAL_EXPLORER' | 'DEPARTMENTS' | 'CLASS_APPROVALS'>('SUNDAY_SCHOOL_SETUP');
  const [setupStep, setSetupStep] = useState<1 | 2 | 3 | 4>(1);
  const [explorerInitialClassId, setExplorerInitialClassId] = useState<string | undefined>(undefined);
  const [selectedQuarterNumber, setSelectedQuarterNumber] = useState<QuarterNumber>(sundaySchoolYear.activeQuarterNumber);
  
  // Year setup state
  const [yearName, setYearName] = useState(sundaySchoolYear.yearName);
  const [overallTheme, setOverallTheme] = useState(sundaySchoolYear.overallTheme);
  
  // Quarter edit state
  const currentQuarter = sundaySchoolYear.quarters.find(q => q.quarterNumber === selectedQuarterNumber) || sundaySchoolYear.quarters[0];
  const isQuarterReadOnly = currentQuarter.status === 'ARCHIVED' && currentQuarter.archiveEditUnlocked !== true;
  const [quarterTheme, setQuarterTheme] = useState(currentQuarter.quarterTheme);
  const [totalLessonWeeks, setTotalLessonWeeks] = useState<12 | 13>(currentQuarter.totalLessonWeeks);
  const [week1ThursdayDate, setWeek1ThursdayDate] = useState<string>(
    currentQuarter.week1ThursdayDate || (currentQuarter.startDate ? calculatePrepDateFromSunday(currentQuarter.startDate) : '')
  );
  const [week1SundayDate, setWeek1SundayDate] = useState<string>(
    currentQuarter.week1SundayDate || currentQuarter.startDate || ''
  );
  const [showSchedulePreview, setShowSchedulePreview] = useState(true);

  // Lesson batch paste state
  const [batchLessonText, setBatchLessonText] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Department CRUD states
  const [newDeptName, setNewDeptName] = useState('');
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [editingDeptOldName, setEditingDeptOldName] = useState<string | null>(null);
  const [editingDeptNewName, setEditingDeptNewName] = useState('');
  const [showEditDeptModal, setShowEditDeptModal] = useState(false);
  const [deletingDeptName, setDeletingDeptName] = useState<string | null>(null);
  const [showDeleteDeptModal, setShowDeleteDeptModal] = useState(false);

  // Class approval action states
  const [processingClassId, setProcessingClassId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleApproveClass = async (classId: string, className: string) => {
    setProcessingClassId(classId);
    try {
      await onApproveClass(classId);
      setActionSuccess(`Class "${className}" has been approved and authorized for active Sunday School operations.`);
      setTimeout(() => setActionSuccess(null), 5000);
      await onRefreshData();
    } catch (err: any) {
      console.error('Failed to approve class:', err);
      setActionError(err?.message || `Failed to approve class ${className}.`);
      setTimeout(() => setActionError(null), 6000);
    } finally {
      setProcessingClassId(null);
    }
  };

  const handleOpenEditDept = (dept: string) => {
    setEditingDeptOldName(dept);
    setEditingDeptNewName(dept);
    setShowEditDeptModal(true);
  };

  const handleSaveEditDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeptOldName || !editingDeptNewName.trim()) return;
    if (onUpdateDepartment) {
      await onUpdateDepartment(editingDeptOldName, editingDeptNewName.trim());
      setFeedback(`Renamed department from "${editingDeptOldName}" to "${editingDeptNewName.trim()}". All linked classes were updated.`);
    }
    setShowEditDeptModal(false);
    setEditingDeptOldName(null);
    setEditingDeptNewName('');
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleOpenDeleteDept = (dept: string) => {
    setDeletingDeptName(dept);
    setShowDeleteDeptModal(true);
  };

  const handleConfirmDeleteDept = async () => {
    if (!deletingDeptName) return;
    if (onDeleteDepartment) {
      await onDeleteDepartment(deletingDeptName);
      setFeedback(`Removed department "${deletingDeptName}".`);
    }
    setShowDeleteDeptModal(false);
    setDeletingDeptName(null);
    setTimeout(() => setFeedback(null), 4000);
  };

  // Single Lesson Editor state
  const [editingWeekNumber, setEditingWeekNumber] = useState<number | null>(1);
  const [lessonTopic, setLessonTopic] = useState('');
  const [scriptureReading, setScriptureReading] = useState('');
  const [memoryVerse, setMemoryVerse] = useState('');
  const [memoryVerseRef, setMemoryVerseRef] = useState('');
  const [aim, setAim] = useState('');

  // UI state
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDistributing, setIsDistributing] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  const pendingClasses = allClasses.filter(c => String(c.approvalStatus || '').trim().toUpperCase() === 'PENDING_APPROVAL');

  const handleSelectQuarter = (qNum: QuarterNumber) => {
    setSelectedQuarterNumber(qNum);
    const q = sundaySchoolYear.quarters.find(item => item.quarterNumber === qNum);
    if (q) {
      setQuarterTheme(q.quarterTheme);
      setTotalLessonWeeks(q.totalLessonWeeks);
      const sunDate = q.week1SundayDate || q.startDate || '';
      const thuDate = q.week1ThursdayDate || (sunDate ? calculatePrepDateFromSunday(sunDate) : '');
      setWeek1SundayDate(sunDate);
      setWeek1ThursdayDate(thuDate);
      setEditingWeekNumber(1);
      const firstLesson = q.lessons?.[0];
      if (firstLesson) {
        setLessonTopic(firstLesson.topic);
        setScriptureReading(firstLesson.scriptureReading);
        setMemoryVerse(firstLesson.memoryVerse || '');
        setMemoryVerseRef(firstLesson.memoryVerseRef || '');
        setAim(firstLesson.aim || '');
      }
    }
  };

  const handleThursdayChange = (val: string) => {
    setWeek1ThursdayDate(val);
    if (val) {
      const sun = calculateSundayFromPrepDate(val);
      setWeek1SundayDate(sun);
    }
  };

  const handleSundayChange = (val: string) => {
    setWeek1SundayDate(val);
    if (val) {
      const thu = calculatePrepDateFromSunday(val);
      setWeek1ThursdayDate(thu);
    }
  };

  const handleSelectLessonForEdit = (lesson: QuarterLesson) => {
    setEditingWeekNumber(lesson.weekNumber);
    setLessonTopic(lesson.topic);
    setScriptureReading(lesson.scriptureReading);
    setMemoryVerse(lesson.memoryVerse || '');
    setMemoryVerseRef(lesson.memoryVerseRef || '');
    setAim(lesson.aim || '');
  };

  const handleSaveYearDetails = async () => {
    const updatedYear: SundaySchoolYear = {
      ...sundaySchoolYear,
      yearName: yearName.trim() || sundaySchoolYear.yearName,
      overallTheme: overallTheme.trim() || sundaySchoolYear.overallTheme,
      updatedAt: new Date().toISOString()
    };
    await onSaveSundaySchoolYear(updatedYear);
    setFeedback('Sunday School Year setup updated successfully!');
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSaveQuarterDetails = async () => {
    if (isQuarterReadOnly) {
      alert('This quarter is ARCHIVED (Read-Only) and cannot be edited.');
      return;
    }

    let qStartDate = week1SundayDate || currentQuarter.startDate;
    let qEndDate = currentQuarter.endDate;
    let qSharingDate = currentQuarter.sharingAdmonitionDate;

    if (week1SundayDate) {
      const baseSun = parseDateSafe(week1SundayDate);
      qStartDate = formatDateISO(baseSun);
      
      const endSun = new Date(baseSun);
      endSun.setDate(baseSun.getDate() + (totalLessonWeeks - 1) * 7);
      qEndDate = formatDateISO(endSun);

      const sharingSun = new Date(baseSun);
      sharingSun.setDate(baseSun.getDate() + totalLessonWeeks * 7);
      qSharingDate = formatDateISO(sharingSun);
    }

    const updatedQuarters = sundaySchoolYear.quarters.map(q => {
      if (q.quarterNumber === selectedQuarterNumber) {
        return {
          ...q,
          quarterTheme: quarterTheme.trim() || q.quarterTheme,
          totalLessonWeeks,
          week1ThursdayDate: week1ThursdayDate || undefined,
          week1SundayDate: week1SundayDate || undefined,
          startDate: qStartDate,
          endDate: qEndDate,
          sharingAdmonitionDate: qSharingDate,
          updatedAt: new Date().toISOString()
        };
      }
      return q;
    });

    const updatedYear: SundaySchoolYear = {
      ...sundaySchoolYear,
      quarters: updatedQuarters,
      updatedAt: new Date().toISOString()
    };

    try {
      await onSaveSundaySchoolYear(updatedYear);
      setFeedback(`Quarter ${selectedQuarterNumber} details & generated schedule saved.`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (error) {
      console.error(`Quarter ${selectedQuarterNumber} save failed:`, error);
      alert(error instanceof Error ? error.message : `Quarter ${selectedQuarterNumber} could not be saved.`);
    }
  };

  const handleSaveSingleLesson = async () => {
    if (isQuarterReadOnly) {
      alert('This quarter is ARCHIVED (Read-Only) and cannot be modified.');
      return;
    }
    if (!editingWeekNumber) return;

    const isSharing = editingWeekNumber > totalLessonWeeks;

    const updatedLessons = [...(currentQuarter.lessons || [])];
    const existingIndex = updatedLessons.findIndex(l => l.weekNumber === editingWeekNumber);

    const newLessonObj: QuarterLesson = {
      weekNumber: editingWeekNumber,
      isSharingAdmonitionWeek: isSharing,
      topic: lessonTopic.trim() || (isSharing ? 'Sharing & Admonition Week' : `Lesson ${editingWeekNumber}`),
      scriptureReading: scriptureReading.trim() || 'Scripture reading to be assigned',
      memoryVerse: memoryVerse.trim(),
      memoryVerseRef: memoryVerseRef.trim(),
      aim: aim.trim() || (isSharing ? 'Quarterly testimonies and mutual admonition' : 'Spiritual aim')
    };

    if (existingIndex >= 0) {
      updatedLessons[existingIndex] = newLessonObj;
    } else {
      updatedLessons.push(newLessonObj);
    }
    updatedLessons.sort((a, b) => a.weekNumber - b.weekNumber);

    const updatedQuarters = sundaySchoolYear.quarters.map(q => {
      if (q.quarterNumber === selectedQuarterNumber) {
        return {
          ...q,
          lessons: updatedLessons,
          updatedAt: new Date().toISOString()
        };
      }
      return q;
    });

    const updatedYear: SundaySchoolYear = {
      ...sundaySchoolYear,
      quarters: updatedQuarters,
      updatedAt: new Date().toISOString()
    };

    await onSaveSundaySchoolYear(updatedYear);
    setFeedback(`Lesson ${editingWeekNumber} saved! Click "Distribute to All Classes" to sync live.`);
    setTimeout(() => setFeedback(null), 4000);
  };

  // Quick Text Batch Paste Parser
  const handleParseAndLoadBatchText = async () => {
    if (!batchLessonText.trim()) return;
    if (isQuarterReadOnly) {
      alert('Cannot load lessons into an Archived quarter.');
      return;
    }

    const lines = batchLessonText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsedLessons: QuarterLesson[] = [];

    // Parse lines or format: "Lesson 1: Topic | Scripture | Memory Verse"
    let currentWeek = 1;
    for (const line of lines) {
      if (currentWeek > totalLessonWeeks) break;
      
      const parts = line.split('|').map(p => p.trim());
      const topic = parts[0]?.replace(/^(Lesson\s*\d+[\s:.-]*|Week\s*\d+[\s:.-]*)/i, '') || `Lesson ${currentWeek}`;
      const scripture = parts[1] || 'Scripture reading as assigned';
      const mv = parts[2] || '';
      const mvRef = parts[3] || '';

      parsedLessons.push({
        weekNumber: currentWeek,
        topic,
        scriptureReading: scripture,
        memoryVerse: mv,
        memoryVerseRef: mvRef,
        aim: `Spiritual objective for Lesson ${currentWeek}`
      });

      currentWeek++;
    }

    // Always append the mandatory Sharing & Admonition Week
    const sharingWeekNum = totalLessonWeeks + 1;
    parsedLessons.push({
      weekNumber: sharingWeekNum,
      isSharingAdmonitionWeek: true,
      topic: 'Sharing, Admonition & Quarterly Love Feast',
      scriptureReading: 'Hebrews 10:23-25; 1 Thessalonians 5:11-22',
      memoryVerse: 'Let us consider one another in order to stir up love and good works.',
      memoryVerseRef: 'Hebrews 10:24',
      aim: 'Mutual testimonies, evaluation, and spiritual encouragement.'
    });

    const updatedQuarters = sundaySchoolYear.quarters.map(q => {
      if (q.quarterNumber === selectedQuarterNumber) {
        return {
          ...q,
          lessons: parsedLessons,
          updatedAt: new Date().toISOString()
        };
      }
      return q;
    });

    const updatedYear: SundaySchoolYear = {
      ...sundaySchoolYear,
      quarters: updatedQuarters,
      updatedAt: new Date().toISOString()
    };

    await onSaveSundaySchoolYear(updatedYear);
    setShowBatchModal(false);
    setBatchLessonText('');
    setFeedback(`Successfully loaded ${parsedLessons.length} lessons including mandatory Sharing & Admonition Week!`);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleDistributeToAllClasses = async () => {
    if (isQuarterReadOnly) {
      alert('This archived quarter must be explicitly unlocked before corrected lessons can be distributed.');
      return;
    }
    setIsDistributing(true);
    try {
      await onDistributeLessons(selectedQuarterNumber);
      setFeedback(`Curriculum for Quarter ${selectedQuarterNumber} distributed live to all approved classes!`);
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsDistributing(false);
    }
  };

  const handleArchiveAndTransition = async () => {
    setShowArchiveConfirm(false);
    const archivedQuarter = sundaySchoolYear.activeQuarterNumber;
    const nextQuarter = Math.min(4, archivedQuarter + 1) as QuarterNumber;
    try {
      await onArchiveAndActivateNextQuarter(archivedQuarter);
      handleSelectQuarter(nextQuarter);
      setFeedback(`Quarter ${archivedQuarter} is now ARCHIVED (Read-Only). Quarter ${nextQuarter} is now ACTIVE!`);
      setTimeout(() => setFeedback(null), 5000);
      await onRefreshData();
    } catch (error) {
      console.error(`Could not archive Quarter ${archivedQuarter}:`, error);
      alert(error instanceof Error ? error.message : `Quarter ${archivedQuarter} could not be archived.`);
    }
  };

  const handleArchivedEditLock = async (unlock: boolean) => {
    if (currentQuarter.status !== 'ARCHIVED') return;
    const now = new Date().toISOString();
    const updatedYear: SundaySchoolYear = {
      ...sundaySchoolYear,
      quarters: sundaySchoolYear.quarters.map(quarter => quarter.quarterNumber === currentQuarter.quarterNumber ? {
        ...quarter,
        archiveEditUnlocked: unlock,
        archiveEditUnlockedAt: unlock ? now : undefined,
        archiveEditUnlockedBy: unlock ? currentAdmin.profileName : undefined,
        updatedAt: now,
      } : quarter),
      updatedAt: now,
    };
    try {
      await onSaveSundaySchoolYear(updatedYear);
      setFeedback(unlock
        ? `Quarter ${currentQuarter.quarterNumber} archive unlocked for authorized corrections.`
        : `Quarter ${currentQuarter.quarterNumber} corrections saved and archive locked read-only again.`);
      setTimeout(() => setFeedback(null), 5000);
    } catch (error) {
      console.error(`[General Secretary] Could not ${unlock ? 'unlock' : 're-lock'} archived quarter:`, error);
      alert(error instanceof Error ? error.message : 'The archived-quarter access state could not be changed.');
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    await onAddDepartment(newDeptName.trim());
    setNewDeptName('');
    setShowAddDeptModal(false);
    setFeedback('New department created successfully.');
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-blue-400/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 border border-amber-400/40 rounded-full text-xs font-black text-amber-300 uppercase tracking-wider">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>General Secretary Directorate</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Cinzel',serif] tracking-wide text-white">
              Sunday School Year & Curriculum Portal
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 max-w-2xl leading-relaxed">
              Officer: <strong>{currentAdmin.profileName}</strong> • Master authority for Sunday School Year configuration, 4-Quarter curriculum management, weekly lesson distribution, and department administration.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              disabled={isDistributing || isQuarterReadOnly}
              onClick={handleDistributeToAllClasses}
              className="px-4 py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg transition"
            >
              <Send className="w-4 h-4" />
              <span>{isDistributing ? 'Distributing...' : 'Distribute Lessons to All Classes'}</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-400 text-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-300" />
            <span>{feedback}</span>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('SUNDAY_SCHOOL_SETUP')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'SUNDAY_SCHOOL_SETUP' ? 'bg-blue-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Sunday School Setup & Curriculum</span>
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
          onClick={() => setActiveTab('DEPARTMENTS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'DEPARTMENTS' ? 'bg-blue-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Department Management ({sundaySchoolYear.departments?.length || 4})</span>
        </button>

        <button
          onClick={() => setActiveTab('CLASS_APPROVALS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'CLASS_APPROVALS' ? 'bg-blue-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>Class Approvals</span>
          {pendingClasses.length > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full">
              {pendingClasses.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab: Department & Class Portal Explorer (5 Dashboards) */}
      {activeTab === 'CLASS_PORTAL_EXPLORER' && (
        <DepartmentClassExplorer
          currentAdmin={currentAdmin}
          allClasses={allClasses}
          sundaySchoolYear={sundaySchoolYear}
          initialClassId={explorerInitialClassId}
          onBackToOverview={() => setActiveTab('SUNDAY_SCHOOL_SETUP')}
        />
      )}

      {/* Tab: Unified Sunday School Setup & Curriculum 4-Step Stepper */}
      {activeTab === 'SUNDAY_SCHOOL_SETUP' && (
        <div className="space-y-6">

          {/* 4-Step Stepper Navigation Header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { step: 1 as const, title: 'Academic Year', desc: 'Year Name & Global Theme' },
                { step: 2 as const, title: 'Quarter Setup', desc: 'Q1–Q4, Dates & Weeks' },
                { step: 3 as const, title: 'Lesson Curriculum', desc: 'Topics, Verses & Aims' },
                { step: 4 as const, title: 'Review & Dispatch', desc: 'Readiness & Live Sync' }
              ].map((item, idx) => {
                const isCurrent = setupStep === item.step;
                const isPast = setupStep > item.step;
                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => setSetupStep(item.step)}
                    className={`flex items-center gap-3 p-3 rounded-xl transition text-left cursor-pointer ${
                      isCurrent
                        ? 'bg-blue-900 text-white shadow-xs ring-2 ring-blue-900/20'
                        : isPast
                        ? 'bg-blue-50/80 text-blue-950 hover:bg-blue-100 border border-blue-200/60'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                      isCurrent
                        ? 'bg-amber-400 text-blue-950'
                        : isPast
                        ? 'bg-blue-900 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {isPast ? <Check className="w-4 h-4 stroke-[3]" /> : item.step}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold truncate ${isCurrent ? 'text-white' : 'text-slate-900'}`}>
                          {item.title}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] bg-amber-400/25 text-amber-300 font-black px-1.5 py-0.2 rounded shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] truncate block ${isCurrent ? 'text-blue-200' : 'text-slate-500'}`}>
                        {item.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 1: Academic Year */}
          {setupStep === 1 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-900" />
                    <h3 className="text-xl font-black text-slate-900 font-['Cinzel',serif]">
                      Step 1: Sunday School Academic Year
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Configure the active Sunday School year and global theme distributed across all four quarters and national registers.
                  </p>
                </div>
                <span className="px-3.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Academic Year: <strong>{sundaySchoolYear.yearName}</strong></span>
                </span>
              </div>

              {/* Quick Academic Overview Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Quarters</span>
                  <span className="text-xl font-black text-slate-900">4 Quarters</span>
                  <span className="text-[11px] text-blue-900 font-bold block mt-0.5">Active: Quarter {sundaySchoolYear.activeQuarterNumber}</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Teaching Schedule</span>
                  <span className="text-xl font-black text-slate-900">{currentQuarter.totalLessonWeeks} Lessons</span>
                  <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">+ 1 Sharing Week</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Registered Classes</span>
                  <span className="text-xl font-black text-slate-900">{allClasses.length} Classes</span>
                  <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">{pendingClasses.length} Pending Approval</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Departments</span>
                  <span className="text-xl font-black text-slate-900">{sundaySchoolYear.departments?.length || 4} Departments</span>
                  <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">Configured by GSEC</span>
                </div>
              </div>

              <div className="space-y-4 max-w-2xl pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0f2b59]">Sunday School Academic Year</label>
                  <input
                    type="text"
                    value={yearName}
                    onChange={(e) => setYearName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border-2 border-blue-900/30 rounded-xl text-sm font-bold text-[#0f2b59] placeholder:text-blue-900/40 caret-[#0f2b59] focus:text-[#0f2b59] focus:border-[#0f2b59] focus:ring-2 focus:ring-blue-900/20 outline-hidden shadow-xs"
                    placeholder="e.g. 2026/2027"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0f2b59]">Overall Theme for the Year</label>
                  <textarea
                    rows={3}
                    value={overallTheme}
                    onChange={(e) => setOverallTheme(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border-2 border-blue-900/30 rounded-xl text-sm font-bold text-[#0f2b59] placeholder:text-blue-900/40 caret-[#0f2b59] focus:text-[#0f2b59] focus:border-[#0f2b59] focus:ring-2 focus:ring-blue-900/20 outline-hidden shadow-xs"
                    placeholder="e.g. Walking in the Light of His Glory (1 John 1:7)"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                  <button
                    onClick={handleSaveYearDetails}
                    className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-amber-400" />
                    <span>Update Sunday School Year</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSetupStep(2)}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition ml-auto cursor-pointer"
                  >
                    <span>Proceed to Step 2: Quarter Setup</span>
                    <ArrowRight className="w-4 h-4 text-amber-400" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Quarter Setup */}
          {setupStep === 2 && (
            <div className="space-y-6">
              {/* Quarter Selector Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {sundaySchoolYear.quarters.map((q) => {
                  const isSelected = q.quarterNumber === selectedQuarterNumber;
                  return (
                    <button
                      key={q.id}
                      onClick={() => handleSelectQuarter(q.quarterNumber)}
                      className={`text-left p-5 rounded-2xl border-2 transition relative flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 border-blue-900 shadow-md ring-2 ring-blue-900/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-blue-900">
                            {q.quarterName}
                          </span>
                          {q.status === 'ARCHIVED' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
                              <Archive className="w-3 h-3" /> ARCHIVE
                            </span>
                          )}
                          {q.status === 'ACTIVE' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                              <Check className="w-3 h-3" /> CURRENT ACTIVE
                            </span>
                          )}
                          {q.status === 'UPCOMING' && (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              Upcoming
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-black text-slate-900 line-clamp-1">{q.quarterTheme}</h4>
                        <p className="text-xs text-slate-500">
                          {q.totalLessonWeeks} Lessons + 1 Sharing Week = <strong>{q.totalLessonWeeks + 1} Weeks</strong>
                        </p>
                      </div>

                      <div className="pt-3 mt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold text-blue-900">
                        <span>{q.lessons?.length || 0} Lessons Loaded</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Current Selected Quarter Details & Controls */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-slate-900 font-['Cinzel',serif]">
                        Step 2: {currentQuarter.quarterName} Setup & Schedule
                      </h3>
                      {currentQuarter.status === 'ARCHIVED' && (
                        <span className={`px-3 py-0.5 text-xs font-black uppercase rounded-full ${currentQuarter.archiveEditUnlocked ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700'}`}>
                          {currentQuarter.archiveEditUnlocked ? 'ARCHIVE CORRECTION MODE' : 'READ-ONLY ARCHIVE'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Configure quarter theme, teaching duration (12 vs 13 lessons), and link Week 1 ministerial preparation dates.
                    </p>
                  </div>
                </div>

                {/* Quarter Settings Form */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-[#0f2b59]">Quarter Theme</label>
                    <input
                      type="text"
                      disabled={isQuarterReadOnly}
                      value={quarterTheme}
                      onChange={(e) => setQuarterTheme(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border-2 border-blue-900/30 rounded-xl text-sm font-bold text-[#0f2b59] placeholder:text-blue-900/40 caret-[#0f2b59] focus:text-[#0f2b59] focus:border-[#0f2b59] focus:ring-2 focus:ring-blue-900/20 outline-hidden disabled:bg-slate-100 disabled:text-[#0f2b59]/60 shadow-xs"
                      placeholder="e.g. Foundations of Christian Faith & Discipleship"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0f2b59]">Teaching Lessons (12 or 13 Weeks)</label>
                    <select
                      disabled={isQuarterReadOnly}
                      value={totalLessonWeeks}
                      onChange={(e) => setTotalLessonWeeks(Number(e.target.value) as 12 | 13)}
                      className="w-full px-4 py-2.5 border-2 border-blue-900/30 rounded-xl text-sm font-bold bg-white text-[#0f2b59] caret-[#0f2b59] focus:text-[#0f2b59] focus:border-[#0f2b59] focus:ring-2 focus:ring-blue-900/20 outline-hidden disabled:bg-slate-100 shadow-xs"
                    >
                      <option value={12} className="text-[#0f2b59] font-bold">12 Lessons + 1 Sharing Week (13 Total)</option>
                      <option value={13} className="text-[#0f2b59] font-bold">13 Lessons + 1 Sharing Week (14 Total)</option>
                    </select>
                  </div>
                </div>

                {/* Manual Week 1 Date Setup & Auto-Generation */}
                <div className="p-5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200/70 pb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-900 shrink-0" />
                      <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider">
                        {currentQuarter.quarterName} Schedule: Week 1 Date Setup
                      </h4>
                    </div>
                    <span className="text-[11px] font-semibold text-blue-800 bg-blue-100/80 px-2.5 py-0.5 rounded-full">
                      Auto-generates subsequent weeks (Week 2–{totalLessonWeeks + 1})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#0f2b59] flex items-center justify-between">
                        <span>Week 1 Ministerial Prep Date (Thursday)</span>
                        <span className="text-[10px] text-blue-800/70 font-normal">Auto-links to Sunday</span>
                      </label>
                      <input
                        type="date"
                        disabled={isQuarterReadOnly}
                        value={week1ThursdayDate}
                        onChange={(e) => handleThursdayChange(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border-2 border-blue-900/30 rounded-xl text-xs font-bold text-[#0f2b59] focus:text-[#0f2b59] focus:border-[#0f2b59] focus:ring-2 focus:ring-blue-900/20 outline-hidden disabled:bg-slate-100 shadow-xs"
                      />
                      {week1ThursdayDate && (
                        <p className="text-[11px] font-semibold text-blue-900">
                          {formatDateDisplay(week1ThursdayDate, { showDayOfWeek: true })}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#0f2b59] flex items-center justify-between">
                        <span>Week 1 Sunday School Date (Sunday)</span>
                        <span className="text-[10px] text-blue-800/70 font-normal">Auto-links to Thursday</span>
                      </label>
                      <input
                        type="date"
                        disabled={isQuarterReadOnly}
                        value={week1SundayDate}
                        onChange={(e) => handleSundayChange(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border-2 border-blue-900/30 rounded-xl text-xs font-bold text-[#0f2b59] focus:text-[#0f2b59] focus:border-[#0f2b59] focus:ring-2 focus:ring-blue-900/20 outline-hidden disabled:bg-slate-100 shadow-xs"
                      />
                      {week1SundayDate && (
                        <p className="text-[11px] font-semibold text-blue-900">
                          {formatDateDisplay(week1SundayDate, { showDayOfWeek: true })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Collapsible Auto-Generated Weekly Schedule Breakdown */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSchedulePreview(!showSchedulePreview)}
                      className="text-xs font-bold text-blue-900 hover:text-blue-950 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <span>{showSchedulePreview ? 'Hide' : 'View'} Generated {totalLessonWeeks + 1}-Week Calendar Preview</span>
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showSchedulePreview ? 'rotate-90' : ''}`} />
                    </button>

                    {showSchedulePreview && (
                      <div className="mt-3 bg-white rounded-xl border border-blue-200 overflow-hidden shadow-xs">
                        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                          {getQuarterWeeklySchedule(
                            {
                              ...currentQuarter,
                              week1ThursdayDate,
                              week1SundayDate,
                              totalLessonWeeks
                            }
                          ).map((item) => (
                            <div
                              key={item.weekNumber}
                              className={`px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 hover:bg-slate-50 transition ${
                                item.isSharingAdmonitionWeek ? 'bg-amber-50/60 font-semibold' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  item.isSharingAdmonitionWeek
                                    ? 'bg-amber-200 text-amber-900'
                                    : 'bg-blue-100 text-blue-900'
                                }`}>
                                  Week {item.weekNumber}
                                </span>
                                <span className="font-bold text-slate-800 line-clamp-1">{item.topic}</span>
                              </div>

                              <div className="flex items-center gap-3 text-[11px] text-slate-600 shrink-0">
                                <span title="Ministerial Preparatory Class Date">
                                  <strong>Prep (Thu):</strong> {formatDateDisplay(item.prepDate)}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span title="Sunday School Date" className="text-blue-950 font-bold">
                                  <strong>Sun:</strong> {formatDateDisplay(item.sundayDate)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {!isQuarterReadOnly && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      onClick={handleSaveQuarterDetails}
                      className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5 text-amber-400" />
                      <span>Save Quarter Settings</span>
                    </button>
                  </div>
                )}

                {/* Stepper Navigation Buttons */}
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSetupStep(1)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4 rotate-180" />
                    <span>Back to Step 1: Academic Year</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSetupStep(3)}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
                  >
                    <span>Proceed to Step 3: Lesson Curriculum</span>
                    <ArrowRight className="w-4 h-4 text-amber-400" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Lesson Curriculum */}
          {setupStep === 3 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-900" />
                    <h3 className="text-xl font-black text-slate-900 font-['Cinzel',serif]">
                      Step 3: {currentQuarter.quarterName} Lesson Curriculum
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Edit weekly lesson topics, scripture readings, memory verses, and spiritual objectives for Quarter {selectedQuarterNumber}.
                  </p>
                </div>

                {!isQuarterReadOnly && (
                  <button
                    onClick={() => setShowBatchModal(true)}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer self-start sm:self-auto"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-300" />
                    <span>Batch Paste Lessons Text</span>
                  </button>
                )}
              </div>

              {/* Mandatory Sharing & Admonition Week Notice */}
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                    Mandatory Sharing & Admonition Week (Week {totalLessonWeeks + 1})
                  </h5>
                  <p className="text-xs text-amber-800 mt-0.5">
                    This quarter includes {totalLessonWeeks} teaching lessons plus Week {totalLessonWeeks + 1} dedicated to quarterly testimonies and mutual admonition.
                  </p>
                </div>
              </div>

              {/* Weekly Lessons Master Table & Editor */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                {/* Left: Lessons List */}
                <div className="lg:col-span-5 space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {currentQuarter.lessons?.map((lesson) => {
                    const isSelected = editingWeekNumber === lesson.weekNumber;
                    return (
                      <div
                        key={lesson.weekNumber}
                        onClick={() => handleSelectLessonForEdit(lesson)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                            : lesson.isSharingAdmonitionWeek
                            ? 'bg-amber-50 border-amber-300 text-[#0f2b59] hover:bg-amber-100/70'
                            : 'bg-slate-50 border-slate-200 text-[#0f2b59] hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                              isSelected
                                ? 'bg-blue-800 text-amber-300'
                                : lesson.isSharingAdmonitionWeek
                                ? 'bg-amber-200 text-amber-900'
                                : 'bg-blue-100 text-[#0f2b59]'
                            }`}>
                              {lesson.isSharingAdmonitionWeek ? 'Final Sharing Week' : `Week ${lesson.weekNumber}`}
                            </span>
                          </div>
                          <h5 className={`text-xs font-bold mt-1 line-clamp-1 ${isSelected ? 'text-white' : 'text-[#0f2b59]'}`}>
                            {lesson.topic}
                          </h5>
                          <p className={`text-[11px] font-medium line-clamp-1 ${isSelected ? 'text-blue-200' : 'text-blue-900/80'}`}>
                            {lesson.scriptureReading}
                          </p>
                        </div>
                        <Edit3 className={`w-3.5 h-3.5 shrink-0 mt-1 ${isSelected ? 'text-amber-300' : 'text-blue-900/60'}`} />
                      </div>
                    );
                  })}
                </div>

                {/* Right: Lesson Editor Form */}
                <div className="lg:col-span-7 bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h5 className="text-xs font-black text-[#0f2b59] uppercase tracking-wider">
                      {editingWeekNumber && editingWeekNumber > totalLessonWeeks ? 'Sharing & Admonition Week' : `Edit Lesson for Week ${editingWeekNumber}`}
                    </h5>
                    {isQuarterReadOnly && (
                      <span className="text-[10px] font-black text-slate-500 uppercase">Read Only</span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#0f2b59]">Lesson Topic</label>
                      <input
                        type="text"
                        disabled={isQuarterReadOnly}
                        value={lessonTopic}
                        onChange={(e) => setLessonTopic(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border-2 border-blue-900/30 rounded-xl text-xs font-bold text-[#0f2b59] placeholder:text-blue-900/40 caret-[#0f2b59] focus:text-[#0f2b59] focus:border-[#0f2b59] focus:ring-2 focus:ring-blue-900/20 outline-hidden disabled:bg-slate-100 disabled:text-[#0f2b59]/60 shadow-xs"
                        placeholder="e.g. The Call to Discipleship and Living Faith"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#0f2b59]">Scripture Reading / Text</label>
                      <input
                        type="text"
                        disabled={isQuarterReadOnly}
                        value={scriptureReading}
                        onChange={(e) => setScriptureReading(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border-2 border-blue-900/30 rounded-xl text-xs font-bold text-[#0f2b59] placeholder:text-blue-900/40 caret-[#0f2b59] focus:text-[#0f2b59] focus:border-[#0f2b59] focus:ring-2 focus:ring-blue-900/20 outline-hidden disabled:bg-slate-100 disabled:text-[#0f2b59]/60 shadow-xs"
                        placeholder="e.g. Matthew 4:18-22; Luke 9:23-26"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#0f2b59]">Memory Verse Text</label>
                        <input
                          type="text"
                          disabled={isQuarterReadOnly}
                          value={memoryVerse}
                          onChange={(e) => setMemoryVerse(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border-2 border-blue-900/30 rounded-xl text-xs font-semibold text-[#0f2b59] placeholder:text-blue-900/40 caret-[#0f2b59] focus:text-[#0f2b59] focus:border-[#0f2b59] focus:ring-2 focus:ring-blue-900/20 outline-hidden disabled:bg-slate-100 disabled:text-[#0f2b59]/60 shadow-xs"
                          placeholder="Memory verse text..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#0f2b59]">Memory Verse Reference</label>
                        <input
                          type="text"
                          disabled={isQuarterReadOnly}
                          value={memoryVerseRef}
                          onChange={(e) => setMemoryVerseRef(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border-2 border-blue-900/30 rounded-xl text-xs font-semibold text-[#0f2b59] placeholder:text-blue-900/40 caret-[#0f2b59] focus:text-[#0f2b59] focus:border-[#0f2b59] focus:ring-2 focus:ring-blue-900/20 outline-hidden disabled:bg-slate-100 disabled:text-[#0f2b59]/60 shadow-xs"
                          placeholder="e.g. Luke 9:23"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#0f2b59]">Lesson Spiritual Aim / Objective</label>
                      <textarea
                        rows={2}
                        disabled={isQuarterReadOnly}
                        value={aim}
                        onChange={(e) => setAim(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border-2 border-blue-900/30 rounded-xl text-xs font-medium text-[#0f2b59] placeholder:text-blue-900/40 caret-[#0f2b59] focus:text-[#0f2b59] focus:border-[#0f2b59] focus:ring-2 focus:ring-blue-900/20 outline-hidden disabled:bg-slate-100 disabled:text-[#0f2b59]/60 shadow-xs"
                        placeholder="Spiritual goal for Sunday School students..."
                      />
                    </div>
                  </div>

                  {!isQuarterReadOnly && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={handleSaveSingleLesson}
                        className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5 text-amber-400" />
                        <span>Save Week {editingWeekNumber} Lesson</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Stepper Navigation Buttons */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSetupStep(2)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  <span>Back to Step 2: Quarter Setup</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSetupStep(4)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <span>Proceed to Step 4: Review & Dispatch</span>
                  <ArrowRight className="w-4 h-4 text-amber-400" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Review & Dispatch */}
          {setupStep === 4 && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Send className="w-5 h-5 text-blue-900" />
                      <h3 className="text-xl font-black text-slate-900 font-['Cinzel',serif]">
                        Step 4: Curriculum Review & Live Distribution
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Verify curriculum completeness and push active lessons live to all registered Sunday School classes.
                    </p>
                  </div>
                </div>

                {/* Pre-flight Curriculum Readiness Checklist */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>Academic & Quarter Readiness</span>
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700">
                      <li className="flex items-center justify-between">
                        <span>Academic Year:</span>
                        <strong className="text-blue-950 font-bold">{yearName}</strong>
                      </li>
                      <li className="flex items-center justify-between">
                        <span>Overall Theme:</span>
                        <strong className="text-blue-950 font-bold truncate max-w-[200px]" title={overallTheme}>{overallTheme}</strong>
                      </li>
                      <li className="flex items-center justify-between">
                        <span>Active Quarter:</span>
                        <strong className="text-emerald-700 font-bold">Quarter {sundaySchoolYear.activeQuarterNumber}</strong>
                      </li>
                      <li className="flex items-center justify-between">
                        <span>Selected Quarter:</span>
                        <strong className="text-blue-950 font-bold">Quarter {selectedQuarterNumber} ({currentQuarter.quarterName})</strong>
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-900" />
                      <span>Schedule & Lessons Loaded</span>
                    </span>
                    <ul className="space-y-2 text-xs text-slate-700">
                      <li className="flex items-center justify-between">
                        <span>Week 1 Prep (Thu):</span>
                        <strong className="text-blue-950 font-bold">{formatDateDisplay(week1ThursdayDate)}</strong>
                      </li>
                      <li className="flex items-center justify-between">
                        <span>Week 1 Sunday School:</span>
                        <strong className="text-blue-950 font-bold">{formatDateDisplay(week1SundayDate)}</strong>
                      </li>
                      <li className="flex items-center justify-between">
                        <span>Teaching Weeks:</span>
                        <strong className="text-blue-950 font-bold">{totalLessonWeeks} Lessons + 1 Sharing Week</strong>
                      </li>
                      <li className="flex items-center justify-between">
                        <span>Curriculum Population:</span>
                        <span className="font-bold text-emerald-700">
                          {currentQuarter.lessons?.length || 0} / {totalLessonWeeks + 1} Weeks
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Primary Distribution Action Card */}
                <div className="p-6 bg-gradient-to-br from-blue-900 via-indigo-950 to-blue-950 text-white rounded-2xl border-2 border-blue-400/40 space-y-4 shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                        <Sparkles className="w-3 h-3" />
                        <span>Live Synchronization</span>
                      </div>
                      <h4 className="text-lg font-black font-['Cinzel',serif] text-white">
                        Distribute Quarter {selectedQuarterNumber} Curriculum to All Classes
                      </h4>
                      <p className="text-xs text-blue-200/90 max-w-xl">
                        Instantly synchronizes this approved lesson schedule across all <strong>{allClasses.length} registered classes</strong>, updating teacher dashboards and attendance registers in real-time.
                      </p>
                    </div>

                    <button
                      disabled={isDistributing || isQuarterReadOnly}
                      onClick={handleDistributeToAllClasses}
                      className="px-6 py-3 bg-amber-400 hover:bg-amber-300 active:scale-98 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg transition cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>{isDistributing ? 'Distributing Curriculum...' : 'Distribute Lessons Now'}</span>
                    </button>
                  </div>
                </div>

                {/* Quarter Archival & Transition Controls */}
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Quarter Transition & Lifecycle Management
                    </h5>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {currentQuarter.status === 'ACTIVE'
                        ? `When Quarter ${currentQuarter.quarterNumber} is concluded, archive it as read-only and activate Quarter ${Math.min(4, currentQuarter.quarterNumber + 1)}.`
                        : currentQuarter.status === 'ARCHIVED'
                        ? 'This quarter is in read-only archive status. Authorized officers may unlock it for correction.'
                        : 'This quarter is upcoming and will become active when previous quarters conclude.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {currentQuarter.status === 'ACTIVE' && currentQuarter.quarterNumber < 4 && (
                      <button
                        onClick={() => setShowArchiveConfirm(true)}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
                      >
                        <FolderArchive className="w-4 h-4 text-amber-400" />
                        <span>Archive & Activate Next</span>
                      </button>
                    )}
                    {currentQuarter.status === 'ARCHIVED' && (
                      <button
                        type="button"
                        onClick={() => void handleArchivedEditLock(!currentQuarter.archiveEditUnlocked)}
                        className={`px-4 py-2.5 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer ${currentQuarter.archiveEditUnlocked ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-amber-700 hover:bg-amber-800'}`}
                      >
                        {currentQuarter.archiveEditUnlocked ? <Archive className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                        <span>{currentQuarter.archiveEditUnlocked ? 'Save & Re-lock Archive' : 'Unlock for Authorized Correction'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Stepper Navigation Buttons */}
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSetupStep(3)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4 rotate-180" />
                    <span>Back to Step 3: Lesson Curriculum</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('CLASS_PORTAL_EXPLORER')}
                    className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Building2 className="w-4 h-4 text-amber-600" />
                    <span>Open Class Portals Explorer</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Tab 3: Department Management */}
      {activeTab === 'DEPARTMENTS' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
                Sunday School Department Management
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Departments are exclusively configured by the General Secretary. Teachers select from these authorized departments when creating classes.
              </p>
            </div>

            <button
              onClick={() => setShowAddDeptModal(true)}
              className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Create Department</span>
            </button>
          </div>

          {feedback && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm animate-in fade-in">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="font-semibold">{feedback}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sundaySchoolYear.departments?.map((dept, idx) => {
              const linkedClasses = allClasses.filter(c => c.department === dept);
              return (
                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between gap-3 hover:border-slate-300 transition shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-900 font-bold text-xs shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-slate-900 leading-snug">{dept}</h5>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          {linkedClasses.length} registered {linkedClasses.length === 1 ? 'class' : 'classes'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenEditDept(dept)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                      title="Edit / Rename Department"
                    >
                      <Edit3 className="w-3 h-3 text-blue-700" />
                      <span>Rename</span>
                    </button>

                    <button
                      onClick={() => handleOpenDeleteDept(dept)}
                      className="px-2.5 py-1.5 bg-white hover:bg-red-50 border border-slate-300 hover:border-red-300 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                      title="Delete Department"
                    >
                      <Trash2 className="w-3 h-3 text-red-600" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Class Approvals */}
      {activeTab === 'CLASS_APPROVALS' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-black text-slate-900">
              General Secretary Class Approval Console
            </h3>
            <p className="text-xs text-slate-500">
              Classes created by Teachers require General Secretary or General Superintendent approval to receive active Sunday School curriculum.
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
              <h4 className="text-sm font-bold text-slate-800">No Pending Class Approvals</h4>
              <p className="text-xs text-slate-500">All registered Sunday School classes have been approved.</p>
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
                      {cls.teachers && cls.teachers.length > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Teachers: {cls.teachers.map(t => t.name).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Pending approval
                    </span>
                    <button
                      disabled={processingClassId === cls.id}
                      onClick={() => handleApproveClass(cls.id, cls.className)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                    >
                      {processingClassId === cls.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Approving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Approve & Authorize</span>
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

      {/* Modal: Batch Text Paste Loader */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl p-6 sm:p-8 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-900" />
                <h3 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
                  Batch Paste / Send Full Lessons Text
                </h3>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Paste lines in the format: <code className="text-blue-900 font-bold">Topic | Scripture | Memory Verse Text | Reference</code>. The system will automatically map them from Lesson 1 to Lesson {totalLessonWeeks} and attach the mandatory Sharing & Admonition Week.
            </p>

            <textarea
              rows={8}
              value={batchLessonText}
              onChange={(e) => setBatchLessonText(e.target.value)}
              className="w-full p-4 bg-white border-2 border-blue-900/30 rounded-2xl text-xs font-mono font-bold text-[#0f2b59] placeholder:text-blue-900/40 caret-[#0f2b59] focus:text-[#0f2b59] focus:border-[#0f2b59] focus:ring-2 focus:ring-blue-900/20 outline-hidden shadow-xs"
              placeholder={`Lesson 1: The Call to Discipleship | Matthew 4:18-22 | Deny himself and take up his cross | Luke 9:23\nLesson 2: Secret Prayer | Matthew 6:5-15 | The effective fervent prayer of a righteous man | James 5:16\nLesson 3: Walking in Integrity | Psalm 15:1-5 | The integrity of the upright will guide them | Proverbs 11:3`}
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleParseAndLoadBatchText}
                className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Parse & Populate Lessons
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Department */}
      {showAddDeptModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <form onSubmit={handleCreateDepartment} className="bg-white max-w-md w-full rounded-3xl shadow-2xl p-6 sm:p-8 space-y-4 border border-slate-200">
            <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
              Create New Department
            </h3>
            <p className="text-xs text-slate-500">
              Add a specialized Sunday School department to the official national list.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0f2b59]">Department Name</label>
              <input
                type="text"
                required
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border-2 border-blue-900/30 rounded-xl text-sm font-bold text-[#0f2b59] placeholder:text-blue-900/40 caret-[#0f2b59] focus:text-[#0f2b59] focus:border-[#0f2b59] focus:ring-2 focus:ring-blue-900/20 outline-hidden shadow-xs"
                placeholder="e.g. Couples Fellowship or New Converts"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddDeptModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-900 text-white rounded-xl text-xs font-bold"
              >
                Add Department
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Edit / Rename Department */}
      {showEditDeptModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <form onSubmit={handleSaveEditDept} className="bg-white max-w-md w-full rounded-3xl shadow-2xl p-6 sm:p-8 space-y-4 border border-slate-200">
            <div className="flex items-center gap-2 text-blue-900">
              <Edit3 className="w-5 h-5" />
              <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                Rename Sunday School Department
              </h3>
            </div>
            <p className="text-xs text-slate-600">
              Renaming will dynamically update all associated class records and department directories in real time.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0f2b59]">New Department Name</label>
              <input
                type="text"
                required
                value={editingDeptNewName}
                onChange={(e) => setEditingDeptNewName(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border-2 border-blue-900/30 rounded-xl text-sm font-bold text-[#0f2b59] placeholder:text-blue-900/40 caret-[#0f2b59] focus:text-[#0f2b59] focus:border-[#0f2b59] focus:ring-2 focus:ring-blue-900/20 outline-hidden shadow-xs"
                placeholder="e.g. Young Adults & Youth"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowEditDeptModal(false);
                  setEditingDeptOldName(null);
                  setEditingDeptNewName('');
                }}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-900 text-white rounded-xl text-xs font-bold hover:bg-blue-800 shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Delete Department Confirmation */}
      {showDeleteDeptModal && deletingDeptName && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl p-6 sm:p-8 space-y-4 border-2 border-red-300">
            <div className="w-12 h-12 rounded-2xl bg-red-100 border border-red-300 flex items-center justify-center text-red-700">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
                Delete Department "{deletingDeptName}"?
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {allClasses.filter(c => c.department === deletingDeptName).length > 0 ? (
                  <span className="text-amber-700 font-semibold">
                    Warning: There are {allClasses.filter(c => c.department === deletingDeptName).length} active classes currently assigned to this department. Deleting it will remove the department definition.
                  </span>
                ) : (
                  <span>This department has no assigned classes and will be safely removed from the system.</span>
                )}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteDeptModal(false);
                  setDeletingDeptName(null);
                }}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDept}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Archive Quarter Confirmation */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl p-6 sm:p-8 space-y-4 border-2 border-amber-300">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-900">
              <Archive className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
                Confirm Quarter Transition & Archive
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Quarter {sundaySchoolYear.activeQuarterNumber} will be permanently transitioned to <strong>ARCHIVE (Read-Only)</strong>. Quarter {Math.min(4, sundaySchoolYear.activeQuarterNumber + 1)} will become the active working quarter.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveAndTransition}
                className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Confirm Archive & Activate Next
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
