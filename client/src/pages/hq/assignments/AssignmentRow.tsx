import { toast } from 'sonner';
import { isApiError } from '@/api/http';
import type { Money, OutletMenuItem } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { TableCell, TableRow } from '@/components/ui/table';
import { toastError } from '@/hooks/error-toast';
import {
  useAssignMenuItem,
  useUnassignMenuItem,
  useUpdateAssignment,
} from '@/hooks/use-outlet-menu-items';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { OverridePriceInput } from './OverridePriceInput';

const Dash = () => <span className="text-subtle-foreground">—</span>;

interface AssignmentRowProps {
  outletId: number;
  item: OutletMenuItem;
}

/** One master item as seen by the selected outlet; each control saves immediately. */
export const AssignmentRow = ({ outletId, item }: AssignmentRowProps) => {
  const assign = useAssignMenuItem(outletId);
  const unassign = useUnassignMenuItem(outletId);
  const update = useUpdateAssignment(outletId);
  const isBusy = assign.isPending || unassign.isPending || update.isPending;
  const { menuItemId, name } = item;

  const markUnavailable = () => {
    update.mutate(
      { menuItemId, body: { isAvailable: false } },
      {
        onSuccess: () => toast.success(`${name} is now unavailable at this outlet`),
        onError: toastError,
      },
    );
  };

  const handleAssignedChange = (checked: boolean) => {
    if (checked) {
      assign.mutate(menuItemId, {
        onSuccess: () => toast.success(`${name} assigned`),
        onError: toastError,
      });
      return;
    }
    unassign.mutate(menuItemId, {
      onSuccess: () => toast.success(`${name} unassigned`),
      onError: (error) => {
        // Sold items cannot be unassigned (receipts point at them): offer the alternative.
        if (isApiError(error) && error.code === 'HAS_SALES_HISTORY') {
          toast.error(error.message, {
            duration: 10_000,
            ...(item.isAvailable
              ? { action: { label: 'Mark unavailable', onClick: markUnavailable } }
              : {}),
          });
          return;
        }
        toastError(error);
      },
    });
  };

  const handleOverrideCommit = (priceOverride: Money | null) => {
    update.mutate(
      { menuItemId, body: { priceOverride } },
      {
        onSuccess: () =>
          toast.success(
            priceOverride === null
              ? `${name} now uses the base price`
              : `${name} override set to ${formatMoney(priceOverride)}`,
          ),
        onError: toastError,
      },
    );
  };

  const handleAvailableChange = (checked: boolean) => {
    update.mutate(
      { menuItemId, body: { isAvailable: checked } },
      {
        onSuccess: () =>
          toast.success(`${name} is now ${checked ? 'available' : 'unavailable'} at this outlet`),
        onError: toastError,
      },
    );
  };

  // HQ-inactive items cannot be newly assigned (422 MENU_ITEM_INACTIVE), only unassigned.
  const assignDisabled = isBusy || (!item.assigned && !item.isActive);
  const hasOverride = item.priceOverride !== null;

  return (
    <TableRow className={cn(!item.assigned && 'bg-[#FCFCFD]')} aria-busy={isBusy || undefined}>
      <TableCell>
        <Switch
          checked={item.assigned}
          disabled={assignDisabled}
          aria-label={`Assign ${name}`}
          onCheckedChange={handleAssignedChange}
        />
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('font-semibold', !item.assigned && 'text-muted-foreground')}>
            {name}
          </span>
          {!item.isActive ? <Badge variant="neutral">Inactive at HQ</Badge> : null}
        </div>
      </TableCell>
      <TableCell className={cn(!item.assigned && 'text-muted-foreground')}>
        {item.category}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatMoney(item.basePrice)}</TableCell>
      <TableCell className="text-right">
        <OverridePriceInput
          key={`${menuItemId.toString()}:${item.priceOverride ?? ''}:${String(item.assigned)}`}
          id={`override-${menuItemId.toString()}`}
          label={`Price override for ${name}`}
          value={item.priceOverride}
          disabled={!item.assigned || isBusy}
          onCommit={handleOverrideCommit}
        />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {item.effectivePrice === null ? (
          <Dash />
        ) : (
          <>
            <span className="font-semibold">{formatMoney(item.effectivePrice)}</span>
            {hasOverride ? (
              <span className="ml-1.5 text-xs font-semibold text-primary">override</span>
            ) : null}
          </>
        )}
      </TableCell>
      <TableCell>
        {item.isAvailable === null ? (
          <Dash />
        ) : (
          <Switch
            checked={item.isAvailable}
            disabled={isBusy}
            aria-label={`${name} available`}
            onCheckedChange={handleAvailableChange}
          />
        )}
      </TableCell>
    </TableRow>
  );
};
