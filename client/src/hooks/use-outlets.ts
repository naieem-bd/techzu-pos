import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createOutlet, listOutlets } from '@/api/outlets';
import type { CreateOutletBody, OutletListParams } from '@/api/types';
import { queryKeys } from './query-keys';

/** Max page size the API allows; used where we need "all" outlets (switcher, pickers). */
export const ALL_OUTLETS_PARAMS: OutletListParams = { limit: 100, offset: 0 };

export const useOutlets = (params: OutletListParams) =>
  useQuery({
    queryKey: queryKeys.outlets.list(params),
    queryFn: () => listOutlets(params),
    placeholderData: keepPreviousData,
  });

export const useAllOutlets = () => useOutlets(ALL_OUTLETS_PARAMS);

export const useCreateOutlet = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOutletBody) => createOutlet(body),
    onSuccess: async () => {
      // A new outlet also appears in the revenue report (with zero sales).
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.outlets.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
      ]);
    },
  });
};
