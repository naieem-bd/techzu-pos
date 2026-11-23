import { useState } from 'react';
import { isApiError } from '@/api/http';
import type { Outlet, Sale, SellableMenuItem } from '@/api/types';
import { OutletGate } from '@/components/common/OutletGate';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState } from '@/components/common/states';
import { Skeleton } from '@/components/ui/skeleton';
import { toastError } from '@/hooks/error-toast';
import { useSellableMenu } from '@/hooks/use-outlet-inventory';
import { useCreateSale } from '@/hooks/use-sales';
import {
  cartTotal,
  clampToStock,
  EMPTY_CART,
  itemCount,
  setQuantity,
  toCartLines,
  toSaleLines,
} from './cart';
import type { Cart } from './cart';
import { CartPanel } from './CartPanel';
import { MenuGrid } from './MenuGrid';
import { ReceiptDialog } from './ReceiptDialog';

const TITLE = 'New sale';

const PosScreen = ({ outlet }: { outlet: Outlet }) => {
  const menu = useSellableMenu(outlet.id);
  const createSale = useCreateSale(outlet.id);
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  const items = menu.data ?? [];
  const lines = toCartLines(cart, items);
  const total = cartTotal(lines);

  const changeQuantity = (menuItemId: number, quantity: number) => {
    const stock = items.find((item) => item.menuItemId === menuItemId)?.quantity ?? 0;
    setCart((current) => setQuantity(current, menuItemId, Math.min(quantity, stock)));
  };

  const addItem = (item: SellableMenuItem) => {
    changeQuantity(item.menuItemId, (cart.get(item.menuItemId) ?? 0) + 1);
  };

  const refreshStock = async () => {
    const { data: freshMenu } = await menu.refetch();
    if (freshMenu) setCart((current) => clampToStock(current, freshMenu));
  };

  const checkout = () => {
    createSale.mutate(
      { items: toSaleLines(lines) },
      {
        onSuccess: (sale) => {
          setReceipt(sale);
          setLastSale(sale);
          setCart(EMPTY_CART);
        },
        onError: (error) => {
          toastError(error);
          // Someone else sold (or stock was adjusted) in the meantime: show the real stock and
          // cap the cart to it so the next checkout can succeed.
          if (isApiError(error) && error.code === 'INSUFFICIENT_STOCK') void refreshStock();
        },
      },
    );
  };

  const renderMenu = () => {
    if (menu.isPending) {
      return (
        <div
          role="status"
          aria-label="Loading menu"
          className="grid grid-cols-2 gap-3 md:grid-cols-3"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-[132px]" />
          ))}
        </div>
      );
    }
    if (menu.isError) return <ErrorState error={menu.error} onRetry={() => void menu.refetch()} />;
    if (items.length === 0) {
      return (
        <EmptyState
          title="Nothing to sell yet"
          description="HQ has not assigned any available, active items to this outlet."
        />
      );
    }
    return <MenuGrid menu={items} cart={cart} onAdd={addItem} />;
  };

  return (
    <>
      <PageHeader
        title={TITLE}
        description={`${outlet.name} · only items HQ assigned to this outlet are shown`}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {renderMenu()}
        <CartPanel
          lines={lines}
          itemCount={itemCount(lines)}
          total={total}
          isPending={createSale.isPending}
          lastSale={lastSale}
          onQuantityChange={changeQuantity}
          onClear={() => {
            setCart(EMPTY_CART);
          }}
          onCheckout={checkout}
        />
      </div>
      <ReceiptDialog
        sale={receipt}
        onClose={() => {
          setReceipt(null);
        }}
      />
    </>
  );
};

export const PosPage = () => (
  <OutletGate title={TITLE}>{(outlet) => <PosScreen key={outlet.id} outlet={outlet} />}</OutletGate>
);
