import type { DateRange, OutletRevenue } from '@/api/types';
import { EmptyState, ErrorState } from '@/components/common/states';
import { CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TOP_ITEMS_LIMIT, useTopItems } from '@/hooks/use-reports';
import { formatMoney } from '@/lib/money';

const SELECT_ID = 'top-items-outlet';

interface TopItemsProps {
  outlets: OutletRevenue[];
  outletId: number | null;
  onOutletChange: (outletId: number) => void;
  range: DateRange;
}

export const TopItems = ({ outlets, outletId, onOutletChange, range }: TopItemsProps) => {
  const topItems = useTopItems(outletId, range);

  const renderList = () => {
    if (outletId === null) return <EmptyState title="No outlets yet" />;
    if (topItems.isPending) {
      return (
        <div role="status" aria-label="Loading top items" className="flex flex-col gap-3 py-2">
          {Array.from({ length: TOP_ITEMS_LIMIT }, (_, index) => (
            <Skeleton key={index} className="h-6" />
          ))}
        </div>
      );
    }
    if (topItems.isError) {
      return <ErrorState error={topItems.error} onRetry={() => void topItems.refetch()} />;
    }
    if (topItems.data.length === 0) {
      return <EmptyState title="No sales in this period" description="Try a wider date range." />;
    }
    return (
      <ol className="m-0 list-none p-0">
        {topItems.data.map((item, index) => (
          <li
            key={item.menuItemId}
            className="grid grid-cols-[28px_minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border py-3 text-sm last:border-b-0"
          >
            <span className="font-bold text-primary">{index + 1}</span>
            <span className="truncate font-semibold">{item.name}</span>
            <span className="text-right text-muted-foreground tabular-nums">
              {item.quantitySold} sold
            </span>
            <span className="min-w-[84px] text-right font-semibold tabular-nums">
              {formatMoney(item.revenue)}
            </span>
          </li>
        ))}
      </ol>
    );
  };

  return (
    <>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <CardTitle>Top {TOP_ITEMS_LIMIT} items</CardTitle>
        <div className="flex w-[200px] flex-col gap-1.5">
          <Label htmlFor={SELECT_ID} className="text-xs font-medium text-subtle-foreground">
            Outlet
          </Label>
          <Select
            value={outletId?.toString() ?? ''}
            disabled={outlets.length === 0}
            onValueChange={(value) => {
              onOutletChange(Number(value));
            }}
          >
            <SelectTrigger id={SELECT_ID}>
              <SelectValue placeholder="Select outlet" />
            </SelectTrigger>
            <SelectContent>
              {outlets.map((outlet) => (
                <SelectItem key={outlet.outletId} value={outlet.outletId.toString()}>
                  {outlet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {renderList()}
      <p className="mb-0 mt-3 text-xs text-subtle-foreground">
        Ranked by quantity sold; ties broken by revenue.
      </p>
    </>
  );
};
