import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '@/utils/logger';

interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  validation?: any[];
}

export async function errorHandler(
  error: FastifyError | CustomError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
  });

  // Validation errors
  if (error.validation) {
    reply.status(400).send({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: error.validation,
      statusCode: 400,
    });
    return;
  }

  // JWT errors
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'No authorization token provided',
      statusCode: 401,
    });
    return;
  }

  if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid authorization token',
      statusCode: 401,
    });
    return;
  }

  // Rate limit errors
  if (error.code === 'FST_TOO_MANY_REQUESTS') {
    reply.status(429).send({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
      statusCode: 429,
    });
    return;
  }

  // File upload errors
  if (error.code === 'FST_FILES_LIMIT') {
    reply.status(413).send({
      error: 'Payload Too Large',
      message: 'File size exceeds maximum allowed size',
      statusCode: 413,
    });
    return;
  }

  // Custom application errors
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Internal Server Error' : error.message;

  reply.status(statusCode).send({
    error: statusCode === 500 ? 'Internal Server Error' : error.name || 'Error',
    message,
    statusCode,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
}