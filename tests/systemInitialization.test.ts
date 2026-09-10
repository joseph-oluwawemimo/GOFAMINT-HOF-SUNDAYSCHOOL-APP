import test from 'node:test';
import assert from 'node:assert/strict';
import { hasInitializedSystem } from '../src/utils/systemInitialization';

test('existing central records prevent the first-run wizard even without its config row', () => {
  assert.equal(hasInitializedSystem(false, [0, 1, 0]), true);
  assert.equal(hasInitializedSystem(undefined, [2, 0, 0]), true);
});

test('first-run setup is available only for a positively empty system', () => {
  assert.equal(hasInitializedSystem(false, [0, 0, 0]), false);
  assert.equal(hasInitializedSystem(true, [0, 0, 0]), true);
});
