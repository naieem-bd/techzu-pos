import type { Queryable } from '../db/pool';
import type { Pagination } from '../utils/pagination';
import { toCount } from './sql-helpers';

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

export type StockStatus = 'in_stock' | 'low' | 'out';

interface InventoryRow {
  menu_item_id: string;
  sku: string;
  name: string;
  category: string;
  is_active: boolean;
  is_available: boolean;
  quantity: number;
  status: StockStatus;
  updated_at: Date;
}

/** One stock row of an outlet, with enough item data for a stock-management screen. */
export interface InventoryItem {
  menuItemId: number;
  sku: string;
  name: string;
  category: string;
  isActive: boolean;
  isAvailable: boolean;
  quantity: number;
  status: StockStatus;
  updatedAt: Date;
}

export interface InventoryFilter {
  status?: StockStatus | undefined;
}

const toInventoryItem = (row: InventoryRow): InventoryItem => ({
  menuItemId: Number(row.menu_item_id),
  sku: row.sku,
  name: row.name,
  category: row.category,
  isActive: row.is_active,
  isAvailable: row.is_available,
  quantity: row.quantity,
  status: row.status,
  updatedAt: row.updated_at,
});

// Parameter convention for every inventory query below: $1 = outlet id, $2 = low-stock
// threshold. Status is derived in SQL so the `status` filter and the returned value can
// never disagree.
const STATUS = `CASE WHEN inv.quantity = 0 THEN 'out'
                     WHEN inv.quantity <= $2::integer THEN 'low'
                     ELSE 'in_stock' END`;

const INVENTORY_COLUMNS = `inv.menu_item_id, mi.sku, mi.name, mi.category, mi.is_active,
       omi.is_available, inv.quantity, ${STATUS} AS status, inv.updated_at`;

// The composite join uses outlet_menu_items_outlet_item_key; menu_items joins on its PK.
const INVENTORY_JOINS = `
  JOIN outlet_menu_items omi
    ON omi.outlet_id = inv.outlet_id AND omi.menu_item_id = inv.menu_item_id
  JOIN menu_items mi ON mi.id = inv.menu_item_id`;

// $3 = status; NULL disables the filter. inventory_pkey (outlet_id, ...) serves outlet_id = $1.
const INVENTORY_FILTER = `inv.outlet_id = $1 AND ($3::text IS NULL OR ${STATUS} = $3)`;

export const listInventory = async (
  db: Queryable,
  outletId: number,
  lowStockThreshold: number,
  filter: InventoryFilter,
  { limit, offset }: Pagination,
): Promise<InventoryItem[]> => {
  const { rows } = await db.query<InventoryRow>(
    `SELECT ${INVENTORY_COLUMNS}
     FROM inventory inv ${INVENTORY_JOINS}
     WHERE ${INVENTORY_FILTER}
     ORDER BY mi.category, mi.name, mi.id
     LIMIT $4 OFFSET $5`,
    [outletId, lowStockThreshold, filter.status ?? null, limit, offset],
  );
  return rows.map(toInventoryItem);
};

export const countInventory = async (
  db: Queryable,
  outletId: number,
  lowStockThreshold: number,
  filter: InventoryFilter,
): Promise<number> => {
  const { rows } = await db.query<{ total: string }>(
    `SELECT count(*) AS total FROM inventory inv WHERE ${INVENTORY_FILTER}`,
    [outletId, lowStockThreshold, filter.status ?? null],
  );
  return toCount(rows);
};

/**
 * Atomic stock adjustment: ONE conditional UPDATE, so stock is never read and then written.
 * Concurrent adjustments of the same row serialise on its row lock, and each one re-checks
 * `quantity + adjustment >= 0` against the latest committed value. Returns null when no row
 * was changed (no stock row, or the result would be negative). The CTE shapes the result
 * in the same statement. $3 = menu item id, $4 = adjustment.
 */
export const adjustInventory = async (
  db: Queryable,
  outletId: number,
  lowStockThreshold: number,
  menuItemId: number,
  adjustment: number,
): Promise<InventoryItem | null> => {
  const { rows } = await db.query<InventoryRow>(
    `WITH inv AS (
       UPDATE inventory SET quantity = quantity + $4, updated_at = now()
       WHERE outlet_id = $1 AND menu_item_id = $3 AND quantity + $4 >= 0
       RETURNING outlet_id, menu_item_id, quantity, updated_at
     )
     SELECT ${INVENTORY_COLUMNS}
     FROM inv ${INVENTORY_JOINS}`,
    [outletId, lowStockThreshold, menuItemId, adjustment],
  );
  const [row] = rows;
  return row ? toInventoryItem(row) : null;
};

/**
 * Sale deduction: ONE conditional UPDATE, never read-then-write. The row lock it takes makes
 * concurrent sales of the same item queue up, and each re-checks `quantity >= $3` against the
 * latest committed stock. Returns the new quantity, or null when stock is insufficient (or there
 * is no stock row), in which case nothing changed.
 */
export const deductInventory = async (
  db: Queryable,
  outletId: number,
  menuItemId: number,
  quantity: number,
): Promise<number | null> => {
  const { rows } = await db.query<{ quantity: number }>(
    `UPDATE inventory SET quantity = quantity - $3, updated_at = now()
     WHERE outlet_id = $1 AND menu_item_id = $2 AND quantity >= $3
     RETURNING quantity`,
    [outletId, menuItemId, quantity],
  );
  return rows[0]?.quantity ?? null;
};

/** Diagnostics only (after a refused adjustment); never used to decide a write. */
export const findInventoryQuantity = async (
  db: Queryable,
  outletId: number,
  menuItemId: number,
): Promise<number | null> => {
  const { rows } = await db.query<{ quantity: number }>(
    'SELECT quantity FROM inventory WHERE outlet_id = $1 AND menu_item_id = $2',
    [outletId, menuItemId],
  );
  return rows[0]?.quantity ?? null;
};
