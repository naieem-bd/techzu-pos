import type { StockStatus } from '@/api/types';

/** Mirrors LOW_STOCK_THRESHOLD in server/src/services/outlet-inventory.service.ts. */
export const LOW_STOCK_THRESHOLD = 5;

/** Same rule the server applies in SQL: 0 = out, 1..threshold = low, otherwise in stock. */
export const stockStatus = (quantity: number): StockStatus => {
  if (quantity <= 0) return 'out';
  if (quantity <= LOW_STOCK_THRESHOLD) return 'low';
  return 'in_stock';
};
