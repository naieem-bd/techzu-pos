import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adjustInventory, getSellableMenu, listInventory } from '@/api/outlet-inventory';
import type { InventoryListParams } from '@/api/types';
import { queryKeys } from './query-keys';

/**
 * The whole sellable menu of one outlet. The endpoint is unpaginated (capped at 500 rows), so
 * the POS loads it once and filters by category/search in memory for instant pills.
 */
export const useSellableMenu = (outletId: number) =>
  useQuery({
    queryKey: queryKeys.sellableMenu.byOutlet(outletId),
    queryFn: () => getSellableMenu(outletId),
  });

export const useInventory = (outletId: number, params: InventoryListParams) =>
  useQuery({
    queryKey: queryKeys.inventory.list(outletId, params),
    queryFn: () => listInventory(outletId, params),
    placeholderData: keepPreviousData,
  });

export const useAdjustInventory = (outletId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ menuItemId, adjustment }: { menuItemId: number; adjustment: number }) =>
      adjustInventory(outletId, menuItemId, { adjustment }),
    // Stock shows on the POS cards too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byOutlet(outletId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sellableMenu.byOutlet(outletId) }),
      ]),
  });
};
