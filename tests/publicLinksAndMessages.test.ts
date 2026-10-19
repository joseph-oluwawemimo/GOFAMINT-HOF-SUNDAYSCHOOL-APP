import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePublicLinkTokens } from '../src/utils/publicLinkRouting';
import { generateSSSRReport } from '../src/utils/sssrReportGenerator';
import { formatRate } from '../src/utils/fairnessScoring';

test('student-profile hash links always open passwordless registration first', () => {
  assert.deepEqual(
    resolvePublicLinkTokens('https://example.test/#student-profile/token_123'),
    { visitorToken: 'token_123', reportCardToken: null }
  );
  assert.deepEqual(
    resolvePublicLinkTokens('https://example.test/#student-profile?token=legacy_456&action=register'),
    { visitorToken: 'legacy_456', reportCardToken: null }
  );
});

test('report-card links remain distinct from profile-registration links', () => {
  assert.deepEqual(
    resolvePublicLinkTokens('https://example.test/#report-card/rc_789'),
    { visitorToken: null, reportCardToken: 'rc_789' }
  );
});

test('SSS messages use canonical passwordless links and ask for a reply', () => {
  const report = generateSSSRReport({
    member: {
      id: 'member-1', fullName: 'Samuel', phone: '+2348000000000', memberType: 'STUDENT',
      status: 'ACTIVE', reportCardToken: { token: 'rc_samuel', createdAt: '2026-10-18T00:00:00.000Z' }
    } as any,
    weekNumber: 6,
    grade: { id: 'g1', memberId: 'member-1', weekNumber: 6, attendance: 'ABSENT' } as any,
    appBaseUrl: 'https://school.example'
  });
  assert.equal(report.studentProfileLink, 'https://school.example/#student-profile/rc_samuel');
  assert.match(report.formattedMessage, /please reply/i);
  assert.match(report.formattedMessage, /what kept you away/i);
});

test('SSS messages never expose a predictable member id as a public link', () => {
  const report = generateSSSRReport({
    member: { id: 'member-without-token', fullName: 'Grace', phone: '+2348000000000', memberType: 'STUDENT', status: 'ACTIVE' } as any,
    weekNumber: 6,
    appBaseUrl: 'https://school.example'
  });
  assert.equal(report.studentProfileLink, '');
  assert.equal(report.registrationLink, '');
  assert.doesNotMatch(report.formattedMessage, /student-profile\/member-without-token/);
});

test('rates render with exactly two decimal places and no duplicated unit', () => {
  assert.equal(formatRate(4.9), '4.90');
  assert.equal(formatRate(47.66945054945055), '47.67');
  assert.equal(formatRate(Number.NaN), '0.00');
});
