import { useState } from 'react';
import type { SellableMenuItem } from '@/api/types';
import { EmptyState } from '@/components/common/states';
import { StockBadge } from '@/components/common/StockBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatMoney } from '@/lib/money';
import { stockStatus } from '@/lib/stock';
import { cn } from '@/lib/utils';
import type { Cart } from './cart';

const ALL = 'All';
const SEARCH_ID = 'pos-search';

interface MenuGridProps {
  menu: readonly SellableMenuItem[];
  cart: Cart;
  onAdd: (item: SellableMenuItem) => void;
}

const matches = (item: SellableMenuItem, category: string, search: string): boolean => {
  if (category !== ALL && item.category !== category) return false;
  if (!search) return true;
  return item.name.toLowerCase().includes(search) || item.sku.toLowerCase().includes(search);
};

/** Category pills + search over the outlet's sellable items; a card click adds one to the cart. */
export const MenuGrid = ({ menu, cart, onAdd }: MenuGridProps) => {
  const [category, setCategory] = useState(ALL);
  const [search, setSearch] = useState('');

  const categories = [ALL, ...new Set(menu.map((item) => item.category))];
  const needle = search.trim().toLowerCase();
  const visible = menu.filter((item) => matches(item, category, needle));

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Categories" className="flex flex-wrap gap-2">
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={category === name}
              onClick={() => {
                setCategory(name);
              }}
              className={cn(
                'min-h-9 rounded-full border px-4 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                category === name
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-muted',
              )}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-[240px]">
          <Label htmlFor={SEARCH_ID} className="sr-only">
            Search items
          </Label>
          <Input
            id={SEARCH_ID}
            type="search"
            placeholder="Search items"
            maxLength={100}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No items match" description="Try another category or search." />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((item) => {
            const inCart = cart.get(item.menuItemId) ?? 0;
            const soldOut = item.quantity === 0;
            const atLimit = inCart >= item.quantity;
            return (
              <button
                key={item.menuItemId}
                type="button"
                disabled={atLimit}
                onClick={() => {
                  onAdd(item);
                }}
                aria-label={`Add ${item.name}, ${formatMoney(item.effectivePrice)}`}
                className="flex min-h-[132px] flex-col justify-between gap-3 rounded-card border border-border bg-card p-4 text-left transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border"
              >
                <span className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-subtle-foreground">
                    {item.category}
                  </span>
                  <span className="text-[15px] font-semibold text-foreground">{item.name}</span>
                </span>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[15px] font-bold tabular-nums">
                    {formatMoney(item.effectivePrice)}
                  </span>
                  <StockBadge status={stockStatus(item.quantity)} quantity={item.quantity} />
                </span>
                {!soldOut && atLimit ? (
                  <span className="text-xs text-subtle-foreground">All stock is in the cart</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
