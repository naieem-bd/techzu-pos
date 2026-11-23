import { AlertCircle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({ title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border bg-card px-6 py-12 text-center">
    <Inbox className="size-8 text-subtle-foreground" aria-hidden="true" />
    <p className="m-0 text-[15px] font-semibold text-foreground">{title}</p>
    {description ? <p className="m-0 text-sm text-muted-foreground">{description}</p> : null}
    {action ? <div className="mt-2">{action}</div> : null}
  </div>
);

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}

export const ErrorState = ({ error, onRetry, title = 'Could not load data' }: ErrorStateProps) => (
  <div
    role="alert"
    className="flex flex-col items-center gap-2 rounded-card border border-danger/30 bg-danger-soft px-6 py-10 text-center"
  >
    <AlertCircle className="size-8 text-danger" aria-hidden="true" />
    <p className="m-0 text-[15px] font-semibold text-foreground">{title}</p>
    <p className="m-0 text-sm text-muted-foreground">
      {error instanceof Error ? error.message : 'Something went wrong'}
    </p>
    {onRetry ? (
      <Button variant="outline" className="mt-2" onClick={onRetry}>
        Try again
      </Button>
    ) : null}
  </div>
);

interface TableSkeletonProps {
  rows?: number;
  columns: number;
  label: string;
}

/** Placeholder rows while a table loads; announced once to screen readers via `label`. */
export const TableSkeleton = ({ rows = 6, columns, label }: TableSkeletonProps) => (
  <div
    role="status"
    aria-label={label}
    className="overflow-hidden rounded-card border border-border bg-card"
  >
    <div className="h-10 border-b border-border bg-muted" />
    {Array.from({ length: rows }, (_, row) => (
      <div key={row} className="flex gap-6 border-b border-border px-4 py-4 last:border-b-0">
        {Array.from({ length: columns }, (__, col) => (
          <Skeleton key={col} className="h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
);
