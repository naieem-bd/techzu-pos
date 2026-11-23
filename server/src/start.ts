import { config } from './config/env';
import { runMigrations } from './db/migrate';
import { closePool, pool } from './db/pool';
import { seedDatabase } from './db/seed';
import { startServer } from './server';
import { logger } from './utils/logger';

/**
 * Production entrypoint (Docker CMD): migrate, optionally seed, then serve.
 * Migrations hold an advisory lock, so two instances starting together are safe; the seed is
 * idempotent (ON CONFLICT DO NOTHING) and never resets stock, so it can run on every start.
 * If either step fails the process exits non-zero instead of serving a half-ready database.
 */
const main = async (): Promise<void> => {
  try {
    const applied = await runMigrations(pool);
    logger.info({ count: applied.length }, 'Migrations complete');

    if (config.SEED_ON_START) {
      const inserted = await seedDatabase(pool);
      logger.info({ inserted }, 'Seed complete');
    }
  } catch (err) {
    logger.error({ err }, 'Startup failed before the server could listen');
    await closePool();
    process.exitCode = 1;
    return;
  }

  // The pool stays open: the server reuses it and closes it on shutdown.
  startServer();
};

void main();
