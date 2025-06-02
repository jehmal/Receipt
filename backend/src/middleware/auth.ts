import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { authService, jwtService } from '@/services/auth';

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId?: string;
}

export interface AuthRequest extends FastifyRequest {
  user: AuthenticatedUser;
  sessionId?: string;
  deviceId?: string;
}

// Module declaration moved to @types/fastify.d.ts to avoid conflicts

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: any) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header',
          statusCode: 401,
        });
      }

      const token = authHeader.substring(7);
      
      // Check if token is blacklisted
      const isBlacklisted = await authService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Token has been revoked',
          statusCode: 401,
        });
      }

      // Verify token and get user data
      const tokenData = await authService.verifyAccessToken(token);
      if (!tokenData) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid or expired token',
          statusCode: 401,
        });
      }

      const user = await authService.getUserFromToken(token);
      if (!user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'User not found',
          statusCode: 401,
        });
      }

      (request as any).user = {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        companyId: user.company_id
      };
      (request as any).sessionId = tokenData.sessionId;
      (request as any).deviceId = tokenData.payload?.deviceId;
    } catch (err) {
      console.error('Authentication error:', err);
      reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication failed',
        statusCode: 401,
      });
    }
  });

  fastify.decorate('adminOnly', async (request: FastifyRequest, reply: any) => {
    try {
      await fastify.authenticate(request, reply);
      
      const authRequest = request as AuthRequest;
      if (!authRequest.user || authRequest.user.role !== 'system_admin') {
        reply.status(403).send({
          error: 'Forbidden',
          message: 'Admin access required',
          statusCode: 403,
        });
      }
    } catch (err) {
      reply.send(err);
    }
  });

  fastify.decorate('companyAdmin', async (request: FastifyRequest, reply: any) => {
    try {
      await fastify.authenticate(request, reply);
      
      const authRequest = request as AuthRequest;
      if (!authRequest.user || !['company_admin', 'system_admin'].includes(authRequest.user.role)) {
        reply.status(403).send({
          error: 'Forbidden',
          message: 'Company admin access required',
          statusCode: 403,
        });
      }
    } catch (err) {
      reply.send(err);
    }
  });
};

// Individual middleware functions for direct import
export const requireAuth = async (request: FastifyRequest, reply: any) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
        statusCode: 401,
      });
    }

    const token = authHeader.substring(7);
    
    // Check if token is blacklisted
    const isBlacklisted = await authService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Token has been revoked',
        statusCode: 401,
      });
    }

    // Verify token and get user data
    const tokenData = await authService.verifyAccessToken(token);
    if (!tokenData) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
        statusCode: 401,
      });
    }

    const user = await authService.getUserFromToken(token);
    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User not found',
        statusCode: 401,
      });
    }

    (request as any).user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      companyId: user.company_id
    };
    (request as any).sessionId = tokenData.sessionId;
    (request as any).deviceId = tokenData.payload?.deviceId;
  } catch (err) {
    console.error('Authentication error:', err);
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication failed',
      statusCode: 401,
    });
  }
};

export const requireAdmin = async (request: FastifyRequest, reply: any) => {
  await requireAuth(request, reply);
  
  const authRequest = request as AuthRequest;
  if (!authRequest.user || authRequest.user.role !== 'system_admin') {
    reply.status(403).send({
      error: 'Forbidden',
      message: 'Admin access required',
      statusCode: 403,
    });
  }
};

export const requireCompanyRole = (allowedRoles: string[] = ['company_admin', 'system_admin']) => {
  return async (request: FastifyRequest, reply: any) => {
    await requireAuth(request, reply);
    
    const authRequest = request as AuthRequest;
    if (!authRequest.user || !allowedRoles.includes(authRequest.user.role)) {
      reply.status(403).send({
        error: 'Forbidden',
        message: `Access requires one of: ${allowedRoles.join(', ')}`,
        statusCode: 403,
      });
    }
  };
};

// Backward compatibility exports
export const authMiddleware = requireAuth;
export const authenticate = requireAuth;

// Default export
export default fp(authPlugin);