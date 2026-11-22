import type { Response } from 'express';
import type { ValidatedRequest } from '../middlewares/validate';
import { createMenuItem, getMenuItems, patchMenuItem } from '../services/menu-item.service';
import { toListMeta } from '../utils/pagination';
import type {
  createMenuItemSchemas,
  listMenuItemsSchemas,
  updateMenuItemSchemas,
} from '../validators/menu-item.validators';

export const listMenuItemsController = async (
  req: ValidatedRequest<typeof listMenuItemsSchemas>,
  res: Response,
): Promise<void> => {
  const { limit, offset, ...filter } = req.query;
  const page = { limit, offset };
  const { items, total } = await getMenuItems(filter, page);
  res.status(200).json({ data: items, meta: toListMeta(total, page) });
};

export const createMenuItemController = async (
  req: ValidatedRequest<typeof createMenuItemSchemas>,
  res: Response,
): Promise<void> => {
  const data = await createMenuItem(req.body);
  res.status(201).json({ data });
};

export const updateMenuItemController = async (
  req: ValidatedRequest<typeof updateMenuItemSchemas>,
  res: Response,
): Promise<void> => {
  const data = await patchMenuItem(req.params.id, req.body);
  res.status(200).json({ data });
};
