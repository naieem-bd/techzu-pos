import { Router } from 'express';
import { healthRouter } from './health.routes';
import { menuItemRouter } from './menu-item.routes';
import { outletMenuItemRouter } from './outlet-menu-item.routes';
import { outletRouter } from './outlet.routes';

/** Everything mounted under /api. Feature routers are added here. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/outlets/:outletId/menu-items', outletMenuItemRouter);
apiRouter.use('/outlets', outletRouter);
apiRouter.use('/menu-items', menuItemRouter);
