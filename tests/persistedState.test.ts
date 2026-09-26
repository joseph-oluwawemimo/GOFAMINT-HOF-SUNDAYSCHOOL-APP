import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePersistedValue } from '../src/hooks/usePersistedState';

const isWorkersTab = (value: unknown): value is string =>
  typeof value === 'string' && ['DASHBOARD', 'DIRECTORY'].includes(value);

test('persisted state reads the current JSON format', () => {
  assert.equal(decodePersistedValue('"DIRECTORY"', false, isWorkersTab), 'DIRECTORY');
});

test('persisted state migrates a validated legacy raw-string value', () => {
  assert.equal(decodePersistedValue('DIRECTORY', true, isWorkersTab), 'DIRECTORY');
});

test('persisted state rejects raw strings for current keys', () => {
  assert.throws(() => decodePersistedValue('DIRECTORY', false, isWorkersTab));
});

test('persisted state rejects an invalid legacy value', () => {
  assert.throws(
    () => decodePersistedValue('NOT_A_REAL_TAB', true, isWorkersTab),
    /expected state shape/
  );
});
