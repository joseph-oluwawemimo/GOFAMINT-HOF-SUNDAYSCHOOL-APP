import React, { useState } from 'react';
import { Shield, Crown, BookCheck, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { GofamintLogo } from './GofamintLogo';
import { bootstrapSystem } from '../services/adminUserApi';

interface FirstRunSetupProps {
  onComplete: () => void;
  onBack: () => void;
}

type SetupStep = 'SECRET' | 'OFFICER' | 'REVIEW' | 'PROCESSING' | 'COMPLETE';

export default function FirstRunSetup({ onComplete, onBack }: FirstRunSetupProps) {
  const [step, setStep] = useState<SetupStep>('SECRET');
  const [error, setError] = useState('');
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const selectedRole = 'GENERAL_SUPERINTENDENT' as const;
  const [showPassword, setShowPassword] = useState(false);
  const [churchName, setChurchName] = useState('');
  const [officer, setOfficer] = useState({ displayName: '', email: '', password: '', confirmPassword: '' });

  const validateStep = (): boolean => {
    setError('');
    if (step === 'SECRET') {
      if (!bootstrapSecret.trim()) { setError('Bootstrap secret is required.'); return false; }
    }
    if (step === 'OFFICER') {
      if (!churchName.trim()) { setError('Church name is required.'); return false; }
      if (!officer.displayName.trim()) { setError('Full name is required.'); return false; }
      if (!officer.email.trim() || !officer.email.includes('@')) { setError('Valid email is required.'); return false; }
      if (officer.password.length < 6) { setError('Password must be at least 6 characters.'); return false; }
      if (officer.password !== officer.confirmPassword) { setError('Passwords do not match.'); return false; }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    const steps: SetupStep[] = ['SECRET', 'OFFICER', 'REVIEW'];
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  };

  const handleBack = () => {
    const steps: SetupStep[] = ['SECRET', 'OFFICER', 'REVIEW'];
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
    else onBack();
  };

  const handleSubmit = async () => {
    setStep('PROCESSING');
    setError('');
    const officerData = {
      email: officer.email.trim(),
      password: officer.password,
      displayName: officer.displayName.trim()
    };
    const payload = { bootstrapSecret: bootstrapSecret.trim(), churchName: churchName.trim(), superintendent: officerData };

    const result = await bootstrapSystem(payload);
    if (result.success) {
      setStep('COMPLETE');
    } else {
      setError(result.error || 'Bootstrap failed.');
      setStep('REVIEW');
    }
  };

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition-all text-sm';
  const labelClass = 'block text-sm font-semibold text-gray-700 mb-1';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-amber-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 space-y-6 border border-amber-400/30">
        <div className="text-center">
          <GofamintLogo size={56} />
          <h2 className="text-xl font-bold text-gray-900 mt-4 font-['Cinzel',serif]">System Initialization</h2>
          <p className="text-xs text-gray-500 mt-1">First-time setup for GOFAMINT HOF Sunday School Directorate</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          {['SECRET', 'OFFICER', 'REVIEW'].map((s, i) => (
            <div key={s} className={`h-2 rounded-full transition-all ${
              step === s || ['SECRET','OFFICER','REVIEW'].indexOf(step) > i
                ? 'w-8 bg-amber-500' : 'w-4 bg-gray-200'
            }`} />
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'SECRET' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <Shield className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-900 leading-relaxed">Enter the secure bootstrap secret provided by your system administrator to unlock the first-run installation authority.</p>
            </div>
            <div>
              <label className={labelClass}>Bootstrap Secret</label>
              <input type="password" className={inputClass} placeholder="Enter bootstrap secret (e.g. GSSRA)" value={bootstrapSecret} onChange={e => setBootstrapSecret(e.target.value)} />
            </div>
          </div>
        )}

        {step === 'OFFICER' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-200">
              <Crown className="w-5 h-5 text-amber-600" />
              <span className="text-xs font-bold uppercase tracking-wider">
                General Superintendent (Chief Executive)
              </span>
            </div>
            <div>
              <label className={labelClass}>Church Name</label>
              <input className={inputClass} placeholder="e.g. GOFAMINT House of Favour" value={churchName} onChange={e => setChurchName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Full Name</label>
              <input className={inputClass} placeholder="e.g. Pastor Superintendent Name" value={officer.displayName} onChange={e => setOfficer(p => ({...p, displayName: e.target.value}))} />
            </div>
            <div>
              <label className={labelClass}>Email Address</label>
              <input type="email" className={inputClass} placeholder="officer@example.com" value={officer.email} onChange={e => setOfficer(p => ({...p, email: e.target.value}))} />
            </div>
            <div className="relative">
              <label className={labelClass}>Password</label>
              <input type={showPassword ? 'text' : 'password'} className={inputClass} placeholder="Minimum 6 characters" value={officer.password} onChange={e => setOfficer(p => ({...p, password: e.target.value}))} />
              <button type="button" className="absolute right-3 top-9 text-gray-400" onClick={() => setShowPassword(p => !p)}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div>
              <label className={labelClass}>Confirm Password</label>
              <input type="password" className={inputClass} placeholder="Re-enter password" value={officer.confirmPassword} onChange={e => setOfficer(p => ({...p, confirmPassword: e.target.value}))} />
            </div>
          </div>
        )}

        {step === 'REVIEW' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 text-sm">Review & Confirm</h3>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-1">
              <p className="text-xs font-bold text-amber-900 uppercase">
                {churchName}
              </p>
              <p className="text-[11px] font-bold text-amber-800 uppercase">General Superintendent</p>
              <p className="text-sm font-semibold text-slate-800">{officer.displayName}</p>
              <p className="text-xs text-slate-600">{officer.email}</p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-xs text-blue-900">
                🔒 Once initialized, the bootstrap wizard is permanently locked. The executive officer can log in and establish staff/classes from the Admin Portal.
              </p>
            </div>
          </div>
        )}

        {step === 'PROCESSING' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            <p className="text-xs text-gray-600">Initializing system... Creating executive authority and configuring database.</p>
          </div>
        )}

        {step === 'COMPLETE' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle className="w-12 h-12 text-emerald-500" />
            <h3 className="text-lg font-bold text-slate-900 font-['Cinzel',serif]">System Initialized Successfully!</h3>
            <p className="text-xs text-slate-600 text-center leading-relaxed">
              Your executive account is established and active. You can now log in to access the Directorate and create/manage accounts.
            </p>
            <button onClick={onComplete} className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-lg">
              Continue to Login →
            </button>
          </div>
        )}

        {!['PROCESSING', 'COMPLETE'].includes(step) && (
          <div className="flex gap-3">
            <button onClick={handleBack} className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-semibold text-xs transition-colors">
              Back
            </button>
            {step === 'REVIEW' ? (
              <button onClick={handleSubmit} className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-md">
                Initialize System
              </button>
            ) : (
              <button onClick={handleNext} className="flex-1 py-3 bg-blue-950 hover:bg-blue-900 text-white rounded-xl font-semibold text-xs transition-colors">
                Next
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
