import React, { useState } from 'react';
import {
  ArrowRight,
  Shield,
  Lock,
  UserCheck,
  Building,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowLeft,
  AlertTriangle,
  User,
  Check,
  Plus,
  Trash2,
  X,
  Activity
} from 'lucide-react';
import { GofamintLogo } from './GofamintLogo';
import { ClassProfile, TeacherInfo, Member, WorkerProfile } from '../types';
import {
  getAllWorkers,
  getAllDepartmentsList,
  getAllClassesDirectory,
  cacheConfirmedClassProfile
} from '../db/indexedDB';
import { ApplicationProfile } from '../services/profileService';
import { isExactClassAssignment } from '../utils/accessControl';
import { submitClassRegistrationApi } from '../services/adminUserApi';

interface OpeningFlowViewProps {
  classProfile: ClassProfile | null;
  members: Member[];
  isUnlocked: boolean;
  onEnterClass: (selectedProfile?: ClassProfile) => void;
  onEnterAdminPortal?: () => void;
  onEnterWorkersModule?: () => void;
  onEnterSibPortal?: () => void;
  onRegisterNewClassSubmit: (profile: ClassProfile) => void;
  onClearDataAndStartScratch?: () => void;
  onDatabaseRestored?: () => void;
  currentUserProfile?: ApplicationProfile | null;
  cloudUser?: any | null;
}

type FlowStep = 'OPENING_PAGE' | 'PORTAL_SELECTION' | 'TEACHER_PORTAL_HOME';

const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'GENERAL_SUPERINTENDENT',
  'DEPARTMENT_SUPERINTENDENT',
  'GENERAL_SECRETARY',
  'ASST_GENERAL_SECRETARY',
  'ASSISTANT_GENERAL_SECRETARY',
  'TREASURER',
  'RECORD_OFFICER',
  'ENROLLMENT_OFFICER'
];

const ROLE_FORMATTED_NAMES: Record<string, string> = {
  GENERAL_SUPERINTENDENT: 'General Superintendent',
  DEPARTMENT_SUPERINTENDENT: 'Departmental Superintendent',
  GENERAL_SECRETARY: 'General Secretary',
  ASST_GENERAL_SECRETARY: 'Assistant General Secretary',
  ASSISTANT_GENERAL_SECRETARY: 'Assistant General Secretary',
  TREASURER: 'Sunday School Treasurer',
  RECORD_OFFICER: 'Record Officer',
  ENROLLMENT_OFFICER: 'Enrollment Officer',
  TEACHER: 'Class Teacher',
  CLASS_SECRETARY: 'Class Secretary',
  'TEACHER / CLASS_SECRETARY': 'Class Teacher / Secretary',
  WORKER: 'Sunday School Worker',
  SUPER_ADMIN: 'Executive Council Leader'
};

