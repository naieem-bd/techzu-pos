import { Router } from 'express';
import {
  assignMenuItemController,
  listOutletMenuController,
  unassignMenuItemController,
  updateAssignmentController,
} from '../controllers/outlet-menu-item.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/async-handler';
import {
  assignMenuItemSchemas,
  listOutletMenuSchemas,
  unassignMenuItemSchemas,
  updateAssignmentSchemas,
} from '../validators/outlet-menu-item.validators';

/** Mounted at /outlets/:outletId/menu-items; mergeParams exposes :outletId here. */
export const outletMenuItemRouter = Router({ mergeParams: true });

outletMenuItemRouter.get(
  '/',
  validate(listOutletMenuSchemas),
  asyncHandler(listOutletMenuController),
);
outletMenuItemRouter.post(
  '/',
  validate(assignMenuItemSchemas),
  asyncHandler(assignMenuItemController),
);
outletMenuItemRouter.patch(
  '/:menuItemId',
  validate(updateAssignmentSchemas),
  asyncHandler(updateAssignmentController),
);
outletMenuItemRouter.delete(
  '/:menuItemId',
  validate(unassignMenuItemSchemas),
  asyncHandler(unassignMenuItemController),
);
