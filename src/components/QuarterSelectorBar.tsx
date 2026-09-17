import React from 'react';
import {
  Calendar,
  Lock,
  Archive,
  CheckCircle2
} from 'lucide-react';
import { QuarterNumber, QuarterStatus, SundaySchoolYear } from '../types';

interface QuarterSelectorBarProps {
  selectedQuarter: QuarterNumber;
  activeQuarterNumber: QuarterNumber;
  sundaySchoolYear: SundaySchoolYear | null;
  onSelectQuarter: (quarter: QuarterNumber) => void;
}

export const QuarterSelectorBar: React.FC<QuarterSelectorBarProps> = ({
  selectedQuarter,
  activeQuarterNumber,
  sundaySchoolYear,
  onSelectQuarter
}) => {
  const quartersList: QuarterNumber[] = [1, 2, 3, 4];

  // Helper to determine status of each quarter
  const getQuarterStatus = (qNum: QuarterNumber): QuarterStatus => {
    if (!sundaySchoolYear) {
      return qNum === 1 ? 'ACTIVE' : 'UPCOMING';
    }
    const qData = sundaySchoolYear.quarters.find(q => q.quarterNumber === qNum);
    return qData?.status || (qNum === sundaySchoolYear.activeQuarterNumber ? 'ACTIVE' : 'UPCOMING');
  };

  const selectedQuarterStatus = getQuarterStatus(selectedQuarter);
  const isSelectedActive = selectedQuarterStatus === 'ACTIVE';
  const isSelectedArchived = selectedQuarterStatus === 'ARCHIVED';
  const isSelectedLocked = selectedQuarterStatus === 'UPCOMING';

  const currentQuarterData = sundaySchoolYear?.quarters.find(q => q.quarterNumber === selectedQuarter);

  return (
    <div className="mb-6 space-y-3" id="quarter-selector-bar">
      {/* 4-Quarter Segmented Navigation Bar */}
      <div className="bg-slate-900 text-white rounded-xl shadow-md border border-slate-800 p-2 sm:p-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Quarter Switcher Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 md:pb-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              Quarter:
            </span>

            {quartersList.map(qNum => {
              const status = getQuarterStatus(qNum);
              const isSelected = selectedQuarter === qNum;

              let badgeBg = 'bg-slate-800 text-slate-400';
              let badgeText = 'LOCKED';
              let Icon = Lock;

              if (status === 'ACTIVE') {
                badgeBg = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
                badgeText = 'ACTIVE';
                Icon = CheckCircle2;
              } else if (status === 'ARCHIVED') {
                badgeBg = 'bg-amber-500/20 text-amber-300 border border-amber-500/40';
                badgeText = 'ARCHIVED';
                Icon = Archive;
              }

              return (
                <button
                  key={qNum}
                  id={`quarter-tab-${qNum}`}
                  type="button"
                  onClick={() => onSelectQuarter(qNum)}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/50'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="font-bold">Quarter {qNum}</span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${badgeBg}`}>
                    <Icon className="w-2.5 h-2.5" />
                    <span>{badgeText}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Quarter Actions / Status Indicator */}
          <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
            <div className="text-right hidden lg:block">
              <p className="text-[11px] font-medium text-slate-300">
                {currentQuarterData?.quarterTheme || `Quarter ${selectedQuarter} Session`}
              </p>
              <p className="text-[10px] text-slate-400">
                {selectedQuarterStatus === 'ACTIVE' && 'Status: Currently Open for Attendance & Grading'}
                {selectedQuarterStatus === 'ARCHIVED' && 'Status: Read-Only Historical Archive'}
                {selectedQuarterStatus === 'UPCOMING' && 'Status: Locked (Awaiting Gen. Secretary Release)'}
              </p>
            </div>

            {/* Quarter lifecycle is globally owned by the General Secretary. */}
            {isSelectedActive && (
              <span className="text-[10px] font-semibold text-emerald-300">
                Quarter lifecycle is controlled by the General Secretary.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contextual Status Alerts */}
      {isSelectedArchived && (
        <div
          id="quarter-archived-banner"
          className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 shadow-sm"
        >
          <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0">
            <Archive className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-bold text-amber-950 flex items-center gap-1.5">
              <span>QUARTER {selectedQuarter} ARCHIVED — READ-ONLY MODE</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-extrabold uppercase">
                Historical Record
              </span>
            </p>
            <p className="text-amber-800 mt-0.5">
              All attendance records, 4-tier grading matrix scores, offering totals, and roster data for this quarter are locked to protect historical data integrity. Records remain fully searchable and viewable.
            </p>
          </div>
        </div>
      )}

      {isSelectedLocked && (
        <div
          id="quarter-locked-banner"
          className="flex items-center gap-3 p-3 bg-slate-100 border border-slate-300 rounded-xl text-slate-800 shadow-sm"
        >
          <div className="p-2 bg-slate-200 rounded-lg text-slate-700 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <span>QUARTER {selectedQuarter} IS CURRENTLY LOCKED</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-extrabold uppercase">
                Pending Approval
              </span>
            </p>
            <p className="text-slate-600 mt-0.5">
              This quarter has not been activated or released by the General Secretary in the Admin Portal. Data entry will be enabled once the General Secretary loads lessons and distributes the quarter.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
