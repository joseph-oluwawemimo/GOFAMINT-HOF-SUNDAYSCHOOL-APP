import React, { useState } from 'react';
import { Lock, Shield, AlertCircle, Loader2, LogOut } from 'lucide-react';
import { reauthenticateUser, signOutUser } from '../services/authService';
import { GofamintLogo } from './GofamintLogo';

interface LockScreenProps {
  userEmail: string;
  userRole?: string;
  onUnlocked: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ userEmail, userRole, onUnlocked }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your password to unlock.');
      return;
    }
    setError(null);
    setIsVerifying(true);
    try {
      const ok = await reauthenticateUser(password);
      if (ok) {
        sessionStorage.removeItem('gofamint_profile_locked');
        onUnlocked();
      } else {
        setError('Incorrect password. Please verify your credentials.');
      }
    } catch (err: any) {
      setError('Unlock verification failed. Check connection.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSignOut = async () => {
    sessionStorage.removeItem('gofamint_profile_locked');
    await signOutUser();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white/95 rounded-2xl shadow-2xl p-8 border border-white/20 text-center">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-950 border border-amber-400/40 flex items-center justify-center shadow-lg">
            <Lock className="w-7 h-7 text-amber-400" />
          </div>
        </div>

        <h2 className="text-lg font-bold text-slate-900 font-['Cinzel',serif] tracking-wide">
          Console Locked
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Active Session for <strong className="text-slate-800">{userEmail}</strong>
          {userRole && <span className="block text-[11px] text-amber-700 font-semibold uppercase mt-0.5">{userRole.replace(/_/g, ' ')}</span>}
        </p>

        <form onSubmit={handleUnlock} className="mt-6 space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Enter Password to Resume</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-slate-50 focus:bg-white transition"
              placeholder="••••••••"
              autoFocus
              disabled={isVerifying}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl p-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full bg-blue-950 hover:bg-blue-900 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Verifying…</span>
              </>
            ) : (
              <span>Unlock Console</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs text-slate-500 hover:text-red-600 font-medium inline-flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out completely</span>
          </button>
        </div>
      </div>
    </div>
  );
};
