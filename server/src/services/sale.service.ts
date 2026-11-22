import { pool } from '../db/pool';
import type { PoolClient } from 'pg';
import { withTransaction } from '../db/transaction';
import { deductInventory, findInventoryQuantity } from '../repositories/inventory.repository';
import { findItemsForSale } from '../repositories/outlet-menu-item.repository';
import type { SaleCandidate } from '../repositories/outlet-menu-item.repository';
import { incrementReceiptCounter } from '../repositories/receipt-counter.repository';
import {
  countSales,
  findSale,
  insertSale,
  insertSaleItems,
  listSaleItems,
  listSales,
} from '../repositories/sale.repository';
import type {
  NewSaleLine,
  SaleFilter,
  SaleHeader,
  SaleLine,
} from '../repositories/sale.repository';
import { AppError, conflict, notFound, unprocessable } from '../utils/app-error';
import type { Page, Pagination } from '../utils/pagination';
import { MAX_LINE_QUANTITY } from '../validators/sale.validators';
import { assertOutletExists } from './outlet.service';

export interface SaleLineInput {
  menuItemId: number;
  quantity: number;
}

export interface SaleItem {
  menuItemId: number;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

/** One receipt as returned by create, list and detail (same shape everywhere). */
export interface Sale {
  id: number;
  outletId: number;
  receiptNumber: number;
  receiptNo: string;
  totalAmount: string;
  createdAt: Date;
  items: SaleItem[];
}

const RECEIPT_DIGITS = 6;

/** "DT01-000123". padStart never truncates, so receipt 1234567 stays "DT01-1234567". */
export const formatReceiptNo = (outletCode: string, receiptNumber: number): string =>
  `${outletCode}-${String(receiptNumber).padStart(RECEIPT_DIGITS, '0')}`;

/**
 * Merges duplicate lines (sale_items allows one row per item per sale) and sorts by
 * menuItemId ASC, which is the lock order used by createSale. The per-line cap is re-checked
 * after merging because two valid lines (600 + 600) can add up to an invalid one.
 */
export const mergeSaleLines = (items: readonly SaleLineInput[]): SaleLineInput[] => {
  const totals = new Map<number, number>();
  for (const { menuItemId, quantity } of items) {
    totals.set(menuItemId, (totals.get(menuItemId) ?? 0) + quantity);
  }

  const merged = [...totals]
    .map(([menuItemId, quantity]) => ({ menuItemId, quantity }))
    .sort((a, b) => a.menuItemId - b.menuItemId);

  const overCap = merged.filter((line) => line.quantity > MAX_LINE_QUANTITY);
  if (overCap.length > 0) {
    // Same details shape as the `validate` middleware, so clients handle both alike.
    throw new AppError(
      422,
      'VALIDATION_ERROR',
      'Request validation failed',
      overCap.map((line) => ({
        location: 'body',
        path: 'items',
        message: `Combined quantity for menu item ${String(line.menuItemId)} exceeds ${String(MAX_LINE_QUANTITY)}`,
      })),
    );
  }
  return merged;
};

const toSale = (header: SaleHeader, lines: readonly SaleLine[]): Sale => ({
  id: header.id,
  outletId: header.outletId,
  receiptNumber: header.receiptNumber,
  receiptNo: formatReceiptNo(header.outletCode, header.receiptNumber),
  totalAmount: header.totalAmount,
  createdAt: header.createdAt,
  items: lines.map(({ menuItemId, sku, name, quantity, unitPrice, lineTotal }) => ({
    menuItemId,
    sku,
    name,
    quantity,
    unitPrice,
    lineTotal,
  })),
});

/** 422 unless every requested item is assigned to the outlet, available there and active at HQ. */
const assertAllSellable = (
  lines: readonly SaleLineInput[],
  candidates: readonly SaleCandidate[],
): Map<number, SaleCandidate> => {
  const byId = new Map(candidates.map((candidate) => [candidate.menuItemId, candidate]));

  const unassigned = lines.filter((line) => !byId.has(line.menuItemId)).map((l) => l.menuItemId);
  if (unassigned.length > 0) {
    throw unprocessable('ITEM_NOT_ASSIGNED', 'One or more items are not on this outlet’s menu', {
      menuItemIds: unassigned,
    });
  }

  const notSellable = candidates
    .filter((candidate) => !candidate.isAvailable || !candidate.isActive)
    .map((candidate) => candidate.menuItemId);
  if (notSellable.length > 0) {
    throw unprocessable('ITEM_NOT_SELLABLE', 'One or more items cannot be sold right now', {
      menuItemIds: notSellable,
    });
  }
  return byId;
};

/** Deducts every line in the given (ascending) order; the first shortfall aborts the sale. */
const deductStock = async (
  client: PoolClient,
  outletId: number,
  lines: readonly SaleLineInput[],
): Promise<void> => {
  for (const { menuItemId, quantity } of lines) {
    // Sequential on purpose: one client runs one statement at a time, and the order is the lock order.
    const remaining = await deductInventory(client, outletId, menuItemId, quantity);
    if (remaining !== null) continue;

    // Read only to explain the refusal; it never decides a write.
    const available = (await findInventoryQuantity(client, outletId, menuItemId)) ?? 0;
    throw conflict(
      'INSUFFICIENT_STOCK',
      `Not enough stock for menu item ${String(menuItemId)}: requested ${String(quantity)}, available ${String(available)}`,
      { menuItemId, requested: quantity, available },
    );
  }
};

/**
 * Creates a sale atomically. WHY it is built this way:
 *
 * - One transaction: stock deductions, the receipt number and the receipt rows commit together
 *   or not at all. Any thrown error rolls everything back.
 * - Lock ordering: lines are merged and sorted by menuItemId ASC, so every sale locks inventory
 *   rows in the same order. Two sales sharing items wait for each other instead of each holding
 *   a row the other needs (which is how deadlocks happen).
 * - No negative stock without read-then-write: each deduction is ONE conditional UPDATE
 *   (`... AND quantity >= $q`). Postgres re-evaluates that condition against the latest
 *   committed row after waiting for its lock, so two sales can never both spend the same stock.
 *   The CHECK (quantity >= 0) constraint is the final guard.
 * - Receipt numbers: the counter UPDATE row-locks the outlet's counter, which serialises receipt
 *   numbering per outlet (other outlets are unaffected). It is taken LAST, after all checks
 *   that may fail, so the lock that every sale of the outlet must queue on is held only for
 *   the final inserts and the commit.
 * - No gaps: a failed sale rolls back its counter increment too, and failures before the
 *   counter step never touch it. UNIQUE (outlet_id, receipt_number) is the final guard.
 */
export const createSale = (outletId: number, items: readonly SaleLineInput[]): Promise<Sale> => {
  const lines = mergeSaleLines(items);

  return withTransaction(async (client) => {
    await assertOutletExists(client, outletId);

    const candidates = await findItemsForSale(
      client,
      outletId,
      lines.map((line) => line.menuItemId),
    );
    const byId = assertAllSellable(lines, candidates);

    await deductStock(client, outletId, lines);

    const receiptNumber = await incrementReceiptCounter(client, outletId);

    const saleLines: NewSaleLine[] = lines.map(({ menuItemId, quantity }) => {
      const candidate = byId.get(menuItemId);
      if (!candidate) throw new Error(`Sale candidate ${String(menuItemId)} vanished`);
      return { menuItemId, quantity, unitPrice: candidate.unitPrice };
    });
    const header = await insertSale(client, { outletId, receiptNumber, lines: saleLines });
    const savedLines = await insertSaleItems(client, header.id, saleLines);

    return toSale(header, savedLines);
  });
};

export const getSales = async (
  outletId: number,
  filter: SaleFilter,
  page: Pagination,
): Promise<Page<Sale>> => {
  await assertOutletExists(pool, outletId);
  const [headers, total] = await Promise.all([
    listSales(pool, outletId, filter, page),
    countSales(pool, outletId, filter),
  ]);

  const lines = await listSaleItems(
    pool,
    headers.map((header) => header.id),
  );
  const linesBySale = new Map<number, SaleLine[]>();
  for (const line of lines) {
    const group = linesBySale.get(line.saleId);
    if (group) group.push(line);
    else linesBySale.set(line.saleId, [line]);
  }

  return {
    items: headers.map((header) => toSale(header, linesBySale.get(header.id) ?? [])),
    total,
  };
};

export const getSale = async (outletId: number, saleId: number): Promise<Sale> => {
  await assertOutletExists(pool, outletId);
  const header = await findSale(pool, outletId, saleId);
  if (!header) {
    throw notFound(
      'SALE_NOT_FOUND',
      `Sale ${String(saleId)} not found at outlet ${String(outletId)}`,
    );
  }
  return toSale(header, await listSaleItems(pool, [header.id]));
};
