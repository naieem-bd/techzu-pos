import type { Queryable } from '../db/pool';
import type { Pagination } from '../utils/pagination';
import { toCount } from './sql-helpers';

/**
 * Has this item ever been sold at this outlet? Uses sale_items_menu_item_id_idx and the
 * sales PK; keeps receipts (which copy prices) from losing their assignment context.
 */
export const hasSalesForItemAtOutlet = async (
  db: Queryable,
  outletId: number,
  menuItemId: number,
): Promise<boolean> => {
  const { rows } = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.outlet_id = $1 AND si.menu_item_id = $2
     ) AS exists`,
    [outletId, menuItemId],
  );
  return rows[0]?.exists === true;
};

/** One line to record. `unitPrice` is the NUMERIC string loaded from the DB, never a JS float. */
export interface NewSaleLine {
  menuItemId: number;
  quantity: number;
  unitPrice: string;
}

export interface NewSale {
  outletId: number;
  receiptNumber: number;
  lines: readonly NewSaleLine[];
}

interface SaleRow {
  id: string;
  outlet_id: string;
  outlet_code: string;
  receipt_number: string;
  total_amount: string;
  created_at: Date;
}

/** A receipt header. BIGINT ids/numbers become numbers; money stays a NUMERIC string. */
export interface SaleHeader {
  id: number;
  outletId: number;
  outletCode: string;
  receiptNumber: number;
  totalAmount: string;
  createdAt: Date;
}

interface SaleLineRow {
  sale_id: string;
  menu_item_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
}

export interface SaleLine {
  saleId: number;
  menuItemId: number;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface SaleFilter {
  from?: Date | undefined;
  to?: Date | undefined;
  receiptNumber?: number | undefined;
}

const toSaleHeader = (row: SaleRow): SaleHeader => ({
  id: Number(row.id),
  outletId: Number(row.outlet_id),
  outletCode: row.outlet_code,
  receiptNumber: Number(row.receipt_number),
  totalAmount: row.total_amount,
  createdAt: row.created_at,
});

const toSaleLine = (row: SaleLineRow): SaleLine => ({
  saleId: Number(row.sale_id),
  menuItemId: Number(row.menu_item_id),
  sku: row.sku,
  name: row.name,
  quantity: row.quantity,
  unitPrice: row.unit_price,
  lineTotal: row.line_total,
});

/**
 * Inserts the receipt header. The total is summed in SQL from the same prices and quantities
 * that become the lines, so money is exact NUMERIC math, never JS floating point.
 * $3 = unit prices (numeric[]), $4 = quantities (int[]), positionally paired by unnest.
 */
export const insertSale = async (db: Queryable, sale: NewSale): Promise<SaleHeader> => {
  const { rows } = await db.query<SaleRow>(
    `WITH ins AS (
       INSERT INTO sales (outlet_id, receipt_number, total_amount)
       SELECT $1, $2, sum(l.unit_price * l.quantity)
       FROM unnest($3::numeric[], $4::int[]) AS l(unit_price, quantity)
       RETURNING id, outlet_id, receipt_number, total_amount, created_at
     )
     SELECT ins.*, o.code AS outlet_code FROM ins JOIN outlets o ON o.id = ins.outlet_id`,
    [
      sale.outletId,
      sale.receiptNumber,
      sale.lines.map((line) => line.unitPrice),
      sale.lines.map((line) => line.quantity),
    ],
  );
  const [row] = rows;
  if (!row) throw new Error('INSERT sales returned no row');
  return toSaleHeader(row);
};

// Lines with the item's SKU/name. Prices are the copies stored at sale time.
const LINE_COLUMNS = `si.sale_id, si.menu_item_id, mi.sku, mi.name, si.quantity,
       si.unit_price, si.line_total`;

/**
 * All lines of a sale in ONE parameterized statement (arrays + unnest, no SQL built from input).
 * line_total is computed in SQL; the CHECK constraint re-verifies it.
 */
export const insertSaleItems = async (
  db: Queryable,
  saleId: number,
  lines: readonly NewSaleLine[],
): Promise<SaleLine[]> => {
  const { rows } = await db.query<SaleLineRow>(
    `WITH si AS (
       INSERT INTO sale_items (sale_id, menu_item_id, quantity, unit_price, line_total)
       SELECT $1, l.menu_item_id, l.quantity, l.unit_price, l.unit_price * l.quantity
       FROM unnest($2::bigint[], $3::int[], $4::numeric[]) AS l(menu_item_id, quantity, unit_price)
       RETURNING sale_id, menu_item_id, quantity, unit_price, line_total
     )
     SELECT ${LINE_COLUMNS}
     FROM si JOIN menu_items mi ON mi.id = si.menu_item_id
     ORDER BY si.menu_item_id`,
    [
      saleId,
      lines.map((line) => line.menuItemId),
      lines.map((line) => line.quantity),
      lines.map((line) => line.unitPrice),
    ],
  );
  return rows.map(toSaleLine);
};

const SALE_COLUMNS = `s.id, s.outlet_id, o.code AS outlet_code, s.receipt_number,
       s.total_amount, s.created_at`;

// $1 outlet id, $2 from (inclusive), $3 to (exclusive), $4 receipt number; NULL disables each.
// sales_outlet_id_created_at_idx serves outlet + date range + newest-first ordering;
// sales_outlet_receipt_number_key serves the receipt-number lookup.
const SALE_FILTER = `s.outlet_id = $1
  AND ($2::timestamptz IS NULL OR s.created_at >= $2)
  AND ($3::timestamptz IS NULL OR s.created_at < $3)
  AND ($4::bigint IS NULL OR s.receipt_number = $4)`;

const filterParams = (outletId: number, filter: SaleFilter): unknown[] => [
  outletId,
  filter.from ?? null,
  filter.to ?? null,
  filter.receiptNumber ?? null,
];

/** Newest first; receipt number breaks ties between sales created in the same instant. */
export const listSales = async (
  db: Queryable,
  outletId: number,
  filter: SaleFilter,
  { limit, offset }: Pagination,
): Promise<SaleHeader[]> => {
  const { rows } = await db.query<SaleRow>(
    `SELECT ${SALE_COLUMNS}
     FROM sales s JOIN outlets o ON o.id = s.outlet_id
     WHERE ${SALE_FILTER}
     ORDER BY s.created_at DESC, s.receipt_number DESC
     LIMIT $5 OFFSET $6`,
    [...filterParams(outletId, filter), limit, offset],
  );
  return rows.map(toSaleHeader);
};

export const countSales = async (
  db: Queryable,
  outletId: number,
  filter: SaleFilter,
): Promise<number> => {
  const { rows } = await db.query<{ total: string }>(
    `SELECT count(*) AS total FROM sales s WHERE ${SALE_FILTER}`,
    filterParams(outletId, filter),
  );
  return toCount(rows);
};

/** Scoped by outlet: a sale of another outlet is reported as not found. */
export const findSale = async (
  db: Queryable,
  outletId: number,
  saleId: number,
): Promise<SaleHeader | null> => {
  const { rows } = await db.query<SaleRow>(
    `SELECT ${SALE_COLUMNS}
     FROM sales s JOIN outlets o ON o.id = s.outlet_id
     WHERE s.outlet_id = $1 AND s.id = $2`,
    [outletId, saleId],
  );
  const [row] = rows;
  return row ? toSaleHeader(row) : null;
};

/**
 * Lines for a whole page of sales in ONE query (avoids N+1). Served by
 * sale_items_sale_menu_item_key (sale_id, menu_item_id), which also gives the ordering.
 */
export const listSaleItems = async (
  db: Queryable,
  saleIds: readonly number[],
): Promise<SaleLine[]> => {
  if (saleIds.length === 0) return [];
  const { rows } = await db.query<SaleLineRow>(
    `SELECT ${LINE_COLUMNS}
     FROM sale_items si JOIN menu_items mi ON mi.id = si.menu_item_id
     WHERE si.sale_id = ANY($1::bigint[])
     ORDER BY si.sale_id, si.menu_item_id`,
    [saleIds],
  );
  return rows.map(toSaleLine);
};
