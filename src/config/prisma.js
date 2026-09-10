const { PrismaClient } = require('@prisma/client');
const env = require('./env');

// Reuse a single PrismaClient instance across the app (and across
// hot-reloads in dev) to avoid exhausting DB connections.
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
