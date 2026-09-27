/**
 * GOFAMINT SIB - Transparent Score Explanation Modal
 * 
 * Strict Principle:
 * NO BLACK-BOX SCORES. NO SCORE WITHOUT EXPLANATION.
 * Decomposes any score into its exact formula, weighted components,
 * positive/negative contributors, confidence, and recommended action.
 * 
 * Redesigned using Jobby UI visual language (clean, bright, spacious, modern).
 */

import React from 'react';
import {
  X,
  HelpCircle,
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
    ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
    : explanation.finalScore >= 60
    ? 'text-amber-700 border-amber-200 bg-amber-50'
    : 'text-rose-700 border-rose-200 bg-rose-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-[#320b86]">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#320b86]">
                Score Decomposition & Evidence Rationale
              </span>
              <h2 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
                {explanation.scoreName}: {explanation.targetName}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          
          {/* Big Score Callout */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-5 rounded-xl border border-slate-200 bg-slate-50 gap-4">
            <div>
              <span className="text-xs uppercase font-bold text-slate-500">Verified Composite Score</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-4xl font-black font-['Cinzel',serif] ${scoreColor.split(' ')[0]}`}>
                  {explanation.finalScore}%
                </span>
                <span className="text-xs text-slate-500 font-semibold">/ 100% Total Index</span>
              </div>
              <p className="text-xs text-slate-600 mt-1 font-mono">
                {explanation.calculationFormula}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="text-[10px] uppercase font-black text-slate-500">Confidence Rating</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                explanation.confidence === 'HIGH'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : explanation.confidence === 'MEDIUM'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {explanation.confidence} CONFIDENCE
              </span>
              <span className="text-[11px] text-slate-500 text-right max-w-xs">
                {explanation.confidenceReason}
              </span>
            </div>
          </div>

          {/* Component Breakdown Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#320b86] flex items-center gap-1.5">
              <Database className="w-4 h-4 text-[#320b86]" />
              <span>Weighted Component Contributions</span>
            </h3>

            <div className="space-y-2">
              {explanation.components.map((comp, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-[#320b86]/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{comp.label}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-purple-50 text-[#320b86] border border-purple-200">
                        Weight: {Math.round(comp.weight * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{comp.explanation}</p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 sm:text-right">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Raw Value</span>
                      <span className="font-bold text-xs text-slate-700">{comp.value}%</span>
                    </div>
                    <div className="w-px h-6 bg-slate-200" />
                    <div>
                      <span className="text-[10px] text-[#320b86] block uppercase">Contribution</span>
                      <span className="font-black text-xs text-[#320b86]">+{comp.weightedContribution}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Positives & Negatives */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Positives */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Positive Contributors</span>
              </div>
              <ul className="space-y-1.5">
                {explanation.positiveContributors.map((pos, idx) => (
                  <li key={idx} className="text-xs text-emerald-950 flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{pos}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Areas of Concern */}
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Areas Needing Attention</span>
              </div>
              {explanation.negativeContributors.length > 0 ? (
                <ul className="space-y-1.5">
                  {explanation.negativeContributors.map((neg, idx) => (
                    <li key={idx} className="text-xs text-rose-950 flex items-start gap-2">
                      <span className="text-rose-600 font-bold">•</span>
                      <span>{neg}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 italic">No critical concerns identified in this period.</p>
              )}
            </div>

          </div>

          {/* Recommended Operational Action */}
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#320b86] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#320b86]" />
                <span>Recommended Operational Action</span>
              </span>
              <p className="text-xs text-slate-800 font-medium">
                {explanation.recommendedAction}
              </p>
            </div>

            {onViewEvidence && explanation.evidenceIds && explanation.evidenceIds.length > 0 && (
              <button
                onClick={() => onViewEvidence(explanation.evidenceIds[0])}
                className="px-4 py-2 bg-[#320b86] hover:bg-[#250866] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition shrink-0 cursor-pointer"
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
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close Explanation
          </button>
        </div>

      </div>
    </div>
  );
};
