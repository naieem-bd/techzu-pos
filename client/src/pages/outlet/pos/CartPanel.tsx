import { Minus, Plus } from 'lucide-react';
import type { Sale } from '@/api/types';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { CartLine } from './cart';

interface CartPanelProps {
  lines: readonly CartLine[];
  itemCount: number;
  total: string;
  isPending: boolean;
  lastSale: Sale | null;
  onQuantityChange: (menuItemId: number, quantity: number) => void;
  onClear: () => void;
  onCheckout: () => void;
}

export const CartPanel = ({
  lines,
  itemCount,
  total,
  isPending,
  lastSale,
  onQuantityChange,
  onClear,
  onCheckout,
}: CartPanelProps) => (
  <section
    aria-labelledby="cart-heading"
    className="flex flex-col gap-4 self-start rounded-card border border-border bg-card p-5 lg:sticky lg:top-6"
  >
    <div className="flex items-center justify-between">
      <h2 id="cart-heading" className="m-0 text-lg font-semibold">
        Current sale
      </h2>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        disabled={lines.length === 0 || isPending}
      >
        Clear
      </Button>
    </div>

    {lines.length === 0 ? (
      <p className="m-0 rounded-control border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Tap an item to add it to the sale.
      </p>
    ) : (
      <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
        {lines.map(({ item, quantity, lineTotal }) => (
          <li key={item.menuItemId} className="flex flex-col gap-2 py-3 first:pt-0">
            <div className="flex items-start justify-between gap-3">
              <span className="font-semibold">{item.name}</span>
              <span className="font-semibold tabular-nums">{formatMoney(lineTotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-subtle-foreground">
                {formatMoney(item.effectivePrice)} each
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="size-8 px-0"
                  aria-label={`Decrease ${item.name}`}
                  disabled={isPending}
                  onClick={() => {
                    onQuantityChange(item.menuItemId, quantity - 1);
                  }}
                >
                  <Minus aria-hidden="true" />
                </Button>
                <span className="min-w-6 text-center font-semibold tabular-nums" aria-live="polite">
                  {quantity}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="size-8 px-0"
                  aria-label={`Increase ${item.name}`}
                  disabled={isPending || quantity >= item.quantity}
                  onClick={() => {
                    onQuantityChange(item.menuItemId, quantity + 1);
                  }}
                >
                  <Plus aria-hidden="true" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    )}

    <div className="flex flex-col gap-1.5 border-t border-border pt-4">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Items</span>
        <span className="tabular-nums">{itemCount}</span>
      </div>
      <div className="flex justify-between text-lg font-bold">
        <span>Total</span>
        <span className="tabular-nums">{formatMoney(total)}</span>
      </div>
    </div>

    <Button onClick={onCheckout} disabled={lines.length === 0 || isPending}>
      {isPending ? 'Processing…' : `Checkout · ${formatMoney(total)}`}
    </Button>

    {lastSale ? (
      <p className="m-0 text-center text-[13px] text-subtle-foreground">
        Last receipt: <span className="font-mono">{lastSale.receiptNo}</span> ·{' '}
        {formatDateTime(lastSale.createdAt)}
      </p>
    ) : null}
  </section>
);
