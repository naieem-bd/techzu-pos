import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 ignores rejected promises from handlers (the request would hang and the error
 * would be unhandled). This forwards any rejection to `next(err)` -> central errorHandler.
 */
export const asyncHandler =
  // Req lets controllers declare a narrower `ValidatedRequest<...>`; without the generic,
  // strictFunctionTypes would reject them. The single use is intentional.
  // The constraint is `Request<object, unknown, unknown, object>` because after validate()
  // params/query hold parsed values (numbers, booleans), which Express's string-only
  // defaults would reject.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  <Req extends Request<object, unknown, unknown, object> = Request>(
      fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
    ): RequestHandler =>
    (req, res, next) => {
      fn(req as Req, res, next).catch(next);
    };
