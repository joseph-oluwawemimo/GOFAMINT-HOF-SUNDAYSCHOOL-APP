/**
 * GOFAMINT SIB Department Intelligence Tab
 */

import React from 'react';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Users,
  ShieldCheck
} from 'lucide-react';
import { DepartmentIntelResult } from '../types/sibTypes';

interface SibDepartmentIntelProps {
  departments: DepartmentIntelResult[];
}

export const SibDepartmentIntel: React.FC<SibDepartmentIntelProps> = ({
  departments,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header */}
      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
          Departmental Synthesis
        </span>
        <h2 className="text-xl font-black text-white font-['Cinzel',serif]">
          Department Performance & Comparative Analytics
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Evaluating cross-class performance across {departments.length} Sunday School departments.
        </p>
      </div>

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {departments.map((dept, idx) => {
          const healthColor = dept.averageHealthScore >= 75
            ? 'text-emerald-400'
            : dept.averageHealthScore >= 60
            ? 'text-amber-300'
            : 'text-rose-400';

          return (
            <div
              key={idx}
              className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 shadow-xl flex flex-col justify-between space-y-4 transition"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-base font-black text-white">{dept.departmentName}</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                    {dept.classCount} classes
                  </span>
                </div>

                {/* Score Tiles */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Avg Attendance</span>
                    <span className="text-lg font-black text-white font-mono">{dept.averageAttendanceRate}%</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Health Index</span>
                    <span className={`text-lg font-black font-mono ${healthColor}`}>{dept.averageHealthScore}%</span>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Students / Visitors:</span>
                    <span className="font-bold text-white">{dept.totalStudents} / {dept.totalVisitors}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Leading Class:</span>
                    <span className="font-bold text-emerald-400">{dept.strongestClass}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Attention Priority:</span>
                    <span className="font-bold text-amber-300">{dept.attentionStudentCount} student(s)</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Follow-Up Rate:</span>
                    <span className="font-bold text-indigo-300">{dept.followUpRate}%</span>
                  </div>
                </div>

                {/* Positives & Concerns */}
                {dept.concerns.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/20 text-[11px] text-rose-300">
                    {dept.concerns[0]}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>{dept.confidence} Confidence</span>
                <span className="text-indigo-400 font-bold">{dept.trend.direction}</span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
