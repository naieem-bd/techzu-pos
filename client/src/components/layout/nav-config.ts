export interface NavLinkItem {
  to: string;
  label: string;
}

export const HQ_NAV: NavLinkItem[] = [
  { to: '/hq/outlets', label: 'Outlets' },
  { to: '/hq/menu', label: 'Master menu' },
  { to: '/hq/assignments', label: 'Menu assignment' },
  { to: '/hq/reports', label: 'Reports' },
];

export const OUTLET_NAV: NavLinkItem[] = [
  { to: '/outlet/sale', label: 'New sale' },
  { to: '/outlet/inventory', label: 'Inventory' },
  { to: '/outlet/sales', label: 'Sales history' },
];

export const HQ_HOME = '/hq/outlets';
export const OUTLET_HOME = '/outlet/sale';
