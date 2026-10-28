"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAction = logAction;
const db_1 = require("@workspace/db");
/**
 * Log an action to the AuditLog table.
 *
 * This is the canonical, domain-safe way to record audit events.
 * It never throws — audit logging must never break the main flow.
 */
async function logAction(userId, action, resourceType = '', resourceId = '', details = {}, context = {}) {
    try {
        if (!userId || typeof userId !== 'string')
            return;
        const userExists = await db_1.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
        if (!userExists)
            return;
        const data = {
            user: { connect: { id: userExists.id } },
            action,
            resourceType,
            resourceId: resourceId ? String(resourceId) : '',
            details: (details || {}),
            ipAddress: context.ipAddress || '',
            userAgent: context.userAgent || '',
            companyId: context.companyId ?? null,
        };
        await db_1.prisma.auditLog.create({ data });
    }
    catch (err) {
        // Never throw — audit logging should never break the main flow
        console.error('[Audit] Failed to log action:', err.message);
    }
}
