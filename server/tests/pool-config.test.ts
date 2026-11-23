import pg from 'pg';
import { buildPoolConfig } from '../src/db/pool-config';

// The shape of a Neon DIRECT (non-pooled) connection string.
const NEON_URL =
  'postgresql://pos_owner:s3cret@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/techzu_pos' +
  '?sslmode=require&channel_binding=require';
const LOCAL_URL = 'postgres://pos_user:change_me@db:5432/techzu_pos';

/**
 * What node-postgres will actually use: a pg.Client resolves the connection string merged with
 * the explicit options (URL wins), exactly as each pooled connection does. No network involved.
 */
const resolvedBy = (
  poolConfig: pg.PoolConfig,
): { ssl: unknown; enableChannelBinding: boolean; host: string; database: string | undefined } => {
  const client = new pg.Client(poolConfig) as pg.Client & {
    connectionParameters: { ssl: unknown; host: string; database: string | undefined };
    enableChannelBinding: boolean;
  };
  return {
    ssl: client.connectionParameters.ssl,
    enableChannelBinding: client.enableChannelBinding,
    host: client.connectionParameters.host,
    database: client.connectionParameters.database,
  };
};

describe('buildPoolConfig()', () => {
  describe('Neon (DB_SSL=true, sslmode=require&channel_binding=require)', () => {
    const settings = { DATABASE_URL: NEON_URL, DB_SSL: true, DB_POOL_MAX: 5 };

    it('strips the libpq TLS parameters and sets ssl/channel binding explicitly', () => {
      const poolConfig = buildPoolConfig(settings);

      expect(poolConfig.connectionString).not.toMatch(/sslmode|channel_binding/);
      expect(poolConfig.connectionString).toContain('ep-cool-name-123456');
      expect(poolConfig.ssl).toEqual({ rejectUnauthorized: true });
      expect(poolConfig.enableChannelBinding).toBe(true);
      expect(poolConfig.max).toBe(5);
    });

    it('leaves pg with a verifying TLS config and channel binding on', () => {
      expect(resolvedBy(buildPoolConfig(settings))).toEqual({
        ssl: { rejectUnauthorized: true },
        enableChannelBinding: true,
        host: 'ep-cool-name-123456.ap-southeast-1.aws.neon.tech',
        database: 'techzu_pos',
      });
    });

    it('emits no sslmode SECURITY WARNING', () => {
      const emitWarning = jest.spyOn(process, 'emitWarning').mockImplementation(() => undefined);

      resolvedBy(buildPoolConfig(settings));

      expect(emitWarning).not.toHaveBeenCalled();
    });

    it('keeps unrelated query parameters', () => {
      const poolConfig = buildPoolConfig({
        ...settings,
        DATABASE_URL: `${NEON_URL}&application_name=techzu-pos`,
      });

      expect(poolConfig.connectionString).toMatch(/\?application_name=techzu-pos$/);
    });

    it('turns channel binding off only when the URL says channel_binding=disable', () => {
      const url = NEON_URL.replace('channel_binding=require', 'channel_binding=disable');

      expect(buildPoolConfig({ ...settings, DATABASE_URL: url }).enableChannelBinding).toBe(false);
    });
  });

  it('shows why: without stripping, the URL overrides ssl and pg warns', () => {
    const emitWarning = jest.spyOn(process, 'emitWarning').mockImplementation(() => undefined);

    const naive = resolvedBy({ connectionString: NEON_URL, ssl: { rejectUnauthorized: true } });

    expect(naive.ssl).toEqual({}); // our explicit option was replaced by the URL's sslmode
    expect(naive.enableChannelBinding).toBe(false); // channel_binding=require was ignored
    expect(emitWarning).toHaveBeenCalledWith(expect.stringMatching(/SECURITY WARNING/));
  });

  it('local compose (DB_SSL=false): plain connection, no channel binding', () => {
    const poolConfig = buildPoolConfig({ DATABASE_URL: LOCAL_URL, DB_SSL: false, DB_POOL_MAX: 10 });

    expect(poolConfig.connectionString).toBe(LOCAL_URL);
    expect(resolvedBy(poolConfig)).toMatchObject({ ssl: false, enableChannelBinding: false });
  });
});
