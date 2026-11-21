import type { Pool, PoolClient } from 'pg';
import { pool as defaultPool } from './pool';

/**
 * Runs `fn` inside BEGIN/COMMIT on a single dedicated client.
 * Any error rolls back and is re-thrown. The client is always released.
 * Pass `client` into repositories so several of them share the same transaction.
 */
export const withTransaction = async <T>(
  fn: (client: PoolClient) => Promise<T>,
  db: Pool = defaultPool,
): Promise<T> => {
  const client = await db.connect();
  let releaseError: Error | undefined;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // The connection is in an unknown state: destroy it instead of returning it to the pool.
      releaseError = rollbackErr instanceof Error ? rollbackErr : new Error('ROLLBACK failed');
    }
    throw err;
  } finally {
    client.release(releaseError);
  }
};
