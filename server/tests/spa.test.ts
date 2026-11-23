import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app';
import { closePool } from '../src/db/pool';
import { errorOf } from './helpers/http';

const INDEX_HTML = '<!doctype html><html><body><div id="root"></div></body></html>';
const ASSET_JS = 'console.info("app");';

let distDir: string;

beforeAll(() => {
  distDir = mkdtempSync(path.join(tmpdir(), 'techzu-spa-'));
  mkdirSync(path.join(distDir, 'assets'));
  writeFileSync(path.join(distDir, 'index.html'), INDEX_HTML);
  writeFileSync(path.join(distDir, 'assets', 'app-abc123.js'), ASSET_JS);
  writeFileSync(path.join(distDir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
});

afterAll(async () => {
  rmSync(distDir, { recursive: true, force: true });
  await closePool();
});

describe('SPA serving when client/dist exists', () => {
  const app = (): ReturnType<typeof createApp> => createApp({ clientDistPath: distDir });

  it.each(['/', '/outlets/1/pos', '/hq/menu?tab=items'])(
    'GET %s returns index.html with no-cache',
    async (url) => {
      const res = await request(app()).get(url);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.text).toBe(INDEX_HTML);
    },
  );

  it('keeps helmet security headers (CSP) on the SPA shell', async () => {
    const res = await request(app()).get('/');

    expect(res.headers['content-security-policy']).toMatch(/script-src 'self'/);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('serves fingerprinted assets with a long immutable cache', async () => {
    const res = await request(app()).get('/assets/app-abc123.js');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
    expect(res.headers['cache-control']).toMatch(/immutable/);
    expect(res.text).toBe(ASSET_JS);
  });

  it('serves other static files without the immutable cache', async () => {
    const res = await request(app()).get('/favicon.svg');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).not.toMatch(/immutable/);
  });

  it('answers a missing asset with a JSON 404, not index.html', async () => {
    const res = await request(app()).get('/assets/missing.js');

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('ROUTE_NOT_FOUND');
  });

  it.each(['/api', '/api/nope', '/api/outlets/1/nope'])(
    'keeps JSON 404s for unknown API route %s',
    async (url) => {
      const res = await request(app()).get(url);

      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(errorOf(res.body).code).toBe('ROUTE_NOT_FOUND');
    },
  );

  it('does not serve index.html for non-GET requests', async () => {
    const res = await request(app()).post('/outlets').send({});

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('ROUTE_NOT_FOUND');
  });

  it('still serves the API', async () => {
    const res = await request(app()).get('/api/health');

    expect(res.status).toBe(200);
  });
});

describe('SPA serving when client/dist is absent', () => {
  it('skips the SPA silently and returns the JSON 404', async () => {
    const app = createApp({ clientDistPath: path.join(distDir, 'does-not-exist') });

    const res = await request(app).get('/');

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('ROUTE_NOT_FOUND');
  });

  it('skips a directory that has no index.html', async () => {
    const app = createApp({ clientDistPath: path.join(distDir, 'assets') });

    const res = await request(app).get('/outlets/1/pos');

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('ROUTE_NOT_FOUND');
  });
});
