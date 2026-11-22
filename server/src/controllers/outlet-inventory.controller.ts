import type { Response } from 'express';
import type { ValidatedRequest } from '../middlewares/validate';
import { adjustStock, getInventory, getSellableMenu } from '../services/outlet-inventory.service';
import { toListMeta } from '../utils/pagination';
import type {
  adjustInventorySchemas,
  listInventorySchemas,
  listSellableMenuSchemas,
} from '../validators/outlet-inventory.validators';

export const listSellableMenuController = async (
  req: ValidatedRequest<typeof listSellableMenuSchemas>,
  res: Response,
): Promise<void> => {
  const data = await getSellableMenu(req.params.outletId, req.query);
  res.status(200).json({ data });
};

export const listInventoryController = async (
  req: ValidatedRequest<typeof listInventorySchemas>,
  res: Response,
): Promise<void> => {
  const { limit, offset, status } = req.query;
  const page = { limit, offset };
  const { items, total } = await getInventory(req.params.outletId, { status }, page);
  res.status(200).json({ data: items, meta: toListMeta(total, page) });
};

export const adjustInventoryController = async (
  req: ValidatedRequest<typeof adjustInventorySchemas>,
  res: Response,
): Promise<void> => {
  const { outletId, menuItemId } = req.params;
  const data = await adjustStock(outletId, menuItemId, req.body.adjustment);
  res.status(200).json({ data });
};
