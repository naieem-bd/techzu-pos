import { useNavigate } from 'react-router';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HQ_VIEW } from '@/context/view-as-context';
import { useAllOutlets } from '@/hooks/use-outlets';
import { useViewAs } from '@/hooks/use-view-as';
import { HQ_HOME, OUTLET_HOME } from './nav-config';

const HQ_VALUE = 'hq';
const ROLE_SELECT_ID = 'view-as';

/** "Viewing as" role switcher: HQ or one of the outlets from GET /api/outlets. */
export const TopBar = () => {
  const { viewAs, setViewAs } = useViewAs();
  const outlets = useAllOutlets();
  const navigate = useNavigate();

  const value = viewAs.kind === 'hq' ? HQ_VALUE : viewAs.outletId.toString();

  const handleChange = (next: string) => {
    if (next === HQ_VALUE) {
      setViewAs(HQ_VIEW);
      void navigate(HQ_HOME);
      return;
    }
    setViewAs({ kind: 'outlet', outletId: Number(next) });
    void navigate(OUTLET_HOME);
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3.5 md:px-8">
      <span className="text-[13px] text-subtle-foreground">
        Assessment build · no login (role switcher)
      </span>
      <div className="flex items-center gap-2.5">
        <label htmlFor={ROLE_SELECT_ID} className="text-[13px] font-semibold text-foreground">
          Viewing as
        </label>
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger id={ROLE_SELECT_ID} className="h-10 w-64 font-medium">
            <SelectValue placeholder="HQ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={HQ_VALUE}>HQ</SelectItem>
            {outlets.data?.data.map((outlet) => (
              <SelectItem key={outlet.id} value={outlet.id.toString()}>
                Outlet · {outlet.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </header>
  );
};
