import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

config();

// Environment configuration with validation
export const ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = ENV === 'production';
export const IS_DEVELOPMENT = ENV === 'development';
export const IS_TEST = ENV === 'test';

// Server configuration
export const SERVER_CONFIG = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  trustProxy: process.env.TRUST_PROXY === 'true'
};

// Database configuration
export const DATABASE_CONFIG = {
  connectionString: process.env.DATABASE_URL || '',
  ssl: IS_PRODUCTION ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10)
};

// Redis configuration
export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  tls: IS_PRODUCTION ? {} : undefined
};

// JWT configuration
export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'change-this-secret-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
};

// AWS configuration
export const AWS_CONFIG = {
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3: {
    bucket: process.env.S3_BUCKET || 'receipt-vault-uploads',
    region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1'
  }
};

// WorkOS configuration
export const WORKOS_CONFIG = {
  apiKey: process.env.WORKOS_API_KEY || '',
  clientId: process.env.WORKOS_CLIENT_ID || '',
  redirectUri: process.env.WORKOS_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  organizationId: process.env.WORKOS_ORGANIZATION_ID
};

// Email configuration
export const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  from: process.env.EMAIL_FROM || 'noreply@receiptvault.com'
};

// Google Cloud Vision configuration
export const GOOGLE_VISION_CONFIG = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
};

// Security configuration
export const SECURITY_CONFIG = {
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  sessionSecret: process.env.SESSION_SECRET || 'change-this-session-secret',
  cookieSecret: process.env.COOKIE_SECRET || 'change-this-cookie-secret'
};

// Logging configuration
export const LOGGING_CONFIG = {
  level: process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug'),
  prettyPrint: !IS_PRODUCTION,
  redact: ['password', 'token', 'apiKey', 'secret']
};

// Feature flags
export const FEATURES = {
  enableWorkOsAuth: process.env.ENABLE_WORKOS_AUTH === 'true',
  enableGoogleVision: process.env.ENABLE_GOOGLE_VISION === 'true',
  enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
  enableWebhooks: process.env.ENABLE_WEBHOOKS === 'true'
};

// Validate required configuration
export function validateConfig(): void {
  const errors: string[] = [];

  if (!DATABASE_CONFIG.connectionString) {
    errors.push('DATABASE_URL is required');
  }

  if (IS_PRODUCTION) {
    if (JWT_CONFIG.secret === 'change-this-secret-in-production') {
      errors.push('JWT_SECRET must be changed in production');
    }
    if (!AWS_CONFIG.accessKeyId || !AWS_CONFIG.secretAccessKey) {
      errors.push('AWS credentials are required in production');
    }
    if (!WORKOS_CONFIG.apiKey && FEATURES.enableWorkOsAuth) {
      errors.push('WORKOS_API_KEY is required when WorkOS auth is enabled');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Export all configurations
export default {
  env: ENV,
  isProduction: IS_PRODUCTION,
  isDevelopment: IS_DEVELOPMENT,
  isTest: IS_TEST,
  server: SERVER_CONFIG,
  database: DATABASE_CONFIG,
  redis: REDIS_CONFIG,
  jwt: JWT_CONFIG,
  aws: AWS_CONFIG,
  workos: WORKOS_CONFIG,
  email: EMAIL_CONFIG,
  googleVision: GOOGLE_VISION_CONFIG,
  security: SECURITY_CONFIG,
  logging: LOGGING_CONFIG,
  features: FEATURES
};
