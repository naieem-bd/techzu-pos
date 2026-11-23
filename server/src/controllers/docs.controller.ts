import { apiReference } from '@scalar/express-api-reference';
import type { RequestHandler } from 'express';
import { getCspNonce } from '../middlewares/docs-csp';
import { AppError } from '../utils/app-error';
import type { OpenApiSpecResult } from '../utils/openapi-spec';

/**
 * Pinned on purpose: Scalar's default CDN URL has no version, so the newest release would run on
 * this page. Scalar can't add an `integrity` attribute, so pinning is the best protection we have.
 * Bump it deliberately.
 */
export const SCALAR_CDN_URL = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.76.4';

export const OPENAPI_JSON_PATH = '/api/openapi.json';

export interface DocsControllers {
  getOpenApiSpecController: RequestHandler;
  // Scalar's handler is typed to send a string body.
  getApiDocsController: RequestHandler<Record<string, string>, string>;
}

// Takes no arguments, so it fits both handler types; Express 4 forwards the throw to errorHandler.
const docsUnavailable = (): never => {
  throw new AppError(503, 'DOCS_UNAVAILABLE', 'API documentation is unavailable');
};

/** Built once per app from the spec that was loaded at startup. */
export const createDocsControllers = (openApi: OpenApiSpecResult): DocsControllers => {
  if (!openApi.ok) {
    return { getOpenApiSpecController: docsUnavailable, getApiDocsController: docsUnavailable };
  }
  const { spec } = openApi;

  return {
    // The raw OpenAPI document, not `{ data }`: tools (Scalar, codegen, Postman) expect it as is.
    getOpenApiSpecController: (_req, res) => {
      res.status(200).json(spec);
    },
    // Rendered per request because the CSP nonce is per request.
    getApiDocsController: (req, res, next) => {
      const render = apiReference({
        url: OPENAPI_JSON_PATH,
        cdn: SCALAR_CDN_URL,
        nonce: getCspNonce(res),
        pageTitle: 'Techzu POS API Reference',
        withDefaultFonts: false,
        telemetry: false,
      });
      render(req as Parameters<typeof render>[0], res, next);
    },
  };
};
