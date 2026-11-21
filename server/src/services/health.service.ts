import { pool } from '../db/pool';
import { ping } from '../repositories/health.repository';
import { AppError } from '../utils/app-error';

export interface HealthStatus {
  status: 'ok';
  db: 'up';
  uptime: number;
}

export const getHealth = async (): Promise<HealthStatus> => {
  try {
    await ping(pool);
  } catch (err) {
    // 503 tells load balancers / orchestrators to stop routing traffic here.
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Database is unavailable',
      { db: 'down' },
      {
        cause: err,
      },
    );
  }
  return { status: 'ok', db: 'up', uptime: Math.round(process.uptime()) };
};
