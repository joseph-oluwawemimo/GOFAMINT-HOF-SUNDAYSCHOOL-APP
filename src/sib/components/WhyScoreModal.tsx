/**
 * GOFAMINT SIB - Transparent Score Explanation Modal
 * 
 * Strict Principle:
 * NO BLACK-BOX SCORES. NO SCORE WITHOUT EXPLANATION.
 * Decomposes any score into its exact formula, weighted components,
 * positive/negative contributors, confidence, and recommended action.
 */

import React from 'react';
import {
  X,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Database,
  Info
} from 'lucide-react';
import { ScoreExplanation } from '../types/sibTypes';

interface WhyScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  explanation: ScoreExplanation | null;
  onViewEvidence?: (evidenceId: string) => void;
}

export const WhyScoreModal: React.FC<WhyScoreModalProps> = ({
  isOpen,
  onClose,
  explanation,
  onViewEvidence,
}) => {
  if (!isOpen || !explanation) return null;

  const scoreColor = explanation.finalScore >= 75
    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
    : explanation.finalScore >= 60
    ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
    : 'text-rose-400 border-rose-500/40 bg-rose-500/10';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-indigo-500/30 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-amber-300">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                Score Decomposition & Evidence Rationale
              </span>
              <h2 className="text-lg font-black text-white font-['Cinzel',serif]">
                {explanation.scoreName}: {explanation.targetName}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          
          {/* Big Score Callout */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-5 rounded-2xl border bg-slate-950/60 gap-4">
            <div>
              <span className="text-xs uppercase font-bold text-slate-400">Verified Composite Score</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-4xl font-black font-['Cinzel',serif] ${scoreColor.split(' ')[0]}`}>
                  {explanation.finalScore}%
                </span>
                <span className="text-xs text-slate-500 font-semibold">/ 100% Total Index</span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                {explanation.calculationFormula}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="text-[10px] uppercase font-black text-slate-400">Confidence Rating</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                explanation.confidence === 'HIGH'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : explanation.confidence === 'MEDIUM'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}>
                {explanation.confidence} CONFIDENCE
              </span>
              <span className="text-[11px] text-slate-400 text-right max-w-xs">
                {explanation.confidenceReason}
              </span>
            </div>
          </div>

          {/* Component Breakdown Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-amber-400" />
              <span>Weighted Component Contributions</span>
            </h3>

            <div className="space-y-2">
              {explanation.components.map((comp, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-indigo-500/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{comp.label}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Weight: {Math.round(comp.weight * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{comp.explanation}</p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 sm:text-right">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Raw Value</span>
                      <span className="font-bold text-xs text-slate-200">{comp.value}%</span>
                    </div>
                    <div className="w-px h-6 bg-slate-800" />
                    <div>
                      <span className="text-[10px] text-amber-400 block uppercase">Contribution</span>
                      <span className="font-black text-xs text-amber-300">+{comp.weightedContribution}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Positives & Negatives */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Positives */}
            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Positive Contributors</span>
              </div>
              <ul className="space-y-1.5">
                {explanation.positiveContributors.map((pos, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{pos}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Areas of Concern */}
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase text-rose-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Areas Needing Attention</span>
              </div>
              {explanation.negativeContributors.length > 0 ? (
                <ul className="space-y-1.5">
                  {explanation.negativeContributors.map((neg, idx) => (
                    <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{neg}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic">No critical concerns identified in this period.</p>
              )}
            </div>

          </div>

          {/* Recommended Operational Action */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/80 to-slate-900 border border-indigo-400/40 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Recommended Operational Action</span>
              </span>
              <p className="text-xs text-white font-medium">
                {explanation.recommendedAction}
              </p>
            </div>

            {onViewEvidence && explanation.evidenceIds && explanation.evidenceIds.length > 0 && (
              <button
                onClick={() => onViewEvidence(explanation.evidenceIds[0])}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition shrink-0 cursor-pointer"
              >
                <span>View Raw Evidence</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Limitations */}
          {explanation.limitations && explanation.limitations.length > 0 && (
            <div className="flex items-start gap-2 text-[11px] text-slate-500">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                <strong>Data Limitations:</strong> {explanation.limitations.join(' ')}
              </span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close Explanation
          </button>
        </div>

      </div>
    </div>
  );
};
