import request from 'supertest';
import { createApp } from '../src/app';
import { closePool } from '../src/db/pool';
import {
  assign,
  createMenuItem,
  createOutlet,
  getStock,
  setAvailability,
  setStock,
  truncateAll,
} from './helpers/db';
import { dataOf, errorOf, errorPaths, metaOf } from './helpers/http';

// Requires the test database: `docker compose up -d db_test`.
const app = createApp();

interface SellableMenuItemDto {
  menuItemId: number;
  sku: string;
  name: string;
  category: string;
  effectivePrice: string;
  quantity: number;
}

interface InventoryItemDto {
  menuItemId: number;
  sku: string;
  name: string;
  category: string;
  isActive: boolean;
  isAvailable: boolean;
  quantity: number;
  status: 'in_stock' | 'low' | 'out';
  updatedAt: string;
}

const INT_MAX = 2_147_483_647;

let outletId: number;
let otherOutletId: number;
let espressoId: number;
let latteId: number;
let croissantId: number;
let muffinId: number;
let retiredId: number;
let teaId: number;

const menuPath = (outlet: number = outletId): string => `/api/outlets/${String(outlet)}/menu`;
const inventoryPath = (outlet: number = outletId): string =>
  `/api/outlets/${String(outlet)}/inventory`;
const stockPath = (item: number, outlet: number = outletId): string =>
  `${inventoryPath(outlet)}/${String(item)}`;

const ids = (body: unknown): number[] =>
  dataOf<{ menuItemId: number }[]>(body).map((item) => item.menuItemId);

/*
 * Outlet DT01:
 *   Coffee  Caffe Latte    override 4.25, stock 0  -> sellable, out
 *   Coffee  Espresso       base 3.00,     stock 10 -> sellable, in_stock
 *   Coffee  Retired Blend  HQ-inactive,   stock 10 -> hidden from /menu
 *   Pastry  Croissant      base 2.50,     stock 5  -> sellable, low (boundary)
 *   Pastry  Muffin         unavailable,   stock 6  -> hidden from /menu, in_stock (boundary)
 * Tea is only assigned to another outlet.
 */
beforeEach(async () => {
  await truncateAll();
  outletId = await createOutlet('DT01');
  otherOutletId = await createOutlet('ML02', 'City Mall');

  espressoId = await createMenuItem({ sku: 'COF-ESP', name: 'Espresso', basePrice: '3.00' });
  latteId = await createMenuItem({ sku: 'COF-LAT', name: 'Caffe Latte', basePrice: '4.50' });
  retiredId = await createMenuItem({ sku: 'COF-OLD', name: 'Retired Blend', isActive: false });
  croissantId = await createMenuItem({
    sku: 'PAS-CRO',
    name: 'Croissant',
    category: 'Pastry',
    basePrice: '2.50',
  });
  muffinId = await createMenuItem({ sku: 'PAS-MUF', name: 'Muffin', category: 'Pastry' });
  teaId = await createMenuItem({ sku: 'TEA-GRN', name: 'Green Tea', category: 'Tea' });

  await assign(outletId, espressoId);
  await assign(outletId, latteId, '4.25');
  await setStock(outletId, latteId, 0);
  // The SQL helper bypasses the "only active items can be assigned" rule on purpose: an item
  // deactivated at HQ after assignment is exactly the state under test.
  await assign(outletId, retiredId);
  await assign(outletId, croissantId);
  await setStock(outletId, croissantId, 5);
  await assign(outletId, muffinId);
  await setStock(outletId, muffinId, 6);
  await setAvailability(outletId, muffinId, false);

  await assign(otherOutletId, teaId, '9.99');
  await assign(otherOutletId, espressoId, '7.77');
});

afterAll(async () => {
  await closePool();
});

