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
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }> = [
    {
      id: 'GRADING_MATRIX',
      label: 'Class Register',
      shortLabel: 'Register',
      icon: Table2
    },
    {
      id: 'ROSTER_MANAGEMENT',
      label: 'Student Registration',
      shortLabel: 'Students',
      icon: Users,
      badge: visitorConversionCount > 0 ? visitorConversionCount : undefined,
      badgeColor: 'bg-purple-600 text-white'
    },
    {
      id: 'WELFARE_FOLLOW_UP',
      label: 'Welfare / Follow-Up',
      shortLabel: 'Welfare',
      icon: HeartHandshake,
      badge: urgentAbsenceCount > 0 ? urgentAbsenceCount : undefined,
      badgeColor: 'bg-amber-600 text-white font-black'
    },
    {
      id: 'QUARTER_ANALYSIS',
      label: 'Quarter Analysis',
      shortLabel: 'Analysis',
      icon: BarChart3
    },
    {
      id: 'CLASS_DISCUSSION',
      label: 'Class Discussion',
      shortLabel: 'Discuss',
      icon: MessageSquare,
      badge: unreadCommentsCount > 0 ? unreadCommentsCount : undefined,
      badgeColor: 'bg-blue-600 text-white'
    },
    {
      id: 'REPORT_CARD',
      label: 'Sunday School Report Card',
      shortLabel: 'Report',
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
    <nav aria-label="Class register sections" className="fixed inset-x-0 bottom-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] overflow-x-auto scrollbar-none shadow-[0_-8px_24px_rgba(15,23,42,0.14)] scroll-smooth touch-pan-x sm:sticky sm:top-0 sm:bottom-auto sm:z-40 sm:border-t-0 sm:border-b sm:px-3 sm:py-2 sm:shadow-md">
      <div className="max-w-7xl mx-auto flex items-stretch justify-start lg:justify-center gap-1.5 min-w-max">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || 
            (item.id === 'WELFARE_FOLLOW_UP' && activeTab === 'ABSENCE_CARE') ||
            (item.id === 'QUARTER_ANALYSIS' && activeTab === 'WEEK_12_ANALYTICS');
          const isReportCard = item.id === 'REPORT_CARD';

          return (
            <React.Fragment key={item.id}>
              {isReportCard && <div className="hidden sm:block h-7 w-px bg-slate-200 mx-1 shrink-0 self-center" />}
              <button
                ref={isActive ? activeTabRef : null}
                id={`nav-tab-${(item.id || '').toLowerCase()}`}
                onClick={() => onTabChange(item.id)}
                className={`min-w-[72px] sm:min-w-0 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-2 min-h-[52px] sm:min-h-[44px] rounded-xl text-[10px] sm:text-sm font-bold transition-all duration-150 relative whitespace-nowrap touch-manipulation cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-blue-950 text-white shadow-md border border-blue-800'
                    : isReportCard
                    ? 'text-indigo-900 bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : isReportCard ? 'text-indigo-700' : 'text-slate-500'}`} />
                <span className="tracking-tight sm:hidden">{item.shortLabel}</span>
                <span className="tracking-tight hidden sm:inline">{item.label}</span>

                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`absolute top-1 right-1 sm:static px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black rounded-md sm:ml-0.5 ${item.badgeColor || 'bg-blue-600 text-white'}`}>
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
