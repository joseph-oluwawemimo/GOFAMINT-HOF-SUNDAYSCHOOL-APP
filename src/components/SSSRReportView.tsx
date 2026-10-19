import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, Copy, Eye, Send, X } from 'lucide-react';
import { ClassProfile, LessonInfo, Member, QuarterData, SSSRDeliveryRecord, WeeklyGradeRecord } from '../types';
import { GOFAMINT_HOF_12_LESSONS } from '../data/mockQuarterLessons';
import { generateSSSRReport, type SSSRReportResult } from '../utils/sssrReportGenerator';
import { mergeSSSRDeliveryMaps } from '../utils/sssrDeliveries';
import { ensureMemberProfileLinks, persistSSSRDeliveryRecords } from '../services/sssrDeliveryApi';

interface SSSRReportViewProps {
  members: Member[];
  grades: WeeklyGradeRecord[];
  currentWeek: number;
  classProfile: ClassProfile | null;
  lessons?: LessonInfo[];
  selectedQuarterNumber?: number;
  quarterData?: QuarterData | null;
  onSelectWeek?: (week: number) => void;
  onUpdateClassProfile?: (updated: ClassProfile) => Promise<void>;
  onDeliveriesUpdated?: (deliveries: Record<string, SSSRDeliveryRecord>) => void | Promise<void>;
  persistDeliveries?: typeof persistSSSRDeliveryRecords;
}

