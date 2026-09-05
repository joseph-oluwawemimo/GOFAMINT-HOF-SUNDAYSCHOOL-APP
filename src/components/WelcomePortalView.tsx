import React, { useState } from 'react';
import {
  Church,
  BookOpen,
  Users,
  Award,
  KeyRound,
  Sparkles,
  ArrowRight,
  Trash2,
  Database,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Play,
  UserPlus
} from 'lucide-react';
import { GofamintLogo } from './GofamintLogo';
import { ClassProfile, Member } from '../types';

interface WelcomePortalViewProps {
  classProfile: ClassProfile | null;
  members: Member[];
  isUnlocked: boolean;
  onEnterClass: () => void;
  onOpenRegisterNewClass: () => void;
  onClearDataAndStartScratch: () => void;
}

export const WelcomePortalView: React.FC<WelcomePortalViewProps> = ({
  classProfile,
  members,
  isUnlocked,
  onEnterClass,
  onOpenRegisterNewClass,
  onClearDataAndStartScratch
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const activeStudentsCount = members.filter(m => m.memberType === 'STUDENT' && m.status !== 'LEFT_CLASS').length;
  const activeVisitorsCount = members.filter(m => m.memberType === 'VISITOR' && m.status !== 'LEFT_CLASS').length;
  const hasClass = !!classProfile && !!classProfile.className;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-10 font-sans text-slate-800 animate-fade-in">
      
      <div className="max-w-4xl w-full mx-auto space-y-6 sm:space-y-8 my-auto py-4">
        
        {/* Main Branding Card */}
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 shadow-md text-center relative overflow-hidden">
          
          {/* Church Crest & Header */}
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center mx-auto mb-3">
              <GofamintLogo className="w-20 h-20 drop-shadow-lg" />
            </div>

            <div className="inline-block px-3 py-1 bg-amber-100 border border-amber-300 rounded-full text-[11px] font-black uppercase tracking-wider text-amber-900 mb-2">
              The Gospel Faith Mission International (House of Favour)
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase font-['Cinzel',serif]">
              GOFAMINT_HOF Sunday School Register
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto mt-2 leading-relaxed">
              Official offline-first application for class registration, weekly lesson topic management, 12-week student grading, qualification tracking, and attendance care.
            </p>
          </div>

          {/* Current Class Status Panel */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            {hasClass ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Class Profile</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    {classProfile.className}
                  </h3>
                  <p className="text-xs text-slate-600">
                    Department: <strong className="text-blue-900">{classProfile.department}</strong> | Secretary: {classProfile.secretaryName || 'Not Assigned'}
                  </p>
                  <div className="flex items-center gap-3 pt-1 text-xs text-slate-500 font-semibold">
                    <span>{activeStudentsCount} Students</span>
                    <span>•</span>
                    <span>{activeVisitorsCount} Visitors</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0">
                  <button
                    id="welcome-btn-enter-class"
                    onClick={onEnterClass}
                    className="px-6 py-3 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition transform active:scale-95"
                  >
                    <span>{isUnlocked ? 'Go to Class Dashboard' : 'Log In / Enter Class'}</span>
                    <ArrowRight className="w-4 h-4 text-amber-300" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 max-w-xl mx-auto text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 border border-blue-300 text-blue-900 flex items-center justify-center mx-auto">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">No Class Registered Yet</h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Start by setting up your Sunday School class name, teachers, and security password.
                  </p>
                </div>
                <button
                  id="welcome-btn-get-started"
                  onClick={onOpenRegisterNewClass}
                  className="px-6 py-3 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 mx-auto shadow-md transition transform active:scale-95"
                >
                  <span>Register Your Class & Start Fresh</span>
                  <ArrowRight className="w-4 h-4 text-amber-300" />
                </button>
              </div>
            )}
          </div>

        </div>

        {/* 3 Simple Steps Guide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-900 font-black text-sm flex items-center justify-center shrink-0 border border-blue-200">
              1
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Register & Password
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                Enter your class name, department, secretary details, and set a secret password.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 font-black text-sm flex items-center justify-center shrink-0 border border-amber-300">
              2
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Add Week 1 Topic
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                Enter the lesson topic for the week and register your students into the class roster.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-900 font-black text-sm flex items-center justify-center shrink-0 border border-emerald-300">
              3
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Mark Weekly Entries
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                Mark attendance and 50-point lesson scores for each student every Sunday with ease.
              </p>
            </div>
          </div>

        </div>

        {/* Database Management & Actions Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-900" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Setup & Database Options
              </h4>
            </div>
            <span className="text-[11px] text-slate-400 font-semibold">Offline IndexedDB</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            
            {/* Register New Class Button */}
            <button
              id="welcome-btn-register-new"
              onClick={onOpenRegisterNewClass}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-2 transition"
            >
              <UserPlus className="w-4 h-4 text-blue-900" />
              <span>Register New Class Profile</span>
            </button>

            {/* Clear All Data & Start From Scratch */}
            <button
              id="welcome-btn-clear-scratch"
              onClick={() => setShowClearConfirm(true)}
              className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 rounded-lg text-xs font-bold flex items-center gap-2 transition"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <span>Clear All Data & Start Fresh</span>
            </button>

          </div>
        </div>

      </div>

      {/* Footer Note */}
      <div className="text-center text-xs text-slate-500 font-semibold py-2">
        <span>The Gospel Faith Mission International (House of Favour) (GOFAMINT_HOF) • Sunday School Department</span>
      </div>

      {/* Modal: Confirm Clear Demo Data */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-base font-black text-slate-900">Clear All Data & Start Fresh?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will remove all class records and reset your local database so you can start with a clean slate.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-clear-scratch"
                onClick={() => {
                  setShowClearConfirm(false);
                  onClearDataAndStartScratch();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                Yes, Clear All Data
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
