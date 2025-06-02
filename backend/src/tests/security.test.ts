import { FastifyInstance } from 'fastify';
import { build } from '../app';
import { generateCsrfToken, validateCsrfToken } from '../middleware/csrf';

describe('Security Middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = build({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('CSRF Protection', () => {
    it('should generate valid CSRF tokens', () => {
      const sessionId = 'test-session-123';
      const token = generateCsrfToken(sessionId);
      
      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes in hex
    });

    it('should validate correct CSRF tokens', () => {
      const sessionId = 'test-session-123';
      const token = generateCsrfToken(sessionId);
      
      const isValid = validateCsrfToken(sessionId, token);
      expect(isValid).toBe(true);
    });

    it('should reject invalid CSRF tokens', () => {
      const sessionId = 'test-session-123';
      generateCsrfToken(sessionId);
      
      const isValid = validateCsrfToken(sessionId, 'invalid-token');
      expect(isValid).toBe(false);
    });

    it('should reject expired CSRF tokens', async () => {
      jest.useFakeTimers();
      
      const sessionId = 'test-session-123';
      const token = generateCsrfToken(sessionId);
      
      // Fast forward time by 2 hours
      jest.advanceTimersByTime(2 * 60 * 60 * 1000);
      
      const isValid = validateCsrfToken(sessionId, token);
      expect(isValid).toBe(false);
      
      jest.useRealTimers();
    });

    it('should skip CSRF for GET requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/receipts'
      });
      
      expect(response.statusCode).not.toBe(403);
    });

    it('should require CSRF for POST requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/receipts',
        payload: { merchant: 'Test' }
      });
      
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: 'Missing session' });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make multiple requests
      const requests = Array(101).fill(null).map(() =>
        app.inject({
          method: 'GET',
          url: '/api/health',
          headers: {
            'x-forwarded-for': '192.168.1.100'
          }
        })
      );
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.statusCode === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers', () => {
    it('should set security headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health'
      });
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });
});
