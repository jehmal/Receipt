import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';

interface CsrfTokenStore {
  [key: string]: {
    token: string;
    expires: number;
  };
}

// In-memory store for CSRF tokens (should be Redis in production)
const csrfTokenStore: CsrfTokenStore = {};

// Token expiry time (1 hour)
const TOKEN_EXPIRY = 60 * 60 * 1000;

export function generateCsrfToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokenStore[sessionId] = {
    token,
    expires: Date.now() + TOKEN_EXPIRY
  };
  return token;
}

export function validateCsrfToken(sessionId: string, token: string): boolean {
  const storedData = csrfTokenStore[sessionId];
  
  if (!storedData) {
    return false;
  }
  
  // Check if token has expired
  if (Date.now() > storedData.expires) {
    delete csrfTokenStore[sessionId];
    return false;
  }
  
  return storedData.token === token;
}

// Cleanup expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const sessionId in csrfTokenStore) {
    if (csrfTokenStore[sessionId].expires < now) {
      delete csrfTokenStore[sessionId];
    }
  }
}, TOKEN_EXPIRY);

export async function csrfProtection(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return;
  }

  // Skip CSRF for API endpoints that use JWT authentication
  if (request.headers.authorization?.startsWith('Bearer ')) {
    return;
  }

  const sessionId = request.cookies?.sessionId || request.headers['x-session-id'] as string;
  if (!sessionId) {
    return reply.code(403).send({ error: 'Missing session' });
  }

  const csrfToken = request.headers['x-csrf-token'] as string || (request.body as any)?.csrfToken;
  if (!csrfToken) {
    return reply.code(403).send({ error: 'Missing CSRF token' });
  }

  if (!validateCsrfToken(sessionId, csrfToken)) {
    return reply.code(403).send({ error: 'Invalid CSRF token' });
  }
}

// Hook to add CSRF token to response
export async function addCsrfToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const sessionId = request.cookies?.sessionId || request.headers['x-session-id'] as string;
  if (sessionId && request.method === 'GET') {
    const token = generateCsrfToken(sessionId);
    reply.header('X-CSRF-Token', token);
  }
}
