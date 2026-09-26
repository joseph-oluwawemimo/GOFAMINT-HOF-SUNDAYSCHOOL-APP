import React, { useEffect, useRef } from 'react';
import {
  Table2,
  Users,
  HeartHandshake,
  BarChart3,
  MessageSquare,
  GraduationCap,
  Shield,
  Sparkles,
  ArrowLeft,
  Lock,
  UserCheck
} from 'lucide-react';
import { ActiveTab, ClassProfile } from '../types';
import { GofamintLogo } from './GofamintLogo';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  urgentAbsenceCount: number;
  visitorConversionCount: number;
  unreadCommentsCount?: number;
  classProfile?: ClassProfile | null;
  onOpenAdminPortal?: () => void;
  onOpenWorkersModule?: () => void;
  onOpenWelcome?: () => void;
  onLockClick?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  urgentAbsenceCount,
  visitorConversionCount,
  unreadCommentsCount = 0,
  classProfile,
  onOpenAdminPortal,
  onOpenWorkersModule,
  onOpenWelcome,
  onLockClick
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
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP SIDEBAR (JOBIE BRAND VIOLET WITH CARVED-OUT ACTIVE TAB NOTCH)     */}
      {/* ========================================================================= */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 jobie-sidebar shrink-0 sticky top-0 h-screen z-30 shadow-2xl overflow-hidden">
        {/* Brand Header */}
        <div className="p-5 flex items-center gap-3 border-b border-white/10 shrink-0">
          <GofamintLogo size={40} />
          <div className="min-w-0">
            <span className="text-[10px] font-black tracking-widest text-amber-300 uppercase font-['Cinzel',serif] block truncate">
              GOFAMINT HOF
            </span>
            <h2 className="text-sm font-black text-white font-['Cinzel',serif] tracking-wide truncate">
              Class Register
            </h2>
            {classProfile && (
              <span className="inline-block text-[9px] font-bold text-purple-200 bg-white/15 px-2 py-0.5 rounded-full mt-1 truncate max-w-full">
                {classProfile.className} • {classProfile.department}
              </span>
            )}
          </div>
        </div>

        {/* Secretary & Teacher Info Chip */}
        {classProfile?.secretaryName && (
          <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-bold text-purple-300/80 block">Class Secretary</span>
              <p className="text-xs font-bold text-white truncate">{classProfile.secretaryName}</p>
            </div>
          </div>
        )}

        {/* Navigation Tabs with Carved Active Notch */}
        <div className="flex-1 py-5 space-y-1 overflow-y-auto no-scrollbar">
          <div className="px-6 pb-2 text-[10px] font-black uppercase tracking-wider text-purple-300/70">
            Register Operations
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id ||
              (item.id === 'WELFARE_FOLLOW_UP' && activeTab === 'ABSENCE_CARE') ||
              (item.id === 'QUARTER_ANALYSIS' && activeTab === 'WEEK_12_ANALYTICS');

            return (
              <button
                key={item.id}
                type="button"
                id={`sidebar-tab-${item.id.toLowerCase()}`}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 pl-6 pr-4 py-3.5 text-xs font-black transition-all cursor-pointer text-left ${
                  isActive
                    ? 'jobie-notch-item active'
                    : 'text-purple-200/80 hover:text-white hover:bg-white/10 rounded-2xl mx-3 my-0.5 px-4 py-3'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#320b86]' : 'text-purple-300'}`} />
                <span className="truncate">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`ml-auto px-2 py-0.5 text-[10px] font-black rounded-full shrink-0 ${
                      isActive ? 'bg-[#320b86] text-white' : item.badgeColor || 'bg-amber-400 text-slate-900'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Actions Footer */}
        <div className="p-4 border-t border-white/10 bg-black/20 space-y-2 shrink-0">
          <div className="text-[10px] font-bold text-purple-300/70 uppercase tracking-wider px-2">
            Switch Console
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {onOpenAdminPortal && (
              <button
                type="button"
                onClick={onOpenAdminPortal}
                className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-purple-100 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Shield className="w-3.5 h-3.5 text-amber-300" />
                <span>Admin</span>
              </button>
            )}
            {onOpenWorkersModule && (
              <button
                type="button"
                onClick={onOpenWorkersModule}
                className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-purple-100 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                <span>Workers</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            {onOpenWelcome && (
              <button
                type="button"
                onClick={onOpenWelcome}
                className="flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold text-purple-200/80 hover:text-white hover:bg-white/10 flex items-center justify-center gap-1 transition"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Opening Screen</span>
              </button>
            )}
            {onLockClick && (
              <button
                type="button"
                onClick={onLockClick}
                className="py-1.5 px-2 rounded-lg text-[10px] font-bold text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 flex items-center justify-center gap-1 transition"
                title="Lock Session"
              >
                <Lock className="w-3 h-3" />
                <span>Lock</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE BOTTOM NAVIGATION (PRESERVED FOR PHONES & SMALL SCREENS)       */}
      {/* ========================================================================= */}
      <nav aria-label="Class register sections" className="fixed inset-x-0 bottom-0 z-50 lg:hidden bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] overflow-x-auto scrollbar-none shadow-[0_-8px_24px_rgba(15,23,42,0.14)] scroll-smooth touch-pan-x sm:sticky sm:top-0 sm:bottom-auto">
        <div className="max-w-7xl mx-auto flex items-stretch justify-start gap-1.5 min-w-max">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id ||
              (item.id === 'WELFARE_FOLLOW_UP' && activeTab === 'ABSENCE_CARE') ||
              (item.id === 'QUARTER_ANALYSIS' && activeTab === 'WEEK_12_ANALYTICS');
            const isReportCard = item.id === 'REPORT_CARD';

            return (
              <React.Fragment key={item.id}>
                {isReportCard && <div className="h-7 w-px bg-slate-200 mx-1 shrink-0 self-center" />}
                <button
                  ref={isActive ? activeTabRef : null}
                  id={`nav-tab-${(item.id || '').toLowerCase()}`}
                  onClick={() => onTabChange(item.id)}
                  className={`min-w-[72px] flex flex-col items-center justify-center gap-1 px-2.5 py-2 min-h-[52px] rounded-xl text-[10px] font-bold transition-all duration-150 relative whitespace-nowrap touch-manipulation cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                    isActive
                      ? 'bg-blue-950 text-white shadow-md border border-blue-800'
                      : isReportCard
                      ? 'text-indigo-900 bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : isReportCard ? 'text-indigo-700' : 'text-slate-500'}`} />
                  <span className="tracking-tight">{item.shortLabel}</span>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`absolute top-1 right-1 px-1.5 py-0.5 text-[9px] font-black rounded-md ${
                        item.badgeColor || 'bg-blue-600 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </nav>
    </>
  );
};
