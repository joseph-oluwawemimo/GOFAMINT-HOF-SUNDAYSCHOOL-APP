import React, { useState, useEffect } from 'react';
import { WorkerProfile } from '../../types';
import { X, Printer, CheckSquare, Square, Filter, Layers, Check, Scissors } from 'lucide-react';
import QRCode from 'qrcode';

interface BatchWorkerQrPrintModalProps {
  isOpen: boolean;
  workers: WorkerProfile[];
  onClose: () => void;
}

export const BatchWorkerQrPrintModal: React.FC<BatchWorkerQrPrintModalProps> = ({
  isOpen,
  workers,
  onClose
}) => {
  const activeWorkers = workers.filter(w => w.status === 'ACTIVE');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [qrMap, setQrMap] = useState<Map<string, string>>(new Map());

  // Derive unique departments
  const departments = Array.from(new Set(activeWorkers.map(w => w.department).filter(Boolean)));

  // Filtered workers based on department tab
  const displayedWorkers = selectedDept === 'ALL'
    ? activeWorkers
    : activeWorkers.filter(w => w.department === selectedDept);

  // Initialize all selected when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedWorkerIds(new Set(activeWorkers.map(w => w.id)));
    }
  }, [isOpen, workers]);

  // Pre-generate QR codes for selected workers
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    async function generateAllQrs() {
      const map = new Map<string, string>();
      for (const w of activeWorkers) {
        try {
          const payload = w.qrCodeToken || w.id;
          const url = await QRCode.toDataURL(payload, {
            width: 160,
            margin: 1,
            color: { dark: '#0f172a', light: '#ffffff' }
          });
          map.set(w.id, url);
        } catch (err) {
          console.error('Error generating QR for worker:', w.fullName, err);
        }
      }
      if (isMounted) {
        setQrMap(map);
      }
    }

    generateAllQrs();
    return () => {
      isMounted = false;
    };
  }, [isOpen, workers]);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedWorkerIds.size === displayedWorkers.length) {
      setSelectedWorkerIds(new Set());
    } else {
      setSelectedWorkerIds(new Set(displayedWorkers.map(w => w.id)));
    }
  };

  const toggleWorker = (id: string) => {
    const next = new Set(selectedWorkerIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedWorkerIds(next);
  };

  const selectedList = activeWorkers.filter(w => selectedWorkerIds.has(w.id));
  const estimatedPages = Math.ceil(selectedList.length / 10);

  // Print Handler
  const handlePrint = () => {
    if (selectedList.length === 0) {
      alert('Please select at least one worker to print.');
      return;
    }

    setIsGenerating(true);

    try {
      const printWindow = window.open('', '_blank', 'width=950,height=900');
      if (!printWindow) {
        alert('Pop-up blocked. Please allow pop-ups for this site to print badges.');
        setIsGenerating(false);
        return;
      }

      // Group workers into pages of 10 (2 columns x 5 rows)
      const pages: WorkerProfile[][] = [];
      for (let i = 0; i < selectedList.length; i += 10) {
        pages.push(selectedList.slice(i, i + 10));
      }

      let htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>GOFAMINT HOF - Worker QR Pass Badges (A4 Sheet Cutouts)</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 8mm 6mm;
              }
              * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #ffffff;
                color: #0f172a;
              }
              .page-sheet {
                width: 100%;
                page-break-after: always;
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                grid-template-rows: repeat(5, 54mm);
                gap: 3mm;
                box-sizing: border-box;
                height: 280mm;
              }
              .page-sheet:last-child {
                page-break-after: avoid;
              }
              .badge-card {
                border: 1.5px dashed #64748b;
                border-radius: 8px;
                padding: 6px 8px;
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: space-between;
                background: #ffffff;
                position: relative;
                overflow: hidden;
                height: 52mm;
                box-sizing: border-box;
              }
              .cut-guide {
                position: absolute;
                top: 2px;
                right: 4px;
                font-size: 8px;
                color: #94a3b8;
                font-weight: bold;
                letter-spacing: 0.5px;
              }
              .badge-left {
                flex: 1;
                padding-right: 6px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                height: 100%;
              }
              .badge-header {
                border-bottom: 1px solid #e2e8f0;
                padding-bottom: 3px;
                margin-bottom: 2px;
              }
              .church-brand {
                font-size: 8.5px;
                font-weight: 900;
                color: #1e3a8a;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                line-height: 1.1;
              }
              .sub-brand {
                font-size: 7px;
                font-weight: 700;
                color: #b45309;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .worker-name {
                font-size: 11px;
                font-weight: 900;
                color: #0f172a;
                line-height: 1.15;
                margin: 2px 0;
                word-break: break-word;
              }
              .dept-pill {
                display: inline-block;
                background: #eff6ff;
                border: 1px solid #bfdbfe;
                color: #1e40af;
                font-size: 8px;
                font-weight: 800;
                padding: 1.5px 5px;
                border-radius: 4px;
                text-transform: uppercase;
                margin-top: 1px;
              }
              .duty-text {
                font-size: 8px;
                font-weight: 700;
                color: #475569;
                margin-top: 2px;
              }
              .badge-footer {
                border-top: 1px dotted #cbd5e1;
                padding-top: 2px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 7.5px;
                font-family: monospace;
                color: #64748b;
              }
              .badge-right {
                width: 38mm;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-left: 1px solid #e2e8f0;
                padding-left: 4px;
              }
              .qr-img {
                width: 33mm;
                height: 33mm;
                display: block;
              }
              .qr-token {
                font-family: monospace;
                font-size: 7.5px;
                font-weight: 900;
                color: #0f172a;
                text-align: center;
                margin-top: 2px;
                letter-spacing: 0.5px;
              }
              .scan-prompt {
                font-size: 6.5px;
                color: #94a3b8;
                text-transform: uppercase;
                font-weight: 700;
              }
            </style>
          </head>
          <body>
      `;

      for (const pageWorkers of pages) {
        htmlContent += `<div class="page-sheet">`;
        for (const w of pageWorkers) {
          const qrData = qrMap.get(w.id) || '';
          htmlContent += `
            <div class="badge-card">
              <span class="cut-guide">✂ CUT</span>
              <div class="badge-left">
                <div class="badge-header">
                  <div class="church-brand">GOFAMINT HOUSE OF FAVOUR</div>
                  <div class="sub-brand">Workers Directorate • Official ID Pass</div>
                </div>

                <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                  <div class="worker-name">${w.fullName}</div>
                  <div>
                    <span class="dept-pill">${w.department}</span>
                  </div>
                  <div class="duty-text">
                    ${w.duty || (w.categories && w.categories[0]) || 'Worker'}${w.assignedClass && w.assignedClass !== '-' ? ` • ${w.assignedClass}` : ''}
                  </div>
                </div>

                <div class="badge-footer">
                  <span>${w.phone ? w.phone : 'ID: ' + w.id.slice(-6).toUpperCase()}</span>
                  <span>SUNDAY / THURSDAY</span>
                </div>
              </div>

              <div class="badge-right">
                <img src="${qrData}" class="qr-img" alt="QR Code" />
                <div class="qr-token">${w.qrCodeToken || w.id.slice(-8)}</div>
                <div class="scan-prompt">TAP / SCAN TO CLOCK-IN</div>
              </div>
            </div>
          `;
        }
        htmlContent += `</div>`;
      }

      htmlContent += `
            <script>
              window.onload = function() {
                window.focus();
                window.print();
              };
            </script>
          </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } catch (err) {
      console.error('Failed to open batch print window:', err);
      alert('Error printing badges: ' + err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black font-['Cinzel',serif] tracking-wide">
                Mass QR Code Pass Generator (10 Badges per A4 Page)
              </h3>
              <p className="text-xs text-slate-400">
                Print multiple workers' clock-in badges on A4 sheets with dashed scissor cutout guides.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Selection Controls */}
        <div className="p-4 px-6 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Department Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedDept('ALL')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                selectedDept === 'ALL'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Departments ({activeWorkers.length})
            </button>
            {departments.map(dept => {
              const count = activeWorkers.filter(w => w.department === dept).length;
              return (
                <button
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    selectedDept === dept
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {dept} ({count})
                </button>
              );
            })}
          </div>

          {/* Bulk Select / Deselect Button */}
          <button
            onClick={toggleSelectAll}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            {selectedWorkerIds.size === displayedWorkers.length ? (
              <>
                <CheckSquare className="w-4 h-4 text-blue-900" />
                <span>Deselect All</span>
              </>
            ) : (
              <>
                <Square className="w-4 h-4 text-slate-400" />
                <span>Select All ({displayedWorkers.length})</span>
              </>
            )}
          </button>
        </div>

        {/* Worker Checklist Grid */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider px-1">
            <span>{displayedWorkers.length} Workers in Roster</span>
            <span className="text-blue-900 font-black">
              {selectedList.length} Selected • ~{estimatedPages} A4 {estimatedPages === 1 ? 'Sheet' : 'Sheets'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {displayedWorkers.map(worker => {
              const isChecked = selectedWorkerIds.has(worker.id);
              return (
                <div
                  key={worker.id}
                  onClick={() => toggleWorker(worker.id)}
                  className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                    isChecked
                      ? 'bg-blue-50/70 border-blue-300 text-slate-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by parent div
                      className="rounded text-blue-900 w-4 h-4"
                    />
                    <div className="truncate">
                      <div className="font-bold text-xs truncate">{worker.fullName}</div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {worker.department} • {worker.duty || 'Worker'}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {worker.qrCodeToken ? worker.qrCodeToken.slice(0, 8) : worker.id.slice(-6)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer / Print Action */}
        <div className="p-4 px-6 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-600">
            <strong>{selectedList.length}</strong> badges ready to print. 
            Formatted in a <strong>2-column × 5-row</strong> grid with cut lines for standard A4 cardstock.
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handlePrint}
              disabled={selectedList.length === 0 || isGenerating}
              className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-black text-xs transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Print A4 Cutout Sheet ({selectedList.length})</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
