import type { Server } from 'node:http';
import request from 'supertest';
import type { Response } from 'supertest';
import { createApp } from '../src/app';
import { closePool, pool } from '../src/db/pool';
import {
  assign,
  countRows,
  createMenuItem,
  createOutlet,
  getReceiptCounter,
  getStock,
  setStock,
  truncateAll,
} from './helpers/db';
import { dataOf, errorOf } from './helpers/http';

/*
 * no oversell / negative stock, gap-free per-outlet receipt numbers, no deadlocks, and
 * failed sales never consuming a receipt number or stock.
 *
 * Every burst is fired with Promise.all against ONE listening server, and the pg pool is sized
 * by DB_POOL_MAX (25 in tests, see test-env.ts), so up to 25 sale transactions really overlap
 * in Postgres instead of queueing behind the default 10 connections.
 *
 * Requires the test database: `docker compose up -d db_test`.
 */

interface Line {
  menuItemId: number;
  quantity: number;
}

interface SaleDto {
  outletId: number;
  receiptNumber: number;
}

let server: Server;

const fire = (count: number, saleFor: (i: number) => { outletId: number; items: Line[] }) =>
  Promise.all(
    Array.from({ length: count }, (_, i) => {
      const { outletId, items } = saleFor(i);
      return request(server)
        .post(`/api/outlets/${String(outletId)}/sales`)
        .send({ items });
    }),
  );

const withStatus = (responses: readonly Response[], status: number): Response[] =>
  responses.filter((res) => res.status === status);

const receiptsOf = (responses: readonly Response[]): number[] =>
  responses.map((res) => dataOf<SaleDto>(res.body).receiptNumber).sort((a, b) => a - b);

const oneTo = (k: number): number[] => Array.from({ length: k }, (_, i) => i + 1);

/** One line per scenario, ready to paste into the README. Logger is silent in tests. */
const report = (line: string): void => {
  process.stdout.write(`[concurrency] ${line}\n`);
};

/** Idle clients stay in the pool for 30s, so totalCount shows how many were opened in parallel. */
const connectionsUsed = (): number => pool.totalCount;

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  await closePool();
});

beforeEach(async () => {
  await truncateAll();
});

