import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { authService } from '@/services/auth';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: any) => Promise<void>;
    adminOnly: (request: FastifyRequest, reply: any) => Promise<void>;
    companyAdmin: (request: FastifyRequest, reply: any) => Promise<void>;
  }
  
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      companyId?: string;
    };
  }
}

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
      const user = await authService.getUserFromToken(token);
      
      if (!user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid or expired token',
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
    } catch (err) {
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
      
      if (!request.user || request.user.role !== 'system_admin') {
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
      
      if (!request.user || !['company_admin', 'system_admin'].includes(request.user.role)) {
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
    const user = await authService.getUserFromToken(token);
    
    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
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
  } catch (err) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication failed',
      statusCode: 401,
    });
  }
};

export const requireAdmin = async (request: FastifyRequest, reply: any) => {
  await requireAuth(request, reply);
  
  if (!request.user || request.user.role !== 'system_admin') {
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
    
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      reply.status(403).send({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        statusCode: 403,
      });
    }
  };
};

export { authPlugin };
export default fp(authPlugin);