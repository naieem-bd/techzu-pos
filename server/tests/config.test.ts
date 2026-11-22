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
