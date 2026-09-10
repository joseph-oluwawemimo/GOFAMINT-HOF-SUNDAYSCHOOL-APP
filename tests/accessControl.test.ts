import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalizeClassId,
  isApprovedClassStatus,
  isExactClassAssignment,
} from '../src/utils/accessControl';

test('class assignment accepts formatting differences but rejects partial IDs', () => {
  assert.equal(canonicalizeClassId(' adult-01 '), 'ADULT01');
  assert.equal(isExactClassAssignment('ADULT-01', 'adult 01'), true);
  assert.equal(isExactClassAssignment('ADULT-01', 'ADULT-010'), false);
  assert.equal(isExactClassAssignment('ADULT-01', 'ADULT'), false);
  assert.equal(isExactClassAssignment('', ''), false);
});

test('class entry requires explicit approved status', () => {
  assert.equal(isApprovedClassStatus('APPROVED'), true);
  assert.equal(isApprovedClassStatus(' approved '), true);
  assert.equal(isApprovedClassStatus(undefined), false);
  assert.equal(isApprovedClassStatus('PENDING_APPROVAL'), false);
});
