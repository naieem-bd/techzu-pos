import type { Response } from 'express';
import type { ValidatedRequest } from '../middlewares/validate';
import {
  assignMenuItem,
  getOutletMenu,
  patchAssignment,
  unassignMenuItem,
} from '../services/outlet-menu-item.service';
import { toListMeta } from '../utils/pagination';
import type {
  assignMenuItemSchemas,
  listOutletMenuSchemas,
  unassignMenuItemSchemas,
  updateAssignmentSchemas,
} from '../validators/outlet-menu-item.validators';

export const listOutletMenuController = async (
  req: ValidatedRequest<typeof listOutletMenuSchemas>,
  res: Response,
): Promise<void> => {
  const { limit, offset, ...filter } = req.query;
  const page = { limit, offset };
  const { items, total } = await getOutletMenu(req.params.outletId, filter, page);
  res.status(200).json({ data: items, meta: toListMeta(total, page) });
};

export const assignMenuItemController = async (
  req: ValidatedRequest<typeof assignMenuItemSchemas>,
  res: Response,
): Promise<void> => {
  const data = await assignMenuItem(req.params.outletId, req.body);
  res.status(201).json({ data });
};

export const updateAssignmentController = async (
  req: ValidatedRequest<typeof updateAssignmentSchemas>,
  res: Response,
): Promise<void> => {
  const { outletId, menuItemId } = req.params;
  const data = await patchAssignment(outletId, menuItemId, req.body);
  res.status(200).json({ data });
};

export const unassignMenuItemController = async (
  req: ValidatedRequest<typeof unassignMenuItemSchemas>,
  res: Response,
): Promise<void> => {
  const { outletId, menuItemId } = req.params;
  await unassignMenuItem(outletId, menuItemId);
  res.status(204).end();
};
