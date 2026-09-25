import React, { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle2, AlertCircle, Heart, Shield, Lock, User, Phone, MapPin, Briefcase, Copy, Check, GraduationCap, Upload, Download } from 'lucide-react';
import QRCode from 'qrcode';
import { Member } from '../types';
import { CameraModal } from '../components/CameraModal';
import { compressImage } from '../utils/imageCompression';
import { getSupabaseClient } from '../services/supabase';
import { saveMemberToDB } from '../db/indexedDB';

interface VisitorProfileCompletionViewProps {
  token: string;
  onProfileCompleted?: () => void;
}

export const VisitorProfileCompletionView: React.FC<VisitorProfileCompletionViewProps> = ({
  token,
  onProfileCompleted
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [isAlreadyUsed, setIsAlreadyUsed] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportCardUrl, setReportCardUrl] = useState<string>('');
  const [reportCardQr, setReportCardQr] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [occupation, setOccupation] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | ''>('');
  const [ageGroup, setAgeGroup] = useState('');
  const [prayerRequests, setPrayerRequests] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load member by token
  useEffect(() => {
    let isMounted = true;

    async function loadVisitorData() {
      try {
        setLoading(true);
        setError(null);

        let data: Member | null = null;

        // Try API first
        try {
          const response = await fetch(`/api/visitor-profile/${encodeURIComponent(token)}`);
          if (response.ok) {
            data = await response.json();
          } else if (response.status === 410) {
            if (isMounted) setIsAlreadyUsed(true);
            return;
          }
        } catch {
          // Network / dev mode fallback to direct Supabase
        }

        // Direct Supabase fallback
        if (!data) {
          const client = getSupabaseClient();
          const { data: rows, error: sbErr } = await client.from('members').select('*');
          if (sbErr) throw new Error(sbErr.message);

          const found = rows?.find((r: any) => {
            const mem = r.data || r;
            return mem.oneTimeProfileToken?.token === token;
          });

          if (!found) {
            throw new Error('Visitor link not found or invalid.');
          }

          const memData: Member = found.data || found;
          if (memData.oneTimeProfileToken?.isUsed) {
            if (isMounted) setIsAlreadyUsed(true);
            return;
          }
          if (memData.oneTimeProfileToken?.expiresAt && new Date(memData.oneTimeProfileToken.expiresAt) < new Date()) {
            if (isMounted) setIsAlreadyUsed(true);
            return;
          }
          data = memData;
        }

        if (isMounted && data) {
          setMember(data);
          setFullName(data.fullName || '');
          setPhone(data.phone || '');
          setAddress(data.address || '');
          setOccupation(data.occupation || '');
          setGender(data.gender || '');

          // Pre-select department based on class or existing department (Adult, Youth, Children)
          let defaultDept = 'Adult';
          const rawDept = (data.department || data.className || '').toLowerCase();
          if (rawDept.includes('youth') || rawDept.includes('teen')) {
            defaultDept = 'Youth';
          } else if (rawDept.includes('child') || rawDept.includes('junior') || rawDept.includes('primary') || rawDept.includes('toddler')) {
            defaultDept = 'Children';
          }
          const initialDept = data.ageGroup && ['Children', 'Youth', 'Adult'].includes(data.ageGroup) 
            ? data.ageGroup 
            : defaultDept;
          setAgeGroup(initialDept);

          setPrayerRequests(data.prayerRequests || '');
          setPhotoBase64(data.photoBase64);

          // If already completed or has report card token, preload QR code
          if (data.reportCardToken?.token) {
            const exUrl = `${window.location.origin}/#report-card/${data.reportCardToken.token}`;
            setReportCardUrl(exUrl);
            QRCode.toDataURL(exUrl, { width: 220, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
              .then(setReportCardQr)
              .catch(() => {});
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Unable to access visitor profile.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (token) {
      loadVisitorData();
    } else {
      setError('Invalid or missing visitor link token.');
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handlePhotoCapture = async (base64: string) => {
    const compressed = await compressImage(base64);
    setPhotoBase64(compressed);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const rawBase64 = reader.result as string;
          const compressed = await compressImage(rawBase64);
          setPhotoBase64(compressed);
        } catch (cErr) {
          console.error('Failed to compress image:', cErr);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error reading image file:', err);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert('Please enter your full name.');
      return;
    }
    setIsConfirmModalOpen(true);
  };

  const handleFinalSave = async () => {
    setIsConfirmModalOpen(false);
    setIsSubmitting(true);
    setError(null);

    try {
      const rcToken = member?.reportCardToken?.token || `rc_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
      const reportCardToken = { token: rcToken, createdAt: new Date().toISOString() };

      const payload: Partial<Member> = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        occupation: occupation.trim(),
        gender: gender || undefined,
        ageGroup: ageGroup.trim() || undefined,
        prayerRequests: prayerRequests.trim(),
        photoBase64,
        reportCardToken
      };

      let saveSucceeded = false;

      // Try API first
      try {
        const response = await fetch(`/api/visitor-profile/${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          saveSucceeded = true;
        }
      } catch {
        // Fallback to direct client save
      }

      // Direct client fallback
      if (!saveSucceeded && member) {
        const updatedMember: Member = {
          ...member,
          ...payload,
          oneTimeProfileToken: member.oneTimeProfileToken ? {
            ...member.oneTimeProfileToken,
            isUsed: true,
            usedAt: new Date().toISOString()
          } : undefined,
          updatedAt: new Date().toISOString()
        };

        const client = getSupabaseClient();
        const { error: upsertErr } = await client.from('members').upsert({
          id: updatedMember.id,
          class_id: updatedMember.classId,
          data: updatedMember,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

        if (upsertErr) {
          throw new Error(`Failed to save to database: ${upsertErr.message}`);
        }

        try {
          await saveMemberToDB(updatedMember);
        } catch {
          // Non-critical local save
        }
        saveSucceeded = true;
      }

      if (!saveSucceeded) {
        throw new Error('Failed to save profile. The link may have expired or been used.');
      }

      const generatedUrl = `${window.location.origin}/#report-card/${rcToken}`;
      setReportCardUrl(generatedUrl);
      try {
        const qrData = await QRCode.toDataURL(generatedUrl, {
          width: 240,
          margin: 2,
          color: { dark: '#0f172a', light: '#ffffff' }
        });
        setReportCardQr(qrData);
      } catch (qrErr) {
        console.error('Failed to generate QR code:', qrErr);
      }

      setIsSuccess(true);
      if (onProfileCompleted) onProfileCompleted();
    } catch (err: any) {
      setError(err?.message || 'Could not save profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-300">Loading your Sunday School profile...</p>
      </div>
    );
  }

  if (isAlreadyUsed) {
    const existingRcToken = member?.reportCardToken?.token;
    const existingUrl = existingRcToken ? `${window.location.origin}/#report-card/${existingRcToken}` : '';

    const isStudent = member?.memberType === 'STUDENT';
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-4">
          <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto border border-blue-500/30">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black font-['Cinzel',serif] text-amber-400">
            Profile Link Completed
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            This secure one-time link has already been used to complete the Sunday School profile.
          </p>
          {existingRcToken && (
            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-left space-y-3">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                Your Score Pass & Report Card
              </span>
              <p className="text-[11px] text-slate-300">
                You can view your private Sunday School score pass and report card anytime:
              </p>
              {reportCardQr && (
                <div className="flex flex-col items-center justify-center my-2 space-y-2">
                  <img src={reportCardQr} alt="Score Pass QR Code" className="w-36 h-36 rounded-xl border border-white/20 shadow-md bg-white p-1" />
                  <a
                    href={reportCardQr}
                    download={`${(member?.fullName || 'member').trim()}_SundaySchool_Pass.png`}
                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-amber-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download QR Code</span>
                  </a>
                </div>
              )}
              <button
                type="button"
                onClick={() => { window.location.hash = `#report-card/${existingRcToken}`; }}
                className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <GraduationCap className="w-4 h-4" />
                Open My Score Pass
              </button>
            </div>
          )}
          <div className="bg-slate-800/80 rounded-2xl p-3 text-xs text-slate-400 border border-slate-700 leading-relaxed">
            If you need to update any information, kindly speak with your Sunday School class secretary or teacher on Sunday. God bless you!
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-red-800/50 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-red-300 mb-2">Link Unavailable</h2>
          <p className="text-xs text-slate-300 leading-relaxed mb-6">{error}</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    const isStudent = member?.memberType === 'STUDENT';
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-800/50 rounded-3xl p-8 shadow-2xl animate-fade-in space-y-4">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black font-['Cinzel',serif] text-amber-400">
            {isStudent ? 'Profile Verified & Synced!' : 'Welcome to GOFAMINT HOF!'}
          </h2>
          <p className="text-sm font-semibold text-emerald-300">
            Your profile has been saved successfully.
          </p>
          <p className="text-xs text-slate-300 leading-relaxed">
            {isStudent
              ? 'Your Sunday School student profile is active and up to date. Keep your personal score pass and QR code to monitor your attendance and grades each week.'
              : "We are joyful and blessed to have you worship with us in the Lord's House. Your details have been delivered to your Sunday School class leadership."}
          </p>

          {/* Secure Report Card Access (Phase 7) */}
          {reportCardUrl && (
            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Your Live Score Pass & Report Card
                </span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full font-semibold">
                  Private & Read-Only
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-normal">
                Use your private access link and QR code below to track your lessons, attendance, and scores anytime:
              </p>
              {reportCardQr && (
                <div className="flex flex-col items-center justify-center my-3 space-y-2">
                  <div className="p-2 bg-white rounded-2xl shadow-lg border border-slate-700">
                    <img src={reportCardQr} alt="Score Pass QR Code" className="w-44 h-44 rounded-xl" />
                  </div>
                  <a
                    href={reportCardQr}
                    download={`${fullName.trim() || 'member'}_SundaySchool_Pass.png`}
                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download QR Code Pass</span>
                  </a>
                </div>
              )}
              <div className="flex items-center gap-2 bg-slate-900/90 rounded-xl p-2 border border-slate-700">
                <input
                  type="text"
                  readOnly
                  value={reportCardUrl}
                  className="bg-transparent text-xs text-slate-200 flex-1 outline-none truncate select-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(reportCardUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                  {copiedLink ? 'Copied' : 'Copy'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = reportCardUrl.split('#')[1] || '';
                }}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <GraduationCap className="w-4 h-4" />
                Open My Score Pass
              </button>
            </div>
          )}

          <div className="bg-slate-800/80 rounded-2xl p-4 text-[11px] text-slate-400 border border-slate-700 flex items-center justify-center gap-2">
            <Heart className="w-4 h-4 text-amber-400 shrink-0" />
            <span>"The Lord bless you and keep you..." (Numbers 6:24)</span>
          </div>
        </div>
      </div>
    );
  }

  const isStudent = member?.memberType === 'STUDENT';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white pb-12">
      {/* Top Banner */}
      <header className="bg-slate-900 border-b border-slate-800 py-6 px-4 text-center">
        <div className="max-w-md mx-auto space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            GOFAMINT HOUSE OF FAVOUR • SUNDAY SCHOOL
          </span>
          <h1 className="text-xl sm:text-2xl font-black font-['Cinzel',serif] text-white">
            {isStudent ? 'Student Profile & Score Pass' : 'Honored Visitor Welcome Card'}
          </h1>
          <p className="text-xs text-slate-400">
            {isStudent
              ? 'Verify and complete your student profile below to generate your personal Sunday School Score Pass and QR Code.'
              : 'Please complete or update your details below. Once saved, you can access your live Sunday School Score Pass anytime via QR code.'}
          </p>
        </div>
      </header>

      {/* Main Content Form */}
      <main className="max-w-md w-full mx-auto px-4 mt-6">
        <form onSubmit={handleFormSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          {/* Portrait Photo Section */}
          <div className="flex flex-col items-center justify-center text-center space-y-2 pb-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-amber-400/80 bg-slate-800 flex items-center justify-center shadow-lg">
                {photoBase64 ? (
                  <img src={photoBase64} alt={fullName || (isStudent ? 'Student' : 'Visitor')} className="w-full h-full object-cover" />
                ) : isStudent ? (
                  <GraduationCap className="w-10 h-10 text-amber-400/70" />
                ) : (
                  <User className="w-10 h-10 text-slate-500" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-full shadow-md cursor-pointer transition active:scale-95"
                title="Upload photo from device gallery/files"
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Photo (Gallery / File)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span>Camera</span>
              </button>
            </div>
            <span className="text-[10px] text-slate-400">
              Photos automatically compress to ≤ 500 KB for rapid synchronization.
            </span>
          </div>

          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>Full Name *</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Bro. Olawale Adeleke"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-amber-400" />
              <span>Phone / WhatsApp Number</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 08012345678"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Gender & Age Group */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="">Select...</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300">Department *</label>
              <select
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-bold"
              >
                <option value="Adult">Adult Department</option>
                <option value="Youth">Youth Department</option>
                <option value="Children">Children Department</option>
              </select>
            </div>
          </div>

          {/* Residential Address */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>Residential Address</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 15 Community Road, Off Ring Road"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Occupation / Profession */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-amber-400" />
              <span>Occupation / Profession</span>
            </label>
            <input
              type="text"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              placeholder="e.g. Teacher, Accountant, Trader, Student"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Prayer Requests */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-amber-400" />
              <span>Prayer Requests & Thanksgiving</span>
            </label>
            <textarea
              rows={3}
              value={prayerRequests}
              onChange={(e) => setPrayerRequests(e.target.value)}
              placeholder="Share how our pastoral team and teachers can pray with you..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save & Complete Profile</span>
          </button>
        </form>
      </main>

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 bg-amber-400/20 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-400/30">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-white">
              Are you sure you want to save this profile?
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              After you save this profile, this one-time link can no longer be used to make changes.
            </p>
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleFinalSave}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer shadow-md disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Yes, Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera and Upload Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handlePhotoCapture}
        title={isStudent ? "Student Portrait Photo" : "Visitor Portrait Photo"}
      />
    </div>
  );
};
