import { z } from 'zod';

/** Express params are always strings: digits only, so "1e3", "-1" or "1.5" are rejected. */
export const idParam = z
  .string()
  .regex(/^\d{1,15}$/, 'must be a positive integer id')
  .transform(Number)
  .refine((id) => id > 0, 'must be a positive integer id');

/** Ids sent in a JSON body arrive as numbers. Capped so they always fit a BIGINT exactly. */
export const idField = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const MAX_PAGE_LIMIT = 100;
export const DEFAULT_PAGE_LIMIT = 20;

export const paginationQuery = {
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
};

// `z.coerce.boolean()` would turn the string "false" into `true`, so parse explicitly.
export const booleanQuery = z
  .enum(['true', 'false'], { message: 'must be "true" or "false"' })
  .transform((value) => value === 'true');

export const searchQuery = z.string().trim().min(1).max(100);

/** Trimmed text that must contain something; mirrors the DB `btrim(x) <> ''` checks. */
export const requiredText = (max: number) => z.string().trim().min(1, 'must not be blank').max(max);

/**
 * Money is accepted only as a decimal string ("4.50"), never a JSON number, so no float ever
 * touches a price. Up to 10 integer digits + 2 decimals = fits NUMERIC(12,2); never negative.
 */
export const moneyString = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, 'must be a non-negative decimal string, e.g. "4.50"');

/** For PATCH bodies: an empty object would be a no-op update, which is almost always a bug. */
export const hasAtLeastOneField = (body: Record<string, unknown>): boolean =>
  Object.values(body).some((value) => value !== undefined);

export const AT_LEAST_ONE_FIELD = { message: 'At least one field must be provided' };
