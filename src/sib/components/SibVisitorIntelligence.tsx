/**
 * GOFAMINT SIB Visitor & Evangelism Intelligence Tab
 * Redesigned using Jobby UI visual language (clean, bright, spacious, modern).
 */

import React from 'react';
import {
  FileCheck2,
} from 'lucide-react';
import { VisitorIntelligenceResult } from '../types/sibTypes';

interface SibVisitorIntelligenceProps {
  visitors: VisitorIntelligenceResult;
  onOpenEvidence: (evidenceId: string) => void;
}

export const SibVisitorIntelligence: React.FC<SibVisitorIntelligenceProps> = ({
  visitors,
  onOpenEvidence,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header */}
      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-[#320b86]">
          Growth & Outreach Analytics
        </span>
        <h2 className="text-xl font-black text-slate-900 font-['Cinzel',serif]">
          Visitor Progression & Return Matrix
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Analyzed across {visitors.totalVisitors} visitors recorded in Quarter {visitors.quarterNumber}.
        </p>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Visitors</span>
          <span className="text-3xl font-black text-slate-900 font-mono">{visitors.totalVisitors}</span>
          <span className="text-[11px] text-slate-500 block">{visitors.activeVisitors} currently active</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-emerald-200 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-emerald-700 block">Visitor Return Rate</span>
          <span className="text-3xl font-black text-emerald-700 font-mono">{visitors.returnRate}%</span>
          <span className="text-[11px] text-slate-500 block">{visitors.returningVisitors} returned for subsequent lessons</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-amber-200 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-700 block">Eligible for Transition</span>
          <span className="text-3xl font-black text-amber-700 font-mono">{visitors.consecutiveVisitCandidatesCount}</span>
          <span className="text-[11px] text-slate-500 block">3+ consecutive visits achieved</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-purple-200 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#320b86] block">Evangelism Referrals</span>
          <span className="text-3xl font-black text-[#320b86] font-mono">{visitors.evangelismReferralsCount}</span>
          <span className="text-[11px] text-slate-500 block">Member referral credits</span>
        </div>

      </div>

      {/* Detailed Analysis Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-[#320b86]">Verified Findings</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-[#320b86] border border-purple-200">
              {visitors.confidence} Confidence
            </span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed max-w-2xl font-medium">
            {visitors.explanation}
          </p>
        </div>

        <button
          onClick={() => onOpenEvidence(visitors.evidence.id)}
          className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-[#320b86] border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-xs"
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Show Evidence</span>
        </button>
      </div>

      {/* Class Visitor Distribution Table */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <h3 className="text-sm font-black text-slate-900 font-['Cinzel',serif]">
          Visitor Reception by Sunday School Class
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visitors.classBreakdown.map((cb) => (
            <div
              key={cb.classId}
              className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between"
            >
              <div>
                <h4 className="text-xs font-bold text-slate-900">{cb.className}</h4>
                <span className="text-[11px] text-slate-500">{cb.visitorCount} visitor(s) registered</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-emerald-700 font-mono">{cb.returnRate}%</span>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Return Rate</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
