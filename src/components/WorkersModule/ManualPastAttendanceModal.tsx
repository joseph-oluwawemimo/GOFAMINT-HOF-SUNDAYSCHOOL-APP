import React, { useState, useMemo } from 'react';
import { 
  WorkerProfile, 
  WorkerAttendanceRecord, 
  WorkerPrepAttendanceRecord,
  SundayAttendanceStatus,
  PrepAttendanceStatus
} from '../../types';
import { 
  Calendar, Clock, Check, X, AlertTriangle, Save, 
  Lock, Edit3, UserCheck, ShieldAlert, Sparkles, Filter, CheckCircle2
} from 'lucide-react';

interface ManualPastAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceType: 'SUNDAY_SERVICE' | 'PREP_CLASS';
  targetDate: string; // YYYY-MM-DD
  weekNumber: number;
  quarterName: string;
  workers: WorkerProfile[];
  sundayAttendance: WorkerAttendanceRecord[];
  prepAttendance: WorkerPrepAttendanceRecord[];
  onSaveSundayAttendance: (records: WorkerAttendanceRecord[]) => Promise<void>;
  onSavePrepAttendance: (records: WorkerPrepAttendanceRecord[]) => Promise<void>;
}

export const ManualPastAttendanceModal: React.FC<ManualPastAttendanceModalProps> = ({
  isOpen,
  onClose,
  serviceType,
  targetDate,
  weekNumber,
  quarterName,
  workers,
  sundayAttendance,
  prepAttendance,
  onSaveSundayAttendance,
  onSavePrepAttendance
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = targetDate === todayStr;
  const isPastDate = targetDate < todayStr;

  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Departments list
  const departmentsList = useMemo(() => {
    return Array.from(new Set(workers.map(w => w.department))).sort();
  }, [workers]);

  // Active workers
  const activeWorkers = useMemo(() => {
    return workers.filter(w => w.status === 'ACTIVE');
  }, [workers]);

  // Existing records map
  const [sundayMap, setSundayMap] = useState<Map<string, WorkerAttendanceRecord>>(() => {
    const map = new Map<string, WorkerAttendanceRecord>();
    sundayAttendance
      .filter(a => a.serviceDate === targetDate)
      .forEach(a => map.set(a.workerId, a));
    return map;
  });

  const [prepMap, setPrepMap] = useState<Map<string, WorkerPrepAttendanceRecord>>(() => {
    const map = new Map<string, WorkerPrepAttendanceRecord>();
    prepAttendance
      .filter(p => p.prepDate === targetDate)
      .forEach(p => map.set(p.workerId, p));
    return map;
  });

  // Re-sync maps when targetDate or props change
  React.useEffect(() => {
    const sMap = new Map<string, WorkerAttendanceRecord>();
    sundayAttendance
      .filter(a => a.serviceDate === targetDate)
      .forEach(a => sMap.set(a.workerId, a));
    setSundayMap(sMap);

    const pMap = new Map<string, WorkerPrepAttendanceRecord>();
    prepAttendance
      .filter(p => p.prepDate === targetDate)
      .forEach(p => pMap.set(p.workerId, p));
    setPrepMap(pMap);
  }, [targetDate, sundayAttendance, prepAttendance]);

  if (!isOpen) return null;

  // Filtered active workers
  const filteredWorkers = activeWorkers.filter(w => {
    const q = (searchQuery || '').toLowerCase();
    const matchesDept = selectedDept === 'ALL' || w.department === selectedDept;
    const matchesSearch = 
      (w.fullName || '').toLowerCase().includes(q) ||
      (w.phone || '').includes(searchQuery || '') ||
      (w.department || '').toLowerCase().includes(q);
    return matchesDept && matchesSearch;
  });

  // Handle setting Sunday status for a worker
  const handleSetSundayStatus = (worker: WorkerProfile, status: SundayAttendanceStatus, isLate: boolean = false) => {
    if (isToday) return; // Prevent editing today's live data
    const existing = sundayMap.get(worker.id);
    const newRecord: WorkerAttendanceRecord = {
      id: existing?.id || `${worker.id}_${targetDate}`,
      workerId: worker.id,
      workerName: worker.fullName,
      department: worker.department,
      serviceDate: targetDate,
      serviceName: 'Sunday Morning Service',
      clockInTime: existing?.clockInTime || (status === 'PRESENT' ? '07:45:00 AM' : status === 'LATE' ? '08:25:00 AM' : '—'),
      timestamp: existing?.timestamp || Date.now(),
      status,
      isLate: isLate || status === 'LATE',
      method: 'MANUAL_OVERRIDE',
      notes: existing?.notes || 'Historical / Manual Entry',
      createdAt: existing?.createdAt || new Date().toISOString()
    };
    const nextMap = new Map(sundayMap);
    nextMap.set(worker.id, newRecord);
    setSundayMap(nextMap);
  };

  // Handle setting Prep status for a worker
  const handleSetPrepStatus = (worker: WorkerProfile, status: PrepAttendanceStatus) => {
    if (isToday) return; // Prevent editing today's live data
    const existing = prepMap.get(worker.id);
    const newRecord: WorkerPrepAttendanceRecord = {
      id: existing?.id || `${worker.id}_prep_${targetDate}`,
      workerId: worker.id,
      workerName: worker.fullName,
      department: worker.department,
      prepDate: targetDate,
      sessionTitle: `Thursday Preparatory Class - Week ${weekNumber}`,
      weekNumber: weekNumber,
      status,
      syllabusPrepared: existing?.syllabusPrepared ?? true,
      markedBy: 'Workers Administrator (Historical Entry)',
      notes: existing?.notes,
      updatedAt: new Date().toISOString()
    };
    const nextMap = new Map(prepMap);
    nextMap.set(worker.id, newRecord);
    setPrepMap(nextMap);
  };

  // Handle batch mark all visible as Present
  const handleMarkAllVisiblePresent = () => {
    if (isToday) return;
    if (serviceType === 'SUNDAY_SERVICE') {
      const nextMap = new Map<string, WorkerAttendanceRecord>(sundayMap);
      filteredWorkers.forEach(w => {
        const existing = nextMap.get(w.id);
        nextMap.set(w.id, {
          id: existing?.id || `${w.id}_${targetDate}`,
          workerId: w.id,
          workerName: w.fullName,
          department: w.department,
          serviceDate: targetDate,
          serviceName: 'Sunday Morning Service',
          clockInTime: existing?.clockInTime || '07:45:00 AM',
          timestamp: existing?.timestamp || Date.now(),
          status: 'PRESENT',
          isLate: false,
          method: 'MANUAL_OVERRIDE',
          notes: 'Batch Historical Entry',
          createdAt: existing?.createdAt || new Date().toISOString()
        });
      });
      setSundayMap(nextMap);
    } else {
      const nextMap = new Map<string, WorkerPrepAttendanceRecord>(prepMap);
      filteredWorkers.forEach(w => {
        const existing = nextMap.get(w.id);
        nextMap.set(w.id, {
          id: existing?.id || `${w.id}_prep_${targetDate}`,
          workerId: w.id,
          workerName: w.fullName,
          department: w.department,
          prepDate: targetDate,
          sessionTitle: `Thursday Preparatory Class - Week ${weekNumber}`,
          weekNumber: weekNumber,
          status: 'PRESENT',
          syllabusPrepared: existing?.syllabusPrepared ?? true,
          markedBy: 'Workers Administrator (Batch)',
          updatedAt: new Date().toISOString()
        });
      });
      setPrepMap(nextMap);
    }
  };

  // Save changes to database
  const handleSaveAll = async () => {
    if (isToday) return;
    setIsSaving(true);
    try {
      if (serviceType === 'SUNDAY_SERVICE') {
        const recordsToSave = Array.from(sundayMap.values());
        await onSaveSundayAttendance(recordsToSave);
      } else {
        const recordsToSave = Array.from(prepMap.values());
        await onSavePrepAttendance(recordsToSave);
      }
      setSuccessMessage('Historical attendance records updated successfully.');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Error saving manual attendance:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white border-2 border-slate-300 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white border-b-2 border-amber-500 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-amber-500 text-slate-950 rounded-full text-[10px] font-black uppercase tracking-wider">
                {quarterName} • Week {weekNumber}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                isToday 
                  ? 'bg-rose-500 text-white' 
                  : 'bg-emerald-500 text-white'
              }`}>
                {isToday ? <Lock className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                {isToday ? 'Live Scanned (Locked)' : 'Past Record (Editable)'}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black font-['Cinzel',serif] text-white">
              {serviceType === 'SUNDAY_SERVICE' ? 'Sunday Service Attendance Entry' : 'Thursday Preparatory Class Entry'}
            </h2>

            <p className="text-xs text-slate-300 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Target Service Date: <strong className="text-amber-300 font-mono">{targetDate}</strong></span>
              <span>•</span>
              <span>Total Active Workers: <strong className="text-white">{activeWorkers.length}</strong></span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Scan Lock Warning if Today */}
        {isToday && (
          <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center gap-3 text-xs text-amber-900">
            <Lock className="w-5 h-5 text-amber-700 shrink-0" />
            <div>
              <strong className="font-bold">Real-time Kiosk Security Rule:</strong> Current real-time clock-in data scanned today is protected and cannot be altered directly to preserve terminal verification integrity. Only former / past dates can be manually adjusted.
            </div>
          </div>
        )}

        {/* Filters and Actions */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Department select */}
            <div className="flex items-center gap-1.5">
              <label className="font-bold text-slate-600">Department:</label>
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800 focus:outline-hidden focus:border-blue-900"
              >
                <option value="ALL">All Departments ({activeWorkers.length})</option>
                {departmentsList.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search worker by name..."
              className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-hidden focus:border-blue-900 w-48 sm:w-60"
            />
          </div>

          {!isToday && (
            <button
              onClick={handleMarkAllVisiblePresent}
              className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl font-bold flex items-center gap-1.5 transition text-xs shadow-2xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
              <span>Mark All Filtered Present</span>
            </button>
          )}

        </div>

        {/* Workers List Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-300">
              <tr>
                <th className="py-2.5 px-3">Worker Name</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3 text-center">Current Status</th>
                <th className="py-2.5 px-3 text-right">Quick Set Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredWorkers.map(worker => {
                const sundayRec = sundayMap.get(worker.id);
                const prepRec = prepMap.get(worker.id);

                const currentSundayStatus = sundayRec ? (sundayRec.isLate || sundayRec.status === 'LATE' ? 'LATE' : sundayRec.status) : 'ABSENT';
                const currentPrepStatus = prepRec ? prepRec.status : 'ABSENT';

                const statusToDisplay = serviceType === 'SUNDAY_SERVICE' ? currentSundayStatus : currentPrepStatus;

                return (
                  <tr key={worker.id} className="hover:bg-slate-50 transition">
                    
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 text-sm">
                        {worker.fullName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {worker.phone}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-900 rounded font-bold text-[10px] border border-blue-200">
                        {worker.department}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        statusToDisplay === 'PRESENT'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : statusToDisplay === 'LATE'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : statusToDisplay === 'EXCUSED'
                          ? 'bg-blue-100 text-blue-900 border-blue-300'
                          : 'bg-rose-100 text-rose-900 border-rose-300'
                      }`}>
                        {statusToDisplay}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      {isToday ? (
                        <span className="text-[11px] text-slate-400 italic">
                          Locked (Live Mode)
                        </span>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => serviceType === 'SUNDAY_SERVICE' ? handleSetSundayStatus(worker, 'PRESENT', false) : handleSetPrepStatus(worker, 'PRESENT')}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                                statusToDisplay === 'PRESENT'
                                  ? 'bg-emerald-700 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-900'
                              }`}
                            >
                              Present
                            </button>

                            <button
                              onClick={() => serviceType === 'SUNDAY_SERVICE' ? handleSetSundayStatus(worker, 'LATE', true) : handleSetPrepStatus(worker, 'LATE')}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                                statusToDisplay === 'LATE'
                                  ? 'bg-amber-600 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-900'
                              }`}
                            >
                              Late
                            </button>

                            <button
                              onClick={() => serviceType === 'SUNDAY_SERVICE' ? handleSetSundayStatus(worker, 'ABSENT') : handleSetPrepStatus(worker, 'ABSENT')}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                                statusToDisplay === 'ABSENT'
                                  ? 'bg-rose-700 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-700 hover:bg-rose-100 hover:text-rose-900'
                              }`}
                            >
                              Absent
                            </button>

                            <button
                              onClick={() => serviceType === 'SUNDAY_SERVICE' ? handleSetSundayStatus(worker, 'EXCUSED') : handleSetPrepStatus(worker, 'EXCUSED')}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                statusToDisplay === 'EXCUSED'
                                  ? 'bg-blue-700 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-900'
                              }`}
                            >
                              Excused
                            </button>
                          </div>

                          {serviceType === 'SUNDAY_SERVICE' && (statusToDisplay === 'PRESENT' || statusToDisplay === 'LATE') && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <input
                                type="text"
                                value={sundayRec?.clockInTime || (statusToDisplay === 'LATE' ? '08:25:00 AM' : '07:45:00 AM')}
                                onChange={e => {
                                  const newTime = e.target.value;
                                  const existing = sundayMap.get(worker.id);
                                  const updatedRec: WorkerAttendanceRecord = {
                                    id: existing?.id || `${worker.id}_${targetDate}`,
                                    workerId: worker.id,
                                    workerName: worker.fullName,
                                    department: worker.department,
                                    serviceDate: targetDate,
                                    serviceName: 'Sunday Morning Service',
                                    clockInTime: newTime,
                                    timestamp: existing?.timestamp || Date.now(),
                                    status: statusToDisplay as SundayAttendanceStatus,
                                    isLate: statusToDisplay === 'LATE',
                                    method: 'MANUAL_OVERRIDE',
                                    notes: 'Punctuality manual entry',
                                    createdAt: existing?.createdAt || new Date().toISOString()
                                  };
                                  const nextMap = new Map(sundayMap);
                                  nextMap.set(worker.id, updatedRec);
                                  setSundayMap(nextMap);
                                }}
                                placeholder="07:45:00 AM"
                                className="w-24 px-1.5 py-0.5 text-[11px] font-mono font-bold bg-white border border-slate-300 rounded text-slate-800"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-600 font-medium">
            {successMessage ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                {successMessage}
              </span>
            ) : (
              <span>Modifications will be safely recorded into local IndexedDB.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition"
            >
              Cancel
            </button>

            {!isToday && (
              <button
                onClick={handleSaveAll}
                disabled={isSaving}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4 text-amber-300" />
                <span>{isSaving ? 'Saving...' : 'Save & Update Attendance'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
