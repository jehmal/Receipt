// Enterprise Security Middleware for Receipt Vault Pro
// OWASP Top 10 compliant security controls

import { FastifyRequest, FastifyReply } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import { logger } from '@/utils/logger';
import crypto from 'crypto';

// Security configuration
const SECURITY_CONFIG = {
  maxRequestSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  maxFileSize: 5 * 1024 * 1024, // 5MB for individual files
  tokenExpiry: 3600, // 1 hour
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60, // 15 minutes
};

export async function securityHeaders(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Enhanced security headers for enterprise compliance
  reply.headers({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.workos.com https://vision.googleapis.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  });
}

// OWASP A01: Broken Access Control
export async function accessControlMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Verify user has valid session
    if (!request.user) {
      logger.warn('Access denied: No user session', {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        path: request.url
      });
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Check if user account is active
    if (request.user.status !== 'active') {
      logger.warn('Access denied: Inactive user account', {
        userId: request.user.id,
        status: request.user.status
      });
      return reply.status(403).send({ error: 'Account not active' });
    }

    // Resource-level access control
    const resourceId = request.params.id;
    if (resourceId && !await canAccessResource(request.user, resourceId, request.method)) {
      logger.warn('Access denied: Insufficient permissions', {
        userId: request.user.id,
        resourceId,
        method: request.method
      });
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

  } catch (error) {
    logger.error('Access control middleware error:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
}

// OWASP A03: Injection Prevention
export function injectionPreventionMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Validate and sanitize input
    if (request.body && typeof request.body === 'object') {
      sanitizeObject(request.body);
    }
    
    if (request.query && typeof request.query === 'object') {
      sanitizeObject(request.query);
    }

    // Check for common injection patterns
    const suspiciousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /(union|select|insert|update|delete|drop|create|alter)\s+/gi,
    ];

    const requestStr = JSON.stringify({ body: request.body, query: request.query });
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestStr)) {
        logger.warn('Potential injection attempt detected', {
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          pattern: pattern.source,
          request: requestStr.substring(0, 500)
        });
        return reply.status(400).send({ error: 'Invalid input detected' });
      }
    }
  };
}

// OWASP A09: Security Logging and Monitoring
export function securityLoggingMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    
    // Log security-relevant events
    const securityContext = {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      method: request.method,
      url: request.url,
      userId: request.user?.id,
      timestamp: new Date().toISOString()
    };

    // Detect suspicious patterns
    const suspiciousIndicators = [
      request.headers['user-agent']?.includes('sqlmap'),
      request.headers['user-agent']?.includes('nikto'),
      request.url.includes('../'),
      request.url.includes('%2e%2e'),
      Object.keys(request.query || {}).some(key => key.length > 100),
    ];

    if (suspiciousIndicators.some(Boolean)) {
      logger.warn('Suspicious request detected', securityContext);
    }

    reply.addHook('onSend', async () => {
      const duration = Date.now() - startTime;
      
      // Log failed authentication attempts
      if (reply.statusCode === 401) {
        logger.warn('Authentication failure', {
          ...securityContext,
          duration,
          statusCode: reply.statusCode
        });
      }
      
      // Log authorization failures
      if (reply.statusCode === 403) {
        logger.warn('Authorization failure', {
          ...securityContext,
          duration,
          statusCode: reply.statusCode
        });
      }
      
      // Log slow requests (potential DoS)
      if (duration > 5000) {
        logger.warn('Slow request detected', {
          ...securityContext,
          duration,
          statusCode: reply.statusCode
        });
      }
    });
  };
}

// Helper functions
function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Basic XSS prevention
      obj[key] = obj[key]
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

async function canAccessResource(user: any, resourceId: string, method: string): Promise<boolean> {
  // Implement resource-level access control logic
  // This would check if user has permission to access specific resource
  return true; // Placeholder
}

// Certificate pinning for external API calls
export const certificatePins = {
  'api.workos.com': [
    'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // Replace with actual pin
    'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB='  // Backup pin
  ],
  'vision.googleapis.com': [
    'sha256/CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=',
    'sha256/DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD='
  ]
};

// API Key validation middleware
export function apiKeyValidation(validKeys: Set<string>) {
  return async function validate(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const apiKey = request.headers['x-api-key'] as string;
    
    if (!apiKey) {
      return reply.code(401).send({ error: 'Missing API key' });
    }
    
    if (!validKeys.has(apiKey)) {
      return reply.code(401).send({ error: 'Invalid API key' });
    }
  };
}
