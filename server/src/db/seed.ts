import type { Pool } from 'pg';
import { logger } from '../utils/logger';
import { closePool, pool } from './pool';
import { withTransaction } from './transaction';

interface SeedOutlet {
  code: string;
  name: string;
  address: string | null;
}

interface SeedMenuItem {
  sku: string;
  name: string;
  category: string;
  basePrice: string;
}

interface SeedAssignment {
  sku: string;
  priceOverride?: string;
  stock: number;
}

// Prices are strings: they go straight into NUMERIC columns, never through JS floats.
const OUTLETS: readonly SeedOutlet[] = [
  { code: 'DT01', name: 'Downtown', address: '12 Market Street, Downtown' },
  { code: 'ML02', name: 'City Mall', address: 'Level 2, City Mall, 88 Ring Road' },
  // Left NULL on purpose: shows the column is optional.
  { code: 'AP03', name: 'Airport', address: null },
];

const MENU_ITEMS: readonly SeedMenuItem[] = [
  { sku: 'COF-ESP', name: 'Espresso', category: 'Coffee', basePrice: '3.00' },
  { sku: 'COF-LAT', name: 'Caffe Latte', category: 'Coffee', basePrice: '4.50' },
  { sku: 'COF-CAP', name: 'Cappuccino', category: 'Coffee', basePrice: '4.25' },
  { sku: 'TEA-GRN', name: 'Green Tea', category: 'Tea', basePrice: '3.25' },
  { sku: 'TEA-CHA', name: 'Masala Chai', category: 'Tea', basePrice: '3.75' },
  { sku: 'TEA-ICE', name: 'Iced Lemon Tea', category: 'Tea', basePrice: '3.50' },
  { sku: 'PAS-CRO', name: 'Butter Croissant', category: 'Pastry', basePrice: '2.75' },
  { sku: 'PAS-MUF', name: 'Blueberry Muffin', category: 'Pastry', basePrice: '3.00' },
  { sku: 'PAS-BRW', name: 'Chocolate Brownie', category: 'Pastry', basePrice: '3.25' },
  { sku: 'SAN-CHK', name: 'Chicken Club Sandwich', category: 'Sandwich', basePrice: '7.50' },
  { sku: 'SAN-TUN', name: 'Tuna Melt', category: 'Sandwich', basePrice: '6.95' },
  { sku: 'SAN-VEG', name: 'Grilled Veggie Panini', category: 'Sandwich', basePrice: '6.50' },
];

const ASSIGNMENTS: Readonly<Record<string, readonly SeedAssignment[]>> = {
  // Downtown: full menu at base price.
  DT01: MENU_ITEMS.map((item) => ({ sku: item.sku, stock: 50 })),
  // City Mall: most items, a couple discounted; brownie deliberately low for 409 demos.
  ML02: [
    { sku: 'COF-ESP', stock: 40 },
    { sku: 'COF-LAT', priceOverride: '4.25', stock: 40 },
    { sku: 'COF-CAP', stock: 40 },
    { sku: 'TEA-GRN', stock: 30 },
    { sku: 'TEA-ICE', priceOverride: '3.25', stock: 30 },
    { sku: 'PAS-CRO', stock: 25 },
    { sku: 'PAS-MUF', stock: 25 },
    { sku: 'PAS-BRW', stock: 2 },
    { sku: 'SAN-CHK', stock: 15 },
    { sku: 'SAN-VEG', stock: 15 },
  ],
  // Airport: smaller menu at premium prices.
  AP03: [
    { sku: 'COF-ESP', priceOverride: '3.75', stock: 60 },
    { sku: 'COF-LAT', priceOverride: '5.50', stock: 60 },
    { sku: 'COF-CAP', priceOverride: '5.25', stock: 60 },
    { sku: 'TEA-CHA', priceOverride: '4.50', stock: 30 },
    { sku: 'PAS-CRO', priceOverride: '3.50', stock: 20 },
    { sku: 'PAS-MUF', stock: 20 },
    { sku: 'SAN-CHK', priceOverride: '9.00', stock: 10 },
    { sku: 'SAN-TUN', priceOverride: '8.50', stock: 10 },
    { sku: 'SAN-VEG', priceOverride: '8.00', stock: 0 },
  ],
};

export interface SeedResult {
  outlets: number;
  menuItems: number;
  assignments: number;
  inventory: number;
}

/**
 * Inserts demo data in one transaction. Idempotent: every insert is keyed on a natural
 * key with ON CONFLICT DO NOTHING, so re-running adds nothing and never resets stock.
 */
export const seedDatabase = (db: Pool): Promise<SeedResult> =>
  withTransaction(async (client) => {
    const result: SeedResult = { outlets: 0, menuItems: 0, assignments: 0, inventory: 0 };

    for (const outlet of OUTLETS) {
      const inserted = await client.query(
        `INSERT INTO outlets (code, name, address) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO NOTHING`,
        [outlet.code, outlet.name, outlet.address],
      );
      result.outlets += inserted.rowCount ?? 0;
      // Every outlet needs its counter row before it can issue receipts.
      await client.query(
        `INSERT INTO receipt_counters (outlet_id)
         SELECT id FROM outlets WHERE code = $1
         ON CONFLICT (outlet_id) DO NOTHING`,
        [outlet.code],
      );
    }

    for (const item of MENU_ITEMS) {
      const inserted = await client.query(
        `INSERT INTO menu_items (sku, name, category, base_price)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (sku) DO NOTHING`,
        [item.sku, item.name, item.category, item.basePrice],
      );
      result.menuItems += inserted.rowCount ?? 0;
    }

    for (const [outletCode, assignments] of Object.entries(ASSIGNMENTS)) {
      for (const assignment of assignments) {
        const assigned = await client.query(
          `INSERT INTO outlet_menu_items (outlet_id, menu_item_id, price_override)
           SELECT o.id, m.id, $3 FROM outlets o, menu_items m
           WHERE o.code = $1 AND m.sku = $2
           ON CONFLICT (outlet_id, menu_item_id) DO NOTHING`,
          [outletCode, assignment.sku, assignment.priceOverride ?? null],
        );
        result.assignments += assigned.rowCount ?? 0;

        const stocked = await client.query(
          `INSERT INTO inventory (outlet_id, menu_item_id, quantity)
           SELECT o.id, m.id, $3 FROM outlets o, menu_items m
           WHERE o.code = $1 AND m.sku = $2
           ON CONFLICT (outlet_id, menu_item_id) DO NOTHING`,
          [outletCode, assignment.sku, assignment.stock],
        );
        result.inventory += stocked.rowCount ?? 0;
      }
    }

    return result;
  }, db);

const main = async (): Promise<void> => {
  try {
    const inserted = await seedDatabase(pool);
    logger.info({ inserted }, 'Seed complete');
  } catch (err) {
    logger.error({ err }, 'Seed failed');
    process.exitCode = 1;
  } finally {
    await closePool();
  }
};

if (require.main === module) {
  void main();
}
