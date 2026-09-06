import React from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Lock,
  Sparkles,
  Users,
  Award,
  BookOpen,
  Calendar,
  Home,
  Shield,
  ArrowLeft
} from 'lucide-react';
import { GofamintLogo } from './GofamintLogo';
import { ClassProfile, SyncState } from '../types';

interface HeaderProps {
  classProfile: ClassProfile | null;
  currentWeek: number;
  syncState: SyncState;
  onSyncClick: () => void;
  onLockClick: () => void;
  onOpenAI: () => void;
  onOpenWelcome?: () => void;
  onOpenAdminPortal?: () => void;
  onOpenWorkersModule?: () => void;
  totalStudents: number;
  totalVisitors: number;
  selectedQuarter?: number;
  onQuarterChange?: (q: number) => void;
  activeQuarterNumber?: number;
  totalWeeksInQuarter?: number;
}

export const Header: React.FC<HeaderProps> = ({
  classProfile,
  currentWeek,
  syncState,
  onSyncClick,
  onLockClick,
  onOpenAI,
  onOpenWelcome,
  onOpenAdminPortal,
  onOpenWorkersModule,
  totalStudents,
  totalVisitors,
  selectedQuarter = 1,
  onQuarterChange,
  activeQuarterNumber = 1,
  totalWeeksInQuarter = 12
}) => {
  return (
    <header className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white border-b-2 border-indigo-500/40 sticky top-0 z-40 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

          {/* Main Logo & Church Branding */}
          <div className="flex items-center gap-3.5 cursor-pointer" onClick={onOpenWelcome} title="Go to Opening Page">
            <div className="hover:scale-105 transition transform">
              <GofamintLogo className="w-11 h-11 drop-shadow-md" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest opacity-80 uppercase text-amber-300 font-['Cinzel',serif]">
                  THE GOSPEL FAITH MISSION INTERNATIONAL(HOUSE OF FAVOUR)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 mt-0.5">
                <h2 className="text-base sm:text-xl font-black tracking-tight text-white uppercase font-['Cinzel',serif]">
                  GOFAMINT_HOF Sunday School Register
                </h2>
                {classProfile && (
                  <div className="bg-blue-800 px-3 py-1 rounded text-xs sm:text-sm font-bold border border-blue-400 text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span>CLASS: {classProfile.className.toUpperCase()}</span>
                    <span className="opacity-75 text-xs font-normal">({classProfile.department})</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics & System Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-end md:self-center">

            {/* Quarter Selector / Indicator */}
            {onQuarterChange ? (
              <div className="flex items-center gap-1 bg-blue-950/90 border border-amber-400/50 px-2 py-1 rounded-lg text-xs font-black">
                <span className="text-[10px] text-amber-300 uppercase tracking-wider hidden sm:inline">Quarter:</span>
                <select
                  id="header-quarter-select"
                  value={selectedQuarter}
                  onChange={(e) => onQuarterChange(Number(e.target.value))}
                  className="bg-blue-900 text-amber-300 font-black text-xs rounded px-1.5 py-0.5 border border-amber-400/40 cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-300"
                >
                  <option value={1}>Q1 {activeQuarterNumber === 1 ? '(Active)' : '(Archived)'}</option>
                  <option value={2}>Q2 {activeQuarterNumber === 2 ? '(Active)' : (activeQuarterNumber > 2 ? '(Archived)' : '(Upcoming)')}</option>
                  <option value={3}>Q3 {activeQuarterNumber === 3 ? '(Active)' : (activeQuarterNumber > 3 ? '(Archived)' : '(Upcoming)')}</option>
                  <option value={4}>Q4 {activeQuarterNumber === 4 ? '(Active)' : '(Upcoming)'}</option>
                </select>
                {selectedQuarter === activeQuarterNumber ? (
                  <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] uppercase font-black rounded border border-emerald-400/30">Active</span>
                ) : (
                  <span className="px-1.5 py-0.5 bg-slate-500/30 text-slate-300 text-[9px] uppercase font-bold rounded">View Only</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-blue-950/80 border border-blue-700/80 px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-100">
                <span className="text-[10px] uppercase text-amber-300">Q{activeQuarterNumber}</span>
              </div>
            )}

            {/* Current Lesson Badge */}
            <div className="flex items-center gap-1.5 bg-blue-950/80 border border-blue-700/80 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-100">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] uppercase opacity-75">Lesson</span>
              <span className="font-black text-amber-300 text-sm">#{currentWeek}</span>
              <span className="text-blue-300 text-[10px]">/ {totalWeeksInQuarter}</span>
            </div>

            {/* Quick Stats Pill */}
            <div className="hidden sm:flex items-center gap-2 bg-blue-950/80 border border-blue-700/80 px-3 py-1.5 rounded-lg text-xs text-blue-200">
              <Users className="w-3.5 h-3.5 text-blue-300" />
              <span>Students: <strong className="text-white">{totalStudents}</strong></span>
              <span className="text-blue-600">|</span>
              <span>Visitors: <strong className="text-emerald-300">{totalVisitors}</strong></span>
            </div>

            {/* Navigation Actions: Back to Welcome Page & Portals */}
            {onOpenWelcome && (
              <button
                id="header-btn-back-welcome"
                onClick={onOpenWelcome}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-indigo-400/40 rounded-lg text-xs font-bold text-amber-300 hover:text-white transition shadow-xs cursor-pointer"
                title="Return to Welcome Page"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Back to Welcome Page</span>
                <span className="sm:hidden">Welcome</span>
              </button>
            )}

            {/* Lock / Security Button */}
            <button
              id="header-btn-lock"
              onClick={onLockClick}
              className="p-1.5 bg-blue-950 hover:bg-blue-800 border border-blue-700 text-blue-200 hover:text-white rounded-lg transition"
              title="Lock Secretary Console"
            >
              <Lock className="w-4 h-4" />
            </button>

          </div>
        </div>
      </div>
    </header>
  );
};
