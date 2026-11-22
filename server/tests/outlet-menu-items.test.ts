import request from 'supertest';
import { createApp } from '../src/app';
import { closePool, pool } from '../src/db/pool';
import {
  assign,
  countRows,
  createMenuItem,
  createOutlet,
  recordSale,
  truncateAll,
} from './helpers/db';
import { dataOf, errorOf, errorPaths, metaOf } from './helpers/http';

// Requires the test database: `docker compose up -d db_test`.
const app = createApp();

interface OutletMenuItemDto {
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

let outletId: number;
let espressoId: number;
let latteId: number;

const menuPath = (outlet: number = outletId): string => `/api/outlets/${String(outlet)}/menu-items`;
const itemPath = (item: number, outlet: number = outletId): string =>
  `${menuPath(outlet)}/${String(item)}`;

beforeEach(async () => {
  await truncateAll();
  outletId = await createOutlet('DT01');
  espressoId = await createMenuItem({ sku: 'COF-ESP', name: 'Espresso', basePrice: '3.00' });
  latteId = await createMenuItem({ sku: 'COF-LAT', name: 'Caffe Latte', basePrice: '4.50' });
});

afterAll(async () => {
  await closePool();
});

describe('POST /api/outlets/:outletId/menu-items', () => {
  it('assigns an item (201) with an override and creates inventory with quantity 0', async () => {
    const res = await request(app)
      .post(menuPath())
      .send({ menuItemId: latteId, priceOverride: '4.25' });

    expect(res.status).toBe(201);
    expect(dataOf<OutletMenuItemDto>(res.body)).toEqual({
      menuItemId: latteId,
      sku: 'COF-LAT',
      name: 'Caffe Latte',
      category: 'Coffee',
      basePrice: '4.50',
      isActive: true,
      assigned: true,
      priceOverride: '4.25',
      effectivePrice: '4.25',
      isAvailable: true,
    });

    const { rows } = await pool.query<{ quantity: number }>(
      'SELECT quantity FROM inventory WHERE outlet_id = $1 AND menu_item_id = $2',
      [outletId, latteId],
    );
    expect(rows).toEqual([{ quantity: 0 }]);
  });

  it('uses the base price when no override is given', async () => {
    const res = await request(app).post(menuPath()).send({ menuItemId: espressoId });

    expect(res.status).toBe(201);
    expect(dataOf<OutletMenuItemDto>(res.body)).toMatchObject({
      priceOverride: null,
      effectivePrice: '3.00',
    });
  });

  it('returns 409 ALREADY_ASSIGNED on a duplicate assignment', async () => {
    await assign(outletId, espressoId);

    const res = await request(app).post(menuPath()).send({ menuItemId: espressoId });

    expect(res.status).toBe(409);
    expect(errorOf(res.body).code).toBe('ALREADY_ASSIGNED');
  });

  it('returns 404 OUTLET_NOT_FOUND for an unknown outlet', async () => {
    const res = await request(app).post(menuPath(999999)).send({ menuItemId: espressoId });

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('OUTLET_NOT_FOUND');
  });

  it('returns 404 MENU_ITEM_NOT_FOUND and creates nothing for an unknown item', async () => {
    const res = await request(app).post(menuPath()).send({ menuItemId: 999999 });

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('MENU_ITEM_NOT_FOUND');
    expect(await countRows('outlet_menu_items', 'true', [])).toBe(0);
  });

  it('returns 422 MENU_ITEM_INACTIVE for an inactive item', async () => {
    const retiredId = await createMenuItem({ sku: 'OLD', isActive: false });

    const res = await request(app).post(menuPath()).send({ menuItemId: retiredId });

    expect(res.status).toBe(422);
    expect(errorOf(res.body).code).toBe('MENU_ITEM_INACTIVE');
  });

  it('returns 422 for invalid body: string id, bad money, unknown field', async () => {
    const res = await request(app)
      .post(menuPath())
      .send({ menuItemId: '1', priceOverride: '1.999', stock: 5 });

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toEqual(
      expect.arrayContaining(['body.menuItemId', 'body.priceOverride', 'body.stock']),
    );
  });

  it('returns 422 for a non-numeric outletId', async () => {
    const res = await request(app)
      .post('/api/outlets/abc/menu-items')
      .send({ menuItemId: espressoId });

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toEqual(['params.outletId']);
  });
});

describe('GET /api/outlets/:outletId/menu-items', () => {
  beforeEach(async () => {
    await assign(outletId, latteId, '4.25');
    // Another outlet's assignment must not leak into this outlet's view.
    const otherOutlet = await createOutlet('ML02', 'City Mall');
    await assign(otherOutlet, espressoId, '9.99');
  });

  it('returns every master item with assignment flag, override and effective price', async () => {
    const res = await request(app).get(menuPath());

    expect(res.status).toBe(200);
    expect(dataOf<OutletMenuItemDto[]>(res.body)).toEqual([
      expect.objectContaining({
        menuItemId: latteId,
        assigned: true,
        basePrice: '4.50',
        priceOverride: '4.25',
        effectivePrice: '4.25',
        isAvailable: true,
      }),
      expect.objectContaining({
        menuItemId: espressoId,
        assigned: false,
        priceOverride: null,
        effectivePrice: null,
        isAvailable: null,
      }),
    ]);
    expect(metaOf(res.body)).toEqual({ total: 2, limit: 20, offset: 0 });
  });

  it('filters by assigned and search', async () => {
    const assigned = await request(app).get(`${menuPath()}?assigned=true`);
    const unassigned = await request(app).get(`${menuPath()}?assigned=false`);
    const search = await request(app).get(`${menuPath()}?search=espr`);

    const ids = (body: unknown): number[] =>
      dataOf<OutletMenuItemDto[]>(body).map((i) => i.menuItemId);
    expect(ids(assigned.body)).toEqual([latteId]);
    expect(ids(unassigned.body)).toEqual([espressoId]);
    expect(ids(search.body)).toEqual([espressoId]);
    expect(metaOf(assigned.body).total).toBe(1);
  });

  it('returns 404 OUTLET_NOT_FOUND for an unknown outlet', async () => {
    const res = await request(app).get(menuPath(999999));

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('OUTLET_NOT_FOUND');
  });

  it('returns 422 for invalid query params', async () => {
    const res = await request(app).get(`${menuPath()}?assigned=1&limit=500`);

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toEqual(expect.arrayContaining(['query.assigned', 'query.limit']));
  });
});

describe('PATCH /api/outlets/:outletId/menu-items/:menuItemId', () => {
  beforeEach(async () => {
    await assign(outletId, latteId, '4.25');
  });

  it('changes only availability, keeping the override', async () => {
    const res = await request(app).patch(itemPath(latteId)).send({ isAvailable: false });

    expect(res.status).toBe(200);
    expect(dataOf<OutletMenuItemDto>(res.body)).toMatchObject({
      isAvailable: false,
      priceOverride: '4.25',
      effectivePrice: '4.25',
    });
  });

  it('sets a new override', async () => {
    const res = await request(app).patch(itemPath(latteId)).send({ priceOverride: '5' });

    expect(res.status).toBe(200);
    expect(dataOf<OutletMenuItemDto>(res.body)).toMatchObject({
      priceOverride: '5.00',
      effectivePrice: '5.00',
      isAvailable: true,
    });
  });

  it('clears the override with null so the base price applies', async () => {
    const res = await request(app).patch(itemPath(latteId)).send({ priceOverride: null });

    expect(res.status).toBe(200);
    expect(dataOf<OutletMenuItemDto>(res.body)).toMatchObject({
      priceOverride: null,
      effectivePrice: '4.50',
    });
  });

  it('returns 404 ASSIGNMENT_NOT_FOUND for an item not assigned to the outlet', async () => {
    const res = await request(app).patch(itemPath(espressoId)).send({ isAvailable: false });

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('ASSIGNMENT_NOT_FOUND');
  });

  it('returns 404 OUTLET_NOT_FOUND for an unknown outlet', async () => {
    const res = await request(app).patch(itemPath(latteId, 999999)).send({ isAvailable: false });

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('OUTLET_NOT_FOUND');
  });

  it('returns 422 for an empty body or wrong types', async () => {
    const empty = await request(app).patch(itemPath(latteId)).send({});
    const wrong = await request(app)
      .patch(itemPath(latteId))
      .send({ isAvailable: 'no', priceOverride: 4 });

    expect(empty.status).toBe(422);
    expect(wrong.status).toBe(422);
    expect(errorPaths(wrong.body)).toEqual(
      expect.arrayContaining(['body.isAvailable', 'body.priceOverride']),
    );
  });
});

describe('DELETE /api/outlets/:outletId/menu-items/:menuItemId', () => {
  beforeEach(async () => {
    await assign(outletId, latteId);
  });

  it('unassigns (204) and removes both the assignment and its inventory row', async () => {
    const res = await request(app).delete(itemPath(latteId));

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    const where = 'outlet_id = $1 AND menu_item_id = $2';
    expect(await countRows('outlet_menu_items', where, [outletId, latteId])).toBe(0);
    expect(await countRows('inventory', where, [outletId, latteId])).toBe(0);
  });

  it('returns 409 HAS_SALES_HISTORY and keeps everything when the item was sold here', async () => {
    await recordSale(outletId, latteId);

    const res = await request(app).delete(itemPath(latteId));

    expect(res.status).toBe(409);
    expect(errorOf(res.body).code).toBe('HAS_SALES_HISTORY');
    const where = 'outlet_id = $1 AND menu_item_id = $2';
    expect(await countRows('outlet_menu_items', where, [outletId, latteId])).toBe(1);
    expect(await countRows('inventory', where, [outletId, latteId])).toBe(1);
  });

  it('allows unassigning when the item was only sold at a different outlet', async () => {
    const otherOutlet = await createOutlet('ML02', 'City Mall');
    await assign(otherOutlet, latteId);
    await recordSale(otherOutlet, latteId);

    const res = await request(app).delete(itemPath(latteId));

    expect(res.status).toBe(204);
  });

  it('returns 404 ASSIGNMENT_NOT_FOUND when the item is not assigned', async () => {
    const res = await request(app).delete(itemPath(espressoId));

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('ASSIGNMENT_NOT_FOUND');
  });

  it('returns 404 OUTLET_NOT_FOUND for an unknown outlet', async () => {
    const res = await request(app).delete(itemPath(latteId, 999999));

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('OUTLET_NOT_FOUND');
  });

  it('returns 422 for non-numeric ids', async () => {
    const res = await request(app).delete('/api/outlets/x/menu-items/y');

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toEqual(
      expect.arrayContaining(['params.outletId', 'params.menuItemId']),
    );
  });
});