describe('GET /api/outlets/:outletId/menu', () => {
  it('returns only sellable items with effective price and stock, ordered by category, name', async () => {
    const res = await request(app).get(menuPath());

    expect(res.status).toBe(200);
    expect(dataOf<SellableMenuItemDto[]>(res.body)).toEqual([
      {
        menuItemId: latteId,
        sku: 'COF-LAT',
        name: 'Caffe Latte',
        category: 'Coffee',
        effectivePrice: '4.25',
        quantity: 0,
      },
      {
        menuItemId: espressoId,
        sku: 'COF-ESP',
        name: 'Espresso',
        category: 'Coffee',
        effectivePrice: '3.00',
        quantity: 10,
      },
      {
        menuItemId: croissantId,
        sku: 'PAS-CRO',
        name: 'Croissant',
        category: 'Pastry',
        effectivePrice: '2.50',
        quantity: 5,
      },
    ]);
    expect(res.body).not.toHaveProperty('meta');
  });

  it("never shows another outlet's items or prices", async () => {
    const res = await request(app).get(menuPath());

    expect(ids(res.body)).not.toContain(teaId);
    const espresso = dataOf<SellableMenuItemDto[]>(res.body).find(
      (i) => i.menuItemId === espressoId,
    );
    expect(espresso?.effectivePrice).toBe('3.00');

    const other = await request(app).get(menuPath(otherOutletId));
    expect(ids(other.body).sort()).toEqual([espressoId, teaId].sort());
  });

  it('hides an inactive master item and an unavailable assignment', async () => {
    const res = await request(app).get(menuPath());

    expect(ids(res.body)).not.toContain(retiredId);
    expect(ids(res.body)).not.toContain(muffinId);
  });

  it('inStock=true returns only items with stock; inStock=false only out-of-stock items', async () => {
    const inStock = await request(app).get(`${menuPath()}?inStock=true`);
    const outOfStock = await request(app).get(`${menuPath()}?inStock=false`);

    expect(ids(inStock.body)).toEqual([espressoId, croissantId]);
    expect(ids(outOfStock.body)).toEqual([latteId]);
  });

  it('filters by category and by search on name or SKU', async () => {
    const pastry = await request(app).get(`${menuPath()}?category=Pastry`);
    const byName = await request(app).get(`${menuPath()}?search=latte`);
    const bySku = await request(app).get(`${menuPath()}?search=cof-esp`);

    expect(ids(pastry.body)).toEqual([croissantId]);
    expect(ids(byName.body)).toEqual([latteId]);
    expect(ids(bySku.body)).toEqual([espressoId]);
  });

  it('returns 404 OUTLET_NOT_FOUND for an unknown outlet', async () => {
    const res = await request(app).get(menuPath(999999));

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('OUTLET_NOT_FOUND');
  });

  it('returns 422 for invalid query params (bad boolean, unknown field)', async () => {
    const res = await request(app).get(`${menuPath()}?inStock=yes&limit=10`);

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toEqual(expect.arrayContaining(['query.inStock', 'query.limit']));
  });
});

describe('GET /api/outlets/:outletId/inventory', () => {
  it('lists every assigned item, including ones hidden from /menu, with status', async () => {
    const res = await request(app).get(inventoryPath());

    expect(res.status).toBe(200);
    const items = dataOf<InventoryItemDto[]>(res.body);
    expect(items.map((i) => [i.menuItemId, i.quantity, i.status])).toEqual([
      [latteId, 0, 'out'],
      [espressoId, 10, 'in_stock'],
      [retiredId, 10, 'in_stock'],
      [croissantId, 5, 'low'],
      [muffinId, 6, 'in_stock'],
    ]);
    expect(items.find((i) => i.menuItemId === retiredId)).toMatchObject({ isActive: false });
    expect(items.find((i) => i.menuItemId === muffinId)).toMatchObject({ isAvailable: false });
    expect(typeof items[0]?.updatedAt).toBe('string');
    expect(metaOf(res.body)).toEqual({ total: 5, limit: 20, offset: 0 });
  });

  it("never lists another outlet's items", async () => {
    const res = await request(app).get(inventoryPath());

    expect(ids(res.body)).not.toContain(teaId);
  });

  it('filters by status with a matching total', async () => {
    const low = await request(app).get(`${inventoryPath()}?status=low`);
    const out = await request(app).get(`${inventoryPath()}?status=out`);
    const inStock = await request(app).get(`${inventoryPath()}?status=in_stock`);

    expect(ids(low.body)).toEqual([croissantId]);
    expect(ids(out.body)).toEqual([latteId]);
    expect(ids(inStock.body)).toEqual([espressoId, retiredId, muffinId]);
    expect(metaOf(inStock.body).total).toBe(3);
  });

  it('paginates', async () => {
    const res = await request(app).get(`${inventoryPath()}?limit=2&offset=2`);

    expect(ids(res.body)).toEqual([retiredId, croissantId]);
    expect(metaOf(res.body)).toEqual({ total: 5, limit: 2, offset: 2 });
  });

  it('returns 404 OUTLET_NOT_FOUND for an unknown outlet', async () => {
    const res = await request(app).get(inventoryPath(999999));

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('OUTLET_NOT_FOUND');
  });

  it('returns 422 for an unknown status or limit above 100', async () => {
    const res = await request(app).get(`${inventoryPath()}?status=empty&limit=101`);

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toEqual(expect.arrayContaining(['query.status', 'query.limit']));
  });
});

