import type { OutletRevenue } from '@/api/types';
import { CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney, percentOf } from '@/lib/money';

/** Bars are scaled to the best outlet (the API already sorts highest revenue first). */
export const RevenueByOutlet = ({ rows }: { rows: OutletRevenue[] }) => {
  const max = rows[0]?.totalRevenue ?? '0.00';
  return (
    <>
      <CardTitle className="mb-4">Revenue by outlet</CardTitle>
      <ul className="m-0 mb-5 flex list-none flex-col gap-3.5 p-0" aria-label="Revenue bars">
        {rows.map((row) => {
          const percent = percentOf(row.totalRevenue, max);
          return (
            <li
              key={row.outletId}
              className="grid grid-cols-[minmax(90px,160px)_minmax(0,1fr)_auto] items-center gap-3"
            >
              <span className="truncate text-sm font-semibold">{row.name}</span>
              <div
                className="h-3.5 rounded-full bg-track"
                role="img"
                aria-label={`${row.name}: ${percent.toFixed(0)}% of the top outlet`}
              >
                <div
                  className="h-3.5 rounded-full bg-primary"
                  style={{ width: `${percent.toString()}%` }}
                />
              </div>
              <span className="min-w-[96px] text-right text-sm font-semibold tabular-nums">
                {formatMoney(row.totalRevenue)}
              </span>
            </li>
          );
        })}
      </ul>
      <Table aria-label="Revenue by outlet">
        <TableHeader>
          <TableRow>
            <TableHead>Outlet</TableHead>
            <TableHead className="text-right">Sales</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Avg ticket</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.outletId}>
              <TableCell>
                {row.name}{' '}
                <span className="font-mono text-xs text-subtle-foreground">{row.code}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.saleCount}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(row.totalRevenue)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.saleCount === 0 ? '—' : formatMoney(row.averageTicket)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
};
