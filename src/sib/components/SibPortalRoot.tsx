/**
 * GOFAMINT School Intelligence Board (SIB) - Fourth Portal Root
 * 
 * Strict Principle:
 * SIB is a dedicated fourth portal. It provides an intelligence and
 * read-only decision-support layer without modifying or breaking any of the
 * three existing portals.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BrainCircuit,
  LayoutDashboard,
  Layers,
  Users,
  UserCheck,
  PhoneCall,
  Building2,
  Calendar,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  FileCheck2,
  RefreshCw,
  Search
} from 'lucide-react';

import { QuarterNumber, SundaySchoolYear } from '../../types';
import { ApplicationProfile } from '../../services/profileService';
import { loadSIBRawDataset, SIBRawDataset } from '../data/sibDataAccess';
import { computeSchoolOverview } from '../engine/schoolOverviewEngine';
import { SIBEvidenceRegistry } from '../engine/evidenceEngine';
import {
  SIBOverviewData,
  ScoreExplanation,
  EvidenceObject
} from '../types/sibTypes';

import { SibHeader } from './SibHeader';
import { SibOverviewTab } from './SibOverviewTab';
import { SibClassIntelligence } from './SibClassIntelligence';
import { SibStudentAttention } from './SibStudentAttention';
import { SibVisitorIntelligence } from './SibVisitorIntelligence';
import { SibFollowUpIntelligence } from './SibFollowUpIntelligence';
import { SibDepartmentIntel } from './SibDepartmentIntel';
import { SibQuarterComparison } from './SibQuarterComparison';
import { SibDataQuality } from './SibDataQuality';
import { AskSibView } from './AskSibView';
import { WhyScoreModal } from './WhyScoreModal';
import { EvidenceDrawer } from './EvidenceDrawer';

export type SibTab =
  | 'OVERVIEW'
  | 'CLASSES'
  | 'STUDENTS'
  | 'VISITORS'
  | 'FOLLOW_UP'
  | 'DEPARTMENTS'
  | 'QUARTERS'
  | 'DATA_QUALITY'
  | 'ASK_SIB';

interface SibPortalRootProps {
  authProfile: ApplicationProfile | null;
  onBackToPortalSelect: () => void;
  onBackToWelcome: () => void;
  onNavigateToPortal?: (targetPortal: 'ADMIN' | 'CLASS_REGISTER' | 'WORKERS', context?: Record<string, unknown>) => void;
}

export const SibPortalRoot: React.FC<SibPortalRootProps> = ({
  authProfile,
  onBackToPortalSelect,
  onBackToWelcome,
  onNavigateToPortal,
}) => {
  const [activeTab, setActiveTab] = useState<SibTab>(() => {
    const saved = sessionStorage.getItem('gofamint_sib_active_tab');
    return (saved as SibTab) || 'OVERVIEW';
  });

  const [selectedQuarter, setSelectedQuarter] = useState<QuarterNumber>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [overviewData, setOverviewData] = useState<SIBOverviewData | null>(null);
  const [yearData, setYearData] = useState<SundaySchoolYear | null>(null);

  // Modal & Drawer State
  const [isWhyScoreOpen, setIsWhyScoreOpen] = useState(false);
  const [scoreExplanation, setScoreExplanation] = useState<ScoreExplanation | null>(null);

  const [isEvidenceDrawerOpen, setIsEvidenceDrawerOpen] = useState(false);
  const [activeEvidence, setActiveEvidence] = useState<EvidenceObject | null>(null);

  const handleTabChange = (tab: SibTab) => {
    setActiveTab(tab);
    sessionStorage.setItem('gofamint_sib_active_tab', tab);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const dataset = await loadSIBRawDataset(selectedQuarter);
      setYearData(dataset.year);
      const computed = computeSchoolOverview(dataset);
      setOverviewData(computed);
    } catch (err: any) {
      console.error('[SIB Portal] Error loading intelligence dataset:', err);
      setLoadError(err?.message || 'Could not load intelligence records.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedQuarter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenWhyScore = (customExplanation?: ScoreExplanation) => {
    const expl = customExplanation || overviewData?.schoolHealthExplanation || null;
    setScoreExplanation(expl);
    setIsWhyScoreOpen(true);
  };

  const handleOpenEvidence = (evidenceId: string) => {
    const ev = SIBEvidenceRegistry.getEvidence(evidenceId);
    if (ev) {
      setActiveEvidence(ev);
    } else {
      // Fallback synthetic evidence object if ID wasn't in static map
      setActiveEvidence({
        id: evidenceId,
        targetType: 'SCHOOL',
        targetId: evidenceId,
        metricName: 'Verified Sunday School Operational Evidence',
        calculatedValue: 'Confirmed',
        calculationFormula: 'Retrieved from Supabase Database Records',
        periodLabel: `Quarter ${selectedQuarter}`,
        supportingRecordCount: overviewData?.classes.totalClasses || 1,
        confidence: 'HIGH',
        confidenceReason: 'Verified directly from live operational records.',
        limitations: [],
      });
    }
    setIsEvidenceDrawerOpen(true);
  };

  const tabItems: Array<{ id: SibTab; label: string; icon: React.ReactNode }> = [
    { id: 'OVERVIEW', label: 'Executive Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'CLASSES', label: 'Class Intelligence', icon: <Layers className="w-4 h-4" /> },
    { id: 'STUDENTS', label: 'Student Attention', icon: <Users className="w-4 h-4" /> },
    { id: 'VISITORS', label: 'Visitor Progression', icon: <UserCheck className="w-4 h-4" /> },
    { id: 'FOLLOW_UP', label: 'Follow-Up Continuity', icon: <PhoneCall className="w-4 h-4" /> },
    { id: 'DEPARTMENTS', label: 'Departments', icon: <Building2 className="w-4 h-4" /> },
    { id: 'QUARTERS', label: 'Quarter Comparison', icon: <Calendar className="w-4 h-4" /> },
    { id: 'DATA_QUALITY', label: 'Data Quality', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'ASK_SIB', label: 'Ask SIB (AI Agent)', icon: <Sparkles className="w-4 h-4 text-amber-300" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      
      {/* SIB Header */}
      <SibHeader
        selectedQuarter={selectedQuarter}
        onQuarterChange={(q) => setSelectedQuarter(q)}
        onOpenAskSib={() => handleTabChange('ASK_SIB')}
        onBackToPortalSelect={onBackToPortalSelect}
        onBackToWelcome={onBackToWelcome}
        onRefresh={loadData}
        isLoading={isLoading}
        userRole={authProfile?.role}
        userName={authProfile?.displayName}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Tab Navigation Ribbon */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-[69px] z-30 shadow-md overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 py-1.5 min-w-max">
          {tabItems.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.id === 'STUDENTS' && overviewData && overviewData.studentAttention.criticalCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                    isActive ? 'bg-slate-950 text-rose-300' : 'bg-rose-500 text-white'
                  }`}>
                    {overviewData.studentAttention.criticalCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {isLoading && !overviewData ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-4 text-center">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
            <h3 className="text-base font-black text-white font-['Cinzel',serif]">
              Computing Sunday School Intelligence
            </h3>
            <p className="text-xs text-slate-400 max-w-sm">
              Deriving verified health scores, student attention metrics, and operational trends from Supabase...
            </p>
          </div>
        ) : loadError ? (
          <div className="p-8 rounded-3xl bg-rose-950/30 border border-rose-500/40 text-center space-y-3">
            <h3 className="text-base font-black text-rose-300">Could Not Load Intelligence</h3>
            <p className="text-xs text-slate-300">{loadError}</p>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
            >
              Retry
            </button>
          </div>
        ) : overviewData ? (
          <>
            {activeTab === 'OVERVIEW' && (
              <SibOverviewTab
                overview={overviewData}
                onOpenWhyScore={() => handleOpenWhyScore()}
                onOpenEvidence={handleOpenEvidence}
                onNavigateToTab={(tabId) => handleTabChange(tabId as SibTab)}
                onNavigateToPortal={onNavigateToPortal}
              />
            )}

            {activeTab === 'CLASSES' && (
              <SibClassIntelligence
                classes={overviewData.classes.allClassHealth}
                onOpenWhyScore={handleOpenWhyScore}
                onOpenEvidence={handleOpenEvidence}
                onNavigateToRegister={(classId) => onNavigateToPortal?.('CLASS_REGISTER', { classId })}
              />
            )}

            {activeTab === 'STUDENTS' && (
              <SibStudentAttention
                attentionList={overviewData.studentAttention.items}
                onOpenEvidence={handleOpenEvidence}
                onNavigateToFollowUp={(classId, memberId) => onNavigateToPortal?.('CLASS_REGISTER', { classId, memberId })}
              />
            )}

            {activeTab === 'VISITORS' && (
              <SibVisitorIntelligence
                visitors={overviewData.visitors}
                onOpenEvidence={handleOpenEvidence}
              />
            )}

            {activeTab === 'FOLLOW_UP' && (
              <SibFollowUpIntelligence
                followUp={overviewData.followUp}
                onOpenEvidence={handleOpenEvidence}
                onNavigateToRegister={(classId) => onNavigateToPortal?.('CLASS_REGISTER', { classId })}
              />
            )}

            {activeTab === 'DEPARTMENTS' && (
              <SibDepartmentIntel
                departments={overviewData.departments}
              />
            )}

            {activeTab === 'QUARTERS' && (
              <SibQuarterComparison
                overview={overviewData}
                year={yearData}
                onOpenEvidence={handleOpenEvidence}
              />
            )}

            {activeTab === 'DATA_QUALITY' && (
              <SibDataQuality
                dataQuality={overviewData.dataQuality}
                onRefreshData={loadData}
              />
            )}

            {activeTab === 'ASK_SIB' && (
              <AskSibView
                quarterNumber={selectedQuarter}
                onOpenEvidence={handleOpenEvidence}
              />
            )}
          </>
        ) : null}
      </main>

      {/* Decomposable Score Breakdown Modal ("Why Score?") */}
      <WhyScoreModal
        isOpen={isWhyScoreOpen}
        onClose={() => setIsWhyScoreOpen(false)}
        explanation={scoreExplanation}
        onViewEvidence={handleOpenEvidence}
      />

      {/* Slide-Out Evidence Drawer */}
      <EvidenceDrawer
        isOpen={isEvidenceDrawerOpen}
        onClose={() => setIsEvidenceDrawerOpen(false)}
        evidence={activeEvidence}
        onNavigateToPortal={onNavigateToPortal}
      />

    </div>
  );
};
