// Must stay the FIRST import: it sets the test env before config/pool modules load
// (compiled to CommonJS, requires run in source order).
import './setup-env';
import { resetSchema, runMigrations } from '../src/db/migrate';
import { closePool, pool } from '../src/db/pool';

/**
 * Runs once before the whole suite: wipe the test DB and apply all migrations, so every
 * run starts from the exact schema the migrations produce. Tests create their own data.
 * Default export is required by Jest's globalSetup contract.
 */
export default async function globalSetup(): Promise<void> {
  try {
    await resetSchema(pool);
    await runMigrations(pool);
  } finally {
    await closePool();
  }
}
