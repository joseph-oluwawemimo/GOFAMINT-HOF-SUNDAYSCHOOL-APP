import React, { useState } from 'react';
import {
  Trophy,
  Award,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
  Info,
  Layers,
  ChevronRight
} from 'lucide-react';
import type { WeekClusterPoint, CategoryRates } from '../utils/fairnessScoring';
import { formatRate } from '../utils/fairnessScoring';

export type StudentClusterMetric =
  | 'ALL_CLUSTER'
  | 'DILIGENCE_RATE'
  | 'MEMORY_VERSE'
  | 'PUNCTUALITY'
  | 'PARTICIPATION'
  | 'LESSON_TOTAL';

interface Props {
  memberName: string;
  memberType: 'STUDENT' | 'VISITOR';
  className?: string;
  isAwardEligible: boolean;
  awardEligibilityLabel: string;
  rankings: {
    overall: number;
    memoryVerse: number;
    punctuality: number;
    participation: number;
    totalInClass: number;
    totalEligibleInClass?: number;
  };
  rates: {
    overall: CategoryRates;
    memoryVerse: CategoryRates;
    punctuality: CategoryRates;
    participation: CategoryRates;
  };
  clusterWeeks: WeekClusterPoint[];
  classAverages?: {
    overallRaw: number;
    memoryRaw: number;
    punctualityRaw: number;
    participationRaw: number;
  };
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const StudentClassPerformanceGraph: React.FC<Props> = ({
  memberName,
  memberType,
  className = 'Sunday School Class',
  isAwardEligible,
  awardEligibilityLabel,
  rankings,
  rates,
  clusterWeeks,
  classAverages
}) => {
  const [selectedMetric, setSelectedMetric] = useState<StudentClusterMetric>('ALL_CLUSTER');
  const [selectedWeekPopup, setSelectedWeekPopup] = useState<WeekClusterPoint | null>(null);

  const totalStudents = rankings.totalInClass || 1;

  // SVG coordinate setup for 12 lessons
  const svgWidth = 560;
  const svgHeight = 220;
  const padLeft = 40;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 34;

  const chartWidth = svgWidth - padLeft - padRight;
  const chartHeight = svgHeight - padTop - padBottom;

  const getX = (wk: number) => {
    return padLeft + ((wk - 1) / 11) * chartWidth;
  };

  const getYPercent = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    return padTop + chartHeight - (clamped / 100) * chartHeight;
  };

  // Metrics colors
  const metricColors = {
    diligence: { stroke: '#4318ff', label: 'Diligence Rate', unit: '%' },
    memory: { stroke: '#d97706', label: 'Memory Verse', unit: '%' },
    punctuality: { stroke: '#059669', label: 'Punctuality', unit: '%' },
    participation: { stroke: '#7c3aed', label: 'Participation', unit: '%' },
    total: { stroke: '#0284c7', label: 'Total Score', unit: 'pts' }
  };

  // Calculate points for the selected metric
  const pointsForMetric = (metric: StudentClusterMetric) => {
    return (clusterWeeks || []).map(w => {
      let pct = 0;
      if (metric === 'DILIGENCE_RATE') {
        pct = w.diligenceRate || 0;
      } else if (metric === 'MEMORY_VERSE') {
        pct = (w.memoryVerse / 15) * 100;
      } else if (metric === 'PUNCTUALITY') {
        pct = (w.punctuality / 15) * 100;
      } else if (metric === 'PARTICIPATION') {
        pct = (w.participation / 20) * 100;
      } else if (metric === 'LESSON_TOTAL') {
        pct = (w.points / 50) * 100;
      }

      return {
        week: w.weekNumber,
        pct: Math.round(pct),
        isEligible: w.isEligible,
        attendance: w.attendance,
        rawWeek: w,
        x: getX(w.weekNumber),
        y: getYPercent(pct)
      };
    });
  };

  const activePoints = pointsForMetric(selectedMetric === 'ALL_CLUSTER' ? 'DILIGENCE_RATE' : selectedMetric);

