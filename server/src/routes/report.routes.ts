import { Router } from 'express';
import { revenueByOutletController, topItemsController } from '../controllers/report.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/async-handler';
import { revenueByOutletSchemas, topItemsSchemas } from '../validators/report.validators';

/** HQ reports. Mounted at /reports. All dates: `from` inclusive, `to` exclusive, ISO 8601 + tz. */
export const reportRouter = Router();

/**
 * GET /reports/revenue-by-outlet?from&to: every outlet (zero-sales ones included) with
 * saleCount, totalRevenue and averageTicket (2-dp strings), highest revenue first.
 * meta: { grandTotal, totalSales }. Not paginated: one row per outlet by design.
 */
reportRouter.get(
  '/revenue-by-outlet',
  validate(revenueByOutletSchemas),
  asyncHandler(revenueByOutletController),
);

/**
 * GET /reports/outlets/:outletId/top-items?limit=5&from&to: best sellers by quantity
 * (ties: revenue desc, then name). limit 1-20, default 5. 404 OUTLET_NOT_FOUND.
 */
reportRouter.get(
  '/outlets/:outletId/top-items',
  validate(topItemsSchemas),
  asyncHandler(topItemsController),
);
