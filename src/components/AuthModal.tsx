import React, { useState, useEffect } from 'react';
import {
  Church,
  Lock,
  UserCheck,
  Plus,
  Trash2,
  KeyRound,
  BookOpen,
  Phone,
  User,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Clock
} from 'lucide-react';
import { GofamintLogo } from './GofamintLogo';
import { ClassProfile, DepartmentType, TeacherInfo, WorkerProfile } from '../types';
import { getAllWorkers, getAllDepartmentsList } from '../db/indexedDB';

interface AuthModalProps {
  isOpen: boolean;
  isFirstRun: boolean;
  existingClassProfile: ClassProfile | null;
  onCompleteSetup: (profile: ClassProfile) => void;
  onUnlock: (password: string) => boolean;
  onCancel?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  isFirstRun,
  existingClassProfile,
  onCompleteSetup,
  onUnlock,
  onCancel
}) => {
  const [workersList, setWorkersList] = useState<WorkerProfile[]>([]);
  const [departmentsList, setDepartmentsList] = useState<string[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);

  // First-Run Registration States
  const [className, setClassName] = useState(existingClassProfile?.className || '');
  const [department, setDepartment] = useState<string>(existingClassProfile?.department || 'Young Adults');
  const [selectedSecretaryWorkerId, setSelectedSecretaryWorkerId] = useState<string>('');
  const [secretaryName, setSecretaryName] = useState(existingClassProfile?.secretaryName || '');
  const [secretaryPhone, setSecretaryPhone] = useState(existingClassProfile?.secretaryPhone || '');
  
  const [teachers, setTeachers] = useState<TeacherInfo[]>(
    existingClassProfile?.teachers?.length
      ? existingClassProfile.teachers
      : [{ id: `teacher_${Date.now()}`, name: '', phone: '', isHeadTeacher: true }]
  );
  const [password, setPassword] = useState('gofamint123');
  const [confirmPassword, setConfirmPassword] = useState('gofamint123');
  const [quarterTitle, setQuarterTitle] = useState('Quarter 1: The Discipleship Standard');
  const [currencySymbol, setCurrencySymbol] = useState('₦');
  const [setupError, setSetupError] = useState<string | null>(null);

  // Subsequent Lock Screen State
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const loadMeta = async () => {
        try {
          setIsLoadingMetadata(true);
          const [loadedWorkers, loadedDepts] = await Promise.all([
            getAllWorkers(true),
            getAllDepartmentsList()
          ]);
          setWorkersList(loadedWorkers);
          setDepartmentsList(loadedDepts);

          if (loadedDepts.length > 0 && !existingClassProfile?.department) {
            setDepartment(loadedDepts[0]);
          }

          // If secretary exists in workers, match by name
          if (existingClassProfile?.secretaryName) {
            const matchedSec = loadedWorkers.find(w => w.fullName === existingClassProfile.secretaryName);
            if (matchedSec) {
              setSelectedSecretaryWorkerId(matchedSec.id);
            }
          }
        } catch (err) {
          console.error('Error loading metadata in AuthModal:', err);
        } finally {
          setIsLoadingMetadata(false);
        }
      };
      loadMeta();
    }
  }, [isOpen, existingClassProfile]);

  if (!isOpen) return null;

  const handleSecretarySelect = (workerId: string) => {
    setSelectedSecretaryWorkerId(workerId);
    const worker = workersList.find(w => w.id === workerId);
    if (worker) {
      setSecretaryName(worker.fullName);
      setSecretaryPhone(worker.phone || '');
    } else {
      setSecretaryName('');
      setSecretaryPhone('');
    }
  };

  const handleAddTeacher = () => {
    setTeachers(prev => [
      ...prev,
      { id: `teacher_${Date.now()}`, name: '', phone: '' }
    ]);
  };

  const handleRemoveTeacher = (index: number) => {
    if (teachers.length <= 1) return;
    setTeachers(prev => prev.filter((_, i) => i !== index));
  };

  const handleTeacherWorkerSelect = (index: number, workerId: string) => {
    const worker = workersList.find(w => w.id === workerId);
    setTeachers(prev => {
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
          id: `teacher_${Date.now()}_${index}`,
          name: '',
          phone: ''
        };
      }
      return updated;
    });
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);

    if (!className.trim()) {
      setSetupError('Please enter a Class Name.');
      return;
    }
    if (!secretaryName.trim()) {
      setSetupError('Please select a registered worker as Class Secretary.');
      return;
    }
    const validTeachers = teachers.filter(t => t.name.trim() !== '');
    if (validTeachers.length === 0) {
      setSetupError('Please select at least one registered worker as Class Teacher.');
      return;
    }

    const newProfile: ClassProfile = {
      id: existingClassProfile?.id || `class_${Date.now()}`,
      className: className.trim(),
      department: department as DepartmentType,
      secretaryName: secretaryName.trim(),
      secretaryPhone: secretaryPhone.trim(),
      teachers: validTeachers,
      quarterTitle: quarterTitle.trim(),
      year: new Date().getFullYear(),
      currencySymbol,
      isSetupComplete: true,
      approvalStatus: existingClassProfile?.approvalStatus || 'PENDING_APPROVAL',
      createdAt: existingClassProfile?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onCompleteSetup(newProfile);
  };

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);

    const success = onUnlock('');
    if (!success) {
      setUnlockError('Unlock failed.');
    }
  };

  const handleFastDemoUnlock = () => {
    onUnlock('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-8">
        
        {/* Brand Banner */}
        <div className="bg-blue-950 p-6 border-b border-blue-900 text-center relative">
          <div className="flex items-center justify-center mx-auto mb-3">
            <GofamintLogo className="w-16 h-16 drop-shadow-md" />
          </div>
          <span className="text-[10px] font-black tracking-widest uppercase text-amber-300 bg-amber-400/15 px-3 py-1 rounded-full border border-amber-400/30 font-['Cinzel',serif]">
            THE GOSPEL FAITH MISSION INTERNATIONAL(HOUSE OF FAVOUR)
          </span>
          <h2 className="text-xl font-extrabold text-white mt-2 font-['Cinzel',serif] tracking-wide">
            GOFAMINT_HOF SUNDAY SCHOOL SECRETARY CONSOLE
          </h2>
          <p className="text-xs text-blue-200/80 mt-1 max-w-md mx-auto">
            {isFirstRun
              ? 'Sunday School Class Registration: Select designated workers from the Workers Directory and submit class registration.'
              : 'Secure Secretary Console: Enter your password to unlock live grading and roster management.'}
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {isFirstRun ? (
            /* First Launch: Class Setup Form */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {setupError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{setupError}</span>
                </div>
              )}

              {workersList.length === 0 && !isLoadingMetadata && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">No Registered Workers in Directory:</strong>
                    <p className="mt-0.5 text-amber-800">
                      Teachers and Secretaries must be selected from the Workers Module. Please register workers first in the Workers Directorate to assign them here.
                    </p>
                  </div>
                </div>
              )}

              {/* Class Name & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Class Name <span className="text-amber-600">*</span>
                  </label>
                  <input
                    id="setup-class-name"
                    type="text"
                    required
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="e.g. Grace & Truth Adult Bible Class"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Department (Admin Managed) <span className="text-amber-600">*</span>
                  </label>
                  <select
                    id="setup-department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 font-medium"
                  >
                    {departmentsList.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Secretary Selection from Workers Directory */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Select Class Secretary (From Workers Directory) <span className="text-amber-600">*</span>
                </label>
                <select
                  id="setup-secretary-select"
                  value={selectedSecretaryWorkerId}
                  onChange={(e) => handleSecretarySelect(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 font-medium"
                >
                  <option value="">-- Choose Secretary from Workers Directory --</option>
                  {workersList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.fullName} ({w.workerId} - {w.department})
                    </option>
                  ))}
                </select>
                {secretaryName && (
                  <p className="text-xs text-blue-900 font-semibold mt-1">
                    Selected Secretary: <strong>{secretaryName}</strong> {secretaryPhone ? `(${secretaryPhone})` : ''}
                  </p>
                )}
              </div>

              {/* Dynamic Class Teachers List from Workers Directory */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-blue-900" />
                    <span>Select Class Teacher(s) from Workers Directory</span>
                  </label>
                  <button
                    type="button"
                    id="setup-btn-add-teacher"
                    onClick={handleAddTeacher}
                    className="text-xs font-bold text-blue-900 hover:text-blue-800 flex items-center gap-1 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-lg border border-blue-300 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Additional Teacher</span>
                  </button>
                </div>

                {teachers.map((teacher, index) => (
                  <div key={teacher.id || index} className="flex items-center gap-2">
                    <select
                      value={teacher.name ? workersList.find(w => w.fullName === teacher.name)?.id || '' : ''}
                      onChange={(e) => handleTeacherWorkerSelect(index, e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900"
                    >
                      <option value="">-- Select Teacher {index + 1} from Workers --</option>
                      {workersList.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.fullName} ({w.workerId} - {w.department})
                        </option>
                      ))}
                    </select>
                    {teachers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTeacher(index)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Submit & Cancel Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition order-2 sm:order-1"
                  >
                    Back to Opening Screen
                  </button>
                )}
                <button
                  id="setup-btn-submit"
                  type="submit"
                  className="flex-1 w-full py-3.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg text-sm shadow-xs flex items-center justify-center gap-2 transition order-1 sm:order-2"
                >
                  <CheckCircle2 className="w-5 h-5 text-amber-300" />
                  <span>Submit Class Registration</span>
                </button>
              </div>
            </form>
          ) : (
            /* Subsequent Unlock Modal */
            <form onSubmit={handleUnlockSubmit} className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Class Name</span>
                  <h4 className="text-base font-bold text-slate-900">
                    {existingClassProfile?.className || 'Sunday School Class'}
                  </h4>
                  <p className="text-xs text-blue-900 font-semibold mt-0.5">
                    {existingClassProfile?.department} • Secretary: {existingClassProfile?.secretaryName}
                  </p>
                  {existingClassProfile?.approvalStatus === 'PENDING_APPROVAL' && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                      <Clock className="w-3 h-3" /> Awaiting Admin Approval
                    </span>
                  )}
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-blue-900" />
                </div>
              </div>

              {unlockError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold">
                  {unlockError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  id="unlock-btn-submit"
                  type="submit"
                  className="flex-1 py-3 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg text-sm shadow-xs flex items-center justify-center gap-2 transition"
                >
                  <Lock className="w-4 h-4 text-amber-300" />
                  <span>Unlock Console</span>
                </button>
              </div>

              {onCancel && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline"
                  >
                    Back to Opening Screen
                  </button>
                </div>
              )}
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
