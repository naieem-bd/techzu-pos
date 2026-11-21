import type { Queryable } from '../db/pool';

/** Round-trips to PostgreSQL; throws if the DB is unreachable. */
export const ping = async (db: Queryable): Promise<void> => {
  await db.query('SELECT 1');
};
