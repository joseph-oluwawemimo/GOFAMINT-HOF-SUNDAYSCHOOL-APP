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
  RefreshCw, ArrowRight, ShieldCheck, UserCheck, Flame,
  Edit3, Calendar, Download, Printer, CheckCircle2, Lock, BookOpen
} from 'lucide-react';
import confetti from 'canvas-confetti';
import jsQR from 'jsqr';
import { GofamintLogo } from '../GofamintLogo';
import { calculateWorkerProfileCompleteness } from '../../utils/workerProfileUtils';
import { getQuarterWeeklySchedule, getCurrentCalendarWeek } from '../../utils/quarterScheduleUtils';
import { evaluateAttendanceAccess, getAttendanceWeekLockKey } from '../../utils/attendanceAccessSecurity';
import { 
  lockAttendanceWeek, 
  requestAttendanceWeekChanges, 
  approveAttendanceWeekChanges, 
  completeAttendanceWeekChanges 
} from '../../db/indexedDB';
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

  // Sunday 12-Week schedule sync — week is ALWAYS derived from today's date
  const resolvedYear = sundaySchoolYear || INITIAL_SUNDAY_SCHOOL_YEAR;
  const [selectedQuarterNumber, setSelectedQuarterNumber] = useState<QuarterNumber>(
    resolvedYear.activeQuarterNumber || 1
  );

  const activeQuarter = useMemo(() => {
    return resolvedYear.quarters.find(q => q.quarterNumber === selectedQuarterNumber) || resolvedYear.quarters[0];
  }, [resolvedYear, selectedQuarterNumber]);

  // Auto-derive the calendar-current week from today's date and the active quarter schedule.
  // Never defaults to Week 1 — always reflects where we actually are in the 12-week plan.
  const calendarCurrentWeek = useMemo(() => getCurrentCalendarWeek(activeQuarter), [activeQuarter]);

  const [selectedWeek, setSelectedWeek] = useState<number>(() => getCurrentCalendarWeek(
    resolvedYear.quarters.find(q => q.quarterNumber === (resolvedYear.activeQuarterNumber || 1)) || resolvedYear.quarters[0]
  ));

  // Sync selected quarter when sundaySchoolYear loads/updates from cloud
  useEffect(() => {
    if (sundaySchoolYear?.activeQuarterNumber) {
      setSelectedQuarterNumber(sundaySchoolYear.activeQuarterNumber);
    }
  }, [sundaySchoolYear?.activeQuarterNumber]);

  // When the active quarter changes (e.g. after cloud hydration), jump to the
  // calendar-correct week for that quarter. Do NOT fall back to Week 1.
  useEffect(() => {
    setSelectedWeek(getCurrentCalendarWeek(activeQuarter));
  }, [activeQuarter]);

  const quarterSchedule = useMemo(() => {
    if (!activeQuarter) return [];
    return getQuarterWeeklySchedule(activeQuarter);
  }, [activeQuarter]);

  const activeWeekInfo = useMemo(() => {
    if (quarterSchedule.length === 0) return null;
    return quarterSchedule.find(s => s.weekNumber === selectedWeek) || quarterSchedule[0];
  }, [quarterSchedule, selectedWeek]);

  // Single-click idempotency guard: tracks worker IDs for in-flight clock-in writes.
  // A second tap while a write is in-flight is silently dropped — no duplicate records.
  const pendingClockInIds = useRef<Set<string>>(new Set());

  // Use actual today's date — never trust a stale config.serviceDate for the current session.
  const todayIso = new Date().toISOString().split('T')[0];
  const targetSundayDate = activeWeekInfo?.sundayDate || todayIso;
  const isTargetDatePast = targetSundayDate < todayIso;
  const isTargetDateFuture = targetSundayDate > todayIso;
  const isTargetDateToday = targetSundayDate === todayIso;
  // A live clock-in is only valid when the selected week corresponds to today.
  const isCurrentWeekLive = isTargetDateToday && selectedWeek === calendarCurrentWeek;

  // Attendance pool for Sunday — all records across all dates for this session
  const attendancePool = allSundayAttendance || todayAttendance;

  const sundayAttendanceMap = useMemo(() => {
    const map = new Map<string, WorkerAttendanceRecord>();
    attendancePool
      .filter(r => r.serviceDate === targetSundayDate)
      .forEach(r => map.set(r.workerId, r));
    return map;
  }, [attendancePool, targetSundayDate]);

  // Unified Attendance Security Engine (Phase 3 & 5)
  const sundayAccess = useMemo(() => {
    return evaluateAttendanceAccess({
      sessionType: 'SUNDAY',
      weekNumber: selectedWeek,
      scheduledDate: targetSundayDate,
      quarterNumber: selectedQuarterNumber,
      openTime: config.sundayOpenTime,
      closeTime: config.sundayCloseTime,
      config,
      now: new Date()
    });
  }, [selectedWeek, targetSundayDate, selectedQuarterNumber, config]);

  const isClockInScheduleAllowed = sundayAccess.canClockIn;

  // Active lock record and change request
  const currentSundayLockKey = getAttendanceWeekLockKey('SUNDAY', selectedQuarterNumber, selectedWeek);
  const currentSundayLockRecord = config?.lockedWeeks?.[currentSundayLockKey];
  const activeSundayChangeRequest = currentSundayLockRecord?.activeChangeRequest;

  // Change request modal states
  const [showChangeRequestModal, setShowChangeRequestModal] = useState<boolean>(false);
  const [changeRequestReason, setChangeRequestReason] = useState<string>('');
  const [changeRequestRequester, setChangeRequestRequester] = useState<string>('Workers Secretary');
  const [isProcessingLockAction, setIsProcessingLockAction] = useState<boolean>(false);

  // Lock Entry Handler (Past weeks finalized)
  const handleLockEntry = async () => {
    if (!window.confirm(`Lock Sunday attendance entry for Week ${selectedWeek}? This will finalize historical records and prevent accidental changes.`)) {
      return;
    }
    setIsProcessingLockAction(true);
    try {
      const updated = await lockAttendanceWeek('SUNDAY', selectedQuarterNumber, selectedWeek, 'Workers Coordinator');
      await onUpdateConfig(updated);
      alert(`Sunday Week ${selectedWeek} attendance is now locked.`);
    } catch (err: any) {
      alert(`Failed to lock week: ${err.message}`);
    } finally {
      setIsProcessingLockAction(false);
    }
  };

  // Submit Change Request Handler
  const handleSubmitChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeRequestReason.trim()) {
      alert('Please provide a reason for the change request.');
      return;
    }
    setIsProcessingLockAction(true);
    try {
      const updated = await requestAttendanceWeekChanges(
        'SUNDAY',
        selectedQuarterNumber,
        selectedWeek,
        changeRequestRequester.trim() || 'Workers Secretary',
        changeRequestReason.trim()
      );
      await onUpdateConfig(updated);
      setShowChangeRequestModal(false);
      setChangeRequestReason('');
      alert(`Change request for Sunday Week ${selectedWeek} submitted! An authorized coordinator can now review and approve it.`);
    } catch (err: any) {
      alert(`Failed to submit change request: ${err.message}`);
    } finally {
      setIsProcessingLockAction(false);
    }
  };

  // Approve Change Request Handler (Authorized approval -> Changes Mode)
  const handleApproveChangeRequest = async () => {
    if (!window.confirm(`Approve change request for Sunday Week ${selectedWeek}? This will place attendance into Changes Mode for corrections.`)) {
      return;
    }
    setIsProcessingLockAction(true);
    try {
      const updated = await approveAttendanceWeekChanges('SUNDAY', selectedQuarterNumber, selectedWeek, 'Authorized Coordinator');
      await onUpdateConfig(updated);
      alert(`Changes Mode is now ACTIVE for Sunday Week ${selectedWeek}. Make corrections, then click 'Changes Done' to lock again.`);
    } catch (err: any) {
      alert(`Failed to approve changes: ${err.message}`);
    } finally {
      setIsProcessingLockAction(false);
    }
  };

  // Complete Changes Handler (Changes Done -> Automatically lock again)
  const handleCompleteChanges = async () => {
    if (!window.confirm(`Finalize changes for Sunday Week ${selectedWeek}? This will record the audit log and automatically lock historical entry again.`)) {
      return;
    }
    setIsProcessingLockAction(true);
    try {
      const updated = await completeAttendanceWeekChanges('SUNDAY', selectedQuarterNumber, selectedWeek);
      await onUpdateConfig(updated);
      alert(`Corrections completed. Sunday Week ${selectedWeek} has been automatically re-locked.`);
    } catch (err: any) {
      alert(`Failed to complete changes: ${err.message}`);
    } finally {
      setIsProcessingLockAction(false);
    }
  };

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
    } catch (error) {
      console.debug('Sunday clock-in sound feedback was unavailable:', error);
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
    // --- IDEMPOTENCY GUARD: one tap only ---
    // Prevents double-click / rapid-tap from firing multiple simultaneous writes.
    if (pendingClockInIds.current.has(worker.id)) return;
    pendingClockInIds.current.add(worker.id);

    try {
      // 0. Unified Attendance Security Guard: enforce date and clock-in window in WAT
      if (!sundayAccess.canClockIn) {
        alert(`Sunday Clock-in is restricted: ${sundayAccess.lockReason || 'Clock-in is only permitted on Sundays during the scheduled window.'}`);
        return;
      }

      // Always use today's actual date — never a stale config.serviceDate.
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Check for Duplicate Clock-In against the full attendance pool.
      //    Use workerId as the authoritative key (name matching is a fallback).
      const existing = attendancePool.find(
        a => a.workerId === worker.id && a.serviceDate === todayStr
      );

      if (existing) {
        playAudioFeedback('duplicate');
        setDuplicateWarning({ worker, existingRecord: existing });
        return;
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const { status, isLate } = evaluatePunctuality(now);

      // 2. Build the record — stamp weekNumber and quarterNumber durably.
      //    These fields are optional on legacy records but always present on new ones.
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
        weekNumber: selectedWeek,
        quarterNumber: selectedQuarterNumber,
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
          if (prev?.record.id === newRecord.id) return null;
          return prev;
        });
      }, 4500);

    } finally {
      // Always release the guard — even if the write failed — so retry is possible.
      pendingClockInIds.current.delete(worker.id);
    }

  }, [config, attendancePool, onClockIn, playAudioFeedback, isCurrentWeekLive, isTargetDatePast, isTargetDateFuture, selectedWeek, calendarCurrentWeek, targetSundayDate, selectedQuarterNumber]);

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

  // The terminal is a queue, not a completed-attendance report. As soon as a
  // worker clocks in, remove them from every tappable list so the queue becomes
  // shorter and safer for the next person.
  const availableWorkersList = useMemo(() => {
    const actualToday = new Date().toISOString().split('T')[0];
    const clockedInIds = new Set(
      attendancePool.filter(record => record.serviceDate === actualToday).map(record => record.workerId)
    );
    return activeWorkersList.filter(worker => !clockedInIds.has(worker.id));
  }, [activeWorkersList, attendancePool]);

  // Filtered workers for search / department methods
  const matchingWorkers = useMemo(() => {
    if (activeMethod === 'NAME_SEARCH') {
      if (!searchQuery.trim()) return availableWorkersList;
      const q = (searchQuery || '').toLowerCase();
      return availableWorkersList.filter(w =>
        (w.fullName || '').toLowerCase().includes(q) ||
        (w.phone || '').includes(q) ||
        (w.department || '').toLowerCase().includes(q) ||
        (w.categories || []).some(c => (c || '').toLowerCase().includes(q))
      );
    }
    if (activeMethod === 'DEPT_LIST') {
      if (selectedDept === 'ALL') return availableWorkersList;
      return availableWorkersList.filter(w => w.department === selectedDept);
    }
    return availableWorkersList;
  }, [activeMethod, searchQuery, selectedDept, availableWorkersList]);

  const uniqueDepartments = useMemo(() => {
    return Array.from(new Set(availableWorkersList.map(w => w.department)));
  }, [availableWorkersList]);

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
    if (!sundayAccess.canManualAttendance) {
      alert(`Manual attendance is locked: ${sundayAccess.lockReason || 'Session is not open for manual entry.'}`);
      return;
    }
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
    if (!sundayAccess.canManualAttendance) {
      alert(`Manual attendance is locked: ${sundayAccess.lockReason || 'Session is not open for manual entry.'}`);
      return;
    }
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
    <div className="workers-page workers-page-sunday space-y-5 sm:space-y-6 animate-fade-in">
      
      {/* Kiosk Hero Clock & Header */}
      <div className="workers-page-hero workers-page-hero-dark bg-slate-900 text-white rounded-3xl p-5 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
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
                const isCurrent = item.weekNumber === calendarCurrentWeek && item.sundayDate === todayIso;
                const isPast = item.sundayDate < todayIso;
                const isFuture = item.sundayDate > todayIso;
                return (
                  <button
                    key={item.weekNumber}
                    onClick={() => setSelectedWeek(item.weekNumber)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition flex flex-col items-center cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md ring-2 ring-amber-400'
                        : isCurrent
                        ? 'bg-emerald-800 text-white hover:bg-emerald-700'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span className="font-black text-xs">
                      {item.isSharingAdmonitionWeek ? `Week ${item.weekNumber} (Admonition)` : `Week ${item.weekNumber}`}
                    </span>
                    <span className="text-[9px] opacity-80 font-mono mt-0.5">
                      Sun: {item.sundayDate.slice(5)}
                    </span>
                    {/* Status badge */}
                    <span className={`text-[8px] font-black uppercase mt-0.5 px-1 rounded ${
                      isCurrent
                        ? 'bg-emerald-400 text-emerald-950'
                        : isPast
                        ? 'bg-slate-600 text-slate-300'
                        : 'bg-blue-800 text-blue-200'
                    }`}>
                      {isCurrent ? 'CURRENT' : isPast ? 'PAST' : 'FUTURE'}
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
              <span className="text-[11px] font-mono flex items-center gap-1.5">
                <span className={isCurrentWeekLive ? 'text-emerald-400' : isTargetDatePast ? 'text-slate-400' : 'text-blue-300'}>
                  {targetSundayDate}
                </span>
                <span className={`font-black uppercase text-[9px] px-1.5 py-0.5 rounded ${
                  isCurrentWeekLive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : isTargetDatePast
                    ? 'bg-slate-700 text-slate-300'
                    : 'bg-blue-800/40 text-blue-200 border border-blue-700/40'
                }`}>
                  {isCurrentWeekLive ? '✓ CURRENT — Live Clock-In Active' : isTargetDatePast ? 'PAST — Read Only' : 'FUTURE — Not Yet Active'}
                </span>
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
            {sundayAccess.canManualAttendance && (isTargetDatePast || sundayAccess.isChangeModeActive) && (
              <button
                onClick={handleMarkAllRegisterPresent}
                className="px-3 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                <span>Mark All Filtered Present</span>
              </button>
            )}

            {sundayAccess.allowedActions.lockEntry && (
              <button
                onClick={handleLockEntry}
                disabled={isProcessingLockAction}
                className="px-3.5 py-2 bg-rose-900 hover:bg-rose-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                title="Lock historical attendance to prevent accidental changes"
              >
                <Lock className="w-3.5 h-3.5 text-rose-300" />
                <span>Lock Entry</span>
              </button>
            )}

            {sundayAccess.isChangeModeActive && (
              <button
                onClick={handleCompleteChanges}
                disabled={isProcessingLockAction}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition cursor-pointer animate-pulse"
                title="Finalize corrections and automatically lock again"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-300" />
                <span>Changes Done (Lock Again)</span>
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
          {/* Security & Lock Status Banners for Sunday Register */}
          {sundayAccess.status === 'PAST_MANUALLY_LOCKED' && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-rose-600 text-white rounded-2xl shrink-0 mt-0.5 shadow-xs">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-900">
                      Week {selectedWeek} Historical Attendance Locked
                    </span>
                    <span className="px-2 py-0.5 bg-rose-200 text-rose-900 rounded-full text-[10px] font-black uppercase">
                      Audit Protected
                    </span>
                  </div>
                  <p className="text-xs text-rose-800 leading-relaxed max-w-2xl">
                    Historical attendance for Sunday Week {selectedWeek} ({targetSundayDate}) has been locked to prevent accidental modifications. To make corrections, submit a formal change request with an audit justification.
                  </p>
                  {activeSundayChangeRequest?.status === 'PENDING' && (
                    <div className="mt-2 p-2.5 bg-amber-100/80 border border-amber-300 rounded-xl text-xs text-amber-950">
                      <span className="font-bold">Pending Change Request:</span> "{activeSundayChangeRequest.reason}" (by {activeSundayChangeRequest.requestedBy})
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeSundayChangeRequest?.status === 'PENDING' ? (
                  <button
                    type="button"
                    onClick={handleApproveChangeRequest}
                    disabled={isProcessingLockAction}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-sm transition flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Unlock for Changes</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowChangeRequestModal(true)}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-sm transition flex items-center gap-2 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4 text-amber-300" />
                    <span>Request Changes</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {sundayAccess.status === 'PAST_CHANGE_REQUEST_APPROVED' && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl shrink-0 mt-0.5 shadow-xs">
                  <Sparkles className="w-5 h-5 text-slate-950 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-950">
                      Changes Mode Active — Week {selectedWeek}
                    </span>
                    <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full text-[10px] font-black uppercase">
                      Unlocked for Corrections
                    </span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed max-w-2xl">
                    Authorized corrections are currently enabled for this past Sunday session. Modify worker attendance in the register below, then click <strong>Changes Done (Lock Again)</strong> to automatically seal this week again.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCompleteChanges}
                disabled={isProcessingLockAction}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-2 cursor-pointer shrink-0 animate-pulse"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-300" />
                <span>Changes Done (Lock Again)</span>
              </button>
            </div>
          )}

          {sundayAccess.status === 'BEFORE_WINDOW_LOCKED' && (
            <div className="bg-amber-500/10 border border-amber-400/50 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>Manual Attendance Locked Before Window:</strong> Sunday terminal and manual register will open at {config.sundayOpenTime || '07:00'} WAT today. Manual attendance cannot open before the clock-in terminal opens.
                </span>
              </div>
            </div>
          )}

          {sundayAccess.status === 'FUTURE_LOCKED' && (
            <div className="bg-slate-100 border border-slate-300 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-slate-700">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                <span>
                  <strong>Future Week Automatically Locked:</strong> Sunday Service for Week {selectedWeek} is scheduled for {targetSundayDate}. Attendance cannot be recorded before this date arrives.
                </span>
              </div>
            </div>
          )}

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
          <div className="bg-white border border-slate-200 rounded-3xl p-3 sm:p-6 shadow-xs space-y-4">
            <div className="space-y-3 md:hidden" aria-label="Sunday quick attendance cards">
              {filteredRegisterWorkers.map(worker => {
                const rec = sundayAttendanceMap.get(worker.id);
                const currentStatus = rec ? rec.status : 'ABSENT';
                return (
                  <article key={worker.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-black text-slate-900">{worker.fullName}</h3><p className="truncate text-[10px] font-bold text-slate-500">{worker.department} · {rec?.clockInTime || 'No clock-in'}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black ${currentStatus === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' : currentStatus === 'LATE' ? 'bg-amber-100 text-amber-800' : currentStatus === 'EXCUSED' ? 'bg-blue-100 text-blue-800' : 'bg-red-50 text-red-700'}`}>{currentStatus}</span></div>
                    <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-white p-1">
                      {(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] as const).map(status => {
                        const activeClass = status === 'PRESENT' ? 'bg-emerald-700' : status === 'LATE' ? 'bg-amber-600' : status === 'ABSENT' ? 'bg-red-700' : 'bg-blue-700';
                        return <button key={status} type="button" disabled={!sundayAccess.canManualAttendance} onClick={() => handleSetRegisterStatus(worker, status)} className={`min-h-10 rounded-lg px-1 text-[8px] font-black text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${currentStatus === status ? activeClass : 'bg-slate-300'}`}>{status === 'PRESENT' ? 'Present' : status === 'LATE' ? 'Late' : status === 'ABSENT' ? 'Absent' : 'Excused'}</button>;
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
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
                                disabled={!sundayAccess.canManualAttendance}
                                onClick={() => handleSetRegisterStatus(worker, 'PRESENT')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                  currentStatus === 'PRESENT'
                                    ? 'bg-emerald-700 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-900'
                                }`}
                              >
                                Present
                              </button>

                              <button
                                type="button"
                                disabled={!sundayAccess.canManualAttendance}
                                onClick={() => handleSetRegisterStatus(worker, 'LATE')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                  currentStatus === 'LATE'
                                    ? 'bg-amber-600 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-900'
                                }`}
                              >
                                Late
                              </button>

                              <button
                                type="button"
                                disabled={!sundayAccess.canManualAttendance}
                                onClick={() => handleSetRegisterStatus(worker, 'ABSENT')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                  currentStatus === 'ABSENT'
                                    ? 'bg-rose-700 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-rose-100 hover:text-rose-900'
                                }`}
                              >
                                Absent
                              </button>

                              <button
                                type="button"
                                disabled={!sundayAccess.canManualAttendance}
                                onClick={() => handleSetRegisterStatus(worker, 'EXCUSED')}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
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
                      {sundayAccess.badgeLabel.toUpperCase()}
                    </span>
                  </h3>
                  <p className="text-xs text-amber-900/90 leading-relaxed max-w-2xl">
                    {sundayAccess.lockReason || `Worker Sunday clock-in is strictly scheduled for Sundays from ${config.sundayOpenTime || '07:00 AM'} to ${config.sundayCloseTime || '11:30 AM'}.`} Current time: <strong>{currentTimeStr}</strong>.
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

          {/* Week Lock Banner — shown in Terminal when selected week is not the live current week */}
          {!isCurrentWeekLive && (
            <div className={`border-2 rounded-2xl p-4 flex items-start gap-3 shadow-sm ${
              isTargetDatePast
                ? 'bg-slate-50 border-slate-300'
                : 'bg-blue-50 border-blue-300'
            }`}>
              <div className={`p-2.5 rounded-xl shrink-0 ${isTargetDatePast ? 'bg-slate-300 text-slate-700' : 'bg-blue-300 text-blue-900'}`}>
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`text-sm font-black flex items-center gap-2 ${isTargetDatePast ? 'text-slate-800' : 'text-blue-900'}`}>
                  Week {selectedWeek} — {isTargetDatePast ? 'Past Date — Clock-In Locked' : 'Future Date — Not Yet Active'}
                </h3>
                <p className={`text-xs mt-0.5 leading-relaxed max-w-2xl ${isTargetDatePast ? 'text-slate-600' : 'text-blue-800'}`}>
                  {isTargetDatePast
                    ? `This Sunday (${targetSundayDate}) has already passed. Live clock-in is disabled. To correct attendance for this week, use the Sunday Attendance Register (Read-Only corrections tab).`
                    : `This Sunday (${targetSundayDate}) has not yet arrived. Live clock-in will only become available on that day.`
                  }
                  {' '}Switch to <strong>Week {calendarCurrentWeek}</strong> to clock in today's attendance.
                </p>
              </div>
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
              <div className="bg-white border border-slate-200 rounded-3xl p-3 sm:p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-2 py-1">
                  <span>{matchingWorkers.length} waiting to clock in</span>
                  <span className="hidden sm:inline">Completed names disappear automatically</span>
                </div>

                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {matchingWorkers.length === 0 && (
                    <div className="rounded-2xl bg-emerald-50 p-6 text-center text-sm font-black text-emerald-800">
                      Everyone in this view has clocked in.
                    </div>
                  )}
                  {matchingWorkers.map(w => {
                    const comp = calculateWorkerProfileCompleteness(w);

                    return (
                      <div
                        key={w.id}
                        className="py-3.5 px-2 sm:px-3 hover:bg-blue-50/60 rounded-2xl transition flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 text-base truncate">{w.fullName}</span>
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

                        <button
                          onClick={() => processWorkerClockIn(w, 'NAME_SEARCH')}
                          className="min-h-12 shrink-0 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">Clock In <ArrowRight className="w-4 h-4" /></span>
                        </button>
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
                  All ({availableWorkersList.length})
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
                    {dept} ({availableWorkersList.filter(w => w.department === dept).length})
                  </button>
                ))}
              </div>

              {/* Department Worker Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {matchingWorkers.length === 0 && <div className="sm:col-span-2 md:col-span-3 rounded-2xl bg-emerald-50 p-6 text-center text-sm font-black text-emerald-800">Everyone in this department has clocked in.</div>}
                {matchingWorkers.map(w => {
                  return (
                    <div
                      key={w.id}
                      className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="font-black text-slate-900 text-base truncate">{w.fullName}</div>
                        <div className="text-xs text-slate-500 font-semibold">{w.department}</div>
                        <div className="text-[11px] text-slate-400 mt-1">{w.duty || w.categories[0] || 'Worker'}</div>
                      </div>

                      <button
                        onClick={() => processWorkerClockIn(w, 'DEPT_QUICK_ACCESS')}
                        className="min-h-12 w-full rounded-2xl bg-emerald-700 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 cursor-pointer"
                      >
                        Clock In
                      </button>
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

      {/* Sunday Request Changes Modal */}
      {showChangeRequestModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs"
          onClick={() => setShowChangeRequestModal(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider text-white">
                    Request Attendance Changes
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Sunday Morning Service • Week {selectedWeek}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChangeRequestModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitChangeRequest} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed text-[11px]">
                <strong>Audit Integrity Notice:</strong> Historical attendance for Sunday Week {selectedWeek} is finalized and locked. Submitting this request creates an audit trail entry. An authorized coordinator can then approve and enter Changes Mode.
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Requester Name / Title *
                </label>
                <input
                  type="text"
                  value={changeRequestRequester}
                  onChange={(e) => setChangeRequestRequester(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason for Requesting Changes *
                </label>
                <textarea
                  rows={3}
                  value={changeRequestReason}
                  onChange={(e) => setChangeRequestReason(e.target.value)}
                  placeholder="e.g. Worker was present on sound duty but omitted from register..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowChangeRequestModal(false)}
                  className="px-3 py-2 text-slate-600 hover:text-slate-800 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingLockAction}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isProcessingLockAction ? 'Submitting...' : 'Submit Request'}
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
