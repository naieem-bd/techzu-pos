/**
 * Builds a "contains" pattern for ILIKE. `%`, `_` and `\` in user input are escaped so a search
 * for "50%" matches literally instead of acting as a wildcard. The result is always bound as a
 * parameter, never concatenated into SQL. Returns null so `$n::text IS NULL` disables the filter.
 */
export const containsPattern = (search: string | undefined): string | null =>
  search === undefined ? null : `%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;

/** count(*) is BIGINT, which pg returns as a string. */
export const toCount = (rows: readonly { total: string }[]): number => Number(rows[0]?.total ?? 0);
