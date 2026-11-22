import { Router } from 'express';
import { createOutletController, listOutletsController } from '../controllers/outlet.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/async-handler';
import { createOutletSchemas, listOutletsSchemas } from '../validators/outlet.validators';

export const outletRouter = Router();

outletRouter.get('/', validate(listOutletsSchemas), asyncHandler(listOutletsController));
outletRouter.post('/', validate(createOutletSchemas), asyncHandler(createOutletController));
