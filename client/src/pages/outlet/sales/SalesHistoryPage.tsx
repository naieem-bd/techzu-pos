import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import type { Outlet, Sale, SaleListParams } from '@/api/types';
import { OutletGate } from '@/components/common/OutletGate';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSales } from '@/hooks/use-sales';
import { formatDateTime, toDateInputValue, toRangeParams } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { parseReceiptNumber } from '@/schemas/forms';
import type { SalesFilterForm } from '@/schemas/forms';
import { SalesFilters } from './SalesFilters';

const TITLE = 'Sales history';
const PAGE_SIZE = 20;
const COLUMNS = 5;

const todayFilters = (): SalesFilterForm => {
  const today = toDateInputValue(new Date());
  return { fromDate: today, toDate: today, receipt: '' };
};

/** Form values -> API query: local days become [from, start of day after `to`) in ISO. */
const toSaleParams = (filters: SalesFilterForm, offset: number): SaleListParams => {
  const params: SaleListParams = {
    ...toRangeParams(filters.fromDate, filters.toDate),
    limit: PAGE_SIZE,
    offset,
  };
  const receiptNumber = parseReceiptNumber(filters.receipt);
  if (receiptNumber !== undefined) params.receiptNumber = receiptNumber;
  return params;
};

const unitCount = (sale: Sale): number => sale.items.reduce((sum, line) => sum + line.quantity, 0);

const SaleLines = ({ sale }: { sale: Sale }) => (
  <ul className="m-0 flex list-none flex-col gap-1.5 py-1 pl-12 pr-2">
    {sale.items.map((line) => (
      <li
        key={line.menuItemId}
        className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 text-[13px] tabular-nums"
      >
        <span>{line.name}</span>
        <span className="text-muted-foreground">× {line.quantity}</span>
        <span className="text-muted-foreground">{formatMoney(line.unitPrice)}</span>
        <span className="text-right font-semibold">{formatMoney(line.lineTotal)}</span>
      </li>
    ))}
  </ul>
);

const SalesHistoryScreen = ({ outlet }: { outlet: Outlet }) => {
  const [filters, setFilters] = useState<SalesFilterForm>(todayFilters);
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());

  const sales = useSales(outlet.id, toSaleParams(filters, offset));

  const toggle = (saleId: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(saleId)) next.delete(saleId);
      else next.add(saleId);
      return next;
    });
  };

  const renderBody = () => {
    if (sales.isPending) return <TableSkeleton columns={COLUMNS} label="Loading sales" />;
    if (sales.isError) {
      return <ErrorState error={sales.error} onRetry={() => void sales.refetch()} />;
    }
    const { data, meta } = sales.data;
    if (meta.total === 0) {
      return (
        <EmptyState
          title="No sales in this range"
          description="Pick other dates or clear the receipt number."
        />
      );
    }
    return (
      <>
        <Table aria-label={`Sales of ${outlet.name}`}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <span className="sr-only">Expand</span>
              </TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((sale) => {
              const isOpen = expanded.has(sale.id);
              return (
                <Fragment key={sale.id}>
                  <TableRow>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 px-0"
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? 'Hide' : 'Show'} items for ${sale.receiptNo}`}
                        onClick={() => {
                          toggle(sale.id);
                        }}
                      >
                        {isOpen ? (
                          <ChevronDown aria-hidden="true" />
                        ) : (
                          <ChevronRight aria-hidden="true" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-semibold">{sale.receiptNo}</span>
                    </TableCell>
                    <TableCell>{formatDateTime(sale.createdAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{unitCount(sale)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatMoney(sale.totalAmount)}
                    </TableCell>
                  </TableRow>
                  {isOpen ? (
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableCell colSpan={COLUMNS}>
                        <SaleLines sale={sale} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        <Pagination meta={meta} onOffsetChange={setOffset} disabled={sales.isFetching} />
      </>
    );
  };

  return (
    <>
      <PageHeader
        title={TITLE}
        description={`${outlet.name} · receipts are numbered per outlet, in order, with no gaps`}
      />
      <SalesFilters
        value={filters}
        receiptPlaceholder={`${outlet.code}-000…`}
        isFetching={sales.isFetching}
        onApply={(next) => {
          setFilters(next);
          setOffset(0);
          setExpanded(new Set());
        }}
      />
      {renderBody()}
    </>
  );
};

export const SalesHistoryPage = () => (
  <OutletGate title={TITLE}>
    {(outlet) => <SalesHistoryScreen key={outlet.id} outlet={outlet} />}
  </OutletGate>
);
