import { pool } from '../db/pool';
import {
  countMenuItems,
  insertMenuItem,
  listMenuItems,
  updateMenuItem,
} from '../repositories/menu-item.repository';
import type { MenuItem, MenuItemFilter, NewMenuItem } from '../repositories/menu-item.repository';
import { conflict, notFound } from '../utils/app-error';
import type { Page, Pagination } from '../utils/pagination';
import { isUniqueViolation } from '../utils/pg-errors';

export interface MenuItemPatch {
  name?: string | undefined;
  category?: string | undefined;
  basePrice?: string | undefined;
  isActive?: boolean | undefined;
}

export const getMenuItems = async (
  filter: MenuItemFilter,
  page: Pagination,
): Promise<Page<MenuItem>> => {
  const [items, total] = await Promise.all([
    listMenuItems(pool, filter, page),
    countMenuItems(pool, filter),
  ]);
  return { items, total };
};

export const createMenuItem = async (input: NewMenuItem): Promise<MenuItem> => {
  try {
    return await insertMenuItem(pool, input);
  } catch (err) {
    if (isUniqueViolation(err, 'menu_items_sku_key')) {
      throw conflict('MENU_ITEM_SKU_TAKEN', `SKU "${input.sku}" is already in use`);
    }
    throw err;
  }
};

export const patchMenuItem = async (id: number, patch: MenuItemPatch): Promise<MenuItem> => {
  const updated = await updateMenuItem(pool, id, {
    name: patch.name ?? null,
    category: patch.category ?? null,
    basePrice: patch.basePrice ?? null,
    isActive: patch.isActive ?? null,
  });
  if (!updated) throw notFound('MENU_ITEM_NOT_FOUND', `Menu item ${String(id)} not found`);
  return updated;
};
