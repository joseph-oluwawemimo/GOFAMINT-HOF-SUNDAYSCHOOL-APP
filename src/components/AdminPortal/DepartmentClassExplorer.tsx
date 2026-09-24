import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  School,
  Users,
  Calendar,
  HeartHandshake,
  TrendingUp,
  QrCode,
  CheckCircle2,
  ArrowLeft,
  Search,
  ShieldCheck,
  Info,
  MessageCircle,
  PlusCircle,
  Trash2,
  Lock,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  Layers
} from 'lucide-react';
import {
  AdminProfile,
  ClassProfile,
  SundaySchoolYear,
  Member,
  WeeklyGradeRecord,
  WeeklyOfferingRecord,
  AbsenceLogRecord,
  LessonInfo,
  AdminComment,
  QuarterNumber
} from '../../types';
import { GOFAMINT_HOF_12_LESSONS } from '../../data/mockQuarterLessons';
import {
  getMembersByClass,
  getGradesByClass,
  getOfferingsByClass,
  getAbsenceLogsByClass,
  getAdminCommentsByClass,
  saveAdminComment,
  deleteAdminComment,
  saveMemberToDB,
  saveBulkMembersToDB,
  deleteMemberFromDB,
  getClassProfile
} from '../../db/indexedDB';
import { fetchClassInspectionApi } from '../../services/adminUserApi';
import { RosterManagementView } from '../RosterManagementView';
import { GradingMatrixView } from '../GradingMatrixView';
import { WelfareFollowUpView } from '../WelfareFollowUpView';
import { QuarterAnalysisView } from '../QuarterAnalysisView';
import { ClassDiscussionView } from '../ClassDiscussionView';
import { QRPortalView } from '../QRPortalView';

interface DepartmentClassExplorerProps {
  currentAdmin: AdminProfile;
  allClasses: ClassProfile[];
  sundaySchoolYear: SundaySchoolYear;
  initialClassId?: string;
  onBackToOverview?: () => void;
}

type ClassDashboardTab = 
  | 'REGISTRATION'
  | 'DATA_12_WEEK'
  | 'CARE_DASHBOARD'
  | 'WEEKLY_ANALYTICS'
  | 'QR_PORTAL'
  | 'ADMIN_COMMENTS';

