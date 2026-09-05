import React, { useState } from 'react';
import {
  Calendar,
  Lock,
  Archive,
  CheckCircle2,
  AlertTriangle,
  FolderArchive,
  ShieldAlert,
  ChevronRight,
  Info,
  Clock
} from 'lucide-react';
import { QuarterNumber, QuarterStatus, SundaySchoolYear } from '../types';

interface QuarterSelectorBarProps {
  selectedQuarter: QuarterNumber;
  activeQuarterNumber: QuarterNumber;
  sundaySchoolYear: SundaySchoolYear | null;
  onSelectQuarter: (quarter: QuarterNumber) => void;
  onArchiveQuarter: (quarter: QuarterNumber) => Promise<void>;
}

export const QuarterSelectorBar: React.FC<QuarterSelectorBarProps> = ({
  selectedQuarter,
  activeQuarterNumber,
  sundaySchoolYear,
  onSelectQuarter,
  onArchiveQuarter
}) => {
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

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

  const handleConfirmArchive = async () => {
    setIsArchiving(true);
    try {
      await onArchiveQuarter(selectedQuarter);
      setShowArchiveConfirm(false);
    } catch (err) {
      console.error('Error archiving quarter:', err);
    } finally {
      setIsArchiving(false);
    }
  };

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

            {/* Archive Button for Active Quarter */}
            {isSelectedActive && (
              <button
                type="button"
                id="btn-archive-active-quarter"
                onClick={() => setShowArchiveConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-colors border border-amber-400/30 whitespace-nowrap"
                title={`Archive Quarter ${selectedQuarter} to lock historical records`}
              >
                <FolderArchive className="w-3.5 h-3.5" />
                <span>Archive Quarter {selectedQuarter}</span>
              </button>
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

      {/* Quarter Archiving Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <FolderArchive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Archive Quarter {selectedQuarter}?</h3>
                <p className="text-xs text-slate-500">Lock historical records for Quarter {selectedQuarter}</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-5">
              <p className="font-semibold text-slate-800">What happens upon archiving:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Quarter {selectedQuarter} records will become <strong>permanently Read-Only</strong>.</li>
                <li>Grades, punctuality, memory verse scores, and offerings cannot be modified.</li>
                <li>If Quarter {Math.min(4, selectedQuarter + 1)} has been approved by the General Secretary, the Class Register will transition to Quarter {Math.min(4, selectedQuarter + 1)}.</li>
                <li>If Quarter {Math.min(4, selectedQuarter + 1)} is not yet approved, it will remain Locked until the General Secretary releases it in the Admin Portal.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowArchiveConfirm(false)}
                disabled={isArchiving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-archive-quarter"
                onClick={handleConfirmArchive}
                disabled={isArchiving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow transition-colors"
              >
                {isArchiving ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Archiving...</span>
                  </>
                ) : (
                  <>
                    <FolderArchive className="w-3.5 h-3.5" />
                    <span>Confirm Archive</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
