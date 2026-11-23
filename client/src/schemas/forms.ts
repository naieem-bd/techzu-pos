import { z } from 'zod';
import { MONEY_INPUT_RE } from '@/lib/money';

/**
 * Client-side mirrors of the server's Zod rules (server/src/validators). The server stays the
 * authority; these give instant feedback and keep obviously invalid requests off the wire.
 */

const requiredText = (max: number) =>
  z.string().trim().min(1, 'Required').max(max, `At most ${max.toString()} characters`);

export const moneyField = z
  .string()
  .trim()
  .regex(MONEY_INPUT_RE, 'Enter an amount like 4.50 (max 2 decimals)');

export const createOutletSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'At least 2 characters')
    .max(20, 'At most 20 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Only letters, digits, "-" and "_"'),
  name: requiredText(120),
  // Optional: the dialog omits a blank address from the request instead of sending "".
  address: z.string().trim().max(500, 'At most 500 characters'),
});

export type CreateOutletForm = z.infer<typeof createOutletSchema>;

export const menuItemSchema = z.object({
  sku: requiredText(40),
  name: requiredText(120),
  category: requiredText(60),
  basePrice: moneyField,
  isActive: z.boolean(),
});

export type MenuItemFormInput = z.input<typeof menuItemSchema>;
export type MenuItemFormOutput = z.output<typeof menuItemSchema>;

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date');

export const dateRangeSchema = z
  .object({ fromDate: dateInput, toDate: dateInput })
  // ISO "YYYY-MM-DD" strings compare correctly as text.
  .refine((range) => range.fromDate <= range.toDate, {
    message: '"To" must be on or after "From"',
    path: ['toDate'],
  });

export type DateRangeForm = z.infer<typeof dateRangeSchema>;
