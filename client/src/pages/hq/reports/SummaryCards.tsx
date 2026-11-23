import type { RevenueMeta } from '@/api/types';
import { Skeleton } from '@/components/ui/skeleton';
import { averageMoney, formatMoney } from '@/lib/money';

interface SummaryCardProps {
  label: string;
  value: string;
  hint: string;
}

const SummaryCard = ({ label, value, hint }: SummaryCardProps) => (
  <section className="box-border flex-[1_1_220px] rounded-card border border-border bg-card p-5">
    <p className="m-0 text-[13px] font-semibold text-muted-foreground">{label}</p>
    <p className="mb-1 mt-2 text-[28px] font-bold tabular-nums text-foreground">{value}</p>
    <p className="m-0 text-xs text-subtle-foreground">{hint}</p>
  </section>
);

interface SummaryCardsProps {
  meta: RevenueMeta | undefined;
  rangeLabel: string;
}

export const SummaryCards = ({ meta, rangeLabel }: SummaryCardsProps) => {
  if (!meta) {
    return (
      <div className="flex flex-wrap gap-4" role="status" aria-label="Loading totals">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-[118px] flex-[1_1_220px] rounded-card" />
        ))}
      </div>
    );
  }
  // Computed in integer cents from the server's totals (no float math on money).
  const average = averageMoney(meta.grandTotal, meta.totalSales);
  return (
    <div className="flex flex-wrap gap-4">
      <SummaryCard
        label="Total revenue"
        value={formatMoney(meta.grandTotal)}
        hint={`All outlets, ${rangeLabel}`}
      />
      <SummaryCard label="Sales" value={meta.totalSales.toString()} hint="Completed receipts" />
      <SummaryCard
        label="Average ticket"
        value={average === null ? '—' : formatMoney(average)}
        hint="Revenue ÷ sales"
      />
    </div>
  );
};
