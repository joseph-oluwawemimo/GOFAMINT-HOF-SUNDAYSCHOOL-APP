import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { Navigation } from '../../src/components/Navigation';
import { SSSRReportView } from '../../src/components/SSSRReportView';
import { ClassReportCardHub } from '../../src/components/ClassReportCardHub';
import type { ActiveTab, ClassProfile, Member, SSSRDeliveryRecord, WeeklyGradeRecord } from '../../src/types';

// Local-only fixture. It never calls the production API or loads real people.
const classProfile = { id: 'local-review', className: 'Youth C', department: 'Youth', secretaryName: 'Class Secretary', year: 2026 } as ClassProfile;
const members = [
  { id: 'samuel', fullName: 'Samuel Example', phone: '+2348000000001', memberType: 'STUDENT', status: 'ACTIVE', reportCardToken: { token: 'local-samuel-private-token', createdAt: '2026-10-18' } },
  { id: 'elijah', fullName: 'Elijah Example', phone: '+2348000000002', memberType: 'STUDENT', status: 'ACTIVE', reportCardToken: { token: 'local-elijah-private-token', createdAt: '2026-10-18' } },
  { id: 'visitor', fullName: 'Ruth Example Visitor', phone: '+2348000000003', memberType: 'VISITOR', status: 'ACTIVE', reportCardToken: { token: 'local-ruth-private-token', createdAt: '2026-10-18' } }
] as Member[];
const grades = [
  { id: 'g-samuel', memberId: 'samuel', weekNumber: 6, quarterNumber: 1, attendance: 'PRESENT', punctuality: 10, memoryVerse: 10, classParticipation: 15, lessonTotal: 35 },
  { id: 'g-elijah', memberId: 'elijah', weekNumber: 6, quarterNumber: 1, attendance: 'ABSENT', punctuality: 0, memoryVerse: 0, classParticipation: 0, lessonTotal: 0 },
  { id: 'g-visitor', memberId: 'visitor', weekNumber: 6, quarterNumber: 1, attendance: 'PRESENT', punctuality: 5, memoryVerse: 5, classParticipation: 10, lessonTotal: 20 }
] as WeeklyGradeRecord[];

function Review() {
  const [tab, setTab] = useState<ActiveTab>('SSSR_REPORT');
  const [deliveries, setDeliveries] = useState<Record<string, SSSRDeliveryRecord>>({});
  const [week, setWeek] = useState(6);
  const profile = { ...classProfile, sssrDeliveries: deliveries };
  return <div className="min-h-screen bg-slate-100 pb-20">
    <Navigation activeTab={tab} onTabChange={setTab} urgentAbsenceCount={1} visitorConversionCount={0} classProfile={profile} />
    <main className="mx-auto max-w-7xl p-3 sm:p-6">
      {tab === 'SSSR_REPORT' && <SSSRReportView members={members} grades={grades} currentWeek={week} classProfile={profile} selectedQuarterNumber={1} onSelectWeek={setWeek}
        persistDeliveries={async (_classId, records) => {
          const map = Object.fromEntries(records.map(record => [record.id, record]));
          setDeliveries(previous => ({ ...previous, ...map }));
          return { ...deliveries, ...map };
        }} />}
      {tab === 'REPORT_CARD' && <ClassReportCardHub members={members} grades={grades} classProfile={profile} />}
      {tab !== 'SSSR_REPORT' && tab !== 'REPORT_CARD' && <section className="rounded-2xl bg-white p-5">Local navigation fixture: {tab}</section>}
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<Review />);
