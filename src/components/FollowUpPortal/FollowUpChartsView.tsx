import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  PhoneCall,
  Home,
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  BarChart2,
  PieChart,
  Activity,
  Layers,
  HeartHandshake,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingDown,
  RotateCcw,
  Check,
  Filter,
  LineChart,
  ChevronLeft,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import {
  ClassProfile,
  Member,
  WeeklyGradeRecord,
  AbsenceLogRecord,
  VisitationAssignmentRecord,
  FollowUpAssignmentRecord
} from '../../types';
import { getClassWeeklyVisitationCandidates } from '../../utils/visitationEngine';

export type ChartViewTab =
  | 'ALL_GRAPHS'
  | 'PRESENT_VS_ABSENT'
  | 'ABSENT_VS_WORK'
  | 'PRESENT_VS_WORK'
  | 'TOTAL_VS_WORK'
  | 'EVANGELISM_TREND'
  | 'URGENCY_HISTOGRAM';

export type GraphDisplayMode = 'PLOTTED_TREND' | 'COMBINED';

interface FollowUpChartsViewProps {
  classes: ClassProfile[];
  members: Member[];
  grades: WeeklyGradeRecord[];
  absenceLogs: AbsenceLogRecord[];
  selectedWeek: number;
  quarterNumber: number;
  selectedClassIdFilter: string;
  onSelectClassFilter: (classId: string) => void;
  isFullAnalyticsMode?: boolean;
}

