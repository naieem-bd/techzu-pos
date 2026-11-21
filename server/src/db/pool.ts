import pg from 'pg';
import type { Pool, PoolClient } from 'pg';
import { config } from '../config/env';
import { logger } from '../utils/logger';

// NUMERIC (money) must stay a string: JS floats cannot represent decimals exactly.
// This is pg's default already; set explicitly so nobody "fixes" it to parseFloat later.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => value);

/** Anything that can run a query: the pool itself or a client checked out for a transaction. */
export type Queryable = Pool | PoolClient;

export const pool: Pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DB_SSL ? { rejectUnauthorized: true } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  // Fail fast instead of hanging a request forever when the DB is unreachable.
  connectionTimeoutMillis: 5_000,
});

// An idle client erroring (e.g. DB restart) emits 'error' on the pool; unhandled, it crashes Node.
pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

export const closePool = async (): Promise<void> => {
  await pool.end();
};