  // Eligible line path (only connects eligible/completed lessons)
  const eligiblePoints = activePoints.filter(p => p.isEligible);
  const pathD = eligiblePoints.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
  }, '');

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm space-y-6">
      
      {/* 1. Header: Class Standing & Security Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-indigo-900 text-[10px] font-black uppercase tracking-wider mb-1">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>Class Performance & Confidential Ranking</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900">
            {memberName}'s Class Standing in {className}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Your individual performance and rank among {totalStudents} member(s). Other students' records remain private.
          </p>
        </div>

        {/* Award Eligibility Badge */}
        <div className="shrink-0 flex items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 border shadow-2xs ${
              isAwardEligible
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-amber-50 text-amber-900 border-amber-300'
            }`}
          >
            <Award className="w-4 h-4 text-amber-500" />
            <span>{awardEligibilityLabel}</span>
          </span>
        </div>
      </div>

      {/* 2. Four Category Ranking Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Overall Performance */}
        <div className="bg-gradient-to-br from-indigo-950 to-slate-900 text-white p-4 rounded-2xl shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">
              Overall Rank
            </span>
            <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center">
              #{rankings.overall}
            </span>
          </div>
          <div className="text-2xl font-black text-amber-300">
            {getOrdinalSuffix(rankings.overall)}
            <span className="text-xs font-normal text-indigo-200 ml-1">in Class</span>
          </div>
          <div className="pt-1 border-t border-white/10 flex justify-between text-[11px]">
            <span className="text-indigo-200">Raw Rate:</span>
            <span className="font-bold text-white">{formatRate(rates.overall.rawRate)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-amber-200">Fair Rate:</span>
            <span className="font-black text-amber-300">{formatRate(rates.overall.adjustedRate)}</span>
          </div>
        </div>

        {/* Card 2: Memory Verse Recitation */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Memory Verse
            </span>
            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              #{rankings.memoryVerse}
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {getOrdinalSuffix(rankings.memoryVerse)}
            <span className="text-xs font-normal text-slate-500 ml-1">in Class</span>
          </div>
          <div className="pt-1 border-t border-slate-200 flex justify-between text-[11px]">
            <span className="text-slate-500">Raw Rate:</span>
            <span className="font-bold text-slate-800">{formatRate(rates.memoryVerse.rawRate)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Fair Rate:</span>
            <span className="font-black text-indigo-900">{formatRate(rates.memoryVerse.adjustedRate)}</span>
          </div>
        </div>

        {/* Card 3: Punctuality */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Punctuality
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              #{rankings.punctuality}
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {getOrdinalSuffix(rankings.punctuality)}
            <span className="text-xs font-normal text-slate-500 ml-1">in Class</span>
          </div>
          <div className="pt-1 border-t border-slate-200 flex justify-between text-[11px]">
            <span className="text-slate-500">Raw Rate:</span>
            <span className="font-bold text-slate-800">{formatRate(rates.punctuality.rawRate)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Fair Rate:</span>
            <span className="font-black text-indigo-900">{formatRate(rates.punctuality.adjustedRate)}</span>
          </div>
        </div>

        {/* Card 4: Class Participation */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Participation
            </span>
            <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
              #{rankings.participation}
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {getOrdinalSuffix(rankings.participation)}
            <span className="text-xs font-normal text-slate-500 ml-1">in Class</span>
          </div>
          <div className="pt-1 border-t border-slate-200 flex justify-between text-[11px]">
            <span className="text-slate-500">Raw Rate:</span>
            <span className="font-bold text-slate-800">{formatRate(rates.participation.rawRate)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Fair Rate:</span>
            <span className="font-black text-indigo-900">{formatRate(rates.participation.adjustedRate)}</span>
          </div>
        </div>
      </div>

      {/* 3. 12-Lesson Performance Cluster & Trajectory Graph */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-3xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#4318ff]" />
              <span>12-Lesson Performance Cluster (Lesson 1 — Lesson 12)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Track how your diligence, memory verses, punctuality, and participation develop week to week.
            </p>
          </div>

          {/* Metric Switcher Pills */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 overflow-x-auto max-w-full">
            {[
              { id: 'ALL_CLUSTER', label: 'All Cluster' },
              { id: 'DILIGENCE_RATE', label: 'Diligence %' },
              { id: 'MEMORY_VERSE', label: 'Memory Verse' },
              { id: 'PUNCTUALITY', label: 'Punctuality' },
              { id: 'PARTICIPATION', label: 'Participation' },
              { id: 'LESSON_TOTAL', label: 'Total Pts' }
            ].map(m => (
              <button
                key={m.id}
                type="button"
                id={`btn-cluster-metric-${m.id.toLowerCase()}`}
                onClick={() => setSelectedMetric(m.id as StudentClusterMetric)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedMetric === m.id
                    ? 'bg-[#4318ff] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* SVG Curve Plot */}
        <div className="relative w-full overflow-x-auto pt-2">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-56 select-none">
            {/* Grid Lines */}
            {[0, 25, 50, 75, 100].map(pct => {
              const y = getYPercent(pct);
              return (
                <g key={pct}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={svgWidth - padRight}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    strokeDasharray={pct === 0 ? undefined : '3,3'}
                  />
                  <text
                    x={padLeft - 6}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="9"
                    fill="#94a3b8"
                    fontWeight="bold"
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Vertical Week Guides */}
            {Array.from({ length: 12 }, (_, i) => i + 1).map(wk => {
              const x = getX(wk);
              const point = activePoints.find(p => p.week === wk);
              const isSelected = selectedWeekPopup?.weekNumber === wk;
              return (
                <g key={wk} className="cursor-pointer" onClick={() => setSelectedWeekPopup(point?.rawWeek || null)}>
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={padTop + chartHeight}
                    stroke={isSelected ? '#4318ff' : '#f1f5f9'}
                    strokeWidth={isSelected ? '2' : '1'}
                    strokeDasharray={isSelected ? undefined : '2,2'}
                  />
                  <text
                    x={x}
                    y={svgHeight - 10}
                    textAnchor="middle"
                    fontSize={isSelected ? '11' : '10'}
                    fontWeight={isSelected ? '900' : '600'}
                    fill={isSelected ? '#4318ff' : '#64748b'}
                  >
                    L{wk}
                  </text>
                </g>
              );
            })}

            {/* Path for eligible lessons */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="#4318ff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Point Nodes */}
            {activePoints.map(pt => {
              const isSelected = selectedWeekPopup?.weekNumber === pt.week;
              if (!pt.isEligible) {
                // Not eligible or future lesson node
                return (
                  <circle
                    key={pt.week}
                    cx={pt.x}
                    cy={padTop + chartHeight}
                    r={3}
                    fill="#cbd5e1"
                    className="cursor-pointer"
                    onClick={() => setSelectedWeekPopup(pt.rawWeek)}
                  />
                );
              }

              const isPresent = pt.attendance === 'PRESENT';
              return (
                <g key={pt.week} className="cursor-pointer" onClick={() => setSelectedWeekPopup(pt.rawWeek)}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 6 : 4}
                    fill={isPresent ? '#4318ff' : '#ef4444'}
                    stroke="#ffffff"
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    className="transition-all hover:scale-125"
                  />
                  {/* Score pill on hover/selected */}
                  {isSelected && (
                    <text
                      x={pt.x}
                      y={pt.y - 10}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="900"
                      fill="#4318ff"
                    >
                      {pt.pct}%
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Lesson Detail Drawer / Tooltip Strip */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
          {selectedWeekPopup ? (
            <div className="flex items-center gap-3 flex-wrap w-full">
              <span className="font-black text-[#4318ff] bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                Lesson {selectedWeekPopup.weekNumber} Details
              </span>
              <span className="font-bold text-slate-700">
                Attendance: <strong>{selectedWeekPopup.attendance}</strong>
              </span>
              <span className="text-slate-500">
                Punctuality: <strong>{selectedWeekPopup.punctuality}/15</strong>
              </span>
              <span className="text-slate-500">
                Memory Verse: <strong>{selectedWeekPopup.memoryVerse}/15</strong>
              </span>
              <span className="text-slate-500">
                Participation: <strong>{selectedWeekPopup.participation}/20</strong>
              </span>
              <span className="font-black text-indigo-950 ml-auto">
                Total Score: {selectedWeekPopup.points}/50 pts
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
              <Info className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Click any lesson node (L1 — L12) on the graph to inspect that week's complete scoring breakdown.</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Educational Note on Reliability & Fairness */}
      <div className="bg-indigo-50/50 border border-indigo-200/60 rounded-2xl p-4 text-xs text-indigo-950 leading-relaxed space-y-1">
        <p className="font-black text-[11px] uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-indigo-700" />
          <span>About Fair Adjusted Scoring & Confidentiality</span>
        </p>
        <p className="text-[11px] text-slate-600">
          • <strong>Raw Rate:</strong> Represents your exact percentage earned over the lessons you were eligible for.
        </p>
        <p className="text-[11px] text-slate-600">
          • <strong>Fair/Adjusted Rate:</strong> Uses mathematical reliability shrinkage so late joiners are not penalized for previous weeks while rewarding sustained consistency.
        </p>
        <p className="text-[11px] text-slate-600">
          • <strong>Student Privacy:</strong> To protect learner privacy and fellowship harmony, classmates' names and individual marks are never exposed.
        </p>
      </div>

    </div>
  );
};