export const SSSRReportView: React.FC<SSSRReportViewProps> = ({
  members,
  grades,
  currentWeek,
  classProfile,
  lessons = GOFAMINT_HOF_12_LESSONS,
  selectedQuarterNumber = 1,
  quarterData,
  onSelectWeek,
  onDeliveriesUpdated,
  persistDeliveries = persistSSSRDeliveryRecords
}) => {
  const [selectedWeek, setSelectedWeek] = useState(currentWeek || 1);
  const [savedDeliveries, setSavedDeliveries] = useState<Record<string, SSSRDeliveryRecord>>({});
  const [selectedCard, setSelectedCard] = useState<SSSRReportResult | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [preparedTokens, setPreparedTokens] = useState<Record<string, string>>({});
  const [linkRetry, setLinkRetry] = useState(0);
  const [copied, setCopied] = useState(false);
  const deliveriesRef = useRef<Record<string, SSSRDeliveryRecord>>({});
  const savingIdsRef = useRef(new Set<string>());
  const scopeRef = useRef('');
  const linkRequestRef = useRef('');

  const storageKey = useMemo(
    () => `gofamint_sssr_deliveries_${classProfile?.id || 'default_class'}_q${selectedQuarterNumber}`,
    [classProfile?.id, selectedQuarterNumber]
  );

  useEffect(() => setSelectedWeek(currentWeek || 1), [currentWeek]);

  useEffect(() => {
    let local: Record<string, SSSRDeliveryRecord> = {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) local = JSON.parse(raw);
    } catch (error) {
      console.error(`[SSSR] Could not read the local completion cache ${storageKey}:`, error);
    }
    const previousScopeMap = scopeRef.current === storageKey ? deliveriesRef.current : {};
    const merged = mergeSSSRDeliveryMaps(local, classProfile?.sssrDeliveries, previousScopeMap);
    scopeRef.current = storageKey;
    deliveriesRef.current = merged;
    setSavedDeliveries(merged);
  }, [storageKey, classProfile?.sssrDeliveries]);

  const activeMembers = useMemo(
    () => members.filter(member => member.status !== 'LEFT_CLASS'),
    [members]
  );
  const missingLinkIds = useMemo(() => activeMembers.filter(member => {
    const reportToken = typeof member.reportCardToken === 'string' ? member.reportCardToken : member.reportCardToken?.token;
    const profileToken = typeof member.oneTimeProfileToken === 'string' ? member.oneTimeProfileToken : member.oneTimeProfileToken?.token;
    return !reportToken && !profileToken && !preparedTokens[member.id];
  }).map(member => member.id), [activeMembers, preparedTokens]);
  const missingLinkKey = missingLinkIds.join('|');

  useEffect(() => {
    if (!classProfile?.id || !missingLinkKey) return;
    const requestKey = `${classProfile.id}:${missingLinkKey}:${linkRetry}`;
    if (linkRequestRef.current === requestKey) return;
    linkRequestRef.current = requestKey;
    let cancelled = false;
    setLinkError(null);
    const prepare = async () => {
      try {
        const links: Record<string, string> = {};
        for (let index = 0; index < missingLinkIds.length; index += 200) {
          const batch = await ensureMemberProfileLinks(classProfile.id, missingLinkIds.slice(index, index + 200));
          for (const [id, value] of Object.entries(batch)) links[id] = value.token;
        }
        if (!cancelled) setPreparedTokens(current => ({ ...current, ...links }));
      } catch (error) {
        console.error('[SSSR] Private student profile link preparation failed:', error);
        if (!cancelled) setLinkError(error instanceof Error ? error.message : String(error));
      }
    };
    void prepare();
    return () => { cancelled = true; };
  }, [classProfile?.id, missingLinkKey, linkRetry]);
  const selectedLesson = useMemo(
    () => lessons.find(lesson => lesson.weekNumber === selectedWeek) || lessons[0] || GOFAMINT_HOF_12_LESSONS[0],
    [lessons, selectedWeek]
  );

  const reportRows = useMemo(() => activeMembers.map(member => {
    const grade = grades.find(item => item.memberId === member.id && item.weekNumber === selectedWeek
      && (!item.quarterNumber || item.quarterNumber === selectedQuarterNumber)) || null;
    const id = `${classProfile?.id || 'default'}_q${selectedQuarterNumber}_w${selectedWeek}_m${member.id}`;
    return {
      member,
      grade,
      id,
      isDone: savedDeliveries[id]?.status === 'DONE',
      report: generateSSSRReport({
        member: preparedTokens[member.id]
          ? { ...member, oneTimeProfileToken: { token: preparedTokens[member.id], expiresAt: '', isUsed: false } }
          : member,
        weekNumber: selectedWeek, classProfile, lesson: selectedLesson, grade
      })
    };
  }), [activeMembers, grades, selectedWeek, classProfile, selectedQuarterNumber, selectedLesson, savedDeliveries, preparedTokens]);

  const completedCount = reportRows.filter(row => row.isDone).length;
  const completionPercentage = reportRows.length > 0 ? Math.round((completedCount / reportRows.length) * 100) : 0;

  const cacheDeliveries = (deliveries: Record<string, SSSRDeliveryRecord>) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(deliveries));
    } catch (error) {
      console.error(`[SSSR] Database save succeeded but local cache ${storageKey} could not be updated:`, error);
    }
  };

  const saveRecords = async (records: SSSRDeliveryRecord[]) => {
    if (!classProfile?.id) {
      setSaveError('The class profile is not available. SSS completion was not saved.');
      return;
    }
    if (records.some(record => savingIdsRef.current.has(record.id))) return;
    const previous = deliveriesRef.current;
    const attemptedById = Object.fromEntries(records.map(record => [record.id, record]));
    const optimistic = mergeSSSRDeliveryMaps(previous, attemptedById);
    deliveriesRef.current = optimistic;
    setSavedDeliveries(optimistic);
    records.forEach(record => savingIdsRef.current.add(record.id));
    setSavingIds(current => new Set([...current, ...records.map(record => record.id)]));
    setSaveError(null);
    try {
      const databaseDeliveries = await persistDeliveries(classProfile.id, records);
      const committed = mergeSSSRDeliveryMaps(deliveriesRef.current, databaseDeliveries);
      deliveriesRef.current = committed;
      setSavedDeliveries(committed);
      cacheDeliveries(committed);
      try {
        await onDeliveriesUpdated?.(committed);
      } catch (cacheError) {
        console.error('[SSSR] Database save succeeded, but the surrounding view could not refresh its completion state:', cacheError);
      }
    } catch (error) {
      // Roll back only this request's entries so another simultaneous save is
      // retained. A failed save must never erase a separately confirmed mark.
      const rolledBack = { ...deliveriesRef.current };
      records.forEach(record => {
        if (rolledBack[record.id]?.updatedAt === record.updatedAt) {
          if (previous[record.id]) rolledBack[record.id] = previous[record.id];
          else delete rolledBack[record.id];
        }
      });
      deliveriesRef.current = rolledBack;
      setSavedDeliveries(rolledBack);
      const message = error instanceof Error ? error.message : String(error);
      console.error('[SSSR] Completion was rolled back because the database did not confirm it:', error);
      setSaveError(message);
      throw error;
    } finally {
      records.forEach(record => savingIdsRef.current.delete(record.id));
      setSavingIds(current => {
        const next = new Set(current);
        records.forEach(record => next.delete(record.id));
        return next;
      });
    }
  };

  const makeDoneRecord = (member: Member, grade: WeeklyGradeRecord | null): SSSRDeliveryRecord => {
    const now = new Date().toISOString();
    const id = `${classProfile?.id || 'default'}_q${selectedQuarterNumber}_w${selectedWeek}_m${member.id}`;
    return {
      id,
      classId: classProfile?.id || '',
      quarterNumber: selectedQuarterNumber,
      weekNumber: selectedWeek,
      memberId: member.id,
      memberName: member.fullName,
      attendance: grade?.attendance || 'ABSENT',
      status: 'DONE',
      sentAt: now,
      sentBy: classProfile?.secretaryName || 'Class Secretary',
      method: 'WHATSAPP',
      updatedAt: now
    };
  };

  const handleMarkDone = (member: Member, grade: WeeklyGradeRecord | null) => {
    const record = makeDoneRecord(member, grade);
    if (deliveriesRef.current[record.id]?.status === 'DONE') return;
    void saveRecords([record]).catch(() => undefined);
  };

  const handleMarkAllPresent = () => {
    const records = reportRows
      .filter(row => row.grade?.attendance === 'PRESENT' && !row.isDone)
      .map(row => makeDoneRecord(row.member, row.grade));
    if (records.length === 0) return;
    void saveRecords(records).catch(() => undefined);
  };

  const handleSelectWeek = (week: number) => {
    setSelectedWeek(week);
    onSelectWeek?.(week);
  };

  return (
    <section aria-labelledby="sssr-heading" className="space-y-5 animate-fade-in pb-10">
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 p-5 sm:p-7 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">One report workspace</span>
            <h1 id="sssr-heading" className="mt-1 text-xl sm:text-3xl font-black">Dispatch SSS Reports</h1>
            <p className="mt-1 max-w-2xl text-xs text-blue-100">Send, inspect, and permanently record every member report without changing screens.</p>
          </div>
          <button
            type="button"
            onClick={handleMarkAllPresent}
            disabled={!reportRows.some(row => row.grade?.attendance === 'PRESENT' && !row.isDone) || savingIds.size > 0}
            className="min-h-11 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark all present as done
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-wrap items-center gap-3 text-xs font-black text-slate-700">
          SSS report week
          <select value={selectedWeek} onChange={event => handleSelectWeek(Number(event.target.value))}
            className="min-h-11 min-w-28 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950">
            {Array.from({ length: Math.min(12, Math.max(1, quarterData?.totalLessonWeeks || 12)) }, (_, index) => index + 1)
              .map(week => <option key={week} value={week}>Week {week}</option>)}
          </select>
        </label>
      </div>

      {saveError && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><strong>Completion was not saved.</strong> {saveError}</div>
        </div>
      )}
      {linkError && (
        <div role="alert" className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Private profile links are unavailable.</strong> {linkError}
          <button type="button" onClick={() => setLinkRetry(value => value + 1)} className="ml-3 font-black underline">Retry</button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4 text-xs font-bold text-slate-700">
          <span>{completedCount} of {reportRows.length} reports done</span>
          <span className="text-emerald-700">{completionPercentage}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${completionPercentage}%` }} />
        </div>
      </div>

      <div aria-label="All member SSS reports" className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {reportRows.map(({ member, grade, id, isDone, report }) => {
          const isPresent = grade?.attendance === 'PRESENT';
          const isSaving = savingIds.has(id);
          return (
            <article key={member.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-words text-sm font-black text-slate-950">{member.fullName}</h2>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-600">{member.memberType}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${isPresent ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {isPresent ? 'PRESENT' : 'ABSENT'}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-[11px] text-slate-500">{member.phone || 'No phone number recorded'}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                  {member.phone && report.studentProfileLink ? (
                    <a href={report.whatsAppDirectLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-2.5 text-[11px] font-black text-white">
                      <Send className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  ) : (
                    <button disabled className="min-h-10 rounded-xl bg-slate-100 px-2 text-[11px] font-bold text-slate-400">{member.phone ? 'Preparing link' : 'No phone'}</button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleMarkDone(member, grade)}
                    disabled={isDone || isSaving}
                    className={`min-h-10 rounded-xl border px-2 text-[11px] font-black ${isDone ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-900'} disabled:cursor-default`}
                  >
                    {isSaving ? 'Saving…' : isDone ? 'Done ✓' : 'Mark Done'}
                  </button>
                  <button type="button" onClick={() => setSelectedCard(report)} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl bg-slate-100 px-2.5 text-[11px] font-black text-slate-800">
                    <Eye className="h-3.5 w-3.5" /> View Card
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {selectedCard && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="sssr-card-title">
          <div className="my-auto w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Week {selectedWeek} message card</span>
                <h2 id="sssr-card-title" className="text-lg font-black text-slate-950">{selectedCard.memberName}</h2>
              </div>
              <button type="button" onClick={() => setSelectedCard(null)} aria-label="Close report card" className="rounded-full bg-slate-100 p-2 text-slate-600"><X className="h-4 w-4" /></button>
            </div>
                    <div className="mt-4 max-h-[55vh] overflow-y-auto rounded-2xl bg-[#0b141a] p-4 text-xs leading-relaxed text-slate-100 whitespace-pre-wrap [overflow-wrap:anywhere]">
              {selectedCard.formattedMessage}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(selectedCard.formattedMessage).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  }).catch(error => setSaveError(`Could not copy message: ${error instanceof Error ? error.message : String(error)}`));
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 text-xs font-black text-slate-800"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
              </button>
              {selectedCard.studentProfileLink ? (
                <a href={selectedCard.whatsAppDirectLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-black text-white">
                  <Send className="h-4 w-4" /> WhatsApp
                </a>
              ) : <button disabled className="min-h-11 rounded-xl bg-slate-100 text-xs font-black text-slate-500">Preparing private link</button>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
