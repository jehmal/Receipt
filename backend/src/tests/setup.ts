import 'jest-extended';
import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.join(__dirname, '../../.env.test') });

// Mock external services globally
jest.mock('@workos-inc/node', () => ({
  WorkOS: jest.fn(() => ({
    userManagement: {
      authenticateWithPassword: jest.fn(),
      getUser: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
    },
    organizations: {
      listOrganizations: jest.fn(),
      getOrganization: jest.fn(),
    },
    sso: {
      getAuthorizationUrl: jest.fn(),
      getProfile: jest.fn(),
    },
  })),
}));

jest.mock('@google-cloud/vision', () => ({
  ImageAnnotatorClient: jest.fn(() => ({
    textDetection: jest.fn().mockResolvedValue([
      {
        fullTextAnnotation: {
          text: 'RECEIPT\nStarbucks\nCoffee $4.50\nTax $0.36\nTotal $4.86',
        },
      },
    ]),
  })),
}));

jest.mock('aws-sdk', () => ({
  SecretsManager: jest.fn(() => ({
    getSecretValue: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({
          username: 'test-user',
          password: 'test-password',
        }),
      }),
    }),
    createSecret: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ ARN: 'test-arn' }),
    }),
    updateSecret: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ ARN: 'test-arn' }),
    }),
  })),
  S3: jest.fn(() => ({
    upload: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Location: 'https://test-bucket.s3.amazonaws.com/test-file.jpg',
        Key: 'test-file.jpg',
      }),
    }),
    deleteObject: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    }),
  })),
}));

jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id',
      accepted: ['test@example.com'],
    }),
  })),
}));


jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    flushall: jest.fn(),
    disconnect: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
    pipeline: jest.fn(() => ({
      set: jest.fn(),
      expire: jest.fn(),
      exec: jest.fn().mockResolvedValue([]),
    })),
  };
  return jest.fn(() => mockRedis);
});

// Mock database connection
jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn(),
    getPool: jest.fn(),
    closePool: jest.fn(),
  },
  Database: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    getPool: jest.fn(),
    closePool: jest.fn(),
  })),
  query: jest.fn(),
  getPool: jest.fn(),
  closePool: jest.fn(),
}));

// Mock JWT service
jest.mock('../config/jwt', () => ({
  jwtService: {
    generateTokenPair: jest.fn().mockReturnValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 900,
      refreshExpiresIn: 2592000,
    }),
    verifyToken: jest.fn().mockReturnValue({
      sub: 'test-user-id',
      email: 'test@example.com',
      sessionId: 'test-session-id',
      type: 'access',
    }),
    decodeTokenWithoutVerification: jest.fn().mockReturnValue({
      sub: 'test-user-id',
      email: 'test@example.com',
      sessionId: 'test-session-id',
      type: 'refresh',
    }),
    isTokenExpired: jest.fn().mockReturnValue(false),
  },
  TokenPair: {},
  DeviceInfo: {},
}));

// Mock Redis config
jest.mock('../config/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    on: jest.fn(),
    quit: jest.fn(),
  },
  getRedis: jest.fn(),
  closeRedis: jest.fn(),
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    audit: jest.fn(),
    security: jest.fn(),
  },
}));

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  
  // Use test database
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/receipt_vault_test';
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
  
  // Mock secrets for testing
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
  process.env.WORKOS_API_KEY = 'test-workos-api-key';
  process.env.WORKOS_CLIENT_ID = 'test-workos-client-id';
  process.env.WORKOS_COOKIE_PASSWORD = 'test-cookie-password-32-chars-long';
  
  // Disable external services in tests
  process.env.GOOGLE_CLOUD_API_KEY = 'test-google-api-key';
  process.env.AWS_ACCESS_KEY_ID = 'test-aws-key';
  process.env.AWS_SECRET_ACCESS_KEY = 'test-aws-secret';
});

// Add custom matchers
expect.extend({
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },
});

// Extend Jest matchers interface
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
    }
  }
}

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities
global.testUtils = {
  createMockUser: () => ({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    organizationId: 'test-org-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  
  createMockReceipt: () => ({
    id: 'test-receipt-id',
    userId: 'test-user-id',
    merchant: 'Test Merchant',
    amount: 99.99,
    currency: 'USD',
    category: 'Business',
    description: 'Test receipt',
    date: new Date(),
    fileUrl: 'https://test.com/receipt.jpg',
    ocrData: {
      text: 'RECEIPT\nTest Merchant\nAmount: $99.99',
      confidence: 0.95,
    },
    status: 'processed',
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  
  createMockOrganization: () => ({
    id: 'test-org-id',
    name: 'Test Organization',
    domain: 'test.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Test database helpers
  cleanupDatabase: async () => {
    console.log('Database cleanup - to be implemented');
  },
  
  seedTestData: async () => {
    console.log('Test data seeding - to be implemented');
  },
};

// Test app factory
export const createTestApp = async () => {
  // Mock implementation for testing
  return {
    inject: jest.fn(),
    listen: jest.fn(),
    close: jest.fn(),
    ready: jest.fn(),
  };
};

// Clean up between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Set test timeout
jest.setTimeout(30000);