import type { Queryable } from '../db/pool';

/**
 * Has this item ever been sold at this outlet? Uses sale_items_menu_item_id_idx and the
 * sales PK; keeps receipts (which copy prices) from losing their assignment context.
 */
export const hasSalesForItemAtOutlet = async (
  db: Queryable,
  outletId: number,
  menuItemId: number,
): Promise<boolean> => {
  const { rows } = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.outlet_id = $1 AND si.menu_item_id = $2
     ) AS exists`,
    [outletId, menuItemId],
  );
  return rows[0]?.exists === true;
};
