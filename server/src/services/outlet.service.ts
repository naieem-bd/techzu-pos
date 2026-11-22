import { pool } from '../db/pool';
import type { Queryable } from '../db/pool';
import { withTransaction } from '../db/transaction';
import {
  countOutlets,
  insertOutlet,
  listOutlets,
  outletExists,
} from '../repositories/outlet.repository';
import type { NewOutlet, Outlet, OutletFilter } from '../repositories/outlet.repository';
import { insertReceiptCounter } from '../repositories/receipt-counter.repository';
import { conflict, notFound } from '../utils/app-error';
import type { Page, Pagination } from '../utils/pagination';
import { isUniqueViolation } from '../utils/pg-errors';

export const getOutlets = async (filter: OutletFilter, page: Pagination): Promise<Page<Outlet>> => {
  const [items, total] = await Promise.all([
    listOutlets(pool, filter, page),
    countOutlets(pool, filter),
  ]);
  return { items, total };
};

/** Outlet + its receipt counter are created atomically: an outlet can never lack a counter. */
export const createOutlet = (input: NewOutlet): Promise<Outlet> =>
  withTransaction(async (client) => {
    try {
      const outlet = await insertOutlet(client, input);
      await insertReceiptCounter(client, outlet.id);
      return outlet;
    } catch (err) {
      if (isUniqueViolation(err, 'outlets_code_key')) {
        throw conflict('OUTLET_CODE_TAKEN', `Outlet code "${input.code}" is already in use`);
      }
      throw err;
    }
  });

/** Shared guard so every outlet-scoped endpoint answers 404 for an unknown outlet. */
export const assertOutletExists = async (db: Queryable, outletId: number): Promise<void> => {
  if (!(await outletExists(db, outletId))) {
    throw notFound('OUTLET_NOT_FOUND', `Outlet ${String(outletId)} not found`);
  }
};
