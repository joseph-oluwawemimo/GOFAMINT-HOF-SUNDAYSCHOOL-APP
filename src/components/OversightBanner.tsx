import React from 'react';
import { Crown, Eye, ArrowLeft, ShieldAlert } from 'lucide-react';

interface OversightBannerProps {
  targetLabel: string;
  onExitOversight: () => void;
}

export const OversightBanner: React.FC<OversightBannerProps> = ({ targetLabel, onExitOversight }) => {
  return (
    <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-slate-950 px-4 py-2.5 shadow-lg border-b-2 border-amber-300 flex items-center justify-between z-50 sticky top-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-950 text-amber-400 flex items-center justify-center font-bold shadow-md">
          <Eye className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest bg-slate-950 text-amber-300 px-2 py-0.5 rounded">
              ADMIN OVERSIGHT MODE
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-950">
              LIVE DATA INSPECTION
            </span>
          </div>
          <p className="text-[11px] text-slate-900 font-bold mt-0.5">
            Currently Inspecting: <span className="underline decoration-slate-950 font-extrabold">{targetLabel}</span>
          </p>
        </div>
      </div>

      <button
        onClick={onExitOversight}
        className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-900 text-amber-400 text-xs font-black rounded-lg shadow-md flex items-center gap-1.5 transition active:scale-95 border border-amber-400/40"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Exit Oversight to Council</span>
      </button>
    </div>
  );
};
