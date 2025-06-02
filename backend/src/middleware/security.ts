import { FastifyRequest, FastifyReply } from 'fastify';

export async function securityHeaders(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Additional security headers beyond what Fastify Helmet provides
  reply.headers({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.workos.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  });
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
