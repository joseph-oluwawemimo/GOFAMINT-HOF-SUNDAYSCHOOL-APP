import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  WorkerProfile, 
  WorkerAttendanceRecord, 
  ClockInConfig, 
  SundayAttendanceStatus,
  SundaySchoolYear,
  QuarterNumber
} from '../../types';
import { 
  QrCode, Search, Camera, CheckCircle, AlertTriangle, 
  Clock, Sparkles, Settings, Volume2, VolumeX, Users, 
  RefreshCw, Check, ArrowRight, ShieldCheck, UserCheck, Flame,
  Edit3, Calendar, Download, Printer, CheckCircle2, Lock, BookOpen
} from 'lucide-react';
import confetti from 'canvas-confetti';
import jsQR from 'jsqr';
import { GofamintLogo } from '../GofamintLogo';
import { calculateWorkerProfileCompleteness } from '../../utils/workerProfileUtils';
import { getQuarterWeeklySchedule } from '../../utils/quarterScheduleUtils';
import { INITIAL_SUNDAY_SCHOOL_YEAR } from '../../data/mockQuarterLessons';
import { ClockInScheduleSettingsModal } from './ClockInScheduleSettingsModal';

interface SundayClockInKioskProps {
  workers: WorkerProfile[];
  todayAttendance: WorkerAttendanceRecord[];
  allSundayAttendance?: WorkerAttendanceRecord[];
  config: ClockInConfig;
  sundaySchoolYear?: SundaySchoolYear;
  departmentsList?: string[];
  onClockIn: (record: WorkerAttendanceRecord) => Promise<void>;
  onUpdateConfig: (config: ClockInConfig) => Promise<void>;
  onSaveSundayRecord?: (record: WorkerAttendanceRecord) => Promise<void>;
  onSaveBulkSundayRecords?: (records: WorkerAttendanceRecord[]) => Promise<void>;
  onUpdateWorkerProfile?: (worker: WorkerProfile) => Promise<void>;
  onNavigateToTab?: (tab: any) => void;
}

