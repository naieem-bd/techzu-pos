import type { Money, SaleLineInput, SellableMenuItem } from '@/api/types';
import { fromCents, toCents } from '@/lib/money';

/** menuItemId -> quantity. Insertion order is the order lines were added. */
export type Cart = ReadonlyMap<number, number>;

export interface CartLine {
  item: SellableMenuItem;
  quantity: number;
  lineTotal: Money;
}

export const EMPTY_CART: Cart = new Map();

/** Sets one line's quantity; 0 or less removes the line. */
export const setQuantity = (cart: Cart, menuItemId: number, quantity: number): Cart => {
  const next = new Map(cart);
  if (quantity <= 0) next.delete(menuItemId);
  else next.set(menuItemId, quantity);
  return next;
};

/** unitPrice × quantity in integer cents, never float. */
export const lineTotal = (unitPrice: Money, quantity: number): Money =>
  fromCents(toCents(unitPrice) * BigInt(quantity));

/** Cart lines joined with the current menu; lines whose item left the menu are dropped. */
export const toCartLines = (cart: Cart, menu: readonly SellableMenuItem[]): CartLine[] => {
  const byId = new Map(menu.map((item) => [item.menuItemId, item]));
  const lines: CartLine[] = [];
  for (const [menuItemId, quantity] of cart) {
    const item = byId.get(menuItemId);
    if (!item) continue;
    lines.push({ item, quantity, lineTotal: lineTotal(item.effectivePrice, quantity) });
  }
  return lines;
};

export const cartTotal = (lines: readonly CartLine[]): Money =>
  fromCents(lines.reduce((sum, line) => sum + toCents(line.lineTotal), 0n));

export const itemCount = (lines: readonly CartLine[]): number =>
  lines.reduce((sum, line) => sum + line.quantity, 0);

/** After stock changed (e.g. a 409): cap every line at the fresh stock, drop sold-out lines. */
export const clampToStock = (cart: Cart, menu: readonly SellableMenuItem[]): Cart => {
  const stock = new Map(menu.map((item) => [item.menuItemId, item.quantity]));
  const next = new Map<number, number>();
  for (const [menuItemId, quantity] of cart) {
    const capped = Math.min(quantity, stock.get(menuItemId) ?? 0);
    if (capped > 0) next.set(menuItemId, capped);
  }
  return next;
};

export const toSaleLines = (lines: readonly CartLine[]): SaleLineInput[] =>
  lines.map(({ item, quantity }) => ({ menuItemId: item.menuItemId, quantity }));
