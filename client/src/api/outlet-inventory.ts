import { request, requestEnvelope } from './http';
import type {
  AdjustInventoryBody,
  InventoryItem,
  InventoryListParams,
  ListMeta,
  ListResult,
  SellableMenuItem,
} from './types';

const outletPath = (outletId: number): string => `/outlets/${outletId.toString()}`;

/** Everything the POS can sell right now (unpaginated, server caps it at 500 rows). */
export const getSellableMenu = (outletId: number): Promise<SellableMenuItem[]> =>
  request<SellableMenuItem[]>(`${outletPath(outletId)}/menu`);

export const listInventory = (
  outletId: number,
  params: InventoryListParams = {},
): Promise<ListResult<InventoryItem>> =>
  requestEnvelope<InventoryItem[], ListMeta>(`${outletPath(outletId)}/inventory`, {
    query: { ...params },
  });

export const adjustInventory = (
  outletId: number,
  menuItemId: number,
  body: AdjustInventoryBody,
): Promise<InventoryItem> =>
  request<InventoryItem>(`${outletPath(outletId)}/inventory/${menuItemId.toString()}`, {
    method: 'PATCH',
    body,
  });
