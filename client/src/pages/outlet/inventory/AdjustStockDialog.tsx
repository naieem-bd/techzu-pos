import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { InventoryItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toastError } from '@/hooks/error-toast';
import { useAdjustInventory } from '@/hooks/use-outlet-inventory';
import { cn } from '@/lib/utils';
import { stockAdjustmentSchema } from '@/schemas/forms';
import type { StockAdjustmentInput, StockAdjustmentOutput } from '@/schemas/forms';

const EMPTY_FORM: StockAdjustmentInput = { adjustment: '' };

interface AdjustStockDialogProps {
  outletId: number;
  /** The row being adjusted; null keeps the dialog closed. */
  item: InventoryItem | null;
  onClose: () => void;
}

/** New stock if the typed value is a valid adjustment, otherwise null (no preview). */
const previewQuantity = (current: number, typed: string): number | null => {
  const parsed = stockAdjustmentSchema.safeParse({ adjustment: typed });
  return parsed.success ? current + parsed.data.adjustment : null;
};

export const AdjustStockDialog = ({ outletId, item, onClose }: AdjustStockDialogProps) => {
  const adjust = useAdjustInventory(outletId);
  const form = useForm<StockAdjustmentInput, unknown, StockAdjustmentOutput>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: EMPTY_FORM,
  });
  const typed = useWatch({ control: form.control, name: 'adjustment' });

  const close = () => {
    form.reset(EMPTY_FORM);
    adjust.reset();
    onClose();
  };

  const preview = item ? previewQuantity(item.quantity, typed) : null;
  const wouldGoNegative = preview !== null && preview < 0;

  const onSubmit = ({ adjustment }: StockAdjustmentOutput) => {
    if (!item) return;
    adjust.mutate(
      { menuItemId: item.menuItemId, adjustment },
      {
        onSuccess: (updated) => {
          toast.success(`${updated.name}: stock is now ${updated.quantity.toString()}`);
          close();
        },
        // 409 INSUFFICIENT_STOCK (stock changed since this page loaded) shows the server message.
        onError: toastError,
      },
    );
  };

  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent>
        {item ? (
          <>
            <DialogHeader>
              <DialogTitle>Adjust stock</DialogTitle>
              <DialogDescription>
                {item.name} · current stock{' '}
                <strong className="text-foreground">{item.quantity}</strong>
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                noValidate
                className="flex flex-col gap-4"
                onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
              >
                <FormField
                  control={form.control}
                  name="adjustment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adjustment (+ add, − remove)</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          inputMode="numeric"
                          placeholder="e.g. +20 or -3"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Stock can never go below 0. The server rejects an adjustment that would.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div
                  className="flex items-center justify-between rounded-control bg-muted px-4 py-3"
                  aria-live="polite"
                >
                  <span className="text-sm text-muted-foreground">New stock</span>
                  <span
                    className={cn(
                      'text-lg font-bold tabular-nums',
                      wouldGoNegative && 'text-danger',
                    )}
                  >
                    {preview ?? '—'}
                  </span>
                </div>
                {wouldGoNegative ? (
                  <p role="alert" className="m-0 text-sm text-danger">
                    That would take stock below 0.
                  </p>
                ) : null}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={adjust.isPending || wouldGoNegative}>
                    {adjust.isPending ? 'Saving…' : 'Apply adjustment'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
