import pg from 'pg';
import type { Pool, PoolClient } from 'pg';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { buildPoolConfig } from './pool-config';

// NUMERIC (money) must stay a string: JS floats cannot represent decimals exactly.
// This is pg's default already; set explicitly so nobody "fixes" it to parseFloat later.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => value);

/** Anything that can run a query: the pool itself or a client checked out for a transaction. */
export type Queryable = Pool | PoolClient;

// TLS, channel binding and pool limits: see buildPoolConfig.
export const pool: Pool = new pg.Pool(buildPoolConfig(config));

// An idle client erroring (e.g. DB restart) emits 'error' on the pool; unhandled, it crashes Node.
pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

export const closePool = async (): Promise<void> => {
  await pool.end();
};
