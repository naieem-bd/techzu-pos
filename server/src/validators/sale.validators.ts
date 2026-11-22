import { z } from 'zod';
import {
  DATE_RANGE_ERROR,
  dateRangeQuery,
  idField,
  idParam,
  isValidDateRange,
  paginationQuery,
} from './common';

export const MAX_SALE_LINES = 50;
export const MAX_LINE_QUANTITY = 999;

const outletParams = z.object({ outletId: idParam }).strict();

// Nested objects need their own .strict(); `validate` only forces it on the top level.
const saleLine = z
  .object({
    menuItemId: idField,
    quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
  })
  .strict();

export const createSaleSchemas = {
  params: outletParams,
  body: z
    .object({
      items: z.array(saleLine).min(1).max(MAX_SALE_LINES),
    })
    .strict(),
};

export const listSalesSchemas = {
  params: outletParams,
  query: z
    .object({
      ...paginationQuery,
      ...dateRangeQuery,
      receiptNumber: idParam.optional(),
    })
    .strict()
    .refine(isValidDateRange, DATE_RANGE_ERROR),
};

export const getSaleSchemas = {
  params: z.object({ outletId: idParam, saleId: idParam }).strict(),
};

export type CreateSaleBody = z.output<typeof createSaleSchemas.body>;
export type SaleLineInput = z.output<typeof saleLine>;
export type ListSalesQuery = z.output<typeof listSalesSchemas.query>;
