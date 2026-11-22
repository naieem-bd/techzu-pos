import type { Queryable } from '../db/pool';
import type { Pagination } from '../utils/pagination';
import { containsPattern, toCount } from './sql-helpers';

interface OutletMenuItemRow {
  menu_item_id: string;
  sku: string;
  name: string;
  category: string;
  base_price: string;
  is_active: boolean;
  assigned: boolean;
  price_override: string | null;
  effective_price: string | null;
  is_available: boolean | null;
}

/** A master menu item as seen by one outlet. Assignment fields are null when not assigned. */
export interface OutletMenuItem {
  menuItemId: number;
  sku: string;
  name: string;
  category: string;
  basePrice: string;
  isActive: boolean;
  assigned: boolean;
  priceOverride: string | null;
  effectivePrice: string | null;
  isAvailable: boolean | null;
}

export interface NewAssignment {
  outletId: number;
  menuItemId: number;
  priceOverride: string | null;
}

export interface AssignmentChanges {
  /** Distinguishes "not sent" from "sent as null" (= clear the override). */
  priceOverrideProvided: boolean;
  priceOverride: string | null;
  /** null = leave unchanged. */
  isAvailable: boolean | null;
}

export interface OutletMenuFilter {
  search?: string | undefined;
  category?: string | undefined;
  assigned?: boolean | undefined;
}

const toOutletMenuItem = (row: OutletMenuItemRow): OutletMenuItem => ({
  menuItemId: Number(row.menu_item_id),
  sku: row.sku,
  name: row.name,
  category: row.category,
  basePrice: row.base_price,
  isActive: row.is_active,
  assigned: row.assigned,
  priceOverride: row.price_override,
  effectivePrice: row.effective_price,
  isAvailable: row.is_available,
});

// Every master item, LEFT JOINed to this outlet's assignment ($1 = outlet id). The join is
// served by outlet_menu_items_outlet_item_key (outlet_id, menu_item_id). Effective price is
// computed in SQL so money never goes through JS arithmetic.
const OUTLET_MENU_FROM = `
  SELECT mi.id AS menu_item_id, mi.sku, mi.name, mi.category, mi.base_price, mi.is_active,
         omi.id IS NOT NULL AS assigned,
         omi.price_override,
         CASE WHEN omi.id IS NULL THEN NULL
              ELSE COALESCE(omi.price_override, mi.base_price) END AS effective_price,
         omi.is_available
  FROM menu_items mi
  LEFT JOIN outlet_menu_items omi ON omi.menu_item_id = mi.id AND omi.outlet_id = $1`;

export const findOutletMenuItem = async (
  db: Queryable,
  outletId: number,
  menuItemId: number,
): Promise<OutletMenuItem | null> => {
  const { rows } = await db.query<OutletMenuItemRow>(`${OUTLET_MENU_FROM} WHERE mi.id = $2`, [
    outletId,
    menuItemId,
  ]);
  const [row] = rows;
  return row ? toOutletMenuItem(row) : null;
};

// $2 search pattern, $3 category, $4 assigned; each NULL disables its filter.
const FILTER = `($2::text IS NULL OR mi.name ILIKE $2 OR mi.sku ILIKE $2)
  AND ($3::text IS NULL OR mi.category = $3)
  AND ($4::boolean IS NULL OR (omi.id IS NOT NULL) = $4)`;

const filterParams = (outletId: number, filter: OutletMenuFilter): unknown[] => [
  outletId,
  containsPattern(filter.search),
  filter.category ?? null,
  filter.assigned ?? null,
];

export const listOutletMenu = async (
  db: Queryable,
  outletId: number,
  filter: OutletMenuFilter,
  { limit, offset }: Pagination,
): Promise<OutletMenuItem[]> => {
  const { rows } = await db.query<OutletMenuItemRow>(
    `${OUTLET_MENU_FROM} WHERE ${FILTER}
     ORDER BY mi.category, mi.name, mi.id
     LIMIT $5 OFFSET $6`,
    [...filterParams(outletId, filter), limit, offset],
  );
  return rows.map(toOutletMenuItem);
};

export const countOutletMenu = async (
  db: Queryable,
  outletId: number,
  filter: OutletMenuFilter,
): Promise<number> => {
  const { rows } = await db.query<{ total: string }>(
    `SELECT count(*) AS total
     FROM menu_items mi
     LEFT JOIN outlet_menu_items omi ON omi.menu_item_id = mi.id AND omi.outlet_id = $1
     WHERE ${FILTER}`,
    filterParams(outletId, filter),
  );
  return toCount(rows);
};

export const insertAssignment = async (db: Queryable, assignment: NewAssignment): Promise<void> => {
  await db.query(
    `INSERT INTO outlet_menu_items (outlet_id, menu_item_id, price_override)
     VALUES ($1, $2, $3)`,
    [assignment.outletId, assignment.menuItemId, assignment.priceOverride],
  );
};

/** Static SQL; returns false when there is no such assignment. */
export const updateAssignment = async (
  db: Queryable,
  outletId: number,
  menuItemId: number,
  changes: AssignmentChanges,
): Promise<boolean> => {
  const { rowCount } = await db.query(
    `UPDATE outlet_menu_items SET
       price_override = CASE WHEN $3::boolean THEN $4::numeric ELSE price_override END,
       is_available   = COALESCE($5::boolean, is_available)
     WHERE outlet_id = $1 AND menu_item_id = $2`,
    [
      outletId,
      menuItemId,
      changes.priceOverrideProvided,
      changes.priceOverride,
      changes.isAvailable,
    ],
  );
  return rowCount === 1;
};

