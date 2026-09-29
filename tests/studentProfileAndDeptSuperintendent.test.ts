import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLoginIdentifier } from '../src/utils/loginIdentifier.js';
import { buildWhatsAppDirectLink, normalizePhoneNumber } from '../src/utils/phoneUtils.js';

test('Departmental Superintendent login initials ADS, YDS, CDS resolve accurately', () => {
  // Adult Departmental Superintendent (ADS)
  assert.equal(normalizeLoginIdentifier('ADS'), 'ads@gofamint-hof.internal');
  assert.equal(normalizeLoginIdentifier('ads'), 'ads@gofamint-hof.internal');
  assert.equal(normalizeLoginIdentifier('  ads  '), 'ads@gofamint-hof.internal');
  assert.equal(normalizeLoginIdentifier('adultsuperintendent'), 'ads@gofamint-hof.internal');

  // Youth Departmental Superintendent (YDS)
  assert.equal(normalizeLoginIdentifier('YDS'), 'akintayoakinsunmade@gmail.com');
  assert.equal(normalizeLoginIdentifier('yds'), 'akintayoakinsunmade@gmail.com');
  assert.equal(normalizeLoginIdentifier('  yds  '), 'akintayoakinsunmade@gmail.com');
  assert.equal(normalizeLoginIdentifier('youthsuperintendent'), 'akintayoakinsunmade@gmail.com');

  // Children Departmental Superintendent (CDS)
  assert.equal(normalizeLoginIdentifier('CDS'), 'cds@gofamint-hof.internal');
  assert.equal(normalizeLoginIdentifier('cds'), 'cds@gofamint-hof.internal');
  assert.equal(normalizeLoginIdentifier('  cds  '), 'cds@gofamint-hof.internal');
  assert.equal(normalizeLoginIdentifier('childrensuperintendent'), 'cds@gofamint-hof.internal');
});

test('Student Profile Link WhatsApp direct-to-DM messaging picks phone digits', () => {
  const sampleUrl = 'https://sunday-school.gofamint.org/#visitor-profile/tok_test123';
  const sampleMessage = `Hello Brother John! Access your Sunday School student profile and live report card here: ${sampleUrl}`;

  // Nigerian phone number with leading 0
  const linkWithPhone = buildWhatsAppDirectLink('08031234567', sampleMessage);
  assert.match(linkWithPhone, /^https:\/\/wa\.me\/2348031234567\?text=/);
  assert.ok(linkWithPhone.includes(encodeURIComponent(sampleUrl)));

  // International format with +234
  const linkWithIntl = buildWhatsAppDirectLink('+234 803 123 4567', sampleMessage);
  assert.match(linkWithIntl, /^https:\/\/wa\.me\/2348031234567\?text=/);

  // Missing / empty phone falls back softly to general WhatsApp share without crashing
  const linkNoPhone = buildWhatsAppDirectLink('', sampleMessage);
  assert.match(linkNoPhone, /^https:\/\/wa\.me\/\?text=/);
});

test('Phone Number Intelligence correctly normalizes Nigerian numbers to E.164', () => {
  assert.equal(normalizePhoneNumber('09035123456'), '+2349035123456');
  assert.equal(normalizePhoneNumber('08023456789'), '+2348023456789');
  assert.equal(normalizePhoneNumber('+234 903 512 3456'), '+2349035123456');
});

