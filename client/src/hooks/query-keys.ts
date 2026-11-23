import type {
  DateRange,
  MenuItemListParams,
  OutletListParams,
  OutletMenuItemListParams,
} from '@/api/types';

/**
 * One factory for every cache key, so mutations can invalidate by prefix
 * (e.g. `queryKeys.menuItems.all` covers every filtered page).
 */
export const queryKeys = {
  outlets: {
    all: ['outlets'] as const,
    list: (params: OutletListParams) => ['outlets', 'list', params] as const,
  },
  menuItems: {
    all: ['menu-items'] as const,
    list: (params: MenuItemListParams) => ['menu-items', 'list', params] as const,
    categories: ['menu-items', 'categories'] as const,
  },
  outletMenuItems: {
    all: ['outlet-menu-items'] as const,
    byOutlet: (outletId: number) => ['outlet-menu-items', outletId] as const,
    list: (outletId: number, params: OutletMenuItemListParams) =>
      ['outlet-menu-items', outletId, params] as const,
  },
  reports: {
    all: ['reports'] as const,
    revenue: (range: DateRange) => ['reports', 'revenue', range] as const,
    topItems: (outletId: number, range: DateRange) =>
      ['reports', 'top-items', outletId, range] as const,
  },
};
