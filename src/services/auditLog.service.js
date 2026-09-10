const prisma = require('../config/prisma');
const logger = require('../config/logger');

/**
 * Records an audit trail entry.
 * Never throws — a logging failure must not break the primary request.
 */
async function recordAudit({
  userId = null,
  action,
  category = 'AUTH',
  details = null,
  req,
  ipAddress,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        category,
        details,
        ipAddress: ipAddress || req?.ip || null,
      },
    });
  } catch (err) {
    logger.error(
      `Failed to write audit log for action=${action}: ${err.message}`
    );
  }
}

module.exports = { recordAudit };
