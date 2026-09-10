const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const prisma = require('./config/prisma');

const server = app.listen(env.port, () => {
  logger.info(`FPN Attendance API listening on port ${env.port} [${env.nodeEnv}]`);
});

// Graceful shutdown — close DB connections and stop accepting new
// requests before exiting, so in-flight requests aren't dropped.
async function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Server closed. Goodbye.');
    process.exit(0);
  });

  // Force-exit if graceful shutdown hangs.
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.stack || err}`);
  process.exit(1);
});
