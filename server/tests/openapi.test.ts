import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import request from 'supertest';
import type { z } from 'zod';
import { createApp } from '../src/app';
import { SCALAR_CDN_URL } from '../src/controllers/docs.controller';
import { closePool } from '../src/db/pool';
import { errorHandler } from '../src/middlewares/error-handler';
import { requestLogger } from '../src/middlewares/request-logger';
import { AppError } from '../src/utils/app-error';
import { logger } from '../src/utils/logger';
import { DEFAULT_OPENAPI_SPEC_PATH, loadOpenApiSpec } from '../src/utils/openapi-spec';
import type { OpenApiSpec } from '../src/utils/openapi-spec';
import {
  adjustInventorySchemas,
  assignMenuItemSchemas,
  createMenuItemSchemas,
  createOutletSchemas,
  createSaleSchemas,
  updateAssignmentSchemas,
  updateMenuItemSchemas,
} from '../src/validators';
import { errorOf } from './helpers/http';
import { listRoutes } from './helpers/list-routes';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const TAGS = [
  'Health',
  'Outlets',
  'Menu',
  'Assignments',
  'Outlet menu & inventory',
  'Sales',
  'Reports',
];
const MONEY_PATTERN = /^\d+\.\d{2}$/;
const MONEY_KEYS = new Set([
  'basePrice',
  'priceOverride',
  'effectivePrice',
  'unitPrice',
  'lineTotal',
  'totalAmount',
  'totalRevenue',
  'averageTicket',
  'grandTotal',
  'revenue',
]);

/** Every operation with a JSON body, and the Zod schema the server validates it with. */
const REQUEST_BODY_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  createOutlet: createOutletSchemas.body,
  createMenuItem: createMenuItemSchemas.body,
  updateMenuItem: updateMenuItemSchemas.body,
  assignMenuItem: assignMenuItemSchemas.body,
  updateAssignment: updateAssignmentSchemas.body,
  adjustInventory: adjustInventorySchemas.body,
  createSale: createSaleSchemas.body,
};

type Json = Record<string, unknown>;

const isJson = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const loaded = loadOpenApiSpec(DEFAULT_OPENAPI_SPEC_PATH);
if (!loaded.ok) throw new Error(`docs/openapi.yaml does not load: ${loaded.reason}`);
const spec: OpenApiSpec = loaded.spec;

