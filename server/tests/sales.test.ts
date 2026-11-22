import request from 'supertest';
import { createApp } from '../src/app';
import { closePool } from '../src/db/pool';
import { mergeSaleLines } from '../src/services/sale.service';
import { AppError } from '../src/utils/app-error';
import {
  assign,
  countRows,
  createMenuItem,
  createOutlet,
  getReceiptCounter,
  getStock,
  setActive,
  setAvailability,
  setBasePrice,
  setPriceOverride,
  setSaleCreatedAt,
  setStock,
  truncateAll,
} from './helpers/db';
import { dataOf, errorOf, errorPaths, metaOf } from './helpers/http';

// Requires the test database: `docker compose up -d db_test`.
const app = createApp();

interface SaleItemDto {
  menuItemId: number;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

interface SaleDto {
  id: number;
  outletId: number;
  receiptNumber: number;
  receiptNo: string;
  totalAmount: string;
  createdAt: string;
  items: SaleItemDto[];
}

let outletId: number;
let otherOutletId: number;
let espressoId: number;
let latteId: number;
let croissantId: number;
let muffinId: number;
let retiredId: number;
let teaId: number;

const salesPath = (outlet: number = outletId): string => `/api/outlets/${String(outlet)}/sales`;
const salePath = (sale: number, outlet: number = outletId): string =>
  `${salesPath(outlet)}/${String(sale)}`;

interface Line {
  menuItemId: number;
  quantity: number;
}
const sell = (items: Line[], outlet: number = outletId) =>
  request(app).post(salesPath(outlet)).send({ items });

const sellOk = async (items: Line[], outlet: number = outletId): Promise<SaleDto> => {
  const res = await sell(items, outlet);
  expect(res.status).toBe(201);
  return dataOf<SaleDto>(res.body);
};

/*
 * Outlet DT01:
 *   Espresso       base 3.00                   stock 10
 *   Caffe Latte    base 4.50, override 4.25    stock 10
 *   Croissant      base 2.50                   stock 2
 *   Muffin         unavailable at the outlet   stock 10
 *   Retired Blend  inactive at HQ              stock 10
 * Green Tea is assigned only to ML02 (which also sells Espresso at 7.77).
 */
beforeEach(async () => {
  await truncateAll();
  outletId = await createOutlet('DT01');
  otherOutletId = await createOutlet('ML02', 'City Mall');

  espressoId = await createMenuItem({ sku: 'COF-ESP', name: 'Espresso', basePrice: '3.00' });
  latteId = await createMenuItem({ sku: 'COF-LAT', name: 'Caffe Latte', basePrice: '4.50' });
  croissantId = await createMenuItem({
    sku: 'PAS-CRO',
    name: 'Croissant',
    category: 'Pastry',
    basePrice: '2.50',
  });
  muffinId = await createMenuItem({ sku: 'PAS-MUF', name: 'Muffin', category: 'Pastry' });
  retiredId = await createMenuItem({ sku: 'COF-OLD', name: 'Retired Blend' });
  teaId = await createMenuItem({ sku: 'TEA-GRN', name: 'Green Tea', category: 'Tea' });

  await assign(outletId, espressoId);
  await assign(outletId, latteId, '4.25');
  await assign(outletId, croissantId);
  await setStock(outletId, croissantId, 2);
  await assign(outletId, muffinId);
  await setAvailability(outletId, muffinId, false);
  // Deactivated after assignment: exactly the state an outlet can end up in.
  await assign(outletId, retiredId);
  await setActive(retiredId, false);

  await assign(otherOutletId, teaId);
  await assign(otherOutletId, espressoId, '7.77');
});

afterAll(async () => {
  await closePool();
});

describe('POST /api/outlets/:outletId/sales', () => {
  it('creates a sale: 201 receipt, prices as strings, stock deducted, receipt 1 then 2', async () => {
    const res = await sell([
      { menuItemId: latteId, quantity: 1 },
      { menuItemId: espressoId, quantity: 2 },
    ]);

    expect(res.status).toBe(201);
    const sale = dataOf<SaleDto>(res.body);
    expect(sale).toEqual({
      id: expect.any(Number) as unknown,
      outletId,
      receiptNumber: 1,
      receiptNo: 'DT01-000001',
      totalAmount: '10.25',
      createdAt: expect.any(String) as unknown,
      items: [
        {
          menuItemId: espressoId,
          sku: 'COF-ESP',
          name: 'Espresso',
          quantity: 2,
          unitPrice: '3.00',
          lineTotal: '6.00',
        },
        {
          menuItemId: latteId,
          sku: 'COF-LAT',
          name: 'Caffe Latte',
          quantity: 1,
          unitPrice: '4.25',
          lineTotal: '4.25',
        },
      ],
    });
    expect(await getStock(outletId, espressoId)).toBe(8);
    expect(await getStock(outletId, latteId)).toBe(9);
    expect(await countRows('sale_items', 'sale_id = $1', [sale.id])).toBe(2);

    const second = await sellOk([{ menuItemId: espressoId, quantity: 1 }]);
    expect(second.receiptNumber).toBe(2);
    expect(second.receiptNo).toBe('DT01-000002');
    expect(await getReceiptCounter(outletId)).toBe(2);
  });

  it('numbers receipts per outlet independently', async () => {
    await sellOk([{ menuItemId: espressoId, quantity: 1 }]);
    const other = await sellOk([{ menuItemId: espressoId, quantity: 1 }], otherOutletId);

    expect(other.receiptNo).toBe('ML02-000001');
    expect(other.totalAmount).toBe('7.77');
    expect(await getStock(otherOutletId, espressoId)).toBe(9);
  });

  it('allows selling the exact remaining stock down to 0', async () => {
    await sellOk([{ menuItemId: croissantId, quantity: 2 }]);

    expect(await getStock(outletId, croissantId)).toBe(0);
  });

  it('merges duplicate lines into one sale_items row', async () => {
    const sale = await sellOk([
      { menuItemId: espressoId, quantity: 2 },
      { menuItemId: latteId, quantity: 1 },
      { menuItemId: espressoId, quantity: 3 },
    ]);

    expect(sale.items.map((i) => [i.menuItemId, i.quantity, i.lineTotal])).toEqual([
      [espressoId, 5, '15.00'],
      [latteId, 1, '4.25'],
    ]);
    expect(sale.totalAmount).toBe('19.25');
    expect(await countRows('sale_items', 'sale_id = $1', [sale.id])).toBe(2);
    expect(await getStock(outletId, espressoId)).toBe(5);
  });

  it('returns 422 when merged duplicate lines exceed 999 (each line valid on its own)', async () => {
    const res = await sell([
      { menuItemId: espressoId, quantity: 600 },
      { menuItemId: espressoId, quantity: 600 },
    ]);

    expect(res.status).toBe(422);
    expect(errorOf(res.body).code).toBe('VALIDATION_ERROR');
    expect(errorPaths(res.body)).toEqual(['body.items']);
    expect(await getReceiptCounter(outletId)).toBe(0);
  });

  it('409 on the SECOND line rolls back the first line and the receipt counter', async () => {
    // Lines are processed by id ASC: espresso is deducted first, then croissant (stock 2) fails.
    const res = await sell([
      { menuItemId: croissantId, quantity: 3 },
      { menuItemId: espressoId, quantity: 4 },
    ]);

    expect(res.status).toBe(409);
    expect(errorOf(res.body)).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      details: { menuItemId: croissantId, requested: 3, available: 2 },
    });
    expect(await getStock(outletId, espressoId)).toBe(10);
    expect(await getStock(outletId, croissantId)).toBe(2);
    expect(await getReceiptCounter(outletId)).toBe(0);
    expect(await countRows('sales', 'outlet_id = $1', [outletId])).toBe(0);

    // No gap: the next successful sale still gets receipt 1.
    const next = await sellOk([{ menuItemId: espressoId, quantity: 1 }]);
    expect(next.receiptNumber).toBe(1);
  });

