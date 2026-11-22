import { DatabaseError } from 'pg';

const UNIQUE_VIOLATION = '23505';

/**
 * True when `err` is a unique violation of the named constraint. Lets a service turn a
 * specific duplicate into a meaningful 409 code instead of pre-checking with a SELECT
 * (which would race with a concurrent insert).
 */
export const isUniqueViolation = (err: unknown, constraint: string): boolean =>
  err instanceof DatabaseError && err.code === UNIQUE_VIOLATION && err.constraint === constraint;
