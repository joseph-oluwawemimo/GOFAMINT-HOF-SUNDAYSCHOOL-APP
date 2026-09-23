/**
 * GOFAMINT SIB Visitor & Evangelism Intelligence Tab
 */

import React from 'react';
import {
  Users,
  UserCheck,
  TrendingUp,
  Sparkles,
  ArrowRight,
  FileCheck2,
  Share2,
  Calendar
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
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
          Growth & Outreach Analytics
        </span>
        <h2 className="text-xl font-black text-white font-['Cinzel',serif]">
          Visitor Progression & Return Matrix
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Analyzed across {visitors.totalVisitors} visitors recorded in Quarter {visitors.quarterNumber}.
        </p>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Visitors</span>
          <span className="text-3xl font-black text-white font-mono">{visitors.totalVisitors}</span>
          <span className="text-[11px] text-slate-400 block">{visitors.activeVisitors} currently active</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-emerald-500/30 space-y-1">
          <span className="text-[10px] uppercase font-bold text-emerald-400 block">Visitor Return Rate</span>
          <span className="text-3xl font-black text-emerald-400 font-mono">{visitors.returnRate}%</span>
          <span className="text-[11px] text-slate-400 block">{visitors.returningVisitors} returned for subsequent lessons</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-amber-500/30 space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-300 block">Eligible for Transition</span>
          <span className="text-3xl font-black text-amber-300 font-mono">{visitors.consecutiveVisitCandidatesCount}</span>
          <span className="text-[11px] text-slate-400 block">3+ consecutive visits achieved</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-indigo-500/30 space-y-1">
          <span className="text-[10px] uppercase font-bold text-indigo-300 block">Evangelism Referrals</span>
          <span className="text-3xl font-black text-indigo-300 font-mono">{visitors.evangelismReferralsCount}</span>
          <span className="text-[11px] text-slate-400 block">Member referral credits</span>
        </div>

      </div>

      {/* Detailed Analysis Banner */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-amber-400">Verified Findings</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
              {visitors.confidence} Confidence
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            {visitors.explanation}
          </p>
        </div>

        <button
          onClick={() => onOpenEvidence(visitors.evidence.id)}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer"
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Show Evidence</span>
        </button>
      </div>

      {/* Class Visitor Distribution Table */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-sm font-black text-white font-['Cinzel',serif]">
          Visitor Reception by Sunday School Class
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visitors.classBreakdown.map((cb) => (
            <div
              key={cb.classId}
              className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
            >
              <div>
                <h4 className="text-xs font-bold text-white">{cb.className}</h4>
                <span className="text-[11px] text-slate-400">{cb.visitorCount} visitor(s) registered</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-emerald-400 font-mono">{cb.returnRate}%</span>
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Return Rate</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
