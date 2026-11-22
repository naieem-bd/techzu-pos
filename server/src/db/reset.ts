import { config } from '../config/env';
import { logger } from '../utils/logger';
import { resetSchema, runMigrations } from './migrate';
import { closePool, pool } from './pool';
import { seedDatabase } from './seed';

/** Drop everything, re-apply migrations and seed. Never allowed in production. */
const main = async (): Promise<void> => {
  try {
    if (config.NODE_ENV === 'production') {
      throw new Error('Refusing to reset the database when NODE_ENV=production');
    }
    await resetSchema(pool);
    const applied = await runMigrations(pool);
    const inserted = await seedDatabase(pool);
    logger.info({ migrations: applied.length, inserted }, 'Database reset complete');
  } catch (err) {
    logger.error({ err }, 'Database reset failed');
    process.exitCode = 1;
  } finally {
    await closePool();
  }
};

void main();
