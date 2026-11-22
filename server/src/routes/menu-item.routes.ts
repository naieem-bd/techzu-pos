import { Router } from 'express';
import {
  createMenuItemController,
  listMenuItemsController,
  updateMenuItemController,
} from '../controllers/menu-item.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/async-handler';
import {
  createMenuItemSchemas,
  listMenuItemsSchemas,
  updateMenuItemSchemas,
} from '../validators/menu-item.validators';

export const menuItemRouter = Router();

menuItemRouter.get('/', validate(listMenuItemsSchemas), asyncHandler(listMenuItemsController));
menuItemRouter.post('/', validate(createMenuItemSchemas), asyncHandler(createMenuItemController));
menuItemRouter.patch(
  '/:id',
  validate(updateMenuItemSchemas),
  asyncHandler(updateMenuItemController),
);
