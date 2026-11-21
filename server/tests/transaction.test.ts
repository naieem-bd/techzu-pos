import { Pool } from 'pg';
import { config } from '../src/config/env';
import { closePool } from '../src/db/pool';
import { withTransaction } from '../src/db/transaction';

// Requires the test database: `docker compose up -d db_test`.
// max: 1 => every call uses the same physical connection, so a session-scoped TEMP table
// created outside the transaction is visible inside it and afterwards.
const testPool = new Pool({ connectionString: config.DATABASE_URL, max: 1 });

const countRows = async (): Promise<number> => {
  const { rows } = await testPool.query<{ count: string }>(
    'SELECT count(*) AS count FROM tx_probe',
  );
  return Number(rows[0]?.count);
};

beforeAll(async () => {
  await testPool.query('CREATE TEMP TABLE tx_probe (id INT PRIMARY KEY)');
});

beforeEach(async () => {
  await testPool.query('TRUNCATE tx_probe');
});

afterAll(async () => {
  await testPool.end();
  await closePool();
});

describe('withTransaction()', () => {
  it('rolls back every statement and re-throws when the callback throws', async () => {
    const boom = new Error('boom');

    await expect(
      withTransaction(async (client) => {
        await client.query('INSERT INTO tx_probe (id) VALUES (1), (2)');
        throw boom;
      }, testPool),
    ).rejects.toBe(boom);

    expect(await countRows()).toBe(0);
  });

  it('commits and returns the callback result on success', async () => {
    const result = await withTransaction(async (client) => {
      await client.query('INSERT INTO tx_probe (id) VALUES (1)');
      return 'done';
    }, testPool);

    expect(result).toBe('done');
    expect(await countRows()).toBe(1);
  });

  it('always releases the client back to the pool', async () => {
    await withTransaction(() => Promise.reject(new Error('fail')), testPool).catch(() => undefined);

    expect(testPool.totalCount).toBe(1);
    expect(testPool.idleCount).toBe(1);
    expect(testPool.waitingCount).toBe(0);
  });
});
