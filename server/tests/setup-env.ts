import path from 'node:path';
import dotenv from 'dotenv';

// Load TEST_DATABASE_URL (and friends) from the repo-root .env if present.
dotenv.config({
  path: [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../.env')],
  quiet: true,
});

// Defaults match docker-compose.yml + .env.example, so `docker compose up -d db_test` is enough.
const DEFAULT_TEST_DATABASE_URL = 'postgres://pos_user:change_me@localhost:5433/techzu_pos_test';

// Point the app at the TEST database before src/config/env.ts is ever imported.
// Overwriting DATABASE_URL here guarantees tests can never touch the dev database.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
process.env.DB_SSL = 'false';
