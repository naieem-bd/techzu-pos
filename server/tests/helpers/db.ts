import { pool } from '../../src/db/pool';

/** Wipes all data (schema stays) so every test starts from an empty, known state. */
export const truncateAll = async (): Promise<void> => {
  await pool.query(
    `TRUNCATE sale_items, sales, inventory, receipt_counters, outlet_menu_items, menu_items, outlets
     RESTART IDENTITY CASCADE`,
  );
};

const insertId = async (sql: string, params: unknown[]): Promise<number> => {
  const { rows } = await pool.query<{ id: string }>(sql, params);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('insert returned no id');
  return Number(id);
};

/** Direct SQL factories: tests of one endpoint don't depend on another endpoint working. */
export const createOutlet = async (code = 'DT01', name = 'Downtown'): Promise<number> => {
  const id = await insertId('INSERT INTO outlets (code, name) VALUES ($1, $2) RETURNING id', [
    code,
    name,
  ]);
  await pool.query('INSERT INTO receipt_counters (outlet_id) VALUES ($1)', [id]);
  return id;
};

interface MenuItemSeed {
  sku?: string;
  name?: string;
  category?: string;
  basePrice?: string;
  isActive?: boolean;
}

export const createMenuItem = ({
  sku = 'COF-ESP',
  name = 'Espresso',
  category = 'Coffee',
  basePrice = '3.00',
  isActive = true,
}: MenuItemSeed = {}): Promise<number> =>
  insertId(
    `INSERT INTO menu_items (sku, name, category, base_price, is_active)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [sku, name, category, basePrice, isActive],
  );

export const assign = async (
  outletId: number,
  menuItemId: number,
  priceOverride: string | null = null,
): Promise<void> => {
  await pool.query(
    'INSERT INTO outlet_menu_items (outlet_id, menu_item_id, price_override) VALUES ($1, $2, $3)',
    [outletId, menuItemId, priceOverride],
  );
  await pool.query(
    'INSERT INTO inventory (outlet_id, menu_item_id, quantity) VALUES ($1, $2, 10)',
    [outletId, menuItemId],
  );
};

/** Records a one-line sale directly in SQL (the sales endpoint is a later PR). */
export const recordSale = async (outletId: number, menuItemId: number): Promise<void> => {
  const saleId = await insertId(
    `INSERT INTO sales (outlet_id, receipt_number, total_amount) VALUES ($1, 1, 3.00) RETURNING id`,
    [outletId],
  );
  await pool.query(
    `INSERT INTO sale_items (sale_id, menu_item_id, quantity, unit_price, line_total)
     VALUES ($1, $2, 1, 3.00, 3.00)`,
    [saleId, menuItemId],
  );
};

export const countRows = async (
  table: 'receipt_counters' | 'inventory' | 'outlet_menu_items',
  where: string,
  params: unknown[],
): Promise<number> => {
  // `table`/`where` are test-authored constants (typed union), never user input.
  const { rows } = await pool.query<{ total: string }>(
    `SELECT count(*) AS total FROM ${table} WHERE ${where}`,
    params,
  );
  return Number(rows[0]?.total ?? 0);
};
