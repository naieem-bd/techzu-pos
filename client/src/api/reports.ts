import { request, requestEnvelope } from './http';
import type { DateRange, OutletRevenue, RevenueMeta, RevenueReport, TopItem } from './types';

export const getRevenueByOutlet = (range: DateRange): Promise<RevenueReport> =>
  requestEnvelope<OutletRevenue[], RevenueMeta>('/reports/revenue-by-outlet', {
    query: { ...range },
  });

export const getTopItems = (outletId: number, range: DateRange, limit = 5): Promise<TopItem[]> =>
  request<TopItem[]>(`/reports/outlets/${outletId.toString()}/top-items`, {
    query: { ...range, limit },
  });
