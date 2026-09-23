/**
 * GOFAMINT SIB Data Quality & Audit Intelligence Tab
 * 
 * Strict Principle:
 * SIB monitors the quality and completeness of data it relies on.
 * Displays missing attendance, unrecorded grades, and data sufficiency ratings.
 * Avoids pretending that operational data is 100% perfect.
 */

import React from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Database,
  FileQuestion,
  RefreshCw,
  Info,
  Layers
} from 'lucide-react';
import { SIBDataQualityResult } from '../types/sibTypes';

interface SibDataQualityProps {
  dataQuality: SIBDataQualityResult;
  onRefreshData?: () => void;
}

export const SibDataQuality: React.FC<SibDataQualityProps> = ({
  dataQuality,
  onRefreshData,
}) => {
  const qualityBadge = dataQuality.overallQualityScore >= 80
    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
    : dataQuality.overallQualityScore >= 60
    ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
    : 'text-rose-400 border-rose-500/40 bg-rose-500/10';

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header */}
      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
          Trust & Provenance Audits
        </span>
        <h2 className="text-xl font-black text-white font-['Cinzel',serif]">
          Data Quality & Sufficiency Intelligence
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Auditing record completeness, missing weekly registers, and analytical reliability.
        </p>
      </div>

      {/* Main Score & Sufficiency Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${qualityBadge}`}>
              {dataQuality.overallQualityScore}% Quality Score
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-slate-800 text-slate-300">
              Status: {dataQuality.sufficiencyStatus}
            </span>
          </div>

          <h3 className="text-lg font-black text-white font-['Cinzel',serif]">
            Analytical Confidence & Sufficiency Rating
          </h3>

          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            {dataQuality.limitationsNotice}
          </p>
        </div>

        {onRefreshData && (
          <button
            onClick={onRefreshData}
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0"
          >
            <RefreshCw className="w-4 h-4 text-amber-400" />
            <span>Re-verify Data Health</span>
          </button>
        )}
      </div>

      {/* Audit Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Classes Evaluated</span>
          <span className="text-3xl font-black text-white font-mono">{dataQuality.totalClassesEvaluated}</span>
          <span className="text-[11px] text-slate-400 block">{dataQuality.classesWithCompleteAttendance} complete registers</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-emerald-500/30 space-y-1">
          <span className="text-[10px] uppercase font-bold text-emerald-400 block">Grades Recorded</span>
          <span className="text-3xl font-black text-emerald-400 font-mono">{dataQuality.totalGradesRecorded}</span>
          <span className="text-[11px] text-slate-400 block">out of {dataQuality.totalExpectedGrades} expected</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-amber-500/30 space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-300 block">Unrecorded Grades</span>
          <span className="text-3xl font-black text-amber-300 font-mono">{dataQuality.unrecordedGradesCount}</span>
          <span className="text-[11px] text-slate-400 block">Missing student-week marks</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-rose-500/30 space-y-1">
          <span className="text-[10px] uppercase font-bold text-rose-400 block">Missing Follow-Up Logs</span>
          <span className="text-3xl font-black text-rose-400 font-mono">{dataQuality.missingFollowUpLogsCount}</span>
          <span className="text-[11px] text-slate-400 block">Actions pending logging</span>
        </div>

      </div>

      {/* Transparent Data Gaps Table */}
      {dataQuality.dataGaps.length > 0 && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <FileQuestion className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-black text-white font-['Cinzel',serif]">
              Identified Data Completeness Gaps by Class
            </h3>
          </div>

          <div className="space-y-2">
            {dataQuality.dataGaps.map((gap, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <span className="font-bold text-white block">{gap.className}</span>
                  <span className="text-slate-400">{gap.description}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                  gap.severity === 'HIGH'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {gap.severity} GAP
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
