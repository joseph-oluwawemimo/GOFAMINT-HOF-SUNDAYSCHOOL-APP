import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Users,
  TrendingUp,
  Sparkles,
  Building,
  Award,
  Calendar,
  Search,
  Filter,
  Download,
  Printer,
  CheckCircle2,
  Phone,
  MapPin,
  HeartHandshake,
  ShieldCheck,
  PlusCircle,
  FileCheck,
  ChevronRight,
  Eye,
  X,
  AlertCircle,
  ArrowRight,
  Layers,
  Clock,
  History,
  Check,
  UserX,
  ArrowRightLeft
} from 'lucide-react';
import {
  AdminProfile,
  ClassProfile,
  SundaySchoolYear,
  Member,
  QuarterNumber,
  EnrollmentOfficerClassRow,
  EnrollmentOfficerWeeklyCollation,
  ConvertedStudentAudit,
  EligibleVisitorCandidate,
  EnrollmentCertificationRecord,
  StudentTransferRecord
} from '../../types';
import {
  getRealEnrollmentOfficerCollation,
  getEligibleVisitorCandidates,
  certifyVisitorEnrollment,
  denyVisitorConversion,
  getAllEnrollmentCertifications,
  getAllMembers,
  getAllStudentTransfers,
  approveStudentTransfer,
  rejectStudentTransfer
} from '../../db/indexedDB';
import { GofamintLogo } from '../GofamintLogo';
import { useDatabaseSync } from '../../hooks/useDatabaseSync';
import { DepartedMembersPanel } from './DepartedMembersPanel';

export type EnrollmentOfficerTab =
  | 'WEEKLY_ENROLLMENT'
  | 'CONSISTENCY_CERTIFICATION'
  | 'AUDIT_TRAIL'
  | 'DEPARTMENTAL_CENSUS'
  | 'DEPARTED_MEMBERS'
  | 'STUDENT_TRANSFERS';

interface EnrollmentOfficerViewProps {
  currentAdmin: AdminProfile;
  allClasses?: ClassProfile[];
  sundaySchoolYear?: SundaySchoolYear;
  activeTab?: EnrollmentOfficerTab;
  onTabChange?: (tab: EnrollmentOfficerTab) => void;
}

