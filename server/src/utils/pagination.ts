export interface Pagination {
  limit: number;
  offset: number;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface ListMeta extends Pagination {
  total: number;
}

export const toListMeta = (total: number, { limit, offset }: Pagination): ListMeta => ({
  total,
  limit,
  offset,
});
