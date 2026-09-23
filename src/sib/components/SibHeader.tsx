/**
 * GOFAMINT SIB Header Component
 */

import React from 'react';
import {
  BrainCircuit,
  Calendar,
  Sparkles,
  ArrowLeft,
  ArrowRightLeft,
  RefreshCw,
  Search,
  ShieldCheck,
  Lock,
  User,
  Activity
} from 'lucide-react';
import { GofamintLogo } from '../../components/GofamintLogo';
import { QuarterNumber } from '../../types';

interface SibHeaderProps {
  selectedQuarter: QuarterNumber;
  onQuarterChange: (q: QuarterNumber) => void;
  onOpenAskSib: () => void;
  onBackToPortalSelect: () => void;
  onBackToWelcome: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  userRole?: string;
  userName?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const SibHeader: React.FC<SibHeaderProps> = ({
  selectedQuarter,
  onQuarterChange,
  onOpenAskSib,
  onBackToPortalSelect,
  onBackToWelcome,
  onRefresh,
  isLoading,
  userRole = 'Executive Council',
  userName = 'Sunday School Leader',
  searchQuery,
  onSearchChange,
}) => {
  return (
    <header className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 border-b-2 border-amber-400/30 sticky top-0 z-40 shadow-xl text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Logo & Portal Identification */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white p-1.5 shadow-md border border-amber-400/40 flex items-center justify-center shrink-0">
              <img
                src="/gofamint-logo.svg"
                alt="GOFAMINT Logo"
                className="w-full h-full object-contain"
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-amber-300 font-['Cinzel',serif]">
                  THE GOSPEL FAITH MISSION INTL (HOUSE OF FAVOUR)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hidden sm:inline-block">
                  Fourth Portal
                </span>
              </div>

              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-black text-white font-['Cinzel',serif] tracking-wide">
                  School Intelligence Board (SIB)
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-400 text-slate-950 font-mono">
                  v1.0
                </span>
              </div>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="relative flex-1 max-w-xs mx-auto md:mx-4 hidden lg:block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search classes, absences, topics..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900/90 border border-indigo-500/30 focus:border-amber-400 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none transition"
            />
          </div>

          {/* Controls: Quarter Selector, Ask SIB, Refresh & Navigation */}
          <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
            
            {/* Quarter Selector */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-amber-400/40 px-2.5 py-1 rounded-xl text-xs">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] text-slate-400 uppercase font-bold hidden sm:inline">Quarter:</span>
              <select
                value={selectedQuarter}
                onChange={(e) => onQuarterChange(Number(e.target.value) as QuarterNumber)}
                className="bg-transparent text-amber-300 font-black text-xs cursor-pointer focus:outline-none"
              >
                <option value={1} className="bg-slate-900 text-white">Q1 (Active)</option>
                <option value={2} className="bg-slate-900 text-white">Q2</option>
                <option value={3} className="bg-slate-900 text-white">Q3</option>
                <option value={4} className="bg-slate-900 text-white">Q4</option>
              </select>
            </div>

            {/* Ask SIB AI Agent Trigger Button */}
            <button
              onClick={onOpenAskSib}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md hover:shadow-lg transition cursor-pointer"
              title="Open Ask SIB Natural Language Intelligence"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-950 animate-pulse" />
              <span>Ask SIB</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-xl transition cursor-pointer disabled:opacity-50"
              title="Refresh intelligence from Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            {/* Switch Portal Button */}
            <button
              onClick={onBackToPortalSelect}
              className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
              title="Switch to another operational portal"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Portals</span>
            </button>

            {/* Exit to Welcome */}
            <button
              onClick={onBackToWelcome}
              className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
              title="Exit to Welcome Screen"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Exit</span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
