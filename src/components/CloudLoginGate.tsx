import React, { useState } from 'react';
import { Lock, Church, AlertCircle, Loader2, User as UserIcon } from 'lucide-react';
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
 * Full-screen sign-in gate. Supports both standard email addresses
 * (e.g. pastor@example.com) and class-specific Login IDs (e.g. YOUTHA).
 */
export const CloudLoginGate: React.FC<CloudLoginGateProps> = ({ onSignedIn, isSystemInitialized, onFirstRunComplete }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError('Please enter your email or class login ID, and your password.');
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
      <div className="min-h-screen bg-blue-950 flex flex-col items-center justify-center text-slate-300 p-4 text-center">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-blue-200 mt-1">Checking system configuration...</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white border border-amber-400/40 flex items-center justify-center mb-3 shadow-lg p-2">
            <img src="/gofamint-logo.svg" alt="GOFAMINT Logo" className="w-10 h-10 object-contain drop-shadow" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 text-center font-['Cinzel',serif] tracking-wide">
            THE GOSPEL FAITH MISSION INTL
          </h1>
          <p className="text-xs text-slate-500 mt-1 text-center font-medium">Sunday School Directorate — Secure Sign In</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Role ID, Email, or Class ID</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-slate-50 focus:bg-white transition"
                placeholder="e.g. GS, GSEC, YOUTH_A, or your email"
                autoCapitalize="none"
                autoCorrect="off"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-slate-50 focus:bg-white transition"
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-950 hover:bg-blue-900 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Authenticating…</span>
              </>
            ) : (
              <span>Sign In to Console</span>
            )}
          </button>
        </form>

        <p className="text-[11px] text-slate-400 text-center mt-4 leading-relaxed">
          Authorized personnel only. Contact your General Superintendent or General Secretary for login credentials.
        </p>
      </div>
    </div>
  );
};
