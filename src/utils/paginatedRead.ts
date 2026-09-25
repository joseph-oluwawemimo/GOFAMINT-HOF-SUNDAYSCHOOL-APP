export interface PaginatedReadPage<T> {
  rows: T[];
  totalCount?: number | null;
}

export interface PaginatedReadOptions<T> {
  pageSize?: number;
  getId?: (row: T) => string | undefined;
  label?: string;
}

/**
 * Collect every page from an authoritative data source and fail loudly when
 * the source reports a count that the returned pages do not satisfy.
 *
 * Stable ordering is the responsibility of fetchPage. Supabase callers order
 * by the primary key before applying range pagination.
 */
export async function collectAllPages<T>(
  fetchPage: (from: number, to: number, pageIndex: number) => Promise<PaginatedReadPage<T>>,
  options: PaginatedReadOptions<T> = {}
): Promise<T[]> {
  const pageSize = options.pageSize ?? 500;
  const getId = options.getId;
  const label = options.label ?? 'paginated read';

  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error(`${label} requires a positive integer page size.`);
  }

  const rows: T[] = [];
  const seenIds = new Set<string>();
  let expectedCount: number | null | undefined;
  let pageIndex = 0;

  while (true) {
    const from = pageIndex * pageSize;
    const page = await fetchPage(from, from + pageSize - 1, pageIndex);

    if (!page || !Array.isArray(page.rows)) {
      throw new Error(`${label} returned an invalid page at offset ${from}.`);
    }

    if (pageIndex === 0) {
      expectedCount = page.totalCount;
      if (expectedCount !== null && expectedCount !== undefined && (!Number.isInteger(expectedCount) || expectedCount < 0)) {
        throw new Error(`${label} returned an invalid total count (${String(expectedCount)}).`);
      }
    }

    for (const row of page.rows) {
      const id = getId?.(row);
      if (id) {
        if (seenIds.has(id)) {
          throw new Error(`${label} returned duplicate id ${id}; the dataset changed during pagination.`);
        }
        seenIds.add(id);
      }
      rows.push(row);
    }

    if (page.rows.length > pageSize) {
      throw new Error(`${label} returned ${page.rows.length} rows for a ${pageSize}-row page.`);
    }

    const reachedExpectedCount = expectedCount !== null && expectedCount !== undefined && rows.length >= expectedCount;
    if (page.rows.length < pageSize || reachedExpectedCount) break;

    pageIndex += 1;
  }

  if (expectedCount !== null && expectedCount !== undefined && rows.length !== expectedCount) {
    throw new Error(`${label} was incomplete: expected ${expectedCount} rows but received ${rows.length}.`);
  }

  return rows;
}
