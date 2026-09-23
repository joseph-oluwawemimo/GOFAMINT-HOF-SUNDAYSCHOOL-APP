/**
 * GOFAMINT SIB Overview Tab (Executive Home Dashboard)
 */

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
  FileCheck2,
  Users,
  UserCheck,
  Award,
  AlertOctagon,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Activity,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { SIBOverviewData } from '../types/sibTypes';
import { SibActionCenter } from './SibActionCenter';

interface SibOverviewTabProps {
  overview: SIBOverviewData;
  onOpenWhyScore: () => void;
  onOpenEvidence: (evidenceId: string) => void;
  onNavigateToTab: (tabId: string) => void;
  onNavigateToPortal?: (targetPortal: 'ADMIN' | 'CLASS_REGISTER' | 'WORKERS') => void;
}

export const SibOverviewTab: React.FC<SibOverviewTabProps> = ({
  overview,
  onOpenWhyScore,
  onOpenEvidence,
  onNavigateToTab,
  onNavigateToPortal,
}) => {
  const health = overview.schoolHealthScore;
  const healthBadge = health >= 75
    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
    : health >= 60
    ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
    : 'text-rose-400 border-rose-500/40 bg-rose-500/10';

  const trendIcon = overview.attendance.trend.direction === 'IMPROVING'
    ? <TrendingUp className="w-4 h-4 text-emerald-400" />
    : overview.attendance.trend.direction === 'DECLINING'
    ? <TrendingDown className="w-4 h-4 text-rose-400" />
    : <Minus className="w-4 h-4 text-amber-400" />;

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* 1. Top Executive Banner: School Health & Core Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* School Health Score Card */}
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-2 border-indigo-500/40 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                Composite Intelligence Index
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                Rule v{overview.ruleVersion}
              </span>
            </div>

            <div>
              <h3 className="text-xl font-black text-white font-['Cinzel',serif]">
                Overall School Health
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Multi-factor composite calculated across {overview.classes.totalClasses} classes.
              </p>
            </div>

            {/* Score Ring / Callout */}
            <div className="flex items-baseline gap-3 pt-2">
              <span className={`text-6xl sm:text-7xl font-black font-['Cinzel',serif] tracking-tight ${healthBadge.split(' ')[0]}`}>
                {health}%
              </span>
              <div className="space-y-1">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border ${healthBadge}`}>
                  {health >= 75 ? 'Healthy' : health >= 60 ? 'Moderate' : 'Needs Care'}
                </span>
                <span className="text-[11px] text-slate-400 block">
                  {overview.schoolHealthExplanation.confidence} Confidence
                </span>
              </div>
            </div>
          </div>

          {/* "WHY 78%?" Decomposable Explanation Trigger */}
          <div className="pt-6 border-t border-indigo-500/30 flex items-center justify-between">
            <button
              onClick={onOpenWhyScore}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-slate-950" />
              <span>Why {health}%? (Full Breakdown)</span>
            </button>

            <button
              onClick={() => onOpenEvidence(overview.schoolHealthExplanation.targetId)}
              className="text-xs font-bold text-indigo-300 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Show Proof</span>
            </button>
          </div>
        </div>

        {/* 4 Core Quick Metric Tiles */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Attendance Tile */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-lg hover:border-indigo-500/40 transition">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  School Attendance
                </span>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-200">
                  {trendIcon}
                  <span>{overview.attendance.trend.direction}</span>
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">
                  {overview.attendance.currentRate}%
                </span>
                {overview.attendance.trend.changeAmount !== 0 && (
                  <span className={`text-xs font-bold font-mono ${
                    overview.attendance.trend.changeAmount > 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {overview.attendance.trend.changeAmount > 0 ? '+' : ''}{overview.attendance.trend.changeAmount} pp
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {overview.attendance.totalPresent} students present out of {overview.attendance.totalEligible} eligible records.
              </p>
            </div>

            <button
              onClick={() => onNavigateToTab('CLASSES')}
              className="pt-3 border-t border-slate-800 text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <span>View Class Attendance</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Student Attention Tile */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-lg hover:border-rose-500/40 transition">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">
                  Student Care Alerts
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {overview.studentAttention.criticalCount} Critical
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">
                  {overview.studentAttention.totalRequiringAttention}
                </span>
                <span className="text-xs text-slate-400">students flagged</span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {overview.studentAttention.criticalCount} with 3+ absences; {overview.studentAttention.moderateCount} with 2 consecutive missed lessons.
              </p>
            </div>

            <button
              onClick={() => onNavigateToTab('STUDENTS')}
              className="pt-3 border-t border-slate-800 text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Open Student Care List</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Follow-Up Tile */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-lg hover:border-indigo-500/40 transition">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Pastoral Follow-Up
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  {overview.followUp.completionRate}%
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">
                  {overview.followUp.completedFollowUps}
                </span>
                <span className="text-xs text-slate-400">/ {overview.followUp.requiredFollowUps} completed</span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {overview.followUp.outstandingFollowUps} absence follow-ups currently pending execution.
              </p>
            </div>

            <button
              onClick={() => onNavigateToTab('FOLLOW_UP')}
              className="pt-3 border-t border-slate-800 text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Follow-Up Intelligence</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Visitor Intelligence Tile */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-lg hover:border-emerald-500/40 transition">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  Visitor Progression
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {overview.visitors.returnRate}% Return
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">
                  {overview.visitors.totalVisitors}
                </span>
                <span className="text-xs text-slate-400">total visitors</span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {overview.visitors.consecutiveVisitCandidatesCount} visitors reached 3 visits (ready for student transition).
              </p>
            </div>

            <button
              onClick={() => onNavigateToTab('VISITORS')}
              className="pt-3 border-t border-slate-800 text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Visitor Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>

      {/* 2. Top Priority Callout Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/20 via-indigo-950 to-slate-900 border-2 border-amber-400/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
              Top Leadership Priority
            </span>
            <span className="text-xs font-bold text-amber-300">
              {overview.topPriority.priority} Urgency
            </span>
          </div>

          <h3 className="text-lg font-black text-white">
            {overview.topPriority.title}
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed">
            {overview.topPriority.description}
          </p>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
            <strong className="text-amber-300">Why this is priority:</strong> {overview.topPriority.whyExplanation}
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
          <button
            onClick={() => onOpenEvidence(overview.topPriority.evidence.id)}
            className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
          >
            <span>View Verified Proof</span>
            <FileCheck2 className="w-4 h-4 text-slate-950" />
          </button>

          <p className="text-[10px] text-slate-400 text-center">
            {overview.topPriority.confidence} Confidence Level
          </p>
        </div>
      </div>

      {/* 3. Positive Intelligence Section ("What is going well?") */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-emerald-500/30 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-black text-white font-['Cinzel',serif]">
            What is Going Well? (Positive Intelligence)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {overview.positiveDevelopments.map((pos, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/20 text-xs text-slate-300 flex items-start gap-3"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{pos}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Leadership Action Center */}
      <SibActionCenter
        actions={overview.actionCenter}
        onOpenEvidence={onOpenEvidence}
        onNavigateToPortal={onNavigateToPortal}
      />

    </div>
  );
};
