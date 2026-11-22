import type { Queryable } from '../db/pool';

/** Every outlet needs exactly one counter row (last_number 0) before it can issue receipts. */
export const insertReceiptCounter = async (db: Queryable, outletId: number): Promise<void> => {
  await db.query('INSERT INTO receipt_counters (outlet_id) VALUES ($1)', [outletId]);
};
