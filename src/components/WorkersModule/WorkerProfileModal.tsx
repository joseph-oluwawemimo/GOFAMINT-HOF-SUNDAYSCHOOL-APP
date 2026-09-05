import React, { useState, useEffect, useMemo } from 'react';
import { 
  WorkerProfile, 
  WorkerStatus,
  WorkerCategoryDef, 
  SundaySchoolYear,
  WorkerAttendanceRecord, 
  WorkerPrepAttendanceRecord,
  SundayAttendanceStatus,
  PrepAttendanceStatus
} from '../../types';
import { 
  X, User, Phone, MessageSquare, MapPin, Briefcase, Tag, Check, 
  AlertCircle, BookOpen, Hash, Calendar, Clock, CheckCircle2, 
  XCircle, Plus, ShieldCheck, Sparkles, RefreshCw, Lock, Edit3
} from 'lucide-react';
import { 
  getQuarterWeeklySchedule, 
  formatDateDisplay, 
  calculateSundayFromPrepDate,
  calculatePrepDateFromSunday,
  formatDateISO,
  parseDateSafe
} from '../../utils/quarterScheduleUtils';

interface WorkerProfileModalProps {
  isOpen: boolean;
  worker: WorkerProfile | null;
  categoriesList?: WorkerCategoryDef[];
  departmentsList: string[];
  sundaySchoolYear?: SundaySchoolYear;
  sundayAttendance?: WorkerAttendanceRecord[];
  prepAttendance?: WorkerPrepAttendanceRecord[];
  onClose: () => void;
  onSave: (worker: WorkerProfile) => Promise<void>;
  onSaveSundayAttendance?: (records: WorkerAttendanceRecord[]) => Promise<void>;
  onSavePrepAttendance?: (records: WorkerPrepAttendanceRecord[]) => Promise<void>;
  onAddNewDepartment?: (deptName: string) => Promise<void>;
}

