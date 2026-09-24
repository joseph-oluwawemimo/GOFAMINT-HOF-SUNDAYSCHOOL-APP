import React from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Lock,
  Users,
  Calendar,
  Home
} from 'lucide-react';
import { GofamintLogo } from './GofamintLogo';
import { ClassProfile, QuarterData, QuarterNumber, QuarterStatus, SyncState } from '../types';

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
  quarters?: QuarterData[];
  totalWeeksInQuarter?: number;
}

export const Header: React.FC<HeaderProps> = ({
  classProfile,
  currentWeek,
  syncState,
  onSyncClick,
  onLockClick,
  onOpenWelcome,
  totalStudents,
  totalVisitors,
  selectedQuarter = 1,
  onQuarterChange,
  activeQuarterNumber = 1,
  quarters = [],
  totalWeeksInQuarter = 12
}) => {
  const getQuarterStatus = (quarterNumber: number): QuarterStatus => {
    const storedStatus = quarters.find(quarter => quarter.quarterNumber === quarterNumber)?.status;
    if (storedStatus) return storedStatus;
    if (quarterNumber === activeQuarterNumber) return 'ACTIVE';
    return quarterNumber < activeQuarterNumber ? 'ARCHIVED' : 'UPCOMING';
  };

  const selectedQuarterStatus = getQuarterStatus(selectedQuarter);
  const quarterStatusLabel = selectedQuarterStatus === 'ACTIVE'
    ? 'Active'
    : selectedQuarterStatus === 'ARCHIVED'
      ? 'Archive'
      : 'Upcoming';

  return (
    <header className="relative z-30 border-b border-indigo-400/30 bg-gradient-to-r from-[#06152f] via-[#10245a] to-[#211947] text-white shadow-xl">
      <div className="mx-auto max-w-[1440px] px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <button
              type="button"
              onClick={onOpenWelcome}
              className="flex min-w-0 items-center gap-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              title="Open welcome page"
            >
              <GofamintLogo className="h-9 w-9 shrink-0 drop-shadow-md sm:h-11 sm:w-11" />
              <span className="min-w-0">
                <span className="hidden text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300/90 sm:block">
                  GOFAMINT · House of Favour
                </span>
                <span className="block truncate text-base font-black tracking-tight sm:text-xl">
                  Sunday School Register
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-100/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="truncate">{classProfile?.className || 'Class register'}</span>
                  {classProfile?.department && <span className="hidden sm:inline">· {classProfile.department}</span>}
                </span>
              </span>
            </button>

            <div className="flex items-center gap-1.5 lg:hidden">
              {onOpenWelcome && (
                <button
                  id="header-btn-back-welcome-mobile"
                  type="button"
                  onClick={onOpenWelcome}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/10 text-amber-300 transition hover:bg-white/20"
                  aria-label="Open welcome page"
                >
                  <Home className="h-4 w-4" />
                </button>
              )}
              <button
                id="header-btn-lock-mobile"
                type="button"
                onClick={onLockClick}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/10 text-blue-100 transition hover:bg-white/20"
                aria-label="Lock secretary console"
              >
                <Lock className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none lg:justify-end lg:overflow-visible lg:pb-0">
            {onQuarterChange ? (
              <label className="flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-amber-300/35 bg-blue-950/70 px-2.5 text-xs font-black">
                <span className="hidden text-[10px] uppercase tracking-wider text-amber-300 sm:inline">Quarter</span>
                <select
                  id="header-quarter-select"
                  value={selectedQuarter}
                  onChange={(event) => onQuarterChange(Number(event.target.value))}
                  className="cursor-pointer rounded-md border border-white/15 bg-blue-900 px-1.5 py-1 text-xs font-black text-white outline-none focus:ring-2 focus:ring-amber-300"
                  aria-label="Select quarter"
                >
                  {([1, 2, 3, 4] as QuarterNumber[]).map(quarterNumber => (
                    <option key={quarterNumber} value={quarterNumber}>Q{quarterNumber}</option>
                  ))}
                </select>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] uppercase ${
                  selectedQuarterStatus === 'ACTIVE'
                    ? 'bg-emerald-400/20 text-emerald-300'
                    : selectedQuarterStatus === 'ARCHIVED'
                      ? 'bg-amber-400/20 text-amber-300'
                      : 'bg-white/10 text-blue-100'
                }`}>
                  {quarterStatusLabel}
                </span>
              </label>
            ) : (
              <div className="flex min-h-[40px] shrink-0 items-center rounded-xl border border-white/15 bg-blue-950/70 px-3 text-xs font-black text-amber-300">
                Q{activeQuarterNumber}
              </div>
            )}

            <div className="flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-blue-950/70 px-3 text-xs font-bold text-blue-100">
              <Calendar className="h-3.5 w-3.5 text-amber-300" />
              <span className="text-white">Week {currentWeek}</span>
              <span className="text-blue-300">/ {totalWeeksInQuarter}</span>
            </div>

            <div className="hidden min-h-[40px] shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-blue-950/70 px-3 text-xs text-blue-100 md:flex">
              <Users className="h-3.5 w-3.5 text-blue-300" />
              <span><strong className="text-white">{totalStudents}</strong> students</span>
              <span className="text-blue-500">·</span>
              <span><strong className="text-emerald-300">{totalVisitors}</strong> visitors</span>
            </div>

            <button
              id="header-sync-status-pill"
              type="button"
              onClick={onSyncClick}
              className={`flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition ${
                !syncState.isOnline
                  ? 'border-amber-500/70 bg-amber-950/80 text-amber-300'
                  : syncState.isSyncing
                    ? 'border-blue-400 bg-blue-900 text-white'
                    : syncState.syncQueueCount > 0
                      ? 'border-amber-400/60 bg-amber-900/60 text-amber-200'
                      : 'border-emerald-500/50 bg-emerald-950/70 text-emerald-300'
              }`}
              title={syncState.syncStatusText}
              aria-label={syncState.syncStatusText || 'Synchronization status'}
            >
              {!syncState.isOnline ? (
                <><WifiOff className="h-3.5 w-3.5" /><span>Offline</span></>
              ) : syncState.isSyncing ? (
                <><RefreshCw className="h-3.5 w-3.5 animate-spin" /><span>Syncing</span></>
              ) : syncState.syncQueueCount > 0 ? (
                <><RefreshCw className="h-3.5 w-3.5" /><span>{syncState.syncQueueCount} pending</span></>
              ) : (
                <><Wifi className="h-3.5 w-3.5" /><span>Synced</span></>
              )}
            </button>

            {onOpenWelcome && (
              <button
                id="header-btn-back-welcome"
                type="button"
                onClick={onOpenWelcome}
                className="hidden min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-amber-300 transition hover:bg-white/20 lg:flex"
              >
                <Home className="h-3.5 w-3.5" />
                <span>Home</span>
              </button>
            )}

            <button
              id="header-btn-lock"
              type="button"
              onClick={onLockClick}
              className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10 text-blue-100 transition hover:bg-white/20 lg:grid"
              aria-label="Lock secretary console"
            >
              <Lock className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