  it('returns 422 ITEM_NOT_ASSIGNED listing every unassigned id (incl. unknown ids)', async () => {
    const res = await sell([
      { menuItemId: espressoId, quantity: 1 },
      { menuItemId: teaId, quantity: 1 },
      { menuItemId: 999999, quantity: 1 },
    ]);

    expect(res.status).toBe(422);
    expect(errorOf(res.body)).toMatchObject({
      code: 'ITEM_NOT_ASSIGNED',
      details: { menuItemIds: [teaId, 999999] },
    });
    expect(await getStock(outletId, espressoId)).toBe(10);
    expect(await getReceiptCounter(outletId)).toBe(0);
  });

  it.each([
    ['unavailable at the outlet', () => muffinId],
    ['inactive at HQ', () => retiredId],
  ])('returns 422 ITEM_NOT_SELLABLE for an item %s', async (_label, itemId) => {
    const res = await sell([
      { menuItemId: espressoId, quantity: 1 },
      { menuItemId: itemId(), quantity: 1 },
    ]);

    expect(res.status).toBe(422);
    expect(errorOf(res.body)).toMatchObject({
      code: 'ITEM_NOT_SELLABLE',
      details: { menuItemIds: [itemId()] },
    });
    expect(await getStock(outletId, itemId())).toBe(10);
    expect(await getStock(outletId, espressoId)).toBe(10);
  });

