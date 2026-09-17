import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  WorkerProfile,
  SpecialWorkersEvent,
  SpecialEventAttendanceRecord,
  SpecialEventType,
  SpecialEventDaySchedule
} from '../../types';
import {
  getAllSpecialEvents,
  saveSpecialEvent,
  deleteSpecialEvent,
  getAllSpecialEventAttendance,
  recordSpecialEventAttendance,
  recordBulkSpecialEventAttendance,
  deleteSpecialEventAttendance
} from '../../db/indexedDB';
import {
  Calendar, Clock, Plus, Trash2, Edit3, CheckCircle2,
  Users, QrCode, Search, Printer, Download, Sparkles,
  ArrowRight, ShieldCheck, X, AlertTriangle, Filter, Check,
  Camera, Volume2, VolumeX, Eye, Lock, Archive, Award, Star
} from 'lucide-react';
import { GofamintLogo } from '../GofamintLogo';
import jsQR from 'jsqr';
import confetti from 'canvas-confetti';

function getDayLabelFromDate(dateStr: string): string {
  if (!dateStr) return 'Sunday';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m, d, 12, 0, 0);
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return daysOfWeek[dt.getDay()] || 'Sunday';
  }
  const dt = new Date(dateStr);
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return !isNaN(dt.getTime()) ? daysOfWeek[dt.getDay()] : 'Sunday';
}

interface SpecialEventsViewProps {
  workers: WorkerProfile[];
  departmentsList?: string[];
  onViewQrPass?: (worker: WorkerProfile) => void;
}

