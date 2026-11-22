import { pool } from '../db/pool';
import {
  adjustInventory,
  countInventory,
  findInventoryQuantity,
  listInventory,
} from '../repositories/inventory.repository';
import type { InventoryFilter, InventoryItem } from '../repositories/inventory.repository';
import { listSellableMenu } from '../repositories/outlet-menu-item.repository';
import type {
  SellableMenuFilter,
  SellableMenuItem,
} from '../repositories/outlet-menu-item.repository';
import { conflict, notFound } from '../utils/app-error';
import type { Page, Pagination } from '../utils/pagination';
import { assertOutletExists } from './outlet.service';

/** Stock at or below this (but above zero) is reported as 'low'. */
export const LOW_STOCK_THRESHOLD = 5;

/** An outlet menu is small, so /menu is unpaginated; this cap bounds the response anyway. */
export const MAX_SELLABLE_MENU_ROWS = 500;

export const getSellableMenu = async (
  outletId: number,
  filter: SellableMenuFilter,
): Promise<SellableMenuItem[]> => {
  await assertOutletExists(pool, outletId);
  return listSellableMenu(pool, outletId, filter, MAX_SELLABLE_MENU_ROWS);
};

export const getInventory = async (
  outletId: number,
  filter: InventoryFilter,
  page: Pagination,
): Promise<Page<InventoryItem>> => {
  await assertOutletExists(pool, outletId);
  const [items, total] = await Promise.all([
    listInventory(pool, outletId, LOW_STOCK_THRESHOLD, filter, page),
    countInventory(pool, outletId, LOW_STOCK_THRESHOLD, filter),
  ]);
  return { items, total };
};

/**
 * The adjustment is a single conditional UPDATE (atomic on its own, so no transaction is
 * needed). Only when it changes nothing do we look at the row, to tell the caller why. That
 * read never decides a write, so it cannot cause a lost update.
 */
export const adjustStock = async (
  outletId: number,
  menuItemId: number,
  adjustment: number,
): Promise<InventoryItem> => {
  await assertOutletExists(pool, outletId);

  const updated = await adjustInventory(
    pool,
    outletId,
    LOW_STOCK_THRESHOLD,
    menuItemId,
    adjustment,
  );
  if (updated) return updated;

  const currentQuantity = await findInventoryQuantity(pool, outletId, menuItemId);
  if (currentQuantity === null) {
    throw notFound(
      'ASSIGNMENT_NOT_FOUND',
      `Menu item ${String(menuItemId)} is not assigned to outlet ${String(outletId)}`,
    );
  }
  throw conflict(
    'INSUFFICIENT_STOCK',
    `Adjustment of ${String(adjustment)} would make stock negative`,
    { menuItemId, currentQuantity, adjustment },
  );
};
