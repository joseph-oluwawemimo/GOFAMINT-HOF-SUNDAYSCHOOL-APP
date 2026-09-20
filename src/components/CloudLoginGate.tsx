import React, { useState } from 'react';
import { Lock, Church, AlertCircle, Loader2, User as UserIcon, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { signIn } from '../services/authService';
import FirstRunSetup from './FirstRunSetup';

interface CloudLoginGateProps {
  onSignedIn: (user: User) => void;
  /** `false` only after the server has confirmed an uninitialized system. */
  isSystemInitialized?: boolean | null;
  onFirstRunComplete?: () => void;
}

/**
 * Mobile-First Sign-in Gate. Supports standard emails
 * (e.g. pastor@example.com) and role/class-specific Login IDs (e.g. GS, GSEC, YOUTH_A).
 */
export const CloudLoginGate: React.FC<CloudLoginGateProps> = ({ onSignedIn, isSystemInitialized, onFirstRunComplete }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError('Please enter your Role ID / Email and your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await signIn(identifier.trim(), password);
      onSignedIn(user);
    } catch (err: any) {
      console.error('[CloudLoginGate] Sign in error:', err);
      const msg = err?.message || err?.error_description || '';
      const code = err?.code || '';
      if (
        code.includes('invalid_credentials') ||
        code.includes('invalid-credential') ||
        code.includes('wrong-password') ||
        code.includes('user-not-found') ||
        msg.toLowerCase().includes('invalid login credentials') ||
        msg.toLowerCase().includes('user not found')
      ) {
        setError('Incorrect login ID / email or password.');
      } else if (code.includes('over_request_rate_limit') || code.includes('too-many-requests')) {
        setError('Too many attempts. Please wait a moment and try again.');
      } else {
        setError(msg || 'Could not sign in. Please check your network connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // If system initialization is still being probed, show a brief loader
  if (isSystemInitialized === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 p-6 text-center">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-amber-200/90 font-medium">Checking system configuration...</p>
      </div>
    );
  }

  // Bootstrap is available when uninitialized
  if (isSystemInitialized === false) {
    return (
      <FirstRunSetup
        onComplete={() => onFirstRunComplete?.()}
        onBack={() => undefined}
      />
    );
  }

  const roleSuggestions = [
    { label: 'GS', tip: 'General Superintendent' },
    { label: 'GSEC', tip: 'General Secretary' },
    { label: 'TEACHER', tip: 'Class Teacher' },
    { label: 'YOUTH_A', tip: 'Class ID Example' },
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#071120] text-slate-100 flex flex-col justify-between items-center p-4 sm:p-6 lg:p-8 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[350px] h-[350px] bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      {/* Top Brand Bar */}
      <header className="w-full max-w-md pt-2 pb-4 flex items-center justify-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/60 shadow-inner backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase">Sunday School Governance Portal</span>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="w-full max-w-md my-auto relative z-10">
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-2xl p-6 sm:p-8">
          {/* Header & Logo */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3.5 group">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 to-blue-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-300" />
              <div className="relative w-16 h-16 rounded-2xl bg-white p-2.5 shadow-xl border border-amber-400/30 flex items-center justify-center">
                <img src="/gofamint-logo.svg" alt="GOFAMINT Crest" className="w-full h-full object-contain" />
              </div>
            </div>
            
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              THE GOSPEL FAITH MISSION INTL
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
              Sunday School Directorate — Secure Sign In
            </p>
          </div>

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identifier Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Role ID, Email, or Class ID
                </label>
              </div>
              <div className="relative">
                <UserIcon className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError(null);
                  }}
                  className={`w-full h-12 pl-11 pr-4 rounded-xl text-sm font-medium bg-slate-800/80 border text-white placeholder-slate-500 focus:outline-none focus:bg-slate-800 transition-all ${
                    error ? 'border-red-500/80 ring-2 ring-red-500/20' : 'border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20'
                  }`}
                  placeholder="e.g. GS, GSEC, or user@church.org"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={isSubmitting}
                />
              </div>

              {/* Quick Suggestion Chips */}
              <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar py-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mr-1 flex-shrink-0">Quick:</span>
                {roleSuggestions.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    title={item.tip}
                    onClick={() => {
                      setIdentifier(item.label);
                      if (error) setError(null);
                    }}
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700/80 transition-colors cursor-pointer flex-shrink-0"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className={`w-full h-12 pl-11 pr-11 rounded-xl text-sm font-medium bg-slate-800/80 border text-white placeholder-slate-500 focus:outline-none focus:bg-slate-800 transition-all ${
                    error ? 'border-red-500/80 ring-2 ring-red-500/20' : 'border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20'
                  }`}
                  placeholder="Enter your account password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="w-10 h-10 flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Layout-Shift-Free Error Container */}
            {error && (
              <div className="flex items-start gap-2.5 text-red-400 text-xs bg-red-950/40 border border-red-800/50 rounded-xl p-3 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 sm:h-13 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.99] text-slate-950 font-bold rounded-xl text-sm tracking-wide transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Authenticating…</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-slate-950" />
                  <span>Sign In to Console</span>
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-center text-slate-400 text-[11px] leading-relaxed">
            <Lock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span>Authorized access only. Contact your General Superintendent or Secretary for credentials.</span>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="w-full max-w-md py-3 text-center text-[11px] text-slate-500 relative z-10">
        House of Fellowship Sunday School &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};
