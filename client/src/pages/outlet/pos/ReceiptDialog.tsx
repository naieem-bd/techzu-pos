import type { Sale } from '@/api/types';
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
import { formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

interface ReceiptDialogProps {
  sale: Sale | null;
  onClose: () => void;
}

/** The receipt exactly as the server recorded it (prices copied at sale time). */
export const ReceiptDialog = ({ sale, onClose }: ReceiptDialogProps) => (
  <Dialog
    open={sale !== null}
    onOpenChange={(open) => {
      if (!open) onClose();
    }}
  >
    <DialogContent>
      {sale ? (
        <>
          <DialogHeader>
            <DialogTitle>Sale complete</DialogTitle>
            <DialogDescription>
              Receipt <span className="font-mono font-semibold">{sale.receiptNo}</span> ·{' '}
              {formatDateTime(sale.createdAt)}
            </DialogDescription>
          </DialogHeader>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {sale.items.map((line) => (
              <li
                key={line.menuItemId}
                className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-sm tabular-nums"
              >
                <span className="font-medium">{line.name}</span>
                <span className="text-muted-foreground">
                  {line.quantity} × {formatMoney(line.unitPrice)}
                </span>
                <span className="text-right font-semibold">{formatMoney(line.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-border pt-3 text-lg font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(sale.totalAmount)}</span>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button>New sale</Button>
            </DialogClose>
          </DialogFooter>
        </>
      ) : null}
    </DialogContent>
  </Dialog>
);