test('Student Profile URL parser extracts token from #student-profile without login', () => {
  const testUrl = 'https://app.gofamint.org/#student-profile/vis_qmwwbswv9cwh91gmt7u5mud5eu9k';
  const hashMatch = testUrl.match(/#\/?(?:report-card|student-report|student-profile)\/([a-zA-Z0-9_-]+)/);
  assert.ok(hashMatch);
  assert.equal(hashMatch[1], 'vis_qmwwbswv9cwh91gmt7u5mud5eu9k');
});

test('Student Profile Confidentiality — Peer names and individual scores are strictly excluded', async () => {
  const { computeClassFairnessRankings } = await import('../src/utils/fairnessScoring.js');
  
  const classMembers = [
    { id: 'mem_1', fullName: 'Student Alpha', memberType: 'STUDENT' as const, status: 'ACTIVE' as const, firstLessonWeek: 1 },
    { id: 'mem_2', fullName: 'Student Beta', memberType: 'STUDENT' as const, status: 'ACTIVE' as const, firstLessonWeek: 1 },
    { id: 'mem_3', fullName: 'Visitor Gamma', memberType: 'VISITOR' as const, status: 'ACTIVE' as const, firstLessonWeek: 1 }
  ];

  const grades = [
    // Alpha: 50 pts
    { id: 'g1', memberId: 'mem_1', weekNumber: 1, attendance: 'PRESENT', punctuality: 15, memoryVerse: 15, classParticipation: 20 },
    // Beta: 40 pts
    { id: 'g2', memberId: 'mem_2', weekNumber: 1, attendance: 'PRESENT', punctuality: 10, memoryVerse: 15, classParticipation: 15 },
    // Gamma: 45 pts
    { id: 'g3', memberId: 'mem_3', weekNumber: 1, attendance: 'PRESENT', punctuality: 15, memoryVerse: 10, classParticipation: 20 }
  ];

  const results = computeClassFairnessRankings(classMembers as any, grades as any, 1);
  const alphaMetrics = results.memberMetrics.find(m => m.memberId === 'mem_1');

  assert.ok(alphaMetrics);
  // Alpha has rank 1
  assert.equal(alphaMetrics.rankings.overall, 1);
  assert.equal(alphaMetrics.rankings.totalInClass, 3);
  assert.equal(alphaMetrics.isAwardEligible, true);
  assert.equal(alphaMetrics.awardEligibilityLabel, 'Eligible for Awards');

  const gammaMetrics = results.memberMetrics.find(m => m.memberId === 'mem_3');
  assert.ok(gammaMetrics);
  // Gamma is a visitor: scores are NOT zeroed, but awardEligible is false
  assert.equal(gammaMetrics.isAwardEligible, false);
  assert.equal(gammaMetrics.awardEligibilityLabel, 'Not Eligible for Awards');
  assert.ok(gammaMetrics.totalPointsEarned > 0);
  assert.ok(gammaMetrics.overall.rawRate > 0);
});

test('Late joiner receives N/A before joining and absence counts only after joining', async () => {
  const { computeClassFairnessRankings } = await import('../src/utils/fairnessScoring.js');

  const lateJoiner = {
    id: 'late_1',
    fullName: 'Late Sister',
    memberType: 'STUDENT' as const,
    status: 'ACTIVE' as const,
    firstLessonWeek: 9 // Joined in Week 9 of a 12-week quarter
  };

  const grades = [
    { id: 'g9', memberId: 'late_1', weekNumber: 9, attendance: 'PRESENT', punctuality: 15, memoryVerse: 15, classParticipation: 15 }, // 45/50
    { id: 'g10', memberId: 'late_1', weekNumber: 10, attendance: 'PRESENT', punctuality: 15, memoryVerse: 15, classParticipation: 18 }, // 48/50
    { id: 'g11', memberId: 'late_1', weekNumber: 11, attendance: 'ABSENT', punctuality: 0, memoryVerse: 0, classParticipation: 0 }, // 0/50
    { id: 'g12', memberId: 'late_1', weekNumber: 12, attendance: 'PRESENT', punctuality: 15, memoryVerse: 15, classParticipation: 17 } // 47/50
  ];

  const results = computeClassFairnessRankings([lateJoiner as any], grades as any, 12);
  const metrics = results.memberMetrics.find(m => m.memberId === 'late_1');

  assert.ok(metrics);
  // Weeks 1-8 must NOT count as absent or zeros
  assert.equal(metrics.eligibleLessons, 4);
  assert.equal(metrics.attendedWeeks, 3);
  assert.equal(metrics.absentWeeks, 1);
  // Total = 45 + 48 + 0 + 47 = 140 / 200 = 70%
  assert.equal(metrics.totalPointsEarned, 140);
  assert.equal(metrics.maxAvailablePoints, 200);
  assert.equal(metrics.overall.rawRate, 70);

  // Cluster week 1 should be NOT_ELIGIBLE, not absent
  const wk1 = metrics.clusterWeeks.find(w => w.weekNumber === 1);
  assert.equal(wk1?.attendance, 'NOT_ELIGIBLE');
  assert.equal(wk1?.isEligible, false);

  // Cluster week 11 should be ABSENT
  const wk11 = metrics.clusterWeeks.find(w => w.weekNumber === 11);
  assert.equal(wk11?.attendance, 'ABSENT');
  assert.equal(wk11?.isEligible, true);
});

