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
  FileText
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
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedClassId, setSelectedClassId] = useState<string>(
    initialClassId || allClasses[0]?.id || ''
  );
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterNumber>(
    sundaySchoolYear.activeQuarterNumber || 1
  );
  const [activeDashboardTab, setActiveDashboardTab] = useState<ClassDashboardTab>('REGISTRATION');
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMatrixInfo, setShowMatrixInfo] = useState(false);

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

  // Load Real Data from IndexedDB whenever selectedClassId or selectedQuarter changes
  useEffect(() => {
    let isMounted = true;
    const loadRealData = async () => {
      if (!selectedClassId) return;
      setIsLoadingClassData(true);
      try {
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

  // Departments list (4 recognized standard + custom created)
  const departmentsList = ['ALL', ...Array.from(new Set([
    'Adult',
    'Youth',
    'Teenagers',
    'Children',
    ...(sundaySchoolYear.departments || [])
  ]))];

  // Filtered classes by department and search
  const filteredClasses = allClasses.filter(c => {
    const q = (searchQuery || '').toLowerCase();
    const matchesDept = selectedDepartment === 'ALL' || c.department === selectedDepartment;
    const matchesSearch = (c.className || '').toLowerCase().includes(q) ||
                          (c.department || '').toLowerCase().includes(q) ||
                          (c.secretaryName || '').toLowerCase().includes(q);
    return matchesDept && matchesSearch;
  });

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
      
      {/* Full Access Authority Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-amber-400/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 border border-amber-400/50 rounded-full text-xs font-black text-amber-300 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Full System Direct Access • {currentAdmin.title}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Cinzel',serif] tracking-wide text-white">
              Department & Class Portal Explorer
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 max-w-3xl leading-relaxed">
              Hierarchy: <strong>{currentAdmin.profileName}</strong> ({currentAdmin.username}) → <strong>Every Department</strong> → <strong>Every Class</strong>. Real data synchronization across all register consoles with read-only administrative oversight and official feedback.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMatrixInfo(!showMatrixInfo)}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-amber-300 transition flex items-center gap-1.5"
            >
              <Info className="w-3.5 h-3.5" />
              <span>{showMatrixInfo ? 'Hide Matrix' : 'Permission Matrix'}</span>
            </button>
            {onBackToOverview && (
              <button
                onClick={onBackToOverview}
                className="px-3.5 py-2 bg-blue-900/80 hover:bg-blue-800 border border-blue-400/30 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Executive Overview</span>
              </button>
            )}
          </div>
        </div>

        {/* Expandable Explicit Permission Matrix Reference */}
        {showMatrixInfo && (
          <div className="mt-5 p-4 bg-slate-900/90 border border-amber-400/30 rounded-2xl text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="font-black text-amber-300 uppercase tracking-wide">
                GOFAMINT_HOF Sunday School Administrative Oversight Policy:
              </span>
              <span className="text-[10px] text-slate-400">One Source of Truth</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px] text-slate-300">
              <div className="p-2.5 bg-white/5 rounded-xl border border-white/10">
                <span className="font-bold text-emerald-300 block">General Superintendent & Secretary:</span>
                <span>Full System Access → Every Department & Class → View all registers, provide comments, monitor quarters.</span>
              </div>
              <div className="p-2.5 bg-white/5 rounded-xl border border-white/10">
                <span className="font-bold text-amber-300 block">Treasurer:</span>
                <span>Financial Records Only → Real offering income totals and expenditure tracking.</span>
              </div>
              <div className="p-2.5 bg-white/5 rounded-xl border border-white/10">
                <span className="font-bold text-blue-300 block">Record & Enrollment Officers:</span>
                <span>Weekly returns collation & real student/visitor rosters.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Department & Class Selector Panel */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
        
        {/* Step 1: Department Filter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-900" />
              <span>1. Select Department:</span>
            </span>
            <span className="text-xs text-slate-500 font-bold">
              {filteredClasses.length} class(es) available
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {departmentsList.map((dept) => {
              const isSelected = selectedDepartment === dept;
              return (
                <button
                  key={dept}
                  onClick={() => setSelectedDepartment(dept)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                    isSelected
                      ? 'bg-blue-900 text-white font-black shadow-xs ring-2 ring-blue-900/30'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {dept === 'ALL' ? 'All Departments' : dept}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Class Selection Grid */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-blue-900" />
              <span>2. Choose Class to Enter & Inspect:</span>
            </span>

            <div className="relative max-w-xs w-full">
              <Search className="w-3.5 h-3.5 text-blue-900 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search class or secretary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border-2 border-slate-300 rounded-xl text-xs font-bold text-blue-950 placeholder:text-slate-400 caret-blue-900 focus:text-blue-950 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20 outline-hidden shadow-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredClasses.map((cls) => {
              const isSelected = selectedClassId === cls.id;
              return (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`p-3.5 rounded-2xl text-left transition border flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'bg-blue-50/80 border-2 border-blue-900 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-950">
                        {cls.department}
                      </span>
                      {isSelected ? (
                        <span className="text-[10px] font-bold text-blue-900 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3 text-blue-900" /> Active Class
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400">Click to Open</span>
                      )}
                    </div>
                    <h4 className="text-sm font-black text-slate-900 mt-1.5 line-clamp-1">{cls.className}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Secretary: {cls.secretaryName}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                    <span>{cls.teachers?.length || 1} Teachers Assigned</span>
                    <span className="font-bold text-blue-900">Direct Entry →</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Selected Class Active View & Permitted Dashboards */}
      {selectedClass && (
        <div className="space-y-6">
          
          {/* Active Class Header Card */}
          <div className="bg-white rounded-3xl border-2 border-blue-900/30 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-900 text-white">
                  {selectedClass.department} Department
                </span>
                <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded flex items-center gap-1">
                  <Lock className="w-3 h-3 text-blue-700" />
                  <span>Admin Read-Only Oversight</span>
                </span>
                <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  Inspecting Quarter {selectedQuarter}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-['Cinzel',serif]">
                {selectedClass.className}
              </h2>
              <p className="text-xs text-slate-600">
                Secretary: <strong>{selectedClass.secretaryName}</strong> ({selectedClass.secretaryPhone}) • Teachers: <strong>{selectedClass.teachers?.map(t => t.name).join(', ') || selectedClass.teacherInCharge || 'Assigned Teacher'}</strong>
              </p>
            </div>

            {/* Quick Comment Button */}
            <button
              onClick={() => setShowAddCommentModal(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-blue-950 rounded-xl text-xs font-black flex items-center gap-2 shadow-xs transition shrink-0"
            >
              <MessageCircle className="w-4 h-4" />
              <span>+ Add Directorate Note</span>
            </button>
          </div>

          {/* Quarter Selection for Inspection */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-900" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Select Quarter to Inspect:
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
              {([1, 2, 3, 4] as QuarterNumber[]).map((qNum) => {
                const isSelected = selectedQuarter === qNum;
                const isActiveYearQ = sundaySchoolYear.activeQuarterNumber === qNum;
                return (
                  <button
                    key={qNum}
                    onClick={() => setSelectedQuarter(qNum)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                      isSelected
                        ? 'bg-blue-900 text-white font-black shadow-xs ring-2 ring-blue-900/30'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>Quarter {qNum}</span>
                    {isActiveYearQ && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                        isSelected ? 'bg-amber-400 text-blue-950' : 'bg-emerald-100 text-emerald-800'
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
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveDashboardTab('REGISTRATION')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
                activeDashboardTab === 'REGISTRATION'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>1. Class Roster ({classMembers.length})</span>
            </button>

            <button
              onClick={() => setActiveDashboardTab('DATA_12_WEEK')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
                activeDashboardTab === 'DATA_12_WEEK'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>2. Grading Matrix (Wk {selectedWeek})</span>
            </button>

            <button
              onClick={() => setActiveDashboardTab('CARE_DASHBOARD')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
                activeDashboardTab === 'CARE_DASHBOARD'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <HeartHandshake className="w-4 h-4" />
              <span>3. Welfare & Follow-Up</span>
            </button>

            <button
              onClick={() => setActiveDashboardTab('WEEKLY_ANALYTICS')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
                activeDashboardTab === 'WEEKLY_ANALYTICS'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>4. Quarter Analysis & Returns</span>
            </button>

            <button
              onClick={() => setActiveDashboardTab('ADMIN_COMMENTS')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
                activeDashboardTab === 'ADMIN_COMMENTS'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>5. Discussion & Notes ({classComments.length})</span>
            </button>
          </div>

          {/* Read-Only Notice */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-semibold flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-700 shrink-0" />
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