/** Resolves a local "#/a/b" JSON pointer; throws if any segment is missing. */
const resolvePointer = (ref: string): unknown => {
  if (!ref.startsWith('#/')) throw new Error(`Only local $refs are allowed: ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<unknown>((node, segment) => {
      if (!isJson(node) || !(segment in node)) throw new Error(`Unresolvable $ref ${ref}`);
      return node[segment];
    }, spec);
};

const deref = (node: unknown): unknown =>
  isJson(node) && typeof node.$ref === 'string' ? deref(resolvePointer(node.$ref)) : node;

/** Depth-first visit of every value in a JSON tree, with the key it sits under. */
const visit = (node: unknown, fn: (value: unknown, key: string) => void, key = ''): void => {
  fn(node, key);
  if (Array.isArray(node)) {
    for (const item of node) visit(item, fn, key);
  } else if (isJson(node)) for (const [k, v] of Object.entries(node)) visit(v, fn, k);
};

interface Operation {
  method: string;
  path: string;
  op: Json;
}

const operations: Operation[] = Object.entries(spec.paths).flatMap(([p, item]) =>
  isJson(item)
    ? HTTP_METHODS.filter((m) => isJson(item[m])).map((m) => ({
        method: m,
        path: p,
        op: item[m] as Json,
      }))
    : [],
);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Example values of a media object: `example` or each `examples.*.value` (refs resolved). */
const examplesOf = (media: unknown): unknown[] => {
  if (!isJson(media)) return [];
  const out: unknown[] = [];
  if ('example' in media) out.push(media.example);
  if (isJson(media.examples)) {
    for (const entry of Object.values(media.examples)) {
      const resolved = deref(entry);
      if (isJson(resolved) && 'value' in resolved) out.push(resolved.value);
    }
  }
  return out;
};

afterAll(async () => {
  await closePool();
});

describe('OpenAPI spec covers every Express route', () => {
  const app = createApp();

  it('documents exactly the routes the app serves (method + path)', () => {
    const served = listRoutes(app);
    const documented = operations.map(({ method, path: p }) => `${method.toUpperCase()} ${p}`);

    // Sanity: the walker really found the routers (guards against a vacuous pass).
    expect(served).toContain('POST /api/outlets/{outletId}/sales');
    expect(served).toContain('GET /api/docs');

    expect(served.filter((route) => !documented.includes(route))).toEqual([]); // undocumented
    expect(documented.filter((route) => !served.includes(route))).toEqual([]); // stale docs
    expect(new Set(documented).size).toBe(documented.length);
  });
});

describe('listRoutes (the walker the coverage test relies on)', () => {
  const noop: express.RequestHandler = (_req, res) => {
    res.end();
  };

  it('decodes nested, parameterised and pathless mounts', () => {
    const inner = express.Router({ mergeParams: true });
    inner.get('/', noop);
    inner.patch('/:lineId', noop);
    const outer = express.Router();
    outer.use('/orders/:orderId/lines', inner);
    outer.use(express.Router().delete('/flat', noop));
    const app = express();
    app.use('/api', outer);

    expect(listRoutes(app)).toEqual([
      'DELETE /api/flat',
      'GET /api/orders/{orderId}/lines',
      'PATCH /api/orders/{orderId}/lines/{lineId}',
    ]);
  });

  it('throws on a mount path it cannot decode instead of skipping it', () => {
    const app = express();
    app.use(/^\/v\d+/, express.Router().get('/', noop));
    expect(() => listRoutes(app)).toThrow(/Cannot decode mount regexp/);
  });
});

describe('OpenAPI spec structure', () => {
  it('is OpenAPI 3.1 with the agreed tags, in order', () => {
    expect(spec.openapi).toMatch(/^3\.1\.\d+$/);
    expect(asArray(spec.tags).map((tag) => (isJson(tag) ? tag.name : tag))).toEqual(TAGS);
  });

  it('resolves every $ref', () => {
    const refs: string[] = [];
    visit(spec, (value, key) => {
      if (key === '$ref' && typeof value === 'string') refs.push(value);
    });
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(() => resolvePointer(ref)).not.toThrow();
  });

  it('gives every operation a known tag, a unique operationId and a 2xx response', () => {
    const ids = operations.map(({ op }) => op.operationId);
    expect(new Set(ids).size).toBe(ids.length);

    for (const { method, path: p, op } of operations) {
      const where = `${method.toUpperCase()} ${p}`;
      expect({ where, id: typeof op.operationId }).toEqual({ where, id: 'string' });
      expect({ where, tags: asArray(op.tags).every((t) => TAGS.includes(String(t))) }).toEqual({
        where,
        tags: true,
      });
      const statuses = Object.keys(isJson(op.responses) ? op.responses : {});
      expect({ where, has2xx: statuses.some((s) => s.startsWith('2')) }).toEqual({
        where,
        has2xx: true,
      });
    }
  });

  it('declares every {param} of a path as a required path parameter, and no others', () => {
    for (const { method, path: p, op } of operations) {
      const inPath = [...p.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();
      const declared = asArray(op.parameters)
        .map(deref)
        .filter((param): param is Json => isJson(param) && param.in === 'path')
        .map((param) => {
          expect({ param: param.name, required: param.required }).toEqual({
            param: param.name,
            required: true,
          });
          return param.name;
        })
        .sort();
      expect({ op: `${method} ${p}`, declared }).toEqual({
        op: `${method} ${p}`,
        declared: inPath,
      });
    }
  });

  it('has no example on any optional query parameter (Scalar "Try it" would pre-fill it)', () => {
    const componentParams = isJson(spec.components) ? spec.components.parameters : undefined;
    const pathLevelParams = Object.values(spec.paths).flatMap((item) =>
      isJson(item) ? asArray(item.parameters) : [],
    );
    const candidates = [
      ...Object.values(isJson(componentParams) ? componentParams : {}),
      ...pathLevelParams,
      ...operations.flatMap(({ op }) => asArray(op.parameters)),
    ]
      .map(deref)
      .filter((param): param is Json => isJson(param) && param.in === 'query');
    expect(candidates.length).toBeGreaterThan(0);

    const offenders = candidates
      .filter((param) => param.required !== true)
      .filter((param) => {
        const schema = deref(param.schema);
        const hasExample = (node: unknown): boolean =>
          isJson(node) && ('example' in node || 'examples' in node);
        return hasExample(param) || hasExample(schema);
      })
      .map((param) => String(param.name));
    expect([...new Set(offenders)]).toEqual([]);
  });

  it('uses the { error } envelope for every error response', () => {
    for (const { method, path: p, op } of operations) {
      for (const [status, raw] of Object.entries(isJson(op.responses) ? op.responses : {})) {
        if (Number(status) < 400) continue;
        const response = deref(raw);
        const content = isJson(response) && isJson(response.content) ? response.content : {};
        const schema = deref(
          isJson(content['application/json']) ? content['application/json'].schema : undefined,
        );
        expect({ at: `${method} ${p} ${status}`, schema }).toEqual({
          at: `${method} ${p} ${status}`,
          schema: resolvePointer('#/components/schemas/ErrorResponse'),
        });
        for (const example of examplesOf(content['application/json'])) {
          expect(isJson(example) && isJson(example.error) && typeof example.error.code).toBe(
            'string',
          );
        }
      }
    }
  });

  it('writes every money value in examples as a 2-decimal string', () => {
    const bad: string[] = [];
    visit(spec, (value, key) => {
      if (!MONEY_KEYS.has(key) || isJson(value)) return; // objects are schema definitions
      if (value === null) return; // nullable money (no override / not assigned)
      if (typeof value !== 'string' || !MONEY_PATTERN.test(value))
        bad.push(`${key}=${JSON.stringify(value)}`);
    });
    expect(bad).toEqual([]);
  });

  it('documents every error code the server can produce, and only real ones', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const source = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.ts'))
      .map((file) => readFileSync(path.join(srcDir, file), 'utf8'))
      .join('\n');
    const thrown = new Set(
      [
        ...source.matchAll(
          /(?:notFound|notFoundError|conflict|unprocessable|badRequest)\(\s*'([A-Z_]+)'/g,
        ),
        ...source.matchAll(/AppError\(\s*\d{3},\s*'([A-Z_]+)'/g),
        ...source.matchAll(/code: '([A-Z_]+)'/g),
      ].map((match) => match[1]),
    );
    expect(thrown).toContain('INSUFFICIENT_STOCK');

    const specText = JSON.stringify(spec);
    expect([...thrown].filter((code) => code && !specText.includes(code))).toEqual([]);

    const documented = new Set<string>();
    visit(spec, (value, key) => {
      if (key === 'error' && isJson(value) && typeof value.code === 'string') {
        documented.add(value.code);
      }
    });
    expect([...documented].filter((code) => !thrown.has(code))).toEqual([]);
  });

  it('has request examples that the real Zod validators accept', () => {
    for (const { op } of operations) {
      if (!('requestBody' in op)) continue;
      const id = String(op.operationId);
      const schema = REQUEST_BODY_SCHEMAS[id];
      expect({ id, hasZodSchema: schema !== undefined }).toEqual({ id, hasZodSchema: true });
      if (!schema) continue;

      const body = deref(op.requestBody);
      const content = isJson(body) && isJson(body.content) ? body.content : {};
      const examples = examplesOf(content['application/json']);
      expect({ id, examples: examples.length > 0 }).toEqual({ id, examples: true });
      for (const example of examples) {
        const result = schema.safeParse(example);
        expect({ id, example, issues: result.error?.issues ?? [] }).toEqual({
          id,
          example,
          issues: [],
        });
      }
    }
  });
});

describe('GET /api/openapi.json and GET /api/docs', () => {
  const app = createApp();

  const cspOf = (res: request.Response): Map<string, string[]> => {
    const header = res.headers['content-security-policy'];
    expect(typeof header).toBe('string');
    return new Map(
      String(header)
        .split(';')
        .map((directive) => directive.trim().split(/\s+/))
        .filter((parts) => parts[0])
        .map(([name = '', ...values]) => [name, values]),
    );
  };

  it('serves the spec as JSON', async () => {
    const res = await request(app).get('/api/openapi.json');

    expect(res.status).toBe(200);
    expect(res.type).toBe('application/json');
    expect(res.body).toEqual(spec);
  });

  it('serves the Scalar page with a per-request nonce CSP', async () => {
    const res = await request(app).get('/api/docs');

    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.text).toContain(`<script src="${SCALAR_CDN_URL}"`);
    expect(res.text).toContain('/api/openapi.json');

    const csp = cspOf(res);
    const scriptSrc = csp.get('script-src') ?? [];
    expect(scriptSrc).toHaveLength(1);
    const nonce = /^'nonce-([A-Za-z0-9+/=]+)'$/.exec(scriptSrc[0] ?? '')?.[1];
    expect(nonce).toBeDefined();

    // Every <script> tag carries that nonce, or the browser would block it.
    const scriptTags = res.text.match(/<script\b[^>]*>/g) ?? [];
    expect(scriptTags.length).toBeGreaterThan(0);
    for (const tag of scriptTags) expect(tag).toContain(`nonce="${String(nonce)}"`);

    expect(csp.get('default-src')).toEqual(["'none'"]);
    expect(csp.get('connect-src')).toEqual(["'self'"]);
    expect(csp.get('font-src')).toEqual(["'self'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    expect(String(res.headers['content-security-policy'])).not.toContain('unsafe-eval');

    const again = await request(app).get('/api/docs');
    expect(cspOf(again).get('script-src')).not.toEqual(scriptSrc);
  });

  it("keeps helmet's default CSP, byte for byte, on every other route", async () => {
    const plain = express();
    plain.use(helmet());
    plain.get('/', (_req, res) => {
      res.end();
    });
    const helmetDefault = (await request(plain).get('/')).headers['content-security-policy'];
    expect(String(helmetDefault)).toContain("script-src 'self'");

    for (const url of ['/api/openapi.json', '/api/no-such-route', '/api/outlets/1/menu']) {
      const res = await request(app).get(url);
      expect({ url, csp: res.headers['content-security-policy'] }).toEqual({
        url,
        csp: helmetDefault,
      });
    }
  });
});

describe('when the spec file is missing or invalid', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'openapi-test-'));
  const brokenYaml = path.join(dir, 'broken.yaml');
  const notOpenApi = path.join(dir, 'not-openapi.yaml');
  writeFileSync(brokenYaml, 'openapi: 3.1.0\npaths: { unclosed: [\n');
  writeFileSync(notOpenApi, 'swagger: "2.0"\ninfo: { title: x }\npaths: {}\n');

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it.each([
    ['missing', path.join(dir, 'does-not-exist.yaml'), /cannot read/],
    ['invalid YAML', brokenYaml, /invalid YAML/],
    ['not OpenAPI 3.1', notOpenApi, /not an OpenAPI 3\.1 document/],
  ])('%s: still starts, logs once, docs routes answer 503', async (_case, specPath, reason) => {
    const logError = jest.spyOn(logger, 'error');
    const logWarn = jest.spyOn(logger, 'warn');

    const app = createApp({ openApiSpecPath: specPath });

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      { reason: expect.stringMatching(reason) as unknown },
      expect.stringContaining('/api/docs'),
    );

    for (const url of ['/api/docs', '/api/openapi.json', '/api/docs']) {
      const res = await request(app).get(url);
      expect(res.status).toBe(503);
      expect(errorOf(res.body)).toEqual({
        code: 'DOCS_UNAVAILABLE',
        message: 'API documentation is unavailable',
      });
    }

    // The rest of the API is unaffected.
    expect((await request(app).get('/api/health')).status).toBe(200);
    expect((await request(app).get('/api/outlets')).status).toBe(200);

    // Logged as an error at startup only; each 503 request is just a warn line (request
    // loggers are pino children, which inherit the spied methods through the prototype).
    expect(logError).toHaveBeenCalledTimes(1);
    expect(
      logWarn.mock.calls.filter(([fields]) => isJson(fields) && fields.code === 'DOCS_UNAVAILABLE'),
    ).toHaveLength(3);
    logError.mockRestore();
    logWarn.mockRestore();
  });

  it('still logs a 5xx that wraps a real failure (health check, DB down) as an error', async () => {
    const logError = jest.spyOn(logger, 'error');
    const app = express();
    app.use(requestLogger);
    app.get('/', () => {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Database is unavailable', undefined, {
        cause: new Error('connect ECONNREFUSED'),
      });
    });
    app.use(errorHandler);

    expect((await request(app).get('/')).status).toBe(503);
    expect(logError).toHaveBeenCalledTimes(1);
    logError.mockRestore();
  });
});
