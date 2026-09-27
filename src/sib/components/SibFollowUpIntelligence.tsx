/**
 * GOFAMINT SIB Follow-Up & Pastoral Care Intelligence Tab
 * Redesigned using Jobby UI visual language (clean, bright, spacious, modern).
 */

import React from 'react';
import {
  AlertTriangle,
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
  onNavigateToRegister,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header */}
      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-[#320b86]">
          Care Continuity Diagnostics
        </span>
        <h2 className="text-xl font-black text-slate-900 font-['Cinzel',serif]">
          Pastoral Follow-Up Intelligence
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Monitoring execution of contacts for absent students across Quarter {followUp.quarterNumber}.
        </p>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Required Follow-Ups</span>
          <span className="text-3xl font-black text-slate-900 font-mono">{followUp.requiredFollowUps}</span>
          <span className="text-[11px] text-slate-500 block">Triggered by 2+ consecutive absences</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-emerald-200 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-emerald-700 block">Completed Follow-Ups</span>
          <span className="text-3xl font-black text-emerald-700 font-mono">{followUp.completedFollowUps}</span>
          <span className="text-[11px] text-slate-500 block">Contact logged with outcome</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-purple-200 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#320b86] block">Completion Rate</span>
          <span className="text-3xl font-black text-[#320b86] font-mono">{followUp.completionRate}%</span>
          <span className="text-[11px] text-slate-500 block">{followUp.trend.direction} trend</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-rose-200 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-rose-700 block">Outstanding Gaps</span>
          <span className="text-3xl font-black text-rose-700 font-mono">{followUp.outstandingFollowUps}</span>
          <span className="text-[11px] text-slate-500 block">Awaiting recorded action</span>
        </div>

      </div>

      {/* Urgency Level Distribution */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <h3 className="text-sm font-black text-slate-900 font-['Cinzel',serif]">
          Absence Care Escalation Tier Distribution
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center space-y-1">
            <span className="text-[10px] font-black uppercase text-amber-800 block">Yellow Tier (Week 2)</span>
            <span className="text-2xl font-black text-amber-700 font-mono">{followUp.urgencyBreakdown.yellow}</span>
            <span className="text-[10px] text-slate-500 block">Secretary Check-in</span>
          </div>

          <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 text-center space-y-1">
            <span className="text-[10px] font-black uppercase text-orange-800 block">Orange Tier (Week 3)</span>
            <span className="text-2xl font-black text-orange-700 font-mono">{followUp.urgencyBreakdown.orange}</span>
            <span className="text-[10px] text-slate-500 block">Direct Phone Contact</span>
          </div>

          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center space-y-1">
            <span className="text-[10px] font-black uppercase text-rose-800 block">Red Tier (Week 4)</span>
            <span className="text-2xl font-black text-rose-700 font-mono">{followUp.urgencyBreakdown.red}</span>
            <span className="text-[10px] text-slate-500 block">Pastoral Visitation</span>
          </div>

          <div className="p-4 rounded-xl bg-rose-100/60 border border-rose-300 text-center space-y-1">
            <span className="text-[10px] font-black uppercase text-rose-900 block">Critical Tier (5+ Wks)</span>
            <span className="text-2xl font-black text-rose-800 font-mono">{followUp.urgencyBreakdown.critical}</span>
            <span className="text-[10px] text-slate-500 block">Exit Review Evaluation</span>
          </div>
        </div>
      </div>

      {/* Classes with Follow-Up Gaps */}
      {followUp.classesWithGaps.length > 0 && (
        <div className="p-6 rounded-2xl bg-white border border-rose-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h3 className="text-sm font-black text-slate-900 font-['Cinzel',serif]">
              Classes with Outstanding Follow-Up Gaps
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {followUp.classesWithGaps.map(g => (
              <div
                key={g.classId}
                className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{g.className}</h4>
                  <span className="text-[11px] text-rose-700 font-semibold">{g.missingCount} pending action(s)</span>
                </div>

                {onNavigateToRegister && (
                  <button
                    onClick={() => onNavigateToRegister(g.classId)}
                    className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#320b86] border border-purple-200 transition cursor-pointer"
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
