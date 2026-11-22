import { z } from 'zod';
import {
  AT_LEAST_ONE_FIELD,
  booleanQuery,
  hasAtLeastOneField,
  idParam,
  moneyString,
  paginationQuery,
  requiredText,
  searchQuery,
} from './common';

export const listMenuItemsSchemas = {
  query: z
    .object({
      ...paginationQuery,
      search: searchQuery.optional(),
      category: requiredText(60).optional(),
      isActive: booleanQuery.optional(),
    })
    .strict(),
};

export const createMenuItemSchemas = {
  body: z
    .object({
      sku: requiredText(40),
      name: requiredText(120),
      category: requiredText(60),
      basePrice: moneyString,
    })
    .strict(),
};

export const updateMenuItemSchemas = {
  params: z.object({ id: idParam }).strict(),
  // SKU is deliberately not editable: it is the stable business key.
  body: z
    .object({
      name: requiredText(120).optional(),
      category: requiredText(60).optional(),
      basePrice: moneyString.optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine(hasAtLeastOneField, AT_LEAST_ONE_FIELD),
};

export type ListMenuItemsQuery = z.output<typeof listMenuItemsSchemas.query>;
export type CreateMenuItemBody = z.output<typeof createMenuItemSchemas.body>;
export type UpdateMenuItemBody = z.output<typeof updateMenuItemSchemas.body>;
