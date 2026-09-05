import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  RefreshCw,
  BookOpen,
  MessageCircle,
  HelpCircle,
  Copy,
  Check,
  Flame,
  FileText,
  Church
} from 'lucide-react';
import {
  Member,
  WeeklyGradeRecord,
  ClassProfile,
  ChatMessage
} from '../types';
import { GOFAMINT_HOF_12_LESSONS } from '../data/mockQuarterLessons';
import { askGeminiSecretaryAssistant } from '../services/api';

interface AIAssistantViewProps {
  members: Member[];
  grades: WeeklyGradeRecord[];
  currentWeek: number;
  classProfile: ClassProfile | null;
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  members,
  grades,
  currentWeek,
  classProfile,
  initialPrompt,
  onClearInitialPrompt
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Calvary greetings in Christ! 🙏 I am your **GOFAMINT_HOF Sunday School AI Assistant**.\n\nI am equipped with the complete 12-Lesson quarterly curriculum, class roster analytics, and pastoral follow-up guidance. How may I assist you today?`,
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputText, setInputText] = useState(initialPrompt || '');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPrompt) {
      setInputText(initialPrompt);
      if (onClearInitialPrompt) onClearInitialPrompt();
    }
  }, [initialPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const currentLesson = GOFAMINT_HOF_12_LESSONS.find(l => l.weekNumber === currentWeek) || GOFAMINT_HOF_12_LESSONS[0];

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: query.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // Build context-rich prompt
    const contextData = {
      className: classProfile?.className || 'Grace & Truth Adult Bible Class',
      department: classProfile?.department || 'Young Adults',
      secretaryName: classProfile?.secretaryName || 'Class Secretary',
      currentWeek,
      lessonTopic: currentLesson.topic,
      scriptureReading: currentLesson.scriptureReading,
      memoryVerse: currentLesson.memoryVerse,
      totalStudents: members.filter(m => m.memberType === 'STUDENT').length,
      totalVisitors: members.filter(m => m.memberType === 'VISITOR').length
    };

    try {
      const historyForApi = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));

      const response = await askGeminiSecretaryAssistant(query, historyForApi, contextData);

      const aiMessage: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `Peace be unto you. I encountered a momentary connection interruption: ${err.message || 'Please check network connection'}. Please try asking again.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMessage = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const quickPrompts = [
    `Draft warm WhatsApp follow-up for absent student with prayer for Lesson ${currentWeek}`,
    `Provide 3 interactive discussion questions for Lesson ${currentWeek}: "${currentLesson.topic}"`,
    `Generate Sunday School Secretary Quarter report summary for the Pastor`,
    `Suggest mnemonic tips to help class memorize: "${currentLesson.memoryVerse}"`
  ];

  return (
    <div className="space-y-4 animate-fade-in flex flex-col h-[760px] max-w-5xl mx-auto">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-lg p-4 shadow-xs flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-950 text-amber-400 flex items-center justify-center shadow-xs">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 text-base">
                GOFAMINT_HOF AI Secretary & Lesson Assistant
              </h3>
              <span className="text-[10px] font-black uppercase text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                Gemini Powered
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Active Context: Week {currentWeek} • "{currentLesson.topic}" • {classProfile?.className}
            </p>
          </div>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 bg-white border border-slate-200 rounded-lg p-4 sm:p-5 overflow-y-auto space-y-4 shadow-xs">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id || index}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-blue-900" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-lg p-4 text-xs sm:text-sm shadow-xs relative group ${
                  isUser
                    ? 'bg-blue-900 text-white rounded-tr-none'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>

                <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-slate-200/60 text-[10px] opacity-75">
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  
                  {!isUser && (
                    <button
                      onClick={() => handleCopyMessage(msg.content, index)}
                      className="text-slate-500 hover:text-slate-800 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition"
                      title="Copy text"
                    >
                      {copiedIndex === index ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedIndex === index ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center shrink-0 mt-0.5 text-white font-bold text-xs shadow-xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4 text-blue-900 animate-spin" />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 rounded-tl-none flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold">Composing spiritual & secretary insight...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none shrink-0">
        {quickPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(prompt)}
            disabled={isLoading}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 shrink-0 shadow-2xs"
          >
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span>{prompt}</span>
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="bg-white border border-slate-200 p-2.5 rounded-lg shadow-xs flex items-center gap-2 shrink-0">
        <input
          type="text"
          id="ai-assistant-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Ask AI Secretary (e.g. 'Draft pastoral visitation note for Bro. Emmanuel')..."
          className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600"
        />

        <button
          id="ai-assistant-btn-send"
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim() || isLoading}
          className="px-5 py-3 bg-blue-900 hover:bg-blue-800 disabled:opacity-40 text-white font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 shadow-xs transition"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>

    </div>
  );
};
