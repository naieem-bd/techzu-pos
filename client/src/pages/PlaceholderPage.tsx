import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/states';

/** Outlet screens arrive in a later PR; the routes exist so the role switcher works end to end. */
export const PlaceholderPage = ({ title }: { title: string }) => (
  <>
    <PageHeader title={title} description="Outlet screen" />
    <EmptyState title="Coming soon" description="This outlet screen is part of the next PR." />
  </>
);