describe('PATCH /api/outlets/:outletId/inventory/:menuItemId', () => {
  it('adjusts stock up and returns the updated inventory row', async () => {
    const res = await request(app).patch(stockPath(croissantId)).send({ adjustment: 20 });

    expect(res.status).toBe(200);
    expect(dataOf<InventoryItemDto>(res.body)).toEqual({
      menuItemId: croissantId,
      sku: 'PAS-CRO',
      name: 'Croissant',
      category: 'Pastry',
      isActive: true,
      isAvailable: true,
      quantity: 25,
      status: 'in_stock',
      updatedAt: expect.any(String) as unknown,
    });
    expect(await getStock(outletId, croissantId)).toBe(25);
  });

  it('adjusts stock down to exactly 0', async () => {
    const res = await request(app).patch(stockPath(espressoId)).send({ adjustment: -10 });

    expect(res.status).toBe(200);
    expect(dataOf<InventoryItemDto>(res.body)).toMatchObject({ quantity: 0, status: 'out' });
    expect(await getStock(outletId, espressoId)).toBe(0);
  });

  it('returns 409 INSUFFICIENT_STOCK with the current quantity and leaves stock unchanged', async () => {
    const res = await request(app).patch(stockPath(espressoId)).send({ adjustment: -11 });

    expect(res.status).toBe(409);
    expect(errorOf(res.body)).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      details: { menuItemId: espressoId, currentQuantity: 10, adjustment: -11 },
    });
    expect(await getStock(outletId, espressoId)).toBe(10);
  });

  it('only touches the given outlet', async () => {
    await request(app).patch(stockPath(espressoId)).send({ adjustment: -3 });

    expect(await getStock(otherOutletId, espressoId)).toBe(10);
  });

  it('returns 404 ASSIGNMENT_NOT_FOUND for an item not assigned to the outlet', async () => {
    const res = await request(app).patch(stockPath(teaId)).send({ adjustment: 5 });

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('ASSIGNMENT_NOT_FOUND');
  });

  it('returns 404 OUTLET_NOT_FOUND for an unknown outlet', async () => {
    const res = await request(app).patch(stockPath(espressoId, 999999)).send({ adjustment: 5 });

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('OUTLET_NOT_FOUND');
  });

  it.each([
    ['zero', { adjustment: 0 }, 'body.adjustment'],
    ['a float', { adjustment: 1.5 }, 'body.adjustment'],
    ['above the max', { adjustment: 10_001 }, 'body.adjustment'],
    ['below the min', { adjustment: -10_001 }, 'body.adjustment'],
    ['a string', { adjustment: '5' }, 'body.adjustment'],
    ['missing', {}, 'body.adjustment'],
    ['an unknown field', { adjustment: 5, quantity: 50 }, 'body.quantity'],
  ])('returns 422 when adjustment is %s', async (_label, body, path) => {
    const res = await request(app).patch(stockPath(espressoId)).send(body);

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toContain(path);
    expect(await getStock(outletId, espressoId)).toBe(10);
  });

  it('returns 422 for non-numeric ids', async () => {
    const res = await request(app).patch('/api/outlets/x/inventory/y').send({ adjustment: 1 });

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toEqual(
      expect.arrayContaining(['params.outletId', 'params.menuItemId']),
    );
  });

  it('maps an INTEGER overflow (PG 22003) to 422 VALUE_OUT_OF_RANGE without leaking SQL', async () => {
    await setStock(outletId, espressoId, INT_MAX - 5);

    const res = await request(app).patch(stockPath(espressoId)).send({ adjustment: 10 });

    expect(res.status).toBe(422);
    expect(errorOf(res.body)).toEqual({
      code: 'VALUE_OUT_OF_RANGE',
      message: 'A value is outside the allowed range',
    });
    expect(await getStock(outletId, espressoId)).toBe(INT_MAX - 5);
  });

  it('two concurrent -5 adjustments on stock 8: exactly one succeeds, final stock 3', async () => {
    await setStock(outletId, espressoId, 8);

    const responses = await Promise.all([
      request(app).patch(stockPath(espressoId)).send({ adjustment: -5 }),
      request(app).patch(stockPath(espressoId)).send({ adjustment: -5 }),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const failed = responses.find((r) => r.status === 409);
    expect(errorOf(failed?.body).code).toBe('INSUFFICIENT_STOCK');
    expect(await getStock(outletId, espressoId)).toBe(3);
  });
});
