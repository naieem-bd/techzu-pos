import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { closePool, pool } from './pool';
import { withTransaction } from './transaction';

export const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

// Arbitrary app-wide key: concurrent runners (e.g. two containers starting) queue on it.
const MIGRATION_LOCK_KEY = 728_391_004;
const MIGRATION_FILE = /^(\d{3})_[a-z0-9_]+\.sql$/;

interface MigrationFile {
  version: string;
  name: string;
  sql: string;
  checksum: string;
}

interface AppliedMigration {
  version: string;
  checksum: string;
}

// Hash with normalised line endings so a Windows (CRLF) checkout matches Linux (LF).
const checksumOf = (sql: string): string =>
  createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');

export const loadMigrationFiles = async (
  dir: string = MIGRATIONS_DIR,
): Promise<MigrationFile[]> => {
  const entries = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
  const files: MigrationFile[] = [];
  for (const name of entries) {
    const match = MIGRATION_FILE.exec(name);
    if (!match?.[1]) {
      throw new Error(`Invalid migration file name "${name}" (expected NNN_snake_name.sql)`);
    }
    const sql = await readFile(path.join(dir, name), 'utf8');
    files.push({ version: match[1], name, sql, checksum: checksumOf(sql) });
  }
  const versions = files.map((file) => file.version);
  if (new Set(versions).size !== versions.length) {
    throw new Error('Duplicate migration version numbers found');
  }
  return files;
};

const lock = async (client: PoolClient): Promise<void> => {
  await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY]);
};

const ensureMigrationsTable = (db: Pool): Promise<void> =>
  withTransaction(async (client) => {
    await lock(client);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT        PRIMARY KEY,
        name       TEXT        NOT NULL,
        checksum   TEXT        NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
  }, db);

/**
 * Applies pending migrations in version order. Each file runs in its own transaction
 * together with its schema_migrations row, so a failure leaves no half-applied file.
 * Already-applied files are skipped (idempotent); if one was edited after being applied
 * the run fails, because migrations are append-only.
 * Returns the names of the files applied in this run.
 */
export const runMigrations = async (db: Pool, dir: string = MIGRATIONS_DIR): Promise<string[]> => {
  const files = await loadMigrationFiles(dir);
  await ensureMigrationsTable(db);

  const applied: string[] = [];
  for (const file of files) {
    const didApply = await withTransaction(async (client) => {
      await lock(client);
      // Re-checked under the lock, so a concurrent runner can't apply the same file twice.
      const { rows } = await client.query<AppliedMigration>(
        'SELECT version, checksum FROM schema_migrations WHERE version = $1',
        [file.version],
      );
      const existing = rows[0];
      if (existing) {
        if (existing.checksum !== file.checksum) {
          throw new Error(
            `Migration ${file.name} was modified after being applied. Add a new migration instead.`,
          );
        }
        return false;
      }
      await client.query(file.sql);
      await client.query(
        'INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)',
        [file.version, file.name, file.checksum],
      );
      return true;
    }, db);

    if (didApply) {
      logger.info({ migration: file.name }, 'Applied migration');
      applied.push(file.name);
    }
  }
  return applied;
};

/** Drops every object in the public schema. Development/test only. */
export const resetSchema = async (db: Pool): Promise<void> => {
  if (config.NODE_ENV === 'production') {
    throw new Error('Refusing to reset the database when NODE_ENV=production');
  }
  await db.query('DROP SCHEMA public CASCADE');
  await db.query('CREATE SCHEMA public');
};

const main = async (): Promise<void> => {
  try {
    const applied = await runMigrations(pool);
    logger.info({ count: applied.length }, 'Migrations complete');
  } catch (err) {
    logger.error({ err }, 'Migration failed');
    process.exitCode = 1;
  } finally {
    await closePool();
  }
};

if (require.main === module) {
  void main();
}
