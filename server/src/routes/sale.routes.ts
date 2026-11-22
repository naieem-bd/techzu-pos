import { Router } from 'express';
import {
  createSaleController,
  getSaleController,
  listSalesController,
} from '../controllers/sale.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/async-handler';
import { createSaleSchemas, getSaleSchemas, listSalesSchemas } from '../validators/sale.validators';

/** Outlet sales (receipts). Mounted at /outlets/:outletId/sales; mergeParams exposes :outletId. */
export const saleRouter = Router({ mergeParams: true });

/**
 * POST /outlets/:outletId/sales with body `{ items: [{ menuItemId, quantity }] }` (1-50 lines,
 * quantity 1-999; duplicate items are merged). One transaction: stock is deducted and the next
 * receipt number taken, or nothing changes. 201 with the receipt.
 * 422 ITEM_NOT_ASSIGNED / ITEM_NOT_SELLABLE (details.menuItemIds), 409 INSUFFICIENT_STOCK
 * (details { menuItemId, requested, available }), 404 OUTLET_NOT_FOUND.
 */
saleRouter.post('/', validate(createSaleSchemas), asyncHandler(createSaleController));

/**
 * GET /outlets/:outletId/sales: newest first, each sale with its lines. Paginated.
 * Query: `from` (inclusive) / `to` (exclusive) as ISO 8601 datetimes with timezone,
 * `receiptNumber`, `limit` / `offset`.
 */
saleRouter.get('/', validate(listSalesSchemas), asyncHandler(listSalesController));

/** GET /outlets/:outletId/sales/:saleId: 404 SALE_NOT_FOUND if it belongs to another outlet. */
saleRouter.get('/:saleId', validate(getSaleSchemas), asyncHandler(getSaleController));
