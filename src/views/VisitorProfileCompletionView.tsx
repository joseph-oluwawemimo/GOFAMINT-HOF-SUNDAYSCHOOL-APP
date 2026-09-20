import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle2, AlertCircle, Heart, Shield, Lock, User, Phone, MapPin, Briefcase } from 'lucide-react';
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

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [occupation, setOccupation] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | ''>('');
  const [ageGroup, setAgeGroup] = useState('');
  const [prayerRequests, setPrayerRequests] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | undefined>(undefined);

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
          setAgeGroup(data.ageGroup || '');
          setPrayerRequests(data.prayerRequests || '');
          setPhotoBase64(data.photoBase64);
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
      const payload: Partial<Member> = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        occupation: occupation.trim(),
        gender: gender || undefined,
        ageGroup: ageGroup.trim() || undefined,
        prayerRequests: prayerRequests.trim(),
        photoBase64
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
        <p className="text-sm font-bold text-slate-300">Loading your visitor welcome card...</p>
      </div>
    );
  }

  if (isAlreadyUsed) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black font-['Cinzel',serif] text-amber-400 mb-2">
            One-Time Link Completed
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed mb-6">
            This secure one-time link has already been used to complete the visitor profile, or its authorization has expired.
          </p>
          <div className="bg-slate-800/80 rounded-2xl p-4 text-xs text-slate-400 border border-slate-700 leading-relaxed">
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
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-800/50 rounded-3xl p-8 shadow-2xl animate-fade-in">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black font-['Cinzel',serif] text-amber-400 mb-2">
            Welcome to GOFAMINT HOF!
          </h2>
          <p className="text-sm font-semibold text-emerald-300 mb-4">
            Your profile has been saved successfully.
          </p>
          <p className="text-xs text-slate-300 leading-relaxed mb-6">
            We are joyful and blessed to have you worship with us in the Lord's House. Your details have been delivered to your Sunday School class leadership.
          </p>
          <div className="bg-slate-800/80 rounded-2xl p-4 text-[11px] text-slate-400 border border-slate-700 flex items-center justify-center gap-2">
            <Heart className="w-4 h-4 text-amber-400 shrink-0" />
            <span>"The Lord bless you and keep you..." (Numbers 6:24)</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white pb-12">
      {/* Top Banner */}
      <header className="bg-slate-900 border-b border-slate-800 py-6 px-4 text-center">
        <div className="max-w-md mx-auto space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            GOFAMINT HOUSE OF FAVOUR • SUNDAY SCHOOL
          </span>
          <h1 className="text-xl sm:text-2xl font-black font-['Cinzel',serif] text-white">
            Honored Visitor Welcome Card
          </h1>
          <p className="text-xs text-slate-400">
            Please complete or update your details below. This is a secure one-time link.
          </p>
        </div>
      </header>

      {/* Main Content Form */}
      <main className="max-w-md w-full mx-auto px-4 mt-6">
        <form onSubmit={handleFormSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          {/* Portrait Photo Section */}
          <div className="flex flex-col items-center justify-center text-center space-y-2 pb-2">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-amber-400/80 bg-slate-800 flex items-center justify-center shadow-lg">
                {photoBase64 ? (
                  <img src={photoBase64} alt={fullName || 'Visitor'} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-slate-500" />
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="absolute bottom-0 right-0 p-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-full shadow-md cursor-pointer transition active:scale-95"
                title="Upload or take photo"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="text-xs text-amber-400 hover:underline font-bold cursor-pointer"
            >
              {photoBase64 ? 'Change Photo (Camera / Upload)' : 'Add Photo (Camera / Upload)'}
            </button>
            <span className="text-[10px] text-slate-400">
              Photos are automatically compressed to ≤ 500 KB for optimal speed.
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
              <label className="text-[11px] font-bold text-slate-300">Age Group / Dept</label>
              <select
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="">Select...</option>
                <option value="Children">Children</option>
                <option value="Teenagers">Teenagers</option>
                <option value="Youth">Youth</option>
                <option value="Young Adults">Young Adults</option>
                <option value="Adults">Adults</option>
                <option value="Elders">Elders</option>
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
        title="Visitor Portrait Photo"
      />
    </div>
  );
};
