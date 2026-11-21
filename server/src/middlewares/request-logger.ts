import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from '../utils/logger';

const REQUEST_ID_HEADER = 'x-request-id';
// Only trust a client-supplied id if it is short and safe to put in logs.
const SAFE_REQUEST_ID = /^[\w-]{1,64}$/;

/**
 * Logs one line per request (method, url, status, time) tagged with a request id.
 * Reuses the caller's `x-request-id` (e.g. from a proxy) or generates one, and echoes it back
 * so a client-reported error can be matched to server logs. Bodies are never logged.
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const id =
      typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader(REQUEST_ID_HEADER, id);
    return id;
  },
  serializers: {
    req: (req: { id: unknown; method: unknown; url: unknown }) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res: { statusCode: unknown }) => ({ statusCode: res.statusCode }),
  },
});