describe('concurrent POST /api/outlets/:outletId/sales', () => {
  it('oversell race: 50 buyers for 30 units -> exactly 30 sales, receipts 1..30, stock 0', async () => {
    const outletId = await createOutlet('DT01');
    const itemId = await createMenuItem();
    await assign(outletId, itemId);
    await setStock(outletId, itemId, 30);

    const responses = await fire(50, () => ({
      outletId,
      items: [{ menuItemId: itemId, quantity: 1 }],
    }));

    const ok = withStatus(responses, 201);
    const rejected = withStatus(responses, 409);
    expect(ok).toHaveLength(30);
    expect(rejected).toHaveLength(20);
    for (const res of rejected) expect(errorOf(res.body).code).toBe('INSUFFICIENT_STOCK');
    expect(receiptsOf(ok)).toEqual(oneTo(30));
    expect(await getStock(outletId, itemId)).toBe(0);
    expect(await getReceiptCounter(outletId)).toBe(30);
    expect(await countRows('sales', 'outlet_id = $1', [outletId])).toBe(30);
    expect(connectionsUsed()).toBeGreaterThan(1);

    report(
      `oversell: ${String(ok.length)} ok, ${String(rejected.length)} rejected (409), ` +
        `receipts 1..30, final stock 0 (${String(connectionsUsed())} pg connections)`,
    );
  });

  it('independent outlets: 20 sales split across 2 outlets -> each gets receipts 1..10', async () => {
    const downtown = await createOutlet('DT01');
    const mall = await createOutlet('ML02', 'City Mall');
    const itemId = await createMenuItem();
    for (const outletId of [downtown, mall]) {
      await assign(outletId, itemId);
      await setStock(outletId, itemId, 50);
    }

    const responses = await fire(20, (i) => ({
      outletId: i % 2 === 0 ? downtown : mall,
      items: [{ menuItemId: itemId, quantity: 1 }],
    }));

    expect(withStatus(responses, 201)).toHaveLength(20);
    for (const outletId of [downtown, mall]) {
      const ofOutlet = responses.filter((res) => dataOf<SaleDto>(res.body).outletId === outletId);
      expect(receiptsOf(ofOutlet)).toEqual(oneTo(10));
      expect(await getReceiptCounter(outletId)).toBe(10);
      expect(await getStock(outletId, itemId)).toBe(40);
    }

    report('independent outlets: 20 ok, DT01 receipts 1..10, ML02 receipts 1..10');
  });

  it('deadlock safety: [A,B] and [B,A] interleaved -> all succeed, exact stock totals', async () => {
    const outletId = await createOutlet('DT01');
    const itemA = await createMenuItem({ sku: 'COF-ESP', name: 'Espresso' });
    const itemB = await createMenuItem({ sku: 'COF-LAT', name: 'Caffe Latte' });
    for (const itemId of [itemA, itemB]) {
      await assign(outletId, itemId);
      await setStock(outletId, itemId, 500);
    }

    const quantityA = (i: number): number => (i % 3) + 1;
    const quantityB = (i: number): number => (i % 2) + 1;
    const count = 20;

    const responses = await fire(count, (i) => {
      const a = { menuItemId: itemA, quantity: quantityA(i) };
      const b = { menuItemId: itemB, quantity: quantityB(i) };
      // Opposite request orders: a naive implementation locking rows in request order deadlocks.
      return { outletId, items: i % 2 === 0 ? [a, b] : [b, a] };
    });

    const failures = responses.filter((res) => res.status !== 201);
    // Surface the actual error (e.g. 500 from Postgres 40P01) if anything went wrong.
    expect(failures.map((res) => [res.status, JSON.stringify(res.body)])).toEqual([]);
    expect(receiptsOf(responses)).toEqual(oneTo(count));

    const indexes = oneTo(count).map((n) => n - 1);
    const totalA = indexes.reduce((sum, i) => sum + quantityA(i), 0);
    const totalB = indexes.reduce((sum, i) => sum + quantityB(i), 0);
    expect(await getStock(outletId, itemA)).toBe(500 - totalA);
    expect(await getStock(outletId, itemB)).toBe(500 - totalB);
    expect(await getReceiptCounter(outletId)).toBe(count);

    report(
      `deadlock safety: ${String(count)} ok ([A,B] and [B,A] interleaved), receipts 1..${String(count)}, ` +
        `stock A -${String(totalA)}, B -${String(totalB)}, no 40P01`,
    );
  });

  it('mixed failures: unassigned-item sales (422) never consume a receipt number or stock', async () => {
    const outletId = await createOutlet('DT01');
    const otherOutletId = await createOutlet('ML02', 'City Mall');
    const itemId = await createMenuItem({ sku: 'COF-ESP', name: 'Espresso' });
    // Exists in the master menu but is assigned only to the other outlet.
    const foreignItemId = await createMenuItem({ sku: 'TEA-GRN', name: 'Green Tea' });
    await assign(outletId, itemId);
    await setStock(outletId, itemId, 50);
    await assign(otherOutletId, foreignItemId);

    const responses = await fire(20, (i) => ({
      outletId,
      items:
        i % 2 === 0
          ? [{ menuItemId: itemId, quantity: 1 }]
          : [
              { menuItemId: itemId, quantity: 1 },
              { menuItemId: foreignItemId, quantity: 1 },
            ],
    }));

    const ok = withStatus(responses, 201);
    const rejected = withStatus(responses, 422);
    expect(ok).toHaveLength(10);
    expect(rejected).toHaveLength(10);
    for (const res of rejected) expect(errorOf(res.body).code).toBe('ITEM_NOT_ASSIGNED');
    expect(receiptsOf(ok)).toEqual(oneTo(10));
    expect(await getReceiptCounter(outletId)).toBe(10);
    expect(await getStock(outletId, itemId)).toBe(40);
    expect(await countRows('sales', 'outlet_id = $1', [outletId])).toBe(10);
    expect(await countRows('sale_items', 'menu_item_id = $1', [itemId])).toBe(10);

    report(
      `mixed failures: ${String(ok.length)} ok, ${String(rejected.length)} rejected (422), ` +
        'receipts 1..10, stock 50 -> 40',
    );
  });
});