// =============================================================================
// SVG PLOTTED CURVE AND AREA PATH HELPERS
// =============================================================================
function buildSvgCurvePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX1 = prev.x + (curr.x - prev.x) / 2;
    const cpY1 = prev.y;
    const cpX2 = prev.x + (curr.x - prev.x) / 2;
    const cpY2 = curr.y;
    d += ` C ${cpX1.toFixed(1)} ${cpY1.toFixed(1)}, ${cpX2.toFixed(1)} ${cpY2.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }
  return d;
}

function buildSvgAreaPath(points: { x: number; y: number }[], baselineY: number): string {
  if (points.length === 0) return '';
  const curve = buildSvgCurvePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${curve} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}

export const FollowUpChartsView: React.FC<FollowUpChartsViewProps> = ({
  classes,
  members,
  grades,
  absenceLogs,
  selectedWeek,
  quarterNumber,
  selectedClassIdFilter,
  onSelectClassFilter,
  isFullAnalyticsMode = false
}) => {
  const [activeChartTab, setActiveChartTab] = useState<ChartViewTab>('PRESENT_VS_ABSENT');
  const [layoutMode, setLayoutMode] = useState<'FOCUSED' | 'STACKED'>('FOCUSED');
  const [graphDisplayMode, setGraphDisplayMode] = useState<GraphDisplayMode>('PLOTTED_TREND');
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

  // Filtered dataset based on selected scope (All Classes vs Individual Class)
  const scopedClasses = useMemo(() => {
    if (selectedClassIdFilter === 'ALL') return classes;
    return classes.filter(c => c.id === selectedClassIdFilter);
  }, [classes, selectedClassIdFilter]);

  const scopedMembers = useMemo(() => {
    if (selectedClassIdFilter === 'ALL') return members;
    return members.filter(m => m.classId === selectedClassIdFilter);
  }, [members, selectedClassIdFilter]);

  // Strict quarter filter on grades to ensure exact register roll accuracy
  const scopedGrades = useMemo(() => {
    const list = selectedClassIdFilter === 'ALL' ? grades : grades.filter(g => g.classId === selectedClassIdFilter);
    return list.filter(g => !g.quarterNumber || Number(g.quarterNumber) === Number(quarterNumber));
  }, [grades, selectedClassIdFilter, quarterNumber]);

  const scopedAbsenceLogs = useMemo(() => {
    if (selectedClassIdFilter === 'ALL') return absenceLogs;
    return absenceLogs.filter(l => l.classId === selectedClassIdFilter);
  }, [absenceLogs, selectedClassIdFilter]);

  const activeClassName = useMemo(() => {
    if (selectedClassIdFilter === 'ALL') return 'All Classes Collated';
    const c = classes.find(item => item.id === selectedClassIdFilter);
    return c ? `${c.className} (${c.department})` : 'Individual Class';
  }, [selectedClassIdFilter, classes]);

  const totalWeeks = 12;

  // Strict Sunday School Register Enrollment Rules:
  // 1. Effective First Lesson Week: member did not exist on register prior to this week
  // 2. Permanent Departure Check: has member departed before/at week wk
  const isMemberEnrolledAtWeek = (m: Member, wk: number): boolean => {
    const qEnr = m.quarterEnrollments?.[quarterNumber as 1 | 2 | 3 | 4];
    const effectiveFirstWeek = qEnr?.firstLessonWeek || m.firstLessonWeek || 1;
    if (wk < effectiveFirstWeek) return false;

    const status = qEnr?.status || m.status || 'ACTIVE';
    if (m.departureQuarter && m.departureWeek) {
      if (quarterNumber > m.departureQuarter || (quarterNumber === m.departureQuarter && wk >= m.departureWeek)) {
        return false;
      }
    } else if (status === 'LEFT_CLASS') {
      return false;
    }
    return true;
  };

  // Track SSSR deliveries from localStorage
  const sssrDeliveriesMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('hof_sssr_delivery_q')) {
          map[key] = true;
        }
      }
    } catch {
      // Ignore storage access errors
    }
    return map;
  }, []);

  // =========================================================================
  // 1. DATA COMPUTATION FOR GRAPH 1: PRESENT VS ABSENT TREND (WEEKS 1 TO 12)
  // Exact numbers matching Sunday School Register collation
  // =========================================================================
  const presentVsAbsentTrendData = useMemo(() => {
    const weeklyData = Array.from({ length: totalWeeks }, (_, idx) => {
      const wk = idx + 1;
      const enrolledAtWeek = scopedMembers.filter(m => isMemberEnrolledAtWeek(m, wk));
      const enrolledIds = new Set(enrolledAtWeek.map(m => m.id));

      const gradesForWeek = scopedGrades.filter(
        g => g.weekNumber === wk && enrolledIds.has(g.memberId)
      );

      let present = 0;
      let absent = 0;
      let exempt = 0;

      enrolledAtWeek.forEach(m => {
        const g = gradesForWeek.find(rec => rec.memberId === m.id);
        if (g) {
          if (g.attendance === 'EXEMPT') {
            exempt++;
            return;
          }
          if (g.attendance === 'PRESENT' || g.attendance === 'LATE') {
            present++;
            return;
          }
          if (g.attendance === 'ABSENT') {
            absent++;
            return;
          }
        }
        // If past or current week with no recorded attendance mark, count absent
        if (wk <= selectedWeek) {
          absent++;
        }
      });

      const total = present + absent;
      const presentRate = total > 0 ? Math.round((present / total) * 100) : 0;
      const absentRate = total > 0 ? Math.round((absent / total) * 100) : 0;

      return {
        week: wk,
        present,
        absent,
        exempt,
        total,
        presentRate,
        absentRate
      };
    });

    const maxVal = Math.max(
      ...weeklyData.map(d => Math.max(d.present, d.absent)),
      10
    );

    const currentSnapshot = weeklyData.find(d => d.week === selectedWeek) || weeklyData[0];
    const prevSnapshot = weeklyData.find(d => d.week === selectedWeek - 1);
    const presentDiff = prevSnapshot ? currentSnapshot.present - prevSnapshot.present : 0;

    return {
      weeklyData,
      maxVal,
      currentSnapshot,
      presentDiff
    };
  }, [totalWeeks, scopedMembers, scopedGrades, selectedWeek, quarterNumber]);

  // =========================================================================
  // 2. DATA COMPUTATION FOR GRAPH 2: ABSENT COUNT VS FOLLOW-UP WORK DONE RATE
  // =========================================================================
  const absentVsWorkData = useMemo(() => {
    const weeklyData = Array.from({ length: Math.min(totalWeeks, selectedWeek) }, (_, idx) => {
      const wk = idx + 1;
      const enrolledAtWeek = scopedMembers.filter(m => isMemberEnrolledAtWeek(m, wk));
      const enrolledIds = new Set(enrolledAtWeek.map(m => m.id));

      const gradesForWeek = scopedGrades.filter(
        g => g.weekNumber === wk && enrolledIds.has(g.memberId)
      );

      const absentMemberIds: string[] = [];
      enrolledAtWeek.forEach(m => {
        const g = gradesForWeek.find(rec => rec.memberId === m.id);
        if (g && g.attendance === 'EXEMPT') {
          return;
        }
        if (g && g.attendance === 'ABSENT') {
          absentMemberIds.push(m.id);
        } else if (!g && wk <= selectedWeek) {
          absentMemberIds.push(m.id);
        }
      });

      const absentCount = absentMemberIds.length;
      let workDoneOnAbsentCount = 0;

      for (const memberId of absentMemberIds) {
        // 1. SSSR sent to absent member
        const sssrKey = Object.keys(sssrDeliveriesMap).find(k => k.includes(`_w${wk}_m${memberId}`));
        // 2. Welfare log recorded
        const hasWelfareLog = scopedAbsenceLogs.some(l => l.memberId === memberId && Number(l.weekNumber) === wk);
        // 3. Home visit completed
        let hasVisitCompleted = false;
        for (const cls of scopedClasses) {
          if (cls.visitationAssignments) {
            for (const a of Object.values(cls.visitationAssignments) as VisitationAssignmentRecord[]) {
              if (a.memberId === memberId && (a.weekNumber === wk || !a.weekNumber) && a.status === 'COMPLETED') {
                hasVisitCompleted = true;
                break;
              }
            }
          }
        }
        // 4. Reminder reached out
        let hasReminderDone = false;
        for (const cls of scopedClasses) {
          if (cls.followUpAssignments) {
            for (const fa of Object.values(cls.followUpAssignments) as FollowUpAssignmentRecord[]) {
              if (fa.memberId === memberId && Number(fa.weekNumber) === wk && fa.status === 'REACHED_OUT') {
                hasReminderDone = true;
                break;
              }
            }
          }
        }

        if (sssrKey || hasWelfareLog || hasVisitCompleted || hasReminderDone) {
          workDoneOnAbsentCount++;
        }
      }

      const workRate = absentCount > 0 ? Math.min(100, Math.round((workDoneOnAbsentCount / absentCount) * 100)) : 100;

      return {
        week: wk,
        absentCount,
        workDoneOnAbsentCount,
        workRate
      };
    });

    const maxAbsent = Math.max(...weeklyData.map(d => d.absentCount), 10);
    const avgWorkRate = weeklyData.length > 0
      ? Math.round(weeklyData.reduce((acc, cur) => acc + cur.workRate, 0) / weeklyData.length)
      : 0;

    return {
      weeklyData,
      maxAbsent,
      avgWorkRate
    };
  }, [totalWeeks, selectedWeek, scopedMembers, scopedGrades, sssrDeliveriesMap, scopedAbsenceLogs, scopedClasses, quarterNumber]);

  // =========================================================================
  // 3. DATA COMPUTATION FOR GRAPH 3: PRESENT MEMBERS VS RETENTION CARE RATE
  // =========================================================================
  const presentVsWorkData = useMemo(() => {
    const weeklyData = Array.from({ length: Math.min(totalWeeks, selectedWeek) }, (_, idx) => {
      const wk = idx + 1;
      const enrolledAtWeek = scopedMembers.filter(m => isMemberEnrolledAtWeek(m, wk));
      const enrolledIds = new Set(enrolledAtWeek.map(m => m.id));

      const gradesForWeek = scopedGrades.filter(
        g => g.weekNumber === wk && enrolledIds.has(g.memberId)
      );

      const presentMemberIds: string[] = [];
      enrolledAtWeek.forEach(m => {
        const g = gradesForWeek.find(rec => rec.memberId === m.id);
        if (g && (g.attendance === 'PRESENT' || g.attendance === 'LATE')) {
          presentMemberIds.push(m.id);
        }
      });

      const presentCount = presentMemberIds.length;

      // Retention follow-up work performed on present attendees:
      let retentionWorkCount = 0;
      for (const memberId of presentMemberIds) {
        // SSSR delivered
        const sssrKey = Object.keys(sssrDeliveriesMap).find(k => k.includes(`_w${wk}_m${memberId}`));
        // Upcoming reminder dispatched
        let hasReminderDone = false;
        for (const cls of scopedClasses) {
          if (cls.followUpAssignments) {
            for (const fa of Object.values(cls.followUpAssignments) as FollowUpAssignmentRecord[]) {
              if (fa.memberId === memberId && Number(fa.weekNumber) === wk && fa.status === 'REACHED_OUT') {
                hasReminderDone = true;
                break;
              }
            }
          }
        }

        if (sssrKey || hasReminderDone) {
          retentionWorkCount++;
        }
      }

      const retentionWorkRate = presentCount > 0 ? Math.min(100, Math.round((retentionWorkCount / presentCount) * 100)) : 100;

      return {
        week: wk,
        presentCount,
        retentionWorkCount,
        retentionWorkRate
      };
    });

    const maxPresent = Math.max(...weeklyData.map(d => d.presentCount), 10);
    const avgRetentionRate = weeklyData.length > 0
      ? Math.round(weeklyData.reduce((acc, cur) => acc + cur.retentionWorkRate, 0) / weeklyData.length)
      : 0;

    return {
      weeklyData,
      maxPresent,
      avgRetentionRate
    };
  }, [totalWeeks, selectedWeek, scopedMembers, scopedGrades, sssrDeliveriesMap, scopedClasses, quarterNumber]);

  // =========================================================================
  // 4. DATA COMPUTATION FOR GRAPH 4: TOTAL MEMBERS VS OVERALL FOLLOW-UP WORK
  // =========================================================================
  const totalVsWorkData = useMemo(() => {
    const weeklyData = Array.from({ length: Math.min(totalWeeks, selectedWeek) }, (_, idx) => {
      const wk = idx + 1;
      const enrolledAtWeek = scopedMembers.filter(m => isMemberEnrolledAtWeek(m, wk));
      const totalEnrolled = enrolledAtWeek.length;
      const absentItem = absentVsWorkData.weeklyData.find(d => d.week === wk);
      const presentItem = presentVsWorkData.weeklyData.find(d => d.week === wk);

      const totalInterventions = (absentItem?.workDoneOnAbsentCount || 0) + (presentItem?.retentionWorkCount || 0);
      const targetInterventions = Math.max(totalEnrolled, 1);
      const overallRate = Math.min(100, Math.round((totalInterventions / targetInterventions) * 100));

      return {
        week: wk,
        totalEnrolled,
        totalInterventions,
        overallRate
      };
    });

    const currentEnrolled = scopedMembers.filter(m => isMemberEnrolledAtWeek(m, selectedWeek)).length;

    return {
      totalEnrolled: currentEnrolled,
      weeklyData
    };
  }, [scopedMembers, totalWeeks, selectedWeek, absentVsWorkData, presentVsWorkData, quarterNumber]);

  // =========================================================================
  // 5. DATA COMPUTATION FOR GRAPH 5: EVANGELISM TREND (NEW JOINERS & RETURNERS)
  // =========================================================================
  const evangelismTrendData = useMemo(() => {
    const weeklyAdditions = Array.from({ length: totalWeeks }, (_, idx) => {
      const wk = idx + 1;
      const nextWk = wk + 1;

      // Members whose first lesson was week wk
      const newJoiners = scopedMembers.filter(m => {
        const firstWk = m.quarterEnrollments?.[quarterNumber as 1 | 2 | 3 | 4]?.firstLessonWeek || m.firstLessonWeek || 1;
        return firstWk === wk && isMemberEnrolledAtWeek(m, wk);
      });

      // Check how many of these new joiners returned in nextWk
      let returnedCount = 0;
      if (nextWk <= totalWeeks) {
        newJoiners.forEach(m => {
          const gNext = scopedGrades.find(
            g => g.weekNumber === nextWk && g.memberId === m.id
          );
          if (gNext && (gNext.attendance === 'PRESENT' || gNext.attendance === 'LATE')) {
            returnedCount++;
          }
        });
      }

      const returnRate = newJoiners.length > 0 && nextWk <= selectedWeek
        ? Math.round((returnedCount / newJoiners.length) * 100)
        : null;

      return {
        week: wk,
        nextWeek: nextWk,
        addedCount: newJoiners.length,
        returnedCount,
        returnRate
      };
    });

    const maxEvangelismVal = Math.max(
      ...weeklyAdditions.map(d => Math.max(d.addedCount, d.returnedCount)),
      5
    );

    const totalNewJoined = weeklyAdditions.reduce((acc, cur) => acc + cur.addedCount, 0);
    const validReturnWeeks = weeklyAdditions.filter(w => w.returnRate !== null);
    const overallRetentionPercentage = validReturnWeeks.length > 0
      ? Math.round(
          validReturnWeeks.reduce((acc, cur) => acc + (cur.returnRate || 0), 0) /
            validReturnWeeks.length
        )
      : 0;

    return {
      weeklyAdditions,
      maxEvangelismVal,
      totalNewJoined,
      overallRetentionPercentage
    };
  }, [totalWeeks, scopedMembers, scopedGrades, selectedWeek, quarterNumber]);

  // =========================================================================
  // 6. DATA COMPUTATION FOR GRAPH 6: ABSENCE URGENCY HISTOGRAM (PRESERVED)
  // =========================================================================
  const urgencyHistogramData = useMemo(() => {
    let bin1Week = 0;
    let bin2Weeks = 0;
    let bin3Weeks = 0;
    let bin4to5Weeks = 0;
    let bin6PlusWeeks = 0;

    for (const m of scopedMembers) {
      const cls = classes.find(c => c.id === m.classId);
      const cand = getClassWeeklyVisitationCandidates(
        [m],
        selectedWeek,
        scopedGrades,
        scopedAbsenceLogs,
        cls?.visitationAssignments || {},
        { includeCooldown: true, maxCap: 1 }
      ).candidates[0];

      if (cand && cand.consecutiveWeeksAbsent > 0) {
        const weeks = cand.consecutiveWeeksAbsent;
        if (weeks === 1) bin1Week++;
        else if (weeks === 2) bin2Weeks++;
        else if (weeks === 3) bin3Weeks++;
        else if (weeks >= 4 && weeks <= 5) bin4to5Weeks++;
        else if (weeks >= 6) bin6PlusWeeks++;
      }
    }

    const totalAbsentees = bin1Week + bin2Weeks + bin3Weeks + bin4to5Weeks + bin6PlusWeeks;

    const bins = [
      {
        id: 'BIN_1',
        label: '1 Week',
        action: 'Call & WhatsApp Message',
        urgency: 'Low Urgency',
        count: bin1Week,
        percentage: totalAbsentees > 0 ? Math.round((bin1Week / totalAbsentees) * 100) : 0,
        color: '#f59e0b',
        bgColor: 'bg-amber-500',
        textColor: 'text-amber-800',
        borderColor: 'border-amber-300',
        chipBg: 'bg-amber-100'
      },
      {
        id: 'BIN_2',
        label: '2 Weeks',
        action: 'Phone Call Outreach',
        urgency: 'Medium Urgency',
        count: bin2Weeks,
        percentage: totalAbsentees > 0 ? Math.round((bin2Weeks / totalAbsentees) * 100) : 0,
        color: '#f97316',
        bgColor: 'bg-orange-500',
        textColor: 'text-orange-800',
        borderColor: 'border-orange-300',
        chipBg: 'bg-orange-100'
      },
      {
        id: 'BIN_3',
        label: '3 Weeks',
        action: 'Physical / Home Visit',
        urgency: 'High Urgency (Visitation)',
        count: bin3Weeks,
        percentage: totalAbsentees > 0 ? Math.round((bin3Weeks / totalAbsentees) * 100) : 0,
        color: '#f43f5e',
        bgColor: 'bg-rose-500',
        textColor: 'text-rose-800',
        borderColor: 'border-rose-300',
        chipBg: 'bg-rose-100'
      },
      {
        id: 'BIN_4_5',
        label: '4–5 Weeks',
        action: 'Directorate / Admin Outreach',
        urgency: 'Critical Escalation',
        count: bin4to5Weeks,
        percentage: totalAbsentees > 0 ? Math.round((bin4to5Weeks / totalAbsentees) * 100) : 0,
        color: '#dc2626',
        bgColor: 'bg-red-600',
        textColor: 'text-red-900',
        borderColor: 'border-red-300',
        chipBg: 'bg-red-100'
      },
      {
        id: 'BIN_6_PLUS',
        label: '6+ Weeks',
        action: 'Urgent Decision Review / Exclusion',
        urgency: 'Critical Decision Review',
        count: bin6PlusWeeks,
        percentage: totalAbsentees > 0 ? Math.round((bin6PlusWeeks / totalAbsentees) * 100) : 0,
        color: '#7c3aed',
        bgColor: 'bg-purple-600',
        textColor: 'text-purple-900',
        borderColor: 'border-purple-300',
        chipBg: 'bg-purple-100'
      }
    ];

    const maxCount = Math.max(...bins.map(b => b.count), 1);

    return { bins, totalAbsentees, maxCount };
  }, [scopedMembers, classes, selectedWeek, scopedGrades, scopedAbsenceLogs]);

  // Coordinate geometry constants for SVG plotting
  const PLOT_PAD_LEFT = 65;
  const PLOT_PAD_RIGHT = 55;
  const PLOT_PAD_TOP = 40;
  const PLOT_BASELINE_Y = 255;
  const PLOT_WIDTH = 1000 - PLOT_PAD_LEFT - PLOT_PAD_RIGHT; // 880
  const PLOT_HEIGHT = PLOT_BASELINE_Y - PLOT_PAD_TOP;       // 215

  // X coordinate calculation helper for 12 weeks
  const getWeekX = (weekNumber: number, maxWeeksCount: number = totalWeeks) => {
    return PLOT_PAD_LEFT + ((weekNumber - 1) / Math.max(maxWeeksCount - 1, 1)) * PLOT_WIDTH;
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1-CLICK GRAPH SELECTOR DECK & CONTROLS (GROUPED VIEW)                     */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          {/* Scope Selector: All Classes vs Specific Class */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-rose-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Data Scope & Class Selection:
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                id="btn-scope-all-classes"
                onClick={() => onSelectClassFilter('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                  selectedClassIdFilter === 'ALL'
                    ? 'bg-rose-950 text-white shadow-sm ring-2 ring-rose-500/30'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Classes (Collated Cumulative)
              </button>

              <select
                value={selectedClassIdFilter}
                onChange={e => onSelectClassFilter(e.target.value)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-50 border border-slate-300 text-slate-800 outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer shadow-xs"
              >
                <option value="ALL">Select Individual Class...</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.className} ({c.department})
                  </option>
                ))}
              </select>

              <span className="text-[11px] font-semibold text-slate-500 pl-1">
                Viewing: <strong className="text-slate-900">{activeClassName}</strong>
              </span>
            </div>
          </div>

          {/* Quick Dropdown Jumper & Mode Switchers */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Quick Dropdown Jumper */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-1.5 rounded-2xl">
              <LineChart className="w-4 h-4 text-rose-600 ml-1.5" />
              <select
                id="select-graph-jumper"
                value={activeChartTab}
                onChange={e => {
                  setActiveChartTab(e.target.value as ChartViewTab);
                  setLayoutMode('FOCUSED');
                }}
                className="px-2.5 py-1 text-xs font-black bg-transparent text-slate-900 outline-none cursor-pointer"
              >
                <option value="PRESENT_VS_ABSENT">Graph 1: Present vs. Absent Trend</option>
                <option value="ABSENT_VS_WORK">Graph 2: Absent vs. Work Done (%)</option>
                <option value="PRESENT_VS_WORK">Graph 3: Present vs. Retention Care (%)</option>
                <option value="TOTAL_VS_WORK">Graph 4: Total Roster vs. Work Rate (%)</option>
                <option value="EVANGELISM_TREND">Graph 5: Evangelism & Retention</option>
                <option value="URGENCY_HISTOGRAM">Graph 6: Absence Urgency Indicator</option>
              </select>
            </div>

            {/* Layout Mode: 1-Click Spotlight vs View All Stacked */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                id="btn-layout-focused"
                onClick={() => setLayoutMode('FOCUSED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  layoutMode === 'FOCUSED'
                    ? 'bg-rose-950 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="1-Click Spotlight: Displays only the selected graph"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                1-Click Focus
              </button>
              <button
                type="button"
                id="btn-layout-stacked"
                onClick={() => setLayoutMode('STACKED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  layoutMode === 'STACKED'
                    ? 'bg-rose-950 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View all 6 graphs stacked vertically"
              >
                <Layers className="w-3.5 h-3.5 text-rose-300" />
                View All Stacked
              </button>
            </div>

            {/* Plotted Trend Graph View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setGraphDisplayMode('PLOTTED_TREND')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  graphDisplayMode === 'PLOTTED_TREND'
                    ? 'bg-rose-950 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                Line
              </button>
              <button
                type="button"
                onClick={() => setGraphDisplayMode('COMBINED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  graphDisplayMode === 'COMBINED'
                    ? 'bg-rose-950 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5 text-rose-300" />
                Combined
              </button>
            </div>
          </div>
        </div>

        {/* 6 Interactive Graph Selector Cards (1-Click Grouped Viewing) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-black uppercase tracking-wider text-[11px] text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Click Any Graph to Spotlight Immediately:
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              {layoutMode === 'FOCUSED' ? 'Viewing in 1-Click Spotlight' : 'Showing all 6 stacked'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {[
              {
                id: 'PRESENT_VS_ABSENT' as ChartViewTab,
                num: '1',
                title: 'Present vs. Absent',
                subtitle: 'Sunday Roll Attendance',
                metric: `Wk ${selectedWeek}: ${presentVsAbsentTrendData.currentSnapshot.present} Pres / ${presentVsAbsentTrendData.currentSnapshot.absent} Abs`,
                borderColor: 'border-emerald-500',
                bgColor: 'bg-emerald-50/60',
                badgeBg: 'bg-emerald-100 text-emerald-800'
              },
              {
                id: 'ABSENT_VS_WORK' as ChartViewTab,
                num: '2',
                title: 'Absent vs. Work Done',
                subtitle: 'Recovery Care Outreach',
                metric: `Avg Work Rate: ${absentVsWorkData.avgWorkRate}%`,
                borderColor: 'border-rose-500',
                bgColor: 'bg-rose-50/60',
                badgeBg: 'bg-rose-100 text-rose-800'
              },
              {
                id: 'PRESENT_VS_WORK' as ChartViewTab,
                num: '3',
                title: 'Present vs. Care',
                subtitle: 'Retention Care & SSSR',
                metric: `Retention: ${presentVsWorkData.avgRetentionRate}%`,
                borderColor: 'border-blue-500',
                bgColor: 'bg-blue-50/60',
                badgeBg: 'bg-blue-100 text-blue-800'
              },
              {
                id: 'TOTAL_VS_WORK' as ChartViewTab,
                num: '4',
                title: 'Total vs. Work Rate',
                subtitle: 'Full Roster Coverage',
                metric: `Roll: ${totalVsWorkData.totalEnrolled} Members`,
                borderColor: 'border-purple-500',
                bgColor: 'bg-purple-50/60',
                badgeBg: 'bg-purple-100 text-purple-800'
              },
              {
                id: 'EVANGELISM_TREND' as ChartViewTab,
                num: '5',
                title: 'Evangelism & Retention',
                subtitle: 'New Intake & Returners',
                metric: `${evangelismTrendData.totalNewJoined} Added (${evangelismTrendData.overallRetentionPercentage}% Ret)`,
                borderColor: 'border-amber-500',
                bgColor: 'bg-amber-50/60',
                badgeBg: 'bg-amber-100 text-amber-800'
              },
              {
                id: 'URGENCY_HISTOGRAM' as ChartViewTab,
                num: '6',
                title: 'Urgency Indicator',
                subtitle: 'Absence Action Tiers',
                metric: `${urgencyHistogramData.totalAbsentees} Absentees`,
                borderColor: 'border-indigo-500',
                bgColor: 'bg-indigo-50/60',
                badgeBg: 'bg-indigo-100 text-indigo-800'
              }
            ].map(card => {
              const isSelected = activeChartTab === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  id={`btn-tab-card-${card.num}`}
                  onClick={() => {
                    setActiveChartTab(card.id);
                    setLayoutMode('FOCUSED');
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-2 relative group ${
                    isSelected && layoutMode === 'FOCUSED'
                      ? `${card.borderColor} ${card.bgColor} ring-2 ring-rose-500/30 shadow-md -translate-y-0.5`
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                      isSelected && layoutMode === 'FOCUSED' ? card.badgeBg : 'bg-slate-200 text-slate-700'
                    }`}>
                      {card.num}
                    </span>
                    {isSelected && layoutMode === 'FOCUSED' && (
                      <span className="text-[9px] font-black uppercase tracking-wider text-white bg-rose-950 px-1.5 py-0.5 rounded-md">
                        Spotlight
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-black block leading-tight text-slate-900 group-hover:text-rose-950">
                      {card.title}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 block mt-0.5 truncate">
                      {card.subtitle}
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-200/60 text-[10px] flex items-center justify-between">
                    <span className="text-slate-400 font-bold">Data:</span>
                    <span className="font-black text-slate-800 truncate pl-1">
                      {card.metric}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* GRAPH 1: PLOTTED PRESENT VS. ABSENT TREND GRAPH (WEEKS 1 TO 12)           */}
      {/* ========================================================================= */}
      {(layoutMode === 'STACKED' || activeChartTab === 'PRESENT_VS_ABSENT') && (() => {
        const maxV = Math.max(presentVsAbsentTrendData.maxVal, 1);
        const yTicks = [1.0, 0.75, 0.5, 0.25, 0.0].map(ratio => ({
          ratio,
          val: Math.round(maxV * ratio),
          y: PLOT_PAD_TOP + (1 - ratio) * PLOT_HEIGHT
        }));

        const presentPoints = presentVsAbsentTrendData.weeklyData.map(wk => ({
          x: getWeekX(wk.week),
          y: PLOT_PAD_TOP + (1 - wk.present / maxV) * PLOT_HEIGHT,
          val: wk.present,
          rate: wk.presentRate,
          week: wk.week
        }));

        const absentPoints = presentVsAbsentTrendData.weeklyData.map(wk => ({
          x: getWeekX(wk.week),
          y: PLOT_PAD_TOP + (1 - wk.absent / maxV) * PLOT_HEIGHT,
          val: wk.absent,
          rate: wk.absentRate,
          week: wk.week
        }));

        const presentCurve = buildSvgCurvePath(presentPoints);
        const presentArea = buildSvgAreaPath(presentPoints, PLOT_BASELINE_Y);
        const absentCurve = buildSvgCurvePath(absentPoints);
        const absentArea = buildSvgAreaPath(absentPoints, PLOT_BASELINE_Y);

        const activeWeekData = hoveredWeek !== null
          ? presentVsAbsentTrendData.weeklyData.find(d => d.week === hoveredWeek) || presentVsAbsentTrendData.currentSnapshot
          : presentVsAbsentTrendData.currentSnapshot;

        return (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
            {/* Graph Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Graph 1: Present vs. Absent Plotted Trend (Week 1 to Week 12)
                  </h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {selectedClassIdFilter === 'ALL' ? 'All Classes Collated' : 'Single Class'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Plotted continuous curve across the 12-week schedule. Green trend line tracks Present attendees; Red line tracks Absent members.
                </p>
              </div>

              {/* Live Trajectory Badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Present (Wk {activeWeekData.week}): <strong>{activeWeekData.present} ({activeWeekData.presentRate}%)</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  Absent (Wk {activeWeekData.week}): <strong>{activeWeekData.absent} ({activeWeekData.absentRate}%)</strong>
                </span>
              </div>
            </div>

            {/* Plotted Coordinate SVG Canvas */}
            <div className="w-full bg-slate-900/95 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-inner overflow-hidden relative">
              {/* Inspection Floating Banner */}
              <div className="flex items-center justify-between text-xs text-slate-300 pb-2 border-b border-slate-800/80 mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-slate-300">
                    Inspecting Week {activeWeekData.week}:
                  </span>
                  <strong className="text-emerald-400 font-black">
                    {activeWeekData.present} Present ({activeWeekData.presentRate}%)
                  </strong>
                  <span className="text-slate-500">|</span>
                  <strong className="text-rose-400 font-black">
                    {activeWeekData.absent} Absent ({activeWeekData.absentRate}%)
                  </strong>
                </div>

                <div className="flex items-center gap-4 text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-3 h-1 bg-emerald-400 rounded-full inline-block" />
                    Present Curve
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <span className="w-3 h-1 bg-rose-400 rounded-full inline-block" />
                    Absent Curve
                  </span>
                </div>
              </div>

              {/* The SVG Canvas */}
              <div className="w-full overflow-x-auto">
                <svg viewBox="0 0 1000 320" className="w-full h-auto min-w-[720px] select-none">
                  <defs>
                    <linearGradient id="gradPresentG1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="gradAbsentG1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.38" />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                    </linearGradient>
                    <filter id="glowG1" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4" />
                    </filter>
                  </defs>

                  {/* Graph Canvas Background */}
                  <rect
                    x={PLOT_PAD_LEFT}
                    y={PLOT_PAD_TOP - 15}
                    width={PLOT_WIDTH}
                    height={PLOT_HEIGHT + 15}
                    rx="12"
                    fill="#0f172a"
                    fillOpacity="0.85"
                    stroke="#1e293b"
                    strokeWidth="1"
                  />

                  {/* Horizontal Gridlines and Y-Ticks */}
                  {yTicks.map(t => (
                    <g key={t.ratio}>
                      <line
                        x1={PLOT_PAD_LEFT}
                        y1={t.y}
                        x2={PLOT_PAD_LEFT + PLOT_WIDTH}
                        y2={t.y}
                        stroke="#334155"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                        strokeOpacity="0.6"
                      />
                      <text
                        x={PLOT_PAD_LEFT - 10}
                        y={t.y + 4}
                        textAnchor="end"
                        className="text-[10px] font-bold fill-slate-400"
                      >
                        {t.val}
                      </text>
                    </g>
                  ))}

                  {/* Vertical Guidelines & X-Axis Week Labels */}
                  {presentPoints.map(p => {
                    const isSelected = p.week === selectedWeek;
                    const isHovered = p.week === hoveredWeek;
                    return (
                      <g key={`vert-${p.week}`}>
                        <line
                          x1={p.x}
                          y1={PLOT_PAD_TOP - 15}
                          x2={p.x}
                          y2={PLOT_BASELINE_Y}
                          stroke={isSelected || isHovered ? '#059669' : '#1e293b'}
                          strokeWidth={isSelected || isHovered ? 1.5 : 1}
                          strokeDasharray={isSelected || isHovered ? '2 2' : 'none'}
                        />
                        <line
                          x1={p.x}
                          y1={PLOT_BASELINE_Y}
                          x2={p.x}
                          y2={PLOT_BASELINE_Y + 6}
                          stroke="#475569"
                          strokeWidth="1.5"
                        />
                        <text
                          x={p.x}
                          y={PLOT_BASELINE_Y + 22}
                          textAnchor="middle"
                          className={`text-[11px] font-black ${
                            isSelected
                              ? 'fill-emerald-400'
                              : isHovered
                              ? 'fill-white'
                              : 'fill-slate-400'
                          }`}
                        >
                          W{p.week}
                        </text>
                        {isSelected && (
                          <circle cx={p.x} cy={PLOT_BASELINE_Y + 32} r="3" fill="#10b981" />
                        )}
                      </g>
                    );
                  })}

                  {/* Area Fills under Plotted Trend Curves */}
                  <path d={presentArea} fill="url(#gradPresentG1)" />
                  <path d={absentArea} fill="url(#gradAbsentG1)" />

                  {/* Continuous Plotted Curves */}
                  <path
                    d={presentCurve}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glowG1)"
                  />
                  <path
                    d={absentCurve}
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glowG1)"
                  />

                  {/* Plotted Data Points and Badges (Green: Present) */}
                  {presentPoints.map(p => (
                    <g
                      key={`dot-p-${p.week}`}
                      className="transition-transform duration-200"
                    >
                      <circle cx={p.x} cy={p.y} r="8" fill="#10b981" fillOpacity="0.25" />
                      <circle cx={p.x} cy={p.y} r="5" fill="#ffffff" stroke="#10b981" strokeWidth="3" />
                      <rect
                        x={p.x - 14}
                        y={p.y - 23}
                        width="28"
                        height="16"
                        rx="4"
                        fill="#064e3b"
                        stroke="#059669"
                        strokeWidth="1"
                      />
                      <text
                        x={p.x}
                        y={p.y - 11}
                        textAnchor="middle"
                        className="text-[9px] font-black fill-emerald-200"
                      >
                        {p.val}
                      </text>
                    </g>
                  ))}

                  {/* Plotted Data Points and Badges (Red: Absent) */}
                  {absentPoints.map(a => (
                    <g
                      key={`dot-a-${a.week}`}
                      className="transition-transform duration-200"
                    >
                      <circle cx={a.x} cy={a.y} r="8" fill="#f43f5e" fillOpacity="0.25" />
                      <circle cx={a.x} cy={a.y} r="5" fill="#ffffff" stroke="#f43f5e" strokeWidth="3" />
                      <rect
                        x={a.x - 14}
                        y={a.y + 9}
                        width="28"
                        height="16"
                        rx="4"
                        fill="#881337"
                        stroke="#e11d48"
                        strokeWidth="1"
                      />
                      <text
                        x={a.x}
                        y={a.y + 21}
                        textAnchor="middle"
                        className="text-[9px] font-black fill-rose-200"
                      >
                        {a.val}
                      </text>
                    </g>
                  ))}

                  {/* Interactive Column Hover Hitboxes */}
                  {presentPoints.map(p => (
                    <rect
                      key={`hit-${p.week}`}
                      x={p.x - 30}
                      y={PLOT_PAD_TOP - 15}
                      width="60"
                      height={PLOT_HEIGHT + 45}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredWeek(p.week)}
                      onMouseLeave={() => setHoveredWeek(null)}
                    />
                  ))}
                </svg>
              </div>
            </div>

            {/* Optional Weekly Breakdown Columns if COMBINED mode */}
            {graphDisplayMode === 'COMBINED' && (
              <div className="pt-2">
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
                  {presentVsAbsentTrendData.weeklyData.map(wk => (
                    <div
                      key={wk.week}
                      className={`rounded-2xl p-2 border text-center space-y-1 transition ${
                        wk.week === selectedWeek
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <span className="text-[10px] font-black text-slate-600 uppercase block">
                        Wk {wk.week}
                      </span>
                      <div className="text-[10px] font-bold text-emerald-700">
                        {wk.present} P ({wk.presentRate}%)
                      </div>
                      <div className="text-[10px] font-bold text-rose-700">
                        {wk.absent} A ({wk.absentRate}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legend & Trend Trajectory */}
            <div className="pt-3 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3 border-t border-slate-100">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <strong className="text-slate-800">Present Trend (Green Line & Plotted Dots)</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500" />
                  <strong className="text-slate-800">Absent Trend (Red Line & Plotted Dots)</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500">Quarter Trajectory:</span>
                {presentVsAbsentTrendData.presentDiff >= 0 ? (
                  <span className="inline-flex items-center gap-1 font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                    <TrendingUp className="w-3.5 h-3.5" />
                    +{presentVsAbsentTrendData.presentDiff} Present Attendees
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-black text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200">
                    <TrendingDown className="w-3.5 h-3.5" />
                    {presentVsAbsentTrendData.presentDiff} Present Attendees
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* GRAPH 2: PLOTTED ABSENT COUNT VS. FOLLOW-UP WORK DONE RATE (%)            */}
      {/* ========================================================================= */}
      {(layoutMode === 'STACKED' || activeChartTab === 'ABSENT_VS_WORK') && (() => {
        const weeksCount = absentVsWorkData.weeklyData.length;
        const maxAbs = Math.max(absentVsWorkData.maxAbsent, 1);

        const absentPoints = absentVsWorkData.weeklyData.map(d => ({
          x: getWeekX(d.week, Math.max(weeksCount, 2)),
          y: PLOT_PAD_TOP + (1 - d.absentCount / maxAbs) * PLOT_HEIGHT,
          val: d.absentCount,
          week: d.week
        }));

        const workRatePoints = absentVsWorkData.weeklyData.map(d => ({
          x: getWeekX(d.week, Math.max(weeksCount, 2)),
          y: PLOT_PAD_TOP + (1 - d.workRate / 100) * PLOT_HEIGHT,
          val: d.workRate,
          week: d.week
        }));

        const absentCurve = buildSvgCurvePath(absentPoints);
        const absentArea = buildSvgAreaPath(absentPoints, PLOT_BASELINE_Y);
        const workCurve = buildSvgCurvePath(workRatePoints);
        const workArea = buildSvgAreaPath(workRatePoints, PLOT_BASELINE_Y);

        const yTicks = [1.0, 0.75, 0.5, 0.25, 0.0].map(ratio => ({
          ratio,
          absVal: Math.round(maxAbs * ratio),
          rateVal: Math.round(100 * ratio),
          y: PLOT_PAD_TOP + (1 - ratio) * PLOT_HEIGHT
        }));

        return (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 ring-2 ring-rose-200" />
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Graph 2: Absent Count vs. Follow-Up Work Done Rate (%) Plotted Trend
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Correlates absentee volume against follow-up work done across all 4 pillars. Inverse correlation: As follow-up work climbs, absenteeism drops.
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-50 px-3.5 py-1.5 rounded-xl border border-amber-300">
                <Activity className="w-4 h-4 text-amber-600" />
                Avg. Absentee Outreach Rate: <strong>{absentVsWorkData.avgWorkRate}%</strong>
              </span>
            </div>

            {/* Plotted SVG Canvas */}
            <div className="w-full bg-slate-900/95 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-inner overflow-hidden relative">
              <div className="flex items-center justify-between text-xs text-slate-300 pb-2 border-b border-slate-800/80 mb-1">
                <span className="font-semibold text-slate-400">
                  Left Axis: <strong className="text-rose-400">Absent Members</strong> | Right Axis: <strong className="text-purple-400">Follow-Up Work Done %</strong>
                </span>
                <div className="flex items-center gap-4 text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <span className="w-3 h-1 bg-rose-400 rounded-full inline-block" />
                    Absent Count (Red)
                  </span>
                  <span className="flex items-center gap-1.5 text-purple-400">
                    <span className="w-3 h-1 bg-purple-400 rounded-full inline-block" />
                    Work Rate % (Purple)
                  </span>
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <svg viewBox="0 0 1000 320" className="w-full h-auto min-w-[720px] select-none">
                  <defs>
                    <linearGradient id="gradAbsG2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="gradWorkG2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  <rect
                    x={PLOT_PAD_LEFT}
                    y={PLOT_PAD_TOP - 15}
                    width={PLOT_WIDTH}
                    height={PLOT_HEIGHT + 15}
                    rx="12"
                    fill="#0f172a"
                    fillOpacity="0.85"
                    stroke="#1e293b"
                    strokeWidth="1"
                  />

                  {yTicks.map(t => (
                    <g key={t.ratio}>
                      <line
                        x1={PLOT_PAD_LEFT}
                        y1={t.y}
                        x2={PLOT_PAD_LEFT + PLOT_WIDTH}
                        y2={t.y}
                        stroke="#334155"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                        strokeOpacity="0.6"
                      />
                      <text x={PLOT_PAD_LEFT - 10} y={t.y + 4} textAnchor="end" className="text-[10px] font-bold fill-rose-400">
                        {t.absVal}
                      </text>
                      <text x={PLOT_PAD_LEFT + PLOT_WIDTH + 10} y={t.y + 4} textAnchor="start" className="text-[10px] font-bold fill-purple-400">
                        {t.rateVal}%
                      </text>
                    </g>
                  ))}

                  {absentPoints.map(p => (
                    <g key={`x-wk-${p.week}`}>
                      <line x1={p.x} y1={PLOT_PAD_TOP - 15} x2={p.x} y2={PLOT_BASELINE_Y} stroke="#1e293b" strokeWidth="1" />
                      <text x={p.x} y={PLOT_BASELINE_Y + 22} textAnchor="middle" className="text-[11px] font-black fill-slate-400">
                        W{p.week}
                      </text>
                    </g>
                  ))}

                  <path d={absentArea} fill="url(#gradAbsG2)" />
                  <path d={workArea} fill="url(#gradWorkG2)" />

                  <path d={absentCurve} fill="none" stroke="#f43f5e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={workCurve} fill="none" stroke="#a855f7" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Plotted Dots (Red: Absent) */}
                  {absentPoints.map(p => (
                    <g key={`dot-abs-${p.week}`}>
                      <circle cx={p.x} cy={p.y} r="8" fill="#f43f5e" fillOpacity="0.25" />
                      <circle cx={p.x} cy={p.y} r="5" fill="#ffffff" stroke="#f43f5e" strokeWidth="3" />
                      <rect x={p.x - 14} y={p.y - 23} width="28" height="16" rx="4" fill="#881337" stroke="#e11d48" strokeWidth="1" />
                      <text x={p.x} y={p.y - 11} textAnchor="middle" className="text-[9px] font-black fill-rose-200">
                        {p.val}
                      </text>
                    </g>
                  ))}

                  {/* Plotted Dots (Purple: Work Rate %) */}
                  {workRatePoints.map(w => (
                    <g key={`dot-wr-${w.week}`}>
                      <circle cx={w.x} cy={w.y} r="8" fill="#a855f7" fillOpacity="0.25" />
                      <circle cx={w.x} cy={w.y} r="5" fill="#ffffff" stroke="#a855f7" strokeWidth="3" />
                      <rect x={w.x - 16} y={w.y + 9} width="32" height="16" rx="4" fill="#581c87" stroke="#9333ea" strokeWidth="1" />
                      <text x={w.x} y={w.y + 21} textAnchor="middle" className="text-[9px] font-black fill-purple-200">
                        {w.val}%
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Optional Weekly Breakdown Columns if COMBINED mode */}
            {graphDisplayMode === 'COMBINED' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
                {absentVsWorkData.weeklyData.map(d => (
                  <div key={d.week} className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-1.5 text-center">
                    <span className="text-xs font-black text-slate-700 uppercase block">Week {d.week}</span>
                    <span className="text-sm font-black text-rose-700 block">{d.absentCount} Absent</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 inline-block">
                      {d.workRate}% Follow-Up Done
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Insight Alert */}
            <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
              <TrendingDown className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-950 leading-relaxed">
                <strong className="font-black">Operational Follow-Up Objective:</strong> As the Follow-Up Work Completed Rate rises toward 100%, absenteeism drops in the ensuing weeks. When follow-up on absentees lags, consecutive absenteeism compounds.
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* GRAPH 3: PLOTTED PRESENT MEMBERS VS. RETENTION CARE WORK RATE (%)         */}
      {/* ========================================================================= */}
      {(layoutMode === 'STACKED' || activeChartTab === 'PRESENT_VS_WORK') && (() => {
        const weeksCount = presentVsWorkData.weeklyData.length;
        const maxPres = Math.max(presentVsWorkData.maxPresent, 1);

        const presentPoints = presentVsWorkData.weeklyData.map(d => ({
          x: getWeekX(d.week, Math.max(weeksCount, 2)),
          y: PLOT_PAD_TOP + (1 - d.presentCount / maxPres) * PLOT_HEIGHT,
          val: d.presentCount,
          week: d.week
        }));

        const retentionPoints = presentVsWorkData.weeklyData.map(d => ({
          x: getWeekX(d.week, Math.max(weeksCount, 2)),
          y: PLOT_PAD_TOP + (1 - d.retentionWorkRate / 100) * PLOT_HEIGHT,
          val: d.retentionWorkRate,
          week: d.week
        }));

        const presentCurve = buildSvgCurvePath(presentPoints);
        const presentArea = buildSvgAreaPath(presentPoints, PLOT_BASELINE_Y);
        const retentionCurve = buildSvgCurvePath(retentionPoints);
        const retentionArea = buildSvgAreaPath(retentionPoints, PLOT_BASELINE_Y);

        const yTicks = [1.0, 0.75, 0.5, 0.25, 0.0].map(ratio => ({
          ratio,
          presVal: Math.round(maxPres * ratio),
          rateVal: Math.round(100 * ratio),
          y: PLOT_PAD_TOP + (1 - ratio) * PLOT_HEIGHT
        }));

        return (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-200" />
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Graph 3: Present Members vs. Retention Care Work Rate (%) Plotted Trend
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Tracks active attendees alongside retention care efforts (SSSR Thank-You deliveries, upcoming Sunday class reminders, and consistency care).
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-900 bg-blue-50 px-3.5 py-1.5 rounded-xl border border-blue-200">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                Avg. Retention Care Rate: <strong>{presentVsWorkData.avgRetentionRate}%</strong>
              </span>
            </div>

            {/* Plotted SVG Canvas */}
            <div className="w-full bg-slate-900/95 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-inner overflow-hidden relative">
              <div className="flex items-center justify-between text-xs text-slate-300 pb-2 border-b border-slate-800/80 mb-1">
                <span className="font-semibold text-slate-400">
                  Left Axis: <strong className="text-emerald-400">Present Attendees</strong> | Right Axis: <strong className="text-blue-400">Retention Care Rate %</strong>
                </span>
                <div className="flex items-center gap-4 text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-3 h-1 bg-emerald-400 rounded-full inline-block" />
                    Present Attendees (Green)
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <span className="w-3 h-1 bg-blue-400 rounded-full inline-block" />
                    Retention Care % (Blue)
                  </span>
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <svg viewBox="0 0 1000 320" className="w-full h-auto min-w-[720px] select-none">
                  <defs>
                    <linearGradient id="gradPresG3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="gradRetG3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  <rect
                    x={PLOT_PAD_LEFT}
                    y={PLOT_PAD_TOP - 15}
                    width={PLOT_WIDTH}
                    height={PLOT_HEIGHT + 15}
                    rx="12"
                    fill="#0f172a"
                    fillOpacity="0.85"
                    stroke="#1e293b"
                    strokeWidth="1"
                  />

                  {yTicks.map(t => (
                    <g key={t.ratio}>
                      <line
                        x1={PLOT_PAD_LEFT}
                        y1={t.y}
                        x2={PLOT_PAD_LEFT + PLOT_WIDTH}
                        y2={t.y}
                        stroke="#334155"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                        strokeOpacity="0.6"
                      />
                      <text x={PLOT_PAD_LEFT - 10} y={t.y + 4} textAnchor="end" className="text-[10px] font-bold fill-emerald-400">
                        {t.presVal}
                      </text>
                      <text x={PLOT_PAD_LEFT + PLOT_WIDTH + 10} y={t.y + 4} textAnchor="start" className="text-[10px] font-bold fill-blue-400">
                        {t.rateVal}%
                      </text>
                    </g>
                  ))}

                  {presentPoints.map(p => (
                    <g key={`x-wk-g3-${p.week}`}>
                      <line x1={p.x} y1={PLOT_PAD_TOP - 15} x2={p.x} y2={PLOT_BASELINE_Y} stroke="#1e293b" strokeWidth="1" />
                      <text x={p.x} y={PLOT_BASELINE_Y + 22} textAnchor="middle" className="text-[11px] font-black fill-slate-400">
                        W{p.week}
                      </text>
                    </g>
                  ))}

                  <path d={presentArea} fill="url(#gradPresG3)" />
                  <path d={retentionArea} fill="url(#gradRetG3)" />

                  <path d={presentCurve} fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={retentionCurve} fill="none" stroke="#3b82f6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Plotted Dots (Green: Present) */}
                  {presentPoints.map(p => (
                    <g key={`dot-pres-${p.week}`}>
                      <circle cx={p.x} cy={p.y} r="8" fill="#10b981" fillOpacity="0.25" />
                      <circle cx={p.x} cy={p.y} r="5" fill="#ffffff" stroke="#10b981" strokeWidth="3" />
                      <rect x={p.x - 14} y={p.y - 23} width="28" height="16" rx="4" fill="#064e3b" stroke="#059669" strokeWidth="1" />
                      <text x={p.x} y={p.y - 11} textAnchor="middle" className="text-[9px] font-black fill-emerald-200">
                        {p.val}
                      </text>
                    </g>
                  ))}

                  {/* Plotted Dots (Blue: Retention Care %) */}
                  {retentionPoints.map(r => (
                    <g key={`dot-ret-${r.week}`}>
                      <circle cx={r.x} cy={r.y} r="8" fill="#3b82f6" fillOpacity="0.25" />
                      <circle cx={r.x} cy={r.y} r="5" fill="#ffffff" stroke="#3b82f6" strokeWidth="3" />
                      <rect x={r.x - 16} y={r.y + 9} width="32" height="16" rx="4" fill="#1e3a8a" stroke="#2563eb" strokeWidth="1" />
                      <text x={r.x} y={r.y + 21} textAnchor="middle" className="text-[9px] font-black fill-blue-200">
                        {r.val}%
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* GRAPH 4: PLOTTED TOTAL MEMBERS VS. OVERALL WORK EXECUTION RATE (%)        */}
      {/* ========================================================================= */}
      {(layoutMode === 'STACKED' || activeChartTab === 'TOTAL_VS_WORK') && (() => {
        const weeksCount = totalVsWorkData.weeklyData.length;
        const maxEnrolled = Math.max(totalVsWorkData.totalEnrolled, 10);

        const enrolledPoints = totalVsWorkData.weeklyData.map(d => ({
          x: getWeekX(d.week, Math.max(weeksCount, 2)),
          y: PLOT_PAD_TOP + (1 - d.totalEnrolled / maxEnrolled) * PLOT_HEIGHT,
          val: d.totalEnrolled,
          week: d.week
        }));

        const executionPoints = totalVsWorkData.weeklyData.map(d => ({
          x: getWeekX(d.week, Math.max(weeksCount, 2)),
          y: PLOT_PAD_TOP + (1 - d.overallRate / 100) * PLOT_HEIGHT,
          val: d.overallRate,
          week: d.week
        }));

        const enrolledCurve = buildSvgCurvePath(enrolledPoints);
        const executionCurve = buildSvgCurvePath(executionPoints);
        const executionArea = buildSvgAreaPath(executionPoints, PLOT_BASELINE_Y);

        const yTicks = [1.0, 0.75, 0.5, 0.25, 0.0].map(ratio => ({
          ratio,
          enrVal: Math.round(maxEnrolled * ratio),
          rateVal: Math.round(100 * ratio),
          y: PLOT_PAD_TOP + (1 - ratio) * PLOT_HEIGHT
        }));

        return (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500 ring-2 ring-purple-200" />
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Graph 4: Total Enrolled Roster vs. Overall Follow-Up Work Rate (%) Plotted Trend
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Aggregates both present and absent members to chart the total follow-up outreach percentage executed across the roster.
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-900 bg-purple-50 px-3.5 py-1.5 rounded-xl border border-purple-200">
                <Users className="w-4 h-4 text-purple-600" />
                Total Class Roster: <strong>{totalVsWorkData.totalEnrolled} Members</strong>
              </span>
            </div>

            {/* Plotted SVG Canvas */}
            <div className="w-full bg-slate-900/95 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-inner overflow-hidden relative">
              <div className="flex items-center justify-between text-xs text-slate-300 pb-2 border-b border-slate-800/80 mb-1">
                <span className="font-semibold text-slate-400">
                  Left Axis: <strong className="text-indigo-400">Total Enrolled</strong> | Right Axis: <strong className="text-purple-400">Overall Follow-Up Executed %</strong>
                </span>
                <div className="flex items-center gap-4 text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-indigo-400">
                    <span className="w-3 h-1 bg-indigo-400 rounded-full inline-block" />
                    Enrolled Roster (Indigo)
                  </span>
                  <span className="flex items-center gap-1.5 text-purple-400">
                    <span className="w-3 h-1 bg-purple-400 rounded-full inline-block" />
                    Execution Rate % (Purple)
                  </span>
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <svg viewBox="0 0 1000 320" className="w-full h-auto min-w-[720px] select-none">
                  <defs>
                    <linearGradient id="gradExecG4" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c084fc" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#c084fc" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  <rect
                    x={PLOT_PAD_LEFT}
                    y={PLOT_PAD_TOP - 15}
                    width={PLOT_WIDTH}
                    height={PLOT_HEIGHT + 15}
                    rx="12"
                    fill="#0f172a"
                    fillOpacity="0.85"
                    stroke="#1e293b"
                    strokeWidth="1"
                  />

                  {yTicks.map(t => (
                    <g key={t.ratio}>
                      <line
                        x1={PLOT_PAD_LEFT}
                        y1={t.y}
                        x2={PLOT_PAD_LEFT + PLOT_WIDTH}
                        y2={t.y}
                        stroke="#334155"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                        strokeOpacity="0.6"
                      />
                      <text x={PLOT_PAD_LEFT - 10} y={t.y + 4} textAnchor="end" className="text-[10px] font-bold fill-indigo-400">
                        {t.enrVal}
                      </text>
                      <text x={PLOT_PAD_LEFT + PLOT_WIDTH + 10} y={t.y + 4} textAnchor="start" className="text-[10px] font-bold fill-purple-400">
                        {t.rateVal}%
                      </text>
                    </g>
                  ))}

                  {enrolledPoints.map(p => (
                    <g key={`x-wk-g4-${p.week}`}>
                      <line x1={p.x} y1={PLOT_PAD_TOP - 15} x2={p.x} y2={PLOT_BASELINE_Y} stroke="#1e293b" strokeWidth="1" />
                      <text x={p.x} y={PLOT_BASELINE_Y + 22} textAnchor="middle" className="text-[11px] font-black fill-slate-400">
                        W{p.week}
                      </text>
                    </g>
                  ))}

                  <path d={executionArea} fill="url(#gradExecG4)" />
                  <path d={enrolledCurve} fill="none" stroke="#6366f1" strokeWidth="3" strokeDasharray="5 5" />
                  <path d={executionCurve} fill="none" stroke="#c084fc" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Plotted Dots (Purple: Execution %) */}
                  {executionPoints.map(e => (
                    <g key={`dot-exec-${e.week}`}>
                      <circle cx={e.x} cy={e.y} r="8" fill="#c084fc" fillOpacity="0.25" />
                      <circle cx={e.x} cy={e.y} r="5" fill="#ffffff" stroke="#a855f7" strokeWidth="3" />
                      <rect x={e.x - 16} y={e.y - 23} width="32" height="16" rx="4" fill="#581c87" stroke="#a855f7" strokeWidth="1" />
                      <text x={e.x} y={e.y - 11} textAnchor="middle" className="text-[9px] font-black fill-purple-200">
                        {e.val}%
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* GRAPH 5: PLOTTED EVANGELISM TREND (NEW JOINERS & RETURNERS)               */}
      {/* ========================================================================= */}
      {(layoutMode === 'STACKED' || activeChartTab === 'EVANGELISM_TREND') && (() => {
        const maxE = Math.max(evangelismTrendData.maxEvangelismVal, 1);

        const joinedPoints = evangelismTrendData.weeklyAdditions.map(item => ({
          x: getWeekX(item.week),
          y: PLOT_PAD_TOP + (1 - item.addedCount / maxE) * PLOT_HEIGHT,
          val: item.addedCount,
          week: item.week
        }));

        const returnedPoints = evangelismTrendData.weeklyAdditions.map(item => ({
          x: getWeekX(item.week),
          y: PLOT_PAD_TOP + (1 - item.returnedCount / maxE) * PLOT_HEIGHT,
          val: item.returnedCount,
          returnRate: item.returnRate,
          week: item.week
        }));

        const joinedCurve = buildSvgCurvePath(joinedPoints);
        const joinedArea = buildSvgAreaPath(joinedPoints, PLOT_BASELINE_Y);
        const returnedCurve = buildSvgCurvePath(returnedPoints);
        const returnedArea = buildSvgAreaPath(returnedPoints, PLOT_BASELINE_Y);

        const yTicks = [1.0, 0.75, 0.5, 0.25, 0.0].map(ratio => ({
          ratio,
          val: Math.round(maxE * ratio),
          y: PLOT_PAD_TOP + (1 - ratio) * PLOT_HEIGHT
        }));

        return (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-amber-200" />
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Graph 5: Evangelism Plotted Trend — New Persons Joined vs. Returned Next Week
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Tracks newly introduced attendees each week (Amber) alongside how many from that cohort returned the following week (Emerald).
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-900 bg-amber-50 px-3.5 py-1.5 rounded-xl border border-amber-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Total New Joined: <strong>{evangelismTrendData.totalNewJoined}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-900 bg-emerald-50 px-3.5 py-1.5 rounded-xl border border-emerald-300">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  1-Week Retention: <strong>{evangelismTrendData.overallRetentionPercentage}%</strong>
                </span>
              </div>
            </div>

            {/* Plotted SVG Canvas */}
            <div className="w-full bg-slate-900/95 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-inner overflow-hidden relative">
              <div className="flex items-center justify-between text-xs text-slate-300 pb-2 border-b border-slate-800/80 mb-1">
                <span className="font-semibold text-slate-400">
                  Plotted Weekly Flow: <strong className="text-amber-400">New Joined (Wk W)</strong> vs <strong className="text-emerald-400">Returned (Wk W+1)</strong>
                </span>
                <div className="flex items-center gap-4 text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <span className="w-3 h-1 bg-amber-400 rounded-full inline-block" />
                    New Joiners (Amber)
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-3 h-1 bg-emerald-400 rounded-full inline-block" />
                    Returned Next Week (Green)
                  </span>
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <svg viewBox="0 0 1000 320" className="w-full h-auto min-w-[720px] select-none">
                  <defs>
                    <linearGradient id="gradJoinG5" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="gradRetG5" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.38" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  <rect
                    x={PLOT_PAD_LEFT}
                    y={PLOT_PAD_TOP - 15}
                    width={PLOT_WIDTH}
                    height={PLOT_HEIGHT + 15}
                    rx="12"
                    fill="#0f172a"
                    fillOpacity="0.85"
                    stroke="#1e293b"
                    strokeWidth="1"
                  />

                  {yTicks.map(t => (
                    <g key={t.ratio}>
                      <line
                        x1={PLOT_PAD_LEFT}
                        y1={t.y}
                        x2={PLOT_PAD_LEFT + PLOT_WIDTH}
                        y2={t.y}
                        stroke="#334155"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                        strokeOpacity="0.6"
                      />
                      <text x={PLOT_PAD_LEFT - 10} y={t.y + 4} textAnchor="end" className="text-[10px] font-bold fill-slate-400">
                        {t.val}
                      </text>
                    </g>
                  ))}

                  {joinedPoints.map(p => (
                    <g key={`x-wk-g5-${p.week}`}>
                      <line x1={p.x} y1={PLOT_PAD_TOP - 15} x2={p.x} y2={PLOT_BASELINE_Y} stroke="#1e293b" strokeWidth="1" />
                      <text x={p.x} y={PLOT_BASELINE_Y + 22} textAnchor="middle" className="text-[11px] font-black fill-slate-400">
                        W{p.week}
                      </text>
                    </g>
                  ))}

                  <path d={joinedArea} fill="url(#gradJoinG5)" />
                  <path d={returnedArea} fill="url(#gradRetG5)" />

                  <path d={joinedCurve} fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={returnedCurve} fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Plotted Dots (Amber: Joined) */}
                  {joinedPoints.map(p => (
                    <g key={`dot-join-${p.week}`}>
                      <circle cx={p.x} cy={p.y} r="8" fill="#f59e0b" fillOpacity="0.25" />
                      <circle cx={p.x} cy={p.y} r="5" fill="#ffffff" stroke="#f59e0b" strokeWidth="3" />
                      <rect x={p.x - 14} y={p.y - 23} width="28" height="16" rx="4" fill="#78350f" stroke="#d97706" strokeWidth="1" />
                      <text x={p.x} y={p.y - 11} textAnchor="middle" className="text-[9px] font-black fill-amber-200">
                        {p.val}
                      </text>
                    </g>
                  ))}

                  {/* Plotted Dots (Green: Returned) */}
                  {returnedPoints.map(r => (
                    <g key={`dot-ret-${r.week}`}>
                      <circle cx={r.x} cy={r.y} r="8" fill="#10b981" fillOpacity="0.25" />
                      <circle cx={r.x} cy={r.y} r="5" fill="#ffffff" stroke="#10b981" strokeWidth="3" />
                      <rect x={r.x - 14} y={r.y + 9} width="28" height="16" rx="4" fill="#064e3b" stroke="#059669" strokeWidth="1" />
                      <text x={r.x} y={r.y + 21} textAnchor="middle" className="text-[9px] font-black fill-emerald-200">
                        {r.val}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* GRAPH 6: ABSENCE URGENCY HISTOGRAM (WEEKLY ACTION TIERS - PRESERVED)       */}
      {/* ========================================================================= */}
      {(layoutMode === 'STACKED' || activeChartTab === 'URGENCY_HISTOGRAM') && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 ring-2 ring-rose-200" />
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Graph 6: Absence Urgency Indicator Histogram (Weekly Action Tiers)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Stratifies absentees into 5 deterministic operational stages: Call/WhatsApp (1 wk), Phone Call (2 wks), Visitation (3 wks), Officer Attention (4-5 wks), Urgent Review (6+ wks).
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-black text-slate-700 bg-slate-100 px-3.5 py-1.5 rounded-full">
              Total Absentees: {urgencyHistogramData.totalAbsentees}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
            {urgencyHistogramData.bins.map(bin => {
              const heightPct = Math.max(12, Math.round((bin.count / urgencyHistogramData.maxCount) * 100));

              return (
                <div
                  key={bin.id}
                  className={`rounded-2xl border ${bin.borderColor} ${bin.chipBg}/40 p-4 flex flex-col justify-between space-y-4 transition hover:shadow-md`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                        {bin.label}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${bin.chipBg} ${bin.textColor}`}>
                        {bin.percentage}%
                      </span>
                    </div>
                    <span className="text-3xl font-black text-slate-900 block">
                      {bin.count}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 block">
                      {bin.urgency}
                    </span>
                  </div>

                  <div className="w-full bg-white/80 rounded-xl h-24 p-1.5 flex flex-col justify-end">
                    <div
                      className={`w-full ${bin.bgColor} rounded-lg transition-all duration-500`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                      Required Action:
                    </span>
                    <span className={`text-[11px] font-bold ${bin.textColor} block mt-0.5 leading-snug`}>
                      {bin.action}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
