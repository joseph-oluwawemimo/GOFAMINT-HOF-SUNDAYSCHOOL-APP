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
          border: 'border-rose-500/50 bg-rose-950/20',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          icon: <AlertOctagon className="w-5 h-5 text-rose-400" />,
          titleColor: 'text-rose-300',
        };
      case 'WATCH':
        return {
          border: 'border-amber-500/50 bg-amber-950/20',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          titleColor: 'text-amber-300',
        };
      case 'POSITIVE':
        return {
          border: 'border-emerald-500/50 bg-emerald-950/20',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          titleColor: 'text-emerald-300',
        };
      case 'INFORMATION':
      default:
        return {
          border: 'border-indigo-500/50 bg-indigo-950/20',
          badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          icon: <Info className="w-5 h-5 text-indigo-400" />,
          titleColor: 'text-indigo-300',
        };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            Operational Signals
          </span>
          <h2 className="text-lg font-black text-white font-['Cinzel',serif]">
            Leadership Action Center
          </h2>
        </div>
        <span className="text-xs text-slate-400 font-medium">
          {actions.length} prioritized intelligence items
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actions.map((item) => {
          const theme = getCategoryTheme(item.category);
          return (
            <div
              key={item.id}
              className={`p-5 rounded-2xl border ${theme.border} backdrop-blur-xs flex flex-col justify-between space-y-4 shadow-lg hover:border-amber-400/50 transition`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {theme.icon}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${theme.badge}`}>
                      {item.category}
                    </span>
                  </div>

                  <span className="text-[10px] font-bold text-slate-400">
                    Impact: <strong className="text-white">{item.impactedCount}</strong>
                  </span>
                </div>

                <div>
                  <h3 className={`text-base font-black ${theme.titleColor}`}>
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-300 font-semibold mt-0.5">
                    {item.subtitle}
                  </p>
                </div>

                {/* Plain-English "WHY?" box */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-amber-300 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3 text-amber-400" />
                    <span>Why this card appears</span>
                  </span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {item.whyExplanation}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <button
                  onClick={() => onOpenEvidence(item.evidenceId)}
                  className="text-indigo-400 hover:text-amber-300 font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <span>Inspect Evidence</span>
                  <ArrowRight className="w-3 h-3" />
                </button>

                {item.targetPortal && onNavigateToPortal && (
                  <button
                    onClick={() => onNavigateToPortal(item.targetPortal!)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
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
