import request from 'supertest';
import { createApp } from '../src/app';
import { closePool } from '../src/db/pool';
import {
  assign,
  createMenuItem,
  createOutlet,
  setSaleCreatedAt,
  setStock,
  truncateAll,
} from './helpers/db';
import { dataOf, errorOf, errorPaths } from './helpers/http';

// Requires the test database: `docker compose up -d db_test`.
const app = createApp();

interface OutletRevenueDto {
  outletId: number;
  code: string;
  name: string;
  saleCount: number;
  totalRevenue: string;
  averageTicket: string;
}

interface RevenueMeta {
  grandTotal: string;
  totalSales: number;
}

interface TopItemDto {
  menuItemId: number;
  sku: string;
  name: string;
  quantitySold: number;
  revenue: string;
}

interface Line {
  menuItemId: number;
  quantity: number;
}

const REVENUE_PATH = '/api/reports/revenue-by-outlet';
const topItemsPath = (outletId: number): string =>
  `/api/reports/outlets/${String(outletId)}/top-items`;

/** Sales are created through the real API, so reports are checked against real receipts. */
const sell = async (outletId: number, items: Line[]): Promise<number> => {
  const res = await request(app)
    .post(`/api/outlets/${String(outletId)}/sales`)
    .send({ items });
  expect(res.status).toBe(201);
  return dataOf<{ id: number }>(res.body).id;
};

const getRevenue = async (query = ''): Promise<{ data: OutletRevenueDto[]; meta: RevenueMeta }> => {
  const res = await request(app).get(`${REVENUE_PATH}${query}`);
  expect(res.status).toBe(200);
  return res.body as { data: OutletRevenueDto[]; meta: RevenueMeta };
};

const getTopItems = async (outletId: number, query = ''): Promise<TopItemDto[]> => {
  const res = await request(app).get(`${topItemsPath(outletId)}${query}`);
  expect(res.status).toBe(200);
  return dataOf<TopItemDto[]>(res.body);
};

/** Compact [name, quantitySold, revenue] tuples: easy to read expected orderings. */
const summary = (items: TopItemDto[]): [string, number, string][] =>
  items.map((item) => [item.name, item.quantitySold, item.revenue]);

let downtownId: number;
let mallId: number;
let airportId: number;
let beachId: number;
let espressoId: number;
let latteId: number;
let croissantId: number;
let shotId: number;
let syrupId: number;

/*
 * DT01 Downtown: Espresso 3.00, Caffe Latte 4.50 (override 4.25), Croissant 2.50
 * ML02 City Mall: Espresso 3.00, Extra Shot 0.10, Vanilla Syrup 0.20
 * AP03 Airport, BC04 Beach: no items, never any sales
 */
beforeEach(async () => {
  await truncateAll();
  downtownId = await createOutlet('DT01', 'Downtown');
  mallId = await createOutlet('ML02', 'City Mall');
  airportId = await createOutlet('AP03', 'Airport');
  beachId = await createOutlet('BC04', 'Beach');

  espressoId = await createMenuItem({ sku: 'COF-ESP', name: 'Espresso', basePrice: '3.00' });
  latteId = await createMenuItem({ sku: 'COF-LAT', name: 'Caffe Latte', basePrice: '4.50' });
  croissantId = await createMenuItem({
    sku: 'PAS-CRO',
    name: 'Croissant',
    category: 'Pastry',
    basePrice: '2.50',
  });
  shotId = await createMenuItem({ sku: 'ADD-SHOT', name: 'Extra Shot', basePrice: '0.10' });
  syrupId = await createMenuItem({ sku: 'ADD-VAN', name: 'Vanilla Syrup', basePrice: '0.20' });

  await assign(downtownId, espressoId);
  await assign(downtownId, latteId, '4.25');
  await assign(downtownId, croissantId);
  await assign(mallId, espressoId);
  await assign(mallId, shotId);
  await assign(mallId, syrupId);
});

afterAll(async () => {
  await closePool();
});

