import type { Queryable } from '../db/pool';
import type { Pagination } from '../utils/pagination';
import { containsPattern, toCount } from './sql-helpers';

interface MenuItemRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  base_price: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MenuItem {
  id: number;
  sku: string;
  name: string;
  category: string;
  /** NUMERIC(12,2) as a string, e.g. "4.50". */
  basePrice: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewMenuItem {
  sku: string;
  name: string;
  category: string;
  basePrice: string;
}

/** null = leave the column unchanged. */
export interface MenuItemChanges {
  name: string | null;
  category: string | null;
  basePrice: string | null;
  isActive: boolean | null;
}

export interface MenuItemFilter {
  search?: string | undefined;
  category?: string | undefined;
  isActive?: boolean | undefined;
}

const COLUMNS = 'id, sku, name, category, base_price, is_active, created_at, updated_at';

const toMenuItem = (row: MenuItemRow): MenuItem => ({
  id: Number(row.id),
  sku: row.sku,
  name: row.name,
  category: row.category,
  basePrice: row.base_price,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const insertMenuItem = async (db: Queryable, item: NewMenuItem): Promise<MenuItem> => {
  const { rows } = await db.query<MenuItemRow>(
    `INSERT INTO menu_items (sku, name, category, base_price)
     VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
    [item.sku, item.name, item.category, item.basePrice],
  );
  const [row] = rows;
  if (!row) throw new Error('INSERT menu_items returned no row');
  return toMenuItem(row);
};

export const findMenuItemById = async (db: Queryable, id: number): Promise<MenuItem | null> => {
  const { rows } = await db.query<MenuItemRow>(`SELECT ${COLUMNS} FROM menu_items WHERE id = $1`, [
    id,
  ]);
  const [row] = rows;
  return row ? toMenuItem(row) : null;
};

/** Static SQL: COALESCE keeps the current value when a field is not sent (all columns NOT NULL). */
export const updateMenuItem = async (
  db: Queryable,
  id: number,
  changes: MenuItemChanges,
): Promise<MenuItem | null> => {
  const { rows } = await db.query<MenuItemRow>(
    `UPDATE menu_items SET
       name       = COALESCE($2, name),
       category   = COALESCE($3, category),
       base_price = COALESCE($4::numeric, base_price),
       is_active  = COALESCE($5::boolean, is_active)
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, changes.name, changes.category, changes.basePrice, changes.isActive],
  );
  const [row] = rows;
  return row ? toMenuItem(row) : null;
};

// $1 search pattern, $2 category, $3 isActive; each NULL disables its filter.
const FILTER = `($1::text IS NULL OR name ILIKE $1 OR sku ILIKE $1)
  AND ($2::text IS NULL OR category = $2)
  AND ($3::boolean IS NULL OR is_active = $3)`;

const filterParams = (filter: MenuItemFilter): unknown[] => [
  containsPattern(filter.search),
  filter.category ?? null,
  filter.isActive ?? null,
];

export const listMenuItems = async (
  db: Queryable,
  filter: MenuItemFilter,
  { limit, offset }: Pagination,
): Promise<MenuItem[]> => {
  const { rows } = await db.query<MenuItemRow>(
    `SELECT ${COLUMNS} FROM menu_items WHERE ${FILTER}
     ORDER BY category, name, id
     LIMIT $4 OFFSET $5`,
    [...filterParams(filter), limit, offset],
  );
  return rows.map(toMenuItem);
};

export const countMenuItems = async (db: Queryable, filter: MenuItemFilter): Promise<number> => {
  const { rows } = await db.query<{ total: string }>(
    `SELECT count(*) AS total FROM menu_items WHERE ${FILTER}`,
    filterParams(filter),
  );
  return toCount(rows);
};
