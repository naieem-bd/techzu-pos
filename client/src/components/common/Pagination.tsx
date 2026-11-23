import { Button } from '@/components/ui/button';
import type { ListMeta } from '@/api/types';

interface PaginationProps {
  meta: ListMeta;
  onOffsetChange: (offset: number) => void;
  disabled?: boolean;
}

export const Pagination = ({ meta, onOffsetChange, disabled = false }: PaginationProps) => {
  const { total, limit, offset } = meta;
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + limit, total);
  const hasPrevious = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-subtle-foreground"
    >
      <span aria-live="polite">
        Showing {first.toString()}–{last.toString()} of {total.toString()}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !hasPrevious}
          onClick={() => {
            onOffsetChange(Math.max(0, offset - limit));
          }}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !hasNext}
          onClick={() => {
            onOffsetChange(offset + limit);
          }}
        >
          Next
        </Button>
      </div>
    </nav>
  );
};
