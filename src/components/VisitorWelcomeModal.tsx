import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  HeartHandshake,
  QrCode,
  Share2,
  Copy,
  Check,
  ExternalLink,
  X,
  Sparkles,
  MessageCircle,
  RefreshCw,
  Award,
  ShieldCheck,
  Phone
} from 'lucide-react';
import { Member, ClassProfile } from '../types';

interface VisitorWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitor: Member | null;
  classProfile: ClassProfile | null;
  onOpenReportCard: (visitorId: string) => void;
}

export const VisitorWelcomeModal: React.FC<VisitorWelcomeModalProps> = ({
  isOpen,
  onClose,
  visitor,
  classProfile,
  onOpenReportCard
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const className = classProfile?.className || 'Sunday School Bible Class';
  const secretaryName = classProfile?.secretaryName || 'Sunday School Secretary';

  // Construct personalized direct report card link
  const baseUrl = window.location.origin + window.location.pathname;
  const reportCardLink = visitor ? `${baseUrl}#/report/${visitor.id}` : baseUrl;

  // Welcome message template
  const welcomeMessage = visitor
    ? `Calvary greetings in Christ ${visitor.fullName}! 🙏✨\n\nThank you for joining our Sunday School class (${className}) today!\n\nYou can view and track your personalized Sunday School Weekly Report Card & attendance progress anytime here:\n🔗 ${reportCardLink}\n\nMay the Lord bless and enrich you as we study His word together!\n\n— ${secretaryName}\nSunday School Secretary, GOFAMINT_HOF`
    : '';

  useEffect(() => {
    if (visitor && isOpen) {
      QRCode.toDataURL(
        reportCardLink,
        {
          width: 280,
          margin: 2,
          color: {
            dark: '#1e3a8a',
            light: '#ffffff'
          }
        },
        (err, url) => {
          if (!err && url) {
            setQrCodeDataUrl(url);
          }
        }
      );
    }
  }, [visitor, isOpen, reportCardLink]);

  if (!isOpen || !visitor) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(reportCardLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(welcomeMessage);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const cleanPhone = visitor.phone ? visitor.phone.replace(/[^0-9]/g, '') : '';
    const encodedText = encodeURIComponent(welcomeMessage);
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-6">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-6 text-center text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 rounded-2xl bg-white/10 border-2 border-amber-400 flex items-center justify-center mx-auto mb-2.5 shadow-md">
            <HeartHandshake className="w-7 h-7 text-amber-300" />
          </div>

          <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 bg-amber-400/20 px-3 py-0.5 rounded-full border border-amber-400/30">
            Visitor Onboarding Complete
          </span>

          <h3 className="text-xl font-black text-white mt-1.5 font-['Cinzel',serif]">
            Welcome, {visitor.fullName}!
          </h3>
          <p className="text-xs text-blue-200 mt-0.5">
            Personalized Report Card Link & QR Code have been generated.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          
          {/* QR Code & Link Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="w-32 h-32 bg-white rounded-xl border border-slate-300 p-2 shadow-xs shrink-0 flex items-center justify-center">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="Personal QR Code" className="w-full h-full object-contain" />
              ) : (
                <QrCode className="w-12 h-12 text-slate-300 animate-pulse" />
              )}
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-purple-800 font-bold text-xs">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Personalized Live Report Card</span>
              </div>
              <p className="text-xs text-slate-600">
                Weekly attendance and lesson performance will automatically update on this visitor's report card.
              </p>
              
              <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <button
                  id="btn-copy-report-link"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                </button>

                <button
                  id="btn-preview-report-card"
                  onClick={() => {
                    onClose();
                    onOpenReportCard(visitor.id);
                  }}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Preview Report Card</span>
                </button>
              </div>
            </div>
          </div>

          {/* Welcome Message Preview & WhatsApp Action */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>Personalized WhatsApp Welcome Message</span>
              </label>

              <button
                onClick={handleCopyMessage}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                {copiedMessage ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedMessage ? 'Message Copied' : 'Copy Text'}</span>
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 font-mono whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
              {welcomeMessage}
            </div>
          </div>

          {/* WhatsApp Direct Share Button */}
          <div className="space-y-2 pt-1">
            <button
              id="btn-share-whatsapp-welcome"
              onClick={handleShareWhatsApp}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition"
            >
              <MessageCircle className="w-5 h-5 text-white" />
              <span>Share Welcome Message to WhatsApp</span>
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Done / Return to Register
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
