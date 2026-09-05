import React, { useEffect, useState, useRef } from 'react';
import { WorkerProfile } from '../../types';
import { X, Printer, Download, QrCode, Phone, MessageSquare, Briefcase, CheckCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { GofamintLogo } from '../GofamintLogo';

interface WorkerQrPassModalProps {
  isOpen: boolean;
  worker: WorkerProfile | null;
  onClose: () => void;
  onQuickClockIn?: (worker: WorkerProfile) => void;
}

export const WorkerQrPassModal: React.FC<WorkerQrPassModalProps> = ({
  isOpen,
  worker,
  onClose,
  onQuickClockIn
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const badgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (worker) {
      // Generate QR Code with standard JSON or direct token payload
      const payload = worker.qrCodeToken || worker.id;
      QRCode.toDataURL(payload, {
        width: 320,
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
  }, [worker]);

  if (!isOpen || !worker) return null;

  const handlePrint = () => {
    if (!worker || !qrDataUrl) {
      window.print();
      return;
    }

    try {
      const printWindow = window.open('', '_blank', 'width=650,height=850');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>GOFAMINT_HOF Worker Badge - ${worker.fullName}</title>
              <style>
                @page {
                  size: auto;
                  margin: 10mm;
                }
                * {
                  box-sizing: border-box;
                }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  margin: 0;
                  background-color: #ffffff;
                  color: #0f172a;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                .badge-card {
                  width: 360px;
                  background: #ffffff;
                  border: 2px solid #0f172a;
                  border-radius: 20px;
                  padding: 24px;
                  text-align: center;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                  page-break-inside: avoid;
                }
                .header-logo {
                  border-bottom: 2px solid #f59e0b;
                  padding-bottom: 12px;
                  margin-bottom: 14px;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                }
                .logo-img {
                  width: 44px;
                  height: 44px;
                  margin: 0 auto 6px auto;
                  display: block;
                }
                .church-title {
                  font-size: 12px;
                  font-weight: 900;
                  text-transform: uppercase;
                  letter-spacing: 1.5px;
                  color: #0f172a;
                  margin: 6px 0 2px 0;
                }
                .dept-subtitle {
                  font-size: 9px;
                  font-weight: 800;
                  text-transform: uppercase;
                  letter-spacing: 1px;
                  color: #92400e;
                  margin: 0;
                }
                .dept-pill {
                  display: inline-block;
                  padding: 4px 12px;
                  background: #dbeafe;
                  color: #1e3a8a;
                  font-size: 11px;
                  font-weight: 900;
                  text-transform: uppercase;
                  border-radius: 6px;
                  border: 1px solid #bfdbfe;
                  margin-bottom: 8px;
                }
                .worker-name {
                  font-size: 20px;
                  font-weight: 900;
                  color: #0f172a;
                  margin: 4px 0 6px 0;
                  line-height: 1.2;
                }
                .role-pill {
                  display: inline-block;
                  font-size: 10px;
                  font-weight: 700;
                  color: #78350f;
                  background: #fef3c7;
                  border: 1px solid #fde68a;
                  padding: 2px 10px;
                  border-radius: 9999px;
                  margin-bottom: 12px;
                }
                .qr-box {
                  background: #f8fafc;
                  border: 2px solid #0f172a;
                  border-radius: 16px;
                  padding: 14px;
                  margin: 6px auto 14px auto;
                  display: inline-block;
                }
                .qr-img {
                  width: 200px;
                  height: 200px;
                  display: block;
                  margin: 0 auto;
                }
                .qr-token {
                  font-family: monospace;
                  font-size: 12px;
                  font-weight: 900;
                  color: #1e293b;
                  margin-top: 8px;
                  letter-spacing: 1px;
                }
                .contact-info {
                  border-top: 1px solid #e2e8f0;
                  padding-top: 12px;
                  font-size: 11px;
                  font-family: monospace;
                  color: #475569;
                }
                .instruction {
                  font-size: 9px;
                  color: #64748b;
                  margin-top: 8px;
                  font-family: sans-serif;
                }
              </style>
            </head>
            <body>
              <div class="badge-card">
                <div class="header-logo">
                  <img class="logo-img" src="/gofamint-logo.svg" alt="GOFAMINT_HOF Official Logo" />
                  <div class="church-title">The Gospel Faith Mission Int.</div>
                  <div class="dept-subtitle">Workers & Ministers Directorate</div>
                </div>
                <div>
                  <div class="dept-pill">${worker.department}${worker.assignedClass && worker.assignedClass !== '-' ? ` • ${worker.assignedClass}` : ''}</div>
                  <div class="worker-name">${worker.fullName}</div>
                  ${worker.duty ? `<div class="role-pill">${worker.duty}</div>` : ''}
                </div>
                <div class="qr-box">
                  <img class="qr-img" src="${qrDataUrl}" alt="Worker QR Code" />
                  <div class="qr-token">${worker.qrCodeToken || worker.id}</div>
                </div>
                <div class="contact-info">
                  <div><strong>Phone:</strong> ${worker.phone}</div>
                  ${worker.whatsappNumber ? `<div><strong>WhatsApp:</strong> ${worker.whatsappNumber}</div>` : ''}
                  <div class="instruction">Official Worker ID Badge. Scan before terminal for Sunday & Special Event Attendance.</div>
                </div>
              </div>
              <script>
                window.onload = () => {
                  setTimeout(() => {
                    window.print();
                  }, 250);
                };
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
        return;
      }
    } catch (e) {
      console.warn('Popup print blocked, falling back to window.print():', e);
    }

    window.print();
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `GOFAMINT_HOF_QR_${worker.fullName.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col print:shadow-none print:border-0">
        
        {/* Header (hidden in print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-black tracking-wide font-['Cinzel',serif]">
              Official Worker ID & QR Pass
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* The Printable Pass Badge */}
        <div ref={badgeRef} className="p-6 text-center space-y-4 bg-white">
          
          {/* Top Logo & Church Header */}
          <div className="border-b-2 border-amber-500 pb-3 space-y-1">
            <div className="flex justify-center">
              <GofamintLogo size={52} />
            </div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest font-['Cinzel',serif]">
              The Gospel Faith Mission Int.
            </h3>
            <p className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">
              Workers & Ministers Directorate
            </p>
          </div>

          {/* Worker Identity Details */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <span className="inline-block px-2.5 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-black uppercase tracking-wider rounded-md border border-blue-200">
                {worker.department}
              </span>
              {worker.assignedClass && worker.assignedClass !== '-' && (
                <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-900 text-[10px] font-bold uppercase tracking-wider rounded-md border border-indigo-200">
                  {worker.assignedClass}
                </span>
              )}
            </div>
            <h2 className="text-lg font-black text-slate-900 font-['Cinzel',serif] tracking-tight pt-1">
              {worker.fullName}
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-1 pt-0.5">
              {worker.duty && (
                <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                  {worker.duty}
                </span>
              )}
              {worker.categories.filter(c => c !== worker.duty).map((c, i) => (
                <span key={i} className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  {c}
                </span>
              ))}
            </div>
          </div>

          {/* QR Code Canvas */}
          <div className="bg-slate-50 border-2 border-slate-900 rounded-2xl p-4 inline-block shadow-inner">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Worker Clock-In QR Code"
                className="w-48 h-48 mx-auto rounded-lg"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400 font-mono">
                Generating QR...
              </div>
            )}
            <div className="mt-2 text-[11px] font-mono font-black text-slate-800 tracking-wider">
              {worker.qrCodeToken}
            </div>
          </div>

          {/* Contact Details */}
          <div className="pt-2 text-[11px] text-slate-600 space-y-1 border-t border-slate-100">
            <div className="flex items-center justify-center gap-4">
              <span className="flex items-center gap-1 font-mono">
                <Phone className="w-3 h-3 text-slate-400" />
                {worker.phone}
              </span>
              {worker.whatsappNumber && (
                <span className="flex items-center gap-1 font-mono text-emerald-700">
                  <MessageSquare className="w-3 h-3 text-emerald-500" />
                  {worker.whatsappNumber}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              Hold QR code before the kiosk camera or scanning station for instant Sunday clock-in.
            </p>
          </div>

        </div>

        {/* Actions Footer (Hidden in print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 print:hidden">
          {onQuickClockIn && (
            <button
              onClick={() => {
                onQuickClockIn(worker);
                onClose();
              }}
              className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Clock In Now</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleDownloadQr}
              className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save PNG</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span>Print Badge</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
