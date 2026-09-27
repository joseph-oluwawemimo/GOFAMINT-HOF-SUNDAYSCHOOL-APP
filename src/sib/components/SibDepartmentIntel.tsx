/**
 * GOFAMINT SIB Department Intelligence Tab
 * Redesigned using Jobby UI visual language (clean, bright, spacious, modern).
 */

import React from 'react';
import {
  Building2,
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
        <span className="text-[10px] font-black uppercase tracking-widest text-[#320b86]">
          Departmental Synthesis
        </span>
        <h2 className="text-xl font-black text-slate-900 font-['Cinzel',serif]">
          Department Performance & Comparative Analytics
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Evaluating cross-class performance across {departments.length} Sunday School departments.
        </p>
      </div>

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {departments.map((dept, idx) => {
          const healthColor = dept.averageHealthScore >= 75
            ? 'text-emerald-700'
            : dept.averageHealthScore >= 60
            ? 'text-amber-700'
            : 'text-rose-700';

          return (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-white border border-slate-200/90 hover:border-[#320b86]/40 shadow-xs hover:shadow-md flex flex-col justify-between space-y-4 transition"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#320b86]" />
                    <h3 className="text-base font-black text-slate-900">{dept.departmentName}</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-[#320b86] border border-purple-200">
                    {dept.classCount} classes
                  </span>
                </div>

                {/* Score Tiles */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Avg Attendance</span>
                    <span className="text-lg font-black text-slate-900 font-mono">{dept.averageAttendanceRate}%</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Health Index</span>
                    <span className={`text-lg font-black font-mono ${healthColor}`}>{dept.averageHealthScore}%</span>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Students / Visitors:</span>
                    <span className="font-bold text-slate-900">{dept.totalStudents} / {dept.totalVisitors}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Leading Class:</span>
                    <span className="font-bold text-emerald-700">{dept.strongestClass}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Attention Priority:</span>
                    <span className="font-bold text-amber-700">{dept.attentionStudentCount} student(s)</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Follow-Up Rate:</span>
                    <span className="font-bold text-[#320b86]">{dept.followUpRate}%</span>
                  </div>
                </div>

                {/* Positives & Concerns */}
                {dept.concerns.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200/80 text-[11px] text-rose-800">
                    {dept.concerns[0]}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>{dept.confidence} Confidence</span>
                <span className="text-[#320b86] font-bold">{dept.trend.direction}</span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
