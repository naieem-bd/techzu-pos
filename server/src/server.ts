import type { Server } from 'node:http';
import { createApp } from './app';
import { config } from './config/env';
import { closePool } from './db/pool';
import { logger } from './utils/logger';

const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Starts listening and installs graceful-shutdown handlers. Exported so the production
 * entrypoint (start.ts) can run migrations first; `node dist/server.js` still works on its own.
 */
export const startServer = (): Server => {
  const server = createApp().listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server listening');
  });

  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down gracefully');

    // If in-flight requests don't finish in time, exit anyway (unref: don't keep Node alive).
    setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    // Stop accepting connections, let in-flight requests finish, then close DB connections.
    server.close((serverErr) => {
      closePool()
        .then(() => {
          if (serverErr) logger.error({ err: serverErr }, 'Error while closing HTTP server');
          logger.info('Shutdown complete');
          process.exit(serverErr ? 1 : 0);
        })
        .catch((poolErr: unknown) => {
          logger.error({ err: poolErr }, 'Error while closing database pool');
          process.exit(1);
        });
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
};

if (require.main === module) {
  startServer();
}