export const DepartmentClassExplorer: React.FC<DepartmentClassExplorerProps> = ({
  currentAdmin,
  allClasses,
  sundaySchoolYear,
  initialClassId,
  onBackToOverview
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(
    initialClassId || allClasses[0]?.id || ''
  );
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterNumber>(
    sundaySchoolYear.activeQuarterNumber || 1
  );
  const [activeDashboardTab, setActiveDashboardTab] = useState<ClassDashboardTab>('REGISTRATION');
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [isClassPickerOpen, setIsClassPickerOpen] = useState(false);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  const [pickerDeptFilter, setPickerDeptFilter] = useState('ALL');

  // Real class data states loaded directly from IndexedDB (One source of truth)
  const [classMembers, setClassMembers] = useState<Member[]>([]);
  const [classGrades, setClassGrades] = useState<WeeklyGradeRecord[]>([]);
  const [classOfferings, setClassOfferings] = useState<WeeklyOfferingRecord[]>([]);
  const [classAbsenceLogs, setClassAbsenceLogs] = useState<AbsenceLogRecord[]>([]);
  const [classComments, setClassComments] = useState<AdminComment[]>([]);
  const [isLoadingClassData, setIsLoadingClassData] = useState<boolean>(true);

  // Comment Modal state
  const [showAddCommentModal, setShowAddCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentCategory, setCommentCategory] = useState<'COMMENDATION' | 'CORRECTION' | 'PASTORAL_NOTE' | 'GENERAL'>('GENERAL');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Selected Class Profile
  const selectedClass = allClasses.find(c => c.id === selectedClassId) || allClasses[0];

  // Derive dynamic distributed lessons from selected quarter of Sunday School Year
  const inspectedQuarter = useMemo(() => {
    return sundaySchoolYear.quarters.find(q => q.quarterNumber === selectedQuarter) || sundaySchoolYear.quarters[0];
  }, [sundaySchoolYear, selectedQuarter]);

  const activeLessons: LessonInfo[] = useMemo(() => {
    if (inspectedQuarter && inspectedQuarter.lessons && inspectedQuarter.lessons.length > 0) {
      return inspectedQuarter.lessons.map(ql => ({
        weekNumber: ql.weekNumber,
        topic: ql.topic,
        scriptureReading: ql.scriptureReading || 'Scripture reading as assigned',
        memoryVerse: ql.memoryVerse || '',
        memoryVerseRef: ql.memoryVerseRef || '',
        aim: ql.aim || (ql.isSharingAdmonitionWeek ? 'Sharing & Admonition Week' : 'Lesson spiritual objective')
      }));
    }
    return GOFAMINT_HOF_12_LESSONS;
  }, [inspectedQuarter]);

  // Load Real Data from Authoritative Server API & IndexedDB whenever selectedClassId or selectedQuarter changes
  useEffect(() => {
    let isMounted = true;
    const loadRealData = async () => {
      if (!selectedClassId) return;
      setIsLoadingClassData(true);
      try {
        // 1. Live server fetch for selected class inspection (bypasses RLS limits, gets exact entered data)
        const inspectRes = await fetchClassInspectionApi(selectedClassId);
        if (inspectRes.success && inspectRes.members) {
          if (inspectRes.members.length > 0) {
            await saveBulkMembersToDB(inspectRes.members);
          }
          if (isMounted) {
            setClassMembers(inspectRes.members);
            setClassGrades(inspectRes.grades || []);
            setClassOfferings(inspectRes.offerings || []);
            setClassAbsenceLogs(inspectRes.absenceLogs || []);
            setClassComments(inspectRes.adminComments || []);
            setIsLoadingClassData(false);
            return;
          }
        }

        // 2. Fallback to local IndexedDB if offline
        const [members, grades, offerings, logs, comments] = await Promise.all([
          getMembersByClass(selectedClassId, selectedQuarter),
          getGradesByClass(selectedClassId, selectedQuarter),
          getOfferingsByClass(selectedClassId, selectedQuarter),
          getAbsenceLogsByClass(selectedClassId, selectedQuarter),
          getAdminCommentsByClass(selectedClassId)
        ]);

        if (isMounted) {
          setClassMembers(members);
          setClassGrades(grades);
          setClassOfferings(offerings);
          setClassAbsenceLogs(logs);
          setClassComments(comments);
        }
      } catch (err) {
        console.warn('Error loading real class data:', err);
      } finally {
        if (isMounted) {
          setIsLoadingClassData(false);
        }
      }
    };

    loadRealData();
    return () => {
      isMounted = false;
    };
  }, [selectedClassId, selectedQuarter]);

  // Admin Comment Submission
  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedClass) return;

    setIsSubmittingComment(true);
    try {
      const newComment: AdminComment = {
        id: `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        classId: selectedClass.id,
        className: selectedClass.className,
        recordType: 'CLASS',
        authorName: currentAdmin.fullName || currentAdmin.profileName,
        authorRole: currentAdmin.role,
        comment: `[${commentCategory}] ${commentText.trim()}`,
        createdAt: new Date().toISOString()
      };

      await saveAdminComment(newComment);
      setClassComments(prev => [newComment, ...prev]);
      setCommentText('');
      setShowAddCommentModal(false);
    } catch (err) {
      console.error('Failed to save comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteAdminComment(commentId);
      setClassComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const handleAdminSaveMember = async (member: Member) => {
    await saveMemberToDB({ ...member, classId: selectedClassId });
    const updated = await getMembersByClass(selectedClassId);
    setClassMembers(updated);
  };

  const handleAdminSaveBulkMembers = async (membersList: Member[]) => {
    const withClass = membersList.map(m => ({ ...m, classId: selectedClassId }));
    await saveBulkMembersToDB(withClass);
    const updated = await getMembersByClass(selectedClassId);
    setClassMembers(updated);
  };

  const handleAdminDeleteMember = async (id: string) => {
    await deleteMemberFromDB(id);
    const updated = await getMembersByClass(selectedClassId);
    setClassMembers(updated);
  };

  // Read-only notification banner handler
  const handleReadOnlyAction = () => {
    // Read-only mode for Admin
  };

  return (
    <div className="space-y-6">
      
      {/* Streamlined Jobie Header — CLASS INSPECTION */}
      <div className="bg-gradient-to-r from-[#290870] via-[#350e9e] to-[#4318ff] text-white rounded-3xl p-5 sm:p-6 shadow-[0px_16px_36px_rgba(50,11,134,0.16)] relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 border border-white/20 rounded-full text-xs font-black text-amber-300 uppercase tracking-wider backdrop-blur-md">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>READ-ONLY INSPECTION MODE • {currentAdmin.title}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black font-['Cinzel',serif] tracking-wide text-white">
              CLASS INSPECTION
            </h1>
          </div>

          {/* Streamlined Class Selector Control */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-1.5 flex items-center gap-2 shadow-sm">
              <span className="text-xs font-bold text-purple-200 pl-2">Select Class:</span>
              
              {/* Prev button */}
              <button
                type="button"
                onClick={() => {
                  const idx = allClasses.findIndex(c => c.id === selectedClassId);
                  if (idx > 0) setSelectedClassId(allClasses[idx - 1].id);
                  else setSelectedClassId(allClasses[allClasses.length - 1]?.id || '');
                }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="Previous Class"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3 py-1.5 bg-[#250664] border border-white/30 rounded-xl text-xs font-black text-amber-300 outline-none cursor-pointer focus:ring-2 focus:ring-amber-400 shadow-sm"
              >
                {allClasses.map(c => (
                  <option key={c.id} value={c.id} className="bg-[#250664] text-white font-bold">
                    {c.className} ({c.department})
                  </option>
                ))}
              </select>

              {/* Next button */}
              <button
                type="button"
                onClick={() => {
                  const idx = allClasses.findIndex(c => c.id === selectedClassId);
                  if (idx < allClasses.length - 1) setSelectedClassId(allClasses[idx + 1].id);
                  else setSelectedClassId(allClasses[0]?.id || '');
                }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="Next Class"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Browse All Classes Button */}
              <button
                type="button"
                onClick={() => setIsClassPickerOpen(true)}
                className="px-2.5 py-1.5 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold text-amber-300 transition flex items-center gap-1 cursor-pointer border border-white/20"
                title="Open Class Directory Picker"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Browse</span>
              </button>
            </div>

            {onBackToOverview && (
              <button
                type="button"
                onClick={onBackToOverview}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Overview</span>
              </button>
            )}
          </div>
        </div>

        {/* Class Picker Interactive Modal */}
        {isClassPickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <School className="w-5 h-5 text-[#320b86]" />
                  <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                    Select Sunday School Class to Inspect
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsClassPickerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search and Dept Filter */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={pickerSearchQuery}
                    onChange={(e) => setPickerSearchQuery(e.target.value)}
                    placeholder="Search class or secretary..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:border-[#320b86] text-slate-800"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {['ALL', ...Array.from(new Set(allClasses.map(c => c.department || 'General')))].map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setPickerDeptFilter(dept)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                        pickerDeptFilter === dept
                          ? 'bg-[#320b86] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>

              {/* Class Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1 flex-1">
                {allClasses
                  .filter(c => {
                    const matchDept = pickerDeptFilter === 'ALL' || c.department === pickerDeptFilter;
                    const matchQ = !pickerSearchQuery.trim() || 
                      c.className.toLowerCase().includes(pickerSearchQuery.toLowerCase()) ||
                      String(c.secretaryName || '').toLowerCase().includes(pickerSearchQuery.toLowerCase());
                    return matchDept && matchQ;
                  })
                  .map((cls) => {
                    const isCurrent = cls.id === selectedClassId;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => {
                          setSelectedClassId(cls.id);
                          setIsClassPickerOpen(false);
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between group cursor-pointer ${
                          isCurrent
                            ? 'border-[#320b86] bg-purple-50/70 shadow-xs'
                            : 'border-slate-200 hover:border-[#320b86]/40 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#320b86] bg-purple-100/60 px-2 py-0.5 rounded-full inline-block">
                            {cls.department}
                          </span>
                          <h4 className="text-sm font-black text-slate-900 truncate">
                            {cls.className}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate">
                            Sec: {cls.secretaryName || 'Unassigned'}
                          </p>
                        </div>
                        {isCurrent ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#320b86] text-white text-[10px] font-black shrink-0">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-[#320b86] opacity-0 group-hover:opacity-100 transition shrink-0">
                            Inspect →
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selected Class Active View & Permitted Dashboards */}
      {selectedClass && (
        <div id="selected-class-inspector" className="space-y-6 scroll-mt-6">
          
          {/* Active Class Header Card */}
          <div className="jobie-card p-5 sm:p-6 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-100 text-[#320b86]">
                    {selectedClass.department} Department
                  </span>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="w-3 h-3 text-[#320b86]" />
                    <span>Read-Only Oversight</span>
                  </span>
                  <span className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    Inspecting Quarter {selectedQuarter}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-['Cinzel',serif]">
                  {selectedClass.className}
                </h2>
              </div>

              {/* Quick Comment Button */}
              <button
                type="button"
                onClick={() => setShowAddCommentModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-[#320b86] to-[#4318ff] hover:from-[#28076e] hover:to-[#3b14a7] text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-xs transition shrink-0 self-start sm:self-auto cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-amber-300" />
                <span>+ Add Directorate Note</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Secretary: <strong className="text-slate-800 font-bold">{selectedClass.secretaryName || 'Unassigned'}</strong> {selectedClass.secretaryPhone ? `(${selectedClass.secretaryPhone})` : ''}</span>
              <span className="hidden sm:inline text-slate-300">•</span>
              <span>Teachers: <strong className="text-slate-800 font-bold">{selectedClass.teachers?.map(t => t.name).join(', ') || selectedClass.teacherInCharge || 'None assigned'}</strong></span>
            </div>
          </div>

          {/* Quarter Selection for Inspection */}
          <div className="jobie-card p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#320b86]" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Select Quarter to Inspect:
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 max-w-full">
              {([1, 2, 3, 4] as QuarterNumber[]).map((qNum) => {
                const isSelected = selectedQuarter === qNum;
                const isActiveYearQ = sundaySchoolYear.activeQuarterNumber === qNum;
                return (
                  <button
                    key={qNum}
                    type="button"
                    onClick={() => setSelectedQuarter(qNum)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#320b86] text-white font-black shadow-xs ring-2 ring-[#320b86]/20'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>Quarter {qNum}</span>
                    {isActiveYearQ && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${
                        isSelected ? 'bg-amber-400 text-slate-950' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        Current Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation for Class Dashboards */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            <button
              type="button"
              onClick={() => setActiveDashboardTab('REGISTRATION')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeDashboardTab === 'REGISTRATION'
                  ? 'bg-[#320b86] text-white shadow-xs font-black'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>1. Class Roster ({classMembers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDashboardTab('DATA_12_WEEK')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeDashboardTab === 'DATA_12_WEEK'
                  ? 'bg-[#320b86] text-white shadow-xs font-black'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80'
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span>2. Grading Matrix (Wk {selectedWeek})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDashboardTab('CARE_DASHBOARD')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeDashboardTab === 'CARE_DASHBOARD'
                  ? 'bg-[#320b86] text-white shadow-xs font-black'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80'
              }`}
            >
              <HeartHandshake className="w-4 h-4 shrink-0" />
              <span>3. Welfare & Follow-Up</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDashboardTab('WEEKLY_ANALYTICS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeDashboardTab === 'WEEKLY_ANALYTICS'
                  ? 'bg-[#320b86] text-white shadow-xs font-black'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80'
              }`}
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>4. Quarter Analysis & Returns</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveDashboardTab('ADMIN_COMMENTS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeDashboardTab === 'ADMIN_COMMENTS'
                  ? 'bg-[#320b86] text-white shadow-xs font-black'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80'
              }`}
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>5. Discussion & Notes ({classComments.length})</span>
            </button>
          </div>

          {/* Read-Only Notice */}
          <div className="p-3.5 bg-purple-50/80 border border-purple-200/60 rounded-2xl text-xs text-purple-950 font-medium flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#320b86] shrink-0" />
            <span>
              <strong>Administrative Oversight Mode:</strong> You are inspecting live records for <strong>{selectedClass.className}</strong> in <strong>Quarter {selectedQuarter}</strong>. All entries are maintained by the Class Secretary & Teachers. Use the Discussion tab to send directives.
            </span>
          </div>

          {/* Dashboard Content */}
          {isLoadingClassData ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
              <div className="w-8 h-8 border-3 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-700">Loading live records from database...</p>
            </div>
          ) : (
            <>
              {/* Tab 1: Registration Section */}
              {activeDashboardTab === 'REGISTRATION' && (
                <RosterManagementView
                  members={classMembers}
                  grades={classGrades}
                  currentWeek={selectedWeek}
                  classProfile={selectedClass}
                  quarterStatus="ARCHIVED"
                  selectedQuarter={selectedQuarter}
                  onSaveMember={handleReadOnlyAction}
                  onSaveBulkMembers={handleReadOnlyAction}
                  onDeleteMember={handleReadOnlyAction}
                  onConvertVisitorToStudent={handleReadOnlyAction}
                />
              )}

              {/* Tab 2: Grading Matrix */}
              {activeDashboardTab === 'DATA_12_WEEK' && (
                <GradingMatrixView
                  selectedWeek={selectedWeek}
                  onSelectWeek={setSelectedWeek}
                  members={classMembers}
                  grades={classGrades}
                  offerings={classOfferings}
                  lessons={activeLessons}
                  classProfile={selectedClass}
                  adminComments={classComments}
                  quarterStatus="ARCHIVED"
                  selectedQuarter={selectedQuarter}
                  onUpdateGrade={handleReadOnlyAction}
                  onUpdateOffering={handleReadOnlyAction}
                  onOpenAddVisitorWithReferral={() => setActiveDashboardTab('REGISTRATION')}
                  onNavigateToRoster={() => setActiveDashboardTab('REGISTRATION')}
                  currencySymbol="₦"
                  sundaySchoolYear={sundaySchoolYear}
                />
              )}

              {/* Tab 3: Welfare & Follow-Up */}
              {activeDashboardTab === 'CARE_DASHBOARD' && (
                <WelfareFollowUpView
                  members={classMembers}
                  grades={classGrades}
                  absenceLogs={classAbsenceLogs}
                  currentWeek={selectedWeek}
                  classProfile={selectedClass}
                  activeLessons={activeLessons}
                  selectedQuarterNumber={selectedQuarter}
                  onSaveAbsenceLog={handleReadOnlyAction}
                  onUpdateMemberStatus={handleReadOnlyAction}
                  onRelegateToVisitor={handleReadOnlyAction}
                />
              )}

              {/* Tab 4: Quarter Analysis & Returns */}
              {activeDashboardTab === 'WEEKLY_ANALYTICS' && (
                <QuarterAnalysisView
                  members={classMembers}
                  grades={classGrades}
                  offerings={classOfferings}
                  classProfile={selectedClass}
                  quarterData={sundaySchoolYear?.quarters?.find(q => q.quarterNumber === selectedQuarter) || null}
                  quarterNumber={selectedQuarter}
                  currencySymbol="₦"
                />
              )}

              {/* Tab 5: Directorate Feedback & Discussion */}
              {activeDashboardTab === 'ADMIN_COMMENTS' && (
                <ClassDiscussionView
                  classProfile={selectedClass}
                  comments={classComments}
                  currentRole={currentAdmin.role}
                  currentUserName={currentAdmin.fullName}
                  onSaveComment={async (c) => {
                    await saveAdminComment(c);
                    setClassComments(prev => [...prev, c]);
                  }}
                  onDeleteComment={async (id) => {
                    await deleteAdminComment(id);
                    setClassComments(prev => prev.filter(c => c.id !== id));
                  }}
                />
              )}
            </>
          )}

        </div>
      )}

      {/* Add Admin Comment Modal */}
      {showAddCommentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-900" />
                <h3 className="font-black text-base text-slate-900">
                  Directorate Feedback for {selectedClass.className}
                </h3>
              </div>
              <button
                onClick={() => setShowAddCommentModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateComment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Feedback Category</label>
                <select
                  value={commentCategory}
                  onChange={(e) => setCommentCategory(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-900"
                >
                  <option value="GENERAL">General Administrative Note</option>
                  <option value="COMMENDATION">Commendation & Encouragement</option>
                  <option value="CORRECTION">Correction / Guidance</option>
                  <option value="PASTORAL_NOTE">Pastoral Care Instruction</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Comment / Instruction *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Enter official guidance, praise, or attendance recommendations for the class teacher & secretary..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-900"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCommentModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingComment || !commentText.trim()}
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                >
                  {isSubmittingComment ? 'Saving...' : 'Post Official Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
