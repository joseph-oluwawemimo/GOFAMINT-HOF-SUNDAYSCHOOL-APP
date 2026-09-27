/**
 * GOFAMINT SIB Data Quality & Audit Intelligence Tab
 * Redesigned using Jobby UI visual language (clean, bright, spacious, modern).
 */

import React from 'react';
import {
  RefreshCw,
  FileQuestion,
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
    ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
    : dataQuality.overallQualityScore >= 60
    ? 'text-amber-700 border-amber-200 bg-amber-50'
    : 'text-rose-700 border-rose-200 bg-rose-50';

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header */}
      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-[#320b86]">
          Trust & Provenance Audits
        </span>
        <h2 className="text-xl font-black text-slate-900 font-['Cinzel',serif]">
          Data Quality & Sufficiency Intelligence
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Auditing record completeness, missing weekly registers, and analytical reliability.
        </p>
      </div>

      {/* Main Score & Sufficiency Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${qualityBadge}`}>
              {dataQuality.overallQualityScore}% Quality Score
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
              Status: {dataQuality.sufficiencyStatus}
            </span>
          </div>

          <h3 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
            Analytical Confidence & Sufficiency Rating
          </h3>

          <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
            {dataQuality.limitationsNotice}
          </p>
        </div>

        {onRefreshData && (
          <button
            onClick={onRefreshData}
            className="px-5 py-3 bg-purple-50 hover:bg-purple-100 text-[#320b86] border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 shadow-xs"
          >
            <RefreshCw className="w-4 h-4 text-[#320b86]" />
            <span>Re-verify Data Health</span>
          </button>
        )}
      </div>

      {/* Audit Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Classes Evaluated</span>
          <span className="text-3xl font-black text-slate-900 font-mono">{dataQuality.totalClassesEvaluated}</span>
          <span className="text-[11px] text-slate-500 block">{dataQuality.classesWithCompleteAttendance} complete registers</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-emerald-200 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-emerald-700 block">Grades Recorded</span>
          <span className="text-3xl font-black text-emerald-700 font-mono">{dataQuality.totalGradesRecorded}</span>
          <span className="text-[11px] text-slate-500 block">out of {dataQuality.totalExpectedGrades} expected</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-amber-200 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-700 block">Unrecorded Grades</span>
          <span className="text-3xl font-black text-amber-700 font-mono">{dataQuality.unrecordedGradesCount}</span>
          <span className="text-[11px] text-slate-500 block">Missing student-week marks</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-rose-200 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-rose-700 block">Missing Follow-Up Logs</span>
          <span className="text-3xl font-black text-rose-700 font-mono">{dataQuality.missingFollowUpLogsCount}</span>
          <span className="text-[11px] text-slate-500 block">Actions pending logging</span>
        </div>

      </div>

      {/* Transparent Data Gaps Table */}
      {dataQuality.dataGaps.length > 0 && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <FileQuestion className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-black text-slate-900 font-['Cinzel',serif]">
              Identified Data Completeness Gaps by Class
            </h3>
          </div>

          <div className="space-y-2">
            {dataQuality.dataGaps.map((gap, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 block">{gap.className}</span>
                  <span className="text-slate-600">{gap.description}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                  gap.severity === 'HIGH'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
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
