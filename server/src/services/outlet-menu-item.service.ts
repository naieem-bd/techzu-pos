import { pool } from '../db/pool';
import { withTransaction } from '../db/transaction';
import {
  deleteInventory,
  insertInventory,
  lockInventory,
} from '../repositories/inventory.repository';
import { findMenuItemById } from '../repositories/menu-item.repository';
import {
  countOutletMenu,
  deleteAssignment,
  findOutletMenuItem,
  insertAssignment,
  listOutletMenu,
  lockAssignment,
  updateAssignment,
} from '../repositories/outlet-menu-item.repository';
import type { OutletMenuFilter, OutletMenuItem } from '../repositories/outlet-menu-item.repository';
import { hasSalesForItemAtOutlet } from '../repositories/sale.repository';
import { conflict, notFound, unprocessable } from '../utils/app-error';
import type { Page, Pagination } from '../utils/pagination';
import { isUniqueViolation } from '../utils/pg-errors';
import { assertOutletExists } from './outlet.service';

export interface AssignInput {
  menuItemId: number;
  priceOverride?: string | null | undefined;
}

export interface AssignmentPatch {
  priceOverride?: string | null | undefined;
  isAvailable?: boolean | undefined;
}

const assignmentNotFound = (outletId: number, menuItemId: number) =>
  notFound(
    'ASSIGNMENT_NOT_FOUND',
    `Menu item ${String(menuItemId)} is not assigned to outlet ${String(outletId)}`,
  );

/** Reads back the row just written in the same transaction; it must exist. */
const readAssigned = async (
  ...args: Parameters<typeof findOutletMenuItem>
): Promise<OutletMenuItem> => {
  const row = await findOutletMenuItem(...args);
  if (!row) throw new Error('Assigned menu item vanished inside its own transaction');
  return row;
};

export const getOutletMenu = async (
  outletId: number,
  filter: OutletMenuFilter,
  page: Pagination,
): Promise<Page<OutletMenuItem>> => {
  await assertOutletExists(pool, outletId);
  const [items, total] = await Promise.all([
    listOutletMenu(pool, outletId, filter, page),
    countOutletMenu(pool, outletId, filter),
  ]);
  return { items, total };
};

/** Assignment + its zero-stock inventory row are created atomically. */
export const assignMenuItem = (outletId: number, input: AssignInput): Promise<OutletMenuItem> =>
  withTransaction(async (client) => {
    await assertOutletExists(client, outletId);

    const item = await findMenuItemById(client, input.menuItemId);
    if (!item) {
      throw notFound('MENU_ITEM_NOT_FOUND', `Menu item ${String(input.menuItemId)} not found`);
    }
    if (!item.isActive) {
      throw unprocessable(
        'MENU_ITEM_INACTIVE',
        `Menu item ${String(item.id)} is inactive and cannot be assigned`,
      );
    }

    try {
      await insertAssignment(client, {
        outletId,
        menuItemId: item.id,
        priceOverride: input.priceOverride ?? null,
      });
    } catch (err) {
      // Caught on the constraint (not pre-checked) so two concurrent assigns can't both pass.
      if (isUniqueViolation(err, 'outlet_menu_items_outlet_item_key')) {
        throw conflict(
          'ALREADY_ASSIGNED',
          `Menu item ${String(item.id)} is already assigned to outlet ${String(outletId)}`,
        );
      }
      throw err;
    }
    await insertInventory(client, outletId, item.id);

    return readAssigned(client, outletId, item.id);
  });

export const patchAssignment = (
  outletId: number,
  menuItemId: number,
  patch: AssignmentPatch,
): Promise<OutletMenuItem> =>
  withTransaction(async (client) => {
    await assertOutletExists(client, outletId);
    const updated = await updateAssignment(client, outletId, menuItemId, {
      priceOverrideProvided: patch.priceOverride !== undefined,
      priceOverride: patch.priceOverride ?? null,
      isAvailable: patch.isAvailable ?? null,
    });
    if (!updated) throw assignmentNotFound(outletId, menuItemId);
    return readAssigned(client, outletId, menuItemId);
  });

/**
 * Unassign is refused once the item has been sold at this outlet. Race safety: the inventory
 * row is locked BEFORE checking sales history. A sale that already deducted stock holds that
 * lock, so we wait for it to commit and then (READ COMMITTED: each statement sees the latest
 * commits) the history check sees it -> 409. A sale arriving after our lock waits, then finds
 * no inventory row and fails instead of selling an unassigned item.
 */
export const unassignMenuItem = (outletId: number, menuItemId: number): Promise<void> =>
  withTransaction(async (client) => {
    await assertOutletExists(client, outletId);
    if (!(await lockAssignment(client, outletId, menuItemId))) {
      throw assignmentNotFound(outletId, menuItemId);
    }
    await lockInventory(client, outletId, menuItemId);

    if (await hasSalesForItemAtOutlet(client, outletId, menuItemId)) {
      throw conflict(
        'HAS_SALES_HISTORY',
        `Menu item ${String(menuItemId)} has sales at outlet ${String(outletId)} and cannot be unassigned; mark it unavailable instead`,
      );
    }

    // inventory -> outlet_menu_items FK is RESTRICT, so the stock row goes first.
    await deleteInventory(client, outletId, menuItemId);
    await deleteAssignment(client, outletId, menuItemId);
  });
