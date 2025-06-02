import { config } from 'dotenv';
import { Pool } from 'pg';

// Load test environment variables
config({ path: 'env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock external services
jest.mock('@workos-inc/node');
jest.mock('aws-sdk');
jest.mock('@google-cloud/vision');

// Database setup for tests
let testDb: Pool;

beforeAll(async () => {
  // Create test database connection
  testDb = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/receipt_vault_test'
  });

  // Run migrations
  try {
    await testDb.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  } catch (error) {
    console.error('Failed to setup test database:', error);
  }
});

afterAll(async () => {
  // Clean up database connection
  if (testDb) {
    await testDb.end();
  }
});

// Global test utilities
global.testUtils = {
  generateTestUser: () => ({
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    organizationId: 'test-org-123'
  }),

  generateTestReceipt: () => ({
    id: 'test-receipt-123',
    userId: 'test-user-123',
    merchant: 'Test Merchant',
    amount: 99.99,
    date: new Date().toISOString(),
    category: 'Food & Dining',
    description: 'Test purchase',
    tags: ['test', 'sample']
  }),

  generateAuthToken: (userId: string) => {
    // Mock JWT token for testing
    return 'test-jwt-token-' + userId;
  }
};

// Extend Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid UUID`
        : `expected ${received} to be a valid UUID`
    };
  },

  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be within range ${floor} - ${ceiling}`
        : `expected ${received} to be within range ${floor} - ${ceiling}`
    };
  }
});

// TypeScript declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }

  var testUtils: {
    generateTestUser: () => any;
    generateTestReceipt: () => any;
    generateAuthToken: (userId: string) => string;
  };
}