export const WorkerProfileModal: React.FC<WorkerProfileModalProps> = ({
  isOpen,
  worker,
  categoriesList = [],
  departmentsList = ['Adult', 'Youth', 'Teenagers', 'Children'],
  sundaySchoolYear,
  sundayAttendance = [],
  prepAttendance = [],
  onClose,
  onSave,
  onSaveSundayAttendance,
  onSavePrepAttendance,
  onAddNewDepartment
}) => {
  const [activeModalTab, setActiveModalTab] = useState<'ATTENDANCE_LEDGER' | 'PROFILE_INFO'>('ATTENDANCE_LEDGER');
  
  // Profile form state
  const [sn, setSn] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [address, setAddress] = useState('');
  const [department, setDepartment] = useState('Adult');
  const [assignedClass, setAssignedClass] = useState('');
  const [duty, setDuty] = useState('Class Teacher');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [status, setStatus] = useState<WorkerStatus>('ACTIVE');
  const [archiveReason, setArchiveReason] = useState('Relocated / Moved to new city');
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [exemptFromHonors, setExemptFromHonors] = useState(false);
  const [exemptionReason, setExemptionReason] = useState('Pastor / Minister in Charge');
  
  // Inline Add Department state
  const [showAddDeptInput, setShowAddDeptInput] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [isAddingDept, setIsAddingDept] = useState(false);

  // 12-Week Attendance Ledger State for this worker
  // Map of weekNumber -> Sunday Attendance Record
  const [workerSundayRecords, setWorkerSundayRecords] = useState<Record<number, {
    status: SundayAttendanceStatus;
    clockInTime: string;
    isLate: boolean;
    notes?: string;
  }>>({});

  // Map of weekNumber -> Thursday Prep Attendance Record
  const [workerPrepRecords, setWorkerPrepRecords] = useState<Record<number, {
    status: PrepAttendanceStatus;
    notes?: string;
  }>>({});

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Compute 12-week schedule (from 04 Sep 2025 prep / 07 Sep 2025 Sunday)
  const weeklySchedule = useMemo(() => {
    const activeQuarter = sundaySchoolYear?.quarters?.find(
      q => q.quarterNumber === (sundaySchoolYear.activeQuarterNumber || 1)
    ) || sundaySchoolYear?.quarters?.[0];

    if (activeQuarter) {
      return getQuarterWeeklySchedule(activeQuarter, 2025);
    }

    // Default Fallback Schedule based on 04 Sep 2025 (Thursday Prep) & 07 Sep 2025 (Sunday)
    const baseSunday = new Date(2025, 8, 7, 12, 0, 0); // 07 September 2025
    const schedule = [];
    for (let w = 1; w <= 12; w++) {
      const sun = new Date(baseSunday);
      sun.setDate(baseSunday.getDate() + (w - 1) * 7);
      const thurs = new Date(sun);
      thurs.setDate(sun.getDate() - 3);
      
      const sunStr = formatDateISO(sun);
      const thursStr = formatDateISO(thurs);

      schedule.push({
        weekNumber: w,
        sundayDate: sunStr,
        prepDate: thursStr,
        topic: `Quarter 1 Lesson ${w}`,
        isSharingAdmonitionWeek: false
      });
    }
    return schedule;
  }, [sundaySchoolYear]);

  // Synchronize state on modal open
  useEffect(() => {
    if (worker) {
      setSn(worker.sn !== undefined ? String(worker.sn) : '');
      setFullName(worker.fullName || '');
      setPhone(worker.phone || '');
      setWhatsappNumber(worker.whatsappNumber || worker.phone || '');
      setSameAsPhone(worker.whatsappNumber === worker.phone);
      setAddress(worker.address || '');
      setDepartment(worker.department || departmentsList[0] || 'Adult');
      setAssignedClass(worker.assignedClass || '');
      setDuty(worker.duty || worker.categories?.[0] || 'Class Teacher');
      setSelectedCategories(worker.categories && worker.categories.length > 0 ? worker.categories : [worker.duty || 'Class Teacher']);
      setStatus(worker.status || 'ACTIVE');
      setArchiveReason(worker.archiveReason || 'Relocated / Moved to new city');
      setGender(worker.gender || 'MALE');
      setEmail(worker.email || '');
      setNotes(worker.notes || '');
      setExemptFromHonors(Boolean(worker.exemptFromHonors));
      setExemptionReason(worker.exemptionReason || 'Pastor / Minister in Charge');

      // Load existing attendance for weeks 1 to 12
      const sRecs: Record<number, { status: SundayAttendanceStatus; clockInTime: string; isLate: boolean; notes?: string }> = {};
      const pRecs: Record<number, { status: PrepAttendanceStatus; notes?: string }> = {};

      weeklySchedule.forEach(ws => {
        // Find existing Sunday record
        const sMatch = sundayAttendance.find(
          a => a.workerId === worker.id && a.serviceDate === ws.sundayDate
        );
        if (sMatch) {
          sRecs[ws.weekNumber] = {
            status: sMatch.status,
            clockInTime: sMatch.clockInTime || (sMatch.status === 'LATE' ? '08:25:00 AM' : '07:45:00 AM'),
            isLate: sMatch.isLate || sMatch.status === 'LATE',
            notes: sMatch.notes
          };
        } else {
          // Default empty/absent
          sRecs[ws.weekNumber] = {
            status: 'ABSENT',
            clockInTime: '',
            isLate: false
          };
        }

        // Find existing Prep record
        const pMatch = prepAttendance.find(
          p => p.workerId === worker.id && (p.prepDate === ws.prepDate || p.weekNumber === ws.weekNumber)
        );
        if (pMatch) {
          pRecs[ws.weekNumber] = {
            status: pMatch.status,
            notes: pMatch.notes
          };
        } else {
          pRecs[ws.weekNumber] = {
            status: 'ABSENT'
          };
        }
      });

      setWorkerSundayRecords(sRecs);
      setWorkerPrepRecords(pRecs);
    } else {
      // New worker registration
      setSn('');
      setFullName('');
      setPhone('');
      setWhatsappNumber('');
      setSameAsPhone(true);
      setAddress('');
      setDepartment(departmentsList[0] || 'Adult');
      setAssignedClass('');
      setDuty('Class Teacher');
      setSelectedCategories(['Class Teacher']);
      setStatus('ACTIVE');
      setGender('MALE');
      setEmail('');
      setNotes('');
      setExemptFromHonors(false);
      setActiveModalTab('PROFILE_INFO'); // Focus on profile info for new registration

      const sRecs: Record<number, { status: SundayAttendanceStatus; clockInTime: string; isLate: boolean; notes?: string }> = {};
      const pRecs: Record<number, { status: PrepAttendanceStatus; notes?: string }> = {};
      weeklySchedule.forEach(ws => {
        sRecs[ws.weekNumber] = { status: 'ABSENT', clockInTime: '', isLate: false };
        pRecs[ws.weekNumber] = { status: 'ABSENT' };
      });
      setWorkerSundayRecords(sRecs);
      setWorkerPrepRecords(pRecs);
    }
    setError(null);
    setSuccessMsg(null);
    setShowAddDeptInput(false);
  }, [worker, isOpen, departmentsList, weeklySchedule, sundayAttendance, prepAttendance]);

  // Aggregate stats for this worker (computed unconditionally as a hook)
  const stats = useMemo(() => {
    let prepPresent = 0;
    let prepTotalPast = 0;
    let sunPresent = 0;
    let sunOnTime = 0;
    let sunLate = 0;
    let sunTotalPast = 0;

    weeklySchedule.forEach(ws => {
      if (ws.prepDate <= todayStr) {
        prepTotalPast++;
        const p = workerPrepRecords[ws.weekNumber];
        if (p?.status === 'PRESENT') prepPresent++;
      }
      if (ws.sundayDate <= todayStr) {
        sunTotalPast++;
        const s = workerSundayRecords[ws.weekNumber];
        if (s?.status === 'PRESENT') {
          sunPresent++;
          sunOnTime++;
        } else if (s?.status === 'LATE') {
          sunPresent++;
          sunLate++;
        }
      }
    });

    const prepTurnout = prepTotalPast > 0 ? Math.round((prepPresent / prepTotalPast) * 100) : 0;
    const sunPunctuality = sunPresent > 0 ? Math.round((sunOnTime / sunPresent) * 100) : 0;

    return {
      prepPresent,
      prepTotalPast,
      prepTurnout,
      sunPresent,
      sunOnTime,
      sunLate,
      sunTotalPast,
      sunPunctuality
    };
  }, [weeklySchedule, workerPrepRecords, workerSundayRecords, todayStr]);

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    if (sameAsPhone) {
      setWhatsappNumber(val);
    }
  };

  // Helper to handle Sunday status changes
  const handleUpdateSundayStatus = (weekNum: number, newStatus: SundayAttendanceStatus) => {
    const current = workerSundayRecords[weekNum] || { status: 'ABSENT', clockInTime: '', isLate: false };
    let clockTime = current.clockInTime;
    let isLate = current.isLate;

    if (newStatus === 'PRESENT') {
      clockTime = clockTime || '07:45:00 AM';
      isLate = false;
    } else if (newStatus === 'LATE') {
      clockTime = clockTime || '08:25:00 AM';
      isLate = true;
    } else {
      clockTime = '';
      isLate = false;
    }

    setWorkerSundayRecords(prev => ({
      ...prev,
      [weekNum]: {
        ...current,
        status: newStatus,
        clockInTime: clockTime,
        isLate
      }
    }));
  };

  // Helper to handle Sunday clock-in time manual changes
  const handleUpdateSundayClockInTime = (weekNum: number, timeStr: string) => {
    const current = workerSundayRecords[weekNum] || { status: 'PRESENT', clockInTime: '', isLate: false };
    
    // Auto-detect lateness if time entered starts with 08:16+ AM or later
    let isLate = current.isLate;
    let status = current.status;

    if (timeStr.trim()) {
      if (status === 'ABSENT' || status === 'EXCUSED') {
        status = 'PRESENT';
      }
      
      const cleanTime = timeStr.toUpperCase();
      if (cleanTime.includes('08:1') && parseInt(cleanTime.split(':')[1] || '0', 10) > 15) {
        isLate = true;
        status = 'LATE';
      } else if (cleanTime.includes('08:2') || cleanTime.includes('08:3') || cleanTime.includes('08:4') || cleanTime.includes('08:5') || cleanTime.includes('09:')) {
        isLate = true;
        status = 'LATE';
      } else if (cleanTime.includes('07:') || cleanTime.includes('06:') || cleanTime.includes('08:0') || (cleanTime.includes('08:1') && parseInt(cleanTime.split(':')[1] || '0', 10) <= 15)) {
        isLate = false;
        status = 'PRESENT';
      }
    }

    setWorkerSundayRecords(prev => ({
      ...prev,
      [weekNum]: {
        ...current,
        status,
        clockInTime: timeStr,
        isLate
      }
    }));
  };

  // Helper to handle Thursday Prep status changes
  const handleUpdatePrepStatus = (weekNum: number, newStatus: PrepAttendanceStatus) => {
    const current = workerPrepRecords[weekNum] || { status: 'ABSENT' };
    setWorkerPrepRecords(prev => ({
      ...prev,
      [weekNum]: {
        ...current,
        status: newStatus
      }
    }));
  };

  // Bulk Quick-fill for past weeks
  const handleMarkAllPastPresent = () => {
    const nextSundayRecs = { ...workerSundayRecords };
    const nextPrepRecs = { ...workerPrepRecords };

    weeklySchedule.forEach(ws => {
      // Check if past date
      if (ws.prepDate <= todayStr) {
        nextPrepRecs[ws.weekNumber] = {
          status: 'PRESENT',
          notes: 'Marked Present in 12-Week Ledger'
        };
      }
      if (ws.sundayDate <= todayStr) {
        nextSundayRecs[ws.weekNumber] = {
          status: 'PRESENT',
          clockInTime: '07:45:00 AM',
          isLate: false,
          notes: 'Punctual arrival (07:45 AM)'
        };
      }
    });

    setWorkerPrepRecords(nextPrepRecs);
    setWorkerSundayRecords(nextSundayRecs);
  };

  // Handle Add New Department Inline
  const handleAddNewDept = async () => {
    if (!newDeptName.trim()) return;
    const trimmed = newDeptName.trim();
    setIsAddingDept(true);
    try {
      if (onAddNewDepartment) {
        await onAddNewDepartment(trimmed);
      }
      setDepartment(trimmed);
      setNewDeptName('');
      setShowAddDeptInput(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to add department');
    } finally {
      setIsAddingDept(false);
    }
  };

  // Save All Changes (Worker Profile + 12 Weeks Attendance)
  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please provide the worker’s full name.');
      setActiveModalTab('PROFILE_INFO');
      return;
    }
    if (!phone.trim()) {
      setError('Please provide a valid phone number.');
      setActiveModalTab('PROFILE_INFO');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const workerId = worker?.id || `w_${Date.now()}`;
      const qrCode = worker?.qrCodeToken || `GOFAMINT_HOF-WRK-${Date.now().toString().slice(-5)}`;
      const effectiveCategories = selectedCategories.length > 0 ? selectedCategories : [duty.trim() || 'Class Teacher'];

      const profileToSave: WorkerProfile = {
        id: workerId,
        sn: sn.trim() || undefined,
        fullName: fullName.trim(),
        gender,
        department,
        assignedClass: assignedClass.trim() || undefined,
        duty: duty.trim() || undefined,
        categories: effectiveCategories,
        phone: phone.trim(),
        whatsappNumber: sameAsPhone ? phone.trim() : (whatsappNumber.trim() || phone.trim()),
        address: address.trim() || 'Assembly Premises, Lagos',
        status,
        archivedAt: status === 'ARCHIVED' ? (worker?.archivedAt || new Date().toISOString()) : undefined,
        archiveReason: status === 'ARCHIVED' ? archiveReason.trim() : undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        exemptFromHonors,
        exemptionReason: exemptFromHonors ? exemptionReason.trim() : undefined,
        qrCodeToken: qrCode,
        createdAt: worker?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 1. Save worker profile
      await onSave(profileToSave);

      // 2. Prepare Sunday records for saving
      const sundayRecordsToSave: WorkerAttendanceRecord[] = [];
      weeklySchedule.forEach(ws => {
        const s = workerSundayRecords[ws.weekNumber];
        if (s && s.status) {
          sundayRecordsToSave.push({
            id: `${workerId}_${ws.sundayDate}`,
            workerId: workerId,
            workerName: fullName.trim(),
            department: department,
            serviceDate: ws.sundayDate,
            serviceName: 'Sunday Morning Service',
            clockInTime: s.clockInTime || (s.status === 'LATE' ? '08:25:00 AM' : s.status === 'PRESENT' ? '07:45:00 AM' : '—'),
            timestamp: Date.now(),
            status: s.status,
            isLate: s.isLate || s.status === 'LATE',
            method: 'MANUAL_OVERRIDE',
            notes: s.notes || (s.status === 'PRESENT' ? 'Punctual (Recorded in 12-Week Ledger)' : s.status === 'LATE' ? 'Late Clock-in' : 'Weekly Ledger Record'),
            createdAt: new Date().toISOString()
          });
        }
      });

      if (onSaveSundayAttendance && sundayRecordsToSave.length > 0) {
        await onSaveSundayAttendance(sundayRecordsToSave);
      }

      // 3. Prepare Prep records for saving
      const prepRecordsToSave: WorkerPrepAttendanceRecord[] = [];
      weeklySchedule.forEach(ws => {
        const p = workerPrepRecords[ws.weekNumber];
        if (p && p.status) {
          prepRecordsToSave.push({
            id: `${workerId}_prep_${ws.prepDate}`,
            workerId: workerId,
            workerName: fullName.trim(),
            department: department,
            prepDate: ws.prepDate,
            sessionTitle: `Thursday Preparatory Class - Week ${ws.weekNumber}`,
            weekNumber: ws.weekNumber,
            status: p.status,
            syllabusPrepared: p.status === 'PRESENT',
            markedBy: 'Workers Coordinator (12-Week Ledger)',
            notes: p.notes,
            updatedAt: new Date().toISOString()
          });
        }
      });

      if (onSavePrepAttendance && prepRecordsToSave.length > 0) {
        await onSavePrepAttendance(prepRecordsToSave);
      }

      setSuccessMsg('Worker profile & 12-week attendance saved successfully!');
      setTimeout(() => {
        onClose();
      }, 700);

    } catch (err: any) {
      setError(err?.message || 'Failed to save worker record.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
              {fullName ? fullName.split(' ').map(n => n[0]).slice(0, 2).join('') : <User className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-wide font-['Cinzel',serif] text-white">
                  {worker ? worker.fullName : 'Register New Church Worker'}
                </h2>
                {worker && (
                  <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-400/40 text-amber-300 rounded text-[10px] font-mono font-bold">
                    {worker.qrCodeToken}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
                <span>Dept: <strong className="text-white">{department}</strong></span>
                <span>•</span>
                <span>Duty: <strong className="text-white">{duty}</strong></span>
              </p>
            </div>
          </div>

          {/* Tab Switcher & Close */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-800 p-1 rounded-xl flex items-center text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveModalTab('ATTENDANCE_LEDGER')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  activeModalTab === 'ATTENDANCE_LEDGER'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>12-Week Attendance</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('PROFILE_INFO')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  activeModalTab === 'PROFILE_INFO'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span>Profile Details</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer shrink-0"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          
          {activeModalTab === 'ATTENDANCE_LEDGER' && (
            <div className="space-y-5 animate-fade-in">
              
              {/* Quick Metrics Bar for this worker */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="border-r border-slate-100 pr-2">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Thursday Prep Class</div>
                  <div className="text-lg font-black text-blue-900 mt-0.5">
                    {stats.prepPresent} / {stats.prepTotalPast} <span className="text-xs font-semibold text-slate-500">({stats.prepTurnout}%)</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Past turnout</div>
                </div>

                <div className="border-r border-slate-100 pr-2">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Sunday Turnout</div>
                  <div className="text-lg font-black text-emerald-800 mt-0.5">
                    {stats.sunPresent} / {stats.sunTotalPast}
                  </div>
                  <div className="text-[10px] text-slate-400">{stats.sunTotalPast > 0 ? Math.round((stats.sunPresent / stats.sunTotalPast) * 100) : 0}% attended</div>
                </div>

                <div className="border-r border-slate-100 pr-2">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Sunday Punctuality</div>
                  <div className="text-lg font-black text-amber-700 mt-0.5">
                    {stats.sunPunctuality}%
                  </div>
                  <div className="text-[10px] text-slate-400">{stats.sunOnTime} on-time • {stats.sunLate} late</div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Historical Edit Policy</div>
                  <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[10px] font-bold">
                    <ShieldCheck className="w-3 h-3 text-emerald-700" />
                    <span>Past & Today Alterable</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Future dates locked</div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50/70 p-3 rounded-xl border border-blue-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-900" />
                  <span className="text-xs font-bold text-blue-950">
                    Week 1 to 12 Attendance Matrix:
                  </span>
                  <span className="text-xs text-blue-800">
                    Input & alter Thursday Prep (Present/Late/Absent/Excused) and Sunday Punctuality with Clock-in Time.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMarkAllPastPresent}
                    className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-amber-300" />
                    <span>Mark All Past Weeks Present</span>
                  </button>
                </div>
              </div>

              {/* 12-Week Card Grid / Rows */}
              <div className="space-y-3">
                {weeklySchedule.map((ws) => {
                  const isPrepPast = ws.prepDate <= todayStr;
                  const isSunPast = ws.sundayDate <= todayStr;
                  const isAnyPast = isPrepPast || isSunPast;

                  const sRec = workerSundayRecords[ws.weekNumber] || { status: 'ABSENT', clockInTime: '', isLate: false };
                  const pRec = workerPrepRecords[ws.weekNumber] || { status: 'ABSENT' };

                  return (
                    <div 
                      key={ws.weekNumber} 
                      className={`p-3.5 sm:p-4 rounded-xl border transition ${
                        isAnyPast 
                          ? 'bg-white border-slate-200 shadow-xs hover:border-slate-300' 
                          : 'bg-slate-100/70 border-slate-200/80 opacity-75'
                      }`}
                    >
                      {/* Week Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-slate-900 text-amber-300 rounded font-black text-xs font-mono">
                            Week {ws.weekNumber}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {ws.topic}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-500 font-mono">
                            Thu: <strong className="text-slate-700">{formatDateDisplay(ws.prepDate)}</strong>
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-500 font-mono">
                            Sun: <strong className="text-slate-700">{formatDateDisplay(ws.sundayDate)}</strong>
                          </span>
                          {isAnyPast ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[10px] font-bold">
                              Alterable (Past Data)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 border border-slate-300 rounded text-[10px] font-bold flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              Upcoming
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 2 Attendance Fill Controls: A. Thursday Prep & B. Sunday Punctuality */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* A. Thursday Preparatory Class Attendance */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-blue-900" />
                              <span>a. Thursday Prep Attendance</span>
                            </label>
                            <span className="text-[10px] font-semibold text-slate-500 font-mono">
                              {ws.prepDate}
                            </span>
                          </div>

                          {/* 4 Status Toggle Options: Present, Late, Absent, Excused */}
                          <div className="grid grid-cols-4 gap-1.5">
                            {(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] as PrepAttendanceStatus[]).map((st) => {
                              const isSelected = pRec.status === st;
                              let activeClass = 'bg-slate-200 text-slate-700';
                              if (isSelected) {
                                if (st === 'PRESENT') activeClass = 'bg-emerald-700 text-white font-black shadow-xs';
                                else if (st === 'LATE') activeClass = 'bg-amber-600 text-white font-black shadow-xs';
                                else if (st === 'ABSENT') activeClass = 'bg-rose-700 text-white font-black shadow-xs';
                                else if (st === 'EXCUSED') activeClass = 'bg-blue-700 text-white font-black shadow-xs';
                              }

                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleUpdatePrepStatus(ws.weekNumber, st)}
                                  disabled={!isPrepPast}
                                  className={`py-1.5 px-1 rounded-lg text-xs font-bold uppercase transition text-center cursor-pointer ${
                                    isSelected 
                                      ? activeClass 
                                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                                  } ${!isPrepPast ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* B. Sunday Punctuality & Clock-In */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-emerald-800" />
                              <span>b. Sunday Punctuality & Clock-In</span>
                            </label>
                            <span className="text-[10px] font-semibold text-slate-500 font-mono">
                              {ws.sundayDate}
                            </span>
                          </div>

                          {/* Sunday Status Selection */}
                          <div className="grid grid-cols-4 gap-1.5">
                            {(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] as SundayAttendanceStatus[]).map((st) => {
                              const isSelected = sRec.status === st;
                              let activeClass = 'bg-slate-200 text-slate-700';
                              if (isSelected) {
                                if (st === 'PRESENT') activeClass = 'bg-emerald-700 text-white font-black shadow-xs';
                                else if (st === 'LATE') activeClass = 'bg-amber-600 text-white font-black shadow-xs';
                                else if (st === 'ABSENT') activeClass = 'bg-rose-700 text-white font-black shadow-xs';
                                else if (st === 'EXCUSED') activeClass = 'bg-blue-700 text-white font-black shadow-xs';
                              }

                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleUpdateSundayStatus(ws.weekNumber, st)}
                                  disabled={!isSunPast}
                                  className={`py-1.5 px-1 rounded-lg text-xs font-bold uppercase transition text-center cursor-pointer ${
                                    isSelected 
                                      ? activeClass 
                                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                                  } ${!isSunPast ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>

                          {/* Time Clocked In (Manual Entry with Quick Shortcuts) */}
                          {(sRec.status === 'PRESENT' || sRec.status === 'LATE') && (
                            <div className="pt-1.5 flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-1 text-xs text-slate-600 font-semibold">
                                <span>Clock-In Time:</span>
                              </div>
                              <input
                                type="text"
                                value={sRec.clockInTime || ''}
                                onChange={e => handleUpdateSundayClockInTime(ws.weekNumber, e.target.value)}
                                disabled={!isSunPast}
                                placeholder="07:45:00 AM"
                                className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 w-28 focus:ring-2 focus:ring-emerald-600 outline-hidden"
                              />

                              {/* Quick Time Chips */}
                              <div className="flex items-center gap-1">
                                {['07:30 AM', '07:45 AM', '08:00 AM', '08:25 AM'].map(tChip => (
                                  <button
                                    key={tChip}
                                    type="button"
                                    onClick={() => handleUpdateSundayClockInTime(ws.weekNumber, `${tChip}:00`)}
                                    disabled={!isSunPast}
                                    className="px-1.5 py-0.5 bg-slate-200 hover:bg-emerald-100 hover:text-emerald-900 rounded text-[10px] font-mono text-slate-700 transition cursor-pointer"
                                  >
                                    {tChip.split(' ')[0]}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {activeModalTab === 'PROFILE_INFO' && (
            <div className="space-y-4 text-sm animate-fade-in bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              
              {/* S/N, Full Name & Sex (Gender) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <Hash className="w-3 h-3 text-slate-400" />
                    S/N
                  </label>
                  <input
                    type="text"
                    value={sn}
                    onChange={e => setSn(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 outline-hidden font-bold text-center"
                  />
                </div>

                <div className="sm:col-span-7 space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Bro. Emmanuel Adebayo"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 outline-hidden font-medium"
                    required
                  />
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Sex
                  </label>
                  <select
                    value={gender}
                    onChange={e => setGender(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 outline-hidden font-medium bg-white"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>
              </div>

              {/* Department (Only 4 Recognized Default + Option to Add), Class & Duty */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                      Department <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddDeptInput(!showAddDeptInput)}
                      className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{showAddDeptInput ? 'Cancel' : 'Add Dept'}</span>
                    </button>
                  </div>

                  {showAddDeptInput ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newDeptName}
                        onChange={e => setNewDeptName(e.target.value)}
                        placeholder="New Department..."
                        className="w-full px-2.5 py-1.5 border border-blue-400 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-600 outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={handleAddNewDept}
                        disabled={isAddingDept || !newDeptName.trim()}
                        className="px-2.5 py-1.5 bg-blue-900 text-white rounded-lg text-xs font-bold hover:bg-blue-800 disabled:opacity-50 shrink-0"
                      >
                        {isAddingDept ? '...' : 'Add'}
                      </button>
                    </div>
                  ) : (
                    <select
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 outline-hidden font-medium bg-white"
                    >
                      {departmentsList.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  )}
                  <p className="text-[10px] text-slate-400">4 Recognized: Adult, Youth, Teenagers, Children</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                    Assigned Class
                  </label>
                  <input
                    type="text"
                    value={assignedClass}
                    onChange={e => setAssignedClass(e.target.value)}
                    placeholder="e.g. Adult English, Beginner 1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 outline-hidden font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-500" />
                    Duty & Role <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={duty}
                    onChange={e => {
                      setDuty(e.target.value);
                      if (e.target.value && !selectedCategories.includes(e.target.value)) {
                        setSelectedCategories([e.target.value]);
                      }
                    }}
                    placeholder="e.g. Class Teacher, Usher"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 outline-hidden font-medium"
                    required
                  />
                </div>
              </div>

              {/* Phone & WhatsApp Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    placeholder="e.g. 08012345678"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 outline-hidden font-medium"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      WhatsApp Number
                    </label>
                    <label className="text-[11px] text-slate-500 flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sameAsPhone}
                        onChange={e => {
                          setSameAsPhone(e.target.checked);
                          if (e.target.checked) setWhatsappNumber(phone);
                        }}
                        className="rounded text-blue-600"
                      />
                      <span>Same as phone</span>
                    </label>
                  </div>
                  <input
                    type="tel"
                    value={sameAsPhone ? phone : whatsappNumber}
                    onChange={e => {
                      setWhatsappNumber(e.target.value);
                      setSameAsPhone(false);
                    }}
                    disabled={sameAsPhone}
                    placeholder="e.g. 08012345678"
                    className={`w-full px-3.5 py-2 border rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-hidden font-medium ${
                      sameAsPhone ? 'bg-slate-100 border-slate-200 text-slate-600' : 'border-slate-300'
                    }`}
                  />
                </div>
              </div>

              {/* Address & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="e.g. 12 Church Street, Lagos"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 outline-hidden font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Worker Status
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 outline-hidden font-medium bg-white"
                  >
                    <option value="ACTIVE">Active Worker</option>
                    <option value="INACTIVE">Inactive / On Temporary Leave</option>
                    <option value="ARCHIVED">Archived (Relocated, Traveled, Transferred Church)</option>
                  </select>
                </div>
              </div>

              {/* Archive Reason (if ARCHIVED) */}
              {status === 'ARCHIVED' && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl space-y-2 animate-fade-in">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-950 uppercase tracking-wider">
                    <span>Archive Reason & Classification</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Archived workers are excluded from future active weekly ledgers, Sunday clock-in, and upcoming quarters. Their historical records remain preserved in the church database.
                  </p>
                  <select
                    value={archiveReason}
                    onChange={e => setArchiveReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden"
                  >
                    <option value="Relocated / Moved to new city">Relocated / Moved to new city or state</option>
                    <option value="Traveled Abroad / Out of Country">Traveled Abroad / Relocated outside the country</option>
                    <option value="Transferred to another Assembly">Transferred to another GOFAMINT_HOF Assembly / Church</option>
                    <option value="Withdrew from Workforce">Withdrew / No longer in active church workforce</option>
                    <option value="Extended Inactivity / Undetermined Absence">Extended Inactivity / Prolonged absence</option>
                  </select>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Special Notes / Ministry Portfolio (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Assigned to Sanctuary Zone B; ordained as Deacon..."
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 outline-hidden font-medium text-xs"
                />
              </div>

              {/* 12-Week Honorary Award Exemption Toggle */}
              <div className="p-4 bg-amber-50/70 border-2 border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-start gap-3">
                  <input
                    id="exemptFromHonorsCheckbox"
                    type="checkbox"
                    checked={exemptFromHonors}
                    onChange={e => setExemptFromHonors(e.target.checked)}
                    className="w-5 h-5 text-amber-600 rounded-md border-amber-300 focus:ring-amber-500 mt-0.5 cursor-pointer"
                  />
                  <div className="space-y-0.5 flex-1">
                    <label htmlFor="exemptFromHonorsCheckbox" className="text-xs font-black uppercase tracking-wider text-amber-950 cursor-pointer flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span>Exempt from 12-Week Honorary Award</span>
                    </label>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Check this box if this worker (e.g. Pastor, Regional Overseer, or Special Appointee) should be excluded from the 12-Week Punctuality Honors & Certificate roster. All historical attendance logs and clock-in records remain intact and are <strong>never deleted</strong>.
                    </p>

                    {exemptFromHonors && (
                      <div className="pt-2">
                        <label className="text-[10px] font-bold text-amber-900 uppercase block mb-1">
                          Exemption Category / Reason:
                        </label>
                        <select
                          value={exemptionReason}
                          onChange={e => setExemptionReason(e.target.value)}
                          className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="Pastor / Minister in Charge">Pastor / Minister in Charge</option>
                          <option value="Presiding Minister / Ordained Clergy">Presiding Minister / Ordained Clergy</option>
                          <option value="General Executive Committee Member">General Executive Committee Member</option>
                          <option value="Regional / District Overseer">Regional / District Overseer</option>
                          <option value="Transferred to Regional Post">Transferred to Regional Post</option>
                          <option value="Health / Sabbatical Leave">Health / Sabbatical Leave</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {activeModalTab === 'ATTENDANCE_LEDGER' ? (
              <span>Editing will update both Sunday Attendance and Thursday Prep Class logs.</span>
            ) : (
              <span>Standard 9-Column Master Worker Register Profile</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="px-6 py-2.5 bg-blue-900 hover:bg-blue-800 active:scale-98 text-white rounded-xl font-black shadow-md transition flex items-center gap-2 text-xs cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />
                  <span>Saving Records...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-amber-300" />
                  <span>Save All Changes (Profile & 12-Week Data)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
