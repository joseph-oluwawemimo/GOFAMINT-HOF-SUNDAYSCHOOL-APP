import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePersistedState } from '../../hooks/usePersistedState';
import { useScrollRestoration } from '../../hooks/useScrollRestoration';
import { WorkerProfile, WorkerCategoryDef } from '../../types';
import { 
  Search, Plus, Upload, Filter, QrCode, Phone, MessageSquare, 
  MapPin, Edit, Trash2, CheckCircle2, XCircle, Printer, Sparkles,
  Users, Check, ExternalLink, ChevronRight, Download, BookOpen, Tag, Hash,
  Archive, ArchiveRestore, AlertTriangle, RefreshCw
} from 'lucide-react';
import { BatchWorkerQrPrintModal } from './BatchWorkerQrPrintModal';
import { calculateWorkerProfileCompleteness } from '../../utils/workerProfileUtils';

interface WorkersDirectoryViewProps {
  workers: WorkerProfile[];
  categoriesList: WorkerCategoryDef[];
  departmentsList: string[];
  onAddWorker: () => void;
  onBulkImport: () => void;
  onEditWorker: (worker: WorkerProfile) => void;
  onDeleteWorker: (id: string) => void;
  onSaveWorkerProfile?: (worker: WorkerProfile) => Promise<void>;
  onViewQrPass: (worker: WorkerProfile) => void;
  onQuickClockIn: (worker: WorkerProfile) => void;
  onNavigateToTab: (tab: any) => void;
}

