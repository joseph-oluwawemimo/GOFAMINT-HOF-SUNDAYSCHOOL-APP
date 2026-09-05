import React, { useState, useEffect } from 'react';
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
  Check
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
  EnrollmentCertificationRecord
} from '../../types';
import {
  getRealEnrollmentOfficerCollation,
  getEligibleVisitorCandidates,
  certifyVisitorEnrollment,
  getAllEnrollmentCertifications,
  getAllMembers
} from '../../db/indexedDB';
import { GofamintLogo } from '../GofamintLogo';

interface EnrollmentOfficerViewProps {
  currentAdmin: AdminProfile;
  allClasses?: ClassProfile[];
  sundaySchoolYear?: SundaySchoolYear;
}

export const EnrollmentOfficerView: React.FC<EnrollmentOfficerViewProps> = ({
  currentAdmin,
  allClasses = [],
  sundaySchoolYear
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
  
  // Navigation Tabs:
  // 1. 'WEEKLY_ENROLLMENT' -> Table: | Week | Class | Previously Enrolled | Onboarded | New Visitors | Newly Enrolled | Visitor -> Student |
  // 2. 'CONSISTENCY_CERTIFICATION' -> Review active visitors & certify consistent learners into Student status
  // 3. 'AUDIT_TRAIL' -> Historical logs of all ratified visitor-to-student conversions
  // 4. 'DEPARTMENTAL_CENSUS' -> Breakdown by department & classes
  const [activeTab, setActiveTab] = useState<'WEEKLY_ENROLLMENT' | 'CONSISTENCY_CERTIFICATION' | 'AUDIT_TRAIL' | 'DEPARTMENTAL_CENSUS'>('WEEKLY_ENROLLMENT');

  // Collation & Data State
  const [collationData, setCollationData] = useState<EnrollmentOfficerWeeklyCollation | null>(null);
  const [eligibleCandidates, setEligibleCandidates] = useState<EligibleVisitorCandidate[]>([]);
  const [allCertifications, setAllCertifications] = useState<EnrollmentCertificationRecord[]>([]);
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
      const [collation, candidates, certs] = await Promise.all([
        getRealEnrollmentOfficerCollation(selectedQuarter, selectedWeek),
        getEligibleVisitorCandidates(selectedQuarter, selectedWeek),
        getAllEnrollmentCertifications()
      ]);
      setCollationData(collation);
      setEligibleCandidates(candidates);
      setAllCertifications(certs);
    } catch (err) {
      console.error('Failed to load enrollment officer data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [selectedQuarter, selectedWeek]);

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

  // Filtered Totals
  const totalPrevEnrolled = filteredRows.reduce((s, r) => s + r.previouslyEnrolledStudents, 0);
  const totalOnboarded = filteredRows.reduce((s, r) => s + r.onboarded, 0);
  const totalNewVisitors = filteredRows.reduce((s, r) => s + r.newVisitors, 0);
  const totalNewlyEnrolled = filteredRows.reduce((s, r) => s + r.newlyEnrolled, 0);
  const totalVisitorToStudent = filteredRows.reduce((s, r) => s + r.visitorToStudent, 0);
  const totalCurrentStudents = filteredRows.reduce((s, r) => s + r.currentStudentCount, 0);
  const totalCurrentVisitors = filteredRows.reduce((s, r) => s + r.currentVisitorCount, 0);
  const totalActiveCensus = totalCurrentStudents + totalCurrentVisitors;

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
      'Previously Enrolled Students',
      'Onboarded',
      'New Visitors',
      'Newly Enrolled (Students)',
      'Visitor to Student Conversions',
      'Current Students',
      'Current Visitors',
      'Total Active Members'
    ];

    const dataRows = filteredRows.map(r => [
      r.weekNumber,
      `"${r.className}"`,
      `"${r.department}"`,
      r.previouslyEnrolledStudents,
      r.onboarded,
      r.newVisitors,
      r.newlyEnrolled,
      r.visitorToStudent,
      r.currentStudentCount,
      r.currentVisitorCount,
      r.totalActiveClassMembers
    ]);

    const totalsRow = [
      `"Week ${selectedWeek} Totals"`,
      `"ALL CLASSES (${filteredRows.length})"`,
      '""',
      totalPrevEnrolled,
      totalOnboarded,
      totalNewVisitors,
      totalNewlyEnrolled,
      totalVisitorToStudent,
      totalCurrentStudents,
      totalCurrentVisitors,
      totalActiveCensus
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

      {/* Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('WEEKLY_ENROLLMENT')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'WEEKLY_ENROLLMENT'
              ? 'bg-teal-900 text-amber-300 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Weekly Enrollment Collation</span>
        </button>

        <button
          onClick={() => setActiveTab('CONSISTENCY_CERTIFICATION')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'CONSISTENCY_CERTIFICATION'
              ? 'bg-teal-900 text-amber-300 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Consistency & Certification Review</span>
          {eligibleCandidates.filter(c => c.isEligible).length > 0 && (
            <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black">
              {eligibleCandidates.filter(c => c.isEligible).length} Eligible
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('AUDIT_TRAIL')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'AUDIT_TRAIL'
              ? 'bg-teal-900 text-amber-300 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Conversion Audit Trail</span>
          <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-[10px]">
            {allCertifications.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('DEPARTMENTAL_CENSUS')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'DEPARTMENTAL_CENSUS'
              ? 'bg-teal-900 text-amber-300 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Departmental Census Breakdown</span>
        </button>
      </div>

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

      {/* Primary KPI Highlights Card */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Previously Enrolled</span>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{totalPrevEnrolled}</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Students prior to W{selectedWeek}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Onboarded</span>
          <h3 className="text-xl sm:text-2xl font-black text-teal-700 mt-1">{totalOnboarded}</h3>
          <p className="text-[11px] text-teal-600 mt-0.5">Visitors in W{selectedWeek}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">New Visitors</span>
          <h3 className="text-xl sm:text-2xl font-black text-purple-700 mt-1">{totalNewVisitors}</h3>
          <p className="text-[11px] text-purple-600 mt-0.5">First-Time Visitors</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Newly Enrolled</span>
          <h3 className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">{totalNewlyEnrolled}</h3>
          <p className="text-[11px] text-emerald-600 mt-0.5">Became Students in W{selectedWeek}</p>
        </div>

        <div className="bg-amber-400 text-slate-950 p-4 rounded-2xl border border-amber-500 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider block text-slate-900">Visitor → Student</span>
          <h3 className="text-xl sm:text-2xl font-black mt-1 text-slate-950">{totalVisitorToStudent}</h3>
          <p className="text-[11px] font-bold text-slate-800 mt-0.5">Conversions in W{selectedWeek}</p>
        </div>

        <div className="bg-teal-950 text-white p-4 rounded-2xl border border-teal-800 shadow-xs">
          <span className="text-[10px] font-bold text-teal-300 uppercase tracking-wider block">Total Active Census</span>
          <h3 className="text-xl sm:text-2xl font-black text-amber-300 mt-1">{totalActiveCensus}</h3>
          <p className="text-[11px] text-teal-200 mt-0.5">Students + Visitors</p>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: WEEKLY ENROLLMENT TABLE (Standard Layout) */}
      {/* ========================================================= */}
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
                  Tracking the progression pipeline: Previously Enrolled Students, Onboarded, New Visitors, Newly Enrolled, and Visitor → Student conversions.
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
                    <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                      <th className="p-3.5 pl-4 border-b border-slate-800 text-center">Week</th>
                      <th className="p-3.5 border-b border-slate-800">Class & Department</th>
                      <th className="p-3.5 text-center border-b border-slate-800 bg-slate-800/80">Previously Enrolled Students</th>
                      <th className="p-3.5 text-center border-b border-slate-800 text-teal-300">Onboarded</th>
                      <th className="p-3.5 text-center border-b border-slate-800 text-purple-300">New Visitors</th>
                      <th className="p-3.5 text-center border-b border-slate-800 text-emerald-300">Newly Enrolled</th>
                      <th className="p-3.5 text-center border-b border-slate-800 bg-amber-400 text-slate-950 font-black">Visitor → Student</th>
                      <th className="p-3.5 pr-4 text-center border-b border-slate-800">Drill-Down / Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredRows.map((row, idx) => (
                      <tr key={row.classId || idx} className="hover:bg-teal-50/40 transition">
                        <td className="p-3.5 text-center font-black text-slate-500">
                          W{row.weekNumber}
                        </td>
                        <td className="p-3.5">
                          <div className="font-black text-slate-900 text-xs">{row.className}</div>
                          <div className="text-[10px] text-slate-400 font-semibold">{row.department}</div>
                        </td>
                        <td className="p-3.5 text-center font-bold text-slate-800 bg-slate-50/50">
                          {row.previouslyEnrolledStudents}
                        </td>
                        <td className="p-3.5 text-center font-bold text-teal-700">
                          {row.onboarded > 0 ? (
                            <span className="bg-teal-100 text-teal-800 px-2.5 py-1 rounded-full font-black">
                              +{row.onboarded}
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td className="p-3.5 text-center font-bold text-purple-700">
                          {row.newVisitors > 0 ? (
                            <span className="bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full font-black">
                              +{row.newVisitors}
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td className="p-3.5 text-center font-black text-emerald-700">
                          {row.newlyEnrolled > 0 ? (
                            <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-black">
                              {row.newlyEnrolled}
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td className="p-3.5 text-center font-black text-slate-950 bg-amber-50">
                          {row.visitorToStudent > 0 ? (
                            <button
                              onClick={() => setDrillDownRow(row)}
                              className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-3 py-1 rounded-full font-black text-xs shadow-xs transition inline-flex items-center gap-1 cursor-pointer"
                              title="Click to drill down on converted members"
                            >
                              <span>{row.visitorToStudent} Converted</span>
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-slate-400 font-semibold">0</span>
                          )}
                        </td>
                        <td className="p-3.5 pr-4 text-center">
                          <button
                            onClick={() => setDrillDownRow(row)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-teal-100 text-teal-900 rounded-lg font-bold text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Inspect Class</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Grand Totals Footer */}
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-700 text-xs">
                      <td className="p-4 text-center text-amber-300">W{selectedWeek}</td>
                      <td className="p-4 uppercase tracking-wider text-amber-300">
                        Grand Totals ({filteredRows.length} Classes)
                      </td>
                      <td className="p-4 text-center bg-slate-800 text-white font-black">
                        {totalPrevEnrolled}
                      </td>
                      <td className="p-4 text-center text-teal-300 font-black">
                        {totalOnboarded}
                      </td>
                      <td className="p-4 text-center text-purple-300 font-black">
                        {totalNewVisitors}
                      </td>
                      <td className="p-4 text-center text-emerald-300 font-black">
                        {totalNewlyEnrolled}
                      </td>
                      <td className="p-4 text-center bg-amber-400 text-slate-950 font-black text-sm">
                        {totalVisitorToStudent} Converted
                      </td>
                      <td className="p-4 pr-4 text-center text-slate-400 text-[10px]">
                        Pipeline Ratified
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
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-black uppercase">
                  <Award className="w-3.5 h-3.5" />
                  <span>Consistency Evaluation Engine</span>
                </div>
                <h2 className="text-lg font-black text-slate-900">
                  Visitor Consistency Tracking & Student Enrollment Candidates
                </h2>
                <p className="text-xs text-slate-500 max-w-2xl">
                  Evaluated strictly from real Class Register attendance marks. Visitors with 3+ consecutive visits or ≥75% attendance are qualified for certification into official Student status.
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

            {/* Candidates Table */}
            {eligibleCandidates.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="font-bold text-slate-700">No active visitors currently recorded across reporting classes.</p>
                <p className="text-slate-400">As class secretaries onboard visitors and record their attendance in the Class Register, candidates will appear here automatically.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] font-black uppercase">
                      <th className="p-3.5 pl-4">Visitor Name</th>
                      <th className="p-3.5">Class & Department</th>
                      <th className="p-3.5 text-center">First Lesson</th>
                      <th className="p-3.5 text-center">Consecutive Visits</th>
                      <th className="p-3.5 text-center">Attendance History</th>
                      <th className="p-3.5">Eligibility Status</th>
                      <th className="p-3.5 pr-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {eligibleCandidates.map((cand, idx) => (
                      <tr key={cand.member.id || idx} className="hover:bg-slate-50 transition">
                        <td className="p-3.5 pl-4">
                          <div className="font-black text-slate-900 text-xs">{cand.member.fullName}</div>
                          <div className="text-[10px] text-slate-400">{cand.member.phone || 'No phone'} • {cand.member.occupation || 'N/A'}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-800">{cand.className}</div>
                          <div className="text-[10px] text-slate-400">{cand.department}</div>
                        </td>
                        <td className="p-3.5 text-center font-bold text-slate-600">
                          Week {cand.firstLessonWeek}
                        </td>
                        <td className="p-3.5 text-center font-black">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                            cand.consecutiveVisits >= 3
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {cand.consecutiveVisits} Consecutive
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {cand.attendedWeeks.map(w => (
                              <span key={w} className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[9px] flex items-center justify-center">
                                W{w}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3.5">
                          {cand.isEligible ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-900 rounded-full font-black text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Eligible for Student Enrollment</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full font-bold text-[11px]">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{cand.eligibilityReason}</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 pr-4 text-right">
                          <button
                            onClick={() => setSelectedCandidateForCert(cand)}
                            className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-700 text-white rounded-xl font-bold text-xs transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Award className="w-3.5 h-3.5 text-amber-300" />
                            <span>Certify & Enroll</span>
                          </button>
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
              
              {/* Quick Summary Chips */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-center">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Current Students</span>
                  <span className="text-base font-black text-teal-800">{drillDownRow.currentStudentCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Current Visitors</span>
                  <span className="text-base font-black text-purple-800">{drillDownRow.currentVisitorCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Class Members</span>
                  <span className="text-base font-black text-slate-900">{drillDownRow.totalActiveClassMembers}</span>
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
                    <tr className="bg-slate-200 text-slate-900 font-black text-[10px] uppercase border-b border-slate-400">
                      <th className="p-2 border-r border-slate-400 text-center">Week</th>
                      <th className="p-2 border-r border-slate-400">Class & Department</th>
                      <th className="p-2 border-r border-slate-400 text-center">Previously Enrolled</th>
                      <th className="p-2 border-r border-slate-400 text-center">Onboarded</th>
                      <th className="p-2 border-r border-slate-400 text-center">New Visitors</th>
                      <th className="p-2 border-r border-slate-400 text-center">Newly Enrolled</th>
                      <th className="p-2 text-center bg-slate-300 font-black">Visitor → Student</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {filteredRows.map((r, idx) => (
                      <tr key={idx}>
                        <td className="p-2 border-r border-slate-300 text-center font-bold">W{r.weekNumber}</td>
                        <td className="p-2 border-r border-slate-300 font-bold">{r.className} ({r.department})</td>
                        <td className="p-2 border-r border-slate-300 text-center">{r.previouslyEnrolledStudents}</td>
                        <td className="p-2 border-r border-slate-300 text-center">{r.onboarded}</td>
                        <td className="p-2 border-r border-slate-300 text-center">{r.newVisitors}</td>
                        <td className="p-2 border-r border-slate-300 text-center">{r.newlyEnrolled}</td>
                        <td className="p-2 text-center font-black bg-slate-100">{r.visitorToStudent}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-200 font-black text-xs border-t-2 border-slate-900">
                      <td className="p-2.5 text-center border-r border-slate-400">W{selectedWeek}</td>
                      <td className="p-2.5 border-r border-slate-400 uppercase">Grand Totals</td>
                      <td className="p-2.5 border-r border-slate-400 text-center">{totalPrevEnrolled}</td>
                      <td className="p-2.5 border-r border-slate-400 text-center">{totalOnboarded}</td>
                      <td className="p-2.5 border-r border-slate-400 text-center">{totalNewVisitors}</td>
                      <td className="p-2.5 border-r border-slate-400 text-center">{totalNewlyEnrolled}</td>
                      <td className="p-2.5 text-center bg-slate-300 font-black text-sm">{totalVisitorToStudent} Converted</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="pt-10 grid grid-cols-2 gap-12 text-xs border-t border-slate-300">
                <div className="space-y-8">
                  <p className="font-bold">Compiled by (Enrollment Officer):</p>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="font-bold text-slate-800">{currentAdmin.profileName}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Signature & Date</span>
                </div>

                <div className="space-y-8">
                  <p className="font-bold">Ratified by (General Superintendent):</p>
                  <div className="border-b border-slate-400 pb-1">
                    <span className="font-bold text-slate-800">Pastor (Dr.) E.O. Abina</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Signature & Date</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
