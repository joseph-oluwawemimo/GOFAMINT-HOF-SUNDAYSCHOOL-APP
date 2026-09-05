import React, { useState, useMemo, useEffect } from 'react';
import { 
  WorkerProfile, 
  WorkerAttendanceRecord, 
  WorkerPrepAttendanceRecord 
} from '../../types';
import { 
  User, QrCode, Calendar, Clock, CheckCircle2, AlertTriangle, 
  Printer, Download, ShieldCheck, Sparkles, BookOpen, Search
} from 'lucide-react';
import QRCode from 'qrcode';
import { GofamintLogo } from '../GofamintLogo';

interface WorkerMyAttendanceViewProps {
  workers: WorkerProfile[];
  sundayAttendance: WorkerAttendanceRecord[];
  prepAttendance: WorkerPrepAttendanceRecord[];
  onViewQrPass: (worker: WorkerProfile) => void;
}

export const WorkerMyAttendanceView: React.FC<WorkerMyAttendanceViewProps> = ({
  workers,
  sundayAttendance,
  prepAttendance,
  onViewQrPass
}) => {
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(
    workers[0]?.id || ''
  );
  const [searchFilter, setSearchFilter] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const selectedWorker = useMemo(() => {
    return workers.find(w => w.id === selectedWorkerId) || workers[0] || null;
  }, [workers, selectedWorkerId]);

  // Generate QR Code data url for current selected worker
  useEffect(() => {
    if (selectedWorker) {
      const payload = selectedWorker.qrCodeToken || selectedWorker.id;
      QRCode.toDataURL(payload, {
        width: 250,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      }).then(url => {
        setQrDataUrl(url);
      }).catch(err => {
        console.error('QR generation error:', err);
      });
    }
  }, [selectedWorker]);

  // Sunday attendance records for this worker
  const workerSundayRecords = useMemo(() => {
    if (!selectedWorker) return [];
    const targetName = (selectedWorker.fullName || '').toLowerCase();
    return sundayAttendance
      .filter(a => a.workerId === selectedWorker.id || (a.workerName && a.workerName.toLowerCase() === targetName))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [sundayAttendance, selectedWorker]);

  // Prep attendance records for this worker
  const workerPrepRecords = useMemo(() => {
    if (!selectedWorker) return [];
    const targetName = (selectedWorker.fullName || '').toLowerCase();
    return prepAttendance
      .filter(p => p.workerId === selectedWorker.id || (p.workerName && p.workerName.toLowerCase() === targetName))
      .sort((a, b) => new Date(b.prepDate).getTime() - new Date(a.prepDate).getTime());
  }, [prepAttendance, selectedWorker]);

  // Performance metrics
  const sundayTotal = workerSundayRecords.length;
  const sundayOnTime = workerSundayRecords.filter(r => r.status === 'PRESENT' && !r.isLate).length;
  const sundayLate = workerSundayRecords.filter(r => r.isLate || r.status === 'LATE').length;
  const punctualityScore = sundayTotal > 0 ? Math.round((sundayOnTime / sundayTotal) * 100) : 100;

  const prepTotal = workerPrepRecords.length;
  const prepPresent = workerPrepRecords.filter(p => p.status === 'PRESENT' || p.status === 'LATE').length;
  const prepScore = prepTotal > 0 ? Math.round((prepPresent / prepTotal) * 100) : 100;

  const filterTerm = (searchFilter || '').toLowerCase();
  const filteredWorkerOptions = workers.filter(w => 
    (w.fullName || '').toLowerCase().includes(filterTerm) ||
    (w.department || '').toLowerCase().includes(filterTerm)
  );

  if (!selectedWorker) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
        No workers available. Please register workers first.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 rounded-full text-xs font-black uppercase tracking-wider">
              Personal Portal
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              Worker Attendance Profile
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-['Cinzel',serif] tracking-tight mt-1">
            My Attendance History & Digital Pass
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mt-1">
            Review your personal Sunday service clock-in records, Saturday preparatory attendance, and digital QR ID pass.
          </p>
        </div>

        {/* Worker Switcher Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 p-2 border border-slate-200 rounded-2xl">
          <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5 px-2">
            <User className="w-3.5 h-3.5 text-blue-900" />
            <span>Select Worker:</span>
          </div>
          <select
            value={selectedWorkerId}
            onChange={e => setSelectedWorkerId(e.target.value)}
            className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-hidden focus:ring-2 focus:ring-blue-600 cursor-pointer max-w-xs"
          >
            {workers.map(w => (
              <option key={w.id} value={w.id}>
                {w.fullName} ({w.department})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Left ID Badge Card, Right Stats & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Personal Digital ID & QR Pass */}
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-md text-center space-y-5 flex flex-col justify-between">
          
          <div className="space-y-4">
            {/* Header */}
            <div className="border-b pb-3 border-amber-500 space-y-1">
              <div className="flex justify-center">
                <GofamintLogo size={56} />
              </div>
              <h2 className="text-xs font-black text-slate-900 uppercase font-['Cinzel',serif] tracking-wider">
                The Gospel Faith Mission Int.
              </h2>
              <span className="inline-block px-2.5 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-black uppercase rounded-md">
                {selectedWorker.department}
              </span>
            </div>

            {/* Name & Roles */}
            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900 font-['Cinzel',serif]">
                {selectedWorker.fullName}
              </h3>
              <div className="flex flex-wrap items-center justify-center gap-1">
                {selectedWorker.categories.map((c, i) => (
                  <span key={i} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            {/* QR Code Container */}
            <div className="p-4 bg-slate-50 border-2 border-slate-900 rounded-2xl inline-block shadow-inner">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="w-40 h-40 mx-auto rounded-lg"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400">
                  Generating QR...
                </div>
              )}
              <div className="mt-2 font-mono font-black text-xs text-slate-800 tracking-wider">
                {selectedWorker.qrCodeToken}
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-snug">
              Present this pass at Sunday clock-in terminals for instant attendance logging.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2">
            <button
              onClick={() => onViewQrPass(selectedWorker)}
              className="w-full py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span>Full Print Badge</span>
            </button>
          </div>

        </div>

        {/* Right Column: Attendance Analytics & History Records */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Performance Gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Sunday Punctuality Score */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  Sunday Punctuality Score
                </span>
                <span className="text-xl font-black text-emerald-600 font-mono">
                  {punctualityScore}%
                </span>
              </div>

              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                  style={{ width: `${punctualityScore}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>Total Services: <strong>{sundayTotal}</strong></span>
                <span>On-Time: <strong className="text-emerald-700">{sundayOnTime}</strong></span>
                <span>Late: <strong className="text-amber-700">{sundayLate}</strong></span>
              </div>
            </div>

            {/* Preparatory Class Score */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-blue-900" />
                  Preparatory Class Attendance
                </span>
                <span className="text-xl font-black text-blue-900 font-mono">
                  {prepScore}%
                </span>
              </div>

              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-900 rounded-full transition-all duration-500"
                  style={{ width: `${prepScore}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>Classes Held: <strong>{prepTotal}</strong></span>
                <span>Attended: <strong className="text-blue-900">{prepPresent}</strong></span>
                <span>Excused: <strong>{workerPrepRecords.filter(p => p.status === 'EXCUSED').length}</strong></span>
              </div>
            </div>

          </div>

          {/* Sunday Service Clock-In History Log */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 font-['Cinzel',serif] uppercase flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-900" />
                Sunday Service Clock-In History ({workerSundayRecords.length})
              </h3>
            </div>

            {workerSundayRecords.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                No Sunday clock-in records logged yet for {selectedWorker.fullName}.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Service Date</th>
                      <th className="py-2.5 px-3">Clock-In Time</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {workerSundayRecords.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{rec.serviceDate}</td>
                        <td className="py-2.5 px-3 font-mono text-blue-900">{rec.clockInTime}</td>
                        <td className="py-2.5 px-3 text-slate-500">{rec.method}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            rec.status === 'LATE' || rec.isLate
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Saturday Preparatory Attendance Log */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-black text-slate-900 font-['Cinzel',serif] uppercase flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-600" />
              Saturday Preparatory History ({workerPrepRecords.length})
            </h3>

            {workerPrepRecords.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                No Preparatory Class records logged yet.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Date / Session</th>
                      <th className="py-2.5 px-3">Lesson Week</th>
                      <th className="py-2.5 px-3">Syllabus Status</th>
                      <th className="py-2.5 px-3 text-right">Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {workerPrepRecords.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{p.prepDate}</td>
                        <td className="py-2.5 px-3 text-slate-600">Week {p.weekNumber || 1}</td>
                        <td className="py-2.5 px-3">
                          {p.syllabusPrepared ? (
                            <span className="text-emerald-700 font-bold text-[11px]">Prepared</span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">N/A</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            p.status === 'PRESENT'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : p.status === 'LATE'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : p.status === 'EXCUSED'
                              ? 'bg-blue-100 text-blue-900 border border-blue-300'
                              : 'bg-rose-100 text-rose-900 border border-rose-300'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
