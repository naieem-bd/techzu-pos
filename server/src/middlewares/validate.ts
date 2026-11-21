import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { AppError } from '../utils/app-error';

type Location = 'params' | 'query' | 'body';

export interface RequestSchemas {
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodObject;
}

type Infer<S, Fallback> = S extends z.ZodObject ? z.output<S> : Fallback;

/** The `req` type a handler receives after `validate(schemas)` ran. */
export type ValidatedRequest<S extends RequestSchemas> = Request<
  Infer<S['params'], Record<string, string>>,
  unknown,
  Infer<S['body'], unknown>,
  Infer<S['query'], Record<string, never>>
>;

export interface ValidationIssue {
  location: Location;
  path: string;
  message: string;
}

const LOCATIONS: readonly Location[] = ['params', 'query', 'body'];

/**
 * Validates params, query and body with Zod. Objects are forced to `.strict()` so unknown
 * fields are always rejected (whitelisting), even if a schema author forgot it.
 * On success the parsed (coerced, defaulted) values replace the raw ones on `req`.
 * On failure every issue from every location is reported in one 422 response.
 */
export const validate =
  (schemas: RequestSchemas): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    const issues: ValidationIssue[] = [];
    const parsed: Partial<Record<Location, unknown>> = {};

    for (const location of LOCATIONS) {
      const schema = schemas[location];
      if (!schema) continue;

      const result = schema.strict().safeParse(req[location] ?? {});
      if (result.success) {
        parsed[location] = result.data;
        continue;
      }
      for (const issue of result.error.issues) {
        const basePath = issue.path.map(String);
        if (issue.code === 'unrecognized_keys') {
          // Report each unknown field under its own path instead of one issue at the parent.
          for (const key of issue.keys) {
            issues.push({ location, path: [...basePath, key].join('.'), message: 'Unknown field' });
          }
          continue;
        }
        issues.push({ location, path: basePath.join('.'), message: issue.message });
      }
    }

    if (issues.length > 0) {
      next(new AppError(422, 'VALIDATION_ERROR', 'Request validation failed', issues));
      return;
    }

    // Express 4 allows reassigning these; values are already validated so the casts are safe.
    if (parsed.params) req.params = parsed.params as Request['params'];
    if (parsed.query) req.query = parsed.query as Request['query'];
    if (parsed.body) req.body = parsed.body;
    next();
  };