export const SpecialEventsView: React.FC<SpecialEventsViewProps> = ({
  workers,
  departmentsList = []
}) => {
  const [events, setEvents] = useState<SpecialWorkersEvent[]>([]);
  const [attendance, setAttendance] = useState<SpecialEventAttendanceRecord[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'LIST' | 'TERMINAL' | 'REGISTER'>('LIST');
  const [eventArchiveTab, setEventArchiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [adminTestOverride, setAdminTestOverride] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Deletion Confirmation States (In-UI modals to avoid iframe window.confirm issues)
  const [eventToDelete, setEventToDelete] = useState<SpecialWorkersEvent | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<SpecialEventAttendanceRecord | null>(null);
  const [clockInLockModal, setClockInLockModal] = useState<{
    workerName: string;
    openTime: string;
    programTime: string;
    statusText: string;
  } | null>(null);

  // Modal State for Create / Edit Event
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SpecialWorkersEvent | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState<SpecialEventType>('WORKERS_TRAINING');
  const [customTypeName, setCustomTypeName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'UPCOMING' | 'ACTIVE' | 'CONCLUDED'>('ACTIVE');
  const [daySchedules, setDaySchedules] = useState<SpecialEventDaySchedule[]>([]);

  // Safely derive departments list with fallbacks
  const derivedDepartments = useMemo(() => {
    if (departmentsList && departmentsList.length > 0) {
      return departmentsList;
    }
    const deptsFromWorkers = Array.from(new Set(workers.map(w => w.department).filter(Boolean)));
    if (deptsFromWorkers.length > 0) {
      return deptsFromWorkers;
    }
    return ['Pastoral', 'Sunday School', 'Choir', 'Ushering', 'Sanctuary', 'Media & IT', 'Evangelism', 'Children / Teens', 'Intercessory'];
  }, [departmentsList, workers]);

  // Terminal State
  const [terminalMethod, setTerminalMethod] = useState<'NAME_SEARCH' | 'QR_SCAN' | 'DEPT_LIST'>('NAME_SEARCH');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [celebrationWorker, setCelebrationWorker] = useState<{
    worker: WorkerProfile;
    record: SpecialEventAttendanceRecord;
  } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    worker: WorkerProfile;
    existing: SpecialEventAttendanceRecord;
  } | null>(null);

  // Terminal Camera
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastScannedTokenRef = useRef<{ token: string; time: number } | null>(null);

  // Load the authoritative local/cloud-backed event stores. The generic
  // database layer already provides durable fallback storage; a second custom
  // backup previously resurrected events after they were deleted.
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      // One server request returns both events and attendance; the event loader
      // refreshes both local stores before the attendance read below.
      const allEvts = await getAllSpecialEvents(true);
      const allAtt = await getAllSpecialEventAttendance(false);

      setEvents(allEvts);
      setAttendance(allAtt);
      if (allEvts.length > 0 && !selectedEventId) {
        setSelectedEventId(allEvts[0].id);
        if (allEvts[0].daySchedules.length > 0) {
          setSelectedDate(allEvts[0].daySchedules[0].date);
        }
      }
    } catch (err) {
      console.error('Error loading special events:', err);
      setLoadError(err instanceof Error ? err.message : 'Special events could not be loaded from the central database.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Active vs Archived events (Complaint 6)
  const activeEvents = useMemo(() => {
    return events.filter(e => e.status !== 'ARCHIVED' && !e.isArchived);
  }, [events]);

  const archivedEvents = useMemo(() => {
    return events.filter(e => e.status === 'ARCHIVED' || e.isArchived);
  }, [events]);

  const displayedEvents = eventArchiveTab === 'ACTIVE' ? activeEvents : archivedEvents;

  const activeEvent = useMemo(() => {
    return events.find(e => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // Toggle Archive Status (Complaint 6)
  const handleToggleArchiveEvent = async (evt: SpecialWorkersEvent) => {
    const isArchived = evt.status === 'ARCHIVED' || evt.isArchived;
    const updated: SpecialWorkersEvent = {
      ...evt,
      status: isArchived ? 'ACTIVE' : 'ARCHIVED',
      isArchived: !isArchived,
      archivedAt: !isArchived ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString()
    };

    try {
      await saveSpecialEvent(updated);
      setEvents(events.map(e => e.id === evt.id ? updated : e));
      setSelectedEventId(evt.id);
      setEventArchiveTab(isArchived ? 'ACTIVE' : 'ARCHIVED');
    } catch (error: any) {
      console.error('Failed to change the special event archive status:', error);
      alert(`Could not ${isArchived ? 'restore' : 'archive'} the event: ${error?.message || 'Unknown error'}`);
    }
  };

  // Toggle Inclusion in Punctuality Honors (Complaint 6 & 7)
  const handleToggleIncludeInHonors = async (evt: SpecialWorkersEvent) => {
    const updated: SpecialWorkersEvent = {
      ...evt,
      includeInPunctualityHonors: !evt.includeInPunctualityHonors,
      updatedAt: new Date().toISOString()
    };

    try {
      await saveSpecialEvent(updated);
      setEvents(events.map(e => e.id === evt.id ? updated : e));
    } catch (error: any) {
      console.error('Failed to change event honors inclusion:', error);
      alert(`Could not update punctuality honors: ${error?.message || 'Unknown error'}`);
    }
  };

  // If activeEvent changes and selectedDate is not in daySchedules, adjust selectedDate
  useEffect(() => {
    if (activeEvent && activeEvent.daySchedules.length > 0) {
      const dates = activeEvent.daySchedules.map(d => d.date);
      if (!dates.includes(selectedDate)) {
        setSelectedDate(dates[0]);
      }
    }
  }, [activeEvent, selectedDate]);

  const activeDaySchedule = useMemo(() => {
    if (!activeEvent) return null;
    return activeEvent.daySchedules.find(d => d.date === selectedDate) || activeEvent.daySchedules[0] || null;
  }, [activeEvent, selectedDate]);

  const activeAttendanceForDay = useMemo(() => {
    if (!selectedEventId || !selectedDate) return [];
    return attendance.filter(a => a.eventId === selectedEventId && a.date === selectedDate);
  }, [attendance, selectedEventId, selectedDate]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setEditingEvent(null);
    setEventName('');
    setEventType('WORKERS_TRAINING');
    setCustomTypeName('');
    setStartDate(today);
    setEndDate(today);
    setVenue('National / Regional Camp / Church Auditorium');
    setDescription('');
    setStatus('ACTIVE');
    const initialDayLabel = getDayLabelFromDate(today);
    setDaySchedules([
      {
        date: today,
        dayLabel: initialDayLabel,
        programStartTime: '17:00',
        clockInOpenTime: '16:00',
        notes: 'Session Opening & Keynote'
      }
    ]);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (evt: SpecialWorkersEvent) => {
    setEditingEvent(evt);
    setEventName(evt.name);
    setEventType(evt.eventType);
    setCustomTypeName(evt.customTypeName || '');
    setStartDate(evt.startDate);
    setEndDate(evt.endDate);
    setVenue(evt.venue || '');
    setDescription(evt.description || '');
    setStatus(evt.status);
    setDaySchedules(evt.daySchedules || []);
    setIsModalOpen(true);
  };

  // Add Day Schedule helper
  const handleAddDaySchedule = () => {
    const baseDate = daySchedules.length > 0
      ? daySchedules[daySchedules.length - 1].date
      : (endDate || startDate || new Date().toISOString().split('T')[0]);
    const parts = baseDate.split('-');
    let nextDateStr = baseDate;
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dt = new Date(y, m, d + 1, 12, 0, 0);
      const yStr = dt.getFullYear();
      const mStr = String(dt.getMonth() + 1).padStart(2, '0');
      const dStr = String(dt.getDate()).padStart(2, '0');
      nextDateStr = `${yStr}-${mStr}-${dStr}`;
    }
    const dayLabel = getDayLabelFromDate(nextDateStr);

    setDaySchedules([
      ...daySchedules,
      {
        date: nextDateStr,
        dayLabel,
        programStartTime: '09:00',
        clockInOpenTime: '08:00',
        notes: `Day ${daySchedules.length + 1} Session`
      }
    ]);
  };

  const handleRemoveDaySchedule = (index: number) => {
    setDaySchedules(daySchedules.filter((_, i) => i !== index));
  };

  const handleUpdateDaySchedule = (index: number, field: keyof SpecialEventDaySchedule, value: string) => {
    const updated = [...daySchedules];
    if (field === 'date') {
      const autoDayLabel = getDayLabelFromDate(value);
      updated[index] = { ...updated[index], date: value, dayLabel: autoDayLabel };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setDaySchedules(updated);
  };

  // Save Event
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim()) {
      alert('Please enter an event name.');
      return;
    }
    if (daySchedules.length === 0) {
      alert('Please add at least one day schedule for this event.');
      return;
    }

    const newEvent: SpecialWorkersEvent = {
      id: editingEvent ? editingEvent.id : `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: eventName.trim(),
      eventType,
      customTypeName: eventType === 'OTHER_COMPULSORY_EVENT' ? customTypeName : undefined,
      startDate: startDate || daySchedules[0].date,
      endDate: endDate || daySchedules[daySchedules.length - 1].date,
      venue: venue.trim(),
      description: description.trim(),
      daySchedules,
      status,
      createdAt: editingEvent ? editingEvent.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      setIsSavingEvent(true);
      await saveSpecialEvent(newEvent);
      await loadData();
      setSelectedEventId(newEvent.id);
      setSelectedDate(newEvent.daySchedules[0]?.date || '');
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save special event:', err);
      alert('Failed to save event: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSavingEvent(false);
    }
  };

  // Delete Event handler - triggers in-UI modal
  const handlePromptDeleteEvent = (evt: SpecialWorkersEvent) => {
    setEventToDelete(evt);
  };

  const handleConfirmDeleteEvent = async () => {
    if (!eventToDelete) return;
    const id = eventToDelete.id;
    try {
      await deleteSpecialEvent(id);
      const allEvts = await getAllSpecialEvents();
      const allAtt = await getAllSpecialEventAttendance();
      setEvents(allEvts);
      setAttendance(allAtt);

      if (selectedEventId === id || !allEvts.some(e => e.id === selectedEventId)) {
        if (allEvts.length > 0) {
          setSelectedEventId(allEvts[0].id);
          setSelectedDate(allEvts[0].daySchedules?.[0]?.date || '');
        } else {
          setSelectedEventId(null);
          setSelectedDate('');
          setViewMode('LIST');
        }
      }
    } catch (err) {
      console.error('Failed to delete special event:', err);
      alert(`Could not delete the event: ${(err as any)?.message || 'Unknown error'}`);
    } finally {
      setEventToDelete(null);
    }
  };

  // Check if clock-in is currently open/allowed based on clockInOpenTime
  const clockInStatus = useMemo(() => {
    if (!activeDaySchedule) {
      return { allowed: true, isEarly: false, statusText: 'Session Open' };
    }

    const openTimeStr = activeDaySchedule.clockInOpenTime || '08:00';
    const progStartStr = activeDaySchedule.programStartTime || '09:00';

    const todayStr = new Date().toISOString().split('T')[0];
    // If viewing past/future day
    if (selectedDate !== todayStr) {
      if (selectedDate < todayStr) {
        return { allowed: true, isEarly: false, statusText: `Historical Day (${selectedDate})` };
      }
      return { 
        allowed: false, 
        isEarly: true, 
        statusText: `Upcoming Session • Opens ${selectedDate} at ${openTimeStr}` 
      };
    }

    // Same day: check current time vs clockInOpenTime
    const now = new Date();
    const [oH, oM] = openTimeStr.split(':').map(Number);
    const openTime = new Date(now);
    openTime.setHours(oH, oM, 0, 0);

    if (now < openTime) {
      return {
        allowed: false,
        isEarly: true,
        statusText: `Session Opens at ${openTimeStr} (Program Starts: ${progStartStr})`
      };
    }

    return {
      allowed: true,
      isEarly: false,
      statusText: `Clock-In Open (Since ${openTimeStr} • Program: ${progStartStr})`
    };
  }, [activeDaySchedule, selectedDate]);

  // Process Clock-In for a worker
  const handleClockInWorker = async (
    worker: WorkerProfile,
    method: 'NAME_SEARCH' | 'QR_SCAN' | 'DEPT_LIST' | 'MANUAL'
  ) => {
    if (!activeEvent || !selectedDate) {
      return;
    }

    // STRICT RULE: No clock-in or marking present until clockInOpenTime unless Admin Test Mode is ON
    if (!clockInStatus.allowed) {
      setClockInLockModal({
        workerName: worker.fullName,
        openTime: activeDaySchedule?.clockInOpenTime || '08:00',
        programTime: activeDaySchedule?.programStartTime || '09:00',
        statusText: clockInStatus.statusText
      });
      return;
    }

    // Check duplicate
    const existing = attendance.find(
      a => a.eventId === activeEvent.id && a.date === selectedDate && a.workerId === worker.id
    );
    if (existing) {
      setDuplicateWarning({ worker, existing });
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Determine status (Punctual vs Late) based on schedule programStartTime
    let isLate = false;
    if (activeDaySchedule?.programStartTime) {
      const [pHour, pMin] = activeDaySchedule.programStartTime.split(':').map(Number);
      const programStart = new Date(now);
      programStart.setHours(pHour, pMin, 0, 0);
      if (now > programStart) {
        isLate = true;
      }
    }

    const record: SpecialEventAttendanceRecord = {
      id: `${worker.id}_${activeEvent.id}_${selectedDate}`,
      workerId: worker.id,
      workerName: worker.fullName,
      department: worker.department,
      eventId: activeEvent.id,
      eventName: activeEvent.name,
      date: selectedDate,
      clockInTime: timeStr,
      timestamp: now.getTime(),
      status: isLate ? 'LATE' : 'PRESENT',
      method,
      createdAt: now.toISOString()
    };

    await recordSpecialEventAttendance(record);
    const updated = [...attendance.filter(a => a.id !== record.id), record];
    setAttendance(updated);

    // Audio chime & Confetti
    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.75 }
      });
    } catch (error) {
      console.debug('Special-event celebration effect was unavailable:', error);
    }

    setCelebrationWorker({ worker, record });
    setTimeout(() => {
      setCelebrationWorker(null);
    }, 4000);
  };

  // QR Scanner logic for Terminal
  const scanQrFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || terminalMethod !== 'QR_SCAN') return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        try {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data) {
            const token = code.data.trim();
            const now = Date.now();

            if (
              !lastScannedTokenRef.current ||
              lastScannedTokenRef.current.token !== token ||
              now - lastScannedTokenRef.current.time > 4000
            ) {
              lastScannedTokenRef.current = { token, time: now };
              // Find worker
              const matchedWorker = workers.find(
                w => w.qrCodeToken === token || w.id === token || w.phone === token
              );
              if (matchedWorker) {
                handleClockInWorker(matchedWorker, 'QR_SCAN');
              }
            }
          }
        } catch (err) {
          console.warn('QR frame scan catch:', err);
        }
      }
    }

    animationFrameId.current = requestAnimationFrame(scanQrFrame);
  }, [terminalMethod, workers, activeEvent, selectedDate, attendance]);

  useEffect(() => {
    if (viewMode === 'TERMINAL' && terminalMethod === 'QR_SCAN') {
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            animationFrameId.current = requestAnimationFrame(scanQrFrame);
          }
        })
        .catch(err => {
          console.warn('Camera access error:', err);
        });

      return () => {
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(t => t.stop());
        }
      };
    }
  }, [viewMode, terminalMethod, scanQrFrame]);

  // Active non-archived workers sorted alphabetically
  const activeWorkersList = useMemo(() => {
    return workers
      .filter(w => w.status === 'ACTIVE')
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [workers]);

  // Workers filtered for Name Search / Dept List in Terminal
  const matchingWorkers = useMemo(() => {
    if (terminalMethod === 'NAME_SEARCH') {
      let list = activeWorkersList;
      if (selectedDept !== 'ALL') {
        list = list.filter(w => w.department === selectedDept);
      }
      if (!searchQuery.trim()) {
        return list; // Return full active roster when search query is empty
      }
      const q = (searchQuery || '').toLowerCase();
      return list.filter(
        w => (w.fullName || '').toLowerCase().includes(q) || 
             (w.phone || '').includes(q) || 
             (w.department || '').toLowerCase().includes(q) ||
             (w.duty ? w.duty.toLowerCase().includes(q) : false)
      );
    }
    if (terminalMethod === 'DEPT_LIST') {
      if (selectedDept === 'ALL') return activeWorkersList;
      return activeWorkersList.filter(w => w.department === selectedDept);
    }
    return [];
  }, [terminalMethod, searchQuery, selectedDept, activeWorkersList]);

  // Export attendance CSV
  const handleExportCsv = () => {
    if (!activeEvent) return;
    const rows = [
      ['Special Event Attendance Report'],
      ['Event Name', activeEvent.name],
      ['Date', selectedDate],
      ['Venue', activeEvent.venue || 'N/A'],
      [],
      ['S/N', 'Full Name', 'Department', 'Duty / Role', 'Clock-in Time', 'Status', 'Method']
    ];

    workers.forEach((w, idx) => {
      const rec = activeAttendanceForDay.find(a => a.workerId === w.id);
      rows.push([
        String(idx + 1),
        w.fullName,
        w.department,
        w.duty || w.categories.join(', '),
        rec ? rec.clockInTime : '—',
        rec ? rec.status : 'ABSENT',
        rec ? rec.method : '—'
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(cell => `"${cell}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GOFAMINT_HOF_Special_Event_${activeEvent.name.replace(/\s+/g, '_')}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {loadError && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          Special Events synchronization failed: {loadError}
        </div>
      )}
      
      {/* Top Header Banner */}
      <div className="bg-linear-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-amber-400/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 border border-amber-400/40 rounded-full text-xs font-black text-amber-300 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Dedicated Directorate Module</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black font-['Cinzel',serif] tracking-wide text-white">
              Special Workers Training & Events
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Manage specialized events including Workers Training Sessions, New Session Retreats, Strategic Meetings, and Compulsory Programs with independent multi-day clock-in terminals and real-time attendance registers.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Special Event</span>
            </button>
          </div>
        </div>
      </div>

      {/* Events Selector Bar & View Mode Toggle */}
      {events.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Event Selector */}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-900" />
                <span>Active Event:</span>
              </label>
              <select
                value={selectedEventId || ''}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  const found = events.find(ev => ev.id === e.target.value);
                  if (found && found.daySchedules.length > 0) {
                    setSelectedDate(found.daySchedules[0].date);
                  }
                }}
                className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-blue-950 focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
              >
                {events.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.status})
                  </option>
                ))}
              </select>

              {/* Day Selector if multi-day */}
              {activeEvent && activeEvent.daySchedules.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">•</span>
                  <label className="text-xs font-bold text-slate-600">Day / Session:</label>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-blue-950"
                  >
                    {activeEvent.daySchedules.map((d, i) => (
                      <option key={d.date} value={d.date}>
                        {d.dayLabel} ({d.date}) — {d.programStartTime || 'Session'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Event Quick Actions (Archive / Honors / Edit / Delete) */}
              {activeEvent && (
                <div className="flex items-center gap-1.5 pl-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleToggleArchiveEvent(activeEvent)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                      activeEvent.isArchived || activeEvent.status === 'ARCHIVED'
                        ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                    title={activeEvent.isArchived ? "Restore Event from Archive" : "Archive event and its attendance records"}
                  >
                    <Archive className="w-3.5 h-3.5 text-amber-700" />
                    <span>{activeEvent.isArchived || activeEvent.status === 'ARCHIVED' ? 'Restore' : 'Archive'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleIncludeInHonors(activeEvent)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                      activeEvent.includeInPunctualityHonors
                        ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title="Include this event in Special Event Punctuality Honors"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-700" />
                    <span>{activeEvent.includeInPunctualityHonors ? '✓ Added to Honors' : 'Add to Honors'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(activeEvent)}
                    className="p-1.5 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    title="Edit Active Event"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePromptDeleteEvent(activeEvent)}
                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    title="Delete Active Event"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('LIST')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'LIST' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Events
              </button>
              <button
                onClick={() => setViewMode('TERMINAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  viewMode === 'TERMINAL' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 text-amber-300" />
                <span>Live Terminal</span>
              </button>
              <button
                onClick={() => setViewMode('REGISTER')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  viewMode === 'REGISTER' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-amber-300" />
                <span>Attendance Register</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ----------------- VIEW 1: EVENTS OVERVIEW & LIST ----------------- */}
      {viewMode === 'LIST' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setEventArchiveTab('ACTIVE')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                  eventArchiveTab === 'ACTIVE'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active Events ({activeEvents.length})
              </button>
              <button
                onClick={() => setEventArchiveTab('ARCHIVED')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                  eventArchiveTab === 'ARCHIVED'
                    ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Archived Events ({archivedEvents.length})
              </button>
            </div>

            <span className="text-xs text-slate-500 font-medium">
              {eventArchiveTab === 'ACTIVE'
                ? 'Showing active training & compulsory events'
                : 'Archived events preserve all attendance and punctuality data permanently'}
            </span>
          </div>

          {displayedEvents.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-900 rounded-2xl flex items-center justify-center mx-auto">
                <Calendar className="w-8 h-8 text-blue-900" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">
                  {eventArchiveTab === 'ACTIVE' ? 'No Active Special Events Found' : 'No Archived Events Yet'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {eventArchiveTab === 'ACTIVE'
                    ? 'Create a new special training session, retreat, or meeting to start tracking independent attendance with live terminals.'
                    : 'Once an event is concluded, archive it to keep your active dashboard focused while retaining historical records.'}
                </p>
              </div>
              {eventArchiveTab === 'ACTIVE' && (
                <button
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Create First Special Event</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedEvents.map(evt => {
                const isSelected = evt.id === selectedEventId;
                const evtAttendance = attendance.filter(a => a.eventId === evt.id);
                const uniqueAttendees = new Set(evtAttendance.map(a => a.workerId)).size;

                return (
                  <div
                    key={evt.id}
                    className={`bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md ${
                      isSelected ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-slate-200'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-black uppercase rounded-md tracking-wider">
                          {evt.eventType.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {evt.includeInPunctualityHonors && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-[9px] font-bold flex items-center gap-1">
                              <Award className="w-3 h-3 text-amber-600" />
                              <span>Honors</span>
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            evt.status === 'ARCHIVED' || evt.isArchived
                              ? 'bg-slate-200 text-slate-800'
                              : evt.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : evt.status === 'UPCOMING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {evt.status === 'ARCHIVED' || evt.isArchived ? 'ARCHIVED' : evt.status}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                          {evt.name}
                        </h3>
                        {evt.venue && (
                          <p className="text-xs text-slate-500 pt-0.5">
                            📍 {evt.venue}
                          </p>
                        )}
                      </div>

                      {evt.description && (
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {evt.description}
                        </p>
                      )}

                      {/* Day Schedules breakdown */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5 text-xs">
                        <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">
                          Schedule ({evt.daySchedules?.length || 0} Sessions)
                        </span>
                        <div className="space-y-1">
                          {evt.daySchedules?.map((d, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px] text-slate-700">
                              <span><strong>{d.dayLabel}</strong> ({d.date})</span>
                              <span className="font-mono text-blue-900 font-bold">{d.programStartTime || '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Quick Stat */}
                      <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                        <span>Total Workers Clocked In:</span>
                        <span className="font-black text-emerald-700">{uniqueAttendees} / {workers.length}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleArchiveEvent(evt)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer ${
                            evt.isArchived || evt.status === 'ARCHIVED'
                              ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                          title={evt.isArchived ? "Restore to Active" : "Archive Event and retain attendance records"}
                        >
                          <Archive className="w-3 h-3" />
                          <span>{evt.isArchived || evt.status === 'ARCHIVED' ? 'Restore' : 'Archive'}</span>
                        </button>

                        <button
                          onClick={() => handleToggleIncludeInHonors(evt)}
                          className={`px-2 py-1 text-[11px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer ${
                            evt.includeInPunctualityHonors
                              ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title="Toggle inclusion in Special Event Punctuality Honors"
                        >
                          <Award className="w-3 h-3" />
                          <span>{evt.includeInPunctualityHonors ? '✓ Honors' : '+ Honors'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSelectedEventId(evt.id);
                            if (evt.daySchedules && evt.daySchedules.length > 0) {
                              setSelectedDate(evt.daySchedules[0].date);
                            }
                            setViewMode('REGISTER');
                          }}
                          className="px-2.5 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          View Records
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(evt)}
                          className="p-1.5 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Edit Event"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePromptDeleteEvent(evt)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Delete Event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ----------------- VIEW 2: LIVE SPECIAL EVENT TERMINAL ----------------- */}
      {viewMode === 'TERMINAL' && !activeEvent && (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-12 text-center space-y-4 max-w-xl mx-auto">
          <div className="w-16 h-16 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
            <QrCode className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">No Event Selected</h3>
            <p className="text-xs text-slate-500">
              Please create or select a special event from the list to launch its live clock-in terminal.
            </p>
          </div>
          <button
            onClick={() => setViewMode('LIST')}
            className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer"
          >
            <span>Return to Events List</span>
          </button>
        </div>
      )}

      {viewMode === 'TERMINAL' && activeEvent && (
        <div className="space-y-6">
          
          {/* Terminal Banner */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 bg-amber-400/20 text-amber-300 rounded-md text-[10px] font-black uppercase tracking-wider border border-amber-400/30">
                  Event Live Clock-In Terminal
                </span>
                <span className="text-xs text-slate-400">
                  {activeEvent.name}
                </span>

                {/* Session Open / Locked Status Pill */}
                {clockInStatus.isEarly ? (
                  <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Locked Until {activeDaySchedule?.clockInOpenTime || '08:00'}</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Clock-In Active</span>
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black font-['Cinzel',serif]">
                {activeDaySchedule?.dayLabel || 'Session'} • {selectedDate}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                <span>Clock-In Opens: <strong>{activeDaySchedule?.clockInOpenTime || '08:00 AM'}</strong></span>
                <span>•</span>
                <span>Program Starts: <strong>{activeDaySchedule?.programStartTime || '09:00 AM'}</strong></span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Attendance Counter */}
              <div className="flex items-center gap-4 bg-slate-800/80 border border-slate-700 rounded-2xl p-3 px-5 text-center shrink-0">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Clocked In</span>
                  <span className="text-2xl font-black text-emerald-400">{activeAttendanceForDay.length}</span>
                </div>
                <div className="border-l border-slate-700 pl-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">On Time</span>
                  <span className="text-2xl font-black text-blue-300">
                    {activeAttendanceForDay.filter(a => a.status === 'PRESENT').length}
                  </span>
                </div>
                <div className="border-l border-slate-700 pl-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Late</span>
                  <span className="text-2xl font-black text-amber-400">
                    {activeAttendanceForDay.filter(a => a.status === 'LATE').length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Time Lock Warning Banner if clock-in is not yet open */}
          {!clockInStatus.allowed && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 bg-amber-200 text-amber-900 rounded-xl shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider">Clock-In Session Not Yet Open</h4>
                  <p className="text-xs text-amber-900 font-medium">
                    Clock-in opens at <strong>{activeDaySchedule?.clockInOpenTime || '08:00'}</strong> ahead of the program start time (<strong>{activeDaySchedule?.programStartTime || '09:00'}</strong>). Workers cannot clock in before this time.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setAdminTestOverride(true)}
                className="px-3.5 py-1.5 bg-amber-900 text-white rounded-xl text-xs font-bold shrink-0 hover:bg-amber-800 transition cursor-pointer"
              >
                Enable Test Rehearsal
              </button>
            </div>
          )}

          {/* Clock-In Method Switcher (Order: 1. Find & List Names, 2. QR Code, 3. Department) */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-300 max-w-xl mx-auto shadow-inner">
            <button
              onClick={() => setTerminalMethod('NAME_SEARCH')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                terminalMethod === 'NAME_SEARCH'
                  ? 'bg-blue-900 text-white shadow-md'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Search className="w-4 h-4 text-amber-400" />
              <span>1. Find & List Names</span>
            </button>

            <button
              onClick={() => setTerminalMethod('QR_SCAN')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                terminalMethod === 'QR_SCAN'
                  ? 'bg-blue-900 text-white shadow-md'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>2. QR Code Scanner</span>
            </button>

            <button
              onClick={() => setTerminalMethod('DEPT_LIST')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                terminalMethod === 'DEPT_LIST'
                  ? 'bg-blue-900 text-white shadow-md'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4 text-amber-400" />
              <span>3. Department</span>
            </button>
          </div>

          {/* Terminal Method 1: Find & List Names */}
          {terminalMethod === 'NAME_SEARCH' && (
            <div className="max-w-2xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-lg space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif] uppercase">
                  Find Your Name or Tap from Roster
                </h3>
                <p className="text-xs text-slate-500">
                  Search by name, phone, or simply tap your name from the complete roster below.
                </p>
              </div>

              <div className="relative">
                <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type full name, phone number, or department..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-bold text-blue-950 focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                  autoFocus
                />
              </div>

              {/* Department quick filter chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedDept('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                    selectedDept === 'ALL'
                      ? 'bg-blue-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({activeWorkersList.length})
                </button>
                {derivedDepartments.map(dept => {
                  const count = activeWorkersList.filter(w => w.department === dept).length;
                  return (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setSelectedDept(dept)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                        selectedDept === dept
                          ? 'bg-blue-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {dept} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Roster & Search Results */}
              <div className="space-y-2 max-h-96 overflow-y-auto pt-2">
                <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Showing {matchingWorkers.length} Active Workers</span>
                  {!searchQuery.trim() && <span>Full Roster (A–Z)</span>}
                </div>

                {searchQuery.trim() && matchingWorkers.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No active worker found matching "{searchQuery}".
                  </p>
                )}
                {matchingWorkers.map(w => {
                  const alreadyClocked = activeAttendanceForDay.some(a => a.workerId === w.id);
                  return (
                    <div
                      key={w.id}
                      className="p-3.5 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 transition"
                    >
                      <div>
                        <h4 className="text-sm font-black text-slate-900">{w.fullName}</h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="font-bold text-blue-900">{w.department}</span>
                          <span>•</span>
                          <span>{w.duty || w.categories[0] || 'Worker'}</span>
                        </div>
                      </div>

                      {alreadyClocked ? (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Clocked In</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleClockInWorker(w, 'NAME_SEARCH')}
                          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Clock In</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Terminal Method 2: QR Scanner */}
          {terminalMethod === 'QR_SCAN' && (
            <div className="max-w-2xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-lg text-center space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif] uppercase">
                  Hold QR ID Pass Before Camera
                </h3>
                <p className="text-xs text-slate-500">
                  Camera will scan and clock in the worker automatically.
                </p>
              </div>

              <div className="relative mx-auto w-full max-w-md aspect-square bg-slate-950 rounded-3xl overflow-hidden border-4 border-slate-900 shadow-2xl flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                <div className="absolute inset-8 border-2 border-amber-400/70 rounded-2xl pointer-events-none flex flex-col justify-between p-2">
                  <div className="flex justify-between">
                    <span className="w-4 h-4 border-t-2 border-l-2 border-amber-400" />
                    <span className="w-4 h-4 border-t-2 border-r-2 border-amber-400" />
                  </div>
                  <div className="flex justify-between">
                    <span className="w-4 h-4 border-b-2 border-l-2 border-amber-400" />
                    <span className="w-4 h-4 border-b-2 border-r-2 border-amber-400" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Terminal Method 3: Department List */}
          {terminalMethod === 'DEPT_LIST' && (
            <div className="max-w-3xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif] uppercase">
                    Department Quick Check-In
                  </h3>
                  <p className="text-xs text-slate-500">
                    Filter by department roster to clock in quickly.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-blue-950"
                  >
                    <option value="ALL">All Departments</option>
                    {derivedDepartments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pt-2">
                {matchingWorkers.map(w => {
                  const alreadyClocked = activeAttendanceForDay.some(a => a.workerId === w.id);
                  return (
                    <div
                      key={w.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2"
                    >
                      <div>
                        <h4 className="text-xs font-black text-slate-900">{w.fullName}</h4>
                        <span className="text-[10px] text-slate-500 font-semibold">{w.department} • {w.duty}</span>
                      </div>

                      {alreadyClocked ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-lg">
                          ✓ Done
                        </span>
                      ) : (
                        <button
                          onClick={() => handleClockInWorker(w, 'DEPT_LIST')}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition shrink-0 cursor-pointer"
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

      {/* ----------------- VIEW 3: ATTENDANCE REGISTER & REPORT ----------------- */}
      {viewMode === 'REGISTER' && activeEvent && (
        <div className="space-y-6">
          
          {/* Real-Time Live Banner in Register Section */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 bg-amber-400/20 text-amber-300 rounded-md text-[10px] font-black uppercase tracking-wider border border-amber-400/30">
                  Real-Time Event Register
                </span>
                <span className="text-xs text-slate-400">
                  {activeEvent.name}
                </span>

                {/* Session Open / Locked Status Pill */}
                {clockInStatus.isEarly ? (
                  <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Locked Until {activeDaySchedule?.clockInOpenTime || '08:00'}</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Clock-In Active</span>
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black font-['Cinzel',serif]">
                {activeDaySchedule?.dayLabel || 'Session'} • {selectedDate}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                <span>Clock-In Opens: <strong>{activeDaySchedule?.clockInOpenTime || '08:00 AM'}</strong></span>
                <span>•</span>
                <span>Program Starts: <strong>{activeDaySchedule?.programStartTime || '09:00 AM'}</strong></span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Attendance Counter */}
              <div className="flex items-center gap-4 bg-slate-800/80 border border-slate-700 rounded-2xl p-3 px-5 text-center shrink-0">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Clocked In</span>
                  <span className="text-2xl font-black text-emerald-400">{activeAttendanceForDay.length}</span>
                </div>
                <div className="border-l border-slate-700 pl-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">On Time</span>
                  <span className="text-2xl font-black text-blue-300">
                    {activeAttendanceForDay.filter(a => a.status === 'PRESENT').length}
                  </span>
                </div>
                <div className="border-l border-slate-700 pl-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Late</span>
                  <span className="text-2xl font-black text-amber-400">
                    {activeAttendanceForDay.filter(a => a.status === 'LATE').length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Time Lock Warning Banner if clock-in is not yet open */}
          {!clockInStatus.allowed && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 bg-amber-200 text-amber-900 rounded-xl shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider">Clock-In & Manual Mark Locked</h4>
                  <p className="text-xs text-amber-900 font-medium">
                    Scheduled to open at <strong>{activeDaySchedule?.clockInOpenTime || '08:00'}</strong> (Program starts at <strong>{activeDaySchedule?.programStartTime || '09:00'}</strong>). Marking present follows the clock-in time rule.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setAdminTestOverride(true)}
                className="px-3.5 py-1.5 bg-amber-900 text-white rounded-xl text-xs font-bold shrink-0 hover:bg-amber-800 transition cursor-pointer"
              >
                Enable Test Mode
              </button>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            {/* Header & Print / Export actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-black uppercase rounded-md tracking-wider">
                    Event Attendance Register
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {activeEvent.name}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 font-['Cinzel',serif]">
                  {activeDaySchedule?.dayLabel || 'Session'} • {selectedDate}
                </h2>
                {activeEvent.venue && (
                  <p className="text-xs text-slate-500">
                    Venue: {activeEvent.venue}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleExportCsv}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-300" />
                  <span>Print Register</span>
                </button>
              </div>
            </div>

            {/* Roster Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">S/N</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Worker Name</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Department</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Duty / Role</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Time Clocked</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Status</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Method</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {workers.map((w, idx) => {
                    const rec = activeAttendanceForDay.find(a => a.workerId === w.id);
                    return (
                      <tr key={w.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5 font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-3.5 font-black text-slate-900">{w.fullName}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-md font-bold text-[10px]">
                            {w.department}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-600">{w.duty || w.categories[0] || 'Worker'}</td>
                        <td className="p-3.5 font-mono text-slate-700 font-bold">
                          {rec ? rec.clockInTime : '—'}
                        </td>
                        <td className="p-3.5">
                          {rec ? (
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                              rec.status === 'PRESENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rec.status === 'LATE'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {rec.status}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                              ABSENT
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-[11px] text-slate-500">
                          {rec ? rec.method.replace('_', ' ') : '—'}
                        </td>
                        <td className="p-3.5 text-right">
                          {rec ? (
                            <button
                              onClick={async () => {
                                try {
                                  await deleteSpecialEventAttendance(rec.id);
                                  setAttendance(attendance.filter(a => a.id !== rec.id));
                                } catch (error: any) {
                                  console.error('Failed to remove special-event attendance:', error);
                                  alert(`Could not remove attendance: ${error?.message || 'Unknown error'}`);
                                }
                              }}
                              className="text-red-600 hover:text-red-800 text-[11px] font-bold cursor-pointer"
                            >
                              Remove
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleClockInWorker(w, 'MANUAL')}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                clockInStatus.allowed
                                  ? 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-xs'
                                  : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                              }`}
                              title={
                                clockInStatus.allowed
                                  ? 'Mark Present'
                                  : `Session locked until ${activeDaySchedule?.clockInOpenTime || '08:00'}. Click to view time-lock details.`
                              }
                            >
                              {!clockInStatus.allowed && <Lock className="w-3 h-3 text-amber-700" />}
                              <span>Mark Present</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- CREATE / EDIT SPECIAL EVENT MODAL ----------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black font-['Cinzel',serif]">
                  {editingEvent ? 'Edit Special Event' : 'Create New Special Event'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEvent} className="p-6 space-y-5">
              
              {/* Event Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Event Name *
                </label>
                <input
                  type="text"
                  required
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. 2026 Directorate Leadership & Workers Retreat"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-blue-950 focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
                />
              </div>

              {/* Event Type & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Event Type
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as SpecialEventType)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-blue-950"
                  >
                    <option value="WORKERS_TRAINING">Workers Training</option>
                    <option value="NEW_SESSION_WORKERS_TRAINING">New Session Workers Training</option>
                    <option value="WORKERS_RETREAT">Workers Retreat</option>
                    <option value="WORKERS_MEETING">Workers Meeting</option>
                    <option value="SPECIAL_WORKERS_PROGRAM">Special Workers Program</option>
                    <option value="OTHER_COMPULSORY_EVENT">Other Compulsory Event</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-blue-950"
                  >
                    <option value="ACTIVE">Active (Ongoing / Available)</option>
                    <option value="UPCOMING">Upcoming</option>
                    <option value="CONCLUDED">Concluded / Archived</option>
                  </select>
                </div>
              </div>

              {/* Venue & Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Venue / Location
                </label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. National Camp Auditorium / Regional Hall"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-blue-950"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Description / Instructions
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional details regarding prerequisites, materials, or special notes..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-blue-950"
                />
              </div>

              {/* Multi-Day Schedule Builder */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-900" />
                    <span>Multi-Day Session Schedules</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddDaySchedule}
                    className="px-2.5 py-1 bg-blue-100 text-blue-900 hover:bg-blue-200 text-[11px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Day</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {daySchedules.map((ds, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-blue-950">Session #{idx + 1}</span>
                        {daySchedules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDaySchedule(idx)}
                            className="text-red-500 hover:text-red-700 text-[11px] font-bold cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Date</label>
                          <input
                            type="date"
                            required
                            value={ds.date}
                            onChange={(e) => handleUpdateDaySchedule(idx, 'date', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Day Label</label>
                          <input
                            type="text"
                            required
                            value={ds.dayLabel}
                            onChange={(e) => handleUpdateDaySchedule(idx, 'dayLabel', e.target.value)}
                            placeholder="e.g. Thursday"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Clock-In Opens</label>
                          <input
                            type="time"
                            required
                            value={ds.clockInOpenTime || '08:00'}
                            onChange={(e) => handleUpdateDaySchedule(idx, 'clockInOpenTime', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Program Starts</label>
                          <input
                            type="time"
                            required
                            value={ds.programStartTime}
                            onChange={(e) => handleUpdateDaySchedule(idx, 'programStartTime', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEvent}
                  className="px-5 py-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingEvent ? 'Saving...' : editingEvent ? 'Save Changes' : 'Create Special Event'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Celebration Popup */}
      {celebrationWorker && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white border-2 border-emerald-400 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <div className="w-10 h-10 bg-emerald-500 text-slate-950 rounded-xl flex items-center justify-center font-black">
            <Check className="w-6 h-6 stroke-[3]" />
          </div>
          <div>
            <h4 className="text-sm font-black font-['Cinzel',serif] text-emerald-300">
              Clock-In Successful!
            </h4>
            <p className="text-xs text-slate-200 font-bold">
              {celebrationWorker.worker.fullName} ({celebrationWorker.record.clockInTime})
            </p>
          </div>
        </div>
      )}

      {/* Duplicate Warning Popup */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-black text-slate-900">Already Clocked In</h4>
              <p className="text-xs text-slate-600">
                <strong>{duplicateWarning.worker.fullName}</strong> was already clocked in at{' '}
                <strong className="text-amber-700">{duplicateWarning.existing.clockInTime}</strong> for this session.
              </p>
            </div>
            <button
              onClick={() => setDuplicateWarning(null)}
              className="w-full py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Delete Event Confirmation Modal */}
      {eventToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl border border-slate-200">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
                Delete Special Event?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete <strong>"{eventToDelete.name}"</strong>? All associated attendance records and session rosters for this event will also be removed.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEventToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteEvent}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-md transition cursor-pointer"
              >
                Delete Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clock-In Time Lock Modal */}
      {clockInLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl border border-amber-200">
            <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black uppercase rounded-md tracking-wider">
                Session Time-Lock Active
              </span>
              <h4 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
                Clock-In Not Yet Open
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Clock-in and marking present for <strong>{clockInLockModal.workerName}</strong> cannot be completed yet.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-700 space-y-1 text-left">
                <div className="flex justify-between">
                  <span className="text-slate-500">Clock-In Opens:</span>
                  <strong className="text-emerald-700">{clockInLockModal.openTime}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Program Starts:</span>
                  <strong className="text-blue-900">{clockInLockModal.programTime}</strong>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 italic">
                Tip: If you are conducting a leadership test or early rehearsal, enable <strong>"Admin Test Mode"</strong> on the banner.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setClockInLockModal(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminTestOverride(true);
                  setClockInLockModal(null);
                }}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-md transition cursor-pointer"
              >
                Enable Test Mode
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
