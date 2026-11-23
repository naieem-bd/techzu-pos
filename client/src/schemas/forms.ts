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

/** Mirrors MAX_STOCK_ADJUSTMENT in server/src/validators/outlet-inventory.validators.ts. */
export const MAX_STOCK_ADJUSTMENT = 10_000;

/** "+20" adds, "-3" removes, "20" adds. Parsed to the signed integer the PATCH body wants. */
export const stockAdjustmentSchema = z.object({
  adjustment: z
    .string()
    .trim()
    .regex(/^[+-]?\d{1,5}$/, 'Enter a whole number like +20 or -3')
    .transform(Number)
    .refine((value) => value !== 0, 'Must not be zero')
    .refine(
      (value) => Math.abs(value) <= MAX_STOCK_ADJUSTMENT,
      `At most ${MAX_STOCK_ADJUSTMENT.toLocaleString('en-US')} per adjustment`,
    ),
});

export type StockAdjustmentInput = z.input<typeof stockAdjustmentSchema>;
export type StockAdjustmentOutput = z.output<typeof stockAdjustmentSchema>;

// Optional outlet-code prefix (letters, digits, "-", "_") then the receipt number's digits.
const RECEIPT_RE = /^(?:[A-Za-z0-9_-]+-)?(\d{1,15})$/;

/** "GUL-000124" or "124" -> 124; blank or anything else -> undefined. */
export const parseReceiptNumber = (value: string): number | undefined => {
  const digits = RECEIPT_RE.exec(value.trim())?.[1];
  if (!digits) return undefined;
  const receiptNumber = Number(digits);
  return receiptNumber > 0 ? receiptNumber : undefined;
};

export const salesFilterSchema = dateRangeSchema.and(
  z.object({
    receipt: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || parseReceiptNumber(value) !== undefined,
        'Enter a receipt like GUL-000124 or 124',
      ),
  }),
);

export type SalesFilterForm = z.infer<typeof salesFilterSchema>;
