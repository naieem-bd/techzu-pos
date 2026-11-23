import { Link } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/states';
import { Button } from '@/components/ui/button';

export const NotFoundPage = () => (
  <>
    <PageHeader title="Page not found" />
    <EmptyState
      title="There is nothing at this address"
      action={
        <Button asChild variant="outline">
          <Link to="/">Go to the start page</Link>
        </Button>
      }
    />
  </>
);
