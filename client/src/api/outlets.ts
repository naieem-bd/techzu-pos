import { request, requestEnvelope } from './http';
import type { CreateOutletBody, ListMeta, ListResult, Outlet, OutletListParams } from './types';

export const listOutlets = (params: OutletListParams = {}): Promise<ListResult<Outlet>> =>
  requestEnvelope<Outlet[], ListMeta>('/outlets', { query: { ...params } });

export const createOutlet = (body: CreateOutletBody): Promise<Outlet> =>
  request<Outlet>('/outlets', { method: 'POST', body });
