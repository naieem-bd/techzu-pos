import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSale, listSales } from '@/api/sales';
import type { CreateSaleBody, SaleListParams } from '@/api/types';
import { queryKeys } from './query-keys';

export const useSales = (outletId: number, params: SaleListParams) =>
  useQuery({
    queryKey: queryKeys.sales.list(outletId, params),
    queryFn: () => listSales(outletId, params),
    placeholderData: keepPreviousData,
  });

export const useCreateSale = (outletId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSaleBody) => createSale(outletId, body),
    // A sale changes stock (POS menu + inventory), adds a receipt and moves the HQ reports.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sellableMenu.byOutlet(outletId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byOutlet(outletId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sales.byOutlet(outletId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
      ]),
  });
};
