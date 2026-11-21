import { Router } from 'express';
import { getHealthController } from '../controllers/health.controller';
import { asyncHandler } from '../utils/async-handler';

export const healthRouter = Router();

healthRouter.get('/', asyncHandler(getHealthController));
