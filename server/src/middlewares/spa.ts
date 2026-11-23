import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import type { RequestHandler } from 'express';

/**
 * client/dist next to server/. This file sits at the same depth in `src/middlewares` and
 * `dist/middlewares`, so one relative path works in dev, tests and the image (/app/client/dist).
 */
export const DEFAULT_CLIENT_DIST_PATH = path.resolve(__dirname, '../../../client/dist');

// Vite fingerprints everything under assets/ (content hash in the file name), so those files can
// be cached for a year. index.html is not fingerprinted and must always be revalidated.
const ASSETS_PREFIX = '/assets/';
const HASHED_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable'; // 365 days

const isApiPath = (urlPath: string): boolean => urlPath === '/api' || urlPath.startsWith('/api/');

/**
 * Only non-API GETs that are not asset requests get index.html: unknown /api routes keep their
 * JSON 404, and a missing /assets/x.js is a 404, not an HTML page the browser tries to execute.
 */
const wantsSpaShell = (urlPath: string): boolean =>
  !isApiPath(urlPath) && !urlPath.startsWith(ASSETS_PREFIX);

/**
 * Serves the built React SPA, or returns null when there is no build (API-only image, or tests),
 * so the caller can skip it silently. Mount it after /api and before the 404 handler.
 */
export const createSpaHandler = (distDir: string): Router | null => {
  const indexHtml = path.join(distDir, 'index.html');
  if (!existsSync(indexHtml)) return null;

  const serveStatic = express.static(distDir, {
    index: false,
    setHeaders: (res, filePath) => {
      const relative = path.relative(distDir, filePath).split(path.sep).join('/');
      if (`/${relative}`.startsWith(ASSETS_PREFIX)) {
        res.setHeader('Cache-Control', HASHED_ASSET_CACHE_CONTROL);
      }
    },
  });

  const staticOutsideApi: RequestHandler = (req, res, next) => {
    if (isApiPath(req.path)) {
      next();
      return;
    }
    serveStatic(req, res, next);
  };

  const spaFallback: RequestHandler = (req, res, next) => {
    if (!wantsSpaShell(req.path)) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    // Express calls back with no error on success, despite the `Error` type in @types/express.
    res.sendFile(indexHtml, (err: Error | undefined) => {
      if (err) next(err);
    });
  };

  const router = Router();
  router.use(staticOutsideApi);
  router.get('*', spaFallback);
  return router;
};
