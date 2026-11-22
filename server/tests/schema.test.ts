import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { config } from '../src/config/env';
import { runMigrations } from '../src/db/migrate';

// The schema was created by globalSetup. Every test runs inside BEGIN ... ROLLBACK so
// nothing persists, and each expected failure is wrapped in a SAVEPOINT so the
// transaction stays usable afterwards.
const testPool = new Pool({ connectionString: config.DATABASE_URL, max: 2 });
let client: PoolClient;

const insertId = async (sql: string, params: unknown[]): Promise<string> => {
  const { rows } = await client.query<{ id: string }>(sql, params);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('insert returned no id');
  return id;
};

const expectViolation = async (
  sql: string,
  params: unknown[],
  expected: { code: string; constraint: string },
): Promise<void> => {
  await client.query('SAVEPOINT expect_violation');
  await expect(client.query(sql, params)).rejects.toMatchObject(expected);
  await client.query('ROLLBACK TO SAVEPOINT expect_violation');
};

let outletId: string;
let itemId: string;

beforeEach(async () => {
  client = await testPool.connect();
  await client.query('BEGIN');
  outletId = await insertId(
    `INSERT INTO outlets (code, name) VALUES ('T01', 'Test Outlet') RETURNING id`,
    [],
  );
  itemId = await insertId(
    `INSERT INTO menu_items (sku, name, category, base_price)
     VALUES ('T-SKU', 'Test Item', 'Test', 1.00) RETURNING id`,
    [],
  );
});

afterEach(async () => {
  await client.query('ROLLBACK');
  client.release();
});

afterAll(async () => {
  await testPool.end();
});

describe('schema constraints', () => {
  it('rejects negative stock on insert and on update', async () => {
    await client.query('INSERT INTO outlet_menu_items (outlet_id, menu_item_id) VALUES ($1, $2)', [
      outletId,
      itemId,
    ]);
    const violation = { code: '23514', constraint: 'inventory_quantity_non_negative' };

    await expectViolation(
      'INSERT INTO inventory (outlet_id, menu_item_id, quantity) VALUES ($1, $2, -1)',
      [outletId, itemId],
      violation,
    );

    await client.query(
      'INSERT INTO inventory (outlet_id, menu_item_id, quantity) VALUES ($1, $2, 3)',
      [outletId, itemId],
    );
    await expectViolation(
      'UPDATE inventory SET quantity = quantity - 4 WHERE outlet_id = $1 AND menu_item_id = $2',
      [outletId, itemId],
      violation,
    );
  });

  it('rejects a duplicate (outlet_id, receipt_number)', async () => {
    const insertSale =
      'INSERT INTO sales (outlet_id, receipt_number, total_amount) VALUES ($1, 1, 10.00)';
    await client.query(insertSale, [outletId]);

    await expectViolation(insertSale, [outletId], {
      code: '23505',
      constraint: 'sales_outlet_receipt_number_key',
    });
  });

  it('rejects assigning the same item to the same outlet twice', async () => {
    const assign = 'INSERT INTO outlet_menu_items (outlet_id, menu_item_id) VALUES ($1, $2)';
    await client.query(assign, [outletId, itemId]);

    await expectViolation(assign, [outletId, itemId], {
      code: '23505',
      constraint: 'outlet_menu_items_outlet_item_key',
    });
  });

  it('rejects inventory for an item not assigned to the outlet', async () => {
    await expectViolation(
      'INSERT INTO inventory (outlet_id, menu_item_id, quantity) VALUES ($1, $2, 5)',
      [outletId, itemId],
      { code: '23503', constraint: 'inventory_outlet_menu_item_fkey' },
    );
  });

  it('rejects a sale line whose line_total does not equal unit_price * quantity', async () => {
    const saleId = await insertId(
      `INSERT INTO sales (outlet_id, receipt_number, total_amount)
       VALUES ($1, 1, 3.00) RETURNING id`,
      [outletId],
    );

    await expectViolation(
      `INSERT INTO sale_items (sale_id, menu_item_id, quantity, unit_price, line_total)
       VALUES ($1, $2, 3, 1.00, 2.99)`,
      [saleId, itemId],
      { code: '23514', constraint: 'sale_items_line_total_matches' },
    );
  });
});

describe('runMigrations()', () => {
  it('is idempotent: a second run applies nothing', async () => {
    await expect(runMigrations(testPool)).resolves.toEqual([]);
  });
});
