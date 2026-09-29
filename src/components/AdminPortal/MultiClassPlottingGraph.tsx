import React, { useState, useMemo } from 'react';
import { TrendingUp, Users, UserCheck, UserX } from 'lucide-react';
import type { ClassProfile, Member, WeeklyGradeRecord } from '../../types';
import { isMemberStudentAtWeek } from '../../utils/calculations';
import { getStudentClassForWeek } from '../../db/indexedDB';

export type PlotDatasetType = 'CLASS_MEMBERS' | 'TOTAL_PRESENT' | 'TOTAL_ABSENT';

export interface ClassWeekMetric {
  totalClassMembers: number;
  studentsCount: number;
  visitorsCount: number;
  totalPresent: number;
  totalAbsent: number;
}

interface Props {
  departmentClasses: ClassProfile[];
  members: Member[];
  grades: WeeklyGradeRecord[];
  selectedQuarter: number;
  selectedWeek: number;
  onSelectWeek: (week: number) => void;
  totalWeeks?: number;
}

export const MultiClassPlottingGraph: React.FC<Props> = ({
  departmentClasses,
  members,
  grades,
  selectedQuarter,
  selectedWeek,
  onSelectWeek,
  totalWeeks = 12
}) => {
  const [activeDataset, setActiveDataset] = useState<PlotDatasetType>('CLASS_MEMBERS');
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

  // Class colors matching existing theme
  const classColors = [
    { stroke: '#4318ff', fill: '#4318ff', bg: 'bg-indigo-600', text: 'text-indigo-600' },
    { stroke: '#059669', fill: '#059669', bg: 'bg-emerald-600', text: 'text-emerald-600' },
    { stroke: '#d97706', fill: '#d97706', bg: 'bg-amber-600', text: 'text-amber-600' },
    { stroke: '#dc2626', fill: '#dc2626', bg: 'bg-rose-600', text: 'text-rose-600' },
    { stroke: '#7c3aed', fill: '#7c3aed', bg: 'bg-purple-600', text: 'text-purple-600' },
    { stroke: '#0891b2', fill: '#0891b2', bg: 'bg-cyan-600', text: 'text-cyan-600' }
  ];

  // Compute 12-week dataset for all classes
  const weeklyData = useMemo(() => {
    return Array.from({ length: totalWeeks }, (_, idx) => {
      const wk = idx + 1;
      const classValues: Record<string, ClassWeekMetric> = {};

      departmentClasses.forEach(cls => {
        // Members in this class at week wk (preserving historical assignment)
        const clsMems = members.filter(m => {
          const hist = getStudentClassForWeek(m, wk);
          return (hist.classId === cls.id || (!hist.classId && m.classId === cls.id)) &&
                 !['LEFT_CLASS', 'DEPARTED', 'ARCHIVED'].includes(String(m.status || '').toUpperCase());
        });

        // Enrolled Students vs Visitors Breakdown
        const studentsCount = clsMems.filter(m => isMemberStudentAtWeek(m, wk)).length;
        const visitorsCount = clsMems.filter(m => !isMemberStudentAtWeek(m, wk)).length;
        const totalClassMembers = clsMems.length; // Reaches total members (e.g. 13)

        const clsGrades = grades.filter(
          g => (g.quarterNumber === undefined || g.quarterNumber === selectedQuarter) &&
               g.weekNumber === wk &&
               g.classId === cls.id &&
               !g.isNoRecordWeek
        );

        const totalPresent = clsGrades.filter(g => g.attendance === 'PRESENT').length;
        const totalAbsent = clsGrades.filter(g => g.attendance === 'ABSENT').length;

        classValues[cls.id] = {
          totalClassMembers,
          studentsCount,
          visitorsCount,
          totalPresent,
          totalAbsent
        };
      });

      return {
        week: wk,
        classValues
      };
    });
  }, [totalWeeks, departmentClasses, members, grades, selectedQuarter]);

  // Determine maximum Y-value for scaling
  const maxY = useMemo(() => {
    let max = 0;
    weeklyData.forEach(d => {
      departmentClasses.forEach(cls => {
        const val = d.classValues[cls.id];
        if (!val) return;
        let num = 0;
        if (activeDataset === 'CLASS_MEMBERS') num = val.totalClassMembers;
        else if (activeDataset === 'TOTAL_PRESENT') num = val.totalPresent;
        else if (activeDataset === 'TOTAL_ABSENT') num = val.totalAbsent;
        if (num > max) max = num;
      });
    });
    return Math.max(5, Math.ceil(max * 1.15));
  }, [weeklyData, departmentClasses, activeDataset]);

  // SVG Coordinates setup
  const svgWidth = 620;
  const svgHeight = 230;
  const padLeft = 40;
  const padRight = 30;
  const padTop = 24;
  const padBottom = 34;

  const chartWidth = svgWidth - padLeft - padRight;
  const chartHeight = svgHeight - padTop - padBottom;

  const getX = (wk: number) => {
    if (totalWeeks <= 1) return padLeft + chartWidth / 2;
    return padLeft + ((wk - 1) / (totalWeeks - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return padTop + chartHeight - (val / maxY) * chartHeight;
  };

  // Generate paths for each class
  const classSeries = useMemo(() => {
    return departmentClasses.map((cls, idx) => {
      const color = classColors[idx % classColors.length];
      const points = weeklyData.map(d => {
        const valObj = d.classValues[cls.id] || {
          totalClassMembers: 0,
          studentsCount: 0,
          visitorsCount: 0,
          totalPresent: 0,
          totalAbsent: 0
        };
        let value = 0;
        if (activeDataset === 'CLASS_MEMBERS') value = valObj.totalClassMembers;
        else if (activeDataset === 'TOTAL_PRESENT') value = valObj.totalPresent;
        else if (activeDataset === 'TOTAL_ABSENT') value = valObj.totalAbsent;

        return {
          week: d.week,
          value,
          metric: valObj,
          x: getX(d.week),
          y: getY(value)
        };
      });

      const pathString = points.reduce((acc, pt, i) => {
        return i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
      }, '');

      return {
        cls,
        color,
        points,
        pathString
      };
    });
  }, [departmentClasses, weeklyData, activeDataset, maxY, totalWeeks]);

  const activeWeekToShow = hoveredWeek !== null ? hoveredWeek : selectedWeek;
  const activeWeekData = weeklyData.find(w => w.week === activeWeekToShow);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      {/* Header and Dataset Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#320b86]" />
            <span>Multi-Class Comparative Plotting View</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Plotting the classes together for comparative performance and population trends across all 12 weeks.
          </p>
        </div>

        {/* Dataset Switcher Pills: Class Members / Total Present / Total Absent */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start sm:self-auto">
          <button
            type="button"
            id="btn-plot-class-members"
            onClick={() => setActiveDataset('CLASS_MEMBERS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeDataset === 'CLASS_MEMBERS'
                ? 'bg-[#320b86] text-amber-300 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Class Members</span>
          </button>

          <button
            type="button"
            id="btn-plot-total-present"
            onClick={() => setActiveDataset('TOTAL_PRESENT')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeDataset === 'TOTAL_PRESENT'
                ? 'bg-[#320b86] text-amber-300 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Total Present</span>
          </button>

          <button
            type="button"
            id="btn-plot-total-absent"
            onClick={() => setActiveDataset('TOTAL_ABSENT')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeDataset === 'TOTAL_ABSENT'
                ? 'bg-[#320b86] text-amber-300 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Total Absent</span>
          </button>
        </div>
      </div>

      {/* Class Legend & Active Dataset Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Classes Colors */}
        <div className="flex flex-wrap items-center gap-2">
          {departmentClasses.map((cls, idx) => {
            const color = classColors[idx % classColors.length];
            return (
              <span
                key={cls.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 font-bold text-slate-800 text-[11px]"
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color.stroke }} />
                <span>{cls.name || cls.className}</span>
              </span>
            );
          })}
        </div>

        {/* Student vs Visitor Breakdown Legend when Class Members is active */}
        {activeDataset === 'CLASS_MEMBERS' ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[11px] font-bold text-slate-500">Composition:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span>Students</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Visitors</span>
            </span>
          </div>
        ) : (
          <div className="text-[11px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-3 py-0.5 rounded-full">
            Plotting: <strong>{activeDataset.replace('_', ' ')}</strong> (Weeks 1 - {totalWeeks})
          </div>
        )}
      </div>

      {/* SVG Plotting View */}
      <div className="relative w-full overflow-x-auto pt-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-64 select-none"
          onMouseLeave={() => setHoveredWeek(null)}
        >
          {/* Background grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = padTop + chartHeight * (1 - pct);
            const valLabel = Math.round(maxY * pct);
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
                  {valLabel}
                </text>
              </g>
            );
          })}

          {/* Vertical Guides for Each Week */}
          {Array.from({ length: totalWeeks }, (_, idx) => {
            const wk = idx + 1;
            const x = getX(wk);
            const isCur = wk === selectedWeek;
            const isHover = wk === hoveredWeek;
            return (
              <g key={wk} className="cursor-pointer" onClick={() => onSelectWeek(wk)}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={padTop + chartHeight}
                  stroke={isCur ? '#320b86' : isHover ? '#cbd5e1' : '#f1f5f9'}
                  strokeWidth={isCur ? '2' : '1'}
                  strokeDasharray={isCur ? undefined : '2,2'}
                />
                <text
                  x={x}
                  y={svgHeight - 10}
                  textAnchor="middle"
                  fontSize={isCur ? '11' : '10'}
                  fontWeight={isCur ? '900' : '600'}
                  fill={isCur ? '#320b86' : '#64748b'}
                >
                  W{wk}
                </text>
              </g>
            );
          })}

          {/* Paths for each class */}
          {classSeries.map((series) => (
            <path
              key={series.cls.id}
              d={series.pathString}
              fill="none"
              stroke={series.color.stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          ))}

          {/* Points / Nodes for each class */}
          {classSeries.map((series) => (
            <g key={`pts-${series.cls.id}`}>
              {series.points.map((pt) => {
                const isSelectedWeek = pt.week === selectedWeek;
                const isHovered = pt.week === hoveredWeek;
                const hasVisitors = activeDataset === 'CLASS_MEMBERS' && (pt.metric?.visitorsCount || 0) > 0;

                return (
                  <g key={`${series.cls.id}-w${pt.week}`} className="cursor-pointer">
                    {/* Main Node Point */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelectedWeek || isHovered ? 6.5 : 4}
                      fill={series.color.stroke}
                      stroke="#ffffff"
                      strokeWidth={isSelectedWeek || isHovered ? 2.5 : 1.5}
                      className="transition-all duration-150"
                      onMouseEnter={() => setHoveredWeek(pt.week)}
                      onClick={() => onSelectWeek(pt.week)}
                    />

                    {/* Dual identification badge on selected or hovered node for Class Members */}
                    {(isSelectedWeek || isHovered) && activeDataset === 'CLASS_MEMBERS' && (
                      <g>
                        {/* Breakdown ring indicator: shows presence of visitors in amber, students in blue */}
                        {hasVisitors && (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={9}
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth="1.5"
                            strokeDasharray="3,2"
                          />
                        )}
                        {/* Text Value Label on point */}
                        <text
                          x={pt.x}
                          y={pt.y - 10}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="900"
                          fill="#1e293b"
                          className="select-none"
                        >
                          {pt.value}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          ))}
        </svg>

        {/* Hover / Selection Status Strip with Student vs Visitor Breakdown */}
        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-black text-[#320b86] uppercase tracking-wider text-[11px]">
                Week {activeWeekToShow} Comparison:
              </span>
              <span className="text-slate-600 font-bold">
                {activeDataset === 'CLASS_MEMBERS' && 'Class Members (Roster Breakdown)'}
                {activeDataset === 'TOTAL_PRESENT' && 'Total Students Present'}
                {activeDataset === 'TOTAL_ABSENT' && 'Total Students Absent'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-bold">
              Click any week above to evaluate
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {departmentClasses.map((cls, idx) => {
              const valObj = activeWeekData?.classValues[cls.id];
              const color = classColors[idx % classColors.length];

              if (activeDataset === 'CLASS_MEMBERS') {
                const total = valObj?.totalClassMembers || 0;
                const students = valObj?.studentsCount || 0;
                const visitors = valObj?.visitorsCount || 0;

                return (
                  <div
                    key={cls.id}
                    className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color.stroke }} />
                        <span className="font-black text-slate-800 text-xs truncate max-w-[130px]">
                          {cls.name || cls.className}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-sm text-[#320b86]">{total}</span>
                        <span className="text-[10px] text-slate-400 font-bold ml-1">Members</span>
                      </div>
                    </div>

                    {/* Dual identification: Students (Blue) vs Visitors (Amber) */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        <span>{students} Students</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>{visitors} Visitors</span>
                      </span>
                    </div>
                  </div>
                );
              }

              let val = 0;
              if (activeDataset === 'TOTAL_PRESENT') val = valObj?.totalPresent || 0;
              else if (activeDataset === 'TOTAL_ABSENT') val = valObj?.totalAbsent || 0;

              return (
                <div
                  key={cls.id}
                  className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color.stroke }} />
                    <span className="font-bold text-slate-700 text-xs truncate max-w-[140px]">
                      {cls.name || cls.className}
                    </span>
                  </div>
                  <div className="text-right font-black text-slate-900 text-sm">
                    {val}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
