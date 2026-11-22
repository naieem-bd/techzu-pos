import { pool } from '../db/pool';
import { revenueByOutlet, topItemsForOutlet } from '../repositories/report.repository';
import type { DateRange, RevenueByOutlet, TopItem } from '../repositories/report.repository';
import { assertOutletExists } from './outlet.service';

/** HQ view: every outlet's revenue in the range, plus grand totals. Read-only, no transaction. */
export const getRevenueByOutlet = (range: DateRange): Promise<RevenueByOutlet> =>
  revenueByOutlet(pool, range);

/** 404 OUTLET_NOT_FOUND for an unknown outlet; an existing outlet with no sales gets []. */
export const getTopItems = async (
  outletId: number,
  range: DateRange,
  limit: number,
): Promise<TopItem[]> => {
  await assertOutletExists(pool, outletId);
  return topItemsForOutlet(pool, outletId, range, limit);
};
