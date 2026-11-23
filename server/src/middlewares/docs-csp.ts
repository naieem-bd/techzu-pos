import { randomBytes } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import type { RequestHandler } from 'express';
import helmet from 'helmet';

// Keyed by the response object: typed (unlike `res.locals`, which is `any`), readable from
// helmet's directive callbacks (which only get a plain ServerResponse), and garbage-collected
// with the response.
const nonces = new WeakMap<ServerResponse, string>();

export const getCspNonce = (res: ServerResponse): string => {
  const nonce = nonces.get(res);
  if (nonce === undefined) {
    throw new Error('CSP nonce missing: docsContentSecurityPolicy must run before this handler');
  }
  return nonce;
};

const assignNonce: RequestHandler = (_req, res, next) => {
  // 128 bits from the CSPRNG, fresh per response, so an injected script can't guess it.
  nonces.set(res, randomBytes(16).toString('base64'));
  next();
};

/**
 * The CSP for the Scalar API reference page ONLY. It replaces the header that the global
 * `helmet()` set; every other route keeps helmet's strict default.
 *
 * Compared with helmet's default (script-src 'self'), exactly ONE thing is relaxed:
 * - script-src: the pinned Scalar bundle (cdn.jsdelivr.net) and the inline script that starts it
 *   are allowed by a per-request nonce, and nothing else is. 'self' is dropped too; there is no
 *   host allow-list, no 'unsafe-inline' and no 'unsafe-eval' (the bundle doesn't use eval,
 *   `new Function` or workers).
 * style-src keeps 'unsafe-inline' exactly as helmet's default does (the Vue UI injects <style>
 * tags and style="" attributes at runtime, which a nonce can't cover), but drops the default's
 * `https:`. Every other directive is as strict as the default or stricter: default-src 'none';
 * fonts self-only instead of `https: data:` (Scalar's font CDN is turned off); connect-src 'self'
 * (the spec and "try it" requests go to this API; Scalar's telemetry and proxy hosts are
 * blocked); form-action and base-uri 'none'; no frames, no plugins.
 */
const docsPolicy = helmet.contentSecurityPolicy({
  useDefaults: false,
  directives: {
    defaultSrc: ["'none'"],
    scriptSrc: [(_req, res) => `'nonce-${getCspNonce(res)}'`],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:'],
    fontSrc: ["'self'"],
    connectSrc: ["'self'"],
    baseUri: ["'none'"],
    formAction: ["'none'"],
    frameAncestors: ["'none'"],
    objectSrc: ["'none'"],
  },
});

export const docsContentSecurityPolicy: RequestHandler[] = [assignNonce, docsPolicy];
