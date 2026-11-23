import { useState } from 'react';
import type { InventoryItem, InventoryListParams, Outlet, StockStatus } from '@/api/types';
import { OutletGate } from '@/components/common/OutletGate';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states';
import { StockBadge } from '@/components/common/StockBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useInventory } from '@/hooks/use-outlet-inventory';
import { formatDateTime } from '@/lib/dates';
import { AdjustStockDialog } from './AdjustStockDialog';

const TITLE = 'Inventory';
const PAGE_SIZE = 20;
const ALL = 'all';
const FILTER_ID = 'inventory-status';

type StatusFilter = typeof ALL | StockStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: ALL, label: 'All statuses' },
  { value: 'in_stock', label: 'In stock' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
];

const isStatusFilter = (value: string): value is StatusFilter =>
  STATUS_OPTIONS.some((option) => option.value === value);

/** One-row reads whose meta.total gives the header counts, whatever filter the table uses. */
const countParams = (status: StockStatus): InventoryListParams => ({ status, limit: 1 });

const InventoryScreen = ({ outlet }: { outlet: Outlet }) => {
  const [status, setStatus] = useState<StatusFilter>(ALL);
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<InventoryItem | null>(null);

  const params: InventoryListParams = { limit: PAGE_SIZE, offset };
  if (status !== ALL) params.status = status;
  const inventory = useInventory(outlet.id, params);
  const outCount = useInventory(outlet.id, countParams('out')).data?.meta.total;
  const lowCount = useInventory(outlet.id, countParams('low')).data?.meta.total;

  const renderBody = () => {
    if (inventory.isPending) return <TableSkeleton columns={6} label="Loading inventory" />;
    if (inventory.isError) {
      return <ErrorState error={inventory.error} onRetry={() => void inventory.refetch()} />;
    }
    const { data, meta } = inventory.data;
    if (meta.total === 0) {
      return status === ALL ? (
        <EmptyState
          title="No stock to manage yet"
          description="Items appear here once HQ assigns them to this outlet."
        />
      ) : (
        <EmptyState title="No items with this status" description="Try another filter." />
      );
    }
    return (
      <>
        <Table aria-label={`Inventory of ${outlet.name}`}>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">In stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last updated</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.menuItemId}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold">{item.name}</span>
                    <span className="font-mono text-xs text-subtle-foreground">{item.sku}</span>
                  </div>
                </TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {item.quantity}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    <StockBadge status={item.status} />
                    {/* Still stocked here, but the POS will not sell it. */}
                    {!item.isAvailable || !item.isActive ? (
                      <Badge variant="neutral">Not on sale</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(item.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Adjust stock of ${item.name}`}
                    onClick={() => {
                      setEditing(item);
                    }}
                  >
                    Adjust
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination meta={meta} onOffsetChange={setOffset} disabled={inventory.isFetching} />
      </>
    );
  };

  return (
    <>
      <PageHeader
        title={TITLE}
        description={`${outlet.name} · stock is tracked per outlet and reduced by every sale`}
        actions={
          outCount !== undefined && lowCount !== undefined ? (
            <div className="flex gap-2" aria-label="Stock alerts">
              <Badge variant="danger">{outCount} out of stock</Badge>
              <Badge variant="warn">{lowCount} low</Badge>
            </div>
          ) : null
        }
      />
      <div className="flex w-full flex-col gap-1.5 sm:w-[200px]">
        <Label htmlFor={FILTER_ID}>Status</Label>
        <Select
          value={status}
          onValueChange={(value) => {
            if (!isStatusFilter(value)) return;
            setStatus(value);
            setOffset(0);
          }}
        >
          <SelectTrigger id={FILTER_ID}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {renderBody()}
      <AdjustStockDialog
        outletId={outlet.id}
        item={editing}
        onClose={() => {
          setEditing(null);
        }}
      />
    </>
  );
};

export const InventoryPage = () => (
  <OutletGate title={TITLE}>
    {(outlet) => <InventoryScreen key={outlet.id} outlet={outlet} />}
  </OutletGate>
);
