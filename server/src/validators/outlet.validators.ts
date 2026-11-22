import { z } from 'zod';
import { paginationQuery, requiredText, searchQuery } from './common';

export const listOutletsSchemas = {
  query: z
    .object({
      ...paginationQuery,
      search: searchQuery.optional(),
    })
    .strict(),
};

export const createOutletSchemas = {
  body: z
    .object({
      // Mirrors outlets_code_length (2..20); restricted charset keeps codes URL/receipt friendly.
      code: z
        .string()
        .trim()
        .min(2)
        .max(20)
        .regex(/^[A-Za-z0-9_-]+$/, 'may contain only letters, digits, "-" and "_"'),
      name: requiredText(120),
      address: requiredText(500).nullable().optional(),
    })
    .strict(),
};

export type ListOutletsQuery = z.output<typeof listOutletsSchemas.query>;
export type CreateOutletBody = z.output<typeof createOutletSchemas.body>;
