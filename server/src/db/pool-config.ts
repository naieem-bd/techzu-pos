import type { PoolConfig } from 'pg';
import type { Config } from '../config/env';
import { readTlsParams, withoutTlsParams } from '../utils/connection-string';

export type PoolSettings = Pick<Config, 'DATABASE_URL' | 'DB_SSL' | 'DB_POOL_MAX'>;

/**
 * Pure, so the TLS decision is unit-testable without a database.
 *
 * DB_SSL is the single switch (config validation already rejects a URL that contradicts it).
 * With DB_SSL=true the server certificate is always verified against Node's CA bundle, including
 * the hostname (Neon uses a public CA, so no custom `ca` is needed). The URL's sslmode /
 * channel_binding are stripped first, because pg would otherwise override `ssl` with them.
 *
 * Channel binding (SCRAM-SHA-256-PLUS) ties the password exchange to this TLS session, so a
 * man-in-the-middle can't relay it. It is on whenever TLS is, unless the URL says
 * `channel_binding=disable`. node-postgres uses it when the server offers it.
 */
export const buildPoolConfig = (settings: PoolSettings): PoolConfig => {
  const { channelBinding } = readTlsParams(settings.DATABASE_URL);

  return {
    connectionString: withoutTlsParams(settings.DATABASE_URL),
    ssl: settings.DB_SSL ? { rejectUnauthorized: true } : false,
    enableChannelBinding: settings.DB_SSL && channelBinding !== 'disable',
    max: settings.DB_POOL_MAX,
    idleTimeoutMillis: 30_000,
    // Fail fast instead of hanging a request forever when the DB is unreachable.
    connectionTimeoutMillis: 5_000,
  };
};