/** Row-locks the assignment so a concurrent PATCH/DELETE of the same row waits for us. */
export const lockAssignment = async (
  db: Queryable,
  outletId: number,
  menuItemId: number,
): Promise<boolean> => {
  const { rowCount } = await db.query(
    `SELECT 1 FROM outlet_menu_items
     WHERE outlet_id = $1 AND menu_item_id = $2
     FOR UPDATE`,
    [outletId, menuItemId],
  );
  return rowCount === 1;
};

export const deleteAssignment = async (
  db: Queryable,
  outletId: number,
  menuItemId: number,
): Promise<void> => {
  await db.query('DELETE FROM outlet_menu_items WHERE outlet_id = $1 AND menu_item_id = $2', [
    outletId,
    menuItemId,
  ]);
};

interface SaleCandidateRow {
  menu_item_id: string;
  sku: string;
  name: string;
  unit_price: string;
  is_available: boolean;
  is_active: boolean;
}

/** An assigned item requested in a sale, with the price it would sell for right now. */
export interface SaleCandidate {
  menuItemId: number;
  sku: string;
  name: string;
  /** COALESCE(price_override, base_price), as the exact NUMERIC string pg returned. */
  unitPrice: string;
  isAvailable: boolean;
  isActive: boolean;
}

/**
 * ONE query for every line of a sale. Unassigned ids are simply absent from the result, so the
 * caller can tell "not assigned" from "assigned but not sellable". Served by
 * outlet_menu_items_outlet_item_key (outlet_id, menu_item_id); menu_items joins on its PK.
 */
export const findItemsForSale = async (
  db: Queryable,
  outletId: number,
  menuItemIds: readonly number[],
): Promise<SaleCandidate[]> => {
  const { rows } = await db.query<SaleCandidateRow>(
    `SELECT mi.id AS menu_item_id, mi.sku, mi.name,
            COALESCE(omi.price_override, mi.base_price) AS unit_price,
            omi.is_available, mi.is_active
     FROM outlet_menu_items omi
     JOIN menu_items mi ON mi.id = omi.menu_item_id
     WHERE omi.outlet_id = $1 AND omi.menu_item_id = ANY($2::bigint[])
     ORDER BY mi.id
     -- Concurrent PATCH/unassign waits for this sale; order omi -> inventory matches unassign.
     FOR SHARE OF omi`,
    [outletId, menuItemIds],
  );
  return rows.map((row) => ({
    menuItemId: Number(row.menu_item_id),
    sku: row.sku,
    name: row.name,
    unitPrice: row.unit_price,
    isAvailable: row.is_available,
    isActive: row.is_active,
  }));
};

interface SellableMenuItemRow {
  menu_item_id: string;
  sku: string;
  name: string;
  category: string;
  effective_price: string;
  quantity: number;
}

/** What the POS can sell right now: assigned, available at the outlet, active at HQ. */
export interface SellableMenuItem {
  menuItemId: number;
  sku: string;
  name: string;
  category: string;
  effectivePrice: string;
  quantity: number;
}

export interface SellableMenuFilter {
  search?: string | undefined;
  category?: string | undefined;
  /** true = quantity > 0, false = quantity = 0, undefined = no filter. */
  inStock?: boolean | undefined;
}

/**
 * Starts from this outlet's assignments (outlet_menu_items_outlet_item_key serves
 * outlet_id = $1); inner joins drop anything unassigned. $2 search, $3 category, $4 inStock
 * (each NULL disables its filter), $5 row cap.
 */
export const listSellableMenu = async (
  db: Queryable,
  outletId: number,
  filter: SellableMenuFilter,
  maxRows: number,
): Promise<SellableMenuItem[]> => {
  const { rows } = await db.query<SellableMenuItemRow>(
    `SELECT mi.id AS menu_item_id, mi.sku, mi.name, mi.category,
            COALESCE(omi.price_override, mi.base_price) AS effective_price,
            inv.quantity
     FROM outlet_menu_items omi
     JOIN menu_items mi ON mi.id = omi.menu_item_id
     JOIN inventory inv ON inv.outlet_id = omi.outlet_id AND inv.menu_item_id = omi.menu_item_id
     WHERE omi.outlet_id = $1 AND omi.is_available AND mi.is_active
       AND ($2::text IS NULL OR mi.name ILIKE $2 OR mi.sku ILIKE $2)
       AND ($3::text IS NULL OR mi.category = $3)
       AND ($4::boolean IS NULL OR (inv.quantity > 0) = $4)
     ORDER BY mi.category, mi.name, mi.id
     LIMIT $5`,
    [
      outletId,
      containsPattern(filter.search),
      filter.category ?? null,
      filter.inStock ?? null,
      maxRows,
    ],
  );
  return rows.map((row) => ({
    menuItemId: Number(row.menu_item_id),
    sku: row.sku,
    name: row.name,
    category: row.category,
    effectivePrice: row.effective_price,
    quantity: row.quantity,
  }));
};
