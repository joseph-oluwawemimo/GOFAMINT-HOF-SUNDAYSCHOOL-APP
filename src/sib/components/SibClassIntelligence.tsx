/**
 * GOFAMINT SIB Class Intelligence Tab
 * 
 * Strict Principle:
 * For each class, shows health score, attendance, trend, retention,
 * visitor progression, follow-up, and record completeness.
 * Allows drilling down into "WHY?" explanation and raw evidence.
 */

import React, { useState } from 'react';
import {
  HelpCircle,
  FileCheck2,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Search,
  Filter,
  Layers,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { ClassHealthResult, ScoreExplanation } from '../types/sibTypes';

interface SibClassIntelligenceProps {
  classes: ClassHealthResult[];
  onOpenWhyScore: (explanation: ScoreExplanation) => void;
  onOpenEvidence: (evidenceId: string) => void;
  onNavigateToRegister?: (classId: string) => void;
}

export const SibClassIntelligence: React.FC<SibClassIntelligenceProps> = ({
  classes,
  onOpenWhyScore,
  onOpenEvidence,
  onNavigateToRegister,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  const departments = ['ALL', ...Array.from(new Set(classes.map(c => c.department || 'General')))];

  const filteredClasses = classes.filter(cls => {
    const matchesSearch = cls.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = departmentFilter === 'ALL' || cls.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            Granular Diagnostics
          </span>
          <h2 className="text-xl font-black text-white font-['Cinzel',serif]">
            Class Intelligence & Health Matrix
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluated across {classes.length} registered Sunday School classes.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search class name..."
              className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 font-bold focus:outline-none"
          >
            {departments.map((dept, idx) => (
              <option key={idx} value={dept}>
                {dept === 'ALL' ? 'All Departments' : dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Class Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredClasses.map((cls) => {
          const scoreColor = cls.healthScore >= 75
            ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
            : cls.healthScore >= 60
            ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
            : 'text-rose-400 border-rose-500/40 bg-rose-500/10';

          return (
            <div
              key={cls.classId}
              className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 shadow-xl flex flex-col justify-between space-y-4 transition"
            >
              <div className="space-y-3">
                {/* Header Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-indigo-300 uppercase px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30">
                    {cls.department}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    {cls.attentionLevel === 'CRITICAL' && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        Critical Care
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 font-mono">
                      {cls.registeredClassMembers} members
                    </span>
                  </div>
                </div>

                {/* Class Title & Health Callout */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-white">
                      {cls.className}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {cls.totalStudents} Students • {cls.totalVisitors} Visitors
                    </p>
                  </div>

                  <div className="text-right">
                    <span className={`text-2xl font-black font-['Cinzel',serif] block ${scoreColor.split(' ')[0]}`}>
                      {cls.healthScore}%
                    </span>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">
                      Health Score
                    </span>
                  </div>
                </div>

                {/* Quick 3 Metrics Bar */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Attendance</span>
                    <span className="text-xs font-black text-slate-200">{cls.attendanceRate}%</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Trend</span>
                    <div className="flex items-center justify-center gap-0.5 text-xs font-bold text-slate-300">
                      {cls.attendanceTrend.direction === 'IMPROVING' ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : cls.attendanceTrend.direction === 'DECLINING' ? <TrendingDown className="w-3 h-3 text-rose-400" /> : <Minus className="w-3 h-3 text-amber-400" />}
                      <span className="text-[10px]">{cls.attendanceTrend.direction}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Follow-Up</span>
                    <span className="text-xs font-black text-slate-200">{cls.followUpCompletionRate}%</span>
                  </div>
                </div>

                {/* Primary Concern / Positive Callout */}
                {cls.concerns.length > 0 ? (
                  <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/20 text-[11px] text-rose-300">
                    <strong>Concern:</strong> {cls.concerns[0]}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-[11px] text-emerald-300">
                    <strong>Highlight:</strong> {cls.positiveDevelopments[0]}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => onOpenWhyScore(cls.explanation)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Why {cls.healthScore}%?</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenEvidence(`class_${cls.classId}_grades`)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition cursor-pointer"
                    title="View Evidence Proof"
                  >
                    <FileCheck2 className="w-4 h-4" />
                  </button>

                  {onNavigateToRegister && (
                    <button
                      onClick={() => onNavigateToRegister(cls.classId)}
                      className="p-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded-xl text-xs transition cursor-pointer"
                      title="Open in Operational Class Register"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
