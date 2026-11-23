import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getRevenueByOutlet, getTopItems } from '@/api/reports';
import type { DateRange } from '@/api/types';
import { queryKeys } from './query-keys';

export const TOP_ITEMS_LIMIT = 5;

export const useRevenueByOutlet = (range: DateRange) =>
  useQuery({
    queryKey: queryKeys.reports.revenue(range),
    queryFn: () => getRevenueByOutlet(range),
    placeholderData: keepPreviousData,
  });

export const useTopItems = (outletId: number | null, range: DateRange) =>
  useQuery({
    queryKey: queryKeys.reports.topItems(outletId ?? 0, range),
    queryFn: () => getTopItems(outletId ?? 0, range, TOP_ITEMS_LIMIT),
    enabled: outletId !== null,
  });
