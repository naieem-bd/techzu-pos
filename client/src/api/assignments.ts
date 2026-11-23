import { request, requestEnvelope } from './http';
import type {
  AssignMenuItemBody,
  ListMeta,
  ListResult,
  OutletMenuItem,
  OutletMenuItemListParams,
  UpdateAssignmentBody,
} from './types';

const basePath = (outletId: number): string => `/outlets/${outletId.toString()}/menu-items`;

export const listOutletMenuItems = (
  outletId: number,
  params: OutletMenuItemListParams = {},
): Promise<ListResult<OutletMenuItem>> =>
  requestEnvelope<OutletMenuItem[], ListMeta>(basePath(outletId), { query: { ...params } });

export const assignMenuItem = (
  outletId: number,
  body: AssignMenuItemBody,
): Promise<OutletMenuItem> => request<OutletMenuItem>(basePath(outletId), { method: 'POST', body });

export const updateAssignment = (
  outletId: number,
  menuItemId: number,
  body: UpdateAssignmentBody,
): Promise<OutletMenuItem> =>
  request<OutletMenuItem>(`${basePath(outletId)}/${menuItemId.toString()}`, {
    method: 'PATCH',
    body,
  });

export const unassignMenuItem = (outletId: number, menuItemId: number): Promise<void> =>
  request<undefined>(`${basePath(outletId)}/${menuItemId.toString()}`, { method: 'DELETE' });
