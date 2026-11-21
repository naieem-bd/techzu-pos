import pino from 'pino';
import { config } from '../config/env';

const isDevelopment = config.NODE_ENV === 'development';

export const logger = pino({
  level: config.LOG_LEVEL,
  // Defence in depth: never write credentials to logs even if a header is logged by mistake.
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
  // pino-pretty is a devDependency; it is only loaded as a transport in development.
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
    },
  }),
});
