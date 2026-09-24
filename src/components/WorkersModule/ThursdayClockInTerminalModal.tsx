import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  WorkerProfile, 
  WorkerPrepAttendanceRecord, 
  ClockInConfig 
} from '../../types';
import { 
  X, Search, Camera, QrCode, CheckCircle2, AlertTriangle, 
  Clock, Sparkles, Users, Check, Phone, ArrowRight, ShieldCheck,
  UserCheck, AlertCircle, Edit3, Lock, Settings
} from 'lucide-react';
import confetti from 'canvas-confetti';
import jsQR from 'jsqr';
import { calculateWorkerProfileCompleteness } from '../../utils/workerProfileUtils';
import { ClockInScheduleSettingsModal } from './ClockInScheduleSettingsModal';
import { evaluateAttendanceAccess } from '../../utils/attendanceAccessSecurity';

interface ThursdayClockInTerminalModalProps {
  isOpen: boolean;
  targetDate: string;
  weekNumber: number;
  topic?: string;
  workers: WorkerProfile[];
  prepRecords: WorkerPrepAttendanceRecord[];
  config: ClockInConfig;
  onClose: () => void;
  onClockInPrep: (record: WorkerPrepAttendanceRecord) => Promise<void>;
  onUpdateConfig?: (config: ClockInConfig) => Promise<void>;
  onUpdateWorkerProfile?: (worker: WorkerProfile) => Promise<void>;
}

