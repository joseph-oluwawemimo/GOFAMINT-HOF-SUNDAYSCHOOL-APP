import React, { useEffect, useRef } from 'react';
import {
  Table2,
  Users,
  HeartHandshake,
  BarChart3,
  MessageSquare,
  Database,
  GraduationCap
} from 'lucide-react';
import { ActiveTab } from '../types';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  urgentAbsenceCount: number;
  visitorConversionCount: number;
  unreadCommentsCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  urgentAbsenceCount,
  visitorConversionCount,
  unreadCommentsCount = 0
}) => {
  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }> = [
    {
      id: 'GRADING_MATRIX',
      label: 'Grading Matrix',
      icon: Table2
    },
    {
      id: 'ROSTER_MANAGEMENT',
      label: 'Student Registration',
      icon: Users,
      badge: visitorConversionCount > 0 ? visitorConversionCount : undefined,
      badgeColor: 'bg-purple-600 text-white'
    },
    {
      id: 'WELFARE_FOLLOW_UP',
      label: 'Welfare / Follow-Up',
      icon: HeartHandshake,
      badge: urgentAbsenceCount > 0 ? urgentAbsenceCount : undefined,
      badgeColor: 'bg-amber-600 text-white font-black'
    },
    {
      id: 'QUARTER_ANALYSIS',
      label: 'Quarter Analysis',
      icon: BarChart3
    },
    {
      id: 'CLASS_DISCUSSION',
      label: 'Class Discussion',
      icon: MessageSquare,
      badge: unreadCommentsCount > 0 ? unreadCommentsCount : undefined,
      badgeColor: 'bg-blue-600 text-white'
    },
    {
      id: 'REPORT_CARD',
      label: 'Sunday School Report Card',
      icon: GraduationCap
    }
  ];

  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [activeTab]);

  return (
    <nav className="bg-white border-b border-slate-200 px-3 py-1.5 sticky top-[69px] z-30 overflow-x-auto scrollbar-none shadow-xs scroll-smooth touch-pan-x">
      <div className="max-w-7xl mx-auto flex items-center justify-start sm:justify-center gap-1.5 min-w-max">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || 
            (item.id === 'WELFARE_FOLLOW_UP' && activeTab === 'ABSENCE_CARE') ||
            (item.id === 'QUARTER_ANALYSIS' && activeTab === 'WEEK_12_ANALYTICS');
          const isReportCard = item.id === 'REPORT_CARD';

          return (
            <React.Fragment key={item.id}>
              {isReportCard && <div className="h-6 w-px bg-slate-200 mx-1.5 shrink-0" />}
              <button
                ref={isActive ? activeTabRef : null}
                id={`nav-tab-${(item.id || '').toLowerCase()}`}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-lg text-xs sm:text-sm font-bold transition-all duration-150 relative whitespace-nowrap touch-manipulation cursor-pointer ${
                  isActive
                    ? 'bg-blue-900 text-white shadow-xs border border-blue-800'
                    : isReportCard
                    ? 'text-indigo-900 bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : isReportCard ? 'text-indigo-700' : 'text-slate-500'}`} />
                <span className="tracking-tight">{item.label}</span>

                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-black rounded-md ml-0.5 ${item.badgeColor || 'bg-blue-600 text-white'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};