export const WorkersDirectoryView: React.FC<WorkersDirectoryViewProps> = ({
  workers,
  categoriesList,
  departmentsList,
  onAddWorker,
  onBulkImport,
  onEditWorker,
  onDeleteWorker,
  onSaveWorkerProfile,
  onViewQrPass,
  onQuickClockIn,
  onNavigateToTab
}) => {
  useScrollRestoration('workers_directory');
  const [searchQuery, setSearchQuery] = usePersistedState<string>('gofamint_workers_search', '');
  const [selectedDept, setSelectedDept] = usePersistedState<string>('gofamint_workers_dept', 'ALL');
  const [selectedCategory, setSelectedCategory] = usePersistedState<string>('gofamint_workers_cat', 'ALL');
  const [selectedStatus, setSelectedStatus] = usePersistedState<string>('gofamint_workers_status', 'ALL');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showBatchQrModal, setShowBatchQrModal] = useState<boolean>(false);
  const [selectedMobileWorker, setSelectedMobileWorker] = useState<WorkerProfile | null>(null);

  // Archive & Restore Modals
  const [archiveModalWorker, setArchiveModalWorker] = useState<WorkerProfile | null>(null);
  const [archiveReason, setArchiveReason] = useState('Relocated / Moved to new city');
  const [restoreConfirmWorker, setRestoreConfirmWorker] = useState<WorkerProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filtered workers
  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch = 
        (w.fullName || '').toLowerCase().includes(q) ||
        (w.sn ? String(w.sn).toLowerCase().includes(q) : false) ||
        (w.gender ? w.gender.toLowerCase().includes(q) : false) ||
        (w.assignedClass ? w.assignedClass.toLowerCase().includes(q) : false) ||
        (w.duty ? w.duty.toLowerCase().includes(q) : false) ||
        (w.archiveReason ? w.archiveReason.toLowerCase().includes(q) : false) ||
        (w.phone || '').includes(searchQuery || '') ||
        (w.whatsappNumber || '').includes(searchQuery || '') ||
        (w.address || '').toLowerCase().includes(q) ||
        (w.qrCodeToken || '').toLowerCase().includes(q) ||
        (w.categories || []).some(c => (c || '').toLowerCase().includes(q));

      const matchesDept = selectedDept === 'ALL' || w.department === selectedDept;
      const matchesCategory = selectedCategory === 'ALL' || w.categories.includes(selectedCategory) || w.duty === selectedCategory;
      const matchesStatus = selectedStatus === 'ALL' || w.status === selectedStatus;

      return matchesSearch && matchesDept && matchesCategory && matchesStatus;
    });
  }, [workers, searchQuery, selectedDept, selectedCategory, selectedStatus]);

  // Statistics
  const activeCount = workers.filter(w => w.status === 'ACTIVE').length;
  const inactiveCount = workers.filter(w => w.status === 'INACTIVE').length;
  const archivedCount = workers.filter(w => w.status === 'ARCHIVED').length;

  const handlePrintDirectory = () => {
    window.print();
  };

  const handleConfirmArchive = async () => {
    if (!archiveModalWorker || !onSaveWorkerProfile) return;
    setIsProcessing(true);
    try {
      const updated: WorkerProfile = {
        ...archiveModalWorker,
        status: 'ARCHIVED',
        archivedAt: new Date().toISOString(),
        archiveReason: archiveReason.trim(),
        updatedAt: new Date().toISOString()
      };
      await onSaveWorkerProfile(updated);
      setArchiveModalWorker(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreConfirmWorker || !onSaveWorkerProfile) return;
    setIsProcessing(true);
    try {
      const updated: WorkerProfile = {
        ...restoreConfirmWorker,
        status: 'ACTIVE',
        archivedAt: undefined,
        archiveReason: undefined,
        updatedAt: new Date().toISOString()
      };
      await onSaveWorkerProfile(updated);
      setRestoreConfirmWorker(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportCsv = () => {
    if (workers.length === 0) return;

    // Header: S/N,Name,Sex,Department,Class,Duty,Status,Archive Reason,Phone Number,WhatsApp Number,Address
    const rows = [
      ['S/N', 'Name', 'Sex', 'Department', 'Class', 'Duty', 'Status', 'Archive Reason', 'Phone Number', 'WhatsApp Number', 'Address']
    ];

    workers.forEach((w, index) => {
      rows.push([
        String(w.sn || index + 1),
        `"${w.fullName.replace(/"/g, '""')}"`,
        w.gender === 'FEMALE' ? 'Female' : 'Male',
        `"${w.department.replace(/"/g, '""')}"`,
        `"${(w.assignedClass || '-').replace(/"/g, '""')}"`,
        `"${(w.duty || w.categories[0] || 'Class Teacher').replace(/"/g, '""')}"`,
        w.status,
        `"${(w.archiveReason || '').replace(/"/g, '""')}"`,
        `"${w.phone}"`,
        `"${w.whatsappNumber || w.phone}"`,
        `"${w.address.replace(/"/g, '""')}"`
      ]);
    });

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gofamint_workers_directory_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getWhatsAppLink = (phone: string, name: string) => {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '234' + clean.slice(1);
    }
    const message = encodeURIComponent(`Calvary greetings ${name}, from GOFAMINT_HOF Sunday School & Workers Directorate.`);
    return `https://wa.me/${clean}?text=${message}`;
  };

  return (
    <div className="workers-page workers-page-directory space-y-5 sm:space-y-6 animate-fade-in">
      
      {/* Top Banner & Quick Metrics */}
      <div className="workers-page-hero bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 rounded-full text-xs font-black uppercase tracking-wider">
              Master Directory
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              The Gospel Faith Mission Int.
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-['Cinzel',serif] tracking-tight mt-1">
            Workers & Ministers Register
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mt-1">
            Standard 9-column directory: S/N, Name, Sex, Department, Class, Duty, Phone, WhatsApp, and Address.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigateToTab('SUNDAY_CLOCK_IN')}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Sunday Clock-In</span>
          </button>

          <button
            onClick={onBulkImport}
            className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition"
          >
            <Upload className="w-4 h-4 text-amber-300" />
            <span>Import Workers</span>
          </button>

          <button
            onClick={onAddWorker}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Worker</span>
          </button>

          {workers.length > 0 && (
            <button
              onClick={() => setShowBatchQrModal(true)}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition cursor-pointer"
              title="Print 10 QR clock-in badges per A4 sheet with cut lines"
            >
              <QrCode className="w-4 h-4 text-amber-300" />
              <span>Print Badges (10/A4)</span>
            </button>
          )}

          {workers.length > 0 && (
            <button
              onClick={handleExportCsv}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              title="Export to CSV (S/N, Name, Sex, Department, Class, Duty, Contacts)"
            >
              <Download className="w-4 h-4 text-blue-900" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}

          <button
            onClick={handlePrintDirectory}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            title="Print Directory"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metric Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div 
          onClick={() => setSelectedStatus('ALL')}
          className={`bg-white border rounded-xl p-4 shadow-xs cursor-pointer transition ${selectedStatus === 'ALL' ? 'border-blue-600 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Registered</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{workers.length}</div>
          <span className="text-[10px] text-slate-400">All directory profiles</span>
        </div>

        <div 
          onClick={() => setSelectedStatus('ACTIVE')}
          className={`bg-white border rounded-xl p-4 shadow-xs cursor-pointer transition ${selectedStatus === 'ACTIVE' ? 'border-emerald-600 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-emerald-300'}`}
        >
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Active Workers</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">{activeCount}</div>
          <span className="text-[10px] text-emerald-600">On active weekly duty</span>
        </div>

        <div 
          onClick={() => setSelectedStatus('INACTIVE')}
          className={`bg-white border rounded-xl p-4 shadow-xs cursor-pointer transition ${selectedStatus === 'INACTIVE' ? 'border-slate-600 ring-2 ring-slate-200' : 'border-slate-200 hover:border-slate-400'}`}
        >
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Inactive / Leave</span>
          <div className="text-2xl font-black text-slate-600 mt-1">{inactiveCount}</div>
          <span className="text-[10px] text-slate-400">Temporarily off-duty</span>
        </div>

        <div 
          onClick={() => setSelectedStatus('ARCHIVED')}
          className={`bg-amber-50/50 border rounded-xl p-4 shadow-xs cursor-pointer transition ${selectedStatus === 'ARCHIVED' ? 'border-amber-600 ring-2 ring-amber-200 bg-amber-50' : 'border-amber-200 hover:border-amber-400'}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">Archived Workers</span>
            <Archive className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-2xl font-black text-amber-800 mt-1">{archivedCount}</div>
          <span className="text-[10px] text-amber-700 font-semibold">Relocated / Out of country</span>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by worker name, S/N, department, class, duty, archive reason, phone, address..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-hidden"
            />
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 border border-slate-200 rounded-xl text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500 font-medium">Dept:</span>
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="bg-transparent font-bold text-slate-800 outline-hidden cursor-pointer"
            >
              <option value="ALL">All Departments ({workers.length})</option>
              {departmentsList.map(dept => {
                const count = workers.filter(w => w.department === dept).length;
                return (
                  <option key={dept} value={dept}>
                    {dept} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 border border-slate-200 rounded-xl text-xs">
            <span className="text-slate-500 font-medium">Role:</span>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-transparent font-bold text-slate-800 outline-hidden cursor-pointer max-w-[140px]"
            >
              <option value="ALL">All Roles</option>
              {categoriesList.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 border border-slate-200 rounded-xl text-xs">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="bg-transparent font-bold text-slate-800 outline-hidden cursor-pointer"
            >
              <option value="ALL">All Records ({workers.length})</option>
              <option value="ACTIVE">Active Workers ({activeCount})</option>
              <option value="INACTIVE">Inactive / Leave ({inactiveCount})</option>
              <option value="ARCHIVED">Archived ({archivedCount})</option>
            </select>
          </div>

        </div>

        {/* Active Filter Chips Bar */}
        {(selectedDept !== 'ALL' || selectedCategory !== 'ALL' || selectedStatus !== 'ALL' || searchQuery) && (
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Filtered:</span>
              <span className="font-bold text-blue-900">{filteredWorkers.length} of {workers.length} workers</span>
            </div>
            <button
              onClick={() => {
                setSelectedDept('ALL');
                setSelectedCategory('ALL');
                setSelectedStatus('ALL');
                setSearchQuery('');
              }}
              className="text-blue-700 hover:text-blue-900 font-bold"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Workers Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {filteredWorkers.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Users className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-800">
                No Workers Found
              </h3>
              <p className="text-xs text-slate-500">
                {workers.length === 0 
                  ? 'There are currently no registered workers. Use the buttons above to import workers using S/N, Name, Sex, Department, Class, Duty, Phone Number, WhatsApp Number, Address.'
                  : 'No workers matched your active filter or search terms.'}
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={onBulkImport}
                className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
              >
                <Upload className="w-4 h-4 text-amber-300" />
                <span>Import Workers</span>
              </button>
              <button
                onClick={onAddWorker}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Single Worker</span>
              </button>
            </div>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 gap-3 md:hidden" aria-label="Workers directory cards">
            {filteredWorkers.map(worker => {
              const initials = worker.fullName.split(' ').filter(Boolean).map(name => name[0]).slice(0, 2).join('') || 'W';
              return (
                <button
                  type="button"
                  key={worker.id}
                  onClick={() => setSelectedMobileWorker(worker)}
                  className="group w-full rounded-3xl border border-blue-100 bg-white p-4 text-left shadow-[0_12px_32px_rgba(15,42,85,0.08)] transition active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-950 text-sm font-black text-white ring-2 ring-amber-300/70">
                      {worker.photoBase64 ? <img src={worker.photoBase64} alt="" className="h-full w-full object-cover" /> : initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0"><strong className="block truncate text-sm text-blue-950">{worker.fullName}</strong><span className="mt-0.5 block truncate text-[10px] font-bold text-slate-500">{worker.department}</span></span>
                        <span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase ${worker.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : worker.status === 'ARCHIVED' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{worker.status}</span>
                      </span>
                      <span className="mt-3 grid grid-cols-3 gap-2">
                        <span className="rounded-xl bg-slate-50 p-2"><span className="block text-[8px] font-black uppercase text-slate-400">Sex</span><span className="mt-0.5 block truncate text-[10px] font-bold text-slate-700">{worker.gender || '—'}</span></span>
                        <span className="rounded-xl bg-slate-50 p-2"><span className="block text-[8px] font-black uppercase text-slate-400">Class</span><span className="mt-0.5 block truncate text-[10px] font-bold text-slate-700">{worker.assignedClass || '—'}</span></span>
                        <span className="rounded-xl bg-slate-50 p-2"><span className="block text-[8px] font-black uppercase text-slate-400">Duty</span><span className="mt-0.5 block truncate text-[10px] font-bold text-slate-700">{worker.duty || worker.categories[0] || 'Worker'}</span></span>
                      </span>
                      <span className="mt-3 flex items-center justify-end gap-1 text-[10px] font-black text-red-600">View profile <ChevronRight className="h-3.5 w-3.5" /></span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs border-collapse min-w-[980px]">
              <thead className="bg-slate-900 text-amber-300 font-bold uppercase tracking-wider border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="py-3 px-3 text-center w-12">S/N</th>
                  <th className="py-3 px-4">Worker Name</th>
                  <th className="py-3 px-3 text-center">Sex</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-3">Class</th>
                  <th className="py-3 px-4">Duty & Roles</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {filteredWorkers.map((worker, index) => {
                  const initials = worker.fullName
                    .split(' ')
                    .filter(n => !n.includes('.'))
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('') || 'W';

                  return (
                    <tr key={worker.id} className="hover:bg-slate-50/80 transition group">
                      
                      {/* S/N */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-500 text-[11px]">
                        {worker.sn || index + 1}
                      </td>

                      {/* Worker Profile */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-900 text-amber-300 font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">
                              {worker.fullName}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                {worker.qrCodeToken}
                              </span>
                              {(() => {
                                const comp = calculateWorkerProfileCompleteness(worker);
                                return (
                                  <span 
                                    className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${
                                      comp.percentage >= 80 
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                                        : comp.percentage >= 50
                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                        : 'bg-rose-50 text-rose-800 border-rose-300'
                                    }`}
                                    title={`Profile Completeness: ${comp.percentage}%. Missing: ${comp.missingFields.join(', ')}`}
                                  >
                                    {comp.percentage}% Profile
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Sex */}
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          worker.gender === 'FEMALE' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {worker.gender === 'FEMALE' ? 'Female' : 'Male'}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-900 font-bold rounded-md text-[11px] border border-blue-200">
                          {worker.department}
                        </span>
                      </td>

                      {/* Class */}
                      <td className="py-3 px-3">
                        {worker.assignedClass && worker.assignedClass !== '-' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-900 font-semibold rounded text-[11px] border border-indigo-200">
                            <BookOpen className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span>{worker.assignedClass}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Duty & Roles */}
                      <td className="py-3 px-4 space-y-1">
                        <div className="font-semibold text-slate-900 text-[11px] flex items-center gap-1">
                          <Tag className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>{worker.duty || worker.categories[0] || 'Class Teacher'}</span>
                        </div>
                        {worker.categories.length > 1 && (
                          <div className="flex flex-wrap gap-1">
                            {worker.categories.filter(c => c !== worker.duty).map((cat, i) => (
                              <span key={i} className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[9px] font-medium border border-slate-200">
                                {cat}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Contact Info (Phone & WhatsApp) */}
                      <td className="py-3 px-4 space-y-1">
                        <div className="flex items-center gap-1.5 font-mono text-slate-800">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{worker.phone}</span>
                        </div>
                        {worker.whatsappNumber && (
                          <div className="flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <a
                              href={getWhatsAppLink(worker.whatsappNumber, worker.fullName)}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-emerald-700 hover:text-emerald-900 hover:underline inline-flex items-center gap-1 text-[11px]"
                              title="Chat on WhatsApp"
                            >
                              <span>{worker.whatsappNumber}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>
                          </div>
                        )}
                      </td>

                      {/* Address */}
                      <td className="py-3 px-4 max-w-[180px] text-slate-600 text-[11px] leading-snug">
                        <div className="flex items-start gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{worker.address || 'Assembly District'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        {worker.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Active
                          </span>
                        ) : worker.status === 'ARCHIVED' ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full font-black text-[10px]">
                              <Archive className="w-3 h-3 text-amber-700" />
                              Archived
                            </span>
                            {worker.archiveReason && (
                              <span className="text-[9px] text-amber-800 max-w-[120px] truncate" title={worker.archiveReason}>
                                {worker.archiveReason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-200 text-slate-700 border border-slate-300 rounded-full font-bold text-[10px]">
                            <XCircle className="w-3 h-3 text-slate-500" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {worker.status === 'ACTIVE' && (
                            <button
                              onClick={() => onQuickClockIn(worker)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg transition border border-emerald-200"
                              title="Quick Clock-In for Sunday"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onViewQrPass(worker)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-900 text-blue-800 hover:text-white rounded-lg transition border border-blue-200"
                            title="View & Print QR ID Pass"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onEditWorker(worker)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-800 text-slate-700 hover:text-white rounded-lg transition"
                            title="Edit Worker Profile"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Archive or Restore Toggle Button */}
                          {worker.status === 'ARCHIVED' ? (
                            <button
                              onClick={() => setRestoreConfirmWorker(worker)}
                              className="p-1.5 bg-amber-100 hover:bg-amber-600 text-amber-900 hover:text-white rounded-lg transition border border-amber-300"
                              title="Restore / Unarchive Worker back to Active Directory"
                            >
                              <ArchiveRestore className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setArchiveModalWorker(worker);
                                setArchiveReason(worker.archiveReason || 'Relocated / Moved to new city');
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-amber-600 text-slate-600 hover:text-white rounded-lg transition border border-slate-200"
                              title="Archive Worker (Relocated, Traveled, Transferred Church)"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => setDeleteConfirmId(worker.id)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-600 text-slate-400 hover:text-white rounded-lg transition"
                            title="Delete Worker"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {selectedMobileWorker && createPortal((
        <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/70 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-5" onClick={() => setSelectedMobileWorker(null)}>
          <section role="dialog" aria-modal="true" aria-label={`${selectedMobileWorker.fullName} worker profile`} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl md:max-w-lg md:rounded-3xl md:p-6" onClick={event => event.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 md:hidden" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-950 text-base font-black text-white ring-2 ring-amber-300">
                  {selectedMobileWorker.photoBase64 ? <img src={selectedMobileWorker.photoBase64} alt="" className="h-full w-full object-cover" /> : selectedMobileWorker.fullName.split(' ').filter(Boolean).map(name => name[0]).slice(0, 2).join('')}
                </span>
                <div className="min-w-0"><span className="text-[9px] font-black uppercase tracking-wider text-red-600">Worker profile</span><h2 className="truncate text-lg font-black text-blue-950">{selectedMobileWorker.fullName}</h2><p className="truncate text-xs font-bold text-slate-500">{selectedMobileWorker.department}</p></div>
              </div>
              <button type="button" onClick={() => setSelectedMobileWorker(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600" aria-label="Close worker profile"><XCircle className="h-5 w-5" /></button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
              {[
                ['Sex', selectedMobileWorker.gender || 'Not set'],
                ['Assigned class', selectedMobileWorker.assignedClass || 'Not set'],
                ['Primary duty', selectedMobileWorker.duty || selectedMobileWorker.categories[0] || 'Worker'],
                ['Status', selectedMobileWorker.status]
              ].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-3"><span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">{label}</span><strong className="mt-1 block text-slate-800">{value}</strong></div>)}
            </div>
            <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 p-4 text-xs">
              <div className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-blue-900" /><span className="font-semibold text-slate-700">{selectedMobileWorker.phone || 'No phone number'}</span></div>
              <div className="flex items-start gap-2"><MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><span className="font-semibold text-slate-700">{selectedMobileWorker.whatsappNumber || selectedMobileWorker.phone || 'No WhatsApp number'}</span></div>
              <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-600" /><span className="font-semibold leading-relaxed text-slate-700">{selectedMobileWorker.address || 'No address recorded'}</span></div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { onViewQrPass(selectedMobileWorker); setSelectedMobileWorker(null); }} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-950 px-3 text-xs font-black text-white"><QrCode className="h-4 w-4 text-amber-300" /> Print ID pass</button>
              <button type="button" onClick={() => { onEditWorker(selectedMobileWorker); setSelectedMobileWorker(null); }} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-3 text-xs font-black text-blue-950"><Edit className="h-4 w-4" /> Edit profile</button>
              {selectedMobileWorker.status === 'ACTIVE' && <button type="button" onClick={() => { onQuickClockIn(selectedMobileWorker); setSelectedMobileWorker(null); }} className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-red-600 px-3 text-xs font-black text-white"><CheckCircle2 className="h-4 w-4" /> Go to Sunday clock-in</button>}
            </div>
          </section>
        </div>
      ), document.body)}

      {/* Archive Modal */}
      {archiveModalWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Archive Worker Record
                </h3>
                <p className="text-xs text-slate-500">
                  {archiveModalWorker.fullName} • {archiveModalWorker.department}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-xs text-amber-950">
              <p className="leading-relaxed">
                Archiving a worker takes them off the active weekly ledgers, Sunday clock-in terminal, and future quarters (e.g. next quarter or 2nd quarter).
              </p>
              <p className="text-[11px] text-amber-800">
                Their historical attendance logs and ministry records remain permanently safe in the church database and can be unarchived at any time.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Reason for Archiving:
              </label>
              <select
                value={archiveReason}
                onChange={e => setArchiveReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
              >
                <option value="Relocated / Moved to new city">Relocated / Moved to new city or state</option>
                <option value="Traveled Abroad / Out of Country">Traveled Abroad / Relocated outside the country</option>
                <option value="Transferred to another Assembly">Transferred to another GOFAMINT_HOF Assembly</option>
                <option value="Withdrew from Workforce">Withdrew / No longer in active church workforce</option>
                <option value="Extended Inactivity / Undetermined Absence">Extended Inactivity / Prolonged absence</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                disabled={isProcessing}
                onClick={() => setArchiveModalWorker(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                disabled={isProcessing}
                onClick={handleConfirmArchive}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-2 shadow-sm"
              >
                <Archive className="w-4 h-4" />
                <span>{isProcessing ? 'Archiving...' : 'Archive Worker'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {restoreConfirmWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <ArchiveRestore className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Restore Worker to Active Status
                </h3>
                <p className="text-xs text-slate-500">
                  {restoreConfirmWorker.fullName} • {restoreConfirmWorker.department}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will restore <strong>{restoreConfirmWorker.fullName}</strong> back to the active church workers directory, allowing them to appear on upcoming weekly attendance rosters and Sunday clock-in terminals.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                disabled={isProcessing}
                onClick={() => setRestoreConfirmWorker(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                disabled={isProcessing}
                onClick={handleConfirmRestore}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
              >
                <ArchiveRestore className="w-4 h-4" />
                <span>{isProcessing ? 'Restoring...' : 'Restore to Active'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Confirm Worker Deletion
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove this worker from the Master Directory? Historical attendance records will be retained.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteWorker(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition"
              >
                Delete Worker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch QR Printable Modal (10 badges / A4) */}
      <BatchWorkerQrPrintModal
        isOpen={showBatchQrModal}
        workers={workers}
        onClose={() => setShowBatchQrModal(false)}
      />

    </div>
  );
};
