import React, { useState, useEffect } from 'react';
import { ClockInConfig } from '../../types';
import { Settings, Clock, Save, X, Calendar, ShieldCheck } from 'lucide-react';

interface ClockInScheduleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ClockInConfig;
  onSaveConfig: (newConfig: ClockInConfig) => Promise<void>;
  defaultSection?: 'SUNDAY' | 'THURSDAY' | 'ALL';
}

export const ClockInScheduleSettingsModal: React.FC<ClockInScheduleSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  defaultSection = 'ALL'
}) => {
  const [serviceName, setServiceName] = useState(config.serviceName || 'Sunday Morning Service');
  const [editSundayOpen, setEditSundayOpen] = useState(config.sundayOpenTime || '07:00');
  const [editSundayClose, setEditSundayClose] = useState(config.sundayCloseTime || '11:30');
  const [editSundayPrayerStart, setEditSundayPrayerStart] = useState(config.sundayPrayerStartTime || '07:45');
  const [editSundayLateCutoff, setEditSundayLateCutoff] = useState(config.sundayLateCutoffTime || '08:00');
  const [editThursdayOpen, setEditThursdayOpen] = useState(config.thursdayOpenTime || '16:00');
  const [editThursdayClose, setEditThursdayClose] = useState(config.thursdayCloseTime || '19:00');
  const [editThursdayMeetingStart, setEditThursdayMeetingStart] = useState(config.thursdayMeetingStartTime || '17:00');
  const [editThursdayLateCutoff, setEditThursdayLateCutoff] = useState(config.thursdayLateCutoffTime || '18:15');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setServiceName(config.serviceName || 'Sunday Morning Service');
      setEditSundayOpen(config.sundayOpenTime || '07:00');
      setEditSundayClose(config.sundayCloseTime || '11:30');
      setEditSundayPrayerStart(config.sundayPrayerStartTime || '07:45');
      setEditSundayLateCutoff(config.sundayLateCutoffTime || '08:00');
      setEditThursdayOpen(config.thursdayOpenTime || '16:00');
      setEditThursdayClose(config.thursdayCloseTime || '19:00');
      setEditThursdayMeetingStart(config.thursdayMeetingStartTime || '17:00');
      setEditThursdayLateCutoff(config.thursdayLateCutoffTime || '18:15');
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated: ClockInConfig = {
        ...config,
        serviceName,
        sundayOpenTime: editSundayOpen,
        sundayCloseTime: editSundayClose,
        sundayPrayerStartTime: editSundayPrayerStart,
        sundayLateCutoffTime: editSundayLateCutoff,
        thursdayOpenTime: editThursdayOpen,
        thursdayCloseTime: editThursdayClose,
        thursdayMeetingStartTime: editThursdayMeetingStart,
        thursdayLateCutoffTime: editThursdayLateCutoff,
        updatedAt: new Date().toISOString()
      };
      await onSaveConfig(updated);
      onClose();
    } catch (err) {
      console.error('Error saving schedule config:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                Adjust Attendance Schedule
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Set real-time clock-in operating windows and late arrival cutoffs.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 font-bold p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          
          {/* SUNDAY SERVICE SETTINGS */}
          {(defaultSection === 'ALL' || defaultSection === 'SUNDAY') && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-emerald-700 text-white rounded-md text-[10px] font-black uppercase tracking-wider">
                    Sunday Service
                  </span>
                  <span className="font-bold text-slate-800 text-xs">Real-Time Clock-In Window</span>
                </div>
                <Clock className="w-4 h-4 text-emerald-700" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Window Opens (24h)</label>
                  <input
                    type="time"
                    value={editSundayOpen}
                    onChange={e => setEditSundayOpen(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500">Default: 07:00 AM</span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Window Closes (24h)</label>
                  <input
                    type="time"
                    value={editSundayClose}
                    onChange={e => setEditSundayClose(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500">Default: 11:30 AM</span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Prayer Starts</label>
                  <input
                    type="time"
                    value={editSundayPrayerStart}
                    onChange={e => setEditSundayPrayerStart(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500">Default: 07:45 AM</span>
                </div>

                <div>
                  <label className="font-bold text-amber-900 block mb-1">Late Cutoff (Strict)</label>
                  <input
                    type="time"
                    value={editSundayLateCutoff}
                    onChange={e => setEditSundayLateCutoff(e.target.value)}
                    className="w-full p-2 border border-amber-300 bg-amber-50 rounded-xl font-mono text-xs font-bold text-amber-950 focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-amber-700">Late after 08:00 AM</span>
                </div>
              </div>
            </div>
          )}

          {/* THURSDAY PREPARATORY SETTINGS */}
          {(defaultSection === 'ALL' || defaultSection === 'THURSDAY') && (
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-800 text-white rounded-md text-[10px] font-black uppercase tracking-wider">
                    Thursday Prep
                  </span>
                  <span className="font-bold text-slate-800 text-xs">Preparatory Class Window</span>
                </div>
                <Clock className="w-4 h-4 text-blue-800" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Window Opens (24h)</label>
                  <input
                    type="time"
                    value={editThursdayOpen}
                    onChange={e => setEditThursdayOpen(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-500">Default: 16:00 (4:00 PM)</span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Window Closes (24h)</label>
                  <input
                    type="time"
                    value={editThursdayClose}
                    onChange={e => setEditThursdayClose(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-500">Default: 19:00 (7:00 PM)</span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Prep Meeting Starts</label>
                  <input
                    type="time"
                    value={editThursdayMeetingStart}
                    onChange={e => setEditThursdayMeetingStart(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-500">Default: 17:00 (5:00 PM)</span>
                </div>

                <div>
                  <label className="font-bold text-amber-900 block mb-1">Late Cutoff (Strict)</label>
                  <input
                    type="time"
                    value={editThursdayLateCutoff}
                    onChange={e => setEditThursdayLateCutoff(e.target.value)}
                    className="w-full p-2 border border-amber-300 bg-amber-50 rounded-xl font-mono text-xs font-bold text-amber-950 focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-amber-700">Late after 18:15 (6:15 PM)</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-amber-300" />
              <span>{isSaving ? 'Saving...' : 'Save Schedule Settings'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
