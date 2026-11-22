import type { Response } from 'express';
import type { ValidatedRequest } from '../middlewares/validate';
import { getRevenueByOutlet, getTopItems } from '../services/report.service';
import type { revenueByOutletSchemas, topItemsSchemas } from '../validators/report.validators';

export const revenueByOutletController = async (
  req: ValidatedRequest<typeof revenueByOutletSchemas>,
  res: Response,
): Promise<void> => {
  const { from, to } = req.query;
  const { outlets, grandTotal, totalSales } = await getRevenueByOutlet({ from, to });
  res.status(200).json({ data: outlets, meta: { grandTotal, totalSales } });
};

export const topItemsController = async (
  req: ValidatedRequest<typeof topItemsSchemas>,
  res: Response,
): Promise<void> => {
  const { from, to, limit } = req.query;
  const data = await getTopItems(req.params.outletId, { from, to }, limit);
  res.status(200).json({ data });
};
