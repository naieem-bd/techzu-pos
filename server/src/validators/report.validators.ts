import { z } from 'zod';
import { DATE_RANGE_ERROR, dateRangeQuery, idParam, isValidDateRange } from './common';

export const MAX_TOP_ITEMS = 20;
export const DEFAULT_TOP_ITEMS = 5;

export const revenueByOutletSchemas = {
  query: z.object(dateRangeQuery).strict().refine(isValidDateRange, DATE_RANGE_ERROR),
};

export const topItemsSchemas = {
  params: z.object({ outletId: idParam }).strict(),
  query: z
    .object({
      ...dateRangeQuery,
      limit: z.coerce.number().int().min(1).max(MAX_TOP_ITEMS).default(DEFAULT_TOP_ITEMS),
    })
    .strict()
    .refine(isValidDateRange, DATE_RANGE_ERROR),
};
