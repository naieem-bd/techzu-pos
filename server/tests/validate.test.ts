import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { errorHandler } from '../src/middlewares/error-handler';
import { requestLogger } from '../src/middlewares/request-logger';
import { validate } from '../src/middlewares/validate';
import type { ValidatedRequest } from '../src/middlewares/validate';

// Test-only router: exercises validate() in isolation, nothing here ships in app code.
const schemas = {
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: z.object({ dryRun: z.enum(['true', 'false']).optional() }),
  body: z.object({
    name: z.string().min(1),
    quantity: z.number().int().min(1),
  }),
};

const buildTestApp = (): express.Express => {
  const app = express();
  app.use(requestLogger);
  app.use(express.json());
  app.post('/items/:id', validate(schemas), (req, res) => {
    const typedReq = req as unknown as ValidatedRequest<typeof schemas>;
    res.status(201).json({ data: { params: typedReq.params, body: typedReq.body } });
  });
  app.use(errorHandler);
  return app;
};

const app = buildTestApp();

interface ErrorResponse {
  error: { code: string; message: string; details: { location: string; path: string }[] };
}

const errorOf = (body: unknown): ErrorResponse['error'] => (body as ErrorResponse).error;

describe('validate()', () => {
  it('rejects an invalid body with 422 VALIDATION_ERROR and per-field details', async () => {
    const res = await request(app).post('/items/1').send({ name: '', quantity: 0 });

    expect(res.status).toBe(422);
    expect(errorOf(res.body).code).toBe('VALIDATION_ERROR');
    expect(errorOf(res.body).details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ location: 'body', path: 'name' }),
        expect.objectContaining({ location: 'body', path: 'quantity' }),
      ]),
    );
  });

  it('rejects unknown fields (strict whitelist)', async () => {
    const res = await request(app)
      .post('/items/1')
      .send({ name: 'Latte', quantity: 1, isAdmin: true });

    expect(res.status).toBe(422);
    expect(errorOf(res.body).details).toEqual([
      { location: 'body', path: 'isAdmin', message: 'Unknown field' },
    ]);
  });

  it('reports params and query issues together with body issues', async () => {
    const res = await request(app).post('/items/abc?dryRun=maybe').send({});

    const locations = errorOf(res.body).details.map((d) => d.location);
    expect(res.status).toBe(422);
    expect(locations).toEqual(expect.arrayContaining(['params', 'query', 'body']));
  });

  it('passes valid input through with parsed (coerced) values on req', async () => {
    const res = await request(app).post('/items/42').send({ name: 'Latte', quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      data: { params: { id: 42 }, body: { name: 'Latte', quantity: 2 } },
    });
  });
});
