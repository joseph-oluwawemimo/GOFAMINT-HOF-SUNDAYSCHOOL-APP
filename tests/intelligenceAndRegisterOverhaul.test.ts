import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhoneNumber, formatPhoneNumberDisplay, findDuplicateMemberByPhone } from '../src/utils/phoneUtils';
import { Member } from '../src/types';
import { backgroundStateManager } from '../src/utils/backgroundStateManager';
import { calculateWeekSummary } from '../src/utils/calculations';

test('Phone Number Intelligence — canonical Nigerian normalization', () => {
  // 1. 09035123456 -> +2349035123456
  assert.equal(normalizePhoneNumber('09035123456'), '+2349035123456');

  // 2. +2349035123456 -> +2349035123456
  assert.equal(normalizePhoneNumber('+2349035123456'), '+2349035123456');

  // 3. 2349035123456 -> +2349035123456
  assert.equal(normalizePhoneNumber('2349035123456'), '+2349035123456');

  // 4. 9035123456 -> +2349035123456
  assert.equal(normalizePhoneNumber('9035123456'), '+2349035123456');

  // 5. Redundant zero +23409035123456 -> +2349035123456
  assert.equal(normalizePhoneNumber('+23409035123456'), '+2349035123456');

  // 6. Formatting for display
  assert.equal(formatPhoneNumberDisplay('09035123456'), '+234 903 512 3456');

  // 7. Non-Nigerian international number preserved
  assert.equal(normalizePhoneNumber('+14155552671'), '+14155552671');
  assert.equal(normalizePhoneNumber('+447911123456'), '+447911123456');
});

test('Duplicate Record Detection — recognizes equivalent formats', () => {
  const existingMembers: Member[] = [
    {
      id: 'mem_1',
      fullName: 'John Doe',
      phone: '+2349035123456',
      address: '',
      occupation: '',
      memberType: 'VISITOR',
      status: 'ACTIVE',
      prayerRequests: '',
      notes: '',
      evangelismReferralCount: 0,
      firstLessonWeek: 1,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z'
    }
  ];

  // Raw entry in local format should match canonical format
  const duplicate = findDuplicateMemberByPhone(existingMembers, '09035123456');
  assert.ok(duplicate);
  assert.equal(duplicate?.id, 'mem_1');

  // Same member being edited should be excluded
  const selfCheck = findDuplicateMemberByPhone(existingMembers, '09035123456', 'mem_1');
  assert.equal(selfCheck, null);

  // Different phone should not match
  const unique = findDuplicateMemberByPhone(existingMembers, '08022223333');
  assert.equal(unique, null);
});

test('Work Continuity — backgroundStateManager preserves and restores score drafts across backgrounding', () => {
  // Mock localStorage for node environment if needed
  const store: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
  (globalThis as any).localStorage = mockLocalStorage;

  // Save draft scores for a member
  backgroundStateManager.saveScoreDraft('class_adult_a', 3, 'mem_1', {
    attendance: 'PRESENT',
    punctuality: 14,
    memoryVerse: 15,
    classParticipation: 18
  });

  // Retrieve draft scores
  const drafts = backgroundStateManager.getScoreDrafts('class_adult_a', 3);
  assert.ok(drafts['mem_1']);
  assert.equal(drafts['mem_1'].punctuality, 14);
  assert.equal(drafts['mem_1'].memoryVerse, 15);
  assert.equal(drafts['mem_1'].classParticipation, 18);
  assert.equal(drafts['mem_1'].attendance, 'PRESENT');

  // Clear specific draft
  backgroundStateManager.clearScoreDraft('class_adult_a', 3, 'mem_1');
  const emptyDrafts = backgroundStateManager.getScoreDrafts('class_adult_a', 3);
  assert.equal(emptyDrafts['mem_1'], undefined);
});

test('Historical Independence Rule — earlier weeks preserve visitor status when converted later', () => {
  // Member was a visitor in Week 1, converted to student in Week 3
  const member: Member = {
    id: 'mem_converted',
    fullName: 'Grace Hopper',
    phone: '+2349011112222',
    address: '',
    occupation: '',
    memberType: 'STUDENT', // Current type is STUDENT
    status: 'ACTIVE',
    prayerRequests: '',
    notes: '',
    evangelismReferralCount: 0,
    firstLessonWeek: 1,
    convertedFromVisitorAtLesson: 3, // Converted at Week 3
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-15T00:00:00.000Z'
  };

  const grades = [
    { id: 'g_w1', memberId: 'mem_converted', weekNumber: 1, attendance: 'PRESENT', punctuality: 15, memoryVerse: 15, classParticipation: 20, lessonTotal: 50, updatedAt: '' },
    { id: 'g_w2', memberId: 'mem_converted', weekNumber: 2, attendance: 'PRESENT', punctuality: 15, memoryVerse: 15, classParticipation: 20, lessonTotal: 50, updatedAt: '' },
    { id: 'g_w3', memberId: 'mem_converted', weekNumber: 3, attendance: 'PRESENT', punctuality: 15, memoryVerse: 15, classParticipation: 20, lessonTotal: 50, updatedAt: '' },
    { id: 'g_w4', memberId: 'mem_converted', weekNumber: 4, attendance: 'PRESENT', punctuality: 15, memoryVerse: 15, classParticipation: 20, lessonTotal: 50, updatedAt: '' }
  ];

  // In Week 1: Grace must count as VISITOR, NOT student
  const summaryW1 = calculateWeekSummary(1, [member], grades as any, []);
  assert.equal(summaryW1.visitorCount, 1, 'Grace must count as visitor in Week 1');
  assert.equal(summaryW1.studentCount, 0, 'Grace must not count as student in Week 1');

  // In Week 2: Grace still counts as VISITOR
  const summaryW2 = calculateWeekSummary(2, [member], grades as any, []);
  assert.equal(summaryW2.visitorCount, 1, 'Grace must count as visitor in Week 2');
  assert.equal(summaryW2.studentCount, 0, 'Grace must not count as student in Week 2');

  // In Week 3: Grace has fulfilled 3-week consistency quota, but studentship starts in Week 4
  const summaryW3 = calculateWeekSummary(3, [member], grades as any, []);
  assert.equal(summaryW3.visitorCount, 1, 'Grace must still count as visitor in Week 3');
  assert.equal(summaryW3.studentCount, 0, 'Grace must not count as student in Week 3');

  // In Week 4: Grace's studentship is now officially active
  const summaryW4 = calculateWeekSummary(4, [member], grades as any, []);
  assert.equal(summaryW4.studentCount, 1, 'Grace must count as student from Week 4 onward');
  assert.equal(summaryW4.visitorCount, 0, 'Grace must not count as visitor from Week 4 onward');
});

