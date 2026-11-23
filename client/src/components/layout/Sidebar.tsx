import { NavLink } from 'react-router';
import { useViewAs } from '@/hooks/use-view-as';
import { cn } from '@/lib/utils';
import { HQ_NAV, OUTLET_NAV } from './nav-config';
import type { NavLinkItem } from './nav-config';

const NavGroup = ({ title, items }: { title: string; items: NavLinkItem[] }) => (
  <div className="flex flex-col gap-0.5">
    <span className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle-foreground">
      {title}
    </span>
    {items.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) =>
          cn(
            'block rounded-control p-2.5 text-sm no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isActive
              ? 'bg-accent font-semibold text-accent-foreground'
              : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
          )
        }
      >
        {item.label}
      </NavLink>
    ))}
  </div>
);

/** Shows the navigation of the current "Viewing as" role only. */
export const Sidebar = () => {
  const { viewAs } = useViewAs();
  return (
    <nav
      aria-label="Main"
      className="box-border flex grow basis-[220px] flex-col gap-6 border-b border-border bg-card px-3.5 py-5 md:max-w-[248px] md:border-b-0 md:border-r"
    >
      <div className="flex items-center gap-2.5 px-2">
        <div
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-control bg-primary text-[15px] font-bold text-primary-foreground"
        >
          T
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-bold text-foreground">Techzu POS</span>
          <span className="text-xs text-subtle-foreground">HQ &amp; outlets</span>
        </div>
      </div>
      {viewAs.kind === 'hq' ? (
        <NavGroup title="HQ" items={HQ_NAV} />
      ) : (
        <NavGroup title="Outlet" items={OUTLET_NAV} />
      )}
    </nav>
  );
};
