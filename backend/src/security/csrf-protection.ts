import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { randomBytes, createHash } from 'crypto';

export interface CSRFOptions {
  cookieName?: string;
  headerName?: string;
  secretLength?: number;
  saltLength?: number;
  ignoreMethods?: string[];
}

const defaultOptions: Required<CSRFOptions> = {
  cookieName: '_csrf',
  headerName: 'x-csrf-token',
  secretLength: 18,
  saltLength: 8,
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS']
};

export class CSRFProtection {
  private options: Required<CSRFOptions>;

  constructor(options: CSRFOptions = {}) {
    this.options = { ...defaultOptions, ...options };
  }

  generateSecret(): string {
    return randomBytes(this.options.secretLength).toString('base64');
  }

  generateToken(secret: string): string {
    const salt = randomBytes(this.options.saltLength).toString('base64');
    const hash = createHash('sha1')
      .update(salt + secret)
      .digest('base64');
    return `${salt}-${hash}`;
  }

  verifyToken(token: string, secret: string): boolean {
    if (!token || !secret) return false;

    const parts = token.split('-');
    if (parts.length !== 2) return false;

    const [salt, hash] = parts;
    const expectedHash = createHash('sha1')
      .update(salt + secret)
      .digest('base64');

    return hash === expectedHash;
  }

  getSecretFromCookie(request: FastifyRequest): string | undefined {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) return undefined;

    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    return cookies[this.options.cookieName];
  }

  setSecretCookie(reply: FastifyReply, secret: string): void {
    const cookieValue = `${this.options.cookieName}=${secret}; HttpOnly; SameSite=Strict; Path=/`;
    if (process.env.NODE_ENV === 'production') {
      reply.header('Set-Cookie', cookieValue + '; Secure');
    } else {
      reply.header('Set-Cookie', cookieValue);
    }
  }

  async middleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Skip CSRF for safe methods
    if (this.options.ignoreMethods.includes(request.method)) {
      return;
    }

    // Get secret from cookie
    const secret = this.getSecretFromCookie(request);
    if (!secret) {
      reply.status(403).send({
        error: 'Forbidden',
        message: 'CSRF token missing - no secret found',
        statusCode: 403,
        code: 'MISSING_CSRF_SECRET'
      });
      return;
    }

    // Get token from header or body
    const token = request.headers[this.options.headerName] as string ||
                  (request.body as any)?._csrf ||
                  (request.query as any)?._csrf;

    if (!this.verifyToken(token, secret)) {
      reply.status(403).send({
        error: 'Forbidden',
        message: 'Invalid CSRF token',
        statusCode: 403,
        code: 'INVALID_CSRF_TOKEN'
      });
      return;
    }
  }

  generateTokenWithSecret(request: FastifyRequest, reply: FastifyReply): { csrfToken: string; secret: string } {
    let secret = this.getSecretFromCookie(request);
    
    if (!secret) {
      secret = this.generateSecret();
      this.setSecretCookie(reply, secret);
    }
    
    const token = this.generateToken(secret);
    return { csrfToken: token, secret };
  }
}

const csrfProtectionPlugin: FastifyPluginAsync<CSRFOptions> = async (fastify, options) => {
  const csrf = new CSRFProtection(options);

  // Add CSRF token generation endpoint
  fastify.get('/csrf-token', async (request, reply) => {
    const { csrfToken } = csrf.generateTokenWithSecret(request, reply);
    return { csrfToken };
  });

  // Register as pre-handler for all routes (can be disabled per route)
  fastify.addHook('preHandler', async (request, reply) => {
    // Skip if route has csrf disabled
    if ((request.routeOptions as any)?.config?.csrf === false) {
      return;
    }
    
    await csrf.middleware(request, reply);
  });

  // Add helper methods to fastify instance
  fastify.decorate('generateCSRFToken', async (request: FastifyRequest, reply: FastifyReply) => {
    const { csrfToken } = csrf.generateTokenWithSecret(request, reply);
    return csrfToken;
  });

  fastify.decorate('verifyCSRFToken', (request: FastifyRequest, reply: FastifyReply) => {
    const secret = csrf.getSecretFromCookie(request);
    if (!secret) return false;
    
    const token = request.headers['x-csrf-token'] as string ||
                  (request.body as any)?._csrf;
    
    return csrf.verifyToken(token, secret);
  });
};

export default fp(csrfProtectionPlugin, {
  name: 'csrf-protection',
  dependencies: []
});

// Export standalone middleware for specific routes
export const createCSRFMiddleware = (options: CSRFOptions = {}) => {
  const csrf = new CSRFProtection(options);
  
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await csrf.middleware(request, reply);
  };
};

// Export for manual token generation
export const createCSRFTokenGenerator = (options: CSRFOptions = {}) => {
  const csrf = new CSRFProtection(options);
  
  return (request: FastifyRequest, reply: FastifyReply): string => {
    const { csrfToken } = csrf.generateTokenWithSecret(request, reply);
    return csrfToken;
  };
}; 