export const EnrollmentOfficerView: React.FC<EnrollmentOfficerViewProps> = ({
  currentAdmin,
  allClasses = [],
  sundaySchoolYear,
  activeTab: controlledTab,
  onTabChange
}) => {
  const safeYear = sundaySchoolYear || {
    id: 'DEFAULT',
    yearName: `${new Date().getFullYear()}–${new Date().getFullYear() + 1}`,
    activeQuarterNumber: 1,
    quarters: [1, 2, 3, 4].map(q => ({
      id: `Q${q}`,
      quarterNumber: q as QuarterNumber,
      totalLessonWeeks: 12,
      lessons: []
    }))
  };
  const [selectedQuarter, setSelectedQuarter] = useState<number>(safeYear.activeQuarterNumber || 1);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Navigation State (controlled or internal)
  const [internalActiveTab, setInternalActiveTab] = useState<EnrollmentOfficerTab>('WEEKLY_ENROLLMENT');
  const activeTab = controlledTab || internalActiveTab;
  const setActiveTab = (tab: EnrollmentOfficerTab) => {
    setInternalActiveTab(tab);
    onTabChange?.(tab);
  };

  // Collation & Data State
  const [collationData, setCollationData] = useState<EnrollmentOfficerWeeklyCollation | null>(null);
  const [eligibleCandidates, setEligibleCandidates] = useState<EligibleVisitorCandidate[]>([]);
  const [allCertifications, setAllCertifications] = useState<EnrollmentCertificationRecord[]>([]);
  const [allMembersList, setAllMembersList] = useState<Member[]>([]);
  const [allTransfers, setAllTransfers] = useState<StudentTransferRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Drill-down Modal for Visitor -> Student Converted Members
  const [drillDownRow, setDrillDownRow] = useState<EnrollmentOfficerClassRow | null>(null);
  const [selectedCandidateForCert, setSelectedCandidateForCert] = useState<EligibleVisitorCandidate | null>(null);
  const [certNotes, setCertNotes] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);

  const activeQuarterObj = (safeYear.quarters || []).find(q => q.quarterNumber === selectedQuarter) || safeYear.quarters?.[0] || { totalLessonWeeks: 12, lessons: [] };
  const totalWeeks = activeQuarterObj?.totalLessonWeeks || 12;

  // Load all data from real Class Register database
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [collation, candidates, certs, loadedMembers, loadedTransfers] = await Promise.all([
        getRealEnrollmentOfficerCollation(selectedQuarter, selectedWeek),
        getEligibleVisitorCandidates(selectedQuarter, selectedWeek),
        getAllEnrollmentCertifications(),
        getAllMembers(),
        getAllStudentTransfers()
      ]);
      setCollationData(collation);
      setEligibleCandidates(candidates);
      setAllCertifications(certs);
      setAllMembersList(loadedMembers);
      setAllTransfers(loadedTransfers);
    } catch (err) {
      console.error('Failed to load enrollment officer data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useDatabaseSync(loadAllData, ['members', 'grades', 'enrollmentCertifications', 'classes', 'studentTransfers']);

  useEffect(() => {
    loadAllData();
  }, [selectedQuarter, selectedWeek]);

  // Phase 10: Approve transfer request
  const handleApproveTransfer = async (transfer: StudentTransferRecord) => {
    if (!confirm(`Are you sure you want to approve transferring ${transfer.memberName || transfer.studentName} from ${transfer.previousClassName || transfer.fromClassName} (${transfer.previousDepartment || transfer.fromDepartment}) to ${transfer.destinationClassName || transfer.toClassName} (${transfer.destinationDepartment || transfer.toDepartment}) effective Week ${transfer.effectiveWeekNumber || transfer.effectiveWeek || 1}?`)) {
      return;
    }
    try {
      await approveStudentTransfer(transfer.id, currentAdmin.profileName);
      setActionSuccessMessage(`Approved transfer for ${transfer.memberName || transfer.studentName} to ${transfer.destinationClassName || transfer.toClassName}. Current membership updated while historical records remain intact.`);
      await loadAllData();
      setTimeout(() => setActionSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Failed to approve transfer:', err);
      alert(`Approval failed: ${err.message}`);
    }
  };

  // Phase 10: Reject transfer request
  const handleRejectTransfer = async (transfer: StudentTransferRecord) => {
    const reason = prompt(`Provide a reason for rejecting the transfer request for ${transfer.memberName || transfer.studentName}:`, 'Requires further administrative clearance.');
    if (reason === null) return;
    try {
      await rejectStudentTransfer(transfer.id, currentAdmin.profileName, reason);
      setActionSuccessMessage(`Rejected transfer request for ${transfer.memberName || transfer.studentName}.`);
      await loadAllData();
      setTimeout(() => setActionSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Failed to reject transfer:', err);
      alert(`Rejection failed: ${err.message}`);
    }
  };

  // Certify single visitor conversion
  const handleCertifySingle = async (candidate: EligibleVisitorCandidate, notes?: string) => {
    try {
      await certifyVisitorEnrollment(
        candidate.member.id,
        candidate.classId,
        selectedQuarter,
        selectedWeek,
        currentAdmin,
        notes || 'Certified on achievement of consistency requirements.'
      );
      setActionSuccessMessage(`Successfully certified and enrolled ${candidate.member.fullName} as an official Student in ${candidate.className}!`);
      setSelectedCandidateForCert(null);
      setCertNotes('');
      await loadAllData();
      setTimeout(() => setActionSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(`Certification failed: ${err.message}`);
    }
  };

  // Deny single visitor conversion request
  const handleDenySingle = async (candidate: EligibleVisitorCandidate) => {
    const reason = prompt(`Provide a reason for declining promotion for ${candidate.member.fullName}:`, 'Requires further consistent attendance in class register.');
    if (reason === null) return;
    try {
      await denyVisitorConversion(candidate.member.id, currentAdmin, reason);
      setActionSuccessMessage(`Declined conversion for ${candidate.member.fullName}. Maintained as Visitor.`);
      await loadAllData();
      setTimeout(() => setActionSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  // Batch certify all eligible visitors
  const handleBatchCertifyEligible = async () => {
    const eligibleOnly = eligibleCandidates.filter(c => c.isEligible);
    if (eligibleOnly.length === 0) {
      alert('No candidates currently meet the consistency threshold for automatic certification.');
      return;
    }

    if (!confirm(`Are you sure you want to certify and enroll all ${eligibleOnly.length} eligible candidates into Student status for Week ${selectedWeek}?`)) {
      return;
    }

    try {
      for (const cand of eligibleOnly) {
        await certifyVisitorEnrollment(
          cand.member.id,
          cand.classId,
          selectedQuarter,
          selectedWeek,
          currentAdmin,
          `Batch certified for Week ${selectedWeek}`
        );
      }
      setActionSuccessMessage(`Successfully certified all ${eligibleOnly.length} eligible candidates into Student status!`);
      await loadAllData();
      setTimeout(() => setActionSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(`Batch certification error: ${err.message}`);
    }
  };

  const rows = collationData?.rows || [];

  // Filtered rows for weekly table
  const filteredRows = rows.filter(r => {
    const q = (searchQuery || '').toLowerCase();
    const matchesDept = selectedDepartment === 'ALL' || r.department === selectedDepartment;
    const matchesSearch = (r.className || '').toLowerCase().includes(q) ||
                          (r.department || '').toLowerCase().includes(q);
    return matchesDept && matchesSearch;
  });

  // Canonical Totals across filteredRows for Master Equations
  // 1. ONBOARDING (Intake History)
  const filteredNewlyOnboarded = filteredRows.reduce((s, r) => s + (r.newlyOnboarded ?? r.newVisitors), 0);
  const filteredPreviouslyOnboarded = filteredRows.reduce((s, r) => s + (r.previouslyOnboarded ?? r.onboarded), 0);
  const filteredTotalOnboarded = filteredNewlyOnboarded + filteredPreviouslyOnboarded;

  // 2. STATUS - VISITORS
  const filteredNewVisitors = filteredRows.reduce((s, r) => s + r.newVisitors, 0);
  const filteredCurrentVisitors = filteredRows.reduce((s, r) => s + (r.currentVisitors ?? (r.currentVisitorCount - r.newVisitors)), 0);
  const filteredTotalVisitors = filteredNewVisitors + filteredCurrentVisitors;

  // 3. STATUS - ENROLLMENT
  const filteredNewlyEnrolled = filteredRows.reduce((s, r) => s + r.newlyEnrolled, 0);
  const filteredPreviouslyEnrolled = filteredRows.reduce((s, r) => s + (r.previouslyEnrolled ?? r.previouslyEnrolledStudents), 0);
  const filteredTotalEnrolled = filteredNewlyEnrolled + filteredPreviouslyEnrolled;

  // Master Data-Integrity Verification
  const isEquationBalanced = filteredTotalOnboarded === (filteredTotalVisitors + filteredTotalEnrolled);
  const totalVisitorToStudent = filteredRows.reduce((s, r) => s + r.visitorToStudent, 0);

  // Backward compatibility aliases
  const totalEnrolledStudents = filteredPreviouslyEnrolled;
  const totalNewlyEnrolled = filteredNewlyEnrolled;
  const totalStudents = filteredTotalEnrolled;
  const totalVisitorsOnboarded = filteredPreviouslyOnboarded;
  const totalNewlyOnboarded = filteredNewlyOnboarded;
  const totalVisitors = filteredTotalVisitors;
  const totalClassMembers = filteredTotalOnboarded;

  // Group Eligible Candidates by Department -> Class (Phase 12 & 34)
  const groupedCandidates = useMemo(() => {
    const groups: Record<string, Record<string, EligibleVisitorCandidate[]>> = {};

    for (const cand of eligibleCandidates) {
      const dept = (cand.department || 'GENERAL DEPARTMENT').toUpperCase();
      const cls = cand.className || 'General Class';
      if (!groups[dept]) groups[dept] = {};
      if (!groups[dept][cls]) groups[dept][cls] = [];
      groups[dept][cls].push(cand);
    }
    return groups;
  }, [eligibleCandidates]);

  // Cumulative Totals
  const cumulativeStats = collationData?.cumulativeTotals || {
    cumulativeOnboarded: 0,
    cumulativeEnrollment: 0,
    currentStudentPopulation: 0,
    currentVisitorPopulation: 0,
    totalActiveClassMembers: 0
  };

  // Export Weekly Enrollment to CSV
  const handleExportEnrollmentCSV = () => {
    const headers = [
      'Week Number',
      'Class Name',
      'Department',
      'Newly Onboarded',
      'Previously Onboarded',
      'TOTAL ONBOARDED',
      'New Visitors',
      'Current Visitors',
      'TOTAL VISITORS',
      'Newly Enrolled (Students)',
      'Previously Enrolled',
      'TOTAL ENROLLED',
      'Visitor to Student Conversions'
    ];

    const dataRows = filteredRows.map(r => {
      const rowNewOnb = r.newlyOnboarded ?? r.newVisitors;
      const rowPrevOnb = r.previouslyOnboarded ?? r.onboarded;
      const rowTotOnb = r.totalOnboarded ?? (rowNewOnb + rowPrevOnb);

      const rowNewVis = r.newVisitors;
      const rowCurVis = r.currentVisitors ?? (r.currentVisitorCount - r.newVisitors);
      const rowTotVis = r.totalVisitors ?? (rowNewVis + rowCurVis);

      const rowNewEnr = r.newlyEnrolled;
      const rowPrevEnr = r.previouslyEnrolled ?? r.previouslyEnrolledStudents;
      const rowTotEnr = r.totalEnrolled ?? (rowNewEnr + rowPrevEnr);

      return [
        r.weekNumber,
        `"${r.className}"`,
        `"${r.department}"`,
        rowNewOnb,
        rowPrevOnb,
        rowTotOnb,
        rowNewVis,
        rowCurVis,
        rowTotVis,
        rowNewEnr,
        rowPrevEnr,
        rowTotEnr,
        r.visitorToStudent
      ];
    });

    const totalsRow = [
      `"Week ${selectedWeek} Totals"`,
      `"ALL CLASSES (${filteredRows.length})"`,
      '""',
      filteredNewlyOnboarded,
      filteredPreviouslyOnboarded,
      filteredTotalOnboarded,
      filteredNewVisitors,
      filteredCurrentVisitors,
      filteredTotalVisitors,
      filteredNewlyEnrolled,
      filteredPreviouslyEnrolled,
      filteredTotalEnrolled,
      totalVisitorToStudent
    ];

    const csvContent = [headers.join(','), ...dataRows.map(r => r.join(',')), totalsRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GOFAMINT_HOF_Enrollment_Record_Week_${selectedWeek}_Q${selectedQuarter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const departmentsList = ['ALL', ...Array.from(new Set(allClasses.map(c => c.department).filter(Boolean)))];

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-blue-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-teal-400/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-400/20 border border-teal-400/40 rounded-full text-xs font-black text-teal-300 uppercase tracking-wider">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Enrollment Officer Directorate • Visitor to Student Transition Pipeline</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Cinzel',serif] tracking-wide text-white">
              General Enrollment & Learner Progression Directorate
            </h1>
            <p className="text-xs sm:text-sm text-teal-100 max-w-2xl leading-relaxed">
              Officer in Charge: <strong>{currentAdmin.profileName}</strong> ({currentAdmin.username}) • Tracking learner onboarding, certifying visitor consistency, and managing visitor-to-student conversions across all Class Registers.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-amber-300 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Enrollment Sheet</span>
            </button>
            <button
              onClick={handleExportEnrollmentCSV}
              className="px-4 py-2.5 bg-teal-700 hover:bg-teal-600 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Success Notification */}
      {actionSuccessMessage && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-400 rounded-2xl text-xs font-bold text-emerald-200 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
          <p>{actionSuccessMessage}</p>
        </div>
      )}

      {/* In-page navigation tabs have been moved to the desktop sidebar and mobile sticky taskbar */}

      {/* Control Bar: Quarter, Week, Department, and Search Selectors */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        
        {/* Quarter & Lesson Details Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quarter:</span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4].map(qNum => (
                <button
                  key={qNum}
                  onClick={() => setSelectedQuarter(qNum)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    selectedQuarter === qNum
                      ? 'bg-teal-900 text-amber-300 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Quarter {qNum} {sundaySchoolYear.activeQuarterNumber === qNum && '★'}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs font-bold text-slate-500">
            Active Census: <strong className="text-teal-900">{cumulativeStats.currentStudentPopulation} Students</strong> • <strong className="text-purple-900">{cumulativeStats.currentVisitorPopulation} Visitors</strong>
          </div>
        </div>

        {/* Week Selector Chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              <span>Select Week ({totalWeeks} Weeks in Quarter {selectedQuarter}):</span>
            </span>
            <span className="text-xs font-black text-teal-950">Active Week: Week {selectedWeek}</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => (
              <button
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition shrink-0 cursor-pointer ${
                  selectedWeek === w
                    ? 'bg-teal-900 text-white shadow-md ring-2 ring-teal-900/30'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Week {w}
              </button>
            ))}
          </div>
        </div>

        {/* Department Filter & Search Input */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
          <div className="sm:col-span-5 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-hidden cursor-pointer"
            >
              {departmentsList.map(dept => (
                <option key={dept} value={dept}>
                  {dept === 'ALL' ? 'All Departments' : `Department: ${dept}`}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-7 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by class name, member, or department..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 outline-hidden font-medium placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ENROLLMENT / MEMBERSHIP PROGRESSION (PART 4 & PART 10)    */}
      {/* LEFT = ONBOARDING  |  RIGHT = STATUS                     */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT SIDE: ONBOARDING (INTAKE HISTORY) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-teal-950 text-white rounded-3xl p-5 border-2 border-teal-500/40 shadow-lg flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-teal-500/30">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-teal-300">
                  ONBOARDING (INTAKE HISTORY)
                </span>
              </div>
              <span className="text-[10px] font-bold bg-teal-400/20 text-teal-200 px-2.5 py-0.5 rounded-full border border-teal-400/30">
                Left Side • Intake Event
              </span>
            </div>
            <p className="text-[11px] text-teal-200/80 mt-2 leading-relaxed">
              Cumulative intake history of people brought into Sunday Bible School classes. Onboarding never decreases when visitors qualify as students.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
              <span className="text-[10px] font-bold text-teal-300 uppercase tracking-wider block">
                Newly Onboarded
              </span>
              <h4 className="text-2xl font-black text-white mt-1">
                +{filteredNewlyOnboarded}
              </h4>
              <p className="text-[10px] text-slate-300 mt-0.5">
                Added Week {selectedWeek}
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                Previously Onboarded
              </span>
              <h4 className="text-2xl font-black text-white mt-1">
                {filteredPreviouslyOnboarded}
              </h4>
              <p className="text-[10px] text-slate-300 mt-0.5">
                Prior to Week {selectedWeek}
              </p>
            </div>
          </div>

          <div className="bg-teal-500/20 border-2 border-teal-400/60 rounded-2xl p-4 flex items-center justify-between shadow-inner">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 block">
                TOTAL ONBOARDED
              </span>
              <span className="text-[10px] text-teal-200 font-medium">
                Newly ({filteredNewlyOnboarded}) + Previously ({filteredPreviouslyOnboarded})
              </span>
            </div>
            <div className="text-3xl font-black text-white font-mono tracking-tight">
              {filteredTotalOnboarded}
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: STATUS (CURRENT MEMBERSHIP) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-5 border-2 border-slate-200 shadow-lg flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  STATUS (CURRENT CLASSIFICATION)
                </span>
              </div>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                Right Side • Current Population
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              Current active classification of class members split between pre-studentship Visitors and qualified Students.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Visitors Section */}
            <div className="bg-purple-50/60 rounded-2xl p-4 border border-purple-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-purple-900">
                  VISITORS
                </span>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  Pre-Studentship
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-purple-100">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">New Visitors</span>
                  <span className="text-lg font-black text-purple-950">+{filteredNewVisitors}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-purple-100">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Current Visitors</span>
                  <span className="text-lg font-black text-purple-950">{filteredCurrentVisitors}</span>
                </div>
              </div>
              <div className="bg-purple-900 text-white rounded-xl p-2.5 flex items-center justify-between px-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-200">
                  TOTAL VISITORS
                </span>
                <span className="text-xl font-black font-mono">{filteredTotalVisitors}</span>
              </div>
            </div>

            {/* Enrollment Section */}
            <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
                  ENROLLMENT
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Qualified Students
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Newly Enrolled</span>
                  <span className="text-lg font-black text-emerald-900">+{filteredNewlyEnrolled}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Previously Enrolled</span>
                  <span className="text-lg font-black text-slate-800">{filteredPreviouslyEnrolled}</span>
                </div>
              </div>
              <div className="bg-emerald-900 text-white rounded-xl p-2.5 flex items-center justify-between px-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200">
                  TOTAL ENROLLED
                </span>
                <span className="text-xl font-black font-mono">{filteredTotalEnrolled}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MASTER DATA-INTEGRITY BALANCING BANNER (PART 5) */}
      <div className={`p-4 rounded-2xl border text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs ${
        isEquationBalanced ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950' : 'bg-rose-500/10 border-rose-500/30 text-rose-950'
      }`}>
        <div className="flex items-center gap-2.5">
          {isEquationBalanced ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <div>
            <span className="font-black uppercase tracking-wider text-[11px] block">
              {isEquationBalanced ? '✓ Master Data-Integrity Balancing Verified' : '⚠ Data Integrity Discrepancy Detected'}
            </span>
            <p className="text-[11px] opacity-90 mt-0.5">
              TOTAL ONBOARDED (<strong>{filteredTotalOnboarded}</strong>) = TOTAL VISITORS (<strong>{filteredTotalVisitors}</strong>) + TOTAL ENROLLED (<strong>{filteredTotalEnrolled}</strong>)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono font-bold bg-white/90 py-1.5 px-3 rounded-xl border border-slate-200 shrink-0 shadow-2xs">
          <span className="text-teal-900">Onboarding: {filteredNewlyOnboarded} + {filteredPreviouslyOnboarded} = {filteredTotalOnboarded}</span>
          <span className="text-slate-300">|</span>
          <span className="text-purple-900">Visitors: {filteredNewVisitors} + {filteredCurrentVisitors} = {filteredTotalVisitors}</span>
          <span className="text-slate-300">|</span>
          <span className="text-emerald-900">Enrolled: {filteredNewlyEnrolled} + {filteredPreviouslyEnrolled} = {filteredTotalEnrolled}</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: WEEKLY ENROLLMENT TABLE (Standard Layout) */}
      {/* ========================================================= */}
      {activeTab === 'DEPARTED_MEMBERS' && (
        <DepartedMembersPanel members={allMembersList} classes={allClasses} />
      )}

      {activeTab === 'WEEKLY_ENROLLMENT' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-teal-600" />
                  <span>Weekly Enrollment Table (Week {selectedWeek}, Quarter {selectedQuarter})</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Arranged in two canonical sides: LEFT = Onboarding (Intake History) | RIGHT = Status (Visitors & Enrollment Progression).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                  Reporting Classes: <strong>{filteredRows.length}</strong>
                </span>
              </div>
            </div>

            {isLoading ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <div className="inline-block w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p>Collating live enrollment records...</p>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="font-bold text-slate-700">No enrollment records found for Week {selectedWeek}, Quarter {selectedQuarter}.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    {/* Super Header: Left (Onboarding) vs Right (Status: Visitors + Enrollment) */}
                    <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider border-b border-slate-800">
                      <th rowSpan={2} className="p-3 pl-4 border-r border-slate-800 align-bottom w-56">Class & Department</th>
                      <th colSpan={3} className="p-2 text-center border-r border-teal-800 bg-teal-950/80 text-teal-300">
                        ONBOARDING (INTAKE HISTORY)
                      </th>
                      <th colSpan={3} className="p-2 text-center border-r border-purple-800 bg-purple-950/80 text-purple-300">
                        STATUS: VISITORS
                      </th>
                      <th colSpan={3} className="p-2 text-center border-r border-indigo-800 bg-indigo-950/80 text-emerald-300">
                        STATUS: ENROLLMENT (STUDENTS)
                      </th>
                      <th rowSpan={2} className="p-3 pr-4 text-center align-bottom w-28">Actions</th>
                    </tr>
                    {/* Sub Headers */}
                    <tr className="bg-slate-800 text-slate-200 text-[10px] font-bold uppercase tracking-wider border-b border-slate-700">
                      {/* Onboarding columns */}
                      <th className="p-2 text-center border-r border-slate-700">Newly Onb</th>
                      <th className="p-2 text-center border-r border-slate-700">Prev Onb</th>
                      <th className="p-2 text-center border-r border-slate-700 bg-teal-900/60 text-amber-300 font-black">TOTAL ONB</th>
                      {/* Visitors columns */}
                      <th className="p-2 text-center border-r border-slate-700">New Vis</th>
                      <th className="p-2 text-center border-r border-slate-700">Current Vis</th>
                      <th className="p-2 text-center border-r border-slate-700 bg-purple-900/60 text-purple-200 font-black">TOTAL VIS</th>
                      {/* Enrollment columns */}
                      <th className="p-2 text-center border-r border-slate-700">Newly Enr</th>
                      <th className="p-2 text-center border-r border-slate-700">Prev Enr</th>
                      <th className="p-2 text-center border-r border-slate-700 bg-indigo-900/60 text-emerald-300 font-black">TOTAL ENR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredRows.map((row, idx) => {
                      const rowNewOnb = row.newlyOnboarded ?? row.newVisitors;
                      const rowPrevOnb = row.previouslyOnboarded ?? row.onboarded;
                      const rowTotOnb = row.totalOnboarded ?? (rowNewOnb + rowPrevOnb);

                      const rowNewVis = row.newVisitors;
                      const rowCurVis = row.currentVisitors ?? (row.currentVisitorCount - row.newVisitors);
                      const rowTotVis = row.totalVisitors ?? (rowNewVis + rowCurVis);

                      const rowNewEnr = row.newlyEnrolled;
                      const rowPrevEnr = row.previouslyEnrolled ?? row.previouslyEnrolledStudents;
                      const rowTotEnr = row.totalEnrolled ?? (rowNewEnr + rowPrevEnr);

                      return (
                        <tr key={row.classId || idx} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 pl-4 border-r border-slate-100">
                            <div className="font-black text-slate-900 text-xs">{row.className}</div>
                            <div className="text-[10px] text-slate-400 font-semibold">{row.department}</div>
                          </td>
                          {/* Onboarding */}
                          <td className="p-3 text-center border-r border-slate-100 font-semibold text-slate-700">
                            {rowNewOnb > 0 ? <span className="text-teal-700 font-bold">+{rowNewOnb}</span> : '0'}
                          </td>
                          <td className="p-3 text-center border-r border-slate-100 text-slate-600 font-medium">
                            {rowPrevOnb}
                          </td>
                          <td className="p-3 text-center border-r border-slate-200 font-black bg-teal-50/50 text-teal-950">
                            {rowTotOnb}
                          </td>
                          {/* Visitors */}
                          <td className="p-3 text-center border-r border-slate-100 font-semibold text-slate-700">
                            {rowNewVis > 0 ? <span className="text-purple-700 font-bold">+{rowNewVis}</span> : '0'}
                          </td>
                          <td className="p-3 text-center border-r border-slate-100 text-slate-600 font-medium">
                            {rowCurVis}
                          </td>
                          <td className="p-3 text-center border-r border-slate-200 font-black bg-purple-50/50 text-purple-950">
                            {rowTotVis}
                          </td>
                          {/* Enrollment */}
                          <td className="p-3 text-center border-r border-slate-100 font-semibold">
                            {rowNewEnr > 0 ? (
                              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-black text-[11px]">
                                +{rowNewEnr}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="p-3 text-center border-r border-slate-100 text-slate-600 font-medium">
                            {rowPrevEnr}
                          </td>
                          <td className="p-3 text-center border-r border-slate-200 font-black bg-indigo-50/50 text-indigo-950">
                            {rowTotEnr}
                          </td>
                          {/* Action */}
                          <td className="p-3 pr-4 text-center">
                            <button
                              onClick={() => setDrillDownRow(row)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-teal-100 text-teal-900 rounded-lg font-bold text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Inspect Class</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Grand Totals Footer */}
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-700 text-xs">
                      <td className="p-3.5 pl-4 uppercase tracking-wider text-amber-300 border-r border-slate-800">
                        GRAND TOTALS ({filteredRows.length})
                      </td>
                      {/* Onboarding totals */}
                      <td className="p-3.5 text-center border-r border-slate-800 text-teal-300">
                        {filteredNewlyOnboarded}
                      </td>
                      <td className="p-3.5 text-center border-r border-slate-800 text-slate-300">
                        {filteredPreviouslyOnboarded}
                      </td>
                      <td className="p-3.5 text-center border-r border-slate-700 bg-teal-950 text-amber-300 font-black text-sm">
                        {filteredTotalOnboarded}
                      </td>
                      {/* Visitors totals */}
                      <td className="p-3.5 text-center border-r border-slate-800 text-purple-300">
                        {filteredNewVisitors}
                      </td>
                      <td className="p-3.5 text-center border-r border-slate-800 text-slate-300">
                        {filteredCurrentVisitors}
                      </td>
                      <td className="p-3.5 text-center border-r border-slate-700 bg-purple-950 text-purple-200 font-black text-sm">
                        {filteredTotalVisitors}
                      </td>
                      {/* Enrollment totals */}
                      <td className="p-3.5 text-center border-r border-slate-800 text-emerald-300">
                        {filteredNewlyEnrolled}
                      </td>
                      <td className="p-3.5 text-center border-r border-slate-800 text-slate-300">
                        {filteredPreviouslyEnrolled}
                      </td>
                      <td className="p-3.5 text-center border-r border-slate-700 bg-indigo-950 text-emerald-300 font-black text-sm">
                        {filteredTotalEnrolled}
                      </td>
                      {/* Reconciliation flag */}
                      <td className="p-3.5 pr-4 text-center text-amber-300 font-mono text-[10px]">
                        {isEquationBalanced ? '✓ Balanced' : '⚠ Discrepancy'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Cumulative Totals & Directorate Metrics Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md">
              <span className="text-[10px] font-black uppercase text-teal-400 tracking-wider block">Cumulative Onboarded</span>
              <h3 className="text-2xl font-black text-white mt-1">{cumulativeStats.cumulativeOnboarded}</h3>
              <p className="text-xs text-slate-400 mt-1">Total visitors received to date</p>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md">
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">Cumulative Enrollment</span>
              <h3 className="text-2xl font-black text-amber-300 mt-1">{cumulativeStats.cumulativeEnrollment}</h3>
              <p className="text-xs text-slate-400 mt-1">Visitor → Student conversions to date</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Current Student Population</span>
              <h3 className="text-2xl font-black text-teal-800 mt-1">{cumulativeStats.currentStudentPopulation}</h3>
              <p className="text-xs text-slate-500 mt-1">Active full students</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Current Visitor Population</span>
              <h3 className="text-2xl font-black text-purple-800 mt-1">{cumulativeStats.currentVisitorPopulation}</h3>
              <p className="text-xs text-slate-500 mt-1">Active regular visitors</p>
            </div>

            <div className="bg-teal-950 text-white p-5 rounded-2xl border border-teal-800 shadow-md">
              <span className="text-[10px] font-black uppercase text-teal-300 tracking-wider block">Total Active Class Members</span>
              <h3 className="text-2xl font-black text-amber-300 mt-1">{cumulativeStats.totalActiveClassMembers}</h3>
              <p className="text-xs text-teal-200 mt-1">Students + Visitors</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: CONSISTENCY & CERTIFICATION REVIEW */}
      {/* ========================================================= */}
      {activeTab === 'CONSISTENCY_CERTIFICATION' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-black uppercase">
                  <Award className="w-3.5 h-3.5" />
                  <span>Consistency Evaluation Engine</span>
                </div>
                <h2 className="text-xl font-black font-['Cinzel',serif] tracking-wide text-slate-900">
                  VISITOR CONSISTENCY TRACKING
                </h2>
                <p className="text-xs text-slate-500 max-w-2xl">
                  Department → Class → Eligible Candidates. Evaluated strictly from real Class Register attendance marks across the 3-week consistency milestone.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleBatchCertifyEligible}
                  disabled={eligibleCandidates.filter(c => c.isEligible).length === 0}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                    eligibleCandidates.filter(c => c.isEligible).length > 0
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer shadow-sm'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Certify All {eligibleCandidates.filter(c => c.isEligible).length} Eligible Candidates</span>
                </button>
              </div>
            </div>

            {/* Candidates Grouped by Department -> Class (Phases 12 & 34) */}
            {eligibleCandidates.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="font-bold text-slate-700">No active visitors currently recorded across reporting classes.</p>
                <p className="text-slate-400">As class secretaries onboard visitors and record their attendance in the Class Register, candidates will appear here automatically.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedCandidates).map(([deptName, classesMap]) => {
                  const deptCandidates = Object.values(classesMap).flat();
                  const deptEligible = deptCandidates.filter(c => c.isEligible).length;

                  return (
                    <div key={deptName} className="space-y-4">
                      {/* Department Header */}
                      <div className="flex items-center justify-between border-b-2 border-teal-800 pb-2">
                        <div className="flex items-center gap-2">
                          <Building className="w-5 h-5 text-teal-800" />
                          <h3 className="text-sm font-black tracking-wider text-slate-900 uppercase">
                            {deptName}
                          </h3>
                        </div>
                        <span className="text-xs font-bold text-teal-900 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                          {deptCandidates.length} Active Visitor{deptCandidates.length !== 1 ? 's' : ''} ({deptEligible} Eligible)
                        </span>
                      </div>

                      {/* Class Groups within Department */}
                      <div className="space-y-4">
                        {Object.entries(classesMap).map(([className, classCandidates]) => (
                          <div key={className} className="bg-slate-50/60 rounded-2xl border border-slate-200 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-teal-700" />
                                <span>{className}</span>
                                <span className="text-[10px] bg-teal-100 text-teal-900 px-2 py-0.5 rounded-full font-bold">
                                  {classCandidates.length} visitor{classCandidates.length !== 1 ? 's' : ''}
                                </span>
                              </h4>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs bg-white rounded-xl overflow-hidden border border-slate-200">
                                <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                                  <tr>
                                    <th className="p-3">Visitor Name</th>
                                    <th className="p-3 text-center">Week 1</th>
                                    <th className="p-3 text-center">Week 2</th>
                                    <th className="p-3 text-center">Week 3</th>
                                    <th className="p-3 text-center">Consecutive Visits</th>
                                    <th className="p-3">Consistency / Eligibility</th>
                                    <th className="p-3 text-right">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                  {classCandidates.map((cand) => {
                                    const w1 = cand.attendedWeeks.includes(1);
                                    const w2 = cand.attendedWeeks.includes(2);
                                    const w3 = cand.attendedWeeks.includes(3);

                                    return (
                                      <tr key={cand.member.id} className="hover:bg-slate-50 transition">
                                        <td className="p-3">
                                          <div className="font-black text-slate-900">{cand.member.fullName}</div>
                                          <div className="text-[10px] text-slate-400">{cand.member.phone || 'No phone'} • {cand.member.occupation || 'Learner'}</div>
                                        </td>
                                        <td className="p-3 text-center font-bold">
                                          {w1 ? (
                                            <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-black text-[10px]">✓ W1</span>
                                          ) : (
                                            <span className="text-slate-300 font-bold">—</span>
                                          )}
                                        </td>
                                        <td className="p-3 text-center font-bold">
                                          {w2 ? (
                                            <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-black text-[10px]">✓ W2</span>
                                          ) : (
                                            <span className="text-slate-300 font-bold">—</span>
                                          )}
                                        </td>
                                        <td className="p-3 text-center font-bold">
                                          {w3 ? (
                                            <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-black text-[10px]">✓ W3</span>
                                          ) : (
                                            <span className="text-slate-300 font-bold">—</span>
                                          )}
                                        </td>
                                        <td className="p-3 text-center font-black">
                                          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                                            cand.consecutiveVisits >= 3
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : 'bg-slate-100 text-slate-700'
                                          }`}>
                                            {cand.consecutiveVisits} Consecutive
                                          </span>
                                        </td>
                                        <td className="p-3">
                                          {cand.member.conversionStatus === 'PENDING_APPROVAL' ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full font-black text-[10px]">
                                              <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                                              <span>Teacher Requested</span>
                                            </span>
                                          ) : cand.isEligible ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded-full font-black text-[10px]">
                                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                              <span>Eligible</span>
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full font-bold text-[10px]">
                                              <Clock className="w-3 h-3 text-slate-400" />
                                              <span>{cand.eligibilityReason || 'In Progress'}</span>
                                            </span>
                                          )}
                                        </td>
                                        <td className="p-3 text-right">
                                          <div className="flex items-center justify-end gap-1.5">
                                            {cand.member.conversionStatus === 'PENDING_APPROVAL' && (
                                              <button
                                                onClick={() => handleDenySingle(cand)}
                                                className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold text-xs transition inline-flex items-center gap-1 cursor-pointer"
                                                title="Decline promotion request"
                                              >
                                                <X className="w-3.5 h-3.5 text-red-600" />
                                                <span>Decline</span>
                                              </button>
                                            )}
                                            <button
                                              onClick={() => setSelectedCandidateForCert(cand)}
                                              className="px-3 py-1.5 bg-teal-800 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition inline-flex items-center gap-1 cursor-pointer shadow-xs"
                                            >
                                              <Award className="w-3.5 h-3.5 text-amber-300" />
                                              <span>Certify & Enroll</span>
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: CONVERSION AUDIT TRAIL */}
      {/* ========================================================= */}
      {activeTab === 'AUDIT_TRAIL' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="space-y-1 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-teal-600" />
                <span>Permanent Enrollment Certification & Conversion Audit Trail</span>
              </h2>
              <p className="text-xs text-slate-500">
                Official historical ledger of all ratified visitor-to-student conversions with officer signatures, timestamps, and reason logs.
              </p>
            </div>

            {allCertifications.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-bold text-slate-700">No enrollment conversions have been certified yet.</p>
                <p className="text-slate-400">When the Enrollment Officer certifies a consistent visitor into Student status, the permanent record is stored here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] font-black uppercase">
                      <th className="p-3.5 pl-4">Member Name</th>
                      <th className="p-3.5">Class Name</th>
                      <th className="p-3.5 text-center">Period</th>
                      <th className="p-3.5">Certified By</th>
                      <th className="p-3.5">Certification Timestamp</th>
                      <th className="p-3.5 pr-4">Notes / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {allCertifications.map((cert, idx) => (
                      <tr key={cert.id || idx} className="hover:bg-slate-50">
                        <td className="p-3.5 pl-4 font-black text-slate-900">
                          {cert.memberName}
                        </td>
                        <td className="p-3.5 font-bold text-slate-800">
                          {cert.className}
                        </td>
                        <td className="p-3.5 text-center font-bold text-teal-800">
                          Week {cert.weekNumber}, Q{cert.quarterNumber}
                        </td>
                        <td className="p-3.5 font-semibold text-slate-700">
                          {cert.certifiedByOfficerName}
                        </td>
                        <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                          {new Date(cert.certifiedAt).toLocaleString()}
                        </td>
                        <td className="p-3.5 pr-4 text-slate-600 italic">
                          {cert.notes || cert.reason || 'Standard Consistency Certification'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: DEPARTMENTAL CENSUS BREAKDOWN */}
      {/* ========================================================= */}
      {activeTab === 'DEPARTMENTAL_CENSUS' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="space-y-1 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-teal-600" />
                <span>Departmental Census & Demographic Distribution</span>
              </h2>
              <p className="text-xs text-slate-500">
                Summary of active student vs visitor composition across all Sunday Bible School departments.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departmentsList.filter(d => d !== 'ALL').map(dept => {
                const deptRows = rows.filter(r => r.department === dept);
                const deptStudents = deptRows.reduce((s, r) => s + r.currentStudentCount, 0);
                const deptVisitors = deptRows.reduce((s, r) => s + r.currentVisitorCount, 0);
                const deptTotal = deptStudents + deptVisitors;
                const studentRatio = deptTotal > 0 ? Math.round((deptStudents / deptTotal) * 100) : 0;

                return (
                  <div key={dept} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-slate-900 text-sm">{dept}</h3>
                      <span className="text-xs font-bold bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-slate-600">
                        {deptRows.length} Classes
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 font-bold block">Students</span>
                        <span className="text-base font-black text-teal-800">{deptStudents}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 font-bold block">Visitors</span>
                        <span className="text-base font-black text-purple-800">{deptVisitors}</span>
                      </div>
                      <div className="bg-teal-900 text-white p-2.5 rounded-xl">
                        <span className="text-[10px] text-teal-200 font-bold block">Total</span>
                        <span className="text-base font-black text-amber-300">{deptTotal}</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-500">
                        <span>Student Ratio</span>
                        <span>{studentRatio}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                        <div className="bg-teal-600 h-full" style={{ width: `${studentRatio}%` }} />
                        <div className="bg-purple-500 h-full" style={{ width: `${100 - studentRatio}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 6: STUDENT TRANSFERS (PHASE 10) */}
      {/* ========================================================= */}
      {activeTab === 'STUDENT_TRANSFERS' && (() => {
        const pendingTransfers = allTransfers.filter(t => t.status === 'PENDING');
        const approvedTransfers = allTransfers.filter(t => t.status === 'APPROVED');
        const rejectedTransfers = allTransfers.filter(t => t.status === 'REJECTED');

        return (
          <div className="space-y-6">
            {/* Header Description */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                    <span>Student Transfer Directorate (Phase 10)</span>
                  </h2>
                  <p className="text-xs text-slate-500 max-w-2xl">
                    Review and ratify inter-departmental and inter-class student transfers. Approvals update current membership while historical records in previous classes remain permanently intact.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold rounded-xl flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>{pendingTransfers.length} Pending Approval</span>
                  </span>
                  <span className="px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-xl flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{approvedTransfers.length} Approved</span>
                  </span>
                </div>
              </div>

              {/* Integrity Notice (Phase 10.5 & 10.7) */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Historical Truth Preservation:</span>
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    When a transfer is approved effective from a specific lesson week, historical attendance prior to that week remains locked in the student's previous class. Statistical reports will accurately reflect where the student was at each past lesson.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 1: Pending Transfer Requests */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Pending Transfer Requests ({pendingTransfers.length})</span>
              </h3>

              {pendingTransfers.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
                  No pending student transfer requests requiring action.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {pendingTransfers.map((req) => (
                    <div
                      key={req.id}
                      className="p-5 bg-gradient-to-br from-white to-indigo-50/30 rounded-2xl border-2 border-indigo-200 shadow-xs space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                              Transfer Request
                            </span>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-black text-slate-900">
                                {req.memberName || req.studentName}
                              </h4>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                req.memberType === 'VISITOR' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
                              }`}>
                                {req.memberType === 'VISITOR' ? 'Visitor' : 'Student'}
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[10px] font-black uppercase">
                            Pending Review
                          </span>
                        </div>

                        {/* From -> To Department & Class Flow */}
                        <div className="grid grid-cols-2 gap-2 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">From Current</span>
                            <strong className="text-slate-800 block">{req.previousClassName || req.fromClassName}</strong>
                            <span className="text-[10px] text-slate-500">{req.previousDepartment || req.fromDepartment}</span>
                          </div>
                          <div className="border-l border-slate-200 pl-2">
                            <span className="text-[9px] font-bold text-indigo-600 uppercase block">To Destination</span>
                            <strong className="text-indigo-950 block">{req.destinationClassName || req.toClassName}</strong>
                            <span className="text-[10px] text-indigo-700">{req.destinationDepartment || req.toDepartment}</span>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-1 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-700">Effective Week:</span>
                            <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-900 rounded font-black text-[11px]">
                              Week {req.effectiveWeekNumber || req.effectiveWeek || 1}
                            </span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">Reason:</span>{' '}
                            <span className="italic text-slate-800">"{req.reason}"</span>
                          </div>
                          <div className="text-[10px] text-slate-400 pt-1">
                            Requested by <strong>{req.requestingOfficer || req.requestedBy}</strong> on {new Date(req.requestedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleRejectTransfer(req)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Reject Transfer
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveTransfer(req)}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-xs transition cursor-pointer"
                        >
                          Approve Transfer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Historical Transfer Audit Trail */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <History className="w-4 h-4 text-teal-600" />
                <span>Historical Transfer Audit Trail ({approvedTransfers.length + rejectedTransfers.length})</span>
              </h3>

              {approvedTransfers.length === 0 && rejectedTransfers.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No historical student transfer records found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="p-3">Person Name</th>
                        <th className="p-3">Previous Class</th>
                        <th className="p-3">New Destination Class</th>
                        <th className="p-3 text-center">Effective Week</th>
                        <th className="p-3">Reason</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3">Reviewed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...approvedTransfers, ...rejectedTransfers].map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="p-3 font-black text-slate-900">
                            <div className="flex items-center gap-2">
                              <span>{t.memberName || t.studentName}</span>
                              {t.memberType && (
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                  t.memberType === 'VISITOR' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}>
                                  {t.memberType === 'VISITOR' ? 'Visitor' : 'Student'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-slate-600">{t.previousClassName || t.fromClassName} ({t.previousDepartment || t.fromDepartment})</td>
                          <td className="p-3 font-bold text-indigo-900">{t.destinationClassName || t.toClassName} ({t.destinationDepartment || t.toDepartment})</td>
                          <td className="p-3 text-center font-bold text-slate-800">Week {t.effectiveWeekNumber || t.effectiveWeek || 1}</td>
                          <td className="p-3 text-slate-600 italic max-w-xs truncate">{t.reason}</td>
                          <td className="p-3 text-center">
                            {t.status === 'APPROVED' ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black rounded-full text-[10px]">
                                Approved
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-black rounded-full text-[10px]">
                                Rejected
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-slate-500 text-[11px]">
                            {t.approvingOfficer || t.reviewedBy || 'Officer'}
                            <div className="text-[9px] text-slate-400">{t.approvalDate ? new Date(t.approvalDate).toLocaleDateString() : ''}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* DRILL-DOWN MODAL: CONVERTED MEMBERS INSPECTION */}
      {/* ========================================================= */}
      {drillDownRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-400/20 text-amber-300 rounded-md text-[10px] font-black uppercase">
                  <span>Progression Audit</span>
                </div>
                <h3 className="text-lg font-black text-white">{drillDownRow.className}</h3>
                <p className="text-xs text-slate-400">
                  {drillDownRow.department} • Week {selectedWeek}, Quarter {selectedQuarter} • {drillDownRow.visitorToStudent} Visitor → Student Conversions
                </p>
              </div>

              <button
                onClick={() => setDrillDownRow(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              
              {/* Quick Summary Chips: Two Conceptual Sides */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Onboarding Side */}
                <div className="bg-teal-50/60 p-3.5 rounded-2xl border border-teal-200">
                  <span className="text-[10px] text-teal-800 uppercase font-black tracking-wider block mb-2">
                    ONBOARDING (INTAKE HISTORY)
                  </span>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block">Newly Onb</span>
                      <span className="text-sm font-black text-teal-900">
                        +{drillDownRow.newlyOnboarded ?? drillDownRow.newVisitors}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block">Prev Onb</span>
                      <span className="text-sm font-black text-slate-700">
                        {drillDownRow.previouslyOnboarded ?? drillDownRow.onboarded}
                      </span>
                    </div>
                    <div className="bg-teal-900 text-white rounded-lg p-1">
                      <span className="text-[8px] text-teal-200 font-bold block">TOTAL ONB</span>
                      <span className="text-sm font-black">
                        {drillDownRow.totalOnboarded ?? ((drillDownRow.newlyOnboarded ?? drillDownRow.newVisitors) + (drillDownRow.previouslyOnboarded ?? drillDownRow.onboarded))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Side */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <span className="text-[10px] text-slate-800 uppercase font-black tracking-wider block mb-2">
                    STATUS (CURRENT MEMBERSHIP)
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-purple-50 p-2 rounded-xl border border-purple-200">
                      <span className="text-[9px] text-purple-700 font-bold block">Visitors (Total)</span>
                      <span className="text-sm font-black text-purple-950">
                        {drillDownRow.totalVisitors ?? drillDownRow.currentVisitorCount}
                      </span>
                      <span className="text-[8px] text-purple-600 block">
                        New: +{drillDownRow.newVisitors} | Cur: {drillDownRow.currentVisitors ?? (drillDownRow.currentVisitorCount - drillDownRow.newVisitors)}
                      </span>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                      <span className="text-[9px] text-emerald-700 font-bold block">Students (Total)</span>
                      <span className="text-sm font-black text-emerald-950">
                        {drillDownRow.totalEnrolled ?? drillDownRow.currentStudentCount}
                      </span>
                      <span className="text-[8px] text-emerald-600 block">
                        New: +{drillDownRow.newlyEnrolled} | Prev: {drillDownRow.previouslyEnrolled ?? drillDownRow.previouslyEnrolledStudents}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Converted Members List */}
              <div className="space-y-2">
                <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                  Converted Learners ({drillDownRow.convertedMembers.length} Members)
                </h4>

                {drillDownRow.convertedMembers.length === 0 ? (
                  <p className="text-slate-400 py-4 text-center">No members converted in Week {selectedWeek} for this class.</p>
                ) : (
                  <div className="space-y-3">
                    {drillDownRow.convertedMembers.map((aud, idx) => (
                      <div key={aud.memberId || idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h5 className="font-black text-slate-900 text-sm">{aud.fullName}</h5>
                            <span className="text-[10px] text-slate-500 font-mono">Member ID: {aud.memberId}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full font-black text-[10px]">
                              Prev: {aud.previousStatus}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-black text-[10px]">
                              Current: {aud.currentStatus}
                            </span>
                          </div>
                        </div>

                        {/* Evidence Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-white p-3 rounded-xl border border-slate-200">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">First Lesson:</span>
                            <span className="font-bold text-slate-800">Week {aud.firstLessonWeek}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Consecutive Visits:</span>
                            <span className="font-bold text-teal-800">{aud.consecutiveVisits} Sessions</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Attendance Rate:</span>
                            <span className="font-bold text-emerald-800">{aud.attendanceRate}%</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">Attended Weeks:</span>
                            <span className="font-bold text-slate-800">[{aud.attendedWeeks.join(', ')}]</span>
                          </div>
                        </div>

                        {aud.certifiedBy && (
                          <div className="text-[10px] text-slate-500 bg-amber-50 p-2 rounded-lg border border-amber-200">
                            Ratified by: <strong>{aud.certifiedBy}</strong> on {new Date(aud.conversionDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setDrillDownRow(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                Close Drill-Down
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CERTIFICATION CONFIRMATION MODAL */}
      {/* ========================================================= */}
      {selectedCandidateForCert && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6">
            
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-amber-100 text-amber-900 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
                Ratify & Certify Student Enrollment
              </h3>
              <p className="text-xs text-slate-500">
                You are about to promote <strong>{selectedCandidateForCert.member.fullName}</strong> in <strong>{selectedCandidateForCert.className}</strong> from Visitor to official Student status for Week {selectedWeek}.
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Consistency Metric:</span>
                <span className="font-black text-slate-900">{selectedCandidateForCert.consecutiveVisits} Consecutive Visits</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Attendance Rate:</span>
                <span className="font-black text-emerald-800">{selectedCandidateForCert.attendanceRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Certifying Officer:</span>
                <span className="font-bold text-teal-800">{currentAdmin.profileName}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block">
                Official Certification Remarks / Notes:
              </label>
              <textarea
                value={certNotes}
                onChange={(e) => setCertNotes(e.target.value)}
                placeholder="e.g., Satisfied consistency requirements; converted to active student."
                rows={2}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedCandidateForCert(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCertifySingle(selectedCandidateForCert, certNotes)}
                className="px-5 py-2.5 bg-teal-800 hover:bg-teal-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Enroll</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PRINT VIEW MODAL */}
      {/* ========================================================= */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <span className="text-xs font-bold text-amber-300">Enrollment Register Print Preview</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-amber-400 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 text-slate-900 text-xs">
              <div className="text-center space-y-2 border-b-2 border-slate-900 pb-5">
                <div className="inline-block">
                  <GofamintLogo size={50} />
                </div>
                <h1 className="text-xl font-black font-['Cinzel',serif] tracking-wider uppercase">
                  The Gospel Faith Mission International (House of Favour) (GOFAMINT_HOF)
                </h1>
                <h2 className="text-sm font-black tracking-widest text-teal-900 uppercase">
                  Sunday Bible School Directorate • General Enrollment Register
                </h2>
                <div className="flex justify-center gap-6 text-xs font-bold text-slate-600 pt-1">
                  <span>Year: {sundaySchoolYear.yearName}</span>
                  <span>•</span>
                  <span>Quarter: {selectedQuarter}</span>
                  <span>•</span>
                  <span>Week: {selectedWeek}</span>
                  <span>•</span>
                  <span>Date: {new Date().toLocaleDateString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <table className="w-full text-left text-xs border border-slate-400 border-collapse">
                  <thead>
                    <tr className="bg-slate-200 text-slate-900 font-black text-[9px] uppercase border-b border-slate-400">
                      <th rowSpan={2} className="p-1.5 border-r border-slate-400 text-center">Week</th>
                      <th rowSpan={2} className="p-1.5 border-r border-slate-400">Class & Department</th>
                      <th colSpan={3} className="p-1.5 border-r border-slate-400 text-center bg-slate-300">ONBOARDING (INTAKE)</th>
                      <th colSpan={3} className="p-1.5 border-r border-slate-400 text-center bg-slate-250">STATUS: VISITORS</th>
                      <th colSpan={3} className="p-1.5 text-center bg-slate-300">STATUS: ENROLLMENT</th>
                    </tr>
                    <tr className="bg-slate-100 text-slate-800 font-bold text-[8px] uppercase border-b border-slate-400">
                      <th className="p-1 border-r border-slate-400 text-center">New Onb</th>
                      <th className="p-1 border-r border-slate-400 text-center">Prev Onb</th>
                      <th className="p-1 border-r border-slate-400 text-center font-black">Tot Onb</th>
                      <th className="p-1 border-r border-slate-400 text-center">New Vis</th>
                      <th className="p-1 border-r border-slate-400 text-center">Cur Vis</th>
                      <th className="p-1 border-r border-slate-400 text-center font-black">Tot Vis</th>
                      <th className="p-1 border-r border-slate-400 text-center">New Enr</th>
                      <th className="p-1 border-r border-slate-400 text-center">Prev Enr</th>
                      <th className="p-1 text-center font-black">Tot Enr</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 text-[10px]">
                    {filteredRows.map((r, idx) => {
                      const rowNewOnb = r.newlyOnboarded ?? r.newVisitors;
                      const rowPrevOnb = r.previouslyOnboarded ?? r.onboarded;
                      const rowTotOnb = r.totalOnboarded ?? (rowNewOnb + rowPrevOnb);
                      const rowNewVis = r.newVisitors;
                      const rowCurVis = r.currentVisitors ?? (r.currentVisitorCount - r.newVisitors);
                      const rowTotVis = r.totalVisitors ?? (rowNewVis + rowCurVis);
                      const rowNewEnr = r.newlyEnrolled;
                      const rowPrevEnr = r.previouslyEnrolled ?? r.previouslyEnrolledStudents;
                      const rowTotEnr = r.totalEnrolled ?? (rowNewEnr + rowPrevEnr);

                      return (
                        <tr key={idx}>
                          <td className="p-1.5 border-r border-slate-300 text-center font-bold">W{r.weekNumber}</td>
                          <td className="p-1.5 border-r border-slate-300 font-bold">{r.className} ({r.department})</td>
                          <td className="p-1.5 border-r border-slate-300 text-center">{rowNewOnb}</td>
                          <td className="p-1.5 border-r border-slate-300 text-center">{rowPrevOnb}</td>
                          <td className="p-1.5 border-r border-slate-300 text-center font-black bg-slate-100">{rowTotOnb}</td>
                          <td className="p-1.5 border-r border-slate-300 text-center">{rowNewVis}</td>
                          <td className="p-1.5 border-r border-slate-300 text-center">{rowCurVis}</td>
                          <td className="p-1.5 border-r border-slate-300 text-center font-black bg-slate-100">{rowTotVis}</td>
                          <td className="p-1.5 border-r border-slate-300 text-center font-bold text-emerald-800">+{rowNewEnr}</td>
                          <td className="p-1.5 border-r border-slate-300 text-center">{rowPrevEnr}</td>
                          <td className="p-1.5 text-center font-black bg-slate-100">{rowTotEnr}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-200 font-black text-xs border-t-2 border-slate-900">
                      <td className="p-2 text-center border-r border-slate-400">W{selectedWeek}</td>
                      <td className="p-2 border-r border-slate-400 uppercase">Grand Totals</td>
                      <td className="p-2 border-r border-slate-400 text-center">{filteredNewlyOnboarded}</td>
                      <td className="p-2 border-r border-slate-400 text-center">{filteredPreviouslyOnboarded}</td>
                      <td className="p-2 border-r border-slate-400 text-center bg-slate-300 font-black">{filteredTotalOnboarded}</td>
                      <td className="p-2 border-r border-slate-400 text-center">{filteredNewVisitors}</td>
                      <td className="p-2 border-r border-slate-400 text-center">{filteredCurrentVisitors}</td>
                      <td className="p-2 border-r border-slate-400 text-center bg-slate-300 font-black">{filteredTotalVisitors}</td>
                      <td className="p-2 border-r border-slate-400 text-center text-emerald-800 font-black">+{filteredNewlyEnrolled}</td>
                      <td className="p-2 border-r border-slate-400 text-center">{filteredPreviouslyEnrolled}</td>
                      <td className="p-2 text-center bg-slate-300 font-black">{filteredTotalEnrolled}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="pt-10 grid grid-cols-2 gap-12 text-xs border-t border-slate-300">
                <div className="space-y-8">
                  <p className="font-bold">Compiled by (Enrollment Officer):</p>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="font-bold text-slate-800">Enrollment Officer</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Signature & Date</span>
                </div>

                <div className="space-y-8">
                  <p className="font-bold">Ratified by (General Superintendent):</p>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="font-bold text-slate-800">General Superintendent</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Signature & Date</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Bottom Taskbar */}
      <nav aria-label="Enrollment Officer mobile navigation" className="fixed inset-x-0 bottom-0 z-50 overflow-x-auto border-t border-slate-200 bg-white/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-12px_35px_rgba(15,42,85,0.16)] backdrop-blur-xl no-scrollbar lg:hidden">
        <div className="flex items-center justify-around gap-1 min-w-max px-2">
          {[
            { id: 'WEEKLY_ENROLLMENT' as const, label: 'Weekly Collation', icon: FileCheck },
            { id: 'CONSISTENCY_CERTIFICATION' as const, label: 'Certification Review', icon: Award, badge: eligibleCandidates.filter(c => c.isEligible).length },
            { id: 'AUDIT_TRAIL' as const, label: 'Audit Trail', icon: ShieldCheck, badge: allCertifications.length },
            { id: 'DEPARTMENTAL_CENSUS' as const, label: 'Census', icon: Building },
            { id: 'DEPARTED_MEMBERS' as const, label: 'Departed', icon: UserX },
            { id: 'STUDENT_TRANSFERS' as const, label: 'Transfers', icon: ArrowRightLeft, badge: allTransfers.filter(t => t.status === 'PENDING').length },
          ].map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition cursor-pointer ${
                  isActive
                    ? 'bg-purple-100 text-[#320b86] font-black'
                    : 'text-slate-500 font-medium'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="text-[10px] whitespace-nowrap">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 right-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-400 text-slate-950 shadow-xs">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
