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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs text-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Logo & Portal Identification */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white p-1.5 shadow-xs border border-purple-200 flex items-center justify-center shrink-0">
              <img
                src="/gofamint-logo.svg"
                alt="GOFAMINT Logo"
                className="w-full h-full object-contain"
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#320b86] font-['Cinzel',serif]">
                  THE GOSPEL FAITH MISSION INTL (HOUSE OF FAVOUR)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-100 text-[#320b86] border border-purple-200 hidden sm:inline-block">
                  Fourth Portal
                </span>
              </div>

              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-black text-slate-900 font-['Cinzel',serif] tracking-wide">
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
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#320b86] rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition"
            />
          </div>

          {/* Controls: Quarter Selector, Ask SIB, Refresh & Navigation */}
          <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
            
            {/* Quarter Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-xs">
              <Calendar className="w-3.5 h-3.5 text-[#320b86]" />
              <span className="text-[10px] text-slate-500 uppercase font-bold hidden sm:inline">Quarter:</span>
              <select
                value={selectedQuarter}
                onChange={(e) => onQuarterChange(Number(e.target.value) as QuarterNumber)}
                className="bg-transparent text-[#320b86] font-black text-xs cursor-pointer focus:outline-none"
              >
                <option value={1} className="bg-white text-slate-900">Q1 (Active)</option>
                <option value={2} className="bg-white text-slate-900">Q2</option>
                <option value={3} className="bg-white text-slate-900">Q3</option>
                <option value={4} className="bg-white text-slate-900">Q4</option>
              </select>
            </div>

            {/* Ask SIB AI Agent Trigger Button */}
            <button
              onClick={onOpenAskSib}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs hover:shadow-sm transition cursor-pointer"
              title="Open Ask SIB Natural Language Intelligence"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-950 animate-pulse" />
              <span>Ask SIB</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition cursor-pointer disabled:opacity-50"
              title="Refresh intelligence from Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#320b86]' : ''}`} />
            </button>

            {/* Switch Portal Button */}
            <button
              onClick={onBackToPortalSelect}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
              title="Switch to another operational portal"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-[#320b86]" />
              <span className="hidden sm:inline">Portals</span>
            </button>

            {/* Exit to Welcome */}
            <button
              onClick={onBackToWelcome}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
              title="Exit to Welcome Screen"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Exit</span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
