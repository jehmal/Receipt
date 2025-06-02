import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import jwt from '@fastify/jwt';
import path from 'path';

import config from './config/index';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import { authPlugin } from './middleware/auth';

// Route imports  
import authRoutes from './routes/auth';
import receiptRoutes from './routes/receipts';
import mobileReceiptRoutes from './routes/receipts-mobile';
import userContextRoutes from './routes/user-context';
import companyRoutes from './routes/companies';
import searchRoutes from './routes/search';
import jobsRoutes from './routes/jobs';
import emailProcessingRoutes from './routes/email-processing';
import securityRoutes from './routes/security';
import analyticsRoutes from './routes/analytics';
import approvalWorkflowRoutes from './routes/approval-workflow';
// Other routes temporarily disabled for now
// import userRoutes from '@/routes/users';
// import adminRoutes from '@/routes/admin';

const server: FastifyInstance = Fastify({
  logger: {
    level: config.logging.level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

async function buildServer(): Promise<FastifyInstance> {
  try {
    // Register CORS
    await server.register(cors, {
      origin: config.server.corsOrigin,
      credentials: true,
    });

    // Register security plugins
    await server.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    });

    // Register rate limiting
    await server.register(rateLimit, {
      max: config.rateLimit.max,
      timeWindow: config.rateLimit.window,
    });

    // Register multipart for file uploads
    await server.register(multipart, {
      limits: {
        fileSize: config.upload.maxFileSize,
      },
    });

    // Register JWT
    await server.register(jwt, {
      secret: config.jwt.secret,
    });

    // Register static file serving
    await server.register(staticFiles, {
      root: path.join(__dirname, '../uploads'),
      prefix: '/uploads/',
    });

    // Register custom plugins
    await server.register(authPlugin);

    // Health check endpoint
    server.get('/health', async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.server.env,
      };
    });

    // API routes
    await server.register(authRoutes, { prefix: '/auth' });
    await server.register(receiptRoutes, { prefix: '/receipts' });
    await server.register(mobileReceiptRoutes, { prefix: '/api/v1/receipts' });
    await server.register(userContextRoutes, { prefix: '/api/v1/user' });
    await server.register(companyRoutes, { prefix: '/companies' });
    await server.register(searchRoutes, { prefix: '/search' });
    await server.register(jobsRoutes, { prefix: '/jobs' });
    await server.register(emailProcessingRoutes, { prefix: '/email' });
    await server.register(securityRoutes, { prefix: '/security' });
    await server.register(analyticsRoutes, { prefix: '/analytics' });
    await server.register(approvalWorkflowRoutes, { prefix: '/approvals' });
    // await server.register(userRoutes, { prefix: '/api/users' });
    // await server.register(adminRoutes, { prefix: '/api/admin' });

    // Basic test route
    server.get('/api/test', async () => {
      return { message: 'Backend is working!', version: '1.0.0' };
    });

    // Global error handler
    server.setErrorHandler(errorHandler);

    // 404 handler
    server.setNotFoundHandler(async (request, reply) => {
      reply.status(404).send({
        error: 'Not Found',
        message: 'Route not found',
        statusCode: 404,
      });
    });

    return server;
  } catch (error) {
    logger.error('Error building server:', error);
    throw error;
  }
}

async function start(): Promise<void> {
  try {
    const app = await buildServer();
    
    await app.listen({
      port: config.server.port,
      host: config.server.host,
    });

    logger.info(`🚀 Server running on http://${config.server.host}:${config.server.port}`);
    logger.info(`📊 Environment: ${config.server.env}`);
    logger.info(`🔧 Health check: http://${config.server.host}:${config.server.port}/health`);
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await server.close();
  process.exit(0);
});

if (require.main === module) {
  start();
}

export { buildServer, start };
export default server;