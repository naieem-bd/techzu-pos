import { z } from 'zod';
import {
  AT_LEAST_ONE_FIELD,
  booleanQuery,
  hasAtLeastOneField,
  idField,
  idParam,
  moneyString,
  paginationQuery,
  requiredText,
  searchQuery,
} from './common';

const outletParams = z.object({ outletId: idParam }).strict();
const assignmentParams = z.object({ outletId: idParam, menuItemId: idParam }).strict();

export const listOutletMenuSchemas = {
  params: outletParams,
  query: z
    .object({
      ...paginationQuery,
      search: searchQuery.optional(),
      category: requiredText(60).optional(),
      assigned: booleanQuery.optional(),
    })
    .strict(),
};

export const assignMenuItemSchemas = {
  params: outletParams,
  body: z
    .object({
      menuItemId: idField,
      priceOverride: moneyString.nullable().optional(),
    })
    .strict(),
};

export const updateAssignmentSchemas = {
  params: assignmentParams,
  body: z
    .object({
      // null clears the override (outlet falls back to the HQ base price).
      priceOverride: moneyString.nullable().optional(),
      isAvailable: z.boolean().optional(),
    })
    .strict()
    .refine(hasAtLeastOneField, AT_LEAST_ONE_FIELD),
};

export const unassignMenuItemSchemas = {
  params: assignmentParams,
};

export type ListOutletMenuQuery = z.output<typeof listOutletMenuSchemas.query>;
export type AssignMenuItemBody = z.output<typeof assignMenuItemSchemas.body>;
export type UpdateAssignmentBody = z.output<typeof updateAssignmentSchemas.body>;
