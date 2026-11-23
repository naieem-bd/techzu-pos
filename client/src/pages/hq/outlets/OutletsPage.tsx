import { useState } from 'react';
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
import { useOutlets } from '@/hooks/use-outlets';
import { formatDate } from '@/lib/dates';
import { CreateOutletDialog } from './CreateOutletDialog';

const PAGE_SIZE = 20;

const pluralize = (count: number, word: string): string =>
  `${count.toString()} ${word}${count === 1 ? '' : 's'}`;

export const OutletsPage = () => {
  const [offset, setOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const outlets = useOutlets({ limit: PAGE_SIZE, offset });

  const openDialog = () => {
    setDialogOpen(true);
  };

  const renderBody = () => {
    if (outlets.isPending) return <TableSkeleton columns={4} label="Loading outlets" />;
    if (outlets.isError) {
      return <ErrorState error={outlets.error} onRetry={() => void outlets.refetch()} />;
    }
    const { data, meta } = outlets.data;
    if (meta.total === 0) {
      return (
        <EmptyState
          title="No outlets yet"
          description="Create the first outlet to start assigning menu items."
          action={<Button onClick={openDialog}>New outlet</Button>}
        />
      );
    }
    return (
      <>
        <Table aria-label="Outlets">
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((outlet) => (
              <TableRow key={outlet.id}>
                <TableCell>
                  <span className="font-mono font-semibold">{outlet.code}</span>
                </TableCell>
                <TableCell>{outlet.name}</TableCell>
                <TableCell className="whitespace-normal">
                  {outlet.address ?? <span className="text-subtle-foreground">—</span>}
                </TableCell>
                <TableCell>{formatDate(outlet.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination meta={meta} onOffsetChange={setOffset} disabled={outlets.isFetching} />
      </>
    );
  };

  return (
    <>
      <PageHeader
        title="Outlets"
        description={
          outlets.data
            ? `${pluralize(outlets.data.meta.total, 'outlet')} · HQ manages menus and sees reports for each`
            : 'HQ manages menus and sees reports for each'
        }
        actions={<Button onClick={openDialog}>New outlet</Button>}
      />
      {renderBody()}
      <CreateOutletDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
};
