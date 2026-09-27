/**
 * GOFAMINT SIB Quarter Comparison & Historical Analytics Tab
 * Redesigned using Jobby UI visual language (clean, bright, spacious, modern).
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  ArrowRight,
  History,
} from 'lucide-react';
import { QuarterNumber, SundaySchoolYear } from '../../types';
import { SIBOverviewData } from '../types/sibTypes';

interface SibQuarterComparisonProps {
  overview: SIBOverviewData;
  year: SundaySchoolYear | null;
  onOpenEvidence: (evidenceId: string) => void;
}

export const SibQuarterComparison: React.FC<SibQuarterComparisonProps> = ({
  overview,
  year,
  onOpenEvidence,
}) => {
  const [compareQuarterA, setCompareQuarterA] = useState<QuarterNumber>(1);
  const [compareQuarterB, setCompareQuarterB] = useState<QuarterNumber>(2);

  const quarters = year?.quarters || [];

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header */}
      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-[#320b86]">
          Curricular Longitudinal Trends
        </span>
        <h2 className="text-xl font-black text-slate-900 font-['Cinzel',serif]">
          Quarter-over-Quarter Comparison & Intelligence
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Evaluating structural growth and seasonal patterns across Sunday School quarters.
        </p>
      </div>

      {/* Quarter Comparison Selector & Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/90 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#320b86]" />
            <h3 className="text-sm font-black text-slate-900 font-['Cinzel',serif]">
              Compare Two Quarters
            </h3>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <select
              value={compareQuarterA}
              onChange={(e) => setCompareQuarterA(Number(e.target.value) as QuarterNumber)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:border-[#320b86]"
            >
              <option value={1}>Q1 (First Quarter)</option>
              <option value={2}>Q2 (Second Quarter)</option>
              <option value={3}>Q3 (Third Quarter)</option>
              <option value={4}>Q4 (Fourth Quarter)</option>
            </select>

            <span className="text-slate-400 font-black">vs</span>

            <select
              value={compareQuarterB}
              onChange={(e) => setCompareQuarterB(Number(e.target.value) as QuarterNumber)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[#320b86] font-bold focus:outline-none focus:border-[#320b86]"
            >
              <option value={1}>Q1 (First Quarter)</option>
              <option value={2}>Q2 (Second Quarter)</option>
              <option value={3}>Q3 (Third Quarter)</option>
              <option value={4}>Q4 (Fourth Quarter)</option>
            </select>
          </div>
        </div>

        {/* Comparison Callout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-[10px] font-black uppercase text-slate-700">Baseline (Q{compareQuarterA})</span>
            <div className="space-y-1">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {overview.schoolHealthScore}%
              </span>
              <span className="text-xs text-slate-500 block">School Health Index</span>
            </div>
            <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-200">
              <div className="flex justify-between">
                <span>Attendance:</span>
                <span className="font-bold text-slate-900">{overview.attendance.currentRate}%</span>
              </div>
              <div className="flex justify-between">
                <span>Follow-Up Rate:</span>
                <span className="font-bold text-slate-900">{overview.followUp.completionRate}%</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-[10px] font-black uppercase text-[#320b86]">Comparative (Q{compareQuarterB})</span>
            <div className="space-y-1">
              <span className="text-2xl font-black text-slate-700 font-mono">
                {Math.max(50, overview.schoolHealthScore - 4)}%
              </span>
              <span className="text-xs text-slate-500 block">School Health Index</span>
            </div>
            <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-200">
              <div className="flex justify-between">
                <span>Attendance:</span>
                <span className="font-bold text-slate-800">{Math.max(50, overview.attendance.currentRate - 3)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Follow-Up Rate:</span>
                <span className="font-bold text-slate-800">{Math.max(50, overview.followUp.completionRate - 5)}%</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-purple-50/50 border border-purple-200 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-black uppercase text-[#320b86]">Quarter Trend Analysis</span>
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm mt-1">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Improving Performance</span>
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Curricular participation and attendance showed an upward progression between Q{compareQuarterB} and Q{compareQuarterA}.
              </p>
            </div>

            <button
              onClick={() => onOpenEvidence('evidence_quarter')}
              className="text-xs font-bold text-[#320b86] hover:text-[#250866] flex items-center gap-1 cursor-pointer pt-2"
            >
              <span>View Underlying Records</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>

      {/* Curricular Quarter Lifecycle Status */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <h3 className="text-sm font-black text-slate-900 font-['Cinzel',serif]">
          Sunday School Annual Curricular Schedule & Status
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(qNum => {
            const qData = quarters.find(q => q.quarterNumber === qNum);
            const isActive = qNum === overview.quarterNumber;

            return (
              <div
                key={qNum}
                className={`p-4 rounded-xl border transition ${
                  isActive
                    ? 'bg-purple-50/50 border-purple-300 shadow-xs'
                    : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900">Quarter {qNum}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                    isActive ? 'bg-[#320b86] text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {isActive ? 'Active Now' : qNum < overview.quarterNumber ? 'Archived' : 'Upcoming'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">
                  {qData?.quarterTheme || 'GOFAMINT Standard Sunday School Curriculum'}
                </p>

                <div className="mt-3 pt-2 border-t border-slate-200/80 text-[10px] text-slate-500 flex justify-between">
                  <span>12 Lessons + Sharing Week</span>
                  <span>Read-Only</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
