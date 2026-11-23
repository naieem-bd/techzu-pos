import { Router } from 'express';
import { createDocsControllers } from '../controllers/docs.controller';
import { docsContentSecurityPolicy } from '../middlewares/docs-csp';
import type { OpenApiSpecResult } from '../utils/openapi-spec';

/** Mounted at /api. A factory because the routes depend on the spec loaded at startup. */
export const createDocsRouter = (openApi: OpenApiSpecResult): Router => {
  const router = Router();
  const { getOpenApiSpecController, getApiDocsController } = createDocsControllers(openApi);

  router.get('/openapi.json', getOpenApiSpecController);
  // The relaxed CSP applies to this one route only.
  router.get('/docs', docsContentSecurityPolicy, getApiDocsController);

  return router;
};
