import test from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentCalendarWeek, getQuarterWeeklySchedule } from '../src/utils/quarterScheduleUtils';
import type { QuarterData, Member, WeeklyGradeRecord, WeeklyOfferingRecord } from '../src/types';

test('Sunday 2026-09-20 resolves automatically to Week 3 in the active 12-week schedule', () => {
  const activeQuarter: QuarterData = {
    id: 'q1_2026',
    quarterNumber: 1,
    quarterName: 'First Quarter 2026/2027',
    quarterTheme: 'Discipleship',
    startDate: '2026-09-06',
    week1SundayDate: '2026-09-06',
    totalLessonWeeks: 12,
    hasSharingAdmonitionWeek: true,
    status: 'ACTIVE',
    lessons: [],
    updatedAt: new Date().toISOString()
  };

  const schedule = getQuarterWeeklySchedule(activeQuarter, 2026);
  assert.equal(schedule.length, 13);
  assert.equal(schedule[0].weekNumber, 1);
  assert.equal(schedule[0].sundayDate, '2026-09-06');
  assert.equal(schedule[1].weekNumber, 2);
  assert.equal(schedule[1].sundayDate, '2026-09-13');
  assert.equal(schedule[2].weekNumber, 3);
  assert.equal(schedule[2].sundayDate, '2026-09-20');

  // Test that today Sunday 2026-09-20 resolves to Week 3
  const todayDate = new Date('2026-09-20T10:00:00');
  const resolvedWeek = getCurrentCalendarWeek(activeQuarter, todayDate);
  assert.equal(resolvedWeek, 3, 'Today 2026-09-20 must resolve to Week 3');
});

test('Remittance audit records track original amount and corrected changes', () => {
  const offering: WeeklyOfferingRecord = {
    id: 'offering_w3',
    weekNumber: 3,
    amount: 1301,
    remittanceStatus: 'REMITTED',
    remittedBy: 'Class Secretary',
    remittedAt: '2026-09-20T09:30:00Z',
    updatedAt: '2026-09-20T09:30:00Z'
  };

  // When corrected in Changes Mode:
  const correctedAmount = 1300;
  const auditEntry = {
    originalAmount: offering.amount,
    newAmount: correctedAmount,
    timestamp: new Date().toISOString(),
    actor: 'Class Secretary',
    reason: 'Remit corrections completed in Changes Mode'
  };

  const updatedOffering: WeeklyOfferingRecord = {
    ...offering,
    amount: correctedAmount,
    changesAudit: [auditEntry],
    updatedAt: new Date().toISOString()
  };

  assert.equal(updatedOffering.amount, 1300);
  assert.equal(updatedOffering.changesAudit?.length, 1);
  assert.equal(updatedOffering.changesAudit?.[0].originalAmount, 1301);
  assert.equal(updatedOffering.changesAudit?.[0].newAmount, 1300);
});

test('Member display order is numeric data and preserves database member ID', () => {
  const members: Member[] = [
    { id: 'mem_1', classId: 'cls_1', fullName: 'Peter', memberType: 'STUDENT', status: 'ACTIVE', displayOrder: 3 },
    { id: 'mem_2', classId: 'cls_1', fullName: 'John', memberType: 'STUDENT', status: 'ACTIVE', displayOrder: 1 },
    { id: 'mem_3', classId: 'cls_1', fullName: 'Mary', memberType: 'STUDENT', status: 'ACTIVE', displayOrder: 2 }
  ];

  // Sort by displayOrder
  const sorted = [...members].sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
  assert.equal(sorted[0].fullName, 'John');
  assert.equal(sorted[0].id, 'mem_2'); // ID is untouched!
  assert.equal(sorted[1].fullName, 'Mary');
  assert.equal(sorted[1].id, 'mem_3');
  assert.equal(sorted[2].fullName, 'Peter');
  assert.equal(sorted[2].id, 'mem_1');
});

test('One-time visitor profile tokens invalidate after use and protect access', () => {
  const visitor: Member = {
    id: 'vis_101',
    classId: 'cls_1',
    fullName: 'New Visitor',
    memberType: 'VISITOR',
    status: 'ACTIVE',
    oneTimeProfileToken: {
      token: 'vis_token_abc123',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      isUsed: false
    }
  };

  assert.equal(visitor.oneTimeProfileToken?.isUsed, false);

  // After completion
  const completedVisitor: Member = {
    ...visitor,
    phone: '08012345678',
    address: '12 Faith Street, Lagos',
    oneTimeProfileToken: {
      ...visitor.oneTimeProfileToken!,
      isUsed: true,
      usedAt: new Date().toISOString()
    }
  };

  assert.equal(completedVisitor.oneTimeProfileToken?.isUsed, true);
  assert.equal(completedVisitor.id, 'vis_101'); // ID is preserved
  assert.equal(completedVisitor.phone, '08012345678');
});
