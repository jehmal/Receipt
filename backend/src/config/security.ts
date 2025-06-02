import { 
  initializeSecretsManager, 
  getSecretsManager, 
  migrateSecret, 
  type SecretsManagerConfig 
} from '@/security/secrets-manager';
import { SecurityPresets, type SecurityHeadersOptions } from '@/security/security-headers';
import { type CSRFOptions } from '@/security/csrf-protection';

export interface SecurityConfig {
  secrets: SecretsManagerConfig;
  headers: SecurityHeadersOptions;
  csrf: CSRFOptions;
  rateLimit: {
    windowMs: number;
    max: number;
    message: string;
    standardHeaders: boolean;
    legacyHeaders: boolean;
  };
  session: {
    cookieName: string;
    secret: string;
    maxAge: number;
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };
}

// Environment-based security configuration
const getSecurityConfig = (): SecurityConfig => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  return {
    secrets: {
      provider: process.env.SECRETS_PROVIDER === 'vault' ? 'vault' : 'aws',
      awsRegion: process.env.AWS_REGION || 'us-east-1',
      vaultEndpoint: process.env.VAULT_ENDPOINT || 'http://localhost:8200',
      vaultToken: process.env.VAULT_TOKEN
    },

    headers: isProduction 
      ? SecurityPresets.strict 
      : SecurityPresets.development,

    csrf: {
      cookieName: '_csrf',
      headerName: 'x-csrf-token',
      secretLength: 18,
      saltLength: 8,
      ignoreMethods: ['GET', 'HEAD', 'OPTIONS']
    },

    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: isProduction ? 100 : 1000, // Stricter limits in production
      message: 'Rate limit exceeded. Please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    },

    session: {
      cookieName: 'receipt_vault_session',
      secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: isProduction,
      httpOnly: true,
      sameSite: 'strict'
    }
  };
};

// Initialize secrets manager
export const initializeSecurity = async (): Promise<void> => {
  const config = getSecurityConfig();
  
  try {
    initializeSecretsManager(config.secrets);
    console.log('✅ Secrets manager initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize secrets manager:', error);
    
    // In development, we can continue without secrets manager
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Continuing with environment variables in development mode');
    } else {
      throw error;
    }
  }
};

// Secure configuration getters with fallbacks
export const getSecureConfig = async () => {
  const secretsManager = getSecretsManager();
  
  return {
    // Database
    getDatabaseUrl: () => migrateSecret('DATABASE_URL', 'database/connection-url'),
    
    // JWT
    getJwtSecret: () => migrateSecret('JWT_SECRET', 'auth/jwt-secret'),
    
    // WorkOS
    getWorkOsApiKey: () => migrateSecret('WORKOS_API_KEY', 'auth/workos-api-key'),
    getWorkOsClientId: () => migrateSecret('WORKOS_CLIENT_ID', 'auth/workos-client-id'),
    
    // AWS
    getAwsAccessKey: () => migrateSecret('AWS_ACCESS_KEY_ID', 'aws/access-key'),
    getAwsSecretKey: () => migrateSecret('AWS_SECRET_ACCESS_KEY', 'aws/secret-key'),
    
    // Google Cloud
    getGoogleCredentials: () => migrateSecret('GOOGLE_APPLICATION_CREDENTIALS', 'google/service-account'),
    
    // Email
    getSmtpUser: () => migrateSecret('SMTP_USER', 'email/smtp-user'),
    getSmtpPass: () => migrateSecret('SMTP_PASS', 'email/smtp-password'),
    
    // Redis
    getRedisPassword: () => migrateSecret('REDIS_PASSWORD', 'redis/password'),
    
    // Session
    getSessionSecret: () => migrateSecret('SESSION_SECRET', 'session/secret'),
    getCookieSecret: () => migrateSecret('COOKIE_SECRET', 'session/cookie-secret')
  };
};

// Security validation
export const validateSecurityConfig = (): void => {
  const errors: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // Production-specific validations
    if (!process.env.SECRETS_PROVIDER || process.env.SECRETS_PROVIDER === 'env') {
      errors.push('SECRETS_PROVIDER must be set to "aws" or "vault" in production');
    }

    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'change-this-secret-in-production') {
      errors.push('SESSION_SECRET must be set to a secure value in production');
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-this-secret-in-production') {
      errors.push('JWT_SECRET must be set to a secure value in production');
    }

    // SSL/TLS validation
    if (!process.env.FORCE_HTTPS && !process.env.SSL_CERT) {
      errors.push('HTTPS must be enforced in production (set FORCE_HTTPS=true or provide SSL_CERT)');
    }
  }

  // General validations
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  if (errors.length > 0) {
    throw new Error(`Security configuration validation failed:\n${errors.join('\n')}`);
  }
};

// Security headers for different route types
export const getRouteSecurityConfig = () => ({
  // API routes - strict CSP for JSON responses
  api: {
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'none'"],
        'script-src': ["'none'"],
        'style-src': ["'none'"],
        'img-src': ["'none'"],
        'font-src': ["'none'"],
        'connect-src': ["'none'"],
        'media-src': ["'none'"],
        'object-src': ["'none'"],
        'frame-src': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"]
      }
    }
  },

  // Upload routes - allow specific content types
  upload: {
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'none'"],
        'style-src': ["'none'"],
        'img-src': ["'self'", 'data:'],
        'font-src': ["'none'"],
        'connect-src': ["'self'"],
        'media-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"]
      }
    }
  },

  // Public routes - more permissive
  public: {
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'https:'],
        'connect-src': ["'self'"],
        'media-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"]
      }
    }
  }
});

export { getSecurityConfig };
export default getSecurityConfig(); 