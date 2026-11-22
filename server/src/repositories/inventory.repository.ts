import type { Queryable } from '../db/pool';

/** New assignments start with zero stock; stock is added later by the outlet. */
export const insertInventory = async (
  db: Queryable,
  outletId: number,
  menuItemId: number,
): Promise<void> => {
  await db.query('INSERT INTO inventory (outlet_id, menu_item_id, quantity) VALUES ($1, $2, 0)', [
    outletId,
    menuItemId,
  ]);
};

/**
 * Row-locks the stock row for the rest of the transaction. Sales take the same row lock when
 * they deduct stock, so this waits for an in-flight sale and blocks new ones until commit.
 */
export const lockInventory = async (
  db: Queryable,
  outletId: number,
  menuItemId: number,
): Promise<void> => {
  await db.query('SELECT 1 FROM inventory WHERE outlet_id = $1 AND menu_item_id = $2 FOR UPDATE', [
    outletId,
    menuItemId,
  ]);
};

export const deleteInventory = async (
  db: Queryable,
  outletId: number,
  menuItemId: number,
): Promise<void> => {
  await db.query('DELETE FROM inventory WHERE outlet_id = $1 AND menu_item_id = $2', [
    outletId,
    menuItemId,
  ]);
};
