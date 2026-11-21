import request from 'supertest';
import { createApp } from '../src/app';
import { closePool } from '../src/db/pool';

// Requires the test database: `docker compose up -d db_test`.
const app = createApp();

afterAll(async () => {
  await closePool();
});

describe('GET /api/health', () => {
  it('returns 200 with db "up" when PostgreSQL is reachable', async () => {
    const res = await request(app).get('/api/health');

    const body = res.body as { data: { status: string; db: string; uptime: unknown } };
    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({ status: 'ok', db: 'up' });
    expect(typeof body.data.uptime).toBe('number');
    expect(res.headers['ratelimit-policy']).toBeDefined();
  });
});
