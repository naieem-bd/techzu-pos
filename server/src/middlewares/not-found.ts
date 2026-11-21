import type { RequestHandler } from 'express';
import { notFound as notFoundError } from '../utils/app-error';

export const notFound: RequestHandler = (req, _res, next) => {
  next(notFoundError('ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};
