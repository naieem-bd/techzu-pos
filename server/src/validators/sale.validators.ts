import { z } from 'zod';
import { idField, idParam, paginationQuery } from './common';

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

/** Full ISO 8601 datetime with `Z` or an offset, so the instant is never timezone-ambiguous. */
const isoDateTime = z.iso
  .datetime({ offset: true, message: 'must be an ISO 8601 datetime with timezone' })
  .transform((value) => new Date(value));

export const listSalesSchemas = {
  params: outletParams,
  query: z
    .object({
      ...paginationQuery,
      from: isoDateTime.optional(),
      to: isoDateTime.optional(),
      receiptNumber: idParam.optional(),
    })
    .strict()
    .refine(({ from, to }) => from === undefined || to === undefined || from < to, {
      message: 'must be after "from"',
      path: ['to'],
    }),
};

export const getSaleSchemas = {
  params: z.object({ outletId: idParam, saleId: idParam }).strict(),
};

export type CreateSaleBody = z.output<typeof createSaleSchemas.body>;
export type SaleLineInput = z.output<typeof saleLine>;
export type ListSalesQuery = z.output<typeof listSalesSchemas.query>;
