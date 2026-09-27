/**
 * GOFAMINT SIB Student Pastoral Care & Attention Tab
 * 
 * Strict Principle:
 * Identifies repeated absences and follow-up gaps.
 * Every student attention flag explains WHY without leaking sensitive private notes.
 * 
 * Redesigned using Jobby UI visual language (clean, bright, spacious, modern).
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  Search,
  HelpCircle,
  FileCheck2,
} from 'lucide-react';
import { StudentAttentionItem } from '../types/sibTypes';

interface SibStudentAttentionProps {
  attentionList: StudentAttentionItem[];
  onOpenEvidence: (evidenceId: string) => void;
  onNavigateToFollowUp?: (classId: string, memberId: string) => void;
}

export const SibStudentAttention: React.FC<SibStudentAttentionProps> = ({
  attentionList,
  onOpenEvidence,
  onNavigateToFollowUp,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MODERATE'>('ALL');

  const filtered = attentionList.filter(item => {
    const matchesSearch = item.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === 'ALL' || item.attentionLevel === levelFilter;
    return matchesSearch && matchesLevel;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#320b86]">
            Pastoral Welfare Intelligence
          </span>
          <h2 className="text-xl font-black text-slate-900 font-['Cinzel',serif]">
            Student Attention & Repeated Absence Matrix
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {attentionList.length} student(s) identified with repeated absences or follow-up gaps.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student name..."
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#320b86] shadow-xs"
            />
          </div>

          <div className="flex rounded-xl bg-slate-100 border border-slate-200 p-0.5 text-xs">
            {(['ALL', 'CRITICAL', 'HIGH', 'MODERATE'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer text-xs ${
                  levelFilter === lvl
                    ? 'bg-white text-[#320b86] shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Student Attention Cards */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <h3 className="text-base font-black text-slate-900">No Critical Attention Flags</h3>
          <p className="text-xs text-slate-500">
            All students in this filter view have regular attendance and up-to-date pastoral care records.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const levelBadge = item.attentionLevel === 'CRITICAL'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : item.attentionLevel === 'HIGH'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-indigo-50 text-indigo-700 border-indigo-200';

            return (
              <div
                key={item.studentId}
                className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-amber-400/60 shadow-xs hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 max-w-xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${levelBadge}`}>
                      {item.attentionLevel} ATTENTION
                    </span>
                    <span className="text-xs text-[#320b86] font-bold">
                      {item.className}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500">
                      {item.department}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-slate-900">
                    {item.fullName}
                  </h3>

                  {/* Why Breakdown */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-amber-700 font-bold text-[11px]">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Why this student needs attention:</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed font-medium">
                      {item.whyBreakdown.primaryReason}
                    </p>
                    {item.whyBreakdown.contributingFactors.length > 0 && (
                      <ul className="text-[11px] text-slate-500 list-disc pl-4 pt-1 space-y-0.5">
                        {item.whyBreakdown.contributingFactors.map((f, idx) => (
                          <li key={idx}>{f}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Right Side Stats & Actions */}
                <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-3 shrink-0">
                  <div className="space-y-1 text-left md:text-right">
                    <div className="flex items-center gap-1.5 md:justify-end">
                      <span className="text-xs font-bold text-slate-500">Consecutive Absences:</span>
                      <span className="text-base font-black text-rose-600 font-mono">
                        {item.consecutiveAbsences} lessons
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 md:justify-end text-[11px]">
                      <span className="text-slate-500">Follow-up status:</span>
                      {item.hasRecentFollowUp ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Logged
                        </span>
                      ) : (
                        <span className="text-rose-700 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600" /> Pending Follow-up
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onOpenEvidence(`evidence_student_attention_${item.studentId}`)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Evidence</span>
                    </button>

                    {onNavigateToFollowUp && (
                      <button
                        onClick={() => onNavigateToFollowUp(item.classId, item.studentId)}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Open Welfare Care</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
