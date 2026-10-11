import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Lock,
  CheckCircle2,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { QuarterData } from '../../types';
import {
  getFollowUpWindowForWeek,
  formatDateDisplay,
  getActiveSundayRegisterWeek,
  isSundayRegisterOpenForWeek,
  getCurrentCalendarWeek
} from '../../utils/quarterScheduleUtils';

export interface FollowUpWeekSyncBarProps {
  selectedWeek: number;
  onSelectWeek: (week: number) => void;
  totalWeeks?: number;
  quarter?: QuarterData | null;
  quarterNumber?: number;
  label?: string;
  className?: string;
  isClassPortal?: boolean;
  isCoordinator?: boolean;
}

export const FollowUpWeekSyncBar: React.FC<FollowUpWeekSyncBarProps> = ({
  selectedWeek,
  onSelectWeek,
  totalWeeks = 12,
  quarter,
  label = 'Follow-up week',
  className = '',
  isClassPortal = false,
  isCoordinator = false
}) => {
  // Live ticking clock for countdown display (updates every second)
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeCalWeek = useMemo(() => {
    return getCurrentCalendarWeek(quarter, now);
  }, [quarter, now]);

  const sundayRegisterIntel = useMemo(() => {
    return getActiveSundayRegisterWeek(quarter, now);
  }, [quarter, now]);

  // Window info for the currently selected week
  const currentWindowInfo = useMemo(() => {
    return getFollowUpWindowForWeek(selectedWeek, quarter, now);
  }, [selectedWeek, quarter, now]);

  const handleSelectWeek = (wk: number) => {
    const isWkOpen = isSundayRegisterOpenForWeek(wk, quarter, now);
    if (!isWkOpen) {
      alert(`Week ${wk} follow-up is not yet open. It will open on Sunday morning (12:00 AM WAT) when the register opens.`);
      return;
    }
    onSelectWeek(wk);
  };

  // Format 2-digit number
  const pad2 = (n: number) => String(Math.max(0, n)).padStart(2, '0');

  return (
    <section
      aria-label="Follow-up week synchronization and live deadline window"
      className={`bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-6 shadow-sm print:hidden space-y-4 ${className}`}
    >
      {/* ========================================================================= */}
      {/* 1. TOP HEADER: WEEK TITLE & CHEVRON CONTROLS                             */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-950 via-slate-900 to-[#1e0a45] text-amber-300 flex items-center justify-center shrink-0 shadow-md border border-rose-900/40">
            <Clock className="w-5 h-5 text-amber-300 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-slate-950 tracking-tight">
                {label}: Week {selectedWeek} Follow-Up
              </h3>
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  currentWindowInfo.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-emerald-200/40'
                    : currentWindowInfo.status === 'EXPIRED'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {currentWindowInfo.status === 'ACTIVE'
                  ? '● Live Window Open'
                  : currentWindowInfo.status === 'EXPIRED'
                  ? '🔒 Window Closed'
                  : '⏳ Upcoming'}
              </span>

              {isClassPortal && currentWindowInfo.status === 'EXPIRED' && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                  Read-Only in Class
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5 font-medium">
              Sun, {formatDateDisplay(currentWindowInfo.sundayDate)} – Sat, {formatDateDisplay(currentWindowInfo.saturdayDeadlineDate)} (11:00 PM WAT)
            </p>
          </div>
        </div>

        {/* Prev / Next Week Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => handleSelectWeek(Math.max(1, selectedWeek - 1))}
            disabled={selectedWeek <= 1}
            aria-label="Previous follow-up week"
            className="w-10 h-10 grid place-items-center bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-xl text-slate-700 transition cursor-pointer shadow-xs"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-black text-slate-700 font-mono px-1">
            Wk {selectedWeek} / {totalWeeks}
          </span>
          <button
            type="button"
            onClick={() => handleSelectWeek(Math.min(totalWeeks, selectedWeek + 1))}
            disabled={selectedWeek >= totalWeeks || !isSundayRegisterOpenForWeek(selectedWeek + 1, quarter, now)}
            aria-label="Next follow-up week"
            className="w-10 h-10 grid place-items-center bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-xl text-slate-700 transition cursor-pointer shadow-xs"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. BIG, HIGH-IMPACT PROMINENT LIVE DEADLINE TIMER BANNER                  */}
      {/* ========================================================================= */}
      {currentWindowInfo.status === 'ACTIVE' && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-emerald-500/40 relative overflow-hidden animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            {/* Left: Status Description */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                  Active Follow-Up Outreach Window
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-black text-white tracking-tight">
                Window Closes Saturday at 11:00 PM (WAT)
              </h4>
              <p className="text-[11px] text-emerald-200/80 font-medium">
                Teachers and secretaries must record responses, welfare outreach, and reminders before the Saturday 11:00 PM lock.
              </p>
            </div>

            {/* Right: Big Digital Countdown Clock Display */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 self-center sm:self-auto bg-black/40 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl border border-emerald-500/30 shadow-inner">
              {/* Days */}
              <div className="flex flex-col items-center min-w-[54px] sm:min-w-[62px] px-2 py-1 bg-white/10 rounded-xl border border-white/10">
                <span className="font-mono text-xl sm:text-2xl font-black text-amber-300 tracking-wider">
                  {pad2(currentWindowInfo.days)}
                </span>
                <span className="text-[9px] uppercase font-black text-emerald-300 tracking-wider">
                  Days
                </span>
              </div>
              <span className="text-emerald-400 font-mono text-lg font-black">:</span>

              {/* Hours */}
              <div className="flex flex-col items-center min-w-[54px] sm:min-w-[62px] px-2 py-1 bg-white/10 rounded-xl border border-white/10">
                <span className="font-mono text-xl sm:text-2xl font-black text-white tracking-wider">
                  {pad2(currentWindowInfo.hours)}
                </span>
                <span className="text-[9px] uppercase font-black text-emerald-300 tracking-wider">
                  Hours
                </span>
              </div>
              <span className="text-emerald-400 font-mono text-lg font-black">:</span>

              {/* Minutes */}
              <div className="flex flex-col items-center min-w-[54px] sm:min-w-[62px] px-2 py-1 bg-white/10 rounded-xl border border-white/10">
                <span className="font-mono text-xl sm:text-2xl font-black text-white tracking-wider">
                  {pad2(currentWindowInfo.minutes)}
                </span>
                <span className="text-[9px] uppercase font-black text-emerald-300 tracking-wider">
                  Mins
                </span>
              </div>
              <span className="text-emerald-400 font-mono text-lg font-black">:</span>

              {/* Seconds */}
              <div className="flex flex-col items-center min-w-[54px] sm:min-w-[62px] px-2 py-1 bg-emerald-500/20 rounded-xl border border-emerald-400/30">
                <span className="font-mono text-xl sm:text-2xl font-black text-emerald-300 tracking-wider">
                  {pad2(currentWindowInfo.seconds)}
                </span>
                <span className="text-[9px] uppercase font-black text-emerald-300 tracking-wider">
                  Secs
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* When Expired: Big Prominent Closed Notice */}
      {currentWindowInfo.status === 'EXPIRED' && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-rose-950 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-amber-500/40 relative overflow-hidden animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                  Week {selectedWeek} Follow-Up Window Closed
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-black text-white tracking-tight">
                Deadline Ended Saturday at 11:00 PM (WAT)
              </h4>
              <p className="text-[11px] text-amber-200/80 font-medium max-w-2xl">
                In accordance with Sunday School regulations, follow-up recording for past closed weeks is locked for class portals (Read-Only Archive). Only the Follow-Up Directorate / Coordinator can review records.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto bg-amber-400/20 border border-amber-400/30 px-3.5 py-2 rounded-xl text-amber-300 text-xs font-black">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Closed Session · Read-Only</span>
            </div>
          </div>
        </div>
      )}

      {/* When Upcoming: Big Not Yet Open Notice */}
      {currentWindowInfo.status === 'UPCOMING' && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-slate-700/60 relative overflow-hidden animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                  Week {selectedWeek} Follow-Up Not Yet Open
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-black text-white tracking-tight">
                Opens Sunday at 12:00 AM WAT
              </h4>
              <p className="text-[11px] text-slate-300 font-medium">
                Follow-up operations for this week open automatically on Sunday morning when the Class Register goes live.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. 12-WEEK SELECTOR PILLS: IDENTICAL TO CLASS REGISTER                    */}
      {/* ========================================================================= */}
      <div className={`grid grid-cols-6 ${totalWeeks >= 13 ? 'lg:grid-cols-13' : 'sm:grid-cols-12'} gap-1.5 pt-1`}>
        {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((wk) => {
          const isSelected = wk === selectedWeek;
          const wkWindow = getFollowUpWindowForWeek(wk, quarter, now);
          const isWkOpen = isSundayRegisterOpenForWeek(wk, quarter, now);
          const isWkActive = wkWindow.status === 'ACTIVE';
          const isWkExpired = wkWindow.status === 'EXPIRED';
          const isWkUpcoming = !isWkOpen || wkWindow.status === 'UPCOMING';

          return (
            <button
              key={wk}
              id={`btn-followup-week-${wk}`}
              type="button"
              onClick={() => handleSelectWeek(wk)}
              aria-label={`Select follow-up week ${wk}${isWkActive ? ', active window' : isWkExpired ? ', expired' : ', locked'}`}
              aria-current={isSelected ? 'true' : undefined}
              className={`min-h-[48px] sm:min-h-[54px] py-1.5 px-1 rounded-xl text-center transition-all flex flex-col items-center justify-center border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
                isSelected
                  ? 'bg-rose-950 border-rose-950 text-white shadow-sm ring-2 ring-rose-500/30'
                  : isWkActive
                  ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-400 text-emerald-950 font-black'
                  : isWkUpcoming
                  ? 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                  : isWkExpired
                  ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900 font-bold'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <span className={`text-[9px] uppercase font-black ${isSelected ? 'text-rose-200' : 'text-slate-400'}`}>
                Wk
              </span>
              <span className="text-sm font-black leading-none">{wk}</span>
              <span
                className={`mt-1 h-1.5 w-1.5 rounded-full ${
                  isWkActive
                    ? 'bg-emerald-500 ring-2 ring-emerald-300/60'
                    : isWkExpired
                    ? 'bg-amber-500'
                    : 'bg-slate-300'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Active Outreach Window (Sun 12:00 AM – Sat 11:00 PM)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Closed Window (Locked in Class Register)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-400" /> Upcoming (Locked until Sunday)
          </span>
        </div>

        <span className="text-[10px] text-slate-400">
          Nigeria Time (WAT · UTC+1)
        </span>
      </div>
    </section>
  );
};
