import type { Queryable } from '../db/pool';

/** Every outlet needs exactly one counter row (last_number 0) before it can issue receipts. */
export const insertReceiptCounter = async (db: Queryable, outletId: number): Promise<void> => {
  await db.query('INSERT INTO receipt_counters (outlet_id) VALUES ($1)', [outletId]);
};

/**
 * Takes the next receipt number. The UPDATE row-locks this outlet's counter until the
 * transaction ends, so concurrent sales of one outlet get numbers strictly one after another;
 * a rollback undoes the increment, so failed sales leave no gap. Served by the PK.
 */
export const incrementReceiptCounter = async (db: Queryable, outletId: number): Promise<number> => {
  const { rows } = await db.query<{ last_number: string }>(
    `UPDATE receipt_counters SET last_number = last_number + 1, updated_at = now()
     WHERE outlet_id = $1
     RETURNING last_number`,
    [outletId],
  );
  const lastNumber = rows[0]?.last_number;
  // Invariant: an outlet and its counter are created in one transaction.
  if (lastNumber === undefined) {
    throw new Error(`Receipt counter missing for outlet ${String(outletId)}`);
  }
  return Number(lastNumber);
};
