import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignMenuItem,
  listOutletMenuItems,
  unassignMenuItem,
  updateAssignment,
} from '@/api/assignments';
import type { OutletMenuItemListParams, UpdateAssignmentBody } from '@/api/types';
import { queryKeys } from './query-keys';

export const useOutletMenuItems = (outletId: number | null, params: OutletMenuItemListParams) =>
  useQuery({
    queryKey: queryKeys.outletMenuItems.list(outletId ?? 0, params),
    queryFn: () => listOutletMenuItems(outletId ?? 0, params),
    enabled: outletId !== null,
    placeholderData: keepPreviousData,
  });

const useInvalidateOutletMenu = (outletId: number) => {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.outletMenuItems.byOutlet(outletId) });
};

export const useAssignMenuItem = (outletId: number) => {
  const invalidate = useInvalidateOutletMenu(outletId);
  return useMutation({
    mutationFn: (menuItemId: number) => assignMenuItem(outletId, { menuItemId }),
    onSuccess: invalidate,
  });
};

export const useUpdateAssignment = (outletId: number) => {
  const invalidate = useInvalidateOutletMenu(outletId);
  return useMutation({
    mutationFn: ({ menuItemId, body }: { menuItemId: number; body: UpdateAssignmentBody }) =>
      updateAssignment(outletId, menuItemId, body),
    onSuccess: invalidate,
  });
};

export const useUnassignMenuItem = (outletId: number) => {
  const invalidate = useInvalidateOutletMenu(outletId);
  return useMutation({
    mutationFn: (menuItemId: number) => unassignMenuItem(outletId, menuItemId),
    onSuccess: invalidate,
  });
};