  it('uses the price override, and later price changes do not alter an old sale', async () => {
    const sale = await sellOk([
      { menuItemId: latteId, quantity: 2 },
      { menuItemId: espressoId, quantity: 1 },
    ]);
    expect(sale.items.find((i) => i.menuItemId === latteId)?.unitPrice).toBe('4.25');

    await setPriceOverride(outletId, latteId, '9.00');
    await setBasePrice(espressoId, '5.00');

    const detail = dataOf<SaleDto>((await request(app).get(salePath(sale.id))).body);
    expect(detail.totalAmount).toBe('11.50');
    expect(detail.items.map((i) => [i.menuItemId, i.unitPrice, i.lineTotal])).toEqual([
      [espressoId, '3.00', '3.00'],
      [latteId, '4.25', '8.50'],
    ]);

    const newSale = await sellOk([{ menuItemId: latteId, quantity: 1 }]);
    expect(newSale.totalAmount).toBe('9.00');
  });

  it('returns 404 OUTLET_NOT_FOUND for an unknown outlet', async () => {
    const res = await sell([{ menuItemId: espressoId, quantity: 1 }], 999999);

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('OUTLET_NOT_FOUND');
  });

  const fiftyOneLines = Array.from({ length: 51 }, (_, i) => ({ menuItemId: i + 1, quantity: 1 }));

  it.each([
    ['items is empty', { items: [] }, 'body.items'],
    ['items is missing', {}, 'body.items'],
    ['there are 51 lines', { items: fiftyOneLines }, 'body.items'],
    ['quantity is 0', { items: [{ menuItemId: 1, quantity: 0 }] }, 'body.items.0.quantity'],
    ['quantity is 1000', { items: [{ menuItemId: 1, quantity: 1000 }] }, 'body.items.0.quantity'],
    ['quantity is a float', { items: [{ menuItemId: 1, quantity: 1.5 }] }, 'body.items.0.quantity'],
    [
      'quantity is a string',
      { items: [{ menuItemId: 1, quantity: '2' }] },
      'body.items.0.quantity',
    ],
    [
      'menuItemId is negative',
      { items: [{ menuItemId: -1, quantity: 1 }] },
      'body.items.0.menuItemId',
    ],
    [
      'a line has an unknown field',
      { items: [{ menuItemId: 1, quantity: 1, unitPrice: '0.01' }] },
      'body.items.0.unitPrice',
    ],
    [
      'the body has an unknown field',
      { items: [{ menuItemId: 1, quantity: 1 }], total: '0.01' },
      'body.total',
    ],
  ])('returns 422 when %s', async (_label, body, path) => {
    const res = await request(app).post(salesPath()).send(body);

    expect(res.status).toBe(422);
    expect(errorOf(res.body).code).toBe('VALIDATION_ERROR');
    expect(errorPaths(res.body)).toContain(path);
    expect(await getReceiptCounter(outletId)).toBe(0);
  });

  it('returns 422 for a non-numeric outletId', async () => {
    const res = await request(app)
      .post('/api/outlets/abc/sales')
      .send({ items: [{ menuItemId: espressoId, quantity: 1 }] });

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toContain('params.outletId');
  });
});

describe('mergeSaleLines', () => {
  it('sums duplicates and sorts by menuItemId ascending', () => {
    expect(
      mergeSaleLines([
        { menuItemId: 9, quantity: 1 },
        { menuItemId: 2, quantity: 4 },
        { menuItemId: 9, quantity: 2 },
      ]),
    ).toEqual([
      { menuItemId: 2, quantity: 4 },
      { menuItemId: 9, quantity: 3 },
    ]);
  });

  it('accepts a merged quantity of exactly 999 and rejects 1000', () => {
    expect(
      mergeSaleLines([
        { menuItemId: 1, quantity: 500 },
        { menuItemId: 1, quantity: 499 },
      ]),
    ).toEqual([{ menuItemId: 1, quantity: 999 }]);
    expect(() =>
      mergeSaleLines([
        { menuItemId: 1, quantity: 500 },
        { menuItemId: 1, quantity: 500 },
      ]),
    ).toThrow(AppError);
  });
});

