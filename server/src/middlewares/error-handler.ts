import type { ErrorRequestHandler } from 'express';
import { DatabaseError } from 'pg';
import { config } from '../config/env';
import { AppError } from '../utils/app-error';

interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

interface MappedError {
  status: number;
  body: ErrorBody;
}

// Postgres SQLSTATE -> HTTP. The DB constraints are the final guard behind the service rules.
const PG_ERROR_MAP: Readonly<Record<string, MappedError>> = {
  '23505': { status: 409, body: { code: 'CONFLICT', message: 'Resource already exists' } },
  '23503': {
    status: 422,
    body: { code: 'FOREIGN_KEY_VIOLATION', message: 'Referenced resource does not exist' },
  },
  '23514': {
    status: 409,
    body: { code: 'CHECK_VIOLATION', message: 'Operation violates a data constraint' },
  },
  '22P02': { status: 422, body: { code: 'INVALID_INPUT', message: 'Invalid input value' } },
  // numeric_value_out_of_range, e.g. an INTEGER column overflowing.
  '22003': {
    status: 422,
    body: { code: 'VALUE_OUT_OF_RANGE', message: 'A value is outside the allowed range' },
  },
};

/** body-parser errors carry `type` and `status`. */
const isBodyParserError = (err: unknown): err is { type: string; status: number } =>
  typeof err === 'object' &&
  err !== null &&
  'type' in err &&
  typeof err.type === 'string' &&
  'status' in err &&
  typeof err.status === 'number';

const mapError = (err: unknown): MappedError => {
  if (err instanceof AppError) {
    const body: ErrorBody = { code: err.code, message: err.message };
    if (err.details !== undefined) body.details = err.details;
    return { status: err.statusCode, body };
  }

  if (isBodyParserError(err)) {
    if (err.type === 'entity.parse.failed') {
      return { status: 400, body: { code: 'INVALID_JSON', message: 'Malformed JSON body' } };
    }
    if (err.type === 'entity.too.large') {
      return {
        status: 413,
        body: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' },
      };
    }
  }

  if (err instanceof DatabaseError && err.code !== undefined) {
    const mapped = PG_ERROR_MAP[err.code];
    if (mapped) return mapped;
  }

  const message =
    config.NODE_ENV !== 'production' && err instanceof Error
      ? err.message
      : 'An unexpected error occurred';
  return { status: 500, body: { code: 'INTERNAL_ERROR', message } };
};

/**
 * Error level = something actually broke: any unexpected error, or an AppError that wraps one
 * (`cause`, e.g. the health check's DB failure). A deliberate 5xx AppError with no cause (e.g.
 * DOCS_UNAVAILABLE, already explained once in the startup log) is an expected state, so it gets
 * a warn line per request like any 4xx, not an error + stack trace every time.
 */
const isServerFault = (err: unknown, status: number): boolean =>
  status >= 500 && (!(err instanceof AppError) || err.cause !== undefined);

/**
 * Central error handler: the only place that turns errors into HTTP responses.
 * Raw SQL/driver messages and stack traces are logged (with the request id), never sent.
 */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const { status, body } = mapError(err);
  if (isServerFault(err, status)) {
    req.log.error({ err }, 'Request failed with server error');
  } else {
    req.log.warn({ code: body.code, status }, body.message);
  }

  res.status(status).json({ error: body });
};
