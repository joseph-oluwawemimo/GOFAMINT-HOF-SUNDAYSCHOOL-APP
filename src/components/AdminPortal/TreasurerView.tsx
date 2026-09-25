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
  ArrowUpRight,
  MoreVertical,
  Mail,
  ArrowDownRight,
  Sparkles,
  Activity
} from 'lucide-react';
import { AdminProfile, ClassProfile, QuarterNumber, SundaySchoolYear, TreasuryExpenditure, WeeklyOfferingRecord } from '../../types';
import {
  getRealTreasurySummary,
  saveTreasuryExpenditure,
  deleteTreasuryExpenditure,
  getAllOfferings,
  saveOffering,
  moveOfferingToChildrenAccount,
  auditOfferingRecord,
  bulkAuditOfferings
} from '../../db/indexedDB';
import { useDatabaseSync } from '../../hooks/useDatabaseSync';
import { isSundayRegisterOpenForWeek } from '../../utils/quarterScheduleUtils';

interface TreasurerViewProps {
  currentAdmin: AdminProfile;
  allClasses?: ClassProfile[];
  sundaySchoolYear?: SundaySchoolYear;
  activeTab?: TreasurerTab;
  onTabChange?: (tab: TreasurerTab) => void;
}

type TreasurerTab = 
  | 'OVERVIEW'
  | 'PENDING_AUDIT'
  | 'WEEKLY_AUDIT'
  | 'QUARTERLY_MATRIX'
  | 'EXPENDITURES'
  | 'AUDITED_TRAIL'
  | 'CHILDREN_ACCOUNT';

