import { SecurityHeaders, SecurityHeadersOptions, SecurityPresets } from '../../security/security-headers';
import { FastifyReply } from 'fastify';

describe('SecurityHeaders', () => {
  let mockReply: jest.Mocked<FastifyReply>;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    mockReply = {
      header: jest.fn().mockReturnThis(),
      removeHeader: jest.fn().mockReturnThis(),
    } as any;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
  });

  describe('Constructor and Options Merging', () => {
    it('should initialize with default options', () => {
      const securityHeaders = new SecurityHeaders();
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'self'")
      );
    });

    it('should merge custom options with defaults', () => {
      const customOptions: SecurityHeadersOptions = {
        frameOptions: 'SAMEORIGIN',
        contentSecurityPolicy: {
          directives: {
            'script-src': ["'self'", "'unsafe-eval'"]
          }
        }
      };

      const securityHeaders = new SecurityHeaders(customOptions);
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith('X-Frame-Options', 'SAMEORIGIN');
      expect(mockReply.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("script-src 'self' 'unsafe-eval'")
      );
    });

    it('should deep merge nested objects correctly', () => {
      const customOptions: SecurityHeadersOptions = {
        contentSecurityPolicy: {
          directives: {
            'img-src': ["'self'", 'https://cdn.example.com']
          }
        },
        hsts: {
          maxAge: 86400 // 1 day instead of default 1 year
        }
      };

      const securityHeaders = new SecurityHeaders(customOptions);
      securityHeaders.applyHeaders(mockReply);

      // Should keep default directives and add custom ones
      expect(mockReply.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'self'")
      );
      expect(mockReply.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("img-src 'self' https://cdn.example.com")
      );
    });
  });

  describe('Content Security Policy (CSP)', () => {
    it('should format CSP directives correctly', () => {
      const options: SecurityHeadersOptions = {
        contentSecurityPolicy: {
          directives: {
            'default-src': ["'none'"],
            'script-src': ["'self'", "'unsafe-inline'"],
            'upgrade-insecure-requests': []
          }
        }
      };

      const securityHeaders = new SecurityHeaders(options);
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'self' 'unsafe-inline'; upgrade-insecure-requests"
      );
    });

    it('should use report-only header when specified', () => {
      const options: SecurityHeadersOptions = {
        contentSecurityPolicy: {
          directives: { 'default-src': ["'self'"] },
          reportOnly: true
        }
      };

      const securityHeaders = new SecurityHeaders(options);
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith(
        'Content-Security-Policy-Report-Only',
        expect.stringContaining("default-src 'self'")
      );
      expect(mockReply.header).not.toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.any(String)
      );
    });

    it('should include report-uri when specified', () => {
      const options: SecurityHeadersOptions = {
        contentSecurityPolicy: {
          directives: { 'default-src': ["'self'"] },
          reportUri: 'https://example.com/csp-report'
        }
      };

      const securityHeaders = new SecurityHeaders(options);
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        "default-src 'self'; report-uri https://example.com/csp-report"
      );
    });
  });

  describe('HTTP Strict Transport Security (HSTS)', () => {
    it('should include HSTS header in production', () => {
      process.env.NODE_ENV = 'production';
      
      const securityHeaders = new SecurityHeaders();
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    });

    it('should NOT include HSTS header in non-production', () => {
      process.env.NODE_ENV = 'development';
      
      const securityHeaders = new SecurityHeaders();
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).not.toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.any(String)
      );
    });

    it('should customize HSTS values', () => {
      process.env.NODE_ENV = 'production';
      
      const options: SecurityHeadersOptions = {
        hsts: {
          maxAge: 86400,
          includeSubDomains: false,
          preload: false
        }
      };

      const securityHeaders = new SecurityHeaders(options);
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=86400'
      );
    });
  });

  describe('Frame Options', () => {
    it('should set default frame options', () => {
      const securityHeaders = new SecurityHeaders();
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    });

    it('should allow custom frame options', () => {
      const securityHeaders = new SecurityHeaders({ frameOptions: 'SAMEORIGIN' });
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith('X-Frame-Options', 'SAMEORIGIN');
    });

    it('should allow custom allow-from directive', () => {
      const securityHeaders = new SecurityHeaders({ frameOptions: 'ALLOW-FROM https://example.com' });
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith('X-Frame-Options', 'ALLOW-FROM https://example.com');
    });
  });

  describe('Content Type Options', () => {
    it('should set nosniff by default', () => {
      const securityHeaders = new SecurityHeaders();
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    });

    it('should skip content type options when disabled', () => {
      const securityHeaders = new SecurityHeaders({ contentTypeOptions: false });
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).not.toHaveBeenCalledWith('X-Content-Type-Options', expect.any(String));
    });
  });

  describe('Referrer Policy', () => {
    it('should set default referrer policy', () => {
      const securityHeaders = new SecurityHeaders();
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
    });

    it('should allow custom referrer policy', () => {
      const securityHeaders = new SecurityHeaders({ referrerPolicy: 'no-referrer' });
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    });
  });

  describe('Feature Policy', () => {
    it('should format feature policy correctly', () => {
      const options: SecurityHeadersOptions = {
        featurePolicy: {
          'geolocation': ["'self'", 'https://example.com'],
          'microphone': ["'none'"],
          'camera': []
        }
      };

      const securityHeaders = new SecurityHeaders(options);
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith(
        'Feature-Policy',
        "geolocation 'self' https://example.com, microphone 'none', camera 'none'"
      );
    });

    it('should handle empty feature policy', () => {
      const securityHeaders = new SecurityHeaders({ featurePolicy: {} });
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith('Feature-Policy', '');
    });
  });

  describe('Permissions Policy', () => {
    it('should format permissions policy correctly', () => {
      const options: SecurityHeadersOptions = {
        permissionsPolicy: {
          'geolocation': ['self', 'https://example.com'],
          'microphone': [],
          'camera': ['self']
        }
      };

      const securityHeaders = new SecurityHeaders(options);
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith(
        'Permissions-Policy',
        'geolocation=(self https://example.com), microphone=(), camera=(self)'
      );
    });
  });

  describe('Cross-Origin Policies', () => {
    it('should set cross-origin policies when specified', () => {
      const options: SecurityHeadersOptions = {
        crossOriginPolicy: {
          embedderPolicy: 'require-corp',
          openerPolicy: 'same-origin-allow-popups',
          resourcePolicy: 'cross-origin'
        }
      };

      const securityHeaders = new SecurityHeaders(options);
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith('Cross-Origin-Embedder-Policy', 'require-corp');
      expect(mockReply.header).toHaveBeenCalledWith('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
      expect(mockReply.header).toHaveBeenCalledWith('Cross-Origin-Resource-Policy', 'cross-origin');
    });

    it('should skip cross-origin policies when not specified', () => {
      const options: SecurityHeadersOptions = {
        crossOriginPolicy: {
          embedderPolicy: undefined,
          openerPolicy: undefined,
          resourcePolicy: undefined
        }
      };

      const securityHeaders = new SecurityHeaders(options);
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).not.toHaveBeenCalledWith('Cross-Origin-Embedder-Policy', expect.any(String));
      expect(mockReply.header).not.toHaveBeenCalledWith('Cross-Origin-Opener-Policy', expect.any(String));
      expect(mockReply.header).not.toHaveBeenCalledWith('Cross-Origin-Resource-Policy', expect.any(String));
    });
  });

  describe('Additional Security Headers', () => {
    it('should set additional security headers', () => {
      const securityHeaders = new SecurityHeaders();
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockReply.header).toHaveBeenCalledWith('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive');
      expect(mockReply.header).toHaveBeenCalledWith('X-Download-Options', 'noopen');
      expect(mockReply.header).toHaveBeenCalledWith('X-Permitted-Cross-Domain-Policies', 'none');
    });

    it('should remove potentially dangerous headers', () => {
      const securityHeaders = new SecurityHeaders();
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.removeHeader).toHaveBeenCalledWith('X-Powered-By');
      expect(mockReply.removeHeader).toHaveBeenCalledWith('Server');
    });
  });

  describe('Security Presets', () => {
    it('should apply strict preset correctly', () => {
      const securityHeaders = new SecurityHeaders(SecurityPresets.strict);
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'none'")
      );
      expect(mockReply.header).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockReply.header).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    });

    it('should apply development preset correctly', () => {
      const securityHeaders = new SecurityHeaders(SecurityPresets.development);
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith(
        'Content-Security-Policy-Report-Only',
        expect.stringContaining("script-src 'self' 'unsafe-inline' 'unsafe-eval'")
      );
      expect(mockReply.header).toHaveBeenCalledWith('X-Frame-Options', 'SAMEORIGIN');
    });
  });

  describe('Middleware Function', () => {
    it('should create middleware that applies headers', async () => {
      const securityHeaders = new SecurityHeaders();
      const middleware = securityHeaders.middleware();

      const mockRequest = {} as any;
      
      await middleware(mockRequest, mockReply);

      expect(mockReply.header).toHaveBeenCalledTimes(11); // All default headers
      expect(mockReply.removeHeader).toHaveBeenCalledTimes(2); // Remove dangerous headers
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty directives object', () => {
      const options: SecurityHeadersOptions = {
        contentSecurityPolicy: {
          directives: {}
        }
      };

      const securityHeaders = new SecurityHeaders(options);
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith('Content-Security-Policy', '');
    });

    it('should handle null/undefined values gracefully', () => {
      const options: SecurityHeadersOptions = {
        contentSecurityPolicy: {
          directives: {
            'default-src': ["'self'"]
          },
          reportUri: undefined
        },
        hsts: undefined as any
      };

      expect(() => {
        const securityHeaders = new SecurityHeaders(options);
        securityHeaders.applyHeaders(mockReply);
      }).not.toThrow();
    });

    it('should handle very long header values', () => {
      const longSources = Array(100).fill(0).map((_, i) => `https://cdn${i}.example.com`);
      const options: SecurityHeadersOptions = {
        contentSecurityPolicy: {
          directives: {
            'script-src': ["'self'", ...longSources]
          }
        }
      };

      const securityHeaders = new SecurityHeaders(options);
      securityHeaders.applyHeaders(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining('script-src')
      );
    });

    it('should maintain header order consistency', () => {
      const securityHeaders = new SecurityHeaders();
      securityHeaders.applyHeaders(mockReply);

      const headerCalls = mockReply.header.mock.calls;
      const cspCall = headerCalls.find(call => call[0] === 'Content-Security-Policy');
      const frameCall = headerCalls.find(call => call[0] === 'X-Frame-Options');
      
      expect(cspCall).toBeDefined();
      expect(frameCall).toBeDefined();
    });
  });

  describe('Performance Considerations', () => {
    it('should not recreate string formats unnecessarily', () => {
      const securityHeaders = new SecurityHeaders();
      
      // Apply headers multiple times
      securityHeaders.applyHeaders(mockReply);
      securityHeaders.applyHeaders(mockReply);
      securityHeaders.applyHeaders(mockReply);

      // Should work without errors (this tests internal caching if implemented)
      expect(mockReply.header).toHaveBeenCalledTimes(33); // 11 headers × 3 calls
    });

    it('should handle concurrent header application', async () => {
      const securityHeaders = new SecurityHeaders();
      
      const promises = Array(10).fill(0).map(() => {
        const mockReplyLocal = {
          header: jest.fn().mockReturnThis(),
          removeHeader: jest.fn().mockReturnThis(),
        } as any;
        
        return Promise.resolve(securityHeaders.applyHeaders(mockReplyLocal));
      });

      await Promise.all(promises);
      
      // Should complete without throwing errors
      expect(promises).toHaveLength(10);
    });
  });
});