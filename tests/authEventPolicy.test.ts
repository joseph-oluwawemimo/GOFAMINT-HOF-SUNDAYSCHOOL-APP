import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldResolveProfileForAuthEvent } from '../src/utils/authEventPolicy';

test('token refresh for the current identity keeps the last-good profile mounted', () => {
  assert.equal(shouldResolveProfileForAuthEvent('TOKEN_REFRESHED', 'user-a', 'user-a', null), false);
});

test('a new authenticated identity always resolves its own application profile', () => {
  assert.equal(shouldResolveProfileForAuthEvent('SIGNED_IN', 'user-b', 'user-a', null), true);
  assert.equal(shouldResolveProfileForAuthEvent('TOKEN_REFRESHED', 'user-b', 'user-a', null), true);
});

test('duplicate auth events join the in-flight profile resolution', () => {
  assert.equal(shouldResolveProfileForAuthEvent('INITIAL_SESSION', 'user-a', null, 'user-a'), false);
});

test('explicit user metadata updates revalidate without changing identity', () => {
  assert.equal(shouldResolveProfileForAuthEvent('USER_UPDATED', 'user-a', 'user-a', null), true);
});
