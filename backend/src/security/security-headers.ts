import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

export interface SecurityHeadersOptions {
  contentSecurityPolicy?: {
    directives?: Record<string, string[]>;
    reportOnly?: boolean;
    reportUri?: string;
  };
  hsts?: {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  frameOptions?: 'DENY' | 'SAMEORIGIN' | string;
  contentTypeOptions?: boolean;
  referrerPolicy?: string;
  featurePolicy?: Record<string, string[]>;
  permissionsPolicy?: Record<string, string[]>;
  crossOriginPolicy?: {
    embedderPolicy?: string;
    openerPolicy?: string;
    resourcePolicy?: string;
  };
}

const defaultOptions: Required<SecurityHeadersOptions> = {
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", 'https:'],
      'connect-src': ["'self'"],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'upgrade-insecure-requests': []
    },
    reportOnly: false,
    reportUri: ''
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameOptions: 'DENY',
  contentTypeOptions: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  featurePolicy: {
    'geolocation': ["'none'"],
    'microphone': ["'none'"],
    'camera': ["'none'"],
    'payment': ["'none'"],
    'usb': ["'none'"]
  },
  permissionsPolicy: {
    'geolocation': [],
    'microphone': [],
    'camera': [],
    'payment': [],
    'usb': []
  },
  crossOriginPolicy: {
    embedderPolicy: 'require-corp',
    openerPolicy: 'same-origin',
    resourcePolicy: 'same-origin'
  }
};

export class SecurityHeaders {
  private options: Required<SecurityHeadersOptions>;

  constructor(options: SecurityHeadersOptions = {}) {
    this.options = this.mergeOptions(defaultOptions, options);
  }

  private mergeOptions(defaults: Required<SecurityHeadersOptions>, overrides: SecurityHeadersOptions): Required<SecurityHeadersOptions> {
    return {
      ...defaults,
      ...overrides,
      contentSecurityPolicy: {
        ...defaults.contentSecurityPolicy,
        ...overrides.contentSecurityPolicy,
        directives: {
          ...defaults.contentSecurityPolicy.directives,
          ...overrides.contentSecurityPolicy?.directives
        }
      },
      hsts: {
        ...defaults.hsts,
        ...overrides.hsts
      },
      featurePolicy: {
        ...defaults.featurePolicy,
        ...overrides.featurePolicy
      },
      permissionsPolicy: {
        ...defaults.permissionsPolicy,
        ...overrides.permissionsPolicy
      },
      crossOriginPolicy: {
        ...defaults.crossOriginPolicy,
        ...overrides.crossOriginPolicy
      }
    };
  }

  private formatCSP(directives: Record<string, string[]>): string {
    return Object.entries(directives)
      .map(([directive, sources]) => {
        if (sources.length === 0) {
          return directive;
        }
        return `${directive} ${sources.join(' ')}`;
      })
      .join('; ');
  }

  private formatFeaturePolicy(policy: Record<string, string[]>): string {
    return Object.entries(policy)
      .map(([feature, allowList]) => {
        if (allowList.length === 0) {
          return `${feature} 'none'`;
        }
        return `${feature} ${allowList.join(' ')}`;
      })
      .join(', ');
  }

  private formatPermissionsPolicy(policy: Record<string, string[]>): string {
    return Object.entries(policy)
      .map(([directive, allowList]) => {
        if (allowList.length === 0) {
          return `${directive}=()`;
        }
        return `${directive}=(${allowList.join(' ')})`;
      })
      .join(', ');
  }

