import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states';
import { Card } from '@/components/ui/card';
import { useRevenueByOutlet } from '@/hooks/use-reports';
import { formatDateRange, monthToDate, toRangeParams } from '@/lib/dates';
import type { DateRangeForm } from '@/schemas/forms';
import { ReportFilters } from './ReportFilters';
import { RevenueByOutlet } from './RevenueByOutlet';
import { SummaryCards } from './SummaryCards';
import { TopItems } from './TopItems';

export const ReportsPage = () => {
  const [dates, setDates] = useState<DateRangeForm>(() => monthToDate());
  const [pickedOutletId, setPickedOutletId] = useState<number | null>(null);

  // Local calendar days -> ISO instants with an exclusive `to` (see lib/dates.ts).
  const range = useMemo(() => toRangeParams(dates.fromDate, dates.toDate), [dates]);
  const revenue = useRevenueByOutlet(range);
  const rows = revenue.data?.data ?? [];

  // Default the top-items picker to the best-selling outlet (first row).
  const topOutletId =
    rows.find((row) => row.outletId === pickedOutletId)?.outletId ?? rows[0]?.outletId ?? null;

  const renderRevenue = () => {
    if (revenue.isPending) return <TableSkeleton columns={4} rows={4} label="Loading revenue" />;
    if (revenue.isError) {
      return <ErrorState error={revenue.error} onRetry={() => void revenue.refetch()} />;
    }
    if (rows.length === 0) {
      return (
        <EmptyState title="No outlets yet" description="Revenue appears once outlets exist." />
      );
    }
    return <RevenueByOutlet rows={rows} />;
  };

  return (
    <>
      <PageHeader
        title="Reports"
        description="Revenue across outlets and best sellers per outlet"
      />
      <ReportFilters value={dates} onApply={setDates} isFetching={revenue.isFetching} />
      {revenue.isError ? null : (
        <SummaryCards meta={revenue.data?.meta} rangeLabel={formatDateRange(dates)} />
      )}
      <div className="flex flex-wrap items-start gap-6">
        <Card className="min-w-0 flex-[999_1_520px]">{renderRevenue()}</Card>
        <Card className="flex-[1_1_340px]">
          {revenue.data ? (
            <TopItems
              outlets={rows}
              outletId={topOutletId}
              onOutletChange={setPickedOutletId}
              range={range}
            />
          ) : (
            <TableSkeleton columns={3} rows={5} label="Loading top items" />
          )}
        </Card>
      </div>
    </>
  );
};
