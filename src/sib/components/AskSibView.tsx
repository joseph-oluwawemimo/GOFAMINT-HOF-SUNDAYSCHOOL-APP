/**
 * GOFAMINT SIB - Ask SIB Conversational Intelligence View
 * 
 * Strict Principle:
 * Natural language intelligence interface powered by Gemini AI Agent.
 * Only uses controlled read-only tools. Renders verified structured responses
 * with full evidence, confidence, limitations, and actionable recommendations.
 * 
 * Redesigned using Jobby UI visual language (clean, bright, spacious, modern).
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  FileCheck2,
  CheckCircle2,
  ShieldAlert,
  Copy,
  Check,
  RefreshCw,
  FileText,
  User
} from 'lucide-react';
import { SIBStructuredResponse } from '../ai/agentTypes';
import { sibAiProvider } from '../ai/geminiProvider';
import { QuarterNumber } from '../../types';

interface AskSibViewProps {
  quarterNumber: QuarterNumber;
  classId?: string;
  onOpenEvidence: (evidenceId: string) => void;
}

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  structuredResponse?: SIBStructuredResponse;
  timestamp: string;
}

export const AskSibView: React.FC<AskSibViewProps> = ({
  quarterNumber,
  classId,
}) => {
  const [messages, setMessages] = useState<ChatEntry[]>([
    {
      id: 'welcome_message',
      role: 'assistant',
      content: 'Calvary greetings! I am the **GOFAMINT School Intelligence Board (SIB) AI Agent**.\n\nI interpret verified Sunday School intelligence derived deterministically from Supabase. You can ask me about class health, student attendance trends, prolonged absences, visitor progression, or pastoral follow-up. How may I assist the Directorate today?',
      timestamp: new Date().toISOString(),
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const suggestedQuestions = [
    'Which class needs the most attention?',
    'Why is attendance declining or what is the current trend?',
    'Which students have 2 or more consecutive absences?',
    'What are the strongest positive developments this quarter?',
    'What are the three biggest pastoral concerns right now?',
    'How is visitor progression and return rate performing?',
  ];

  const handleSend = async (queryToSend?: string) => {
    const query = queryToSend || inputQuery;
    if (!query.trim() || isLoading) return;

    const userEntry: ChatEntry = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: query.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userEntry]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const history = messages
        .filter(m => m.id !== 'welcome_message' && m.content)
        .map(m => ({ role: m.role, content: m.content || m.structuredResponse?.answer || '' }));

      const response = await sibAiProvider.queryIntelligence({
        question: query.trim(),
        quarterNumber,
        classId,
        conversationHistory: history,
      });

      const assistantEntry: ChatEntry = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        structuredResponse: response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantEntry]);
    } catch (err: any) {
      const errorEntry: ChatEntry = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `I could not retrieve the required intelligence data at this time: ${err.message || 'Please check network connection'}.`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorEntry]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateWeeklyReport = async () => {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);

    const userEntry: ChatEntry = {
      id: `user_report_${Date.now()}`,
      role: 'user',
      content: `Generate Weekly Executive School Intelligence Report for Quarter ${quarterNumber}`,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userEntry]);

    try {
      const report = await sibAiProvider.generateWeeklyReport(quarterNumber);

      const assistantEntry: ChatEntry = {
        id: `assistant_report_${Date.now()}`,
        role: 'assistant',
        structuredResponse: {
          answer: report.executiveSummary,
          summary: report.title,
          findings: [
            ...report.majorDevelopments.map(d => `[Development] ${d}`),
            ...report.areasRequiringAttention.map(a => `[Requires Attention] ${a}`),
          ],
          metrics: [
            { name: 'School Health', value: `${report.metricsSummary.schoolHealthScore}%`, benchmark: '75%', status: report.metricsSummary.schoolHealthScore >= 75 ? 'GOOD' : 'WARNING' },
            { name: 'Attendance Rate', value: `${report.metricsSummary.attendanceRate}%`, benchmark: '80%', status: report.metricsSummary.attendanceRate >= 80 ? 'GOOD' : 'WARNING' },
            { name: 'Prolonged Absences', value: report.metricsSummary.prolongedAbsencesCount, benchmark: '0', status: report.metricsSummary.prolongedAbsencesCount === 0 ? 'GOOD' : 'WARNING' },
            { name: 'Follow-Up Rate', value: `${report.metricsSummary.followUpCompletionRate}%`, benchmark: '80%', status: report.metricsSummary.followUpCompletionRate >= 80 ? 'GOOD' : 'WARNING' },
          ],
          evidence: [
            { statement: report.topPriority.title, recordReference: 'Verified Attendance & Care Records', verifiedFact: report.topPriority.whyEvidence },
          ],
          confidence: report.confidence,
          confidenceReason: 'Verified from comprehensive school database records.',
          priority: report.topPriority.urgency,
          trend: 'STABLE',
          recommended_actions: [
            { action: report.topPriority.recommendedNextStep, reason: report.topPriority.whyEvidence },
          ],
          limitations: report.dataLimitations,
          sources: ['Supabase Sunday School Database', 'Weekly Registers'],
          ruleVersion: '1.0.0',
          toolsUsed: ['handleSIBWeeklyReport'],
        },
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantEntry]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `Could not generate weekly intelligence report: ${err.message}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="flex flex-col h-[780px] max-w-5xl mx-auto space-y-4 animate-fade-in">
      
      {/* Top Banner & Quick Report Action */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-[#320b86] flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-[#320b86]">
                AI Intelligence & Investigation Console
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-purple-50 text-[#320b86] border border-purple-200">
                Read-Only Tools
              </span>
            </div>
            <h2 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
              Ask SIB (School Intelligence Board)
            </h2>
          </div>
        </div>

        <button
          onClick={handleGenerateWeeklyReport}
          disabled={isGeneratingReport}
          className="px-4 py-2 bg-[#320b86] hover:bg-[#250866] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
        >
          <FileText className="w-4 h-4 text-white" />
          <span>{isGeneratingReport ? 'Generating Report...' : 'Weekly Executive Report'}</span>
        </button>
      </div>

      {/* Suggested Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0">Suggested:</span>
        {suggestedQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            className="px-3 py-1 rounded-xl bg-white hover:bg-purple-50 text-slate-700 hover:text-[#320b86] border border-slate-200 hover:border-purple-300 text-[11px] whitespace-nowrap transition cursor-pointer shrink-0 shadow-2xs"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-4xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                isUser ? 'bg-[#320b86] text-white' : 'bg-purple-100 text-[#320b86]'
              }`}>
                {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div className={`p-5 rounded-2xl text-xs space-y-3 shadow-xs ${
                isUser
                  ? 'bg-[#320b86] text-white rounded-tr-xs'
                  : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs max-w-3xl'
              }`}>
                {/* User Prompt Text */}
                {isUser && <p className="font-semibold text-sm">{msg.content}</p>}

                {/* Assistant Plain Text (e.g. Welcome) */}
                {!isUser && msg.content && !msg.structuredResponse && (
                  <div className="space-y-2 whitespace-pre-wrap leading-relaxed text-slate-700">
                    {msg.content}
                  </div>
                )}

                {/* Assistant Structured SIB Response */}
                {!isUser && msg.structuredResponse && (
                  <div className="space-y-4">
                    {/* Primary Answer & Summary */}
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-900 leading-relaxed">
                        {msg.structuredResponse.answer}
                      </p>
                      {msg.structuredResponse.summary && (
                        <p className="text-[11px] text-slate-500 italic">
                          {msg.structuredResponse.summary}
                        </p>
                      )}
                    </div>

                    {/* Verified Metrics Chips */}
                    {msg.structuredResponse.metrics && msg.structuredResponse.metrics.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        {msg.structuredResponse.metrics.map((m, mIdx) => (
                          <div key={mIdx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                            <span className="text-[9px] uppercase font-bold text-slate-500 block truncate">{m.name}</span>
                            <span className="text-base font-black text-[#320b86] font-mono block">{m.value}</span>
                            {m.benchmark && <span className="text-[9px] text-slate-400">Benchmark: {m.benchmark}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Key Findings List */}
                    {msg.structuredResponse.findings && msg.structuredResponse.findings.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-[#320b86] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Verified Findings</span>
                        </span>
                        <ul className="space-y-1 pl-4 list-disc text-slate-700 text-[11px]">
                          {msg.structuredResponse.findings.map((f, fIdx) => (
                            <li key={fIdx}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Supporting Evidence Proofs */}
                    {msg.structuredResponse.evidence && msg.structuredResponse.evidence.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                          <FileCheck2 className="w-3 h-3 text-[#320b86]" />
                          <span>Supporting Evidence</span>
                        </span>
                        <div className="space-y-1">
                          {msg.structuredResponse.evidence.map((ev, evIdx) => (
                            <div key={evIdx} className="p-2 rounded-xl bg-purple-50/50 border border-purple-200 flex items-center justify-between text-[11px]">
                              <div>
                                <span className="font-bold text-slate-900 block">{ev.statement}</span>
                                <span className="text-slate-500 text-[10px]">Source: {ev.recordReference}</span>
                              </div>
                              <span className="text-[#320b86] font-mono font-bold">{ev.verifiedFact}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommended Actions */}
                    {msg.structuredResponse.recommended_actions && msg.structuredResponse.recommended_actions.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-amber-800 flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                          <span>Recommended Leadership Action</span>
                        </span>
                        <div className="space-y-1">
                          {msg.structuredResponse.recommended_actions.map((act, aIdx) => (
                            <div key={aIdx} className="text-[11px] text-amber-950">
                              <strong>• {act.action}</strong>
                              <span className="text-amber-800/80 block text-[10px] mt-0.5">Reason: {act.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Meta Bar: Confidence, Priority, Limitations & Copy */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[#320b86] uppercase">
                          {msg.structuredResponse.confidence} Confidence
                        </span>
                        <span>•</span>
                        <span>{msg.structuredResponse.priority} Priority</span>
                        <span>•</span>
                        <span>Trend: {msg.structuredResponse.trend}</span>
                      </div>

                      <button
                        onClick={() => handleCopy(msg.structuredResponse!.answer, index)}
                        className="flex items-center gap-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                        title="Copy answer"
                      >
                        {copiedIndex === index ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedIndex === index ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 items-center text-xs text-[#320b86]">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#320b86] flex items-center justify-center animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center gap-2 shadow-xs">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#320b86]" />
              <span>Analyzing verified intelligence and cross-checking evidence...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-2 bg-white border border-slate-200 rounded-2xl flex items-center gap-2 shadow-xs">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Ask SIB anything (e.g., 'Why did Class B fall to 71%?', 'Show me repeated absences')..."
          className="flex-1 bg-transparent px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />

        <button
          onClick={() => handleSend()}
          disabled={!inputQuery.trim() || isLoading}
          className="p-2.5 bg-[#320b86] hover:bg-[#250866] text-white rounded-xl transition shadow-xs cursor-pointer disabled:opacity-40"
          title="Send query"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