export const TreasurerView: React.FC<TreasurerViewProps> = ({
  currentAdmin,
  allClasses = [],
  sundaySchoolYear,
  activeTab: controlledActiveTab,
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
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterNumber>(
    safeYear.activeQuarterNumber || 1
  );
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [internalActiveTab, setInternalActiveTab] = useState<TreasurerTab>('OVERVIEW');
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const setActiveTab = (tab: TreasurerTab) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };
  
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
    childrenAccount?: {
      auditedIncome: number;
      totalExpenditure: number;
      netBalance: number;
      inflows: any[];
      expenditures: TreasuryExpenditure[];
    };
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
  const [expenseAccountType, setExpenseAccountType] = useState<'SUNDAY_SCHOOL' | 'CHILDREN'>('SUNDAY_SCHOOL');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Children Inflow modal state
  const [showAddChildrenInflowModal, setShowAddChildrenInflowModal] = useState(false);
  const [childrenInflowAmount, setChildrenInflowAmount] = useState('');
  const [childrenInflowSource, setChildrenInflowSource] = useState('');
  const [childrenInflowNotes, setChildrenInflowNotes] = useState('');
  const [isSubmittingChildrenInflow, setIsSubmittingChildrenInflow] = useState(false);

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

  useDatabaseSync(loadTreasuryData, ['offerings', 'treasuryExpenditures']);

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

  // "doit" Dashboard Presentation States
  const [balanceGraphMode, setBalanceGraphMode] = useState<'NET_VS_EXPENSES' | 'RECORD_VS_AUDIT'>('NET_VS_EXPENSES');
  const [activeChartWeek, setActiveChartWeek] = useState<number>(selectedWeek);
  const [txFilter, setTxFilter] = useState<'ALL' | 'TODAY'>('ALL');

  useEffect(() => {
    setActiveChartWeek(selectedWeek);
  }, [selectedWeek]);

  // Format compact numbers
  const formatCompact = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${Math.round(num / 1000)}k`;
    return `${num}`;
  };

  // 12-Week Trends for Balance Summary Chart
  const weeklyTrends = useMemo(() => {
    return Array.from({ length: totalWeeks }, (_, i) => {
      const w = i + 1;
      const offeringsForWeek = allRawOfferings.filter(
        o => o.weekNumber === w && (o.quarterNumber === undefined || o.quarterNumber === selectedQuarter)
      );
      const recorded = offeringsForWeek.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
      const audited = offeringsForWeek.reduce(
        (sum, o) => sum + (o.remittanceStatus === 'AUDITED' ? (Number(o.auditedAmount) || Number(o.amount) || 0) : 0),
        0
      );

      const expForWeek = treasurySummary.expenditures.filter(exp => {
        if (!exp.date) return false;
        const lower = `${exp.title} ${exp.notes || ''}`.toLowerCase();
        return lower.includes(`wk ${w}`) || lower.includes(`week ${w}`) || lower.includes(`w${w}`);
      }).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      const distributedExp = expForWeek > 0 
        ? expForWeek 
        : (treasurySummary.totalExpenditure > 0 && w <= Math.max(1, selectedWeek) 
            ? Math.round(treasurySummary.totalExpenditure / Math.max(1, selectedWeek)) 
            : 0);

      const netIncome = Math.max(0, audited - distributedExp);

      return {
        week: w,
        recorded,
        audited,
        expenses: distributedExp,
        netIncome
      };
    });
  }, [totalWeeks, allRawOfferings, selectedQuarter, treasurySummary.expenditures, treasurySummary.totalExpenditure, selectedWeek]);

  // Department Distribution for Donut Chart
  const departmentDistribution = useMemo(() => {
    const counts = {
      Adult: 0,
      Youth: 0,
      Teens: 0,
      Children: 0
    };

    currentWeekOfferings.forEach(item => {
      const d = String(item.department || '').toLowerCase();
      const amt = item.status === 'AUDITED' ? item.auditedAmount : item.amount;
      if (d.includes('child')) counts.Children += amt;
      else if (d.includes('teen')) counts.Teens += amt;
      else if (d.includes('youth')) counts.Youth += amt;
      else counts.Adult += amt;
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) {
      allRawOfferings
        .filter(o => o.quarterNumber === selectedQuarter || o.quarterNumber === undefined)
        .forEach(o => {
          const cls = allClasses.find(c => c.id === o.classId);
          const d = String(cls?.department || '').toLowerCase();
          const amt = o.remittanceStatus === 'AUDITED' ? (Number(o.auditedAmount) || Number(o.amount) || 0) : (Number(o.amount) || 0);
          if (d.includes('child')) counts.Children += amt;
          else if (d.includes('teen')) counts.Teens += amt;
          else if (d.includes('youth')) counts.Youth += amt;
          else counts.Adult += amt;
        });
    }

    const calcTotal = Math.max(1, Object.values(counts).reduce((a, b) => a + b, 0));
    return {
      Adult: { amount: counts.Adult, pct: Math.round((counts.Adult / calcTotal) * 100), color: '#10b981' },
      Youth: { amount: counts.Youth, pct: Math.round((counts.Youth / calcTotal) * 100), color: '#2563eb' },
      Teens: { amount: counts.Teens, pct: Math.round((counts.Teens / calcTotal) * 100), color: '#f43f5e' },
      Children: { amount: counts.Children, pct: Math.round((counts.Children / calcTotal) * 100), color: '#f59e0b' },
      total: calcTotal
    };
  }, [currentWeekOfferings, allRawOfferings, selectedQuarter, allClasses]);

  // Priority audit ranking: classes sorted by most critical to audit (highest pending count, highest pending amount)
  const classesWithAuditStats = useMemo(() => {
    return allClasses.map((cls) => {
      const pendingOfferings = allRawOfferings.filter(
        o => (o.classId === cls.id || (!o.classId && cls.id === 'default_class')) &&
             (o.quarterNumber === undefined || o.quarterNumber === selectedQuarter) &&
             Number(o.amount) > 0 &&
             o.remittanceStatus !== 'AUDITED'
      );
      const pendingCount = pendingOfferings.length;
      const pendingAmount = pendingOfferings.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

      const auditedOfferings = allRawOfferings.filter(
        o => (o.classId === cls.id || (!o.classId && cls.id === 'default_class')) &&
             (o.quarterNumber === undefined || o.quarterNumber === selectedQuarter) &&
             Number(o.amount) > 0 &&
             o.remittanceStatus === 'AUDITED'
      );
      const auditedCount = auditedOfferings.length;
      const auditedAmount = auditedOfferings.reduce((sum, o) => sum + (Number(o.auditedAmount) || Number(o.amount) || 0), 0);

      const priorityScore = pendingCount > 0 ? (pendingCount * 1_000_000 + pendingAmount) : 0;

      return {
        cls,
        pendingCount,
        pendingAmount,
        auditedCount,
        auditedAmount,
        priorityScore
      };
    }).sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return a.cls.className.localeCompare(b.cls.className);
    });
  }, [allClasses, allRawOfferings, selectedQuarter]);

  // Expenditure Categories for Progress Bars
  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, { label: string; amount: number; tag: string }> = {
      LESSON_MATERIALS: { label: '#materials', amount: 0, tag: '#curriculum' },
      AWARDS_AND_PRIZES: { label: '#awards', amount: 0, tag: '#merit' },
      WELFARE_BENEVOLENCE: { label: '#welfare', amount: 0, tag: '#benevolence' },
      REFRESHMENTS: { label: '#logistics', amount: 0, tag: '#refreshments' },
      ADMIN_PRINTING: { label: '#stationery', amount: 0, tag: '#manuals' },
      OTHER: { label: '#sundry', amount: 0, tag: '#other' }
    };

    treasurySummary.expenditures.forEach(exp => {
      const catKey = exp.category || 'OTHER';
      if (cats[catKey]) {
        cats[catKey].amount += Number(exp.amount) || 0;
      } else {
        cats.OTHER.amount += Number(exp.amount) || 0;
      }
    });

    const total = Math.max(1, treasurySummary.totalExpenditure);
    return Object.entries(cats).map(([key, data]) => ({
      key,
      label: data.label,
      tag: data.tag,
      amount: data.amount,
      pct: Math.min(100, Math.round((data.amount / total) * 100))
    }));
  }, [treasurySummary.expenditures, treasurySummary.totalExpenditure]);

  // Latest Transactions Activity Feed
  const latestTransactionsFeed = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      subtitle: string;
      date: string;
      amount: number;
      type: 'INFLOW_PENDING' | 'INFLOW_AUDITED' | 'OUTFLOW' | 'CHILDREN_INFLOW';
      statusLabel: string;
      statusColor: 'amber' | 'emerald' | 'rose' | 'purple' | 'slate';
      rawItem?: any;
    }> = [];

    treasurySummary.pendingRemittancesList.forEach(r => {
      list.push({
        id: `pend_${r.id || Math.random()}`,
        title: `${r.className || 'Class'} Remittance`,
        subtitle: `Week ${r.weekNumber} • Remitted by ${r.remittedBy || r.secretaryName || 'Secretary'}`,
        date: r.remittedAt ? new Date(r.remittedAt).toLocaleDateString() : 'Awaiting Count',
        amount: Number(r.amount) || 0,
        type: 'INFLOW_PENDING',
        statusLabel: 'Pending',
        statusColor: 'amber',
        rawItem: r
      });
    });

    treasurySummary.auditedOfferingsList.slice(0, 8).forEach(a => {
      list.push({
        id: `aud_${a.id || Math.random()}`,
        title: `${a.className || 'Class'} Collection`,
        subtitle: `Week ${a.weekNumber} • Audited by ${a.auditedBy || 'Treasurer'}`,
        date: a.auditedAt ? new Date(a.auditedAt).toLocaleDateString() : 'Audited',
        amount: Number(a.auditedAmount || a.amount) || 0,
        type: a.isChildrenAccount ? 'CHILDREN_INFLOW' : 'INFLOW_AUDITED',
        statusLabel: 'Completed',
        statusColor: a.isChildrenAccount ? 'purple' : 'emerald',
        rawItem: a
      });
    });

    treasurySummary.expenditures.slice(0, 6).forEach(exp => {
      list.push({
        id: `exp_${exp.id || Math.random()}`,
        title: exp.title,
        subtitle: `${exp.category} • Authorized by ${exp.authorizedBy}`,
        date: exp.date || 'Authorized',
        amount: Number(exp.amount) || 0,
        type: 'OUTFLOW',
        statusLabel: 'Disbursed',
        statusColor: exp.isChildrenAccount ? 'purple' : 'rose',
        rawItem: exp
      });
    });

    return list.slice(0, 10);
  }, [treasurySummary.pendingRemittancesList, treasurySummary.auditedOfferingsList, treasurySummary.expenditures]);
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

  const handleMoveToChildrenAccount = async (offering: any) => {
    try {
      await moveOfferingToChildrenAccount(
        offering.classId,
        offering.quarterNumber || selectedQuarter,
        offering.weekNumber || selectedWeek
      );
      setFeedback(`Moved offering for ${offering.className || 'Children Class'} (Week ${offering.weekNumber || selectedWeek}) to dedicated Children Account.`);
      setTimeout(() => setFeedback(null), 4000);
      await loadTreasuryData();
    } catch (err) {
      console.error('Failed to move offering to Children Account:', err);
    }
  };

  const handleAddChildrenInflow = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseFloat(childrenInflowAmount);
    if (isNaN(numAmt) || numAmt <= 0) return;

    setIsSubmittingChildrenInflow(true);
    try {
      const newOffering: WeeklyOfferingRecord = {
        id: `child_inf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        classId: 'children_dept',
        quarterNumber: selectedQuarter,
        weekNumber: selectedWeek,
        amount: numAmt,
        auditedAmount: numAmt,
        remittanceStatus: 'AUDITED',
        recordedBy: currentAdmin.fullName || currentAdmin.profileName,
        auditedBy: currentAdmin.fullName || currentAdmin.profileName,
        recordedAt: new Date().toISOString(),
        auditedAt: new Date().toISOString(),
        isChildrenAccount: true,
        accountType: 'CHILDREN',
        notes: `${childrenInflowSource.trim() ? `${childrenInflowSource.trim()} - ` : ''}${childrenInflowNotes.trim()}` || 'Children Inflow',
        updatedAt: new Date().toISOString()
      };

      await saveOffering(newOffering);
      await loadTreasuryData();
      setChildrenInflowSource('');
      setChildrenInflowAmount('');
      setChildrenInflowNotes('');
      setShowAddChildrenInflowModal(false);
      setFeedback(`Children Inflow ₦${numAmt.toLocaleString()} recorded successfully.`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error('Failed to record children inflow:', err);
    } finally {
      setIsSubmittingChildrenInflow(false);
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
        isChildrenAccount: expenseAccountType === 'CHILDREN',
        accountType: expenseAccountType,
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

  const renderQuarterSelector = () => (
    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-purple-50 text-[#320b86]">
          <Calendar className="w-4 h-4" />
        </div>
        <span className="text-xs font-black uppercase tracking-wider text-slate-700">
          Financial Quarter:
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar">
        {([1, 2, 3, 4] as QuarterNumber[]).map((qNum) => {
          const isSelected = selectedQuarter === qNum;
          const isActive = safeYear.activeQuarterNumber === qNum;
          return (
            <button
              key={qNum}
              onClick={() => setSelectedQuarter(qNum)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-[#320b86] text-white font-black shadow-sm ring-2 ring-[#320b86]/20'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
              }`}
            >
              <span>Quarter {qNum}</span>
              {isActive && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                  isSelected ? 'bg-amber-400 text-slate-950' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  Active
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      
      {/* 1. Jobie Hero Banner & Top Quarter Selector (Hidden in Children Account tab) */}
      {activeTab !== 'CHILDREN_ACCOUNT' && (
        <>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#20055b] via-[#320b86] to-[#4c1d95] p-6 sm:p-8 text-white shadow-xl border border-white/10">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-violet-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute left-1/3 -bottom-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black font-['Cinzel',serif] tracking-wide text-white">
                  Sunday School Treasury and Financial Commission
                </h1>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                <button
                  onClick={() => setShowAddExpenseModal(true)}
                  className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-slate-950" />
                  <span>+ Record Expense</span>
                </button>
                {treasurySummary.pendingRemittancesList.length > 0 && (
                  <button
                    onClick={handleBulkAuditAll}
                    disabled={isAuditing}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCheck className="w-4 h-4 text-emerald-200" />
                    <span>Audit All ({treasurySummary.pendingRemittancesList.length})</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. Quarter Selection Bar */}
          {renderQuarterSelector()}
        </>
      )}

      {feedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. "DOIT" FINANCIAL INTELLIGENCE DASHBOARD (WHEN OVERVIEW TAB IS ACTIVE)   */}
      {/* ========================================================================= */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* ----------------------------------------------------------------------- */}
          {/* SECTION 1: TOP ROW (BALANCE SUMMARY DUAL-LINE CHART + 4 METRIC CARDS)  */}
          {/* ----------------------------------------------------------------------- */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            
            {/* Card 1: Your Balance Summary (xl:col-span-7) */}
            <div className="xl:col-span-7 bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-50 gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Your Balance Summary</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setBalanceGraphMode('NET_VS_EXPENSES')}
                        className={`px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                          balanceGraphMode === 'NET_VS_EXPENSES'
                            ? 'bg-white text-slate-900 font-black shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Net vs Expenses
                      </button>
                      <button
                        type="button"
                        onClick={() => setBalanceGraphMode('RECORD_VS_AUDIT')}
                        className={`px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                          balanceGraphMode === 'RECORD_VS_AUDIT'
                            ? 'bg-white text-slate-900 font-black shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Record vs Audit
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sub-metrics */}
                <div className="flex items-center gap-8 py-3">
                  {balanceGraphMode === 'NET_VS_EXPENSES' ? (
                    <>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#2042ea] text-white flex items-center justify-center font-bold shadow-xs">
                          <ArrowUpRight className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Net Income</span>
                          <span className="text-base sm:text-lg font-black text-slate-900 font-sans tracking-tight">
                            ₦ {treasurySummary.netIncome.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#ff5555] text-white flex items-center justify-center font-bold shadow-xs">
                          <ArrowDownRight className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Expense</span>
                          <span className="text-base sm:text-lg font-black text-slate-900 font-sans tracking-tight">
                            ₦ {treasurySummary.totalExpenditure.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#2042ea] text-white flex items-center justify-center font-bold shadow-xs">
                          <Receipt className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total Recorded</span>
                          <span className="text-base sm:text-lg font-black text-slate-900 font-sans tracking-tight">
                            ₦ {treasurySummary.totalRecorded.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#10b981] text-white flex items-center justify-center font-bold shadow-xs">
                          <ShieldCheck className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total Audited</span>
                          <span className="text-base sm:text-lg font-black text-slate-900 font-sans tracking-tight">
                            ₦ {treasurySummary.cumulativeAuditedIncome.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Dual-Curve SVG Line Chart */}
              <div className="relative pt-2 w-full overflow-hidden">
                {(() => {
                  const isNetMode = balanceGraphMode === 'NET_VS_EXPENSES';
                  const maxVal = Math.max(
                    15000,
                    ...weeklyTrends.map(t => isNetMode ? Math.max(t.netIncome, t.expenses) : Math.max(t.recorded, t.audited))
                  );
                  const getX = (i: number) => 45 + (i / Math.max(1, totalWeeks - 1)) * (590 - 45);
                  const getY = (val: number) => 155 - (Math.min(val, maxVal) / maxVal) * 125;
                  
                  const pts1 = weeklyTrends.map((t, idx) => ({
                    x: getX(idx),
                    y: getY(isNetMode ? t.netIncome : t.recorded)
                  }));
                  const pts2 = weeklyTrends.map((t, idx) => ({
                    x: getX(idx),
                    y: getY(isNetMode ? t.expenses : t.audited)
                  }));

                  const generateSmoothPath = (pts: { x: number; y: number }[]) => {
                    if (pts.length === 0) return '';
                    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
                    let d = `M ${pts[0].x} ${pts[0].y}`;
                    for (let i = 0; i < pts.length - 1; i++) {
                      const p0 = pts[i];
                      const p1 = pts[i + 1];
                      const midX = (p0.x + p1.x) / 2;
                      d += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
                    }
                    return d;
                  };

                  const path1 = generateSmoothPath(pts1);
                  const path2 = generateSmoothPath(pts2);

                  const activeIdx = Math.max(0, Math.min(totalWeeks - 1, activeChartWeek - 1));
                  const activePt1 = pts1[activeIdx] || { x: getX(activeIdx), y: getY(0) };
                  const activeItem = weeklyTrends[activeIdx];

                  return (
                    <svg viewBox="0 0 620 185" className="w-full h-44 sm:h-52 select-none">
                      <defs>
                        <linearGradient id="blueCurveGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2042ea" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="#2042ea" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="coralCurveGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ff5555" stopOpacity="0.16" />
                          <stop offset="100%" stopColor="#ff5555" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="emeraldCurveGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                        <filter id="shadowTooltip" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.15" />
                        </filter>
                      </defs>

                      {/* Horizontal Grid Lines & Y-Labels */}
                      <g className="text-[9px] fill-slate-400 font-sans">
                        <text x="5" y="35">{formatCompact(maxVal)}</text>
                        <line x1="40" y1="32" x2="610" y2="32" stroke="#f8fafc" strokeWidth="1" strokeDasharray="3 3" />

                        <text x="5" y="75">{formatCompact(maxVal * 0.66)}</text>
                        <line x1="40" y1="72" x2="610" y2="72" stroke="#f8fafc" strokeWidth="1" strokeDasharray="3 3" />

                        <text x="5" y="115">{formatCompact(maxVal * 0.33)}</text>
                        <line x1="40" y1="112" x2="610" y2="112" stroke="#f8fafc" strokeWidth="1" strokeDasharray="3 3" />

                        <text x="18" y="158">0</text>
                        <line x1="40" y1="155" x2="610" y2="155" stroke="#f1f5f9" strokeWidth="1" />
                      </g>

                      {/* Area Fills */}
                      {pts1.length > 0 && (
                        <path
                          d={`${path1} L ${pts1[pts1.length - 1].x} 155 L ${pts1[0].x} 155 Z`}
                          fill="url(#blueCurveGrad)"
                        />
                      )}
                      {pts2.length > 0 && (
                        <path
                          d={`${path2} L ${pts2[pts2.length - 1].x} 155 L ${pts2[0].x} 155 Z`}
                          fill={isNetMode ? "url(#coralCurveGrad)" : "url(#emeraldCurveGrad)"}
                        />
                      )}

                      {/* Curve 2 (Coral in Net Mode, Emerald in Audit Mode) */}
                      <path
                        d={path2}
                        fill="none"
                        stroke={isNetMode ? "#ff5555" : "#10b981"}
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Curve 1 (Royal Blue: Net Income or Total Recorded) */}
                      <path
                        d={path1}
                        fill="none"
                        stroke="#2042ea"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Active Indicator Tooltip & Marker */}
                      <line
                        x1={activePt1.x}
                        y1="25"
                        x2={activePt1.x}
                        y2="155"
                        stroke="#94a3b8"
                        strokeWidth="1.2"
                        strokeDasharray="3 3"
                      />

                      {/* Active Dot on Curve */}
                      <circle
                        cx={activePt1.x}
                        cy={activePt1.y}
                        r="6"
                        fill="#2042ea"
                        stroke="#ffffff"
                        strokeWidth="2.5"
                      />

                      {/* Floating Tooltip Box */}
                      <g
                        transform={`translate(${Math.min(480, Math.max(45, activePt1.x - 65))}, ${Math.max(10, activePt1.y - 50)})`}
                        filter="url(#shadowTooltip)"
                      >
                        <rect width="130" height="42" rx="8" fill="#ffffff" stroke="#f1f5f9" strokeWidth="1" />
                        <text x="65" y="16" textAnchor="middle" fontSize="10" fontWeight="900" fill="#0f172a">
                          {isNetMode 
                            ? `Net: ₦${(activeItem?.netIncome || 0).toLocaleString()}` 
                            : `Rec: ₦${(activeItem?.recorded || 0).toLocaleString()}`}
                        </text>
                        <text x="65" y="30" textAnchor="middle" fontSize="9" fontWeight="700" fill={isNetMode ? "#ff5555" : "#10b981"}>
                          {isNetMode 
                            ? `Exp: ₦${(activeItem?.expenses || 0).toLocaleString()}` 
                            : `Aud: ₦${(activeItem?.audited || 0).toLocaleString()}`}
                        </text>
                        <text x="65" y="40" textAnchor="middle" fontSize="7" fontWeight="600" fill="#94a3b8">
                          Week {activeChartWeek}
                        </text>
                      </g>

                      {/* X-Axis Ticks & Labels */}
                      {weeklyTrends.map((t, idx) => {
                        const pt = pts1[idx];
                        const isCurrent = activeChartWeek === t.week;
                        return (
                          <g
                            key={t.week}
                            onClick={() => {
                              setActiveChartWeek(t.week);
                              setSelectedWeek(t.week);
                            }}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={pt.x}
                              cy="155"
                              r="2.5"
                              fill={isCurrent ? '#2042ea' : '#cbd5e1'}
                            />
                            <text
                              x={pt.x}
                              y="173"
                              textAnchor="middle"
                              fontSize="8"
                              fontWeight={isCurrent ? "900" : "700"}
                              fill={isCurrent ? '#2042ea' : '#94a3b8'}
                            >
                              WK {t.week}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
            </div>

            {/* Right Side: 2 Solid Vibrant Cards + 2 White Metric Cards (xl:col-span-5) */}
            <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Solid Vibrant Royal Blue Card: Income */}
              <div className="bg-[#2042ea] rounded-3xl p-5 text-white shadow-md relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-2xl sm:text-3xl font-black font-sans tracking-tight">
                      ₦ {treasurySummary.cumulativeAuditedIncome.toLocaleString()}
                    </h4>
                    <span className="text-xs font-bold text-white/90 block mt-1">Income</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                    <ArrowDownRight className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-white/80 font-medium">
                  <span>Physical count certified</span>
                  <span className="font-bold text-white">General Fund</span>
                </div>
              </div>

              {/* Solid Vibrant Coral/Red Card: Expense */}
              <div className="bg-[#ff5555] rounded-3xl p-5 text-white shadow-md relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-2xl sm:text-3xl font-black font-sans tracking-tight">
                      ₦ {treasurySummary.totalExpenditure.toLocaleString()}
                    </h4>
                    <span className="text-xs font-bold text-white/90 block mt-1">Expense</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-white/80 font-medium">
                  <span>{treasurySummary.expenditures.length} approved expenses</span>
                  <span className="font-bold text-white">Authorized</span>
                </div>
              </div>

              {/* White Card 1: Classes Audited with Sparkline */}
              <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="text-2xl sm:text-3xl font-black text-slate-900 font-sans tracking-tight">
                    {currentWeekOfferings.filter(c => c.status === 'AUDITED').length} / {allClasses.length}
                  </h4>
                  <span className="text-xs font-bold text-slate-500 block mt-1">Classes Audited</span>
                  <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Week {selectedWeek} register</span>
                </div>
                <div className="w-20 h-10">
                  <svg viewBox="0 0 80 40" className="w-full h-full overflow-visible">
                    <path
                      d="M 5 30 Q 20 5, 35 22 T 60 10 T 75 18"
                      fill="none"
                      stroke="#2042ea"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              {/* White Card 2: Intake Rate with Circular Donut Ring */}
              <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="text-2xl sm:text-3xl font-black text-slate-900 font-sans tracking-tight">
                    ₦ {formatCompact(treasurySummary.pendingAudit)}
                  </h4>
                  <span className="text-xs font-bold text-slate-500 block mt-1">Pending Audit</span>
                  <span className="text-[10px] text-amber-600 font-bold block mt-0.5">{treasurySummary.pendingRemittancesList.length} envelopes</span>
                </div>
                <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                  {(() => {
                    const auditRate = allClasses.length > 0 
                      ? Math.round((currentWeekOfferings.filter(c => c.status === 'AUDITED').length / allClasses.length) * 100) 
                      : 0;
                    const circ = 2 * Math.PI * 20;
                    const strokeDash = (auditRate / 100) * circ;
                    return (
                      <>
                        <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
                          <circle cx="24" cy="24" r="20" stroke="#f1f5f9" strokeWidth="5" fill="none" />
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            stroke="#ff9f43"
                            strokeWidth="5"
                            strokeDasharray={`${strokeDash} ${circ}`}
                            strokeLinecap="round"
                            fill="none"
                          />
                        </svg>
                        <span className="absolute text-[11px] font-black text-slate-900">{auditRate}%</span>
                      </>
                    );
                  })()}
                </div>
              </div>

            </div>

          </div>

          {/* ----------------------------------------------------------------------- */}
          {/* SECTION 2: MIDDLE ROW (DONUT PIE CHART, CLASSES, EXTENDED BALANCE)      */}
          {/* ----------------------------------------------------------------------- */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            
            {/* Card 1: Pie / Donut Chart (Departmental Remittance) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3">
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">Departmental Remittance</h3>
                  <button className="text-slate-400 hover:text-slate-600 p-1">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                {/* Donut Graphic */}
                <div className="relative w-36 h-36 mx-auto my-2 flex items-center justify-center">
                  {(() => {
                    const circ = 2 * Math.PI * 38;
                    const adultDash = (departmentDistribution.Adult.pct / 100) * circ;
                    const youthDash = (departmentDistribution.Youth.pct / 100) * circ;
                    const teensDash = (departmentDistribution.Teens.pct / 100) * circ;
                    const childrenDash = (departmentDistribution.Children.pct / 100) * circ;

                    const offset0 = 0;
                    const offset1 = -adultDash;
                    const offset2 = -(adultDash + youthDash);
                    const offset3 = -(adultDash + youthDash + teensDash);

                    return (
                      <>
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          {/* Adult (Green) */}
                          <circle
                            cx="50"
                            cy="50"
                            r="38"
                            stroke="#10b981"
                            strokeWidth="16"
                            strokeDasharray={`${adultDash} ${circ}`}
                            strokeDashoffset={offset0}
                            fill="none"
                          />
                          {/* Youth (Blue) */}
                          <circle
                            cx="50"
                            cy="50"
                            r="38"
                            stroke="#2563eb"
                            strokeWidth="16"
                            strokeDasharray={`${youthDash} ${circ}`}
                            strokeDashoffset={offset1}
                            fill="none"
                          />
                          {/* Teens (Coral) */}
                          <circle
                            cx="50"
                            cy="50"
                            r="38"
                            stroke="#f43f5e"
                            strokeWidth="16"
                            strokeDasharray={`${teensDash} ${circ}`}
                            strokeDashoffset={offset2}
                            fill="none"
                          />
                          {/* Children (Amber) */}
                          <circle
                            cx="50"
                            cy="50"
                            r="38"
                            stroke="#f59e0b"
                            strokeWidth="16"
                            strokeDasharray={`${childrenDash} ${circ}`}
                            strokeDashoffset={offset3}
                            fill="none"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-[9px] font-black uppercase text-slate-400">Total</span>
                          <span className="text-xs font-black text-slate-900 font-sans tracking-tight">
                            ₦{formatCompact(departmentDistribution.total)}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Legend Dots */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50 text-[11px] font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shrink-0" />
                  <span className="text-slate-600 truncate">Adult ({departmentDistribution.Adult.pct}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] shrink-0" />
                  <span className="text-slate-600 truncate">Youth ({departmentDistribution.Youth.pct}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] shrink-0" />
                  <span className="text-slate-600 truncate">Teens ({departmentDistribution.Teens.pct}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shrink-0" />
                  <span className="text-slate-600 truncate">Children ({departmentDistribution.Children.pct}%)</span>
                </div>
              </div>
            </div>

            {/* Card 2: Classes with Pending Audit Counts */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                      <span>Classes to Audit</span>
                      {treasurySummary.pendingRemittancesList.length > 0 && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      )}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {classesWithAuditStats.filter(c => c.pendingCount > 0).length > 0
                        ? `${classesWithAuditStats.filter(c => c.pendingCount > 0).length} of ${allClasses.length} need audit (critical first)`
                        : `${allClasses.length} registered classes • All audited`}
                    </span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                    treasurySummary.pendingRemittancesList.length > 0
                      ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                  }`}>
                    {treasurySummary.pendingRemittancesList.length > 0
                      ? `${treasurySummary.pendingRemittancesList.length} Pending`
                      : 'Audited'}
                  </span>
                </div>

                {/* Class List sorted by most critical to be audited */}
                <div className="space-y-2.5 my-2">
                  {classesWithAuditStats.slice(0, 5).map(({ cls, pendingCount, pendingAmount, auditedAmount }) => {
                    const isCritical = pendingCount > 0;

                    return (
                      <div 
                        key={cls.id} 
                        onClick={() => setActiveTab(isCritical ? 'PENDING_AUDIT' : 'WEEKLY_AUDIT')}
                        className={`flex items-center justify-between gap-2 p-1.5 rounded-xl transition cursor-pointer ${
                          isCritical ? 'bg-amber-50/40 hover:bg-amber-50/80 border border-amber-100/60' : 'hover:bg-slate-50 border border-transparent'
                        }`}
                        title={isCritical ? `Click to audit ${cls.className}` : `View ${cls.className}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-full font-black text-[11px] flex items-center justify-center shrink-0 ${
                            isCritical 
                              ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                              : 'bg-gradient-to-tr from-purple-100 to-indigo-50 text-[#320b86]'
                          }`}>
                            {cls.className.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 block truncate">{cls.className}</span>
                            <span className="text-[10px] text-slate-400 block truncate">{cls.department}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {isCritical ? (
                            <div>
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-black text-[10px] border border-amber-200/80 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                {pendingCount} audit{pendingCount > 1 ? 's' : ''}
                              </span>
                              {pendingAmount > 0 && (
                                <span className="text-[10px] text-amber-950 font-bold block mt-0.5 font-sans">
                                  ₦{pendingAmount.toLocaleString()}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-black text-[10px] border border-emerald-200/80">
                                Audited
                              </span>
                              {auditedAmount > 0 && (
                                <span className="text-[10px] text-emerald-800 font-bold block mt-0.5 font-sans">
                                  ₦{auditedAmount.toLocaleString()}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setActiveTab(treasurySummary.pendingRemittancesList.length > 0 ? 'PENDING_AUDIT' : 'WEEKLY_AUDIT')}
                className="w-full py-2.5 mt-2 rounded-2xl bg-purple-50 hover:bg-purple-100 text-[#320b86] font-bold text-xs transition border border-purple-100/80 cursor-pointer text-center font-sans"
              >
                {treasurySummary.pendingRemittancesList.length > 0 
                  ? `Review All Pending Audits (${treasurySummary.pendingRemittancesList.length})` 
                  : 'View More Classes'}
              </button>
            </div>

            {/* Card 3: Extended Your Balance in Writing (xl:col-span-2 md:col-span-2) */}
            <div className="xl:col-span-2 md:col-span-2 bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">Your Balance</h3>
                    <span className="text-xs text-slate-400 font-medium">Verified treasury liquidity & net position</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black border border-emerald-200/80">
                    Quarter {selectedQuarter}
                  </span>
                </div>

                {/* 3 Prominent Figures in Writing */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-5">
                  {/* Total Recorded */}
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Total Recorded
                      </span>
                      <div className="text-xl sm:text-2xl font-black text-slate-900 font-sans tracking-tight">
                        ₦ {treasurySummary.totalRecorded.toLocaleString()}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium mt-2">
                      All class register entries
                    </span>
                  </div>

                  {/* Total Audited */}
                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100/80 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 block mb-1">
                        Total Audited
                      </span>
                      <div className="text-xl sm:text-2xl font-black text-emerald-950 font-sans tracking-tight">
                        ₦ {treasurySummary.cumulativeAuditedIncome.toLocaleString()}
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-medium mt-2">
                      Physically verified count
                    </span>
                  </div>

                  {/* Net Income (in bold red as requested) */}
                  <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-rose-800 block mb-1">
                        Net Income
                      </span>
                      <div className="text-xl sm:text-2xl font-black text-rose-600 font-sans tracking-tight">
                        ₦ {treasurySummary.netIncome.toLocaleString()}
                      </div>
                    </div>
                    <span className="text-[10px] text-rose-600 font-medium mt-2">
                      Audited income minus expenses
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Net Liquid Cash Flow Reserve</span>
                <span className="font-bold text-[#320b86] cursor-pointer hover:underline" onClick={() => setActiveTab('EXPENDITURES')}>
                  {treasurySummary.expenditures.length} disbursements logged →
                </span>
              </div>
            </div>

          </div>

          {/* ----------------------------------------------------------------------- */}
          {/* SECTION 3: BOTTOM ROW (EXPENSES CATEGORIES, FUND CATEGORIES, TX)        */}
          {/* ----------------------------------------------------------------------- */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            
            {/* Card 1: Expenses Categories (xl:col-span-3) */}
            <div className="xl:col-span-3 bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">Expenses Categories</h3>

                {/* Category Progress Bars */}
                <div className="space-y-4 my-4">
                  {categoryBreakdown.slice(0, 4).map((cat) => (
                    <div key={cat.key} className="space-y-1.5">
                      {/* Bar */}
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.max(12, cat.pct)}%` }}
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500"
                        />
                      </div>
                      {/* Label & Amount */}
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800">{cat.label}</span>
                        <span className="text-slate-500 font-sans">₦ {cat.amount.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Others Tag */}
              <div className="pt-3 border-t border-slate-50">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">Others tag</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2.5 py-1 rounded-xl bg-purple-50 text-[#320b86] text-[10px] font-bold">#materials</span>
                  <span className="px-2.5 py-1 rounded-xl bg-purple-50 text-[#320b86] text-[10px] font-bold">#curriculum</span>
                  <span className="px-2.5 py-1 rounded-xl bg-purple-50 text-[#320b86] text-[10px] font-bold">#welfare</span>
                  <span className="px-2 py-1 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-bold">4+</span>
                </div>
              </div>
            </div>

            {/* Card 2: Others (Fund Segregation Mini Cards) (xl:col-span-3) */}
            <div className="xl:col-span-3 bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">Fund Categories</h3>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Special purpose and reserve accounts</p>

                <div className="space-y-3 my-4">
                  {/* Mini Card 1: Children Ministry Account */}
                  <div
                    onClick={() => setActiveTab('CHILDREN_ACCOUNT')}
                    className="p-3.5 rounded-2xl bg-purple-50/70 hover:bg-purple-100/70 transition border border-purple-100/60 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="14" stroke="#e9d5ff" strokeWidth="3.5" fill="none" />
                          <circle cx="18" cy="18" r="14" stroke="#a855f7" strokeWidth="3.5" strokeDasharray="65 100" strokeLinecap="round" fill="none" />
                        </svg>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Children Fund</span>
                        <span className="text-[10px] text-purple-700 font-semibold">₦ {(treasurySummary.childrenAccount?.netBalance || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-purple-700" />
                  </div>

                  {/* Mini Card 2: General Operating Reserve */}
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/70 transition border border-emerald-100/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="14" stroke="#d1fae5" strokeWidth="3.5" fill="none" />
                          <circle cx="18" cy="18" r="14" stroke="#10b981" strokeWidth="3.5" strokeDasharray="80 100" strokeLinecap="round" fill="none" />
                        </svg>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">General Reserve</span>
                        <span className="text-[10px] text-emerald-700 font-semibold">₦ {treasurySummary.netIncome.toLocaleString()}</span>
                      </div>
                    </div>
                    <Coins className="w-3.5 h-3.5 text-emerald-700" />
                  </div>

                  {/* Mini Card 3: Pending Remittances to Count */}
                  <div
                    onClick={() => setActiveTab('PENDING_AUDIT')}
                    className="p-3.5 rounded-2xl bg-amber-50/70 hover:bg-amber-100/70 transition border border-amber-100/60 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="14" stroke="#fef3c7" strokeWidth="3.5" fill="none" />
                          <circle cx="18" cy="18" r="14" stroke="#f59e0b" strokeWidth="3.5" strokeDasharray="45 100" strokeLinecap="round" fill="none" />
                        </svg>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Pending Audit</span>
                        <span className="text-[10px] text-amber-700 font-semibold">₦ {treasurySummary.pendingAudit.toLocaleString()}</span>
                      </div>
                    </div>
                    <Receipt className="w-3.5 h-3.5 text-amber-700" />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-50 text-[10px] text-slate-400 text-center font-medium">
                Independent Segregated Ledgers
              </div>
            </div>

            {/* Card 3: Latest Transactions Activity Ledger (xl:col-span-6) */}
            <div className="xl:col-span-6 bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">Latest Transaction</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Audit, remittance and disbursement flow</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTxFilter('ALL')}
                      className={`text-xs font-black pb-0.5 border-b-2 transition cursor-pointer ${
                        txFilter === 'ALL' ? 'text-[#2042ea] border-[#2042ea]' : 'text-slate-400 border-transparent hover:text-slate-700'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setTxFilter('TODAY')}
                      className={`text-xs font-black pb-0.5 border-b-2 transition cursor-pointer ${
                        txFilter === 'TODAY' ? 'text-[#2042ea] border-[#2042ea]' : 'text-slate-400 border-transparent hover:text-slate-700'
                      }`}
                    >
                      Today
                    </button>
                  </div>
                </div>

                {/* Transactions Feed */}
                <div className="divide-y divide-slate-50 my-2">
                  {latestTransactionsFeed.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No financial transactions recorded for this quarter yet.
                    </div>
                  ) : (
                    latestTransactionsFeed.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 px-1 rounded-xl transition">
                        {/* Avatar & Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            tx.type === 'OUTFLOW' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                            {tx.type === 'OUTFLOW' ? (
                              <ArrowUpRight className="w-4 h-4 text-rose-600" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4 text-blue-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-black text-slate-900 block truncate">{tx.title}</span>
                            <span className="text-[10px] text-slate-400 block truncate">{tx.subtitle} • {tx.date}</span>
                          </div>
                        </div>

                        {/* Amount & Status Badge */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-xs sm:text-sm font-black font-sans tracking-tight ${
                            tx.type === 'OUTFLOW' ? 'text-rose-600' : 'text-slate-900'
                          }`}>
                            {tx.type === 'OUTFLOW' ? '-' : '+'}₦{tx.amount.toLocaleString()}
                          </span>

                          {/* Status Pill matching doit design */}
                          {tx.statusColor === 'amber' ? (
                            <button
                              onClick={() => handleOpenAuditModal(tx.rawItem)}
                              className="px-3 py-1 rounded-full bg-[#fef08a] text-[#854d0e] hover:bg-[#fde047] text-[10px] font-black transition cursor-pointer"
                              title="Click to Audit Physical Envelope"
                            >
                              Pending
                            </button>
                          ) : tx.statusColor === 'emerald' ? (
                            <span className="px-3 py-1 rounded-full bg-[#bbf7d0] text-[#166534] text-[10px] font-black">
                              Completed
                            </span>
                          ) : tx.statusColor === 'rose' ? (
                            <span className="px-3 py-1 rounded-full bg-[#fecdd3] text-[#9f1239] text-[10px] font-black">
                              Disbursed
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-900 text-[10px] font-black">
                              Children
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-medium">Physical verification trail</span>
                <button
                  onClick={() => setActiveTab('AUDITED_TRAIL')}
                  className="text-xs font-black text-[#2042ea] hover:underline cursor-pointer"
                >
                  View Audited Trail →
                </button>
              </div>
            </div>

          </div>

        </div>
      )}



      {/* Tab 1: Pending Remittances Queue */}
      {activeTab === 'PENDING_AUDIT' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                Remittance Verification Queue (Awaiting Physical Count)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Weekly offering collections submitted by class secretaries. Click "Audit & Accept" after physically counting cash.
              </p>
            </div>

            {treasurySummary.pendingRemittancesList.length > 0 && (
              <button
                onClick={handleBulkAuditAll}
                disabled={isAuditing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50"
              >
                <CheckCheck className="w-4 h-4 text-emerald-200" />
                <span>Audit All ({treasurySummary.pendingRemittancesList.length})</span>
              </button>
            )}
          </div>

          {treasurySummary.pendingRemittancesList.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-700">All Submitted Remittances Are Audited</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                There are no outstanding remittances awaiting audit for Quarter {selectedQuarter}. New submissions from class registers will appear here automatically.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-4 sm:px-6 py-3.5">Class Name</th>
                      <th className="px-3 py-3.5">Department</th>
                      <th className="px-3 py-3.5 text-center">Week</th>
                      <th className="px-3 py-3.5">Remitted By / Time</th>
                      <th className="px-3 py-3.5 text-right">Recorded Amount</th>
                      <th className="px-4 sm:px-6 py-3.5 text-center">Audit Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {treasurySummary.pendingRemittancesList.map((row) => (
                      <tr key={row.id} className="hover:bg-purple-50/40 transition-colors">
                        <td className="px-4 sm:px-6 py-3.5 font-bold text-slate-900">
                          {row.className}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-[10px] text-[#320b86] bg-purple-50 border border-purple-100/60 px-2 py-0.5 rounded-md font-black uppercase tracking-wider">
                            {row.department}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-bold">
                            Week {row.weekNumber}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-slate-600 text-[11px]">
                          <div className="font-semibold text-slate-800">{row.remittedBy || row.secretaryName || 'Class Secretary'}</div>
                          <span className="text-[10px] text-slate-400">
                            {row.remittedAt ? new Date(row.remittedAt).toLocaleString() : 'Recently'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-right font-black text-slate-900 text-sm font-sans tracking-tight">
                          ₦{(row.amount || 0).toLocaleString()}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => handleOpenAuditModal(row)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black inline-flex items-center gap-1.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                              <span>Audit & Accept</span>
                            </button>

                            {(row.department?.toLowerCase().includes('child') || row.isChildrenAccount) && (
                              row.isChildrenAccount ? (
                                <span className="px-2.5 py-1 bg-purple-100 text-purple-900 border border-purple-200 rounded-lg text-[10px] font-black">
                                  In Children Account
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleMoveToChildrenAccount(row)}
                                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-[#320b86] border border-purple-200/80 rounded-xl text-xs font-bold inline-flex items-center gap-1 shadow-xs transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                                  title="Move to dedicated Children Account"
                                >
                                  <Layers className="w-3.5 h-3.5 text-[#320b86]" />
                                  <span>Move to Children Account</span>
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Touch-Friendly Card View */}
              <div className="block md:hidden divide-y divide-slate-100">
                {treasurySummary.pendingRemittancesList.map((row) => (
                  <div key={row.id} className="p-4 sm:p-5 space-y-3 bg-white hover:bg-slate-50/60 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-black text-slate-900">{row.className}</h4>
                          <span className="text-[10px] text-[#320b86] bg-purple-50 border border-purple-100/60 px-2 py-0.5 rounded-md font-black uppercase tracking-wider">
                            {row.department}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Remitted by: <strong className="text-slate-700">{row.remittedBy || row.secretaryName || 'Class Secretary'}</strong>
                          {row.remittedAt && ` • ${new Date(row.remittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                      <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-xl text-xs font-black shrink-0">
                        Week {row.weekNumber}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recorded Offering</span>
                      <span className="text-xl font-black text-slate-900 font-sans tracking-tight">
                        ₦{(row.amount || 0).toLocaleString()}
                      </span>
                    </div>

                    {/* Big Touch-Optimized Audit Button */}
                    <div className="space-y-2 pt-1">
                      <button
                        onClick={() => handleOpenAuditModal(row)}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                      >
                        <ShieldCheck className="w-5 h-5 text-emerald-200" />
                        <span>Audit & Remit (₦{(row.amount || 0).toLocaleString()})</span>
                      </button>

                      {(row.department?.toLowerCase().includes('child') || row.isChildrenAccount) && (
                        row.isChildrenAccount ? (
                          <div className="text-center py-1.5 text-[11px] font-black text-purple-900 bg-purple-50 rounded-xl border border-purple-200">
                            In Children Account
                          </div>
                        ) : (
                          <button
                            onClick={() => handleMoveToChildrenAccount(row)}
                            className="w-full py-2.5 bg-purple-50 hover:bg-purple-100 text-[#320b86] border border-purple-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <Layers className="w-4 h-4 text-[#320b86]" />
                            <span>Move to Children Account</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2: Weekly Audit & Collation */}
      {activeTab === 'WEEKLY_AUDIT' && (
        <div className="space-y-4">
          {/* Week Selector */}
          <div className="bg-white rounded-2xl border border-slate-100 p-3.5 sm:p-4 shadow-sm flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-50 text-[#320b86]">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Financial Week (Quarter {selectedQuarter}):
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
              {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => {
                const isSelected = selectedWeek === w;
                const isWeekOpen = isSundayRegisterOpenForWeek(activeQuarterData, w);
                return (
                  <button
                    key={w}
                    onClick={() => setSelectedWeek(w)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#320b86] text-white font-black shadow-sm ring-2 ring-[#320b86]/20'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
                    }`}
                  >
                    <span>Week {w}</span>
                    {!isWeekOpen && (
                      <span className="text-[9px] text-slate-400">🔒</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Future Week Locked Banner */}
          {!isSundayRegisterOpenForWeek(activeQuarterData, selectedWeek) && (
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-3 shadow-xs">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <h4 className="font-black text-amber-950 uppercase tracking-wide">
                  Week {selectedWeek} Financial Entry: LOCKED — Opens on Sunday
                </h4>
                <p className="text-amber-800 leading-relaxed">
                  Financial entry and remittance auditing are locked for future Sundays. Financial data cannot be entered before the actual Sunday arrives. The financial workflow remains governed strictly by physical collection, secretary remittance, and actual acceptance state.
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                  Weekly Sunday School Class Remittance Audit (Week {selectedWeek})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified collections entered by class teachers and secretaries in the official register.
                </p>
              </div>

              <button
                onClick={handleExportFinancialCSV}
                className="px-4 py-2 bg-[#320b86] hover:bg-[#250664] text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Week {selectedWeek} CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 sm:px-6 py-3.5">Class Name</th>
                    <th className="px-3 py-3.5">Department</th>
                    <th className="px-3 py-3.5">Secretary / Teachers</th>
                    <th className="px-3 py-3.5 text-right">Recorded Offering</th>
                    <th className="px-3 py-3.5 text-right">Audited (Verified)</th>
                    <th className="px-4 sm:px-6 py-3.5 text-center">Status / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentWeekOfferings.map((row) => (
                    <tr key={row.classId} className="hover:bg-purple-50/40 transition-colors">
                      <td className="px-4 sm:px-6 py-3.5 font-bold text-slate-900">
                        {row.className}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[10px] text-[#320b86] bg-purple-50 border border-purple-100/60 px-2 py-0.5 rounded-md font-black uppercase tracking-wider">
                          {row.department}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-slate-600 font-medium">
                        {row.secretaryName}
                      </td>
                      <td className="px-3 py-3.5 text-right font-black text-slate-900 text-sm font-sans tracking-tight">
                        {row.isNoRecordWeek ? (
                          <span className="text-amber-600 text-xs font-bold">No Record Week</span>
                        ) : (
                          `₦${row.amount.toLocaleString()}`
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-right font-black text-emerald-900 text-sm font-sans tracking-tight">
                        {row.status === 'AUDITED' ? (
                          `₦${row.auditedAmount.toLocaleString()}`
                        ) : (
                          <span className="text-slate-400 text-xs font-normal">Pending Audit</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-center">
                        {row.status === 'AUDITED' ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Audited by {row.auditedBy || 'Treasurer'}</span>
                          </span>
                        ) : row.status === 'REMITTED' ? (
                          <button
                            onClick={() => handleOpenAuditModal(row)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center gap-1.5 mx-auto shadow-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                            <span>Audit Now</span>
                          </button>
                        ) : row.amount > 0 ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60">
                            Pending Remittance
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Unrecorded</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gradient-to-r from-purple-50/80 to-indigo-50/80 font-black text-slate-900 text-xs border-t-2 border-purple-100">
                  <tr>
                    <td className="px-4 sm:px-6 py-4" colSpan={3}>
                      TOTAL SUNDAY SCHOOL OFFERING (WEEK {selectedWeek}):
                    </td>
                    <td className="px-3 py-4 text-right text-sm text-slate-900 font-sans tracking-tight">
                      ₦{weekTotal.toLocaleString()}
                    </td>
                    <td className="px-3 py-4 text-right text-base text-[#320b86] font-sans tracking-tight">
                      ₦{weekAuditedTotal.toLocaleString()}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-center text-slate-600 font-bold">
                      {currentWeekOfferings.filter(c => c.status === 'AUDITED').length} of {allClasses.length} Classes Audited
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Tab: 12-Week Quarterly Matrix */}
      {activeTab === 'QUARTERLY_MATRIX' && (
        <div className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-6 space-y-4 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase tracking-wider">
                  Master Financial Register
                </span>
                <span className="text-xs text-slate-500 font-semibold">Weeks 1 to {totalWeeks}</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 font-['Cinzel',serif] mt-1">
                Quarter {selectedQuarter} Real 12-Week Financial Matrix (₦)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Live weekly offering totals collated across all class registers with physical cash audit statuses.
              </p>
            </div>

            <button
              onClick={() => {
                if (allClasses.length === 0) return;
                const headers = ['Class Name', ...Array.from({ length: totalWeeks }, (_, i) => `Week ${i + 1}`), 'Quarter Total'];
                const rows = [headers];
                allClasses.forEach(cls => {
                  let classSum = 0;
                  const row = [cls.className];
                  for (let w = 1; w <= totalWeeks; w++) {
                    const off = allRawOfferings.find(
                      o => (o.classId === cls.id || (!o.classId && cls.id === 'default_class')) &&
                           o.weekNumber === w &&
                           (o.quarterNumber === undefined || o.quarterNumber === selectedQuarter)
                    );
                    const amt = off?.remittanceStatus === 'AUDITED' ? (off.auditedAmount || off.amount) : (off?.amount || 0);
                    classSum += amt;
                    row.push(String(amt));
                  }
                  row.push(String(classSum));
                  rows.push(row);
                });
                const csvContent = rows.map(r => r.join(',')).join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `treasurer_12_week_matrix_q${selectedQuarter}_${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              <span>Export Matrix CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse min-w-[850px]">
              <thead className="bg-slate-900 text-amber-300 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 border-r border-slate-800 sticky left-0 bg-slate-900 z-10">Class Name</th>
                  {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => (
                    <th key={w} className="py-3 px-2.5 text-center border-r border-slate-800">W{w}</th>
                  ))}
                  <th className="py-3 px-4 text-right">Class Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {allClasses.map((cls) => {
                  let classSum = 0;
                  return (
                    <tr key={cls.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-4 font-bold text-slate-900 border-r border-slate-100 sticky left-0 bg-white hover:bg-slate-50 z-10 whitespace-nowrap">
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
                          <td key={w} className="py-2.5 px-2 text-center border-r border-slate-100 text-[11px]">
                            {amt > 0 ? (
                              <span 
                                className={`px-1.5 py-0.5 rounded font-bold ${
                                  offering?.remittanceStatus === 'AUDITED' 
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                                title={offering?.remittanceStatus === 'AUDITED' ? `Audited: ₦${amt.toLocaleString()}` : `Submitted pending count: ₦${amt.toLocaleString()}`}
                              >
                                {amt >= 1000 ? `${(amt / 1000).toFixed(amt % 1000 === 0 ? 0 : 1)}k` : amt}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-4 text-right font-black text-emerald-900 whitespace-nowrap text-xs bg-emerald-50/40">
                        ₦{classSum.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-800">
                <tr>
                  <td className="py-3 px-4 uppercase tracking-wider text-amber-400 sticky left-0 bg-slate-900 z-10">
                    Weekly Total
                  </td>
                  {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => {
                    const weekTotal = allClasses.reduce((sum, cls) => {
                      const offering = allRawOfferings.find(
                        o => (o.classId === cls.id || (!o.classId && cls.id === 'default_class')) &&
                             o.weekNumber === w &&
                             (o.quarterNumber === undefined || o.quarterNumber === selectedQuarter)
                      );
                      const amt = offering?.remittanceStatus === 'AUDITED' ? (offering.auditedAmount || offering.amount) : (offering?.amount || 0);
                      return sum + amt;
                    }, 0);
                    return (
                      <td key={w} className="py-3 px-2 text-center border-r border-slate-800 text-[11px] text-amber-300">
                        {weekTotal > 0 ? (weekTotal >= 1000 ? `${(weekTotal / 1000).toFixed(weekTotal % 1000 === 0 ? 0 : 1)}k` : weekTotal) : '-'}
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 text-right text-emerald-300 whitespace-nowrap text-sm bg-slate-950">
                    ₦{(() => {
                      return allClasses.reduce((sum, cls) => {
                        return sum + Array.from({ length: totalWeeks }, (_, i) => i + 1).reduce((wSum, w) => {
                          const offering = allRawOfferings.find(
                            o => (o.classId === cls.id || (!o.classId && cls.id === 'default_class')) &&
                                 o.weekNumber === w &&
                                 (o.quarterNumber === undefined || o.quarterNumber === selectedQuarter)
                          );
                          return wSum + (offering?.remittanceStatus === 'AUDITED' ? (offering.auditedAmount || offering.amount) : (offering?.amount || 0));
                        }, 0);
                      }, 0).toLocaleString();
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      {activeTab === 'EXPENDITURES' && (
        <div className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                Sunday School Department Expenditures & Disbursements
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Manual purchases, awards, teaching aids, and refreshments deducted from offering collections.
              </p>
            </div>

            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shrink-0"
            >
              <PlusCircle className="w-4 h-4 text-slate-950" />
              <span>+ Record Expense</span>
            </button>
          </div>

          {treasurySummary.expenditures.length === 0 ? (
            <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
              No expenditures recorded for Quarter {selectedQuarter} yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 sm:px-6 py-3.5">Expense Title / Purpose</th>
                    <th className="px-3 py-3.5">Category</th>
                    <th className="px-3 py-3.5">Date</th>
                    <th className="px-3 py-3.5">Authorized By</th>
                    <th className="px-3 py-3.5 text-right">Amount</th>
                    <th className="px-4 sm:px-6 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {treasurySummary.expenditures.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 sm:px-6 py-3.5 font-bold text-slate-900">
                        <div>{exp.title}</div>
                        {exp.notes && <div className="text-[10px] text-slate-400 font-normal">{exp.notes}</div>}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-bold">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-slate-600 font-medium">
                        {exp.date}
                      </td>
                      <td className="px-3 py-3.5 text-slate-700 font-medium">
                        {exp.authorizedBy}
                      </td>
                      <td className="px-3 py-3.5 text-right font-black text-rose-600 text-sm font-sans tracking-tight">
                        ₦{exp.amount.toLocaleString()}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-center">
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete Expenditure"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-rose-50/60 font-black text-rose-950 text-xs border-t-2 border-rose-100">
                  <tr>
                    <td className="px-4 sm:px-6 py-4" colSpan={4}>
                      TOTAL EXPENDITURES (QUARTER {selectedQuarter}):
                    </td>
                    <td className="px-3 py-4 text-right text-base text-rose-700 font-sans tracking-tight">
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
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100">
            <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
              Permanent Audited Offering Ledger Trail
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete historical record of physically verified offerings ratified by the Treasurer Directorate.
            </p>
          </div>

          {treasurySummary.auditedOfferingsList.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No audited offering records logged yet for Quarter {selectedQuarter}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 sm:px-6 py-3.5">Class</th>
                    <th className="px-3 py-3.5">Department</th>
                    <th className="px-3 py-3.5 text-center">Week</th>
                    <th className="px-3 py-3.5 text-right">Audited Amount</th>
                    <th className="px-3 py-3.5">Auditor</th>
                    <th className="px-4 py-3.5">Audit Date & Time</th>
                    <th className="px-4 sm:px-6 py-3.5 text-center">Account / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {treasurySummary.auditedOfferingsList.map((item) => (
                    <tr key={item.id} className="hover:bg-purple-50/30 transition-colors">
                      <td className="px-4 sm:px-6 py-3.5 font-bold text-slate-900">{item.className}</td>
                      <td className="px-3 py-3.5 text-slate-600 font-medium">{item.department}</td>
                      <td className="px-3 py-3.5 text-center">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-bold">
                          Week {item.weekNumber}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right font-black text-emerald-900 text-sm font-sans tracking-tight">
                        ₦{(item.auditedAmount || item.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3.5 font-bold text-slate-800">{item.auditedBy || 'Treasurer'}</td>
                      <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                        {item.auditedAt ? new Date(item.auditedAt).toLocaleString() : 'Verified'}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-center">
                        {(item.department?.toLowerCase().includes('child') || item.isChildrenAccount) ? (
                          item.isChildrenAccount ? (
                            <span className="px-2.5 py-1 bg-purple-100 text-purple-900 border border-purple-200 rounded-lg text-[10px] font-black">
                              In Children Account
                            </span>
                          ) : (
                            <button
                              onClick={() => handleMoveToChildrenAccount(item)}
                              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-[#320b86] border border-purple-200/80 rounded-xl text-xs font-bold inline-flex items-center gap-1 shadow-xs transition cursor-pointer"
                              title="Move to dedicated Children Account"
                            >
                              <Layers className="w-3.5 h-3.5 text-[#320b86]" />
                              <span>Move to Children Account</span>
                            </button>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Sunday School</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Children Account */}
      {activeTab === 'CHILDREN_ACCOUNT' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#20055b] via-[#320b86] to-[#4c1d95] text-white p-6 sm:p-8 shadow-xl border border-white/10">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-violet-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute left-1/3 -bottom-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-400/20 border border-purple-400/50 rounded-full text-xs font-black text-purple-300 uppercase tracking-wider">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Children Directorate • Special Financial Ledger</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black font-['Cinzel',serif] tracking-wide text-white">
                  Children Account Management & Audit
                </h2>
                <p className="text-xs sm:text-sm text-purple-100 max-w-2xl leading-relaxed">
                  Dedicated, segregated financial management for Children Department classes. Remittances moved here and disbursements logged here are tracked separately from the regular Sunday School general treasury to ensure full transparency and targeted accountability.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                <button
                  onClick={() => setShowAddChildrenInflowModal(true)}
                  className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shrink-0"
                >
                  <PlusCircle className="w-4 h-4 text-slate-950" />
                  <span>+ Record Children Inflow</span>
                </button>
                <button
                  onClick={() => {
                    setExpenseAccountType('CHILDREN');
                    setShowAddExpenseModal(true);
                  }}
                  className="px-4 py-2.5 bg-purple-600/80 hover:bg-purple-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all duration-200 hover:-translate-y-0.5 border border-purple-400/30 cursor-pointer shrink-0"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-purple-200" />
                  <span>+ Record Children Expense</span>
                </button>
              </div>
            </div>
          </div>

          {/* Financial Quarter Selector under Children Management Bar */}
          {renderQuarterSelector()}

          {/* Children Financial KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">1. Total Children Inflows</span>
                <div className="p-1.5 rounded-lg bg-purple-100 text-[#320b86]">
                  <Coins className="w-3.5 h-3.5" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-purple-950 font-sans tracking-tight">
                ₦{(treasurySummary.childrenAccount?.auditedIncome || 0).toLocaleString()}
              </h3>
              <p className="text-[11px] text-purple-700 mt-1 font-semibold">
                {treasurySummary.childrenAccount?.inflows.length || 0} verified collections / direct receipts
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-bold text-rose-900 uppercase tracking-wider">2. Total Children Expenses</span>
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-rose-700 font-sans tracking-tight">
                ₦{(treasurySummary.childrenAccount?.totalExpenditure || 0).toLocaleString()}
              </h3>
              <p className="text-[11px] text-rose-600 mt-1 font-semibold">
                {treasurySummary.childrenAccount?.expenditures.length || 0} dedicated disbursements
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border-2 border-[#320b86]/30 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-bold text-[#320b86] uppercase tracking-wider">3. Children Account Net Balance</span>
                <div className="p-1.5 rounded-lg bg-purple-100 text-[#320b86]">
                  <Layers className="w-3.5 h-3.5" />
                </div>
              </div>
              <h3 className={`text-2xl font-black font-sans tracking-tight ${
                (treasurySummary.childrenAccount?.netBalance || 0) >= 0 ? 'text-[#320b86]' : 'text-rose-700'
              }`}>
                ₦{(treasurySummary.childrenAccount?.netBalance || 0).toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-500 font-bold mt-1">
                Inflows minus Dedicated Disbursements
              </p>
            </div>
          </div>

          {/* Inflows Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                  Children Inflows & Offerings
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Remittances from Children Department classes and direct received funds.
                </p>
              </div>
            </div>

            {(!treasurySummary.childrenAccount?.inflows || treasurySummary.childrenAccount.inflows.length === 0) ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No Children Account inflows recorded yet for Quarter {selectedQuarter}. Use "Move to Children Account" on Children remittances or click "+ Record Children Inflow".
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-4 sm:px-6 py-3.5">Source / Class</th>
                      <th className="px-3 py-3.5 text-center">Week</th>
                      <th className="px-3 py-3.5 text-right">Amount (₦)</th>
                      <th className="px-3 py-3.5">Audited / Recorded By</th>
                      <th className="px-4 py-3.5">Date</th>
                      <th className="px-4 sm:px-6 py-3.5">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {treasurySummary.childrenAccount.inflows.map((item) => (
                      <tr key={item.id} className="hover:bg-purple-50/30 transition-colors">
                        <td className="px-4 sm:px-6 py-3.5 font-bold text-slate-900">
                          {item.className || 'Children Department'}
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-bold">
                            Week {item.weekNumber}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-right font-black text-[#320b86] text-sm font-sans tracking-tight">
                          ₦{(item.auditedAmount || item.amount || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-3.5 font-bold text-slate-800">
                          {item.auditedBy || item.recordedBy || 'Treasurer'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                          {item.auditedAt ? new Date(item.auditedAt).toLocaleDateString() : 'Recorded'}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-slate-500 text-[11px]">
                          {item.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Expenses Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                  Children Disbursements & Expenses
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tracked expenses and disbursements exclusively for the Children Department.
                </p>
              </div>
            </div>

            {(!treasurySummary.childrenAccount?.expenditures || treasurySummary.childrenAccount.expenditures.length === 0) ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No Children Account expenditures logged yet for Quarter {selectedQuarter}. Click "+ Record Children Expense" to log a disbursement.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-4 sm:px-6 py-3.5">Expense Title</th>
                      <th className="px-3 py-3.5">Category</th>
                      <th className="px-3 py-3.5">Date</th>
                      <th className="px-3 py-3.5">Authorized By</th>
                      <th className="px-3 py-3.5 text-right">Amount (₦)</th>
                      <th className="px-4 sm:px-6 py-3.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {treasurySummary.childrenAccount.expenditures.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 sm:px-6 py-3.5 font-bold text-slate-900">
                          <div>{exp.title}</div>
                          {exp.notes && <div className="text-[10px] text-slate-400 font-normal">{exp.notes}</div>}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-[10px] bg-purple-50 text-purple-900 border border-purple-100 px-2.5 py-1 rounded-md font-bold">
                            {exp.category}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-slate-600 font-medium">{exp.date}</td>
                        <td className="px-3 py-3.5 text-slate-700 font-medium">{exp.authorizedBy}</td>
                        <td className="px-3 py-3.5 text-right font-black text-rose-600 text-sm font-sans tracking-tight">
                          ₦{exp.amount.toLocaleString()}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-center">
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Delete Expenditure"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-rose-50/60 font-black text-rose-950 text-xs border-t-2 border-rose-100">
                    <tr>
                      <td className="px-4 sm:px-6 py-4" colSpan={4}>
                        TOTAL CHILDREN EXPENDITURES:
                      </td>
                      <td className="px-3 py-4 text-right text-base text-rose-700 font-sans tracking-tight">
                        ₦{(treasurySummary.childrenAccount?.totalExpenditure || 0).toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                Record Directorate Expenditure
              </h3>
              <button
                onClick={() => setShowAddExpenseModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Expense Title / Purpose</label>
                <input
                  type="text"
                  required
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  placeholder="e.g., Lesson Material Photocopying / Awards"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#320b86] focus:border-transparent"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Amount (₦ NGN)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="5000"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#320b86] focus:border-transparent font-black text-slate-900 font-sans"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Expense Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#320b86] focus:border-transparent font-bold text-slate-800"
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
                <label className="text-xs font-bold text-slate-700 block mb-1">Account Destination</label>
                <select
                  value={expenseAccountType}
                  onChange={(e) => setExpenseAccountType(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#320b86] focus:border-transparent font-bold text-slate-800"
                >
                  <option value="SUNDAY_SCHOOL">Standard Sunday School General Treasury</option>
                  <option value="CHILDREN">Dedicated Children Account (Independent Ledger)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Additional Notes (Optional)</label>
                <textarea
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  rows={2}
                  placeholder="Receipt number or details..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#320b86] focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="px-4 py-2.5 bg-[#320b86] hover:bg-[#250664] text-white rounded-xl text-xs font-black transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSubmittingExpense ? 'Saving...' : 'Record Disbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Children Inflow Modal */}
      {showAddChildrenInflowModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-purple-100 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-50 text-[#320b86]">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                  Record Children Inflow
                </h3>
              </div>
              <button
                onClick={() => setShowAddChildrenInflowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddChildrenInflow} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Inflow Source / Donor / Class</label>
                <input
                  type="text"
                  required
                  value={childrenInflowSource}
                  onChange={(e) => setChildrenInflowSource(e.target.value)}
                  placeholder="e.g., Children Harvest Donation / Special Inflow"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#320b86] focus:border-transparent"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Amount (₦ NGN)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={childrenInflowAmount}
                  onChange={(e) => setChildrenInflowAmount(e.target.value)}
                  placeholder="10000"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#320b86] focus:border-transparent font-black text-slate-900 font-sans"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Audit Notes / Receipt Ref (Optional)</label>
                <textarea
                  value={childrenInflowNotes}
                  onChange={(e) => setChildrenInflowNotes(e.target.value)}
                  rows={2}
                  placeholder="Receipt number or specific children program..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#320b86] focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddChildrenInflowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingChildrenInflow}
                  className="px-4 py-2.5 bg-[#320b86] hover:bg-[#250664] text-white rounded-xl text-xs font-black transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSubmittingChildrenInflow ? 'Recording...' : 'Record Children Inflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Audit Modal */}
      {auditTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                  Audit Physical Remittance
                </h3>
              </div>
              <button
                onClick={() => setAuditTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-purple-50/80 border border-purple-100 p-3.5 rounded-xl text-xs space-y-1.5 text-slate-800">
              <div><strong className="font-bold text-[#320b86]">Class:</strong> {auditTarget.className} ({auditTarget.department})</div>
              <div><strong className="font-bold text-[#320b86]">Week:</strong> Week {auditTarget.weekNumber || selectedWeek} (Quarter {selectedQuarter})</div>
              <div><strong className="font-bold text-[#320b86]">Recorded by Secretary:</strong> ₦{(auditTarget.amount || 0).toLocaleString()}</div>
            </div>

            <div className="space-y-3.5">
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
                  className="w-full text-base font-black p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#320b86] focus:border-transparent text-emerald-900 bg-white font-sans"
                />
                <p className="text-[10px] text-slate-400 mt-1">
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
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#320b86] focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAuditTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAudit}
                disabled={isAuditing}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>{isAuditing ? 'Auditing...' : 'Confirm Audit & Accept'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
