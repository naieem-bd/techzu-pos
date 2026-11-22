import type { Response } from 'express';
import type { ValidatedRequest } from '../middlewares/validate';
import { createOutlet, getOutlets } from '../services/outlet.service';
import { toListMeta } from '../utils/pagination';
import type { createOutletSchemas, listOutletsSchemas } from '../validators/outlet.validators';

export const listOutletsController = async (
  req: ValidatedRequest<typeof listOutletsSchemas>,
  res: Response,
): Promise<void> => {
  const { limit, offset, search } = req.query;
  const page = { limit, offset };
  const { items, total } = await getOutlets({ search }, page);
  res.status(200).json({ data: items, meta: toListMeta(total, page) });
};

export const createOutletController = async (
  req: ValidatedRequest<typeof createOutletSchemas>,
  res: Response,
): Promise<void> => {
  const { code, name, address } = req.body;
  const data = await createOutlet({ code, name, address: address ?? null });
  res.status(201).json({ data });
};
