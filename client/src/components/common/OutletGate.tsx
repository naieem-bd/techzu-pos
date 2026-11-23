import type { ReactNode } from 'react';
import type { Outlet } from '@/api/types';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState } from '@/components/common/states';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAllOutlets } from '@/hooks/use-outlets';
import { useViewAs } from '@/hooks/use-view-as';

const PICKER_ID = 'outlet-gate-picker';

interface OutletGateProps {
  title: string;
  /** Rendered only once an existing outlet is selected in the "Viewing as" switcher. */
  children: (outlet: Outlet) => ReactNode;
}

/**
 * Outlet screens work on the outlet chosen in "Viewing as". When HQ (or an outlet that no
 * longer exists) is selected, this shows a prompt to pick one instead of the screen.
 */
export const OutletGate = ({ title, children }: OutletGateProps) => {
  const { viewAs, setViewAs } = useViewAs();
  const outlets = useAllOutlets();

  if (outlets.isPending) {
    return (
      <>
        <PageHeader title={title} />
        <Skeleton role="status" aria-label="Loading outlet" className="h-40 w-full" />
      </>
    );
  }
  if (outlets.isError) {
    return (
      <>
        <PageHeader title={title} />
        <ErrorState error={outlets.error} onRetry={() => void outlets.refetch()} />
      </>
    );
  }

  const list = outlets.data.data;
  const outlet =
    viewAs.kind === 'outlet' ? list.find((candidate) => candidate.id === viewAs.outletId) : null;
  if (outlet) return children(outlet);

  return (
    <>
      <PageHeader title={title} description="Outlet screen" />
      {list.length === 0 ? (
        <EmptyState
          title="No outlets yet"
          description="HQ needs to create an outlet before it can sell or keep stock."
        />
      ) : (
        <EmptyState
          title="Pick an outlet"
          description="This screen works for one outlet. Choose it here or in “Viewing as”."
          action={
            <div className="flex flex-col items-start gap-1.5 text-left">
              <Label htmlFor={PICKER_ID}>Outlet</Label>
              <Select
                onValueChange={(value) => {
                  setViewAs({ kind: 'outlet', outletId: Number(value) });
                }}
              >
                <SelectTrigger id={PICKER_ID} className="w-64">
                  <SelectValue placeholder="Select an outlet" />
                </SelectTrigger>
                <SelectContent>
                  {list.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id.toString()}>
                      {candidate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />
      )}
    </>
  );
};
