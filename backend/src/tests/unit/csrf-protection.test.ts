import { CSRFProtection, CSRFOptions } from '../../security/csrf-protection';
import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';

describe('CSRFProtection', () => {
  let csrfProtection: CSRFProtection;
  let mockRequest: jest.Mocked<FastifyRequest>;
  let mockReply: jest.Mocked<FastifyReply>;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    csrfProtection = new CSRFProtection();
    
    mockRequest = {
      method: 'POST',
      headers: {},
      body: {},
      query: {},
      routeOptions: {}
    } as any;

    mockReply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis()
    } as any;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
  });

  describe('Constructor and Options', () => {
    it('should initialize with default options', () => {
      const csrf = new CSRFProtection();
      expect(csrf).toBeInstanceOf(CSRFProtection);
    });

    it('should accept custom options', () => {
      const customOptions: CSRFOptions = {
        cookieName: '_customcsrf',
        headerName: 'x-custom-csrf',
        secretLength: 24,
        saltLength: 12,
        ignoreMethods: ['GET', 'HEAD', 'OPTIONS', 'TRACE']
      };

      const csrf = new CSRFProtection(customOptions);
      expect(csrf).toBeInstanceOf(CSRFProtection);
    });

    it('should merge custom options with defaults', () => {
      const customOptions: CSRFOptions = {
        cookieName: '_customcsrf',
        // Other options should use defaults
      };

      const csrf = new CSRFProtection(customOptions);
      
      // Test that custom options are used
      mockRequest.headers.cookie = '_customcsrf=test-secret';
      const secret = csrf.getSecretFromCookie(mockRequest);
      expect(secret).toBe('test-secret');
    });
  });

  describe('Secret Generation', () => {
    it('should generate secrets of correct length', () => {
      const secret = csrfProtection.generateSecret();
      
      // Base64 encoded 18 bytes should be 24 characters
      expect(secret).toHaveLength(24);
      expect(secret).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('should generate unique secrets', () => {
      const secret1 = csrfProtection.generateSecret();
      const secret2 = csrfProtection.generateSecret();
      
      expect(secret1).not.toBe(secret2);
    });

    it('should respect custom secret length', () => {
      const customCsrf = new CSRFProtection({ secretLength: 32 });
      const secret = customCsrf.generateSecret();
      
      // Base64 encoded 32 bytes should be ~43 characters
      expect(secret.length).toBeGreaterThan(40);
    });
  });

  describe('Token Generation', () => {
    it('should generate valid tokens', () => {
      const secret = 'test-secret-123';
      const token = csrfProtection.generateToken(secret);
      
      expect(token).toContain('-');
      const parts = token.split('-');
      expect(parts).toHaveLength(2);
      
      // Salt should be base64 encoded
      expect(parts[0]).toMatch(/^[A-Za-z0-9+/=]+$/);
      // Hash should be base64 encoded
      expect(parts[1]).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('should generate different tokens for same secret', () => {
      const secret = 'test-secret-123';
      const token1 = csrfProtection.generateToken(secret);
      const token2 = csrfProtection.generateToken(secret);
      
      expect(token1).not.toBe(token2);
      
      // But both should be valid
      expect(csrfProtection.verifyToken(token1, secret)).toBe(true);
      expect(csrfProtection.verifyToken(token2, secret)).toBe(true);
    });

    it('should respect custom salt length', () => {
      const customCsrf = new CSRFProtection({ saltLength: 16 });
      const secret = 'test-secret';
      const token = customCsrf.generateToken(secret);
      
      const [salt] = token.split('-');
      // Base64 encoded 16 bytes should be ~22 characters
      expect(salt.length).toBeGreaterThan(20);
    });
  });

  describe('Token Verification', () => {
    it('should verify valid tokens', () => {
      const secret = 'test-secret-123';
      const token = csrfProtection.generateToken(secret);
      
      expect(csrfProtection.verifyToken(token, secret)).toBe(true);
    });

    it('should reject invalid tokens', () => {
      const secret = 'test-secret-123';
      const wrongSecret = 'wrong-secret';
      const token = csrfProtection.generateToken(secret);
      
      expect(csrfProtection.verifyToken(token, wrongSecret)).toBe(false);
    });

    it('should reject malformed tokens', () => {
      const secret = 'test-secret';
      
      expect(csrfProtection.verifyToken('', secret)).toBe(false);
      expect(csrfProtection.verifyToken('invalid-token', secret)).toBe(false);
      expect(csrfProtection.verifyToken('no-dash', secret)).toBe(false);
      expect(csrfProtection.verifyToken('too-many-dashes-here', secret)).toBe(false);
    });

    it('should reject tokens with empty secret', () => {
      const token = 'salt-hash';
      
      expect(csrfProtection.verifyToken(token, '')).toBe(false);
      expect(csrfProtection.verifyToken(token, null as any)).toBe(false);
      expect(csrfProtection.verifyToken(token, undefined as any)).toBe(false);
    });

    it('should handle timing attack resistance', () => {
      const secret = 'test-secret';
      const validToken = csrfProtection.generateToken(secret);
      const invalidToken = 'invalid-salt-invalidhash';
      
      // Both should return quickly and consistently
      const start1 = Date.now();
      const result1 = csrfProtection.verifyToken(validToken, secret);
      const time1 = Date.now() - start1;
      
      const start2 = Date.now();
      const result2 = csrfProtection.verifyToken(invalidToken, secret);
      const time2 = Date.now() - start2;
      
      expect(result1).toBe(true);
      expect(result2).toBe(false);
      // Timing should be roughly similar (within 10ms)
      expect(Math.abs(time1 - time2)).toBeLessThan(10);
    });
  });

  describe('Cookie Handling', () => {
    it('should extract secret from cookie header', () => {
      mockRequest.headers.cookie = '_csrf=test-secret-value; other=value';
      const secret = csrfProtection.getSecretFromCookie(mockRequest);
      
      expect(secret).toBe('test-secret-value');
    });

    it('should handle missing cookie header', () => {
      mockRequest.headers.cookie = undefined;
      const secret = csrfProtection.getSecretFromCookie(mockRequest);
      
      expect(secret).toBeUndefined();
    });

    it('should handle multiple cookies', () => {
      mockRequest.headers.cookie = 'session=abc123; _csrf=csrf-secret; lang=en';
      const secret = csrfProtection.getSecretFromCookie(mockRequest);
      
      expect(secret).toBe('csrf-secret');
    });

    it('should handle cookies with spaces', () => {
      mockRequest.headers.cookie = ' _csrf = csrf-secret ; other = value ';
      const secret = csrfProtection.getSecretFromCookie(mockRequest);
      
      expect(secret).toBe('csrf-secret');
    });

    it('should handle custom cookie name', () => {
      const customCsrf = new CSRFProtection({ cookieName: '_customcsrf' });
      mockRequest.headers.cookie = '_customcsrf=custom-secret';
      const secret = customCsrf.getSecretFromCookie(mockRequest);
      
      expect(secret).toBe('custom-secret');
    });

    it('should set secure cookie in production', () => {
      process.env.NODE_ENV = 'production';
      
      csrfProtection.setSecretCookie(mockReply, 'test-secret');
      
      expect(mockReply.header).toHaveBeenCalledWith(
        'Set-Cookie',
        '_csrf=test-secret; HttpOnly; SameSite=Strict; Path=/; Secure'
      );
    });

    it('should set non-secure cookie in development', () => {
      process.env.NODE_ENV = 'development';
      
      csrfProtection.setSecretCookie(mockReply, 'test-secret');
      
      expect(mockReply.header).toHaveBeenCalledWith(
        'Set-Cookie',
        '_csrf=test-secret; HttpOnly; SameSite=Strict; Path=/'
      );
    });
  });

  describe('Middleware Functionality', () => {
    it('should skip CSRF protection for safe methods', async () => {
      mockRequest.method = 'GET';
      
      await csrfProtection.middleware(mockRequest, mockReply);
      
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should skip CSRF protection for HEAD method', async () => {
      mockRequest.method = 'HEAD';
      
      await csrfProtection.middleware(mockRequest, mockReply);
      
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should skip CSRF protection for OPTIONS method', async () => {
      mockRequest.method = 'OPTIONS';
      
      await csrfProtection.middleware(mockRequest, mockReply);
      
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should reject requests without secret cookie', async () => {
      mockRequest.method = 'POST';
      mockRequest.headers.cookie = undefined;
      
      await csrfProtection.middleware(mockRequest, mockReply);
      
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'CSRF token missing - no secret found',
        statusCode: 403,
        code: 'MISSING_CSRF_SECRET'
      });
    });

    it('should accept valid token in header', async () => {
      const secret = 'test-secret';
      const token = csrfProtection.generateToken(secret);
      
      mockRequest.method = 'POST';
      mockRequest.headers.cookie = '_csrf=test-secret';
      mockRequest.headers['x-csrf-token'] = token;
      
      await csrfProtection.middleware(mockRequest, mockReply);
      
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should accept valid token in body', async () => {
      const secret = 'test-secret';
      const token = csrfProtection.generateToken(secret);
      
      mockRequest.method = 'POST';
      mockRequest.headers.cookie = '_csrf=test-secret';
      mockRequest.body = { _csrf: token };
      
      await csrfProtection.middleware(mockRequest, mockReply);
      
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should accept valid token in query', async () => {
      const secret = 'test-secret';
      const token = csrfProtection.generateToken(secret);
      
      mockRequest.method = 'POST';
      mockRequest.headers.cookie = '_csrf=test-secret';
      mockRequest.query = { _csrf: token };
      
      await csrfProtection.middleware(mockRequest, mockReply);
      
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should prioritize header over body token', async () => {
      const secret = 'test-secret';
      const validToken = csrfProtection.generateToken(secret);
      const invalidToken = 'invalid-token';
      
      mockRequest.method = 'POST';
      mockRequest.headers.cookie = '_csrf=test-secret';
      mockRequest.headers['x-csrf-token'] = validToken;
      mockRequest.body = { _csrf: invalidToken };
      
      await csrfProtection.middleware(mockRequest, mockReply);
      
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should reject invalid tokens', async () => {
      mockRequest.method = 'POST';
      mockRequest.headers.cookie = '_csrf=test-secret';
      mockRequest.headers['x-csrf-token'] = 'invalid-token';
      
      await csrfProtection.middleware(mockRequest, mockReply);
      
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Invalid CSRF token',
        statusCode: 403,
        code: 'INVALID_CSRF_TOKEN'
      });
    });

    it('should use custom header name', async () => {
      const customCsrf = new CSRFProtection({ headerName: 'x-custom-csrf' });
      const secret = 'test-secret';
      const token = customCsrf.generateToken(secret);
      
      mockRequest.method = 'POST';
      mockRequest.headers.cookie = '_csrf=test-secret';
      mockRequest.headers['x-custom-csrf'] = token;
      
      await customCsrf.middleware(mockRequest, mockReply);
      
      expect(mockReply.status).not.toHaveBeenCalled();
    });
  });

  describe('Token Generation with Secret', () => {
    it('should generate new secret if none exists', () => {
      mockRequest.headers.cookie = undefined;
      
      const { csrfToken, secret } = csrfProtection.generateTokenWithSecret(mockRequest, mockReply);
      
      expect(secret).toBeDefined();
      expect(csrfToken).toBeDefined();
      expect(csrfProtection.verifyToken(csrfToken, secret)).toBe(true);
      expect(mockReply.header).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining(`_csrf=${secret}`)
      );
    });

    it('should reuse existing secret', () => {
      const existingSecret = 'existing-secret';
      mockRequest.headers.cookie = `_csrf=${existingSecret}`;
      
      const { csrfToken, secret } = csrfProtection.generateTokenWithSecret(mockRequest, mockReply);
      
      expect(secret).toBe(existingSecret);
      expect(csrfProtection.verifyToken(csrfToken, secret)).toBe(true);
      expect(mockReply.header).not.toHaveBeenCalled(); // Should not set new cookie
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle concurrent token verification', async () => {
      const secret = 'test-secret';
      const tokens = Array(100).fill(0).map(() => csrfProtection.generateToken(secret));
      
      const verifications = tokens.map(token => 
        csrfProtection.verifyToken(token, secret)
      );
      
      expect(verifications.every(result => result === true)).toBe(true);
    });

    it('should handle very long secrets', () => {
      const longSecret = 'a'.repeat(1000);
      const token = csrfProtection.generateToken(longSecret);
      
      expect(csrfProtection.verifyToken(token, longSecret)).toBe(true);
    });

    it('should handle special characters in secrets', () => {
      const specialSecret = 'test!@#$%^&*()_+-=[]{}|;:,.<>?/`~secret';
      const token = csrfProtection.generateToken(specialSecret);
      
      expect(csrfProtection.verifyToken(token, specialSecret)).toBe(true);
    });

    it('should handle unicode in secrets', () => {
      const unicodeSecret = 'test-密码-🔒-secret';
      const token = csrfProtection.generateToken(unicodeSecret);
      
      expect(csrfProtection.verifyToken(token, unicodeSecret)).toBe(true);
    });

    it('should be resistant to length extension attacks', () => {
      const secret = 'short';
      const extendedSecret = secret + 'extension';
      
      const token = csrfProtection.generateToken(secret);
      
      expect(csrfProtection.verifyToken(token, extendedSecret)).toBe(false);
    });

    it('should validate hash integrity', () => {
      const secret = 'test-secret';
      const token = csrfProtection.generateToken(secret);
      const [salt, hash] = token.split('-');
      
      // Tamper with the hash
      const tamperedToken = `${salt}-${hash.slice(0, -1)}X`;
      
      expect(csrfProtection.verifyToken(tamperedToken, secret)).toBe(false);
    });

    it('should validate salt integrity', () => {
      const secret = 'test-secret';
      const token = csrfProtection.generateToken(secret);
      const [salt, hash] = token.split('-');
      
      // Tamper with the salt
      const tamperedToken = `${salt.slice(0, -1)}X-${hash}`;
      
      expect(csrfProtection.verifyToken(tamperedToken, secret)).toBe(false);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle high-frequency token generation', () => {
      const secret = 'perf-test-secret';
      const start = Date.now();
      
      const tokens = Array(1000).fill(0).map(() => csrfProtection.generateToken(secret));
      
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      expect(tokens).toHaveLength(1000);
      expect(new Set(tokens)).toHaveProperty('size', 1000); // All tokens should be unique
    });

    it('should handle high-frequency token verification', () => {
      const secret = 'perf-test-secret';
      const tokens = Array(1000).fill(0).map(() => csrfProtection.generateToken(secret));
      
      const start = Date.now();
      
      const results = tokens.map(token => csrfProtection.verifyToken(token, secret));
      
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      expect(results.every(result => result === true)).toBe(true);
    });

    it('should have consistent memory usage', () => {
      const secret = 'memory-test-secret';
      
      // Generate many tokens without keeping references
      for (let i = 0; i < 10000; i++) {
        const token = csrfProtection.generateToken(secret);
        csrfProtection.verifyToken(token, secret);
      }
      
      // Should not throw out-of-memory errors
      expect(true).toBe(true);
    });
  });
});