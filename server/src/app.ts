import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import { config } from './config/env';
import { errorHandler } from './middlewares/error-handler';
import { notFound } from './middlewares/not-found';
import { apiRateLimit } from './middlewares/rate-limit';
import { requestLogger } from './middlewares/request-logger';
import { apiRouter } from './routes';

/** Builds the Express app without listening, so tests can drive it with Supertest. */
export const createApp = (): Express => {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: [...config.CORS_ORIGIN] }));
  // Logger before the body parser so malformed-JSON errors still carry a request id.
  app.use(requestLogger);
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', apiRateLimit, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
