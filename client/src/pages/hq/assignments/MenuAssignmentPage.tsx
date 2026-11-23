import { useState } from 'react';
import type { OutletMenuItem } from '@/api/types';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOutletMenuItems } from '@/hooks/use-outlet-menu-items';
import { useAllOutlets } from '@/hooks/use-outlets';
import { useViewAs } from '@/hooks/use-view-as';
import { AssignmentRow } from './AssignmentRow';

// The API's max page size: a typical outlet menu fits one page, so the summary is exact.
const PAGE_SIZE = 100;
const OUTLET_SELECT_ID = 'assignment-outlet';

const summarize = (items: OutletMenuItem[]) => ({
  assigned: items.filter((item) => item.assigned).length,
  overrides: items.filter((item) => item.priceOverride !== null).length,
  unavailable: items.filter((item) => item.isAvailable === false).length,
});

export const MenuAssignmentPage = () => {
  const { viewAs } = useViewAs();
  const outlets = useAllOutlets();
  const [pickedOutletId, setPickedOutletId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);

  const outletList = outlets.data?.data ?? [];
  const preferredId = viewAs.kind === 'outlet' ? viewAs.outletId : undefined;
  const outletId =
    pickedOutletId ??
    outletList.find((outlet) => outlet.id === preferredId)?.id ??
    outletList[0]?.id ??
    null;

  const items = useOutletMenuItems(outletId, { limit: PAGE_SIZE, offset });

  const renderTable = () => {
    if (outletId === null) return null;
    if (items.isPending) return <TableSkeleton columns={7} label="Loading menu assignment" />;
    if (items.isError) {
      return <ErrorState error={items.error} onRetry={() => void items.refetch()} />;
    }
    const { data, meta } = items.data;
    if (meta.total === 0) {
      return (
        <EmptyState
          title="The master menu is empty"
          description="Add items on the Master menu page, then assign them here."
        />
      );
    }
    return (
      <>
        <Table aria-label="Menu assignment">
          <TableHeader>
            <TableRow>
              <TableHead>Assigned</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Base price</TableHead>
              <TableHead className="text-right">Override</TableHead>
              <TableHead className="text-right">Effective price</TableHead>
              <TableHead>Available</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <AssignmentRow key={item.menuItemId} outletId={outletId} item={item} />
            ))}
          </TableBody>
        </Table>
        {meta.total > meta.limit ? (
          <Pagination meta={meta} onOffsetChange={setOffset} disabled={items.isFetching} />
        ) : null}
        <p className="m-0 text-[13px] text-subtle-foreground">
          Effective price = override if set, otherwise the base price. Leave the override empty to
          use the base price. Changes save when you leave the field or press Enter.
        </p>
      </>
    );
  };

  const renderSummary = () => {
    if (!items.data) return null;
    const { assigned, overrides, unavailable } = summarize(items.data.data);
    const scope = items.data.meta.total > items.data.meta.limit ? ' on this page' : '';
    return (
      <div className="flex flex-wrap gap-2 pb-2.5" aria-live="polite">
        <Badge variant="accent">
          {assigned} of {items.data.meta.total} assigned{scope}
        </Badge>
        <Badge variant="neutral">
          {overrides} price override{overrides === 1 ? '' : 's'}
        </Badge>
        <Badge variant={unavailable > 0 ? 'warn' : 'neutral'}>{unavailable} unavailable</Badge>
      </div>
    );
  };

  const renderOutletPicker = () => {
    if (outlets.isPending) return <Skeleton className="h-11 w-full sm:w-[280px]" />;
    return (
      <Select
        value={outletId?.toString() ?? ''}
        disabled={outletList.length === 0}
        onValueChange={(value) => {
          setPickedOutletId(Number(value));
          setOffset(0);
        }}
      >
        <SelectTrigger id={OUTLET_SELECT_ID}>
          <SelectValue placeholder="No outlets" />
        </SelectTrigger>
        <SelectContent>
          {outletList.map((outlet) => (
            <SelectItem key={outlet.id} value={outlet.id.toString()}>
              {outlet.name} ({outlet.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const renderContent = () => {
    if (outlets.isError) {
      return <ErrorState error={outlets.error} onRetry={() => void outlets.refetch()} />;
    }
    if (outlets.data && outletList.length === 0) {
      return (
        <EmptyState
          title="No outlets yet"
          description="Create an outlet on the Outlets page before assigning menu items."
        />
      );
    }
    return (
      <>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex w-full flex-col gap-1.5 sm:w-[280px]">
            <Label htmlFor={OUTLET_SELECT_ID}>Outlet</Label>
            {renderOutletPicker()}
          </div>
          {renderSummary()}
        </div>
        {renderTable()}
      </>
    );
  };

  return (
    <>
      <PageHeader
        title="Menu assignment"
        description="Choose which master items an outlet sells, and override the price per outlet"
      />
      {renderContent()}
    </>
  );
};
