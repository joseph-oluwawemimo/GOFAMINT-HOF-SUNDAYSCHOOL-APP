import test from 'node:test';
import assert from 'node:assert/strict';
import { protectPendingCloudChanges } from '../src/utils/cloudOutbox';

test('pending saves win over an older cloud snapshot during hydration', () => {
  const result = protectPendingCloudChanges(
    [{ id: 'member-1', name: 'Old cloud value' }],
    [{ collectionName: 'members', action: 'save', docId: 'member-1', data: { id: 'member-1', name: 'New local value' } }],
    'members'
  );
  assert.deepEqual(result, [{ id: 'member-1', name: 'New local value' }]);
});

test('pending creates survive hydration and pending deletes stay deleted', () => {
  const result = protectPendingCloudChanges(
    [{ id: 'old' }, { id: 'keep' }],
    [
      { collectionName: 'members', action: 'delete', docId: 'old' },
      { collectionName: 'members', action: 'save', docId: 'new', data: { id: 'new' } },
      { collectionName: 'grades', action: 'delete', docId: 'keep' },
    ],
    'members'
  );
  assert.deepEqual(result, [{ id: 'keep' }, { id: 'new' }]);
});
