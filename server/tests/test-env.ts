import path from 'node:path';
import dotenv from 'dotenv';

// Defaults match docker-compose.yml + .env.example, so `docker compose up -d db_test` is enough.
const DEFAULT_TEST_DATABASE_URL = 'postgres://pos_user:change_me@localhost:5433/techzu_pos_test';

/**
 * Points the app at the TEST database. Must run before src/config/env.ts is imported.
 * Overwriting DATABASE_URL guarantees tests can never touch the dev database.
 * Used by both Jest globalSetup (once) and setupFiles (each test file).
 */
export const applyTestEnv = (): void => {
  dotenv.config({
    path: [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../.env')],
    quiet: true,
  });
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  process.env.LOG_LEVEL = 'silent';
  process.env.CORS_ORIGIN ??= 'http://localhost:5173';
  process.env.DB_SSL = 'false';
};