  applyHeaders(reply: FastifyReply): void {
    // Content Security Policy
    const cspHeader = this.options.contentSecurityPolicy.reportOnly 
      ? 'Content-Security-Policy-Report-Only' 
      : 'Content-Security-Policy';
    
    let cspValue = this.formatCSP(this.options.contentSecurityPolicy.directives);
    if (this.options.contentSecurityPolicy.reportUri) {
      cspValue += `; report-uri ${this.options.contentSecurityPolicy.reportUri}`;
    }
    reply.header(cspHeader, cspValue);

    // HTTP Strict Transport Security (HSTS) - only in production
    if (process.env.NODE_ENV === 'production') {
      let hstsValue = `max-age=${this.options.hsts.maxAge}`;
      if (this.options.hsts.includeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      if (this.options.hsts.preload) {
        hstsValue += '; preload';
      }
      reply.header('Strict-Transport-Security', hstsValue);
    }

    // X-Frame-Options
    reply.header('X-Frame-Options', this.options.frameOptions);

    // X-Content-Type-Options
    if (this.options.contentTypeOptions) {
      reply.header('X-Content-Type-Options', 'nosniff');
    }

    // Referrer Policy
    reply.header('Referrer-Policy', this.options.referrerPolicy);

    // X-XSS-Protection (deprecated but still useful for older browsers)
    reply.header('X-XSS-Protection', '1; mode=block');

    // Feature Policy (deprecated, use Permissions Policy)
    const featurePolicyValue = this.formatFeaturePolicy(this.options.featurePolicy);
    if (featurePolicyValue) {
      reply.header('Feature-Policy', featurePolicyValue);
    }

    // Permissions Policy
    const permissionsPolicyValue = this.formatPermissionsPolicy(this.options.permissionsPolicy);
    if (permissionsPolicyValue) {
      reply.header('Permissions-Policy', permissionsPolicyValue);
    }

    // Cross-Origin Policies
    if (this.options.crossOriginPolicy.embedderPolicy) {
      reply.header('Cross-Origin-Embedder-Policy', this.options.crossOriginPolicy.embedderPolicy);
    }
    if (this.options.crossOriginPolicy.openerPolicy) {
      reply.header('Cross-Origin-Opener-Policy', this.options.crossOriginPolicy.openerPolicy);
    }
    if (this.options.crossOriginPolicy.resourcePolicy) {
      reply.header('Cross-Origin-Resource-Policy', this.options.crossOriginPolicy.resourcePolicy);
    }

    // Additional security headers
    reply.header('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive');
    reply.header('X-Download-Options', 'noopen');
    reply.header('X-Permitted-Cross-Domain-Policies', 'none');
    
    // Remove potentially dangerous headers
    reply.removeHeader('X-Powered-By');
    reply.removeHeader('Server');
  }

  middleware() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      this.applyHeaders(reply);
    };
  }
}

const securityHeadersPlugin: FastifyPluginAsync<SecurityHeadersOptions> = async (fastify, options) => {
  const securityHeaders = new SecurityHeaders(options);

  // Apply security headers to all responses
  fastify.addHook('onSend', async (request, reply) => {
    securityHeaders.applyHeaders(reply);
  });

  // Add helper method to fastify instance
  fastify.decorate('setSecurityHeaders', (options: SecurityHeadersOptions) => {
    const customHeaders = new SecurityHeaders(options);
    return customHeaders.middleware();
  });
};

export default fp(securityHeadersPlugin, {
  name: 'security-headers',
  dependencies: []
});

// Export for manual use
export const createSecurityHeadersMiddleware = (options: SecurityHeadersOptions = {}) => {
  const securityHeaders = new SecurityHeaders(options);
  return securityHeaders.middleware();
};

// Preset configurations for different environments
export const SecurityPresets = {
  // Strict preset for production
  strict: {
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'none'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'font-src': ["'self'"],
        'connect-src': ["'self'"],
        'media-src': ["'none'"],
        'object-src': ["'none'"],
        'frame-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'upgrade-insecure-requests': []
      },
      reportOnly: false
    },
    frameOptions: 'DENY' as const,
    referrerPolicy: 'no-referrer'
  },

  // Development preset with more permissive settings
  development: {
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:', 'http:'],
        'font-src': ["'self'", 'https:', 'data:'],
        'connect-src': ["'self'", 'ws:', 'wss:'],
        'media-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-src': ["'self'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"]
      },
      reportOnly: true
    },
    frameOptions: 'SAMEORIGIN' as const
  }
}; 