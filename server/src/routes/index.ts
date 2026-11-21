import { Router } from 'express';
import { healthRouter } from './health.routes';

/** Everything mounted under /api. Feature routers are added here. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