describe('GET /api/reports/revenue-by-outlet', () => {
  it('sums revenue per outlet in SQL, includes zero-sales outlets and orders by revenue', async () => {
    await sell(downtownId, [{ menuItemId: espressoId, quantity: 2 }]); // 6.00
    await sell(downtownId, [
      { menuItemId: latteId, quantity: 1 },
      { menuItemId: croissantId, quantity: 1 },
    ]); // 6.75
    await sell(mallId, [
      { menuItemId: shotId, quantity: 1 },
      { menuItemId: syrupId, quantity: 1 },
    ]); // 0.10 + 0.20: would be 0.30000000000000004 in JS floats

    const { data, meta } = await getRevenue();

    expect(data).toEqual([
      {
        outletId: downtownId,
        code: 'DT01',
        name: 'Downtown',
        saleCount: 2,
        totalRevenue: '12.75',
        averageTicket: '6.38', // 6.375 rounded in SQL
      },
      {
        outletId: mallId,
        code: 'ML02',
        name: 'City Mall',
        saleCount: 1,
        totalRevenue: '0.30',
        averageTicket: '0.30',
      },
      // Equal (zero) revenue: ordered by name.
      {
        outletId: airportId,
        code: 'AP03',
        name: 'Airport',
        saleCount: 0,
        totalRevenue: '0.00',
        averageTicket: '0.00',
      },
      {
        outletId: beachId,
        code: 'BC04',
        name: 'Beach',
        saleCount: 0,
        totalRevenue: '0.00',
        averageTicket: '0.00',
      },
    ]);
    expect(meta).toEqual({ grandTotal: '13.05', totalSales: 3 });
  });

  it('reports every outlet at 0.00 when there are no sales', async () => {
    const { data, meta } = await getRevenue();

    // All tie at 0.00, so name order: Airport, Beach, City Mall, Downtown.
    expect(
      data.map((row) => [row.code, row.saleCount, row.totalRevenue, row.averageTicket]),
    ).toEqual([
      ['AP03', 0, '0.00', '0.00'],
      ['BC04', 0, '0.00', '0.00'],
      ['ML02', 0, '0.00', '0.00'],
      ['DT01', 0, '0.00', '0.00'],
    ]);
    expect(meta).toEqual({ grandTotal: '0.00', totalSales: 0 });
  });

  it('returns an empty list and zero totals when no outlets exist', async () => {
    await truncateAll();

    const { data, meta } = await getRevenue();

    expect(data).toEqual([]);
    expect(meta).toEqual({ grandTotal: '0.00', totalSales: 0 });
  });

  it('filters by from (inclusive) and to (exclusive) without dropping outlets', async () => {
    const atFrom = await sell(downtownId, [{ menuItemId: espressoId, quantity: 1 }]); // 3.00
    const inside = await sell(downtownId, [{ menuItemId: latteId, quantity: 1 }]); // 4.25
    const atTo = await sell(downtownId, [{ menuItemId: croissantId, quantity: 1 }]); // 2.50
    await sell(mallId, [{ menuItemId: espressoId, quantity: 1 }]); // now: outside the range
    await setSaleCreatedAt(atFrom, '2026-10-01T00:00:00Z');
    await setSaleCreatedAt(inside, '2026-10-15T12:00:00Z');
    await setSaleCreatedAt(atTo, '2026-11-01T00:00:00Z');

    const { data, meta } = await getRevenue('?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z');

    expect(data.map((row) => [row.code, row.saleCount, row.totalRevenue])).toEqual([
      ['DT01', 2, '7.25'],
      ['AP03', 0, '0.00'],
      ['BC04', 0, '0.00'],
      ['ML02', 0, '0.00'], // has a sale, but not in the range: still listed
    ]);
    expect(meta).toEqual({ grandTotal: '7.25', totalSales: 2 });

    // An offset is honoured: 2026-10-31T00:00:00-01:00 = 2026-10-31T01:00:00Z.
    const fromOnly = await getRevenue('?from=2026-10-31T00:00:00-01:00');
    expect(fromOnly.meta).toEqual({ grandTotal: '5.50', totalSales: 2 }); // atTo + mall sale
  });

  it('returns 422 for bad dates, from >= to and unknown params', async () => {
    const bad = await request(app).get(`${REVENUE_PATH}?from=yesterday&to=2026-11-01&page=2`);
    expect(bad.status).toBe(422);
    expect(errorOf(bad.body).code).toBe('VALIDATION_ERROR');
    expect(errorPaths(bad.body)).toEqual(
      expect.arrayContaining(['query.from', 'query.to', 'query.page']),
    );

    const inverted = await request(app).get(
      `${REVENUE_PATH}?from=2026-11-01T00:00:00Z&to=2026-11-01T00:00:00Z`,
    );
    expect(inverted.status).toBe(422);
    expect(errorPaths(inverted.body)).toEqual(['query.to']);
  });
});

