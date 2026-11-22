import type { Response } from 'express';
import type { ValidatedRequest } from '../middlewares/validate';
import { createSale, getSale, getSales } from '../services/sale.service';
import { toListMeta } from '../utils/pagination';
import type {
  createSaleSchemas,
  getSaleSchemas,
  listSalesSchemas,
} from '../validators/sale.validators';

export const createSaleController = async (
  req: ValidatedRequest<typeof createSaleSchemas>,
  res: Response,
): Promise<void> => {
  const data = await createSale(req.params.outletId, req.body.items);
  res.status(201).json({ data });
};

export const listSalesController = async (
  req: ValidatedRequest<typeof listSalesSchemas>,
  res: Response,
): Promise<void> => {
  const { limit, offset, from, to, receiptNumber } = req.query;
  const page = { limit, offset };
  const { items, total } = await getSales(req.params.outletId, { from, to, receiptNumber }, page);
  res.status(200).json({ data: items, meta: toListMeta(total, page) });
};

export const getSaleController = async (
  req: ValidatedRequest<typeof getSaleSchemas>,
  res: Response,
): Promise<void> => {
  const data = await getSale(req.params.outletId, req.params.saleId);
  res.status(200).json({ data });
};
