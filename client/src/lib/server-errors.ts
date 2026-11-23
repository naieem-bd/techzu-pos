import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { isApiError } from '@/api/http';

interface ValidationIssue {
  location: string;
  path: string;
  message: string;
}

const isValidationIssue = (value: unknown): value is ValidationIssue =>
  typeof value === 'object' &&
  value !== null &&
  'path' in value &&
  'message' in value &&
  typeof value.path === 'string' &&
  typeof value.message === 'string';

/**
 * Puts server-side errors next to the form fields they belong to:
 * - 422 VALIDATION_ERROR: each body issue whose path is one of `fields`.
 * - `conflicts`: an error code (e.g. OUTLET_CODE_TAKEN) mapped to the field it is about.
 * Returns true when at least one field error was set.
 */
export const applyServerFieldErrors = <T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
  conflicts: Partial<Record<string, Path<T>>> = {},
): boolean => {
  if (!isApiError(error)) return false;

  const conflictField = conflicts[error.code];
  if (conflictField) {
    setError(conflictField, { type: 'server', message: error.message });
    return true;
  }

  if (error.code !== 'VALIDATION_ERROR' || !Array.isArray(error.details)) return false;
  let applied = false;
  for (const issue of error.details) {
    if (!isValidationIssue(issue) || issue.location !== 'body') continue;
    const field = fields.find((name) => name === issue.path);
    if (!field) continue;
    setError(field, { type: 'server', message: issue.message });
    applied = true;
  }
  return applied;
};
