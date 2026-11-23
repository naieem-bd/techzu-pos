import { loadConfig } from '../src/config/env';

const validEnv = {
  NODE_ENV: 'production',
  PORT: '8080',
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  CORS_ORIGIN: 'http://a.test, http://b.test',
  LOG_LEVEL: 'warn',
  DB_SSL: 'false',
};

describe('loadConfig()', () => {
  it('parses and coerces a valid environment', () => {
    const config = loadConfig(validEnv);

    expect(config.PORT).toBe(8080);
    expect(config.CORS_ORIGIN).toEqual(['http://a.test', 'http://b.test']);
    expect(config.DB_SSL).toBe(false);
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('treats DB_SSL="true" as true', () => {
    expect(loadConfig({ ...validEnv, DB_SSL: 'true' }).DB_SSL).toBe(true);
  });

  it('defaults DB_POOL_MAX to 10 and coerces a numeric string', () => {
    expect(loadConfig(validEnv).DB_POOL_MAX).toBe(10);
    expect(loadConfig({ ...validEnv, DB_POOL_MAX: '25' }).DB_POOL_MAX).toBe(25);
  });

  it.each(['0', '101', 'abc', '2.5'])('rejects DB_POOL_MAX=%s', (value) => {
    expect(() => loadConfig({ ...validEnv, DB_POOL_MAX: value })).toThrow(/DB_POOL_MAX/);
  });

  describe('CORS_ORIGIN default on Render', () => {
    const withoutCors = { ...validEnv, CORS_ORIGIN: undefined };
    const RENDER_URL = 'https://techzu-pos.onrender.com';

    it('defaults CORS_ORIGIN to RENDER_EXTERNAL_URL when unset', () => {
      const config = loadConfig({ ...withoutCors, RENDER_EXTERNAL_URL: RENDER_URL });

      expect(config.CORS_ORIGIN).toEqual([RENDER_URL]);
    });

    it('treats an empty CORS_ORIGIN as unset', () => {
      const config = loadConfig({
        ...validEnv,
        CORS_ORIGIN: '  ',
        RENDER_EXTERNAL_URL: RENDER_URL,
      });

      expect(config.CORS_ORIGIN).toEqual([RENDER_URL]);
    });

    it('lets an explicit CORS_ORIGIN win over RENDER_EXTERNAL_URL', () => {
      const config = loadConfig({ ...validEnv, RENDER_EXTERNAL_URL: RENDER_URL });

      expect(config.CORS_ORIGIN).toEqual(['http://a.test', 'http://b.test']);
    });

    it('still requires CORS_ORIGIN when RENDER_EXTERNAL_URL is not set either', () => {
      expect(() => loadConfig(withoutCors)).toThrow(/CORS_ORIGIN/);
    });

    it('rejects an invalid RENDER_EXTERNAL_URL through the CORS_ORIGIN check', () => {
      expect(() => loadConfig({ ...withoutCors, RENDER_EXTERNAL_URL: 'not a url' })).toThrow(
        /CORS_ORIGIN/,
      );
    });
  });

  describe('SEED_ON_START', () => {
    it('defaults to false', () => {
      expect(loadConfig(validEnv).SEED_ON_START).toBe(false);
    });

    it.each([
      ['true', true],
      ['false', false],
    ])('parses "%s" as %s', (value, expected) => {
      expect(loadConfig({ ...validEnv, SEED_ON_START: value }).SEED_ON_START).toBe(expected);
    });

    it.each(['yes', '1', 'TRUE', ''])('rejects SEED_ON_START=%j', (value) => {
      expect(() => loadConfig({ ...validEnv, SEED_ON_START: value })).toThrow(/SEED_ON_START/);
    });
  });

  describe('DB_SSL vs TLS parameters in DATABASE_URL', () => {
    const NEON_URL =
      'postgresql://owner:s3cret@ep-x.ap-southeast-1.aws.neon.tech/db' +
      '?sslmode=require&channel_binding=require';

    it('accepts a Neon URL with DB_SSL=true', () => {
      const config = loadConfig({ ...validEnv, DATABASE_URL: NEON_URL, DB_SSL: 'true' });

      expect(config.DB_SSL).toBe(true);
    });

    it.each(['require', 'verify-ca', 'verify-full'])(
      'rejects sslmode=%s with DB_SSL=false, without echoing the URL',
      (mode) => {
        const run = (): unknown =>
          loadConfig({
            ...validEnv,
            DATABASE_URL: `postgres://u:s3cret@h/db?sslmode=${mode}`,
            DB_SSL: 'false',
          });

        expect(run).toThrow(/DB_SSL: must be "true" when DATABASE_URL has sslmode=/);
        expect(run).not.toThrow(/s3cret/);
      },
    );

    it('rejects channel_binding=require with DB_SSL=false', () => {
      expect(() =>
        loadConfig({
          ...validEnv,
          DATABASE_URL: 'postgres://u:p@h/db?channel_binding=require',
          DB_SSL: 'false',
        }),
      ).toThrow(/DB_SSL: .*channel_binding=require/);
    });

    it.each(['disable', 'no-verify'])('rejects sslmode=%s with DB_SSL=true', (mode) => {
      expect(() =>
        loadConfig({
          ...validEnv,
          DATABASE_URL: `postgres://u:p@h/db?sslmode=${mode}`,
          DB_SSL: 'true',
        }),
      ).toThrow(/DATABASE_URL: sslmode=.* conflicts with DB_SSL=true/);
    });

    it('accepts sslmode=disable with DB_SSL=false (local)', () => {
      const env = { ...validEnv, DATABASE_URL: 'postgres://u:p@h/db?sslmode=disable' };

      expect(loadConfig(env).DB_SSL).toBe(false);
    });
  });

  it('fails fast listing every invalid variable without echoing values', () => {
    const run = (): unknown =>
      loadConfig({ ...validEnv, PORT: 'abc', DATABASE_URL: 'mysql://secret@x', DB_SSL: 'yes' });

    expect(run).toThrow(/Invalid environment configuration/);
    expect(run).toThrow(/PORT/);
    expect(run).toThrow(/DATABASE_URL/);
    expect(run).toThrow(/DB_SSL/);
    expect(run).not.toThrow(/secret/);
  });
});