describe('GET /api/outlets/:outletId/sales', () => {
  it('lists sales newest first with their items and pagination meta', async () => {
    const first = await sellOk([{ menuItemId: espressoId, quantity: 1 }]);
    const second = await sellOk([
      { menuItemId: latteId, quantity: 1 },
      { menuItemId: espressoId, quantity: 2 },
    ]);
    await sellOk([{ menuItemId: teaId, quantity: 1 }], otherOutletId);

    const res = await request(app).get(salesPath());

    expect(res.status).toBe(200);
    const sales = dataOf<SaleDto[]>(res.body);
    expect(sales.map((s) => s.id)).toEqual([second.id, first.id]);
    expect(sales[0]).toEqual(second);
    expect(sales[1]?.items.map((i) => i.menuItemId)).toEqual([espressoId]);
    expect(metaOf(res.body)).toEqual({ total: 2, limit: 20, offset: 0 });
  });

  it('paginates', async () => {
    for (let i = 0; i < 3; i += 1) {
      await sellOk([{ menuItemId: espressoId, quantity: 1 }]);
    }

    const res = await request(app).get(`${salesPath()}?limit=1&offset=1`);

    expect(dataOf<SaleDto[]>(res.body).map((s) => s.receiptNumber)).toEqual([2]);
    expect(metaOf(res.body)).toEqual({ total: 3, limit: 1, offset: 1 });
  });

  it('filters by from (inclusive) / to (exclusive) and by receiptNumber', async () => {
    const oct = await sellOk([{ menuItemId: espressoId, quantity: 1 }]);
    const nov = await sellOk([{ menuItemId: espressoId, quantity: 1 }]);
    await setSaleCreatedAt(oct.id, '2026-10-15T10:00:00Z');
    await setSaleCreatedAt(nov.id, '2026-11-01T00:00:00Z');

    const novOnly = await request(app).get(`${salesPath()}?from=2026-11-01T00:00:00Z`);
    const octOnly = await request(app).get(`${salesPath()}?to=2026-11-01T00:00:00Z`);
    const range = await request(app).get(
      `${salesPath()}?from=2026-10-15T12:00:00%2B02:00&to=2026-10-16T00:00:00Z`,
    );
    const byReceipt = await request(app).get(`${salesPath()}?receiptNumber=2`);

    expect(dataOf<SaleDto[]>(novOnly.body).map((s) => s.id)).toEqual([nov.id]);
    expect(dataOf<SaleDto[]>(octOnly.body).map((s) => s.id)).toEqual([oct.id]);
    expect(dataOf<SaleDto[]>(range.body).map((s) => s.id)).toEqual([oct.id]);
    expect(dataOf<SaleDto[]>(byReceipt.body).map((s) => s.id)).toEqual([nov.id]);
    expect(metaOf(byReceipt.body).total).toBe(1);
  });

  it('returns an empty page when the outlet has no sales', async () => {
    const res = await request(app).get(salesPath());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], meta: { total: 0, limit: 20, offset: 0 } });
  });

  it('returns 422 for bad dates, from >= to, bad receiptNumber and unknown params', async () => {
    const bad = await request(app).get(
      `${salesPath()}?from=yesterday&to=2026-11-01&receiptNumber=-1&sort=asc`,
    );
    const inverted = await request(app).get(
      `${salesPath()}?from=2026-11-02T00:00:00Z&to=2026-11-01T00:00:00Z`,
    );

    expect(bad.status).toBe(422);
    expect(errorPaths(bad.body)).toEqual(
      expect.arrayContaining(['query.from', 'query.to', 'query.receiptNumber', 'query.sort']),
    );
    expect(inverted.status).toBe(422);
    expect(errorPaths(inverted.body)).toEqual(['query.to']);
  });

  it('returns 404 OUTLET_NOT_FOUND for an unknown outlet', async () => {
    const res = await request(app).get(salesPath(999999));

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('OUTLET_NOT_FOUND');
  });
});

describe('GET /api/outlets/:outletId/sales/:saleId', () => {
  it('returns the sale with its items', async () => {
    const created = await sellOk([
      { menuItemId: espressoId, quantity: 1 },
      { menuItemId: latteId, quantity: 1 },
    ]);

    const res = await request(app).get(salePath(created.id));

    expect(res.status).toBe(200);
    expect(dataOf<SaleDto>(res.body)).toEqual(created);
  });

  it("returns 404 SALE_NOT_FOUND for another outlet's sale and for an unknown id", async () => {
    const otherSale = await sellOk([{ menuItemId: teaId, quantity: 1 }], otherOutletId);

    const crossOutlet = await request(app).get(salePath(otherSale.id));
    const unknown = await request(app).get(salePath(999999));

    expect(crossOutlet.status).toBe(404);
    expect(errorOf(crossOutlet.body).code).toBe('SALE_NOT_FOUND');
    expect(unknown.status).toBe(404);
    expect(errorOf(unknown.body).code).toBe('SALE_NOT_FOUND');
  });

  it('returns 404 OUTLET_NOT_FOUND for an unknown outlet', async () => {
    const res = await request(app).get(salePath(1, 999999));

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('OUTLET_NOT_FOUND');
  });

  it('returns 422 for a non-numeric saleId', async () => {
    const res = await request(app).get(`${salesPath()}/abc`);

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toContain('params.saleId');
  });
});
