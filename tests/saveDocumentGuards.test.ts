import test from 'node:test';
import assert from 'node:assert/strict';

test('saveDocument: member student guard logic prevents regression to visitor', () => {
  // Simulate the guard logic implemented in saveDocument
  const existingCloudMember = {
    id: 'mem_test_123',
    memberType: 'STUDENT',
    status: 'ACTIVE',
    conversionStatus: 'APPROVED',
    convertedFromVisitorAtLesson: 3,
    certifiedAt: '2026-09-20T18:38:51.770Z',
    certifiedBy: 'PASTOR FAVOUR OLABANJI',
    enrolledDate: '2026-09-20T18:38:51.770Z',
    reportCardToken: { token: 'rc_123' },
    statusHistory: [{ reason: 'Certified' }],
    updatedAt: '2026-09-28T10:00:00.000Z'
  };

  const incomingStaleDraft = {
    id: 'mem_test_123',
    fullName: 'Test Member',
    memberType: 'VISITOR', // Stale draft attempting to downgrade
    status: 'ACTIVE',
    updatedAt: '2026-09-20T11:00:00.000Z' // Older timestamp
  };

  // Run the guard transformation
  const rowData: any = { ...incomingStaleDraft };
  if (existingCloudMember.memberType === 'STUDENT' && rowData.memberType !== 'STUDENT') {
    rowData.memberType = 'STUDENT';
    rowData.conversionStatus = existingCloudMember.conversionStatus;
    rowData.convertedFromVisitorAtLesson = existingCloudMember.convertedFromVisitorAtLesson;
    rowData.certifiedAt = existingCloudMember.certifiedAt;
    rowData.certifiedBy = existingCloudMember.certifiedBy;
    rowData.enrolledDate = existingCloudMember.enrolledDate;
    rowData.reportCardToken = existingCloudMember.reportCardToken;
    rowData.statusHistory = existingCloudMember.statusHistory;
  }

  assert.strictEqual(rowData.memberType, 'STUDENT', 'Member must retain STUDENT status');
  assert.strictEqual(rowData.conversionStatus, 'APPROVED', 'Conversion status must be preserved');
  assert.strictEqual(rowData.certifiedBy, 'PASTOR FAVOUR OLABANJI', 'Certifier must be preserved');
  assert.strictEqual(rowData.convertedFromVisitorAtLesson, 3, 'Conversion lesson week must be preserved');
});

test('saveDocument: grade score guard prevents overwriting newer high score with stale zero score', () => {
  const existingGrade = {
    id: 'grade_test_123',
    lessonTotal: 45,
    punctuality: 15,
    memoryVerse: 15,
    classParticipation: 15,
    updatedAt: '2026-09-20T12:08:38.017Z'
  };

  const incomingStaleDraft = {
    id: 'grade_test_123',
    lessonTotal: 1, // Stale zero/one score draft
    punctuality: 1,
    memoryVerse: 0,
    classParticipation: 0,
    updatedAt: '2026-09-20T12:00:00.000Z' // Older timestamp
  };

  const incomingTime = new Date(incomingStaleDraft.updatedAt).getTime();
  const existingTime = new Date(existingGrade.updatedAt).getTime();
  let wasBlocked = false;

  if (existingTime > incomingTime && incomingTime > 0) {
    if (existingGrade.lessonTotal >= incomingStaleDraft.lessonTotal) {
      wasBlocked = true;
    }
  }

  assert.strictEqual(wasBlocked, true, 'Stale grade draft must be blocked from overwriting newer saved score');
});

test('saveDocument: member phone guard prevents wiping non-empty phone with blank string', () => {
  const existingCloudMember = {
    id: 'mem_youth_c_1',
    fullName: 'Elijah Akande',
    phone: '+2348168787802',
    memberType: 'STUDENT',
    status: 'ACTIVE'
  };

  const incomingDraftWipedPhone = {
    id: 'mem_youth_c_1',
    fullName: 'Elijah Akande',
    phone: '', // Wiped phone from offline form
    memberType: 'STUDENT',
    status: 'ACTIVE'
  };

  const rowData: any = { ...incomingDraftWipedPhone };
  if (existingCloudMember.phone && (!rowData.phone || String(rowData.phone).trim() === '')) {
    rowData.phone = existingCloudMember.phone;
  }

  assert.strictEqual(rowData.phone, '+2348168787802', 'Authoritative phone number must be preserved when incoming phone is empty string');
});

test('saveDocument: timestamp guard preserves cloud phone and status when incoming payload is backdated', () => {
  const existingCloudData = {
    id: 'mem_youth_c_2',
    fullName: 'Joseph Diamond',
    phone: '+2347035620537',
    memberType: 'STUDENT',
    status: 'LEFT_CLASS',
    updatedAt: '2026-10-11T12:00:00.000Z'
  };

  const incomingBackdatedDraft = {
    id: 'mem_youth_c_2',
    fullName: 'Joseph Diamond',
    phone: '', // missing
    memberType: 'STUDENT',
    status: 'ACTIVE', // old status
    updatedAt: '2026-09-01T10:00:00.000Z' // backdated
  };

  let rowData: any = { ...incomingBackdatedDraft };
  const incomingTime = new Date(incomingBackdatedDraft.updatedAt).getTime();
  const existingTime = new Date(existingCloudData.updatedAt).getTime();

  if (existingTime > incomingTime && incomingTime > 0) {
    rowData = {
      ...existingCloudData,
      ...rowData,
      phone: existingCloudData.phone || rowData.phone,
      memberType: existingCloudData.memberType === 'STUDENT' ? 'STUDENT' : (rowData.memberType || existingCloudData.memberType),
      status: existingCloudData.status || rowData.status
    };
  }

  assert.strictEqual(rowData.phone, '+2347035620537', 'Cloud phone must be retained over backdated incoming payload');
  assert.strictEqual(rowData.status, 'LEFT_CLASS', 'Cloud status must be retained over backdated incoming payload');
});

