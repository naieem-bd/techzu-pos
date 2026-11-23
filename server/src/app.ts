import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import { config } from './config/env';
import { errorHandler } from './middlewares/error-handler';
import { notFound } from './middlewares/not-found';
import { apiRateLimit } from './middlewares/rate-limit';
import { requestLogger } from './middlewares/request-logger';
import { createApiRouter } from './routes';
import { logger } from './utils/logger';
import { DEFAULT_OPENAPI_SPEC_PATH, loadOpenApiSpec } from './utils/openapi-spec';

export interface AppOptions {
  /** Overrides the spec location; tests use it to simulate a missing or broken spec. */
  openApiSpecPath?: string;
}

/** Builds the Express app without listening, so tests can drive it with Supertest. */
export const createApp = (options: AppOptions = {}): Express => {
  // The spec lives at <repo>/docs/openapi.yaml, outside server/. The Dockerfile MUST copy
  // docs/openapi.yaml into the image (same relative position to server/dist), or /api/docs and
  // /api/openapi.json will answer 503 DOCS_UNAVAILABLE. The rest of the API is unaffected.
  const openApi = loadOpenApiSpec(options.openApiSpecPath ?? DEFAULT_OPENAPI_SPEC_PATH);
  if (!openApi.ok) {
    // Logged once here, at startup; requests then get a 503 without re-reading the file.
    logger.error(
      { reason: openApi.reason },
      'OpenAPI spec unavailable: /api/docs and /api/openapi.json will return 503',
    );
  }

  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: [...config.CORS_ORIGIN] }));
  // Logger before the body parser so malformed-JSON errors still carry a request id.
  app.use(requestLogger);
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', apiRateLimit, createApiRouter({ openApi }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
