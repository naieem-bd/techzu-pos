/** Mirrors docs/openapi.yaml. Money is always a decimal string with two decimals ("4.50"). */
export type Money = string;

export interface ListMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface ListResult<T> {
  data: T[];
  meta: ListMeta;
}

export interface PageParams {
  limit?: number;
  offset?: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

// ---- Outlets ----
export interface Outlet {
  id: number;
  code: string;
  name: string;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOutletBody {
  code: string;
  name: string;
  address?: string;
}

export interface OutletListParams extends PageParams {
  search?: string;
}

// ---- Master menu ----
export interface MenuItem {
  id: number;
  sku: string;
  name: string;
  category: string;
  basePrice: Money;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMenuItemBody {
  sku: string;
  name: string;
  category: string;
  basePrice: Money;
}

export interface UpdateMenuItemBody {
  name?: string;
  category?: string;
  basePrice?: Money;
  isActive?: boolean;
}

export interface MenuItemListParams extends PageParams {
  search?: string;
  category?: string;
  isActive?: boolean;
}

// ---- Assignments ----
export interface OutletMenuItem {
  menuItemId: number;
  sku: string;
  name: string;
  category: string;
  basePrice: Money;
  isActive: boolean;
  assigned: boolean;
  priceOverride: Money | null;
  effectivePrice: Money | null;
  isAvailable: boolean | null;
}

export interface AssignMenuItemBody {
  menuItemId: number;
  priceOverride?: Money | null;
}

export interface UpdateAssignmentBody {
  priceOverride?: Money | null;
  isAvailable?: boolean;
}

export interface OutletMenuItemListParams extends PageParams {
  search?: string;
  category?: string;
  assigned?: boolean;
}

// ---- Reports ----
export interface DateRange {
  from?: string;
  to?: string;
}

export interface OutletRevenue {
  outletId: number;
  code: string;
  name: string;
  saleCount: number;
  totalRevenue: Money;
  averageTicket: Money;
}

export interface RevenueMeta {
  grandTotal: Money;
  totalSales: number;
}

export interface RevenueReport {
  data: OutletRevenue[];
  meta: RevenueMeta;
}

export interface TopItem {
  menuItemId: number;
  sku: string;
  name: string;
  quantitySold: number;
  revenue: Money;
}
