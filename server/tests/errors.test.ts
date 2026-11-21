import request from 'supertest';
import { createApp } from '../src/app';
import { closePool } from '../src/db/pool';

const app = createApp();

afterAll(async () => {
  await closePool();
});

describe('error handling', () => {
  it('returns 404 ROUTE_NOT_FOUND with the standard error shape for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'ROUTE_NOT_FOUND', message: 'Route GET /api/does-not-exist not found' },
    });
    expect(res.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('returns 400 INVALID_JSON for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
  });

  it('echoes a safe client-supplied x-request-id', async () => {
    const res = await request(app).get('/nope').set('x-request-id', 'trace-abc-123');

    expect(res.headers['x-request-id']).toBe('trace-abc-123');
  });

  it('does not expose x-powered-by', async () => {
    const res = await request(app).get('/nope');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