export const OpeningFlowView: React.FC<OpeningFlowViewProps> = ({
  classProfile,
  members,
  isUnlocked,
  onEnterClass,
  onEnterAdminPortal,
  onEnterWorkersModule,
  onEnterSibPortal,
  onRegisterNewClassSubmit,
  currentUserProfile,
  cloudUser
}) => {
  const [currentStep, setCurrentStep] = useState<FlowStep>('OPENING_PAGE');
  const [workersList, setWorkersList] = useState<WorkerProfile[]>([]);
  const [allClassesList, setAllClassesList] = useState<ClassProfile[]>([]);
  const [authErrorModalMessage, setAuthErrorModalMessage] = useState<string | null>(null);
  const [directoryLoadError, setDirectoryLoadError] = useState<string | null>(null);

  // Registering a class modal state
  const [registeringClass, setRegisteringClass] = useState<ClassProfile | null>(null);
  const [selectedSecretaryWorkerId, setSelectedSecretaryWorkerId] = useState('');
  const [secretaryName, setSecretaryName] = useState('');
  const [secretaryPhone, setSecretaryPhone] = useState('');
  const [teachers, setTeachers] = useState<TeacherInfo[]>([
    { id: `t_${Date.now()}_1`, name: '', phone: '', isHeadTeacher: true }
  ]);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [registrationSuccessNotice, setRegistrationSuccessNotice] = useState<string | null>(null);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);

  // Admin and authorization flags
  const userRole = currentUserProfile?.role || '';
  const isAdmin = ADMIN_ROLES.includes(userRole);
  const isWorker = ['WORKER', 'RECORD_OFFICER', 'ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY', 'GENERAL_SECRETARY', 'GENERAL_SUPERINTENDENT', 'SUPER_ADMIN'].includes(userRole);

  // Format user display name and portfolio title
  const userName =
    currentUserProfile?.displayName ||
    cloudUser?.user_metadata?.full_name ||
    (cloudUser?.email ? cloudUser.email.split('@')[0] : 'Sunday School Minister');
  const userPortfolio = ROLE_FORMATTED_NAMES[userRole] || 'Sunday Bible School Officer';

  // Specific assigned class for class isolation (Item 11)
  const assignedClassId =
    currentUserProfile?.classId || null;

  const [isLoadingClasses, setIsLoadingClasses] = useState(false);

  const refreshClassesAndWorkers = async (forceCloud = false) => {
    try {
      setIsLoadingClasses(true);
      setDirectoryLoadError(null);
      const [workers, classes] = await Promise.all([
        getAllWorkers(forceCloud || workersList.length === 0),
        getAllClassesDirectory(forceCloud || allClassesList.length === 0)
      ]);
      setWorkersList(workers || []);
      setAllClassesList(classes || []);
    } catch (err) {
      console.error('Error loading classes or workers:', err);
      const message = err instanceof Error ? err.message : String(err);
      setDirectoryLoadError(`The class directory could not be loaded: ${message}`);
    } finally {
      setIsLoadingClasses(false);
    }
  };

  // Check if class user is authorized to access a given class
  const isAuthorizedForClass = (cls: ClassProfile) => {
    if (userRole === 'GENERAL_SUPERINTENDENT' || userRole === 'SUPER_ADMIN') return true;
    if (!assignedClassId) return false;
    return isExactClassAssignment(assignedClassId, cls.id);
  };

  const isClassPortalUser = ['TEACHER', 'CLASS_SECRETARY', 'TEACHER / CLASS_SECRETARY'].includes(userRole);
  const visibleClasses = isClassPortalUser
    ? allClassesList.filter(isAuthorizedForClass)
    : allClassesList;

  // Handle Admin Portal click (Item 9)
  const handleAdminPortalClick = () => {
    if (isAdmin && onEnterAdminPortal) {
      onEnterAdminPortal();
    } else {
      setAuthErrorModalMessage('You are not authorized to enter this portal.');
    }
  };

  // Handle Workers Directory click (Item 9)
  const handleWorkersModuleClick = () => {
    if (isWorker && onEnterWorkersModule) {
      onEnterWorkersModule();
    } else {
      setAuthErrorModalMessage('You are not authorized to enter this portal.');
    }
  };

  // Handle SIB Portal click
  const handleSibPortalClick = () => {
    if (onEnterSibPortal) {
      onEnterSibPortal();
    } else {
      setAuthErrorModalMessage('You are not authorized to enter this portal.');
    }
  };

  // Open registration modal for a class
  const handleOpenClassRegistration = (cls: ClassProfile) => {
    if (!isAuthorizedForClass(cls)) {
      setAuthErrorModalMessage('You are not authorized to enter this class register.');
      return;
    }
    setRegisteringClass(cls);
    setSecretaryName(cls.secretaryName || '');
    setSecretaryPhone(cls.secretaryPhone || '');
    if (cls.teachers && cls.teachers.length > 0) {
      setTeachers(cls.teachers);
    } else {
      setTeachers([{ id: `t_${Date.now()}_1`, name: '', phone: '', isHeadTeacher: true }]);
    }
    setRegistrationError(null);
  };

  // Handle Teacher/Secretary entering class register (Item 11 & 12)
  const handleEnterApprovedClass = (cls: ClassProfile) => {
    if (!isAuthorizedForClass(cls)) {
      setAuthErrorModalMessage('You are not authorized to enter this class register.');
      return;
    }
    onEnterClass(cls);
  };

  // Secretary worker select
  const handleSecretarySelect = (workerId: string) => {
    setSelectedSecretaryWorkerId(workerId);
    const worker = workersList.find((w) => w.id === workerId);
    if (worker) {
      setSecretaryName(worker.fullName);
      setSecretaryPhone(worker.phone || '');
    } else {
      setSecretaryName('');
      setSecretaryPhone('');
    }
  };

  // Teacher worker select
  const handleTeacherWorkerSelect = (index: number, workerId: string) => {
    const worker = workersList.find((w) => w.id === workerId);
    setTeachers((prev) => {
      const updated = [...prev];
      if (worker) {
        updated[index] = {
          ...updated[index],
          id: worker.id,
          name: worker.fullName,
          phone: worker.phone || ''
        };
      } else {
        updated[index] = {
          ...updated[index],
          name: '',
          phone: ''
        };
      }
      return updated;
    });
  };

  const handleAddTeacher = () => {
    setTeachers((prev) => [
      ...prev,
      { id: `t_${Date.now()}_${prev.length + 1}`, name: '', phone: '' }
    ]);
  };

  const handleRemoveTeacher = (index: number) => {
    if (teachers.length <= 1) return;
    setTeachers((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Class Registration -> PENDING_APPROVAL (Item 5 & 6)
  const handleSubmitClassRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registeringClass) return;
    setRegistrationError(null);

    if (!selectedSecretaryWorkerId || !secretaryName.trim()) {
      setRegistrationError('Please select a registered worker as Class Secretary.');
      return;
    }

    const validTeachers = teachers.filter((t) => t.name.trim() !== '');
    if (validTeachers.length === 0) {
      setRegistrationError('Please select at least one registered worker as Class Teacher.');
      return;
    }

    const updatedProfile: ClassProfile = {
      ...registeringClass,
      secretaryName: secretaryName.trim(),
      secretaryPhone: secretaryPhone.trim(),
      teachers: validTeachers,
      isSetupComplete: true,
      approvalStatus: 'PENDING_APPROVAL',
      updatedAt: new Date().toISOString()
    };

    try {
      setIsSubmittingRegistration(true);
      const response = await submitClassRegistrationApi(updatedProfile.id, {
        secretaryWorkerId: selectedSecretaryWorkerId,
        teacherWorkerIds: validTeachers.map(teacher => teacher.id),
      });
      if (!response.success || !response.class) {
        throw new Error(response.error || 'The server did not confirm the class registration.');
      }
      const confirmedProfile = response.class as ClassProfile;
      await cacheConfirmedClassProfile(confirmedProfile);
      await onRegisterNewClassSubmit(confirmedProfile);
      setRegisteringClass(null);
      setRegistrationSuccessNotice(
        `Class "${confirmedProfile.className}" registration has been submitted! It is now pending approval from the General Secretary or General Superintendent.`
      );
      setTimeout(() => setRegistrationSuccessNotice(null), 8000);
      await refreshClassesAndWorkers();
    } catch (err: any) {
      setRegistrationError(err?.message || 'Failed to submit class registration. Please try again.');
    } finally {
      setIsSubmittingRegistration(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans text-slate-800 animate-in fade-in duration-300">
      
      {/* ----------------- STAGE 1: PROFESSIONAL WELCOME SCREEN (Item 8) ----------------- */}
      {currentStep === 'OPENING_PAGE' && (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
          {/* Subtle ambient lighting */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl w-full mx-auto text-center relative z-10 space-y-6">
            
            {/* Gradient Card Container with exact Asst Gen Sec blue styling */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-8 sm:p-12 shadow-2xl border-2 border-indigo-400/40 relative overflow-hidden space-y-6">
              
              {/* Official GOFAMINT Logo (Item 7 & 25) */}
              <div className="flex items-center justify-center mx-auto">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white p-3 shadow-2xl border-2 border-amber-400/40 flex items-center justify-center transform hover:scale-105 transition">
                  <img
                    src="/gofamint-logo.svg"
                    alt="GOFAMINT Official Logo"
                    className="w-full h-full object-contain drop-shadow-md"
                  />
                </div>
              </div>

              {/* Church Branding Header */}
              <div className="space-y-2">
                <div className="inline-block px-4 py-1.5 bg-indigo-500/20 border border-indigo-400/40 rounded-full text-xs font-black uppercase tracking-wider text-amber-300">
                  THE GOSPEL FAITH MISSION INTERNATIONAL
                </div>

                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-wide font-['Cinzel',serif] uppercase leading-tight drop-shadow-md">
                  Sunday Bible School
                </h1>
                
                <h2 className="text-lg sm:text-2xl font-bold text-amber-400 tracking-widest font-['Cinzel',serif] uppercase">
                  Sunday Bible School App
                </h2>
              </div>

              {/* User Identity & Portfolio Badge (Item 8) */}
              <div className="max-w-md mx-auto bg-white/10 backdrop-blur-md border border-indigo-300/30 rounded-2xl p-5 text-center shadow-inner space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-200">
                  <User className="w-3.5 h-3.5 text-amber-300" />
                  <span>Authenticated Personnel</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  {userName}
                </h3>
                <p className="text-amber-400 font-bold text-sm sm:text-base font-['Cinzel',serif]">
                  {userPortfolio}
                </p>
              </div>

              {/* Proceed Action Button (Item 8) */}
              <div className="pt-2 max-w-md mx-auto">
                <button
                  id="btn-welcome-proceed"
                  onClick={() => setCurrentStep('PORTAL_SELECTION')}
                  className="w-full py-4 sm:py-5 px-8 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98] text-slate-950 rounded-2xl text-base sm:text-lg font-black flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition transform cursor-pointer"
                >
                  <span>Proceed into Our Portal</span>
                  <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950" />
                </button>
              </div>

            </div>

            <div className="text-xs text-slate-400 font-semibold tracking-wider uppercase">
              GOFAMINT Sunday School Directorate • General Secretariat
            </div>

          </div>
        </div>
      )}

      {/* ----------------- STAGE 2: PORTAL SELECTION (Item 9) ----------------- */}
      {currentStep === 'PORTAL_SELECTION' && (
        <div className="max-w-4xl w-full mx-auto my-auto p-4 sm:p-6 lg:p-8 space-y-6">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <button
              onClick={() => setCurrentStep('OPENING_PAGE')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition mb-2 shadow-xs cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Welcome</span>
            </button>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-['Cinzel',serif] uppercase">
              Select Portal Destination
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
              Please choose your authorized Sunday School console to proceed.
            </p>
          </div>

          {/* 4 Clean Portal Cards (Admin, Workers, Teacher/Secretary, and SIB) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
            
            {/* 1. Admin Portal */}
            <div className="bg-white border-2 border-slate-900 rounded-2xl p-6 flex flex-col justify-between shadow-lg hover:shadow-xl transition relative border-t-8 border-t-amber-500">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-950">
                    <Shield className="w-6 h-6 text-amber-900" />
                  </div>
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider rounded-md border border-amber-300">
                    Executive Portal
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
                    1. Admin Portal
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    General Superintendent, General Secretary, Assistant General Secretary, Treasurer, Record Officer, and Enrollment Officer.
                  </p>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-slate-200">
                <button
                  id="btn-portal-select-admin"
                  onClick={handleAdminPortalClick}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-amber-400 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>Enter Admin Portal</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                </button>
              </div>
            </div>

            {/* 2. Workers Directorate */}
            <div className="bg-white border-2 border-slate-900 rounded-2xl p-6 flex flex-col justify-between shadow-lg hover:shadow-xl transition relative border-t-8 border-t-emerald-600">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-950">
                    <Sparkles className="w-6 h-6 text-emerald-700" />
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 text-[10px] font-black uppercase tracking-wider rounded-md border border-emerald-300">
                    Dedicated Module
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
                    2. Workers Directorate
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    High-speed Sunday QR Code Clock-In Terminal, Master Worker Directory, and administrative oversight.
                  </p>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-slate-200">
                <button
                  id="btn-portal-select-workers"
                  onClick={handleWorkersModuleClick}
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 active:scale-[0.98] text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Workers Directorate</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </div>

            {/* 3. Teacher / Secretary Portal */}
            <div className="bg-white border-2 border-blue-900 rounded-2xl p-6 flex flex-col justify-between shadow-lg hover:shadow-xl transition relative border-t-8 border-t-blue-900">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-900">
                    <UserCheck className="w-6 h-6 text-blue-900" />
                  </div>
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-900 text-[10px] font-black uppercase tracking-wider rounded-md border border-blue-300">
                    Class Portal
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
                    3. Teacher / Secretary Portal
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Class registration, weekly student attendance grading, offering remittance, and pastoral registers.
                  </p>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-slate-200">
                <button
                  id="btn-portal-select-teacher"
                  onClick={() => {
                    void refreshClassesAndWorkers(true);
                    setCurrentStep('TEACHER_PORTAL_HOME');
                  }}
                  className="w-full py-3 bg-blue-900 hover:bg-blue-800 active:scale-[0.98] text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                >
                  <span>Enter Teachers Portal</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
                </button>
              </div>
            </div>

            {/* 4. School Intelligence Board (SIB) */}
            <div className="bg-white border-2 border-slate-900 rounded-2xl p-6 flex flex-col justify-between shadow-lg hover:shadow-xl transition relative border-t-8 border-t-indigo-600">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 border border-indigo-300 flex items-center justify-center text-indigo-950">
                    <Activity className="w-6 h-6 text-indigo-700" />
                  </div>
                  <span className="px-2.5 py-1 bg-indigo-100 text-indigo-900 text-[10px] font-black uppercase tracking-wider rounded-md border border-indigo-300">
                    Intelligence Layer
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-900 font-['Cinzel',serif]">
                    4. School Intelligence Board
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Deterministic class health scores, repeated absence alerts, pastoral follow-up tracking, evidence drawers, and Ask SIB AI agent.
                  </p>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-slate-200">
                <button
                  id="btn-portal-select-sib"
                  onClick={handleSibPortalClick}
                  className="w-full py-3 bg-indigo-900 hover:bg-indigo-800 active:scale-[0.98] text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Enter SIB Portal</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </div>

          </div>

          <div className="text-center text-xs text-slate-500 pt-4 font-semibold">
            GOFAMINT Sunday School Management System
          </div>

        </div>
      )}

      {/* ----------------- STAGE 3: TEACHER & SECRETARY PORTAL (Items 10, 11, 12) ----------------- */}
      {currentStep === 'TEACHER_PORTAL_HOME' && (
        <div className="max-w-5xl w-full mx-auto my-auto p-4 sm:p-6 lg:p-8 space-y-6">
          
          {/* Navigation Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentStep('OPENING_PAGE')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition shadow-xs cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Welcome Page</span>
              </button>
              <button
                onClick={() => setCurrentStep('PORTAL_SELECTION')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-blue-900 hover:text-blue-800 transition shadow-xs cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Portal Selection</span>
              </button>
            </div>

            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Teacher & Secretary Portal
            </div>
          </div>

          {/* Success notice */}
          {registrationSuccessNotice && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p>{registrationSuccessNotice}</p>
            </div>
          )}

          {/* Information Banner (Item 10: Only Asst Gen Sec creates class profiles) */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-md flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-amber-300 bg-blue-950 px-2.5 py-0.5 rounded border border-blue-800">
                CLASS REGISTRATION & ACCESS SYSTEM
              </span>
              <h3 className="text-base sm:text-lg font-black text-white">
                Sunday School Class Directory
              </h3>
              <p className="text-xs text-blue-200">
                Classes are created by the Assistant General Secretary. Complete your class registration by assigning your teacher and secretary, then submit for approval.
              </p>
            </div>
          </div>

          {/* Directory of Classes by Status (Item 10 & 12) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-900" />
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  Classes and Lifecycle Status
                </h4>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {visibleClasses.length} Available {visibleClasses.length === 1 ? 'Class' : 'Classes'}
              </span>
            </div>

            {isLoadingClasses ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs space-y-2">
                <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="font-bold text-slate-800">Loading Sunday School Classes...</p>
                <p className="text-[11px] text-slate-500">Connecting to cloud directory</p>
              </div>
            ) : directoryLoadError ? (
              <div role="alert" className="bg-rose-50 border border-rose-300 rounded-xl p-6 text-center text-rose-800 text-xs space-y-3">
                <p className="font-bold">{directoryLoadError}</p>
                <button
                  type="button"
                  onClick={() => void refreshClassesAndWorkers(true)}
                  className="px-4 py-2 rounded-lg bg-blue-900 text-white font-bold"
                >
                  Retry directory load
                </button>
              </div>
            ) : visibleClasses.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-500 text-xs space-y-1">
                <p className="font-bold">No class is assigned to this account.</p>
                <p>Ask an administrator to assign the correct class ID to your approved profile.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleClasses.map((cls) => {
                  const status = cls.approvalStatus || 'PENDING_REGISTRATION';
                  const isPendingReg = status === 'PENDING_REGISTRATION';
                  const isPendingApproval = status === 'PENDING_APPROVAL';
                  const isApproved = status === 'APPROVED';

                  return (
                    <div
                      key={cls.id}
                      className={`border-2 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                        isPendingReg
                          ? 'border-blue-300 bg-blue-50/40'
                          : isPendingApproval
                          ? 'border-amber-300 bg-amber-50/40'
                          : 'border-emerald-300 bg-emerald-50/30'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                              isPendingReg
                                ? 'bg-blue-100 text-blue-800 border-blue-300'
                                : isPendingApproval
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}
                          >
                            {isPendingReg
                              ? 'Pending Registration'
                              : isPendingApproval
                              ? 'Pending Approval'
                              : 'Approved & Active'}
                          </span>
                          <span className="text-xs font-bold text-slate-500">
                            Dept: <strong className="text-slate-800">{cls.department}</strong>
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                            ID: {cls.id}
                          </span>
                        </div>

                        <h3 className="text-base sm:text-lg font-black text-slate-900">
                          {cls.className}
                        </h3>

                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span>
                            Secretary: <strong>{cls.secretaryName || 'Not Assigned Yet'}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Teachers:{' '}
                            <strong>
                              {cls.teachers && cls.teachers.length > 0
                                ? cls.teachers.map((t) => t.name).filter(Boolean).join(', ')
                                : 'Not Assigned Yet'}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons with 3-State Logic (Item 12) */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                        {/* State 1: PENDING_REGISTRATION -> Register Class is active (blue); Register locked */}
                        {isPendingReg && (
                          <>
                            <button
                              id={`btn-register-class-${cls.id}`}
                              onClick={() => handleOpenClassRegistration(cls)}
                              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span>Register Class</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled
                              className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 text-slate-400 rounded-xl text-xs font-bold opacity-60 cursor-not-allowed flex items-center justify-center gap-1.5"
                              title="Register class first and await approval to unlock register"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Register Locked</span>
                            </button>
                          </>
                        )}

                        {/* State 2: PENDING_APPROVAL -> Registration locked; Register locked */}
                        {isPendingApproval && (
                          <>
                            <div className="px-3.5 py-2 bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-700" />
                              <span>Registration Locked (Pending Approval)</span>
                            </div>
                            <button
                              disabled
                              className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 text-slate-400 rounded-xl text-xs font-bold opacity-60 cursor-not-allowed flex items-center justify-center gap-1.5"
                              title="Awaiting General Secretary or General Superintendent approval"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Register Locked</span>
                            </button>
                          </>
                        )}

                        {/* State 3: APPROVED -> Registration locked; Enter Class Register is active */}
                        {isApproved && (
                          <>
                            <div className="px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Approved</span>
                            </div>
                            <button
                              id={`btn-enter-class-${cls.id}`}
                              onClick={() => handleEnterApprovedClass(cls)}
                              className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-black transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <span>Enter Class Register</span>
                              <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ----------------- CLASS REGISTRATION MODAL (Items 5 & 6) ----------------- */}
      {registeringClass && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-200">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  COMPLETE CLASS REGISTRATION
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {registeringClass.className}
                </h3>
              </div>
              <button
                onClick={() => setRegisteringClass(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Read-only profile metadata established by Asst General Secretary */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Department</span>
                <strong className="text-slate-800">{registeringClass.department}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Unique Class ID</span>
                <strong className="text-slate-800 font-mono">{registeringClass.id}</strong>
              </div>
            </div>

            {registrationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{registrationError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitClassRegistration} className="space-y-4">
              
              {/* Select Class Secretary */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Class Secretary <span className="text-rose-600">*</span>
                </label>
                <select
                  value={selectedSecretaryWorkerId}
                  onChange={(e) => handleSecretarySelect(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">-- Select Registered Worker as Secretary --</option>
                  {workersList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.fullName} ({w.role || 'Worker'})
                    </option>
                  ))}
                </select>
                {secretaryPhone && (
                  <span className="text-[11px] text-slate-500">Phone: {secretaryPhone}</span>
                )}
              </div>

              {/* Select Class Teachers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Class Teacher(s) <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddTeacher}
                    className="text-[11px] font-black text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Teacher</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {teachers.map((teacher, index) => (
                    <div key={teacher.id || index} className="flex items-center gap-2">
                      <select
                        value={teacher.id?.startsWith('w_') ? teacher.id : ''}
                        onChange={(e) => handleTeacherWorkerSelect(index, e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="">-- Select Teacher {index + 1} --</option>
                        {workersList.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.fullName} ({w.role || 'Worker'})
                          </option>
                        ))}
                      </select>
                      {teachers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTeacher(index)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                          title="Remove Teacher"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button: Proceed for Approval (Item 5 & 6) */}
              <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRegisteringClass(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-proceed-for-approval"
                  disabled={isSubmittingRegistration}
                  className="flex-1 py-3 bg-blue-900 hover:bg-blue-800 active:scale-98 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{isSubmittingRegistration ? 'Submitting…' : 'Proceed for Approval'}</span>
                  <ArrowRight className="w-4 h-4 text-amber-300" />
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ----------------- AUTH ERROR POPUP MODAL (Item 9 & 11) ----------------- */}
      {authErrorModalMessage && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border-2 border-rose-300 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center mx-auto text-rose-700">
              <Shield className="w-6 h-6 text-rose-600" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">
                Access Restricted
              </h3>
              <p className="text-xs font-bold text-rose-700">
                {authErrorModalMessage}
              </p>
            </div>
            <button
              onClick={() => setAuthErrorModalMessage(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
