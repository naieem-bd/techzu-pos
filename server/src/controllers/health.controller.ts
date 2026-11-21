import type { Request, Response } from 'express';
import { getHealth } from '../services/health.service';

export const getHealthController = async (_req: Request, res: Response): Promise<void> => {
  const data = await getHealth();
  res.status(200).json({ data });
};
