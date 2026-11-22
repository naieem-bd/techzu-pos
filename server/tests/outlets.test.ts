import request from 'supertest';
import { createApp } from '../src/app';
import { closePool, pool } from '../src/db/pool';
import { countRows, createOutlet, truncateAll } from './helpers/db';
import { dataOf, errorOf, errorPaths, metaOf } from './helpers/http';

// Requires the test database: `docker compose up -d db_test`.
const app = createApp();

interface OutletDto {
  id: number;
  code: string;
  name: string;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

beforeEach(truncateAll);

afterAll(async () => {
  await closePool();
});

describe('POST /api/outlets', () => {
  it('creates an outlet (201) and its receipt counter starting at 0 in the same transaction', async () => {
    const res = await request(app)
      .post('/api/outlets')
      .send({ code: 'DT01', name: '  Downtown ', address: '12 Market Street' });

    expect(res.status).toBe(201);
    const outlet = dataOf<OutletDto>(res.body);
    expect(outlet).toEqual({
      id: expect.any(Number) as number,
      code: 'DT01',
      name: 'Downtown',
      address: '12 Market Street',
      createdAt: expect.any(String) as string,
      updatedAt: expect.any(String) as string,
    });

    const { rows } = await pool.query<{ last_number: string }>(
      'SELECT last_number FROM receipt_counters WHERE outlet_id = $1',
      [outlet.id],
    );
    expect(rows).toEqual([{ last_number: '0' }]);
  });

  it('stores a missing address as null', async () => {
    const res = await request(app).post('/api/outlets').send({ code: 'AP03', name: 'Airport' });

    expect(res.status).toBe(201);
    expect(dataOf<OutletDto>(res.body).address).toBeNull();
  });

  it('returns 409 OUTLET_CODE_TAKEN for a duplicate code and leaves no extra counter', async () => {
    await createOutlet('DT01');

    const res = await request(app).post('/api/outlets').send({ code: 'DT01', name: 'Other' });

    expect(res.status).toBe(409);
    expect(errorOf(res.body).code).toBe('OUTLET_CODE_TAKEN');
    expect(await countRows('receipt_counters', 'true', [])).toBe(1);
  });

  it('returns 422 for missing/invalid fields', async () => {
    const res = await request(app).post('/api/outlets').send({ code: 'x', name: '   ' });

    expect(res.status).toBe(422);
    expect(errorOf(res.body).code).toBe('VALIDATION_ERROR');
    expect(errorPaths(res.body)).toEqual(expect.arrayContaining(['body.code', 'body.name']));
  });

  it('returns 422 for a code with illegal characters', async () => {
    const res = await request(app).post('/api/outlets').send({ code: 'DT 01', name: 'Downtown' });

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toEqual(['body.code']);
  });

  it('rejects unknown fields (strict)', async () => {
    const res = await request(app)
      .post('/api/outlets')
      .send({ code: 'DT01', name: 'Downtown', id: 99 });

    expect(res.status).toBe(422);
    expect(errorOf(res.body).details).toEqual([
      { location: 'body', path: 'id', message: 'Unknown field' },
    ]);
  });
});

describe('GET /api/outlets', () => {
  beforeEach(async () => {
    await createOutlet('DT01', 'Downtown');
    await createOutlet('ML02', 'City Mall');
    await createOutlet('AP03', 'Airport');
  });

  it('lists outlets ordered by name with pagination meta', async () => {
    const res = await request(app).get('/api/outlets');

    expect(res.status).toBe(200);
    expect(dataOf<OutletDto[]>(res.body).map((o) => o.name)).toEqual([
      'Airport',
      'City Mall',
      'Downtown',
    ]);
    expect(metaOf(res.body)).toEqual({ total: 3, limit: 20, offset: 0 });
  });

  it('applies limit and offset while reporting the full total', async () => {
    const res = await request(app).get('/api/outlets?limit=1&offset=1');

    expect(res.status).toBe(200);
    expect(dataOf<OutletDto[]>(res.body).map((o) => o.code)).toEqual(['ML02']);
    expect(metaOf(res.body)).toEqual({ total: 3, limit: 1, offset: 1 });
  });

  it('searches by code or name, case-insensitively', async () => {
    const byName = await request(app).get('/api/outlets?search=mall');
    const byCode = await request(app).get('/api/outlets?search=ap0');

    expect(dataOf<OutletDto[]>(byName.body).map((o) => o.code)).toEqual(['ML02']);
    expect(dataOf<OutletDto[]>(byCode.body).map((o) => o.code)).toEqual(['AP03']);
  });

  it('treats LIKE wildcards in search literally', async () => {
    const res = await request(app).get('/api/outlets?search=%25');

    expect(res.status).toBe(200);
    expect(dataOf<OutletDto[]>(res.body)).toEqual([]);
    expect(metaOf(res.body).total).toBe(0);
  });

  it('returns 422 for limit above 100, negative offset or unknown query params', async () => {
    const res = await request(app).get('/api/outlets?limit=101&offset=-1&sort=name');

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toEqual(
      expect.arrayContaining(['query.limit', 'query.offset', 'query.sort']),
    );
  });
});
