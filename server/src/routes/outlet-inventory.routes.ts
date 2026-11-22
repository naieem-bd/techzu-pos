import { Router } from 'express';
import {
  adjustInventoryController,
  listInventoryController,
  listSellableMenuController,
} from '../controllers/outlet-inventory.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/async-handler';
import {
  adjustInventorySchemas,
  listInventorySchemas,
  listSellableMenuSchemas,
} from '../validators/outlet-inventory.validators';

/** Outlet-side (POS) endpoints. Mounted at /outlets/:outletId; mergeParams exposes :outletId. */
export const outletInventoryRouter = Router({ mergeParams: true });

/**
 * GET /outlets/:outletId/menu: what the POS can sell. Only items that are assigned, available
 * at the outlet and active at HQ, with effective price and current stock, ordered by
 * category then name. Unpaginated (capped at 500 rows).
 * Query: `search` (name/SKU contains), `category` (exact), `inStock`:
 *   - `inStock=true`  -> only items with quantity > 0
 *   - `inStock=false` -> only out-of-stock items (quantity = 0), NOT "no filter"
 *   - omitted         -> all sellable items regardless of stock
 */
outletInventoryRouter.get(
  '/menu',
  validate(listSellableMenuSchemas),
  asyncHandler(listSellableMenuController),
);

/**
 * GET /outlets/:outletId/inventory: stock for every assigned item, including items hidden
 * from /menu (unavailable or inactive), so they can still be managed. Paginated.
 * Query: `status` = in_stock | low | out, plus `limit` / `offset`.
 */
outletInventoryRouter.get(
  '/inventory',
  validate(listInventorySchemas),
  asyncHandler(listInventoryController),
);

/**
 * PATCH /outlets/:outletId/inventory/:menuItemId with body `{ adjustment }` (non-zero integer,
 * -10000..10000). 404 ASSIGNMENT_NOT_FOUND if the item isn't assigned; 409 INSUFFICIENT_STOCK
 * if the result would be negative (stock unchanged).
 */
outletInventoryRouter.patch(
  '/inventory/:menuItemId',
  validate(adjustInventorySchemas),
  asyncHandler(adjustInventoryController),
);
