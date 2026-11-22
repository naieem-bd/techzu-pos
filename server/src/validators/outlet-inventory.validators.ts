import { z } from 'zod';
import { booleanQuery, idParam, paginationQuery, requiredText, searchQuery } from './common';

const outletParams = z.object({ outletId: idParam }).strict();

export const MAX_STOCK_ADJUSTMENT = 10_000;

export const listSellableMenuSchemas = {
  params: outletParams,
  query: z
    .object({
      search: searchQuery.optional(),
      category: requiredText(60).optional(),
      inStock: booleanQuery.optional(),
    })
    .strict(),
};

export const listInventorySchemas = {
  params: outletParams,
  query: z
    .object({
      ...paginationQuery,
      status: z.enum(['in_stock', 'low', 'out']).optional(),
    })
    .strict(),
};

export const adjustInventorySchemas = {
  params: z.object({ outletId: idParam, menuItemId: idParam }).strict(),
  body: z
    .object({
      // Signed delta: positive = stock received, negative = waste/correction.
      adjustment: z
        .number()
        .int()
        .min(-MAX_STOCK_ADJUSTMENT)
        .max(MAX_STOCK_ADJUSTMENT)
        .refine((value) => value !== 0, 'must not be zero'),
    })
    .strict(),
};

export type ListSellableMenuQuery = z.output<typeof listSellableMenuSchemas.query>;
export type ListInventoryQuery = z.output<typeof listInventorySchemas.query>;
export type AdjustInventoryBody = z.output<typeof adjustInventorySchemas.body>;
