import { FastifyPluginAsync } from 'fastify';
import { authService } from '@/services/auth';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register endpoint
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string', minLength: 1 },
          lastName: { type: 'string', minLength: 1 },
          phone: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { email, password, firstName, lastName, phone } = request.body as any;
      const ipAddress = request.ip;

      const result = await authService.createUser({
        email,
        password,
        firstName,
        lastName,
        phone
      }, ipAddress);

      reply.code(201).send({
        success: true,
        message: 'User created successfully',
        data: result
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        message: error.message || 'Registration failed'
      });
    }
  });

  // Login endpoint
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { email, password } = request.body as any;
      const ipAddress = request.ip;

      const result = await authService.authenticateUser({
        email,
        password
      }, ipAddress);

      reply.send({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error: any) {
      reply.code(401).send({
        success: false,
        message: error.message || 'Authentication failed'
      });
    }
  });

  // Logout endpoint
  fastify.post('/logout', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      await authService.revokeRefreshToken(user.id);
      
      reply.send({ 
        success: true,
        message: 'Logged out successfully' 
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: 'Logout failed'
      });
    }
  });

  // Refresh token endpoint
  fastify.post('/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { refreshToken } = request.body as any;
      
      const result = await authService.refreshTokens(refreshToken);
      
      reply.send({
        success: true,
        message: 'Tokens refreshed successfully',
        data: result
      });
    } catch (error: any) {
      reply.code(401).send({
        success: false,
        message: error.message || 'Token refresh failed'
      });
    }
  });

  // Get current user
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      
      reply.send({ 
        success: true,
        data: { user }
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: 'Failed to get user details'
      });
    }
  });
};

export default authRoutes;