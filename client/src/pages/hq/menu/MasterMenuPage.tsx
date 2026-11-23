import { useState } from 'react';
import type { MenuItem, MenuItemListParams } from '@/api/types';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useMenuCategories, useMenuItems } from '@/hooks/use-menu-items';
import { formatMoney } from '@/lib/money';
import { MenuItemFormDialog } from './MenuItemFormDialog';

const PAGE_SIZE = 20;
const ALL = 'all';
type StatusFilter = typeof ALL | 'active' | 'inactive';

const STATUS_TO_PARAM: Record<StatusFilter, boolean | undefined> = {
  all: undefined,
  active: true,
  inactive: false,
};

const isStatusFilter = (value: string): value is StatusFilter => value in STATUS_TO_PARAM;

/** Dialog state: closed, creating, or editing one item. */
type DialogState = { open: false } | { open: true; item: MenuItem | null };

export const MasterMenuPage = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL);
  const [status, setStatus] = useState<StatusFilter>(ALL);
  const [offset, setOffset] = useState(0);
  const [dialog, setDialog] = useState<DialogState>({ open: false });

  const debouncedSearch = useDebouncedValue(search.trim());
  const params: MenuItemListParams = { limit: PAGE_SIZE, offset };
  if (debouncedSearch) params.search = debouncedSearch;
  if (category !== ALL) params.category = category;
  const isActive = STATUS_TO_PARAM[status];
  if (isActive !== undefined) params.isActive = isActive;

  const items = useMenuItems(params);
  const categories = useMenuCategories();
  const hasFilters = Boolean(debouncedSearch) || category !== ALL || status !== ALL;

  // Any filter change starts again from the first page.
  const withReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setOffset(0);
    };

  const openCreate = () => {
    setDialog({ open: true, item: null });
  };

  const renderBody = () => {
    if (items.isPending) return <TableSkeleton columns={6} label="Loading menu items" />;
    if (items.isError) {
      return <ErrorState error={items.error} onRetry={() => void items.refetch()} />;
    }
    const { data, meta } = items.data;
    if (meta.total === 0) {
      return hasFilters ? (
        <EmptyState title="No items match these filters" description="Try another search." />
      ) : (
        <EmptyState
          title="The master menu is empty"
          description="Add the first item; outlets can then be assigned to sell it."
          action={<Button onClick={openCreate}>New menu item</Button>}
        />
      );
    }
    return (
      <>
        <Table aria-label="Master menu items">
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Base price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <span className="font-mono text-muted-foreground">{item.sku}</span>
                </TableCell>
                <TableCell>
                  <span className="font-semibold">{item.name}</span>
                </TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(item.basePrice)}
                </TableCell>
                <TableCell>
                  {item.isActive ? (
                    <Badge variant="ok">Active</Badge>
                  ) : (
                    <Badge variant="neutral">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Edit ${item.name}`}
                    onClick={() => {
                      setDialog({ open: true, item });
                    }}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination meta={meta} onOffsetChange={setOffset} disabled={items.isFetching} />
      </>
    );
  };

  return (
    <>
      <PageHeader
        title="Master menu"
        description={
          items.data && !hasFilters
            ? `${items.data.meta.total.toString()} items · base prices apply unless an outlet overrides them`
            : 'Base prices apply unless an outlet overrides them'
        }
        actions={<Button onClick={openCreate}>New menu item</Button>}
      />

      <div className="flex flex-wrap items-end gap-3" role="search">
        <div className="flex w-full flex-col gap-1.5 sm:w-[280px]">
          <Label htmlFor="menu-search">Search</Label>
          <Input
            id="menu-search"
            type="search"
            placeholder="Name or SKU"
            value={search}
            maxLength={100}
            onChange={(event) => {
              withReset(setSearch)(event.target.value);
            }}
          />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-[200px]">
          <Label htmlFor="menu-category">Category</Label>
          <Select value={category} onValueChange={withReset(setCategory)}>
            <SelectTrigger id="menu-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.data?.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-[160px]">
          <Label htmlFor="menu-status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => {
              if (isStatusFilter(value)) withReset(setStatus)(value);
            }}
          >
            <SelectTrigger id="menu-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {renderBody()}

      {dialog.open ? (
        <MenuItemFormDialog
          key={dialog.item?.id ?? 'new'}
          item={dialog.item}
          open
          onOpenChange={(open) => {
            if (!open) setDialog({ open: false });
          }}
        />
      ) : null}
    </>
  );
};
