import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/secrets';

export interface AuthenticatedUser {
  id: string;
  userId?: string;
  sub?: string;
  email: string;
  name?: string;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  userId?: string;
}

export async function protect(req: any, res: Response, next: NextFunction) {
  try {
    // Payment webhooks use machine-to-machine cryptographic HMAC signatures, not user bearer tokens
    if (req.path === '/billing/webhook' || req.originalUrl?.includes('/billing/webhook')) {
      return next();
    }

    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query?.token) {
      token = String(req.query.token);
    }

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required. Missing Bearer token.' 
      });
    }

    let decoded: any = null;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (_err) {
      decoded = null;
    }

    // Only tokens signed by this backend are accepted. Unverified payloads are never trusted.
    if (!decoded || typeof decoded !== 'object' || (!decoded.id && !decoded.userId && !decoded.sub)) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired authentication token.' 
      });
    }

    let userId = decoded.id || decoded.userId || decoded.sub;

    try {
      const { prisma } = require('@workspace/db');
      const user = await prisma.user.findFirst({
        where: decoded.email ? { email: { equals: decoded.email, mode: 'insensitive' } } : { id: userId }
      });
      if (user) {
        userId = user.id;
      }
    } catch (_) {}

    req.user = {
      id: userId,
      userId,
      sub: userId,
      email: decoded.email || '',
      name: decoded.name || 'User',
      role: decoded.role || 'user'
    };

    req.userId = userId;

    if (userId) {
      try {
        const { requestContext } = require('@workspace/db');
        return requestContext.run({ userId }, () => next());
      } catch (_) {
        return next();
      }
    }

    return next();
  } catch (error: any) {
    console.error('[TrafficDirectorAuth] Token verification failed:', error.message);
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication verification failure.' 
    });
  }
}
