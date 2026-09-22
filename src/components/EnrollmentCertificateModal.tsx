import React, { useRef, useState } from 'react';
import { Award, Printer, Download, Share2, X, CheckCircle, Sparkles, Building2, Calendar, User } from 'lucide-react';
import { Member, ClassProfile, SundaySchoolYear, QuarterData, WeeklyGradeRecord } from '../types';
import { GofamintLogo } from './GofamintLogo';

interface EnrollmentCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member;
  classProfile?: ClassProfile | null;
  sundaySchoolYear?: SundaySchoolYear | null;
  activeQuarter?: QuarterData | null;
  grades?: WeeklyGradeRecord[];
}

export const EnrollmentCertificateModal: React.FC<EnrollmentCertificateModalProps> = ({
  isOpen,
  onClose,
  member,
  classProfile,
  sundaySchoolYear,
  activeQuarter,
  grades = []
}) => {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  if (!isOpen || !member) return null;

  // Phase 8.2: Gender Title - Male -> Brother, Female -> Sister
  const genderUpper = String(member.gender || '').toUpperCase();
  const title = genderUpper === 'FEMALE' ? 'Sister' : genderUpper === 'MALE' ? 'Brother' : '';
  const titledFullName = title ? `${title} ${member.fullName}` : member.fullName;

  // Phase 8.4: Department & Class
  const departmentName = classProfile?.department || member.department || 'General';
  const className = classProfile?.name || member.className || 'Sunday School Class';

  // Phase 8.1 & 8.3: Consistency period & qualifying completed lessons
  // Find which weeks this member was marked PRESENT (or attended)
  const attendedWeekNumbers = grades
    .filter(g => g.memberId === member.id && g.attendance === 'PRESENT' && !g.isNoRecordWeek)
    .map(g => g.weekNumber)
    .sort((a, b) => a - b);

  // If attended weeks are recorded, list them; fallback to first 3 completed lessons
  const completedLessons = attendedWeekNumbers.length > 0
    ? attendedWeekNumbers.slice(0, 3)
    : [1, 2, 3];

  const yearLabel = sundaySchoolYear?.yearName || `${new Date().getFullYear()}–${new Date().getFullYear() + 1}`;
  const quarterLabel = activeQuarter?.quarterName || (activeQuarter?.quarterNumber ? `Quarter ${activeQuarter.quarterNumber}` : 'Quarter 1');
  const certDateStr = member.enrolledDate || member.certifiedAt
    ? new Date(member.enrolledDate || member.certifiedAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const authorizedBy = member.certifiedBy || 'Sunday School Board / Enrollment Officer';

  // Phase 9: PRINT / SAVE AS PDF
  const handlePrint = () => {
    window.print();
  };

  // Phase 9: SAVE AS IMAGE (PNG) via HTML5 Canvas
  const handleSaveAsImage = async () => {
    setIsExporting(true);
    setExportFeedback('Generating high-resolution certificate image...');

    try {
      const canvas = document.createElement('canvas');
      // Certificate dimensions (A4 proportion: 1200 x 850)
      canvas.width = 1200;
      canvas.height = 850;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas 2D context unavailable');
      }

      // Background - elegant parchment gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 1200, 850);
      bgGrad.addColorStop(0, '#fbf8ef');
      bgGrad.addColorStop(0.5, '#ffffff');
      bgGrad.addColorStop(1, '#fbf8ef');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1200, 850);

      // Outer gold border
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#b45309'; // amber-700
      ctx.strokeRect(30, 30, 1140, 790);

      // Inner thin navy border
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1e3a8a'; // blue-900
      ctx.strokeRect(45, 45, 1110, 760);

      // Corner ornaments
      const drawCorner = (x: number, y: number) => {
        ctx.fillStyle = '#b45309';
        ctx.fillRect(x - 6, y - 6, 12, 12);
      };
      drawCorner(45, 45);
      drawCorner(1155, 45);
      drawCorner(45, 805);
      drawCorner(1155, 805);

      // Top banner
      ctx.fillStyle = '#1e3a8a'; // deep navy
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('THE GOSPEL FAITH MISSION INTERNATIONAL (GOFAMINT)', 600, 95);

      ctx.fillStyle = '#b45309'; // gold/amber
      ctx.font = '900 22px serif';
      ctx.fillText('HOUSE OF FAVOUR • SUNDAY SCHOOL', 600, 130);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('SUNDAY SCHOOL BOARD', 600, 155);

      // Main Title
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 36px serif';
      ctx.fillText('CERTIFICATE OF ENROLLMENT', 600, 215);

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#d97706';
      ctx.beginPath();
      ctx.moveTo(350, 230);
      ctx.lineTo(850, 230);
      ctx.stroke();

      // Subtitle
      ctx.fillStyle = '#475569';
      ctx.font = 'italic 16px serif';
      ctx.fillText('This is to certify with honour that', 600, 275);

      // Recipient Name with Title
      ctx.fillStyle = '#1e3a8a';
      ctx.font = '900 34px serif';
      ctx.fillText(titledFullName, 600, 335);

      // Underline recipient
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(250, 350);
      ctx.lineTo(950, 350);
      ctx.stroke();

      // Recipient Details (Dept & Class)
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(`Department: ${departmentName}   •   Class: ${className}`, 600, 390);

      // Certification body text
      ctx.fillStyle = '#334155';
      ctx.font = '16px serif';
      ctx.fillText(
        'having faithfully fulfilled the required Sunday School consistency period and demonstrated',
        600,
        440
      );
      ctx.fillText(
        'godly commitment, is officially admitted and certified as an enrolled Student.',
        600,
        468
      );

      // Consistency Box
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(320, 505, 560, 60);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(320, 505, 560, 60);

      ctx.fillStyle = '#1e3a8a';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('CONSISTENT THROUGH QUALIFYING SESSIONS:', 600, 530);

      ctx.fillStyle = '#b45309';
      ctx.font = '900 14px sans-serif';
      const lessonsText = completedLessons.map(w => `Lesson ${w}`).join('   ★   ');
      ctx.fillText(lessonsText, 600, 553);

      // Academic Year & Quarter
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 14px sans-serif';
      ctx.fillText(`${yearLabel}   •   ${quarterLabel}`, 600, 605);

      // Signatures
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#64748b';

      // Left Signature line
      ctx.beginPath();
      ctx.moveTo(160, 710);
      ctx.lineTo(440, 710);
      ctx.stroke();

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(authorizedBy, 300, 730);
      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.fillText('Enrollment Officer / Sunday School Board', 300, 748);

      // Right Signature line
      ctx.beginPath();
      ctx.moveTo(760, 710);
      ctx.lineTo(1040, 710);
      ctx.stroke();

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(certDateStr, 900, 730);
      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.fillText('Date of Certification', 900, 748);

      // Center Gold Seal simulation
      ctx.save();
      ctx.beginPath();
      ctx.arc(600, 710, 36, 0, Math.PI * 2);
      ctx.fillStyle = '#b45309';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fef3c7';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('OFFICIAL', 600, 706);
      ctx.fillText('SEAL', 600, 718);
      ctx.restore();

      // Export to PNG blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error('Failed to generate image blob');
        }

        const cleanName = member.fullName.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `GOFAMINT_Sunday_School_Certificate_${cleanName}.png`;

        // Mobile-first: check Web Share API
        if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'image/png' })] })) {
          try {
            const file = new File([blob], fileName, { type: 'image/png' });
            await navigator.share({
              files: [file],
              title: 'Sunday School Enrollment Certificate',
              text: `Official GOFAMINT Sunday School Enrollment Certificate for ${titledFullName}`
            });
            setExportFeedback('Certificate shared successfully!');
            setIsExporting(false);
            return;
          } catch (shareErr) {
            // Fallback to download if user cancelled share
            console.log('Share dismissed or failed, falling back to download:', shareErr);
          }
        }

        // Direct download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setExportFeedback('Certificate image saved as PNG!');
        setIsExporting(false);
        setTimeout(() => setExportFeedback(null), 4000);
      }, 'image/png');

    } catch (err: any) {
      console.error('Failed to export certificate:', err);
      alert(`Certificate export failed: ${err.message}`);
      setIsExporting(false);
      setExportFeedback(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white border-2 border-amber-300 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="font-black text-xs sm:text-sm uppercase tracking-wider text-amber-300">
                Official Student Enrollment Certificate
              </h3>
              <p className="text-[10px] text-blue-200">
                GOFAMINT Sunday School Directorate
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Certificate Card */}
        <div className="p-4 sm:p-6 bg-slate-100 max-h-[75vh] overflow-y-auto">
          <div
            ref={certificateRef}
            id="enrollment-certificate-card"
            className="bg-gradient-to-b from-amber-50/50 via-white to-amber-50/40 p-6 sm:p-8 rounded-2xl border-4 border-double border-amber-500 shadow-lg text-center space-y-4 relative overflow-hidden"
          >
            {/* Watermark Logo */}
            <div className="absolute inset-0 flex items-center justify-center opacity-4 pointer-events-none">
              <Award className="w-80 h-80 text-amber-600" />
            </div>

            {/* GOFAMINT Header & Branding (Phase 8: SUNDAY SCHOOL / SUNDAY SCHOOL BOARD) */}
            <div className="space-y-1 relative z-10">
              <div className="flex justify-center mb-2">
                <GofamintLogo className="w-14 h-14" />
              </div>

              <div className="inline-block px-3 py-1 bg-amber-100/90 text-amber-950 border border-amber-300 rounded-full text-[10px] font-black uppercase tracking-wider">
                The Gospel Faith Mission International (House of Favour)
              </div>

              <h1 className="text-xl sm:text-2xl font-black font-['Cinzel',serif] text-blue-950 uppercase tracking-wide mt-1">
                SUNDAY SCHOOL
              </h1>

              <div className="text-xs font-bold uppercase tracking-widest text-amber-800">
                SUNDAY SCHOOL BOARD
              </div>
            </div>

            {/* Certificate Title */}
            <div className="pt-2 relative z-10">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-serif tracking-tight border-b-2 border-amber-400 pb-2 inline-block px-6">
                CERTIFICATE OF ENROLLMENT
              </h2>
            </div>

            {/* Photograph (Phase 8.1) */}
            <div className="flex justify-center relative z-10 pt-1">
              <div className="w-20 h-20 rounded-full border-4 border-amber-400 overflow-hidden shadow-md bg-slate-100 flex items-center justify-center">
                {member.photoBase64 ? (
                  <img
                    src={member.photoBase64}
                    alt={member.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-slate-400" />
                )}
              </div>
            </div>

            {/* Recipient Certification Statement (Phase 8.1 & 8.2: Brother / Sister) */}
            <div className="space-y-2 relative z-10">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
                This is to certify that
              </span>

              <h3 className="text-xl sm:text-2xl font-black text-blue-950 font-serif">
                {titledFullName}
              </h3>

              {/* Department and Class (Phase 8.4) */}
              <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 px-3.5 py-1 rounded-full text-xs font-bold text-blue-900">
                <Building2 className="w-3.5 h-3.5 text-blue-700" />
                <span>Department: <strong>{departmentName}</strong></span>
                <span className="text-blue-300">•</span>
                <span>Class: <strong>{className}</strong></span>
              </div>

              <p className="text-xs text-slate-600 max-w-md mx-auto pt-2 leading-relaxed">
                having fulfilled the required Sunday School consistency period and demonstrated faithful attendance, is officially enrolled as a certified student.
              </p>
            </div>

            {/* Consistency Lessons Attended (Phase 8.3) */}
            <div className="relative z-10 pt-2">
              <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3 max-w-sm mx-auto shadow-2xs">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>Consistent Through:</span>
                </div>
                <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
                  {completedLessons.map((lNum) => (
                    <span
                      key={lNum}
                      className="px-2.5 py-0.5 bg-white border border-amber-300 rounded-md text-xs font-black text-amber-950 shadow-2xs"
                    >
                      Lesson {lNum}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Metadata & Signatures */}
            <div className="pt-4 border-t border-amber-200 grid grid-cols-2 gap-4 text-left text-xs relative z-10">
              <div>
                <span className="block text-slate-400 text-[9px] uppercase font-bold">Certification Date</span>
                <strong className="text-slate-800 text-[11px]">{certDateStr}</strong>
                <div className="text-[9px] text-slate-400 mt-0.5">{yearLabel} • {quarterLabel}</div>
              </div>
              <div className="text-right">
                <span className="block text-slate-400 text-[9px] uppercase font-bold">Authorized By</span>
                <strong className="text-slate-800 text-[11px]">{authorizedBy}</strong>
                <div className="text-[9px] text-emerald-700 font-bold mt-0.5 flex items-center justify-end gap-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>Enrolled Student</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Message */}
        {exportFeedback && (
          <div className="px-5 py-2 bg-amber-50 text-amber-900 text-xs font-bold border-t border-amber-200 text-center animate-pulse">
            {exportFeedback}
          </div>
        )}

        {/* Action Buttons (Phase 9: SAVE AS IMAGE, PRINT / SAVE AS PDF) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-slate-600 hover:text-slate-900 text-xs font-bold rounded-xl hover:bg-slate-200 transition cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {/* SAVE AS IMAGE (PNG) */}
            <button
              type="button"
              onClick={handleSaveAsImage}
              disabled={isExporting}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-amber-200" />
              <span>{isExporting ? 'Generating...' : 'Save as Image (PNG)'}</span>
            </button>

            {/* PRINT / SAVE AS PDF */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Print / Save as PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