export const SundayClockInKiosk: React.FC<SundayClockInKioskProps> = ({
  workers,
  todayAttendance,
  allSundayAttendance,
  config,
  sundaySchoolYear,
  departmentsList = [],
  onClockIn,
  onUpdateConfig,
  onSaveSundayRecord,
  onSaveBulkSundayRecords,
  onUpdateWorkerProfile,
  onNavigateToTab
}) => {
  // Complaint 2: View Mode Switcher (Sunday Terminal vs Sunday Attendance Register)
  const [viewMode, setViewMode] = useState<'TERMINAL' | 'REGISTER'>('TERMINAL');

  // Terminal Method: Name Search, QR Scan, Dept List
  const [activeMethod, setActiveMethod] = useState<'NAME_SEARCH' | 'QR_SCAN' | 'DEPT_LIST'>('NAME_SEARCH');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  
  // Register Search & Filters
  const [registerSearchQuery, setRegisterSearchQuery] = useState('');
  const [registerDept, setRegisterDept] = useState('ALL');

  // Camera Scanning State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Feedback / Modal states
  const [celebrationWorker, setCelebrationWorker] = useState<{
    worker: WorkerProfile;
    record: WorkerAttendanceRecord;
  } | null>(null);
  
  const [duplicateWarning, setDuplicateWarning] = useState<{
    worker: WorkerProfile;
    existingRecord: WorkerAttendanceRecord;
  } | null>(null);

  // Settings Modal State (Complaint 3: Adjust Schedule)
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // Profile update prompt modal state
  const [profilePromptWorker, setProfilePromptWorker] = useState<WorkerProfile | null>(null);
  const [updatePhoneInput, setUpdatePhoneInput] = useState('');
  const [updateAddressInput, setUpdateAddressInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Complaint 4: Sunday's own 12-Week schedule sync
  const resolvedYear = sundaySchoolYear || INITIAL_SUNDAY_SCHOOL_YEAR;
  const [selectedQuarterNumber, setSelectedQuarterNumber] = useState<QuarterNumber>(
    resolvedYear.activeQuarterNumber || 1
  );
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  // Sync selected quarter when sundaySchoolYear updates
  useEffect(() => {
    if (sundaySchoolYear?.activeQuarterNumber) {
      setSelectedQuarterNumber(sundaySchoolYear.activeQuarterNumber);
    }
  }, [sundaySchoolYear?.activeQuarterNumber]);

  const activeQuarter = useMemo(() => {
    return resolvedYear.quarters.find(q => q.quarterNumber === selectedQuarterNumber) || resolvedYear.quarters[0];
  }, [resolvedYear, selectedQuarterNumber]);

  const quarterSchedule = useMemo(() => {
    if (!activeQuarter) return [];
    return getQuarterWeeklySchedule(activeQuarter);
  }, [activeQuarter]);

  const activeWeekInfo = useMemo(() => {
    if (quarterSchedule.length === 0) return null;
    return quarterSchedule.find(s => s.weekNumber === selectedWeek) || quarterSchedule[0];
  }, [quarterSchedule, selectedWeek]);

  const todayIso = new Date().toISOString().split('T')[0];
  const targetSundayDate = activeWeekInfo?.sundayDate || config.serviceDate || todayIso;
  const isTargetDatePast = targetSundayDate < todayIso;
  const isTargetDateToday = targetSundayDate === todayIso;

  // Attendance pool for Sunday
  const attendancePool = allSundayAttendance || todayAttendance;

  const sundayAttendanceMap = useMemo(() => {
    const map = new Map<string, WorkerAttendanceRecord>();
    attendancePool
      .filter(r => r.serviceDate === targetSundayDate)
      .forEach(r => map.set(r.workerId, r));
    return map;
  }, [attendancePool, targetSundayDate]);

  // Real-time schedule evaluation (Sunday from open time to close time)
  const nowForSchedule = new Date();
  const isActualSunday = nowForSchedule.getDay() === 0;
  const nowMinutes = nowForSchedule.getHours() * 60 + nowForSchedule.getMinutes();

  const [sOpenH, sOpenM] = (config.sundayOpenTime || '07:00').split(':').map(Number);
  const [sCloseH, sCloseM] = (config.sundayCloseTime || '11:30').split(':').map(Number);
  const sundayOpenMinutes = sOpenH * 60 + sOpenM;
  const sundayCloseMinutes = sCloseH * 60 + sCloseM;

  const isClockInScheduleAllowed = isActualSunday && nowMinutes >= sundayOpenMinutes && nowMinutes <= sundayCloseMinutes;

  // Video and Canvas refs for QR Scanning
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastScannedTokenRef = useRef<{ token: string; time: number } | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Clock Ticker
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDateStr(now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Play gentle success audio chime using Web Audio API
  const playAudioFeedback = useCallback((type: 'success' | 'late' | 'duplicate') => {
    if (!config.autoSoundFeedback) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'late') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(554.37, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.setValueAtTime(200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // ignore
    }
  }, [config.autoSoundFeedback]);

  // Compute if late based on current time & configuration
  const evaluatePunctuality = (clockInDate: Date): { status: SundayAttendanceStatus; isLate: boolean } => {
    const lateCutoffStr = config.sundayLateCutoffTime || '08:00';
    const [cHour, cMin] = lateCutoffStr.split(':').map(Number);
    const cutoffDate = new Date(clockInDate);
    cutoffDate.setHours(cHour, cMin, 0, 0);

    if (clockInDate > cutoffDate) {
      return { status: 'LATE', isLate: true };
    }
    return { status: 'PRESENT', isLate: false };
  };

  // Perform the actual Clock-In
  const processWorkerClockIn = useCallback(async (
    worker: WorkerProfile, 
    method: 'QR_SCAN' | 'NAME_SEARCH' | 'DEPT_QUICK_ACCESS' | 'MANUAL_OVERRIDE'
  ) => {
    const todayStr = config.serviceDate || new Date().toISOString().split('T')[0];
    
    // 0. Enforce Sunday schedule window
    const nowCheck = new Date();
    const isNowSunday = nowCheck.getDay() === 0;
    const nowMins = nowCheck.getHours() * 60 + nowCheck.getMinutes();

    const [sOpenH, sOpenM] = (config.sundayOpenTime || '07:00').split(':').map(Number);
    const [sCloseH, sCloseM] = (config.sundayCloseTime || '11:30').split(':').map(Number);
    const sundayOpenMinutes = sOpenH * 60 + sOpenM;
    const sundayCloseMinutes = sCloseH * 60 + sCloseM;

    const isNowAllowed = isNowSunday && nowMins >= sundayOpenMinutes && nowMins <= sundayCloseMinutes;

    if (!isNowAllowed) {
      alert(`Sunday Clock-in Terminal is restricted: Clock-in is only permitted on Sundays between ${config.sundayOpenTime || '07:00'} and ${config.sundayCloseTime || '11:30'}.`);
      return;
    }

    // 1. Check for Duplicate Clock-In
    const existing = todayAttendance.find(
      a => (a.workerId === worker.id || (a.workerName || '').toLowerCase() === (worker.fullName || '').toLowerCase()) && a.serviceDate === todayStr
    );

    if (existing) {
      playAudioFeedback('duplicate');
      setDuplicateWarning({ worker, existingRecord: existing });
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const { status, isLate } = evaluatePunctuality(now);

    const newRecord: WorkerAttendanceRecord = {
      id: `${worker.id}_${todayStr}`,
      workerId: worker.id,
      workerName: worker.fullName,
      department: worker.department,
      serviceDate: todayStr,
      serviceName: config.serviceName || 'Sunday Morning Service',
      clockInTime: timeStr,
      timestamp: now.getTime(),
      status,
      isLate,
      method,
      createdAt: now.toISOString()
    };

    await onClockIn(newRecord);

    if (isLate) {
      playAudioFeedback('late');
    } else {
      playAudioFeedback('success');
    }

    // Trigger celebration effects
    if (config.showCelebration) {
      confetti({
        particleCount: isLate ? 35 : 70,
        spread: 60,
        origin: { y: 0.6 }
      });
    }

    setCelebrationWorker({ worker, record: newRecord });
    setSearchQuery('');

    // Check profile completeness: prompt if < 70% or missing phone
    const completeness = calculateWorkerProfileCompleteness(worker);
    if (completeness.percentage < 70 || !worker.phone || worker.phone.trim().length < 7) {
      setProfilePromptWorker(worker);
      setUpdatePhoneInput(worker.phone || '');
      setUpdateAddressInput(worker.address && worker.address !== 'Assembly District' ? worker.address : '');
    }

    // Auto-dismiss celebration after 4.5 seconds for kiosk throughput
    setTimeout(() => {
      setCelebrationWorker(prev => {
        if (prev?.record.id === newRecord.id) {
          return null;
        }
        return prev;
      });
    }, 4500);

  }, [config, todayAttendance, onClockIn, playAudioFeedback]);

  const handleSaveProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profilePromptWorker || !onUpdateWorkerProfile) {
      setProfilePromptWorker(null);
      return;
    }

    try {
      setIsSavingProfile(true);
      const updated: WorkerProfile = {
        ...profilePromptWorker,
        phone: updatePhoneInput.trim() || profilePromptWorker.phone,
        address: updateAddressInput.trim() || profilePromptWorker.address,
        updatedAt: new Date().toISOString()
      };
      await onUpdateWorkerProfile(updated);
      setProfilePromptWorker(null);
    } catch (err) {
      console.error('Failed to update worker profile:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle QR scan detection
  const handleQrTokenDetected = useCallback((token: string) => {
    if (!token) return;
    const now = Date.now();
    if (lastScannedTokenRef.current && lastScannedTokenRef.current.token === token && now - lastScannedTokenRef.current.time < 3000) {
      return;
    }
    lastScannedTokenRef.current = { token, time: now };

    const trimmed = token.trim();
    const trimmedLower = trimmed.toLowerCase();
    const matchedWorker = workers.find(
      w => w.qrCodeToken === trimmed || w.id === trimmed || w.phone === trimmed || (w.fullName || '').toLowerCase() === trimmedLower
    );

    if (matchedWorker) {
      processWorkerClockIn(matchedWorker, 'QR_SCAN');
    } else {
      console.warn('Scanned QR token did not match any worker:', token);
    }
  }, [workers, processWorkerClockIn]);

  // Camera video feed initialization
  useEffect(() => {
    if (activeMethod !== 'QR_SCAN' || !isCameraActive) {
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

    let stream: MediaStream | null = null;

    navigator.mediaDevices?.getUserMedia({
      video: { facingMode: cameraFacing }
    }).then(s => {
      stream = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play().catch(err => console.warn('Video play error:', err));
      }
      setCameraError(null);
    }).catch(err => {
      console.warn('Camera access denied or unavailable:', err);
      setCameraError('Camera not accessible. Please grant permissions or use Name Search.');
    });

    const scanFrame = () => {
      if (
        videoRef.current && 
        videoRef.current.readyState >= 2 && 
        videoRef.current.videoWidth > 0 && 
        videoRef.current.videoHeight > 0
      ) {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            try {
              canvas.height = videoRef.current.videoHeight;
              canvas.width = videoRef.current.videoWidth;
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert'
              });

              if (code && code.data) {
                handleQrTokenDetected(code.data);
              }
            } catch (err) {
              console.warn('QR scan error in Sunday kiosk:', err);
            }
          }
        }
      }
      animationFrameId.current = requestAnimationFrame(scanFrame);
    };

    animationFrameId.current = requestAnimationFrame(scanFrame);

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [activeMethod, isCameraActive, cameraFacing, handleQrTokenDetected]);

  // Focus search input when switching to NAME_SEARCH
  useEffect(() => {
    if (activeMethod === 'NAME_SEARCH') {
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
  }, [activeMethod]);

  // Filtered active workers (Archived excluded)
  const activeWorkersList = useMemo(() => {
    return workers
      .filter(w => w.status === 'ACTIVE')
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [workers]);

  // Filtered workers for search / department methods
  const matchingWorkers = useMemo(() => {
    if (activeMethod === 'NAME_SEARCH') {
      if (!searchQuery.trim()) return activeWorkersList;
      const q = (searchQuery || '').toLowerCase();
      return activeWorkersList.filter(w => 
        (w.fullName || '').toLowerCase().includes(q) ||
        (w.phone || '').includes(q) ||
        (w.department || '').toLowerCase().includes(q) ||
        (w.categories || []).some(c => (c || '').toLowerCase().includes(q))
      );
    }
    if (activeMethod === 'DEPT_LIST') {
      if (selectedDept === 'ALL') return activeWorkersList;
      return activeWorkersList.filter(w => w.department === selectedDept);
    }
    return activeWorkersList;
  }, [activeMethod, searchQuery, selectedDept, activeWorkersList]);

  const uniqueDepartments = useMemo(() => {
    return Array.from(new Set(activeWorkersList.map(w => w.department)));
  }, [activeWorkersList]);

  const clockedInCount = todayAttendance.length;
  const lateCount = todayAttendance.filter(a => a.isLate).length;

  // Sunday Register calculations
  const filteredRegisterWorkers = useMemo(() => {
    return activeWorkersList.filter(w => {
      const q = registerSearchQuery.toLowerCase().trim();
      const matchQ = !q || w.fullName.toLowerCase().includes(q) || (w.phone || '').includes(q) || w.department.toLowerCase().includes(q);
      const matchD = registerDept === 'ALL' || w.department === registerDept;
      return matchQ && matchD;
    });
  }, [activeWorkersList, registerSearchQuery, registerDept]);

  const registerStats = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;

    filteredRegisterWorkers.forEach(w => {
      const rec = sundayAttendanceMap.get(w.id);
      const status = rec ? rec.status : 'ABSENT';
      if (status === 'PRESENT') present++;
      else if (status === 'LATE') late++;
      else if (status === 'EXCUSED') excused++;
      else absent++;
    });

    const total = filteredRegisterWorkers.length;
    const turnoutCount = present + late;
    const turnoutRate = total > 0 ? Math.round((turnoutCount / total) * 100) : 0;
    const punctualityRate = turnoutCount > 0 ? Math.round((present / turnoutCount) * 100) : 0;

    return { total, present, late, absent, excused, turnoutCount, turnoutRate, punctualityRate };
  }, [filteredRegisterWorkers, sundayAttendanceMap]);

  // Handle manual register status update
  const handleSetRegisterStatus = async (worker: WorkerProfile, status: SundayAttendanceStatus) => {
    const existing = sundayAttendanceMap.get(worker.id);
    const newRecord: WorkerAttendanceRecord = {
      id: `${worker.id}_${targetSundayDate}`,
      workerId: worker.id,
      workerName: worker.fullName,
      department: worker.department,
      serviceDate: targetSundayDate,
      serviceName: config.serviceName || 'Sunday Morning Service',
      clockInTime: existing?.clockInTime || (status === 'PRESENT' || status === 'LATE' ? '08:00 AM (Manual)' : '-'),
      timestamp: existing?.timestamp || Date.now(),
      status,
      isLate: status === 'LATE',
      method: 'MANUAL_OVERRIDE',
      notes: `Manual register entry for ${targetSundayDate}`,
      createdAt: existing?.createdAt || new Date().toISOString()
    };

    if (onSaveSundayRecord) {
      await onSaveSundayRecord(newRecord);
    } else {
      await onClockIn(newRecord);
    }
  };

  // Mark all visible workers as PRESENT for Sunday Register
  const handleMarkAllRegisterPresent = async () => {
    const recordsToSave: WorkerAttendanceRecord[] = filteredRegisterWorkers.map(w => {
      const existing = sundayAttendanceMap.get(w.id);
      return {
        id: `${w.id}_${targetSundayDate}`,
        workerId: w.id,
        workerName: w.fullName,
        department: w.department,
        serviceDate: targetSundayDate,
        serviceName: config.serviceName || 'Sunday Morning Service',
        clockInTime: existing?.clockInTime || '08:00 AM (Manual)',
        timestamp: existing?.timestamp || Date.now(),
        status: 'PRESENT',
        isLate: false,
        method: existing?.method || 'MANUAL_OVERRIDE',
        notes: `Bulk manual entry for ${targetSundayDate}`,
        createdAt: existing?.createdAt || new Date().toISOString()
      };
    });

    if (onSaveBulkSundayRecords) {
      await onSaveBulkSundayRecords(recordsToSave);
    } else {
      for (const r of recordsToSave) {
        await onClockIn(r);
      }
    }
  };

  // Export Sunday Register CSV
  const handleExportSundayCsv = () => {
    const headers = ['Worker Full Name', 'Department', 'Phone', 'Sunday Date', 'Week', 'Topic', 'Sunday Status', 'Login Time', 'Verification Method'];
    const rows = filteredRegisterWorkers.map(w => {
      const rec = sundayAttendanceMap.get(w.id);
      return [
        `"${w.fullName}"`,
        `"${w.department}"`,
        `"${w.phone || '-'}"`,
        `"${targetSundayDate}"`,
        `"Week ${selectedWeek}"`,
        `"${activeWeekInfo?.topic || '-'}"`,
        `"${rec ? rec.status : 'ABSENT'}"`,
        `"${rec?.clockInTime || '-'}"`,
        `"${rec?.method || 'NONE'}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GOFAMINT_HOF_Sunday_Attendance_Week_${selectedWeek}_${targetSundayDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Kiosk Hero Clock & Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Sunday Attendance & Clock-In</span>
              </div>
              <span className="text-xs text-slate-400 font-semibold">
                GOFAMINT_HOF Workers Directorate
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black font-['Cinzel',serif] tracking-tight text-white">
              {config.serviceName || 'Sunday Morning Service'}
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-2">
              <span>Window: <strong>{config.sundayOpenTime || '07:00'} – {config.sundayCloseTime || '11:30'}</strong></span>
              <span>•</span>
              <span>Prayer: <strong>{config.sundayPrayerStartTime || '07:45'}</strong></span>
              <span>•</span>
              <span className="text-amber-300">Late after: <strong>{config.sundayLateCutoffTime || '08:00 AM'}</strong></span>
            </p>
          </div>

          {/* Live Digital Clock */}
          <div className="flex flex-col items-start md:items-end justify-center bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 sm:px-6 shadow-inner">
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-amber-400 drop-shadow-sm">
              {currentTimeStr || '08:00:00 AM'}
            </div>
            <div className="text-xs text-slate-300 font-medium mt-0.5">
              {currentDateStr || 'Sunday'}
            </div>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="mt-2 text-[11px] font-bold text-slate-400 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer"
            >
              <Settings className="w-3 h-3" />
              <span>Adjust Sunday Schedule</span>
            </button>
          </div>
        </div>

        {/* Live Counters Banner */}
        <div className="grid grid-cols-3 gap-3 pt-6 mt-6 border-t border-slate-800/80 text-center">
          <div className="bg-slate-800/50 rounded-xl p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Clocked In</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-400">{clockedInCount}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">On-Time Arrivals</span>
            <div className="text-xl sm:text-2xl font-black text-blue-300">{clockedInCount - lateCount}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Late Arrivals</span>
            <div className="text-xl sm:text-2xl font-black text-amber-400">{lateCount}</div>
          </div>
        </div>
      </div>

      {/* Complaint 3: Adjust Schedule Bar (Sunday Section) */}
      <div className="bg-white border-2 border-amber-200/80 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-amber-500/10 text-amber-700 rounded-2xl border border-amber-500/30">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Sunday Schedule & Clocking Window
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase">
                Active Policy
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 mt-1 font-semibold">
              <span>Terminal Window: <strong className="text-slate-900 font-mono">{config.sundayOpenTime || '07:00'} – {config.sundayCloseTime || '11:30'}</strong></span>
              <span>•</span>
              <span>Workers Prayer: <strong className="text-slate-900 font-mono">{config.sundayPrayerStartTime || '07:45'}</strong></span>
              <span>•</span>
              <span>Late Cutoff: <strong className="text-amber-700 font-mono font-black">{config.sundayLateCutoffTime || '08:00'}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-black rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            <Settings className="w-4 h-4" />
            <span>Adjust Schedule</span>
          </button>
        </div>
      </div>

      {/* Complaint 4: General Executive 12-Week Sync Bar (Sunday Version) */}
      {resolvedYear && (
        <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border-2 border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-amber-400" />
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  Sunday Executive 12-Week Schedule Sync
                </span>
                <h2 className="text-lg font-black font-['Cinzel',serif] text-white uppercase">
                  {activeQuarter?.quarterName || 'First Quarter'}: {activeQuarter?.quarterTheme || 'Kingdom Study & Ministry Service'}
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {resolvedYear.quarters.map(q => {
                const isSelected = q.quarterNumber === selectedQuarterNumber;
                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setSelectedQuarterNumber(q.quarterNumber);
                      setSelectedWeek(1);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <span>Q{q.quarterNumber}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                      q.status === 'ACTIVE' 
                        ? 'bg-emerald-500 text-white' 
                        : q.status === 'ARCHIVED' 
                        ? 'bg-slate-600 text-slate-200' 
                        : 'bg-blue-600 text-white'
                    }`}>
                      {q.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sunday 12-Week Tabs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">
                Select Sunday Evaluation Week (Week 1–{quarterSchedule.length}):
              </span>
              <span className="text-[11px] text-amber-300 font-mono">
                Sunday Service Date: {targetSundayDate}
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              {quarterSchedule.map(item => {
                const isSelected = item.weekNumber === selectedWeek;
                return (
                  <button
                    key={item.weekNumber}
                    onClick={() => setSelectedWeek(item.weekNumber)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition flex flex-col items-center cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md ring-2 ring-amber-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span className="font-black text-xs">
                      {item.isSharingAdmonitionWeek ? `Week ${item.weekNumber} (Admonition)` : `Week ${item.weekNumber}`}
                    </span>
                    <span className="text-[9px] opacity-80 font-mono mt-0.5">
                      Sun: {item.sundayDate.slice(5)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sunday Lesson & Punctuality Banner */}
          <div className="bg-slate-800/90 rounded-2xl p-3 sm:p-4 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Sunday Morning Service (Week {selectedWeek}):
              </span>
              <div className="text-sm font-bold text-white line-clamp-1">
                {activeWeekInfo?.topic || `Lesson ${selectedWeek}`}
              </div>
              <span className="text-[11px] text-amber-300 font-mono">
                Date: {targetSundayDate} ({isTargetDatePast ? 'Past Date' : isTargetDateToday ? 'Today' : 'Future Date'})
              </span>
            </div>

            <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-slate-700 pt-2 sm:pt-0 sm:pl-4 shrink-0">
              <div className="text-center sm:text-right">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Turnout Rate</span>
                <span className="text-base font-black text-white font-mono">{registerStats.turnoutRate}%</span>
              </div>
              <div className="text-center sm:text-right">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Punctuality</span>
                <span className="text-base font-black text-emerald-400 font-mono">{registerStats.punctualityRate}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complaint 2: View Mode Switcher: Sunday Clock-In Terminal vs Sunday Attendance Register */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-300">
          <button
            onClick={() => setViewMode('TERMINAL')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
              viewMode === 'TERMINAL' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-amber-300" />
            <span>Sunday Clock-In Terminal</span>
          </button>
          <button
            onClick={() => setViewMode('REGISTER')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
              viewMode === 'REGISTER' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>Sunday Attendance Register</span>
          </button>
        </div>

        {viewMode === 'REGISTER' && (
          <div className="flex items-center gap-2">
            {isTargetDatePast && (
              <button
                onClick={handleMarkAllRegisterPresent}
                className="px-3 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                <span>Mark All Filtered Present</span>
              </button>
            )}
            <button
              onClick={handleExportSundayCsv}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
              title="Print Register"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ======================= VIEW MODE: REGISTER ======================= */}
      {viewMode === 'REGISTER' && (
        <div className="space-y-6">
          {/* Filter and Metrics Row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <label className="font-bold text-slate-700">Department:</label>
                <select
                  value={registerDept}
                  onChange={e => setRegisterDept(e.target.value)}
                  className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800 text-xs focus:outline-hidden focus:border-blue-900"
                >
                  <option value="ALL">All Departments ({activeWorkersList.length})</option>
                  {(departmentsList.length > 0 ? departmentsList : uniqueDepartments).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                value={registerSearchQuery}
                onChange={e => setRegisterSearchQuery(e.target.value)}
                placeholder="Search worker by name..."
                className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-900 w-48 sm:w-60"
              />
            </div>

            {/* 4 Summary Stat Pills */}
            <div className="flex items-center gap-2 text-xs">
              <div className="px-3 py-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl font-bold">
                Present: <strong>{registerStats.present}</strong>
              </div>
              <div className="px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl font-bold">
                Late: <strong>{registerStats.late}</strong>
              </div>
              <div className="px-3 py-1.5 bg-rose-50 text-rose-900 border border-rose-200 rounded-xl font-bold">
                Absent: <strong>{registerStats.absent}</strong>
              </div>
              <div className="px-3 py-1.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-xl font-bold">
                Excused: <strong>{registerStats.excused}</strong>
              </div>
            </div>
          </div>

          {/* Sunday Attendance Register Table */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-300">
                  <tr>
                    <th className="py-3 px-3">Worker Name</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3 text-center">Sunday Status</th>
                    <th className="py-3 px-3 text-center">Quick Set Attendance</th>
                    <th className="py-3 px-3 text-right">Login Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRegisterWorkers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No active workers found matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRegisterWorkers.map(worker => {
                      const rec = sundayAttendanceMap.get(worker.id);
                      const currentStatus = rec ? rec.status : 'ABSENT';

                      return (
                        <tr key={worker.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 text-xs">{worker.fullName}</div>
                            <div className="text-[10px] text-slate-500">{worker.phone || 'No phone'}</div>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-700">{worker.department}</td>
                          
                          {/* Sunday Status Badge */}
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase inline-block ${
                              currentStatus === 'PRESENT' 
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                : currentStatus === 'LATE'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : currentStatus === 'EXCUSED'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {currentStatus}
                            </span>
                          </td>

                          {/* Quick Set Attendance Buttons */}
                          <td className="py-3 px-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleSetRegisterStatus(worker, 'PRESENT')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                                  currentStatus === 'PRESENT'
                                    ? 'bg-emerald-700 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-900'
                                }`}
                              >
                                Present
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSetRegisterStatus(worker, 'LATE')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                                  currentStatus === 'LATE'
                                    ? 'bg-amber-600 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-900'
                                }`}
                              >
                                Late
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSetRegisterStatus(worker, 'ABSENT')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                                  currentStatus === 'ABSENT'
                                    ? 'bg-rose-700 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-rose-100 hover:text-rose-900'
                                }`}
                              >
                                Absent
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSetRegisterStatus(worker, 'EXCUSED')}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                  currentStatus === 'EXCUSED'
                                    ? 'bg-blue-700 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-900'
                                }`}
                              >
                                Excused
                              </button>
                            </div>
                          </td>

                          {/* Login Time / Clock-In */}
                          <td className="py-3 px-3 text-right">
                            {rec?.clockInTime ? (
                              <div className="space-y-0.5">
                                <span className="font-mono font-bold text-slate-900 text-xs bg-slate-100 px-2 py-0.5 rounded">
                                  {rec.clockInTime}
                                </span>
                                {rec.method && (
                                  <div className="text-[9px] text-slate-500 font-sans">
                                    {rec.method === 'QR_SCAN' ? 'QR Terminal' : rec.method === 'MANUAL_OVERRIDE' ? 'Manual Past Entry' : rec.method}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================= VIEW MODE: TERMINAL ======================= */}
      {viewMode === 'TERMINAL' && (
        <div className="space-y-6">
          {/* Schedule Window Status Indicator */}
          {!isClockInScheduleAllowed && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl font-bold shrink-0 mt-0.5">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-amber-950 flex items-center gap-2">
                    <span>Sunday Clock-In Window: {config.sundayOpenTime || '07:00'} – {config.sundayCloseTime || '11:30'}</span>
                    <span className="bg-amber-200 text-amber-900 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                      {isActualSunday ? 'WINDOW CLOSED' : 'NOT SUNDAY'}
                    </span>
                  </h3>
                  <p className="text-xs text-amber-900/90 leading-relaxed max-w-2xl">
                    Worker Sunday clock-in is strictly scheduled for <strong>Sundays from {config.sundayOpenTime || '07:00 AM'} to {config.sundayCloseTime || '11:30 AM'}</strong>.
                    Official workers prayer starts at <strong>{config.sundayPrayerStartTime || '07:45 AM'}</strong>, with late arrivals marked after <strong>{config.sundayLateCutoffTime || '08:00 AM'}</strong>.
                    Current time: <strong>{currentTimeStr}</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-xs shrink-0 cursor-pointer"
              >
                <Settings className="w-4 h-4 text-amber-400" />
                <span>Adjust Schedule</span>
              </button>
            </div>
          )}

          {/* Main Clock-In Method Switcher Tabs */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-300 max-w-xl mx-auto shadow-inner">
            <button
              onClick={() => {
                setActiveMethod('NAME_SEARCH');
                setIsCameraActive(false);
              }}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                activeMethod === 'NAME_SEARCH'
                  ? 'bg-blue-900 text-white shadow-md'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Search className="w-4 h-4 text-amber-400" />
              <span>1. Find & List Names</span>
            </button>

            <button
              onClick={() => {
                setActiveMethod('QR_SCAN');
                setIsCameraActive(true);
              }}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                activeMethod === 'QR_SCAN'
                  ? 'bg-blue-900 text-white shadow-md'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>2. QR Code Scanner</span>
            </button>

            <button
              onClick={() => {
                setActiveMethod('DEPT_LIST');
                setIsCameraActive(false);
              }}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                activeMethod === 'DEPT_LIST'
                  ? 'bg-blue-900 text-white shadow-md'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4 text-amber-400" />
              <span>3. Department</span>
            </button>
          </div>

          {/* ---------------- METHOD 1: QR CODE SCANNER ---------------- */}
          {activeMethod === 'QR_SCAN' && (
            <div className="max-w-2xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-lg text-center space-y-5">
              <div className="space-y-1">
                <h2 className="text-lg font-black text-slate-900 font-['Cinzel',serif] uppercase">
                  Hold QR Badge in Front of Camera
                </h2>
                <p className="text-xs text-slate-600">
                  Personal ID badges will be instantly recognized with immediate attendance confirmation.
                </p>
              </div>

              {/* Camera Viewfinder Box */}
              <div className="relative mx-auto w-full max-w-md aspect-square bg-slate-950 rounded-3xl overflow-hidden border-4 border-slate-900 shadow-2xl flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Viewfinder Target Reticle */}
                <div className="absolute inset-8 border-2 border-amber-400/70 rounded-2xl pointer-events-none flex flex-col justify-between p-2 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-md" />
                    <div className="w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-md" />
                  </div>
                  <div className="text-center font-mono text-[11px] font-black text-amber-300 uppercase tracking-widest bg-slate-900/60 py-1 px-3 rounded-full mx-auto backdrop-blur-xs">
                    Scanning QR Code...
                  </div>
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-md" />
                    <div className="w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-md" />
                  </div>
                </div>

                {/* Camera Error Message */}
                {cameraError && (
                  <div className="absolute inset-4 bg-slate-900/90 rounded-2xl p-6 flex flex-col items-center justify-center text-white space-y-3">
                    <Camera className="w-8 h-8 text-amber-400" />
                    <p className="text-xs text-slate-200 text-center max-w-xs">{cameraError}</p>
                    <button
                      onClick={() => setActiveMethod('NAME_SEARCH')}
                      className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-amber-400 transition"
                    >
                      Use Name Search Instead
                    </button>
                  </div>
                )}
              </div>

              {/* Camera Switcher & Helper */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment')}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Flip Camera</span>
                </button>

                <button
                  onClick={() => setIsCameraActive(prev => !prev)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {isCameraActive ? 'Pause Scanner' : 'Resume Scanner'}
                </button>
              </div>
            </div>
          )}

          {/* ---------------- METHOD 2: NAME SEARCH ---------------- */}
          {activeMethod === 'NAME_SEARCH' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Type worker's first or last name, phone, or unit..."
                  className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-slate-300 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-400 focus:outline-hidden shadow-sm"
                />
              </div>

              {/* Matching Workers Roster */}
              <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-2 py-1">
                  <span>Found {matchingWorkers.length} Workers</span>
                  <span>Tap to Confirm Clock-in</span>
                </div>

                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {matchingWorkers.map(w => {
                    const isClocked = todayAttendance.some(a => a.workerId === w.id);
                    const comp = calculateWorkerProfileCompleteness(w);

                    return (
                      <div
                        key={w.id}
                        className="py-3 px-3 hover:bg-blue-50/60 rounded-2xl transition flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 text-sm truncate">{w.fullName}</span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold">
                              {w.department}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>{w.duty || w.categories[0] || 'Worker'}</span>
                            {w.phone && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{w.phone}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isClocked ? (
                            <span className="px-3.5 py-1.5 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                              <Check className="w-4 h-4" />
                              <span>Clocked In</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => processWorkerClockIn(w, 'NAME_SEARCH')}
                              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <span>Clock In</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ---------------- METHOD 3: DEPARTMENT QUICK ACCESS ---------------- */}
          {activeMethod === 'DEPT_LIST' && (
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Department Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                <button
                  onClick={() => setSelectedDept('ALL')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
                    selectedDept === 'ALL'
                      ? 'bg-blue-900 text-white shadow-sm'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  All ({activeWorkersList.length})
                </button>
                {uniqueDepartments.map(dept => (
                  <button
                    key={dept}
                    onClick={() => setSelectedDept(dept)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
                      selectedDept === dept
                        ? 'bg-blue-900 text-white shadow-sm'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {dept} ({activeWorkersList.filter(w => w.department === dept).length})
                  </button>
                ))}
              </div>

              {/* Department Worker Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {matchingWorkers.map(w => {
                  const isClocked = todayAttendance.some(a => a.workerId === w.id);
                  return (
                    <div
                      key={w.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="font-black text-slate-900 text-sm truncate">{w.fullName}</div>
                        <div className="text-xs text-slate-500 font-semibold">{w.department}</div>
                        <div className="text-[11px] text-slate-400 mt-1">{w.duty || w.categories[0] || 'Worker'}</div>
                      </div>

                      {isClocked ? (
                        <div className="py-1.5 text-center bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
                          ✓ Clocked In
                        </div>
                      ) : (
                        <button
                          onClick={() => processWorkerClockIn(w, 'DEPT_QUICK_ACCESS')}
                          className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer"
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
        </div>
      )}

      {/* Celebration Overlay Notification */}
      {celebrationWorker && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border-2 border-amber-400 text-white rounded-3xl p-5 shadow-2xl animate-bounce flex items-center gap-4 max-w-sm">
          <div className="p-3 bg-emerald-500 text-white rounded-2xl">
            <CheckCircle className="w-6 h-6" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">Already Clocked In Today</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                <strong>{duplicateWarning.worker.fullName}</strong> was recorded at {duplicateWarning.existingRecord.clockInTime}.
              </p>
            </div>
            <button
              onClick={() => setDuplicateWarning(null)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* Profile Prompt Modal */}
      {profilePromptWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
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
                  Profile details missing for <strong>{profilePromptWorker.fullName}</strong>.
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
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  Skip for Now
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="w-1/2 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl font-bold transition cursor-pointer shadow-md"
                >
                  {isSavingProfile ? 'Saving...' : 'Save Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Schedule Modal (Complaint 3: Available in Sunday section) */}
      {showSettingsModal && (
        <ClockInScheduleSettingsModal
          isOpen={showSettingsModal}
          activeTab="SUNDAY"
          currentConfig={config}
          onClose={() => setShowSettingsModal(false)}
          onSave={async (newConfig) => {
            await onUpdateConfig(newConfig);
            setShowSettingsModal(false);
          }}
        />
      )}

    </div>
  );
};
