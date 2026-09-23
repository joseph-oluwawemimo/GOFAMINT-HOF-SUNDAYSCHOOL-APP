/**
 * GOFAMINT SIB Follow-Up & Pastoral Care Intelligence Tab
 */

import React from 'react';
import {
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileCheck2,
  Layers,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { FollowUpIntelligenceResult } from '../types/sibTypes';

interface SibFollowUpIntelligenceProps {
  followUp: FollowUpIntelligenceResult;
  onOpenEvidence: (evidenceId: string) => void;
  onNavigateToRegister?: (classId: string) => void;
}

export const SibFollowUpIntelligence: React.FC<SibFollowUpIntelligenceProps> = ({
  followUp,
  onOpenEvidence,
  onNavigateToRegister,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header */}
      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
          Care Continuity Diagnostics
        </span>
        <h2 className="text-xl font-black text-white font-['Cinzel',serif]">
          Pastoral Follow-Up Intelligence
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Monitoring execution of contacts for absent students across Quarter {followUp.quarterNumber}.
        </p>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Required Follow-Ups</span>
          <span className="text-3xl font-black text-white font-mono">{followUp.requiredFollowUps}</span>
          <span className="text-[11px] text-slate-400 block">Triggered by 2+ consecutive absences</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-emerald-500/30 space-y-1">
          <span className="text-[10px] uppercase font-bold text-emerald-400 block">Completed Follow-Ups</span>
          <span className="text-3xl font-black text-emerald-400 font-mono">{followUp.completedFollowUps}</span>
          <span className="text-[11px] text-slate-400 block">Contact logged with outcome</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-indigo-500/30 space-y-1">
          <span className="text-[10px] uppercase font-bold text-indigo-300 block">Completion Rate</span>
          <span className="text-3xl font-black text-indigo-300 font-mono">{followUp.completionRate}%</span>
          <span className="text-[11px] text-slate-400 block">{followUp.trend.direction} trend</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-rose-500/30 space-y-1">
          <span className="text-[10px] uppercase font-bold text-rose-400 block">Outstanding Gaps</span>
          <span className="text-3xl font-black text-rose-400 font-mono">{followUp.outstandingFollowUps}</span>
          <span className="text-[11px] text-slate-400 block">Awaiting recorded action</span>
        </div>

      </div>

      {/* Urgency Level Distribution */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-sm font-black text-white font-['Cinzel',serif]">
          Absence Care Escalation Tier Distribution
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-1">
            <span className="text-[10px] font-black uppercase text-amber-300 block">Yellow Tier (Week 2)</span>
            <span className="text-2xl font-black text-amber-400 font-mono">{followUp.urgencyBreakdown.yellow}</span>
            <span className="text-[10px] text-slate-400 block">Secretary Check-in</span>
          </div>

          <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-center space-y-1">
            <span className="text-[10px] font-black uppercase text-orange-300 block">Orange Tier (Week 3)</span>
            <span className="text-2xl font-black text-orange-400 font-mono">{followUp.urgencyBreakdown.orange}</span>
            <span className="text-[10px] text-slate-400 block">Direct Phone Contact</span>
          </div>

          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-1">
            <span className="text-[10px] font-black uppercase text-rose-300 block">Red Tier (Week 4)</span>
            <span className="text-2xl font-black text-rose-400 font-mono">{followUp.urgencyBreakdown.red}</span>
            <span className="text-[10px] text-slate-400 block">Pastoral Visitation</span>
          </div>

          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/50 text-center space-y-1">
            <span className="text-[10px] font-black uppercase text-rose-400 block">Critical Tier (5+ Wks)</span>
            <span className="text-2xl font-black text-rose-300 font-mono">{followUp.urgencyBreakdown.critical}</span>
            <span className="text-[10px] text-slate-400 block">Exit Review Evaluation</span>
          </div>
        </div>
      </div>

      {/* Classes with Follow-Up Gaps */}
      {followUp.classesWithGaps.length > 0 && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-rose-500/30 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-black text-white font-['Cinzel',serif]">
              Classes with Outstanding Follow-Up Gaps
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {followUp.classesWithGaps.map(g => (
              <div
                key={g.classId}
                className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-bold text-white">{g.className}</h4>
                  <span className="text-[11px] text-rose-400 font-semibold">{g.missingCount} pending action(s)</span>
                </div>

                {onNavigateToRegister && (
                  <button
                    onClick={() => onNavigateToRegister(g.classId)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 transition"
                    title="Open Class Welfare Follow-Up"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
