import { Router } from 'express';
import type { OpenApiSpecResult } from '../utils/openapi-spec';
import { createDocsRouter } from './docs.routes';
import { healthRouter } from './health.routes';
import { menuItemRouter } from './menu-item.routes';
import { outletInventoryRouter } from './outlet-inventory.routes';
import { outletMenuItemRouter } from './outlet-menu-item.routes';
import { outletRouter } from './outlet.routes';
import { reportRouter } from './report.routes';
import { saleRouter } from './sale.routes';

export interface ApiRouterDeps {
  openApi: OpenApiSpecResult;
}

/** Everything mounted under /api. Feature routers are added here. */
export const createApiRouter = ({ openApi }: ApiRouterDeps): Router => {
  const apiRouter = Router();

  apiRouter.use(createDocsRouter(openApi));
  apiRouter.use('/health', healthRouter);
  apiRouter.use('/outlets/:outletId/menu-items', outletMenuItemRouter);
  apiRouter.use('/outlets/:outletId/sales', saleRouter);
  apiRouter.use('/outlets/:outletId', outletInventoryRouter);
  apiRouter.use('/outlets', outletRouter);
  apiRouter.use('/menu-items', menuItemRouter);
  apiRouter.use('/reports', reportRouter);

  return apiRouter;
};
