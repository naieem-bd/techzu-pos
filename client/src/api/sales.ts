import { request, requestEnvelope } from './http';
import type { CreateSaleBody, ListMeta, ListResult, Sale, SaleListParams } from './types';

const salesPath = (outletId: number): string => `/outlets/${outletId.toString()}/sales`;

export const createSale = (outletId: number, body: CreateSaleBody): Promise<Sale> =>
  request<Sale>(salesPath(outletId), { method: 'POST', body });

export const listSales = (
  outletId: number,
  params: SaleListParams = {},
): Promise<ListResult<Sale>> =>
  requestEnvelope<Sale[], ListMeta>(salesPath(outletId), { query: { ...params } });
