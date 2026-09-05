import React, { useState, useEffect, useMemo } from 'react';
import {
  Coins,
  TrendingUp,
  Calendar,
  Download,
  Printer,
  CheckCircle2,
  Building,
  Filter,
  Search,
  FileSpreadsheet,
  PieChart,
  ShieldCheck,
  PlusCircle,
  Trash2,
  DollarSign,
  AlertCircle,
  Clock,
  CheckCheck,
  Receipt,
  FileCheck,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { AdminProfile, ClassProfile, QuarterNumber, SundaySchoolYear, TreasuryExpenditure, WeeklyOfferingRecord } from '../../types';
import {
  getRealTreasurySummary,
  saveTreasuryExpenditure,
  deleteTreasuryExpenditure,
  getAllOfferings,
  auditOfferingRecord,
  bulkAuditOfferings
} from '../../db/indexedDB';

interface TreasurerViewProps {
  currentAdmin: AdminProfile;
  allClasses?: ClassProfile[];
  sundaySchoolYear?: SundaySchoolYear;
}

type TreasurerTab = 
  | 'PENDING_AUDIT'
  | 'WEEKLY_AUDIT'
  | 'QUARTERLY_MATRIX'
  | 'EXPENDITURES'
  | 'AUDITED_TRAIL';

export const TreasurerView: React.FC<TreasurerViewProps> = ({
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
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterNumber>(
    safeYear.activeQuarterNumber || 1
  );
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<TreasurerTab>('PENDING_AUDIT');
  
  // Real treasury data state
  const [treasurySummary, setTreasurySummary] = useState<{
    totalRecorded: number;
    pendingRemittance: number;
    pendingAudit: number;
    cumulativeAuditedIncome: number;
    totalIncome: number;
    totalExpenditure: number;
    netIncome: number;
    netBalance: number;
    classOfferingsBreakdown: any[];
    pendingRemittancesList: any[];
    auditedOfferingsList: any[];
    expenditures: TreasuryExpenditure[];
  }>({
    totalRecorded: 0,
    pendingRemittance: 0,
    pendingAudit: 0,
    cumulativeAuditedIncome: 0,
    totalIncome: 0,
    totalExpenditure: 0,
    netIncome: 0,
    netBalance: 0,
    classOfferingsBreakdown: [],
    pendingRemittancesList: [],
    auditedOfferingsList: [],
    expenditures: []
  });

  const [allRawOfferings, setAllRawOfferings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Expense modal state
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<TreasuryExpenditure['category']>('LESSON_MATERIALS');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Audit Single Modal state
  const [auditTarget, setAuditTarget] = useState<any | null>(null);
  const [verifiedAmount, setVerifiedAmount] = useState<string>('');
  const [auditNotes, setAuditNotes] = useState<string>('');
  const [isAuditing, setIsAuditing] = useState(false);

  const activeQuarterData = (safeYear.quarters || []).find(q => q.quarterNumber === selectedQuarter) || safeYear.quarters?.[0] || { totalLessonWeeks: 12 };
  const totalWeeks = activeQuarterData?.totalLessonWeeks || 12;

  // Load real financial data from database
  const loadTreasuryData = async () => {
    setIsLoading(true);
    try {
      const summary = await getRealTreasurySummary(selectedQuarter);
      const rawOfferings = await getAllOfferings();
      setTreasurySummary(summary);
      setAllRawOfferings(rawOfferings);
    } catch (err) {
      console.error('Error loading treasury summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTreasuryData();
  }, [selectedQuarter]);

  // Aggregate selected week offerings for each class
  const currentWeekOfferings = allClasses.map((cls) => {
    const classWeekOffering = allRawOfferings.find(
      o => (o.classId === cls.id || (!o.classId && cls.id === 'default_class')) &&
           o.weekNumber === selectedWeek &&
           (o.quarterNumber === undefined || o.quarterNumber === selectedQuarter)
    );

    const prevWeekOffering = allRawOfferings.find(
      o => (o.classId === cls.id || (!o.classId && cls.id === 'default_class')) &&
           o.weekNumber === Math.max(1, selectedWeek - 1) &&
           (o.quarterNumber === undefined || o.quarterNumber === selectedQuarter)
    );

    const amount = Number(classWeekOffering?.amount) || 0;
    const auditedAmount = Number(classWeekOffering?.auditedAmount) || amount;
    const prevAmount = Number(prevWeekOffering?.amount) || 0;
    const growth = prevAmount > 0 ? Math.round(((amount - prevAmount) / prevAmount) * 100) : 0;
    const status = classWeekOffering?.remittanceStatus || (amount > 0 ? 'PENDING_REMITTANCE' : 'UNRECORDED');

    return {
      offeringId: classWeekOffering?.id,
      classId: cls.id,
      className: cls.className,
      department: cls.department,
      secretaryName: cls.secretaryName,
      treasuryOfficer: cls.teachers?.[0]?.name || cls.secretaryName || 'Class Secretary',
      amount,
      auditedAmount,
      auditedBy: classWeekOffering?.auditedBy,
      auditedAt: classWeekOffering?.auditedAt,
      remittedBy: classWeekOffering?.remittedBy,
      remittedAt: classWeekOffering?.remittedAt,
      growth,
      isNoRecordWeek: classWeekOffering?.isNoRecordWeek || false,
      status
    };
  });

  const weekTotal = currentWeekOfferings.reduce((sum, item) => sum + (item.status === 'AUDITED' ? item.auditedAmount : item.amount), 0);
  const weekAuditedTotal = currentWeekOfferings.reduce((sum, item) => sum + (item.status === 'AUDITED' ? item.auditedAmount : 0), 0);

  // Single Audit Handler
  const handleOpenAuditModal = (item: any) => {
    setAuditTarget(item);
    setVerifiedAmount(item.amount?.toString() || '0');
    setAuditNotes('');
  };

  const handleConfirmAudit = async () => {
    if (!auditTarget) return;
    const numAmt = parseFloat(verifiedAmount);
    if (isNaN(numAmt) || numAmt < 0) return;

    setIsAuditing(true);
    try {
      const classId = auditTarget.classId;
      const qNum = auditTarget.quarterNumber || selectedQuarter;
      const wNum = auditTarget.weekNumber || selectedWeek;

      await auditOfferingRecord(
        classId,
        qNum,
        wNum,
        currentAdmin.fullName || currentAdmin.profileName,
        numAmt
      );

      setFeedback(`Verified and audited ₦${numAmt.toLocaleString()} for ${auditTarget.className || 'Class'} (Week ${wNum}).`);
      setTimeout(() => setFeedback(null), 4000);
      setAuditTarget(null);
      await loadTreasuryData();
    } catch (err) {
      console.error('Failed to audit offering:', err);
    } finally {
      setIsAuditing(false);
    }
  };

  // Bulk Audit All Pending Remittances
  const handleBulkAuditAll = async () => {
    if (treasurySummary.pendingRemittancesList.length === 0) return;
    const confirmAudit = window.confirm(
      `Confirm physical receipt and audit of all ${treasurySummary.pendingRemittancesList.length} pending remittances (Total: ₦${treasurySummary.pendingAudit.toLocaleString()})?`
    );
    if (!confirmAudit) return;

    setIsAuditing(true);
    try {
      const items = treasurySummary.pendingRemittancesList.map(r => ({
        classId: r.classId,
        quarterNumber: r.quarterNumber || selectedQuarter,
        weekNumber: r.weekNumber,
        auditedAmount: r.amount
      }));

      const auditedList = await bulkAuditOfferings(
        items,
        currentAdmin.fullName || currentAdmin.profileName
      );

      setFeedback(`Successfully audited all ${auditedList.length} remittances.`);
      setTimeout(() => setFeedback(null), 4000);
      await loadTreasuryData();
    } catch (err) {
      console.error('Failed to bulk audit:', err);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseFloat(expenseAmount);
    if (!expenseTitle.trim() || isNaN(numAmt) || numAmt <= 0) return;

    setIsSubmittingExpense(true);
    try {
      const newExp: TreasuryExpenditure = {
        id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: expenseTitle.trim(),
        amount: numAmt,
        category: expenseCategory,
        date: new Date().toISOString().split('T')[0],
        authorizedBy: currentAdmin.fullName || currentAdmin.profileName,
        notes: expenseNotes.trim() || undefined,
        createdAt: new Date().toISOString()
      };

      await saveTreasuryExpenditure(newExp);
      await loadTreasuryData();
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseNotes('');
      setShowAddExpenseModal(false);
      setFeedback(`Expense "₦${numAmt.toLocaleString()} - ${newExp.title}" recorded successfully.`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error('Failed to save expenditure:', err);
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteTreasuryExpenditure(id);
      await loadTreasuryData();
      setFeedback('Expenditure entry removed.');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error('Failed to delete expenditure:', err);
    }
  };

  const handleExportFinancialCSV = () => {
    const headers = ['Class Name', 'Department', 'Secretary', 'Recorded Offering (NGN)', 'Audited Amount (NGN)', 'Remittance Status', 'Audited By', 'Audited At'];
    const rows = currentWeekOfferings.map(c => [
      `"${c.className}"`,
      `"${c.department}"`,
      `"${c.secretaryName}"`,
      c.amount,
      c.status === 'AUDITED' ? c.auditedAmount : '',
      c.status,
      `"${c.auditedBy || ''}"`,
      `"${c.auditedAt || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GOFAMINT_HOF_Treasury_Audit_Week_${selectedWeek}_Q${selectedQuarter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-emerald-400/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-400/20 border border-emerald-400/50 rounded-full text-xs font-black text-emerald-300 uppercase tracking-wider">
              <Coins className="w-3.5 h-3.5" />
              <span>Treasurer Directorate • Certified Audit Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Cinzel',serif] tracking-wide text-white">
              Sunday School Treasury & Financial Collation
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl leading-relaxed">
              Treasurer: <strong>{currentAdmin.profileName}</strong> ({currentAdmin.username}) • Auditing class remittances with two-step verification, logging authorized disbursements, and computing verified net income in Nigerian Naira (₦).
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 shadow-xs transition shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Record Expense</span>
            </button>
            {treasurySummary.pendingRemittancesList.length > 0 && (
              <button
                onClick={handleBulkAuditAll}
                disabled={isAuditing}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-xs transition shrink-0 disabled:opacity-50"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Audit All ({treasurySummary.pendingRemittancesList.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-400 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Quarter Selection Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-900" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-700">
            Select Financial Quarter:
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          {([1, 2, 3, 4] as QuarterNumber[]).map((qNum) => {
            const isSelected = selectedQuarter === qNum;
            const isActive = sundaySchoolYear.activeQuarterNumber === qNum;
            return (
              <button
                key={qNum}
                onClick={() => setSelectedQuarter(qNum)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-emerald-900 text-white font-black shadow-xs ring-2 ring-emerald-900/30'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>Quarter {qNum}</span>
                {isActive && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
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

      {/* 5 High-Impact Financial KPIs (Real Live Aggregations) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* 1. Total Recorded (Informational) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">1. Total Recorded</span>
          <h3 className="text-xl font-black text-slate-800 mt-1">₦{treasurySummary.totalRecorded.toLocaleString()}</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">All class entries</p>
        </div>

        {/* 2. Pending Remittance */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-amber-700 uppercase block">2. Pending Remit</span>
          <h3 className="text-xl font-black text-amber-900 mt-1">₦{treasurySummary.pendingRemittance.toLocaleString()}</h3>
          <p className="text-[10px] text-amber-600 mt-0.5 font-semibold">Unsubmitted in registers</p>
        </div>

        {/* 3. Pending Audit */}
        <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-blue-50/40 shadow-xs">
          <span className="text-[10px] font-bold text-blue-900 uppercase block">3. Pending Audit</span>
          <h3 className="text-xl font-black text-blue-950 mt-1">₦{treasurySummary.pendingAudit.toLocaleString()}</h3>
          <p className="text-[10px] text-blue-700 mt-0.5 font-bold">{treasurySummary.pendingRemittancesList.length} classes awaiting count</p>
        </div>

        {/* 4. Cumulative Audited Income */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-300 bg-emerald-50/40 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-900 uppercase block">4. Audited Income</span>
          <h3 className="text-xl font-black text-emerald-950 mt-1">₦{treasurySummary.cumulativeAuditedIncome.toLocaleString()}</h3>
          <p className="text-[10px] text-emerald-700 mt-0.5 font-bold">Verified cash in hand</p>
        </div>

        {/* 5. Total Expenditures */}
        <div className="bg-white p-4 rounded-2xl border border-red-200 shadow-xs">
          <span className="text-[10px] font-bold text-red-700 uppercase block">5. Total Expenses</span>
          <h3 className="text-xl font-black text-red-700 mt-1">₦{treasurySummary.totalExpenditure.toLocaleString()}</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">{treasurySummary.expenditures.length} disbursements</p>
        </div>

        {/* 6. Net Treasury Income */}
        <div className="bg-white p-4 rounded-2xl border-2 border-emerald-500 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-900 uppercase block">6. Net Income</span>
          <h3 className={`text-xl font-black mt-1 ${treasurySummary.netIncome >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            ₦{treasurySummary.netIncome.toLocaleString()}
          </h3>
          <p className="text-[10px] text-emerald-700 font-bold mt-0.5">Audited - Expenses</p>
        </div>

      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('PENDING_AUDIT')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
            activeTab === 'PENDING_AUDIT'
              ? 'bg-emerald-900 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Pending Remittances Queue ({treasurySummary.pendingRemittancesList.length})</span>
          {treasurySummary.pendingRemittancesList.length > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full text-[10px] font-black">
              {treasurySummary.pendingRemittancesList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('WEEKLY_AUDIT')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
            activeTab === 'WEEKLY_AUDIT'
              ? 'bg-emerald-900 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Week {selectedWeek} Offering Collation</span>
        </button>

        <button
          onClick={() => setActiveTab('QUARTERLY_MATRIX')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
            activeTab === 'QUARTERLY_MATRIX'
              ? 'bg-emerald-900 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>12-Week Matrix (Weeks 1-{totalWeeks})</span>
        </button>

        <button
          onClick={() => setActiveTab('EXPENDITURES')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
            activeTab === 'EXPENDITURES'
              ? 'bg-emerald-900 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Expenditures & Disbursements ({treasurySummary.expenditures.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('AUDITED_TRAIL')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
            activeTab === 'AUDITED_TRAIL'
              ? 'bg-emerald-900 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>Audited Ledger Trail ({treasurySummary.auditedOfferingsList.length})</span>
        </button>
      </div>

      {/* Tab 1: Pending Remittances Queue */}
      {activeTab === 'PENDING_AUDIT' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                Remittance Verification Queue (Awaiting Treasurer Physical Count)
              </h3>
              <p className="text-xs text-slate-500">
                Classes that have submitted their weekly offering collections. Click "Audit & Accept" after counting cash.
              </p>
            </div>

            {treasurySummary.pendingRemittancesList.length > 0 && (
              <button
                onClick={handleBulkAuditAll}
                disabled={isAuditing}
                className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <CheckCheck className="w-3.5 h-3.5 text-amber-300" />
                <span>Audit All ({treasurySummary.pendingRemittancesList.length})</span>
              </button>
            )}
          </div>

          {treasurySummary.pendingRemittancesList.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm font-bold text-slate-700">All Submitted Remittances Are Audited</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                There are no outstanding remittances awaiting audit for Quarter {selectedQuarter}. New submissions from class secretaries will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Class Name</th>
                    <th className="px-3 py-3">Department</th>
                    <th className="px-3 py-3 text-center">Week</th>
                    <th className="px-3 py-3">Remitted By / Time</th>
                    <th className="px-3 py-3 text-right">Recorded Amount</th>
                    <th className="px-4 py-3 text-center">Audit Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {treasurySummary.pendingRemittancesList.map((row) => (
                    <tr key={row.id} className="hover:bg-blue-50/40 transition">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {row.className}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[10px] text-blue-900 bg-blue-50 px-2 py-0.5 rounded font-bold">
                          {row.department}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-slate-800">
                        Week {row.weekNumber}
                      </td>
                      <td className="px-3 py-3 text-slate-600 text-[11px]">
                        <div>{row.remittedBy || row.secretaryName || 'Class Secretary'}</div>
                        <span className="text-[10px] text-slate-400">
                          {row.remittedAt ? new Date(row.remittedAt).toLocaleString() : 'Recently'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-black text-emerald-900 text-sm">
                        ₦{(row.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleOpenAuditModal(row)}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                          <span>Audit & Accept</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Weekly Audit & Collation */}
      {activeTab === 'WEEKLY_AUDIT' && (
        <div className="space-y-4">
          {/* Week Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-900" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Select Financial Week (Quarter {selectedQuarter}):
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => {
                const isSelected = selectedWeek === w;
                return (
                  <button
                    key={w}
                    onClick={() => setSelectedWeek(w)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 ${
                      isSelected
                        ? 'bg-emerald-900 text-white font-black shadow-xs ring-2 ring-emerald-900/30'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>Week {w}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                  Weekly Sunday School Class Remittance Audit (Week {selectedWeek})
                </h3>
                <p className="text-xs text-slate-500">
                  Verified collections entered by class teachers and secretaries in the official register.
                </p>
              </div>

              <button
                onClick={handleExportFinancialCSV}
                className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Week {selectedWeek} CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Class Name</th>
                    <th className="px-3 py-3">Department</th>
                    <th className="px-3 py-3">Secretary / Teachers</th>
                    <th className="px-3 py-3 text-right">Recorded Offering</th>
                    <th className="px-3 py-3 text-right">Audited (Verified)</th>
                    <th className="px-4 py-3 text-center">Status / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentWeekOfferings.map((row) => (
                    <tr key={row.classId} className="hover:bg-emerald-50/40 transition">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {row.className}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                          {row.department}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {row.secretaryName}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-slate-900 text-sm">
                        {row.isNoRecordWeek ? (
                          <span className="text-amber-600 text-xs">No Record Week</span>
                        ) : (
                          `₦${row.amount.toLocaleString()}`
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-emerald-900 text-sm">
                        {row.status === 'AUDITED' ? (
                          `₦${row.auditedAmount.toLocaleString()}`
                        ) : (
                          <span className="text-slate-400 text-xs font-normal">Pending Audit</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.status === 'AUDITED' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Audited by {row.auditedBy || 'Treasurer'}</span>
                          </span>
                        ) : row.status === 'REMITTED' ? (
                          <button
                            onClick={() => handleOpenAuditModal(row)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold flex items-center gap-1 mx-auto"
                          >
                            <ShieldCheck className="w-3 h-3 text-amber-300" />
                            <span>Audit Now</span>
                          </button>
                        ) : row.amount > 0 ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            Pending Remittance
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Unrecorded</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-50 font-black text-emerald-950 text-xs border-t-2 border-emerald-300">
                  <tr>
                    <td className="px-4 py-3" colSpan={3}>
                      TOTAL SUNDAY SCHOOL OFFERING (WEEK {selectedWeek}):
                    </td>
                    <td className="px-3 py-3 text-right text-sm text-slate-900">
                      ₦{weekTotal.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right text-base text-emerald-950">
                      ₦{weekAuditedTotal.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {currentWeekOfferings.filter(c => c.status === 'AUDITED').length} of {allClasses.length} Classes Audited
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Quarterly Matrix */}
      {activeTab === 'QUARTERLY_MATRIX' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs overflow-hidden">
          <div>
            <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
              Quarter {selectedQuarter} Real Weekly Financial Matrix (₦)
            </h3>
            <p className="text-xs text-slate-500">
              Live weekly offering totals collated across all class registers.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-800 font-black text-[10px] uppercase">
                <tr>
                  <th className="p-2 border-r border-slate-200">Class Name</th>
                  {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => (
                    <th key={w} className="p-2 text-center border-r border-slate-200">W{w}</th>
                  ))}
                  <th className="p-2 text-right">Class Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allClasses.map((cls) => {
                  let classSum = 0;
                  return (
                    <tr key={cls.id}>
                      <td className="p-2 font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {cls.className}
                      </td>
                      {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => {
                        const offering = allRawOfferings.find(
                          o => (o.classId === cls.id || (!o.classId && cls.id === 'default_class')) &&
                               o.weekNumber === w &&
                               (o.quarterNumber === undefined || o.quarterNumber === selectedQuarter)
                        );
                        const amt = offering?.remittanceStatus === 'AUDITED' ? (offering.auditedAmount || offering.amount) : (offering?.amount || 0);
                        classSum += amt;
                        return (
                          <td key={w} className="p-2 text-center border-r border-slate-200 text-[11px]">
                            {amt > 0 ? (
                              <span className={offering?.remittanceStatus === 'AUDITED' ? 'font-bold text-emerald-900' : 'text-slate-600'}>
                                {amt.toLocaleString()}
                              </span>
                            ) : '-'}
                          </td>
                        );
                      })}
                      <td className="p-2 text-right font-black text-emerald-900 whitespace-nowrap">
                        ₦{classSum.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Expenditures */}
      {activeTab === 'EXPENDITURES' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                Sunday School Department Expenditures & Disbursements
              </h3>
              <p className="text-xs text-slate-500">
                Manual purchases, awards, teaching aids, and refreshments deducted from offering collections.
              </p>
            </div>

            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <PlusCircle className="w-4 h-4 text-amber-300" />
              <span>+ Record Expense</span>
            </button>
          </div>

          {treasurySummary.expenditures.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs">
              No expenditures recorded for Quarter {selectedQuarter} yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Expense Title / Purpose</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Authorized By</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {treasurySummary.expenditures.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <div>{exp.title}</div>
                        {exp.notes && <div className="text-[10px] text-slate-500 font-normal">{exp.notes}</div>}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {exp.date}
                      </td>
                      <td className="px-3 py-3 text-slate-700 font-medium">
                        {exp.authorizedBy}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-red-700 text-sm">
                        ₦{exp.amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded transition"
                          title="Delete Expenditure"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-red-50 font-black text-red-950 text-xs border-t-2 border-red-200">
                  <tr>
                    <td className="px-4 py-3" colSpan={4}>
                      TOTAL EXPENDITURES (QUARTER {selectedQuarter}):
                    </td>
                    <td className="px-3 py-3 text-right text-base text-red-700">
                      ₦{treasurySummary.totalExpenditure.toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Audited Ledger Trail */}
      {activeTab === 'AUDITED_TRAIL' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
              Permanent Audited Offering Ledger Trail
            </h3>
            <p className="text-xs text-slate-500">
              Complete historical record of physically verified offerings ratified by the Treasurer Directorate.
            </p>
          </div>

          {treasurySummary.auditedOfferingsList.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              No audited offering records logged yet for Quarter {selectedQuarter}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-3 py-3">Department</th>
                    <th className="px-3 py-3 text-center">Week</th>
                    <th className="px-3 py-3 text-right">Audited Amount</th>
                    <th className="px-3 py-3">Auditor</th>
                    <th className="px-4 py-3">Audit Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {treasurySummary.auditedOfferingsList.map((item) => (
                    <tr key={item.id} className="hover:bg-emerald-50/30">
                      <td className="px-4 py-3 font-bold text-slate-900">{item.className}</td>
                      <td className="px-3 py-3 text-slate-600">{item.department}</td>
                      <td className="px-3 py-3 text-center font-bold text-slate-800">Week {item.weekNumber}</td>
                      <td className="px-3 py-3 text-right font-black text-emerald-900 text-sm">
                        ₦{(item.auditedAmount || item.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-800">{item.auditedBy || 'Treasurer'}</td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {item.auditedAt ? new Date(item.auditedAt).toLocaleString() : 'Verified'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                Record Directorate Expenditure
              </h3>
              <button
                onClick={() => setShowAddExpenseModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Expense Title / Purpose</label>
                <input
                  type="text"
                  required
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  placeholder="e.g., Lesson Material Photocopying / Awards"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Amount (₦ NGN)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="100"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="5000"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-900 font-black text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Expense Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-900 font-bold"
                >
                  <option value="LESSON_MATERIALS">Lesson Materials & Manuals</option>
                  <option value="AWARDS_AND_PRIZES">Awards & Prizes</option>
                  <option value="WELFARE_BENEVOLENCE">Welfare & Benevolence</option>
                  <option value="REFRESHMENTS">Refreshments & Logistics</option>
                  <option value="ADMIN_PRINTING">Admin Printing & Stationery</option>
                  <option value="OTHER">Other Disbursement</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Additional Notes (Optional)</label>
                <textarea
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  rows={2}
                  placeholder="Receipt number or details..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="px-4 py-2 bg-emerald-900 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {isSubmittingExpense ? 'Saving...' : 'Record Disbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Audit Modal */}
      {auditTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                  Audit Physical Remittance
                </h3>
              </div>
              <button
                onClick={() => setAuditTarget(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-blue-50/80 border border-blue-200/60 p-3.5 rounded-xl text-xs space-y-1.5 text-blue-950 font-medium">
              <div className="text-blue-950"><strong className="font-bold text-blue-900">Class:</strong> {auditTarget.className} ({auditTarget.department})</div>
              <div className="text-blue-950"><strong className="font-bold text-blue-900">Week:</strong> Week {auditTarget.weekNumber || selectedWeek} (Quarter {selectedQuarter})</div>
              <div className="text-blue-950"><strong className="font-bold text-blue-900">Recorded by Secretary:</strong> ₦{(auditTarget.amount || 0).toLocaleString()}</div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Physically Counted & Verified Amount (₦ NGN)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={verifiedAmount}
                  onChange={(e) => setVerifiedAmount(e.target.value)}
                  className="w-full text-sm font-black p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-900 text-emerald-950 bg-white"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Adjust if physical cash envelope differed from recorded amount.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Audit Notes (Optional)</label>
                <input
                  type="text"
                  value={auditNotes}
                  onChange={(e) => setAuditNotes(e.target.value)}
                  placeholder="e.g., Envelope verified and sealed by Treasurer"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAuditTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAudit}
                disabled={isAuditing}
                className="px-4 py-2 bg-emerald-900 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-300" />
                <span>{isAuditing ? 'Auditing...' : 'Confirm Audit & Accept'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
