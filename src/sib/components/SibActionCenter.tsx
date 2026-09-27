/**
 * GOFAMINT SIB Leadership Action Center Component
 * 
 * Strict Principle:
 * Renders categorized leadership action cards:
 * 🔴 URGENT, 🟠 WATCH, 🟢 POSITIVE, 🔵 INFORMATION.
 * Every card explicitly explains WHY it appears in that category.
 */

import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowRight,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { ActionItem } from '../types/sibTypes';

interface SibActionCenterProps {
  actions: ActionItem[];
  onOpenEvidence: (evidenceId: string) => void;
  onNavigateToPortal?: (targetPortal: 'ADMIN' | 'CLASS_REGISTER' | 'WORKERS') => void;
}

export const SibActionCenter: React.FC<SibActionCenterProps> = ({
  actions,
  onOpenEvidence,
  onNavigateToPortal,
}) => {
  const getCategoryTheme = (category: ActionItem['category']) => {
    switch (category) {
      case 'URGENT':
        return {
          border: 'border-rose-200 bg-rose-50/50',
          badge: 'bg-rose-100 text-rose-800 border-rose-300',
          icon: <AlertOctagon className="w-5 h-5 text-rose-600" />,
          titleColor: 'text-rose-950',
        };
      case 'WATCH':
        return {
          border: 'border-amber-200 bg-amber-50/50',
          badge: 'bg-amber-100 text-amber-800 border-amber-300',
          icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
          titleColor: 'text-amber-950',
        };
      case 'POSITIVE':
        return {
          border: 'border-emerald-200 bg-emerald-50/50',
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
          titleColor: 'text-emerald-950',
        };
      case 'INFORMATION':
      default:
        return {
          border: 'border-purple-200 bg-purple-50/50',
          badge: 'bg-purple-100 text-[#320b86] border-purple-200',
          icon: <Info className="w-5 h-5 text-[#320b86]" />,
          titleColor: 'text-purple-950',
        };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#320b86]">
            Operational Signals
          </span>
          <h2 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
            Leadership Action Center
          </h2>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {actions.length} prioritized intelligence items
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actions.map((item) => {
          const theme = getCategoryTheme(item.category);
          return (
            <div
              key={item.id}
              className={`p-5 rounded-2xl border ${theme.border} flex flex-col justify-between space-y-4 shadow-xs hover:border-[#320b86]/30 transition`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {theme.icon}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${theme.badge}`}>
                      {item.category}
                    </span>
                  </div>

                  <span className="text-[10px] font-bold text-slate-500">
                    Impact: <strong className="text-slate-900">{item.impactedCount}</strong>
                  </span>
                </div>

                <div>
                  <h3 className={`text-base font-black ${theme.titleColor}`}>
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-600 font-semibold mt-0.5">
                    {item.subtitle}
                  </p>
                </div>

                {/* Plain-English "WHY?" box */}
                <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-[#320b86] flex items-center gap-1">
                    <HelpCircle className="w-3 h-3 text-[#320b86]" />
                    <span>Why this card appears</span>
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {item.whyExplanation}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                <button
                  onClick={() => onOpenEvidence(item.evidenceId)}
                  className="text-[#320b86] hover:underline font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <span>Inspect Evidence</span>
                  <ArrowRight className="w-3 h-3" />
                </button>

                {item.targetPortal && onNavigateToPortal && (
                  <button
                    onClick={() => onNavigateToPortal(item.targetPortal!)}
                    className="px-3 py-1.5 bg-[#320b86] hover:bg-[#250664] text-white rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <span>{item.actionLabel || 'Open Console'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
