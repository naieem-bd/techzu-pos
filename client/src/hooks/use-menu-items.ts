import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createMenuItem, listMenuItems, updateMenuItem } from '@/api/menu-items';
import type { CreateMenuItemBody, MenuItemListParams, UpdateMenuItemBody } from '@/api/types';
import { queryKeys } from './query-keys';

export const useMenuItems = (params: MenuItemListParams) =>
  useQuery({
    queryKey: queryKeys.menuItems.list(params),
    queryFn: () => listMenuItems(params),
    placeholderData: keepPreviousData,
  });

/**
 * Distinct categories for the filter and the form's suggestions. The API has no categories
 * endpoint, so this reads one max-size page (100 items) of the master menu, which covers a
 * realistic F&B menu; categories beyond it would simply not be suggested.
 */
export const useMenuCategories = () =>
  useQuery({
    queryKey: queryKeys.menuItems.categories,
    queryFn: async () => {
      const { data } = await listMenuItems({ limit: 100, offset: 0 });
      return [...new Set(data.map((item) => item.category))].sort((a, b) => a.localeCompare(b));
    },
  });

const useInvalidateMenu = () => {
  const queryClient = useQueryClient();
  // Master items appear (with base price/active flag) in every outlet's assignment list, POS
  // menu and inventory too.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.menuItems.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.outletMenuItems.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sellableMenu.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
    ]);
};

export const useCreateMenuItem = () => {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: (body: CreateMenuItemBody) => createMenuItem(body),
    onSuccess: invalidate,
  });
};

export const useUpdateMenuItem = () => {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateMenuItemBody }) =>
      updateMenuItem(id, body),
    onSuccess: invalidate,
  });
};
