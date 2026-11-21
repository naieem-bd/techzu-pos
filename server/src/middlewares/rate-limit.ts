import { rateLimit } from 'express-rate-limit';
import { AppError } from '../utils/app-error';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/** Per-IP limit on /api. Rejections go through errorHandler so they use the standard shape. */
export const apiRateLimit = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later'));
  },
});