describe('GET /api/reports/outlets/:outletId/top-items', () => {
  let appleId: number;
  let zebraId: number;
  let muffinId: number;
  let lateSaleId: number;

  /*
   * Downtown sells (over three sales):
   *   Espresso 3 = 9.00 | Caffe Latte 2 = 8.50 | Croissant 2 = 5.00
   *   Apple Pie 1 = 2.50 | Zebra Cake 1 = 2.50 | Muffin 1 = 1.00
   * City Mall sells Espresso 5, which must never appear in Downtown's report.
   */
  beforeEach(async () => {
    appleId = await createMenuItem({ sku: 'PAS-APL', name: 'Apple Pie', basePrice: '2.50' });
    zebraId = await createMenuItem({ sku: 'PAS-ZEB', name: 'Zebra Cake', basePrice: '2.50' });
    muffinId = await createMenuItem({ sku: 'PAS-MUF', name: 'Muffin', basePrice: '1.00' });
    await assign(downtownId, appleId);
    await assign(downtownId, zebraId);
    await assign(downtownId, muffinId);

    await sell(downtownId, [
      { menuItemId: espressoId, quantity: 2 },
      { menuItemId: latteId, quantity: 1 },
    ]);
    await sell(downtownId, [
      { menuItemId: espressoId, quantity: 1 },
      { menuItemId: latteId, quantity: 1 },
      { menuItemId: croissantId, quantity: 2 },
      { menuItemId: appleId, quantity: 1 },
    ]);
    lateSaleId = await sell(downtownId, [
      { menuItemId: zebraId, quantity: 1 },
      { menuItemId: muffinId, quantity: 1 },
    ]);
    await setStock(mallId, espressoId, 10);
    await sell(mallId, [{ menuItemId: espressoId, quantity: 5 }]);
  });

  it('ranks by quantity, then revenue, then name; default limit 5', async () => {
    const items = await getTopItems(downtownId);

    expect(items[0]).toEqual({
      menuItemId: espressoId,
      sku: 'COF-ESP',
      name: 'Espresso',
      quantitySold: 3, // summed across two sales; City Mall's 5 excluded
      revenue: '9.00',
    });
    expect(summary(items)).toEqual([
      ['Espresso', 3, '9.00'],
      ['Caffe Latte', 2, '8.50'], // ties Croissant on quantity, wins on revenue (override price)
      ['Croissant', 2, '5.00'],
      ['Apple Pie', 1, '2.50'], // ties Zebra Cake on quantity AND revenue: name decides
      ['Zebra Cake', 1, '2.50'],
    ]); // Muffin (6th) cut by the default limit
  });

  it('honours limit', async () => {
    expect(summary(await getTopItems(downtownId, '?limit=2'))).toEqual([
      ['Espresso', 3, '9.00'],
      ['Caffe Latte', 2, '8.50'],
    ]);
    expect(await getTopItems(downtownId, '?limit=20')).toHaveLength(6);
  });

  it('filters by from (inclusive) and to (exclusive)', async () => {
    await setSaleCreatedAt(lateSaleId, '2026-10-01T00:00:00Z');

    expect(
      summary(await getTopItems(downtownId, '?from=2026-10-01T00:00:00Z&to=2026-10-02T00:00:00Z')),
    ).toEqual([
      ['Zebra Cake', 1, '2.50'],
      ['Muffin', 1, '1.00'],
    ]);
    expect(await getTopItems(downtownId, '?to=2026-10-01T00:00:00Z')).toEqual([]);
  });

  it('returns [] for an outlet with no sales', async () => {
    expect(await getTopItems(airportId)).toEqual([]);
  });

  it('returns 404 for an unknown outlet', async () => {
    const res = await request(app).get(topItemsPath(999_999));

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('OUTLET_NOT_FOUND');
  });

  it.each([
    ['limit=0', 'query.limit'],
    ['limit=21', 'query.limit'],
    ['limit=abc', 'query.limit'],
    ['limit=2.5', 'query.limit'],
    ['from=2026-10-01', 'query.from'],
    ['from=2026-10-02T00:00:00Z&to=2026-10-01T00:00:00Z', 'query.to'],
    ['sort=name', 'query.sort'],
  ])('returns 422 for ?%s', async (query, path) => {
    const res = await request(app).get(`${topItemsPath(downtownId)}?${query}`);

    expect(res.status).toBe(422);
    expect(errorOf(res.body).code).toBe('VALIDATION_ERROR');
    expect(errorPaths(res.body)).toEqual([path]);
  });

  it('returns 422 for a non-numeric outletId', async () => {
    const res = await request(app).get('/api/reports/outlets/abc/top-items');

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toEqual(['params.outletId']);
  });
});
