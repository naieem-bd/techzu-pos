import type { Queryable } from '../db/pool';

/** Half-open range: `from` inclusive, `to` exclusive. Undefined disables that bound. */
export interface DateRange {
  from?: Date | undefined;
  to?: Date | undefined;
}

interface OutletRevenueRow {
  id: string;
  code: string;
  name: string;
  sale_count: string;
  total_revenue: string;
  average_ticket: string;
  grand_total: string;
  total_sales: string;
}

/** Money stays a NUMERIC string with exactly 2 decimals; counts are BIGINT -> number. */
export interface OutletRevenue {
  outletId: number;
  code: string;
  name: string;
  saleCount: number;
  totalRevenue: string;
  averageTicket: string;
}

export interface RevenueByOutlet {
  outlets: OutletRevenue[];
  grandTotal: string;
  totalSales: number;
}

/**
 * Revenue per outlet, including outlets with no sales in the range.
 *
 * - The date filter sits in the LEFT JOIN's ON clause on purpose: in WHERE it would discard the
 *   NULL-extended rows and silently drop zero-sales outlets (turning it into an inner join).
 * - round(…, 2) always yields scale 2, so "no sales" is "0.00" rather than "0", and the average
 *   is rounded in SQL (NUMERIC, half away from zero) — no JS money math anywhere.
 * - Grand total / total sales are window aggregates over the grouped rows, so they come from the
 *   same snapshot as the per-outlet rows in one round trip.
 * - Index: with a range, sales_created_at_idx (created_at) finds the sales in it (bitmap scan);
 *   with no range every sale is aggregated, so a sequential scan is the right plan. At larger
 *   volumes this becomes a pre-aggregated summary table (see docs/ARCHITECTURE.md §5).
 */
export const revenueByOutlet = async (
  db: Queryable,
  { from, to }: DateRange,
): Promise<RevenueByOutlet> => {
  const { rows } = await db.query<OutletRevenueRow>(
    `SELECT o.id, o.code, o.name,
            count(s.id) AS sale_count,
            round(COALESCE(sum(s.total_amount), 0), 2) AS total_revenue,
            round(COALESCE(avg(s.total_amount), 0), 2) AS average_ticket,
            round(COALESCE(sum(sum(s.total_amount)) OVER (), 0), 2) AS grand_total,
            sum(count(s.id)) OVER () AS total_sales
     FROM outlets o
     LEFT JOIN sales s
       ON s.outlet_id = o.id
      AND ($1::timestamptz IS NULL OR s.created_at >= $1)
      AND ($2::timestamptz IS NULL OR s.created_at < $2)
     GROUP BY o.id
     ORDER BY total_revenue DESC, o.name, o.id`,
    [from ?? null, to ?? null],
  );

  const [first] = rows;
  return {
    outlets: rows.map((row) => ({
      outletId: Number(row.id),
      code: row.code,
      name: row.name,
      saleCount: Number(row.sale_count),
      totalRevenue: row.total_revenue,
      averageTicket: row.average_ticket,
    })),
    // No outlets at all -> no rows to carry the window totals; these are constants, not math.
    grandTotal: first?.grand_total ?? '0.00',
    totalSales: first ? Number(first.total_sales) : 0,
  };
};

interface TopItemRow {
  id: string;
  sku: string;
  name: string;
  quantity_sold: string;
  revenue: string;
}

export interface TopItem {
  menuItemId: number;
  sku: string;
  name: string;
  quantitySold: number;
  revenue: string;
}

/**
 * Best sellers of one outlet by quantity; ties by revenue, then name, then id (deterministic).
 * Revenue sums the line_total copied at sale time, so later price changes don't rewrite history.
 * Items no longer assigned or active still count: they were really sold.
 *
 * Index: sales_outlet_id_created_at_idx (outlet_id, created_at) finds the outlet's sales in the
 * range. Their lines come via sale_items_sale_menu_item_key (sale_id, …) in a nested loop when
 * random_page_cost suits SSDs (~1.1); with the default 4 the planner hash-joins a sale_items scan.
 */
export const topItemsForOutlet = async (
  db: Queryable,
  outletId: number,
  { from, to }: DateRange,
  limit: number,
): Promise<TopItem[]> => {
  const { rows } = await db.query<TopItemRow>(
    `SELECT mi.id, mi.sku, mi.name,
            sum(si.quantity) AS quantity_sold,
            sum(si.line_total) AS revenue
     FROM sales s
     JOIN sale_items si ON si.sale_id = s.id
     JOIN menu_items mi ON mi.id = si.menu_item_id
     WHERE s.outlet_id = $1
       AND ($2::timestamptz IS NULL OR s.created_at >= $2)
       AND ($3::timestamptz IS NULL OR s.created_at < $3)
     GROUP BY mi.id
     ORDER BY quantity_sold DESC, revenue DESC, mi.name, mi.id
     LIMIT $4`,
    [outletId, from ?? null, to ?? null, limit],
  );
  return rows.map((row) => ({
    menuItemId: Number(row.id),
    sku: row.sku,
    name: row.name,
    quantitySold: Number(row.quantity_sold),
    revenue: row.revenue,
  }));
};
