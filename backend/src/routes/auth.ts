import { FastifyPluginAsync } from 'fastify';
import { authService, jwtService } from '@/services/auth';

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
          companyName: { type: 'string' },
          deviceInfo: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              fingerprint: { type: 'string' },
              userAgent: { type: 'string' }
            }
          }
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { email, password, firstName, lastName, phone, companyName, deviceInfo } = request.body as any;
      const ipAddress = request.ip;
      
      const enhancedDeviceInfo = {
        ...deviceInfo,
        userAgent: request.headers['user-agent'],
        ip: ipAddress
      };

      const result = await authService.createUser({
        email,
        password,
        firstName,
        lastName,
        phone
      }, ipAddress, enhancedDeviceInfo);

      reply.code(201).send({
        success: true,
        message: 'User created successfully',
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresIn: result.tokens.expiresIn,
          deviceId: result.deviceId
        }
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
          deviceInfo: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              fingerprint: { type: 'string' },
              userAgent: { type: 'string' }
            }
          }
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { email, password, deviceInfo } = request.body as any;
      const ipAddress = request.ip;
      
      const enhancedDeviceInfo = {
        ...deviceInfo,
        userAgent: request.headers['user-agent'],
        ip: ipAddress
      };

      const result = await authService.authenticateUser({
        email,
        password
      }, ipAddress, enhancedDeviceInfo);

      reply.send({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresIn: result.tokens.expiresIn,
          deviceId: result.deviceId
        }
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
    schema: {
      body: {
        type: 'object',
        properties: {
          allDevices: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { allDevices } = request.body as any || {};
      const authHeader = request.headers.authorization;
      
      if (authHeader) {
        const token = authHeader.substring(7);
        await authService.blacklistToken(token);
      }
      
      if (allDevices) {
        await authService.revokeUserSessions(user.id);
      } else {
        const sessionId = (request as any).sessionId;
        await authService.revokeUserSessions(user.id, sessionId);
      }
      
      reply.send({ 
        success: true,
        message: allDevices ? 'Logged out from all devices' : 'Logged out successfully'
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
          deviceInfo: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              fingerprint: { type: 'string' },
              userAgent: { type: 'string' }
            }
          }
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { refreshToken, deviceInfo } = request.body as any;
      
      const enhancedDeviceInfo = {
        ...deviceInfo,
        userAgent: request.headers['user-agent'],
        ip: request.ip
      };
      
      const tokens = await authService.refreshTokens(refreshToken, enhancedDeviceInfo);
      
      reply.send({
        success: true,
        message: 'Tokens refreshed successfully',
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn
        }
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

  // Get user sessions
  fastify.get('/sessions', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const sessions = await authService.getUserSessions(user.id);
      
      reply.send({
        success: true,
        data: { sessions }
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: 'Failed to get user sessions'
      });
    }
  });

  // Revoke specific session
  fastify.delete('/sessions/:sessionId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', format: 'uuid' }
        },
        required: ['sessionId']
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { sessionId } = request.params as any;
      
      await authService.revokeUserSessions(user.id, sessionId);
      
      reply.send({
        success: true,
        message: 'Session revoked successfully'
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: 'Failed to revoke session'
      });
    }
  });

  // JWT public key endpoint for token verification
  fastify.get('/jwks', async (request, reply) => {
    try {
      const publicKey = jwtService.getPublicKey();
      
      reply.send({
        success: true,
        data: {
          keys: [{
            kty: 'RSA',
            use: 'sig',
            alg: 'RS256',
            key: publicKey
          }]
        }
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: 'Failed to get public key'
      });
    }
  });
};

export default authRoutes;