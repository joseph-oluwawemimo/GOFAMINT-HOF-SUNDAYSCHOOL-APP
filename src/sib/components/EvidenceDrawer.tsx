/**
 * GOFAMINT SIB - Reusable Evidence Drawer
 * 
 * Strict Principle:
 * NO INTELLIGENCE WITHOUT EVIDENCE.
 * Displays the verified supporting records, mathematical derivation,
 * data confidence, and actionable operational navigation link.
 * 
 * Redesigned using Jobby UI visual language (clean, bright, spacious, modern).
 */

import React from 'react';
import {
  X,
  FileCheck2,
  Database,
  ExternalLink,
  Info,
  Layers,
} from 'lucide-react';
import { EvidenceObject } from '../types/sibTypes';

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  evidence: EvidenceObject | null;
  onNavigateToPortal?: (targetPortal: 'ADMIN' | 'CLASS_REGISTER' | 'WORKERS', context?: Record<string, unknown>) => void;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  isOpen,
  onClose,
  evidence,
  onNavigateToPortal,
}) => {
  if (!isOpen || !evidence) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md sm:max-w-lg bg-white border-l border-slate-200 shadow-2xl flex flex-col justify-between text-slate-800">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-[#320b86]">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#320b86]">
                  Verified Fact Proof
                </span>
                <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                  Evidence Drawer
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
            
            {/* Target & Metric Title Banner */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-[#320b86]">
                  {evidence.targetType}: {evidence.targetName || evidence.targetId}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-50 text-[#320b86] border border-purple-200">
                  {evidence.periodLabel}
                </span>
              </div>
              <h4 className="text-base font-black text-slate-900">
                {evidence.metricName}
              </h4>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl font-black text-[#320b86] font-mono">
                  {evidence.calculatedValue}
                </span>
                <span className="text-slate-500 font-medium">calculated value</span>
              </div>
            </div>

            {/* Formula & Derivation */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#320b86]" />
                <span>Deterministic Calculation Formula</span>
              </span>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-800 break-words">
                {evidence.calculationFormula}
              </div>
            </div>

            {/* Component Breakdown if available */}
            {evidence.componentBreakdown && evidence.componentBreakdown.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#320b86]" />
                  <span>Component Breakdown</span>
                </span>
                <div className="space-y-1.5">
                  {evidence.componentBreakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-700 font-medium">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono">{item.value}%</span>
                        <span className="text-[#320b86] font-bold font-mono">+{item.weightedContribution}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Supporting Records Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Supporting Records
                </span>
                <span className="text-base font-black text-slate-900 font-mono">
                  {evidence.supportingRecordCount}
                </span>
                <span className="text-[10px] text-slate-500 block">entries evaluated</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Confidence
                </span>
                <span className={`text-xs font-black uppercase tracking-wider block ${
                  evidence.confidence === 'HIGH' ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  {evidence.confidence}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {evidence.confidenceReason}
                </span>
              </div>
            </div>

            {/* Limitations Notice */}
            {evidence.limitations && evidence.limitations.length > 0 && (
              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 space-y-1">
                <div className="flex items-center gap-1.5 text-[#320b86] font-bold text-[11px]">
                  <Info className="w-3.5 h-3.5 text-[#320b86]" />
                  <span>Observation Scope & Limitations</span>
                </div>
                <ul className="space-y-1 text-slate-600 pl-4 list-disc text-[11px]">
                  {evidence.limitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>
            )}

          </div>

          {/* Footer Action Button */}
          <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-3">
            {evidence.recommendedOperationalAction && onNavigateToPortal && (
              <button
                onClick={() => {
                  onNavigateToPortal(
                    evidence.recommendedOperationalAction!.targetPortal,
                    evidence.recommendedOperationalAction!.linkContext
                  );
                  onClose();
                }}
                className="w-full py-3 bg-[#320b86] hover:bg-[#250866] text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <span>{evidence.recommendedOperationalAction.label}</span>
                <ExternalLink className="w-3.5 h-3.5 text-white" />
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Close Proof
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