export const ThursdayClockInTerminalModal: React.FC<ThursdayClockInTerminalModalProps> = ({
  isOpen,
  targetDate,
  weekNumber,
  topic,
  workers,
  prepRecords,
  config,
  onClose,
  onClockInPrep,
  onUpdateConfig,
  onUpdateWorkerProfile
}) => {
  const [activeTab, setActiveTab] = useState<'NAME_SEARCH' | 'QR_SCAN' | 'DEPARTMENT'>('NAME_SEARCH');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [adminTestOverride, setAdminTestOverride] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  
  // Camera scanning state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Feedback states
  const [celebrationWorker, setCelebrationWorker] = useState<{
    worker: WorkerProfile;
    record: WorkerPrepAttendanceRecord;
  } | null>(null);

  const [duplicateWarning, setDuplicateWarning] = useState<{
    worker: WorkerProfile;
    existing: WorkerPrepAttendanceRecord;
  } | null>(null);

  // Profile Update Prompt State
  const [profilePromptWorker, setProfilePromptWorker] = useState<WorkerProfile | null>(null);
  const [updatePhoneInput, setUpdatePhoneInput] = useState('');
  const [updateAddressInput, setUpdateAddressInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Video and Canvas refs for QR Scanning
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastScannedTokenRef = useRef<{ token: string; time: number } | null>(null);

  const activeWorkers = useMemo(() => {
    return workers.filter(w => w.status === 'ACTIVE');
  }, [workers]);

  const derivedDepartments = useMemo(() => {
    return Array.from(new Set(activeWorkers.map(w => w.department).filter(Boolean)));
  }, [activeWorkers]);

  // Clock ticker
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Today's attendance map for this prep session
  const activePrepAttendance = useMemo(() => {
    return prepRecords.filter(r => r.prepDate === targetDate);
  }, [prepRecords, targetDate]);

  const remainingWorkers = useMemo(() => {
    const recordedIds = new Set(activePrepAttendance.map(record => record.workerId));
    return activeWorkers.filter(worker => !recordedIds.has(worker.id));
  }, [activeWorkers, activePrepAttendance]);

  // Audio feedback chime
  const playChime = useCallback((isLate: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);

      if (isLate) {
        osc.frequency.setValueAtTime(392, ctx.currentTime);
        osc.frequency.setValueAtTime(329.63, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (error) {
      // Audio context may be restricted by browser until interaction.
      console.debug('Thursday clock-in sound feedback was unavailable:', error);
    }
  }, []);

  // Evaluate Thursday Clock-In Window & Date-aware security via unified Attendance Access Controller
  const attendanceAccess = useMemo(() => {
    return evaluateAttendanceAccess({
      sessionType: 'THURSDAY',
      weekNumber,
      scheduledDate: targetDate,
      openTime: config.thursdayOpenTime,
      closeTime: config.thursdayCloseTime,
      config,
      now: new Date(),
      adminTestOverride
    });
  }, [adminTestOverride, config, targetDate, weekNumber]);

  const clockInStatus = useMemo(() => ({
    allowed: attendanceAccess.canClockIn,
    isOpen: attendanceAccess.canClockIn,
    isDateMatch: attendanceAccess.isDateMatch,
    isToday: attendanceAccess.isToday,
    isPast: attendanceAccess.isPast,
    isFuture: attendanceAccess.isFuture,
    status: attendanceAccess.status,
    reason: attendanceAccess.lockReason || (attendanceAccess.canClockIn ? 'Thursday Preparatory Session Active' : 'Clock-in is closed.')
  }), [attendanceAccess]);

  // Process Clock-In
  const handleClockIn = useCallback(async (
    worker: WorkerProfile,
    method: 'NAME_SEARCH' | 'QR_SCAN' | 'DEPT_LIST'
  ) => {
    if (!clockInStatus.allowed) {
      alert(`Clock-in disabled: ${clockInStatus.reason}`);
      return;
    }

    // Check duplicate
    const existing = activePrepAttendance.find(a => a.workerId === worker.id);
    if (existing) {
      setDuplicateWarning({ worker, existing });
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Late cutoff evaluation:
    // Default Thursday late cutoff is 18:15 (6:15 PM)
    const lateCutoff = config.thursdayLateCutoffTime || '18:15';
    const [cHour, cMin] = lateCutoff.split(':').map(Number);
    const cutoffDate = new Date(now);
    cutoffDate.setHours(cHour, cMin, 0, 0);

    const isLate = now > cutoffDate;

    const newRecord: WorkerPrepAttendanceRecord = {
      id: `${worker.id}_prep_${targetDate}`,
      workerId: worker.id,
      workerName: worker.fullName,
      department: worker.department,
      prepDate: targetDate,
      sessionTitle: `Thursday Preparatory Class - Week ${weekNumber}`,
      weekNumber: weekNumber,
      status: isLate ? 'LATE' : 'PRESENT',
      syllabusPrepared: true,
      clockInTime: timeStr,
      markedBy: `Terminal (${method})`,
      updatedAt: now.toISOString()
    };

    await onClockInPrep(newRecord);
    playChime(isLate);

    // Confetti
    try {
      confetti({
        particleCount: isLate ? 30 : 60,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch (error) {
      console.debug('Thursday clock-in celebration effect was unavailable:', error);
    }

    setCelebrationWorker({ worker, record: newRecord });
    setTimeout(() => {
      setCelebrationWorker(prev => (prev?.record.id === newRecord.id ? null : prev));
    }, 4000);

    // Check profile completeness: if under 70% or missing phone, prompt for quick update
    const completeness = calculateWorkerProfileCompleteness(worker);
    if (completeness.percentage < 70 || !worker.phone || worker.phone.trim().length < 7) {
      setProfilePromptWorker(worker);
      setUpdatePhoneInput(worker.phone || '');
      setUpdateAddressInput(worker.address && worker.address !== 'Assembly District' ? worker.address : '');
    }
  }, [activePrepAttendance, targetDate, weekNumber, config, onClockInPrep, playChime]);

  // Handle QR detection
  const handleQrDetected = useCallback((token: string) => {
    if (!token) return;
    const now = Date.now();
    if (lastScannedTokenRef.current && lastScannedTokenRef.current.token === token && now - lastScannedTokenRef.current.time < 3000) {
      return;
    }
    lastScannedTokenRef.current = { token, time: now };

    const trimmed = token.trim();
    const lower = trimmed.toLowerCase();
    const matched = activeWorkers.find(
      w => w.qrCodeToken === trimmed || w.id === trimmed || w.phone === trimmed || (w.fullName || '').toLowerCase() === lower
    );

    if (matched) {
      handleClockIn(matched, 'QR_SCAN');
    }
  }, [activeWorkers, handleClockIn]);

  // Camera video loop
  useEffect(() => {
    if (activeTab !== 'QR_SCAN' || !isCameraActive) {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      return;
    }

    let isSubscribed = true;

    async function startCamera() {
      try {
        setCameraError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        if (!isSubscribed) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (err: any) {
        console.error('Camera error:', err);
        setCameraError('Camera access denied or unavailable. You can also use Name Search or Department tab.');
      }
    }

    startCamera();

    const scanLoop = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });
          if (code && code.data) {
            handleQrDetected(code.data);
          }
        }
      }
      if (isSubscribed) {
        animationFrameId.current = requestAnimationFrame(scanLoop);
      }
    };

    const timer = setTimeout(() => {
      scanLoop();
    }, 500);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [activeTab, isCameraActive, handleQrDetected]);

  // Save quick profile update
  const handleSaveProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profilePromptWorker || !onUpdateWorkerProfile) {
      setProfilePromptWorker(null);
      return;
    }

    setIsSavingProfile(true);
    try {
      const updated: WorkerProfile = {
        ...profilePromptWorker,
        phone: updatePhoneInput.trim(),
        whatsappNumber: updatePhoneInput.trim(),
        address: updateAddressInput.trim() || profilePromptWorker.address || 'Assembly District',
        updatedAt: new Date().toISOString()
      };
      await onUpdateWorkerProfile(updated);
      setProfilePromptWorker(null);
    } catch (err) {
      console.error('Error updating worker profile:', err);
      alert('Failed to update worker profile: ' + err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Filter workers for search
  const displayedWorkers = useMemo(() => {
    return remainingWorkers.filter(w => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || w.fullName.toLowerCase().includes(q) || (w.phone || '').includes(q) || w.department.toLowerCase().includes(q);
      const matchDept = selectedDept === 'ALL' || w.department === selectedDept;
      return matchQuery && matchDept;
    });
  }, [remainingWorkers, searchQuery, selectedDept]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-0 backdrop-blur-xs animate-fade-in sm:p-4">
      <div role="dialog" aria-modal="true" aria-label="Thursday clock-in terminal" className="flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl sm:border sm:border-slate-200">
        
        {/* Top Header */}
        <div className="flex flex-col justify-between gap-3 border-b border-slate-800 bg-slate-900 p-4 text-white sm:flex-row sm:items-center sm:px-6 sm:py-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-wider">
                Thursday Preparatory Class Terminal
              </span>
              <span className="text-xs text-amber-300 font-mono font-bold">
                {targetDate} (Week {weekNumber})
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black font-['Cinzel',serif] tracking-wide text-white">
              {topic || `Thursday Prep - Week ${weekNumber}`}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>Clock-In Window: <strong>{config.thursdayOpenTime || '16:00'} - {config.thursdayCloseTime || '19:00'}</strong></span>
              <span>•</span>
              <span>Meeting: <strong>{config.thursdayMeetingStartTime || '18:00'}</strong></span>
              <span>•</span>
              <span className="text-amber-400 font-bold">Late After: {config.thursdayLateCutoffTime || '18:15'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Clock Ticker & Stats */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-2.5 px-4 text-center shrink-0">
              <div className="text-xs font-mono font-black text-amber-400">{currentTimeStr}</div>
              <div className="text-[10px] font-bold text-emerald-400 mt-0.5">
                Clocked In: <strong>{activePrepAttendance.length} / {activeWorkers.length}</strong>
              </div>
            </div>

            {onUpdateConfig && (
              <button
                onClick={() => setShowSettingsModal(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Adjust Thursday Clock-In Window"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Adjust Schedule</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Window Inactive Banner (Complaint 9) */}
        {!clockInStatus.allowed && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 p-3 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
            <div className="flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs">
                <span className="font-black uppercase tracking-wider text-amber-800">Terminal Inactive: </span>
                <span className="font-medium text-slate-800">{clockInStatus.reason}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setAdminTestOverride(true)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
              >
                ⚡ Enable Rehearsal Mode
              </button>
              {onUpdateConfig && (
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Adjust Hours
                </button>
              )}
            </div>
          </div>
        )}

        {adminTestOverride && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 p-2.5 px-6 flex items-center justify-between text-emerald-950 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span className="font-black">Rehearsal / Test Mode is Active:</span>
              <span>Clocking allowed outside scheduled Thursday window for simulation.</span>
            </div>
            <button
              onClick={() => setAdminTestOverride(false)}
              className="text-[11px] font-bold text-emerald-800 underline hover:text-emerald-950 cursor-pointer"
            >
              Restore Window Enforcement
            </button>
          </div>
        )}

        {/* Method Switcher Tabs */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 p-2 sm:px-6 sm:py-3">
          <div className="flex max-w-full overflow-x-auto rounded-2xl border border-slate-300 bg-white p-1 shadow-inner">
            <button
              onClick={() => { setActiveTab('NAME_SEARCH'); setIsCameraActive(false); }}
              className={`min-h-11 shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'NAME_SEARCH' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>1. Find & List Names</span>
            </button>

            <button
              onClick={() => { setActiveTab('QR_SCAN'); setIsCameraActive(true); }}
              className={`min-h-11 shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'QR_SCAN' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>2. QR Scanner</span>
            </button>

            <button
              onClick={() => { setActiveTab('DEPARTMENT'); setIsCameraActive(false); }}
              className={`min-h-11 shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'DEPARTMENT' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>3. Department</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold">
              Present: {activePrepAttendance.filter(a => a.status === 'PRESENT').length}
            </span>
            <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-lg font-bold">
              Late: {activePrepAttendance.filter(a => a.status === 'LATE').length}
            </span>
          </div>
        </div>

        {/* Tab 1: Find & List Names */}
        {activeTab === 'NAME_SEARCH' && (
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Type full name, phone number, or department..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                autoFocus
              />
            </div>

            {/* Department Quick Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setSelectedDept('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedDept === 'ALL' ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({remainingWorkers.length})
              </button>
              {derivedDepartments.map(dept => {
                const count = remainingWorkers.filter(w => w.department === dept).length;
                return (
                  <button
                    key={dept}
                    onClick={() => setSelectedDept(dept)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedDept === dept ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {dept} ({count})
                  </button>
                );
              })}
            </div>

            {/* Workers List */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Showing {displayedWorkers.length} Active Workers</span>
                <span>Full Roster (A-Z)</span>
              </div>

              {displayedWorkers.length === 0 && <div className="rounded-2xl bg-emerald-50 p-6 text-center text-sm font-black text-emerald-800">Everyone in this view has clocked in.</div>}
              {displayedWorkers.map(w => {
                const completeness = calculateWorkerProfileCompleteness(w);

                return (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-blue-50/50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate text-base font-black text-slate-900">{w.fullName}</h4>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                          completeness.percentage >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {completeness.percentage}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="font-bold text-blue-900">{w.department}</span>
                        <span>•</span>
                        <span>{w.duty || w.categories[0] || 'Worker'}</span>
                        {w.phone && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{w.phone}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {!clockInStatus.allowed ? (
                      <button
                        onClick={() => alert(`Thursday Clock-In is locked outside the configured window.\n\n${clockInStatus.reason}\n\nYou can click "Enable Rehearsal Mode" or "Adjust Schedule" to continue.`)}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 border border-slate-300"
                        title={clockInStatus.reason}
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Locked</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleClockIn(w, 'NAME_SEARCH')}
                        className="min-h-12 shrink-0 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Clock In</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: QR Scanner */}
        {activeTab === 'QR_SCAN' && (
          <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif] uppercase">
                Hold QR ID Pass Before Camera
              </h3>
              <p className="text-xs text-slate-500 max-w-md">
                Align the worker's badge or mobile QR pass inside the frame. Attendance is verified instantaneously.
              </p>
            </div>

            {!clockInStatus.allowed ? (
              <div className="p-8 bg-amber-50 border-2 border-amber-200 rounded-3xl max-w-md mx-auto text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-slate-900 font-['Cinzel',serif] text-base">QR Terminal is Locked</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {clockInStatus.reason}
                  </p>
                </div>
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={() => setAdminTestOverride(true)}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition cursor-pointer shadow-xs"
                  >
                    ⚡ Enable Rehearsal Mode to Scan Now
                  </button>
                  {onUpdateConfig && (
                    <button
                      onClick={() => setShowSettingsModal(true)}
                      className="w-full py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Adjust Thursday Window
                    </button>
                  )}
                </div>
              </div>
            ) : cameraError ? (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs max-w-md space-y-2">
                <AlertTriangle className="w-6 h-6 text-rose-600 mx-auto" />
                <p>{cameraError}</p>
                <button
                  onClick={() => setIsCameraActive(true)}
                  className="px-3 py-1.5 bg-rose-700 text-white rounded-xl font-bold text-xs"
                >
                  Retry Camera
                </button>
              </div>
            ) : (
              <div className="relative w-72 h-72 rounded-3xl overflow-hidden border-4 border-slate-900 bg-black shadow-2xl">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Target overlay */}
                <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-amber-400/80 m-6 rounded-2xl animate-pulse" />
                <div className="absolute bottom-3 left-0 right-0 text-center">
                  <span className="px-3 py-1 bg-slate-900/80 backdrop-blur-xs text-amber-300 text-[10px] font-mono font-bold rounded-full border border-amber-400/30">
                    SCANNING ACTIVE
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Department List */}
        {activeTab === 'DEPARTMENT' && (
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Quick Tap by Department Roster
            </div>

            <div className="flex flex-wrap gap-2">
              {derivedDepartments.map(dept => {
                const inDept = activeWorkers.filter(w => w.department === dept);
                const waitingInDept = remainingWorkers.filter(w => w.department === dept);
                return (
                  <button
                    key={dept}
                    onClick={() => setSelectedDept(dept)}
                    className={`p-3 px-4 rounded-2xl border text-left transition cursor-pointer ${
                      selectedDept === dept
                        ? 'bg-blue-900 text-white border-blue-900 shadow-md'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-black text-xs">{dept}</div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      {waitingInDept.length} waiting · {inDept.length - waitingInDept.length} done
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              {displayedWorkers.length === 0 && <div className="sm:col-span-2 rounded-2xl bg-emerald-50 p-6 text-center text-sm font-black text-emerald-800">Everyone in this department has clocked in.</div>}
              {displayedWorkers.map(w => {
                return (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="min-w-0">
                      <h5 className="truncate text-base font-black text-slate-900">{w.fullName}</h5>
                      <span className="text-[10px] text-slate-500">{w.duty || 'Worker'}</span>
                    </div>

                    {!clockInStatus.allowed ? (
                      <button
                        onClick={() => alert(`Thursday Clock-In is locked outside the configured window.\n\n${clockInStatus.reason}`)}
                        className="px-2.5 py-1 bg-slate-200 text-slate-500 text-[10px] font-bold rounded-lg shrink-0 border border-slate-300"
                        title={clockInStatus.reason}
                      >
                        Locked
                      </button>
                    ) : (
                      <button
                        onClick={() => handleClockIn(w, 'DEPT_LIST')}
                        className="min-h-12 shrink-0 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-600 cursor-pointer"
                      >
                        Clock In
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Celebration Toast Modal */}
        {celebrationWorker && (
          <div className="fixed bottom-6 right-6 z-50 p-4 bg-slate-900 text-white rounded-3xl shadow-2xl border-2 border-amber-400 flex items-center gap-3 animate-bounce max-w-sm">
            <div className="p-2.5 bg-emerald-500 text-white rounded-2xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-amber-300 font-bold uppercase tracking-wider">Clocked In Successfully</div>
              <div className="font-black text-sm">{celebrationWorker.worker.fullName}</div>
              <div className="text-[10px] text-slate-300">
                Status: <strong>{celebrationWorker.record.status}</strong> • Time: {celebrationWorker.record.clockInTime}
              </div>
            </div>
          </div>
        )}

        {/* Duplicate Warning Modal */}
        {duplicateWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">Already Clocked In!</h3>
                <p className="text-xs text-slate-600 mt-1">
                  <strong>{duplicateWarning.worker.fullName}</strong> was already clocked in at {duplicateWarning.existing.clockInTime}.
                </p>
              </div>
              <button
                onClick={() => setDuplicateWarning(null)}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Prompt: Incomplete Profile Completion */}
        {profilePromptWorker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 font-['Cinzel',serif]">
                    Update Worker Contact Info
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Profile incomplete for <strong>{profilePromptWorker.fullName}</strong>.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveProfileUpdate} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Phone Number (Required for SMS & WhatsApp)</label>
                  <input
                    type="tel"
                    value={updatePhoneInput}
                    onChange={e => setUpdatePhoneInput(e.target.value)}
                    placeholder="e.g. 08012345678"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Residential Address</label>
                  <input
                    type="text"
                    value={updateAddressInput}
                    onChange={e => setUpdateAddressInput(e.target.value)}
                    placeholder="e.g. 14 Grace Street, Ikeja"
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setProfilePromptWorker(null)}
                    className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                  >
                    Skip for Now
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="w-1/2 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl font-bold transition"
                  >
                    {isSavingProfile ? 'Saving...' : 'Save Details'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Schedule Settings Modal */}
        {showSettingsModal && onUpdateConfig && (
          <ClockInScheduleSettingsModal
            isOpen={showSettingsModal}
            activeTab="THURSDAY"
            currentConfig={config}
            onClose={() => setShowSettingsModal(false)}
            onSave={async (newConfig) => {
              await onUpdateConfig(newConfig);
              setShowSettingsModal(false);
            }}
          />
        )}

      </div>
    </div>,
    document.body
  );
};
