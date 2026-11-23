import { request, requestEnvelope } from './http';
import type {
  CreateMenuItemBody,
  ListMeta,
  ListResult,
  MenuItem,
  MenuItemListParams,
  UpdateMenuItemBody,
} from './types';

export const listMenuItems = (params: MenuItemListParams = {}): Promise<ListResult<MenuItem>> =>
  requestEnvelope<MenuItem[], ListMeta>('/menu-items', { query: { ...params } });

export const createMenuItem = (body: CreateMenuItemBody): Promise<MenuItem> =>
  request<MenuItem>('/menu-items', { method: 'POST', body });

export const updateMenuItem = (id: number, body: UpdateMenuItemBody): Promise<MenuItem> =>
  request<MenuItem>(`/menu-items/${id.toString()}`, { method: 'PATCH', body });
