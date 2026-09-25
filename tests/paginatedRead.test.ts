import test from 'node:test';
import assert from 'node:assert/strict';
import { collectAllPages } from '../src/utils/paginatedRead';

test('paginated reads return every record beyond the Supabase single-response limit', async () => {
  const source = Array.from({ length: 2_205 }, (_, index) => ({ id: `row-${String(index).padStart(4, '0')}` }));
  const result = await collectAllPages(
    async (from, to, pageIndex) => ({
      rows: source.slice(from, to + 1),
      totalCount: pageIndex === 0 ? source.length : undefined,
    }),
    { pageSize: 500, getId: row => row.id, label: 'test records' }
  );

  assert.equal(result.length, source.length);
  assert.equal(result.at(-1)?.id, source.at(-1)?.id);
});

test('paginated reads fail loudly when the authoritative count is incomplete', async () => {
  await assert.rejects(
    collectAllPages(
      async (_from, _to, pageIndex) => ({
        rows: pageIndex === 0 ? [{ id: 'one' }] : [],
        totalCount: pageIndex === 0 ? 2 : undefined,
      }),
      { pageSize: 500, getId: row => row.id, label: 'incomplete records' }
    ),
    /expected 2 rows but received 1/
  );
});

test('paginated reads reject duplicate ids caused by a changing dataset', async () => {
  await assert.rejects(
    collectAllPages(
      async (_from, _to, pageIndex) => ({
        rows: pageIndex === 0 ? [{ id: 'one' }, { id: 'two' }] : [{ id: 'two' }],
        totalCount: pageIndex === 0 ? 3 : undefined,
      }),
      { pageSize: 2, getId: row => row.id, label: 'changing records' }
    ),
    /duplicate id two/
  );
});
