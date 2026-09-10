const prisma = require('../config/prisma');
const logger = require('../config/logger');

/**
 * Records an audit trail entry. Never throws — a logging failure
 * must not break the primary request, so errors are swallowed and
 * logged to the application logger instead.
 */
async function recordAudit({ userId = null, action, entity, entityId, metadata, req }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        metadata,
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent'],
      },
    });
  } catch (err) {
    logger.error(`Failed to write audit log for action=${action}: ${err.message}`);
  }
}

module.exports = { recordAudit };
