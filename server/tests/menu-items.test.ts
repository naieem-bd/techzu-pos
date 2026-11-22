import request from 'supertest';
import { createApp } from '../src/app';
import { closePool } from '../src/db/pool';
import { createMenuItem, truncateAll } from './helpers/db';
import { dataOf, errorOf, errorPaths, metaOf } from './helpers/http';

// Requires the test database: `docker compose up -d db_test`.
const app = createApp();

interface MenuItemDto {
  id: number;
  sku: string;
  name: string;
  category: string;
  basePrice: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const LATTE = { sku: 'COF-LAT', name: 'Caffe Latte', category: 'Coffee', basePrice: '4.5' };

beforeEach(truncateAll);

afterAll(async () => {
  await closePool();
});

describe('POST /api/menu-items', () => {
  it('creates a menu item (201) with money returned as a 2-decimal string', async () => {
    const res = await request(app).post('/api/menu-items').send(LATTE);

    expect(res.status).toBe(201);
    expect(dataOf<MenuItemDto>(res.body)).toEqual({
      id: expect.any(Number) as number,
      sku: 'COF-LAT',
      name: 'Caffe Latte',
      category: 'Coffee',
      basePrice: '4.50',
      isActive: true,
      createdAt: expect.any(String) as string,
      updatedAt: expect.any(String) as string,
    });
  });

  it('returns 409 MENU_ITEM_SKU_TAKEN for a duplicate SKU', async () => {
    await createMenuItem({ sku: 'COF-LAT' });

    const res = await request(app).post('/api/menu-items').send(LATTE);

    expect(res.status).toBe(409);
    expect(errorOf(res.body).code).toBe('MENU_ITEM_SKU_TAKEN');
  });

  it.each([
    ['a JSON number', 4.5],
    ['more than 2 decimals', '1.234'],
    ['a negative value', '-1.00'],
    ['too many digits for NUMERIC(12,2)', '12345678901.00'],
  ])('returns 422 when basePrice is %s', async (_label, basePrice) => {
    const res = await request(app)
      .post('/api/menu-items')
      .send({ ...LATTE, basePrice });

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toEqual(['body.basePrice']);
  });

  it('returns 422 for missing fields and unknown fields', async () => {
    const res = await request(app).post('/api/menu-items').send({ sku: 'X', isActive: false });

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toEqual(
      expect.arrayContaining(['body.name', 'body.category', 'body.basePrice', 'body.isActive']),
    );
  });
});

describe('GET /api/menu-items', () => {
  beforeEach(async () => {
    await createMenuItem({ sku: 'COF-ESP', name: 'Espresso', category: 'Coffee' });
    await createMenuItem({ sku: 'COF-LAT', name: 'Caffe Latte', category: 'Coffee' });
    await createMenuItem({ sku: 'TEA-GRN', name: 'Green Tea', category: 'Tea' });
    await createMenuItem({
      sku: 'PAS-OLD',
      name: '50% Off Muffin',
      category: 'Pastry',
      isActive: false,
    });
  });

  const skus = (body: unknown): string[] => dataOf<MenuItemDto[]>(body).map((i) => i.sku);

  it('lists all items ordered by category then name, with meta', async () => {
    const res = await request(app).get('/api/menu-items');

    expect(res.status).toBe(200);
    expect(skus(res.body)).toEqual(['COF-LAT', 'COF-ESP', 'PAS-OLD', 'TEA-GRN']);
    expect(metaOf(res.body)).toEqual({ total: 4, limit: 20, offset: 0 });
  });

  it('filters by category and isActive', async () => {
    const coffee = await request(app).get('/api/menu-items?category=Coffee');
    const inactive = await request(app).get('/api/menu-items?isActive=false');
    const active = await request(app).get('/api/menu-items?isActive=true');

    expect(skus(coffee.body)).toEqual(['COF-LAT', 'COF-ESP']);
    expect(skus(inactive.body)).toEqual(['PAS-OLD']);
    expect(metaOf(active.body).total).toBe(3);
  });

  it('searches name or SKU and treats % literally', async () => {
    const byName = await request(app).get('/api/menu-items?search=latte');
    const bySku = await request(app).get('/api/menu-items?search=tea-');
    const literal = await request(app).get('/api/menu-items?search=50%25');

    expect(skus(byName.body)).toEqual(['COF-LAT']);
    expect(skus(bySku.body)).toEqual(['TEA-GRN']);
    expect(skus(literal.body)).toEqual(['PAS-OLD']);
  });

  it('paginates', async () => {
    const res = await request(app).get('/api/menu-items?limit=2&offset=2');

    expect(skus(res.body)).toEqual(['PAS-OLD', 'TEA-GRN']);
    expect(metaOf(res.body)).toEqual({ total: 4, limit: 2, offset: 2 });
  });

  it('returns 422 for an invalid isActive or limit', async () => {
    const res = await request(app).get('/api/menu-items?isActive=yes&limit=0');

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toEqual(expect.arrayContaining(['query.isActive', 'query.limit']));
  });
});

describe('PATCH /api/menu-items/:id', () => {
  let id: number;

  beforeEach(async () => {
    id = await createMenuItem({ basePrice: '3.00' });
  });

  it('updates only the provided fields', async () => {
    const res = await request(app)
      .patch(`/api/menu-items/${String(id)}`)
      .send({ basePrice: '3.25', isActive: false });

    expect(res.status).toBe(200);
    expect(dataOf<MenuItemDto>(res.body)).toMatchObject({
      id,
      sku: 'COF-ESP',
      name: 'Espresso',
      category: 'Coffee',
      basePrice: '3.25',
      isActive: false,
    });
  });

  it('returns 404 MENU_ITEM_NOT_FOUND for an unknown id', async () => {
    const res = await request(app).patch('/api/menu-items/999999').send({ name: 'Ghost' });

    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('MENU_ITEM_NOT_FOUND');
  });

  it('returns 422 for an empty body', async () => {
    const res = await request(app)
      .patch(`/api/menu-items/${String(id)}`)
      .send({});

    expect(res.status).toBe(422);
    expect(errorOf(res.body).details?.[0]?.message).toBe('At least one field must be provided');
  });

  it('returns 422 when trying to change the SKU (not an editable field)', async () => {
    const res = await request(app)
      .patch(`/api/menu-items/${String(id)}`)
      .send({ name: 'Double Espresso', sku: 'NEW' });

    expect(res.status).toBe(422);
    expect(errorPaths(res.body)).toEqual(['body.sku']);
  });

  it.each(['abc', '0', '-1', '1.5'])(
    'returns 422 for a non-positive-integer id "%s"',
    async (bad) => {
      const res = await request(app).patch(`/api/menu-items/${bad}`).send({ name: 'X' });

      expect(res.status).toBe(422);
      expect(errorPaths(res.body)).toEqual(['params.id']);
    },
  );
});
