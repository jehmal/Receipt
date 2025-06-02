import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { TestDataFactory, TestDatabaseHelpers, HTTPTestHelpers } from '../fixtures/test-data';

// Import the Fastify app
import { buildApp } from '../../index';

describe('API Integration Tests', () => {
  let app: FastifyInstance;
  let testDb: Pool;
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Initialize test database
    testDb = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/receipt_vault_test'
    });

    // Build Fastify app for testing
    app = buildApp({
      logger: false,
      trustProxy: true
    });

    await app.ready();

    // Create test user and get auth token
    testUser = await TestDatabaseHelpers.createTestUser(testDb);
    authToken = 'test-jwt-token-' + testUser.id;
  });

  afterAll(async () => {
    await TestDatabaseHelpers.cleanupDatabase(testDb);
    await testDb.end();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up receipts before each test
    await testDb.query('DELETE FROM receipts WHERE user_id = $1', [testUser.id]);
  });

  describe('Authentication', () => {
    it('should require authentication for protected endpoints', async () => {
      const response = await request(app.server)
        .get('/api/v1/receipts')
        .expect(401);

      HTTPTestHelpers.assertErrorResponse(response, 401, 'authentication required');
    });

    it('should accept valid JWT tokens', async () => {
      const response = await request(app.server)
        .get('/api/v1/receipts')
        .set(HTTPTestHelpers.createAuthHeaders(authToken))
        .expect(200);

      HTTPTestHelpers.assertSuccessResponse(response);
    });

    it('should reject invalid JWT tokens', async () => {
      const response = await request(app.server)
        .get('/api/v1/receipts')
        .set(HTTPTestHelpers.createAuthHeaders('invalid-token'))
        .expect(401);

      HTTPTestHelpers.assertErrorResponse(response, 401, 'invalid token');
    });

    it('should reject expired JWT tokens', async () => {
      const expiredToken = 'expired.jwt.token';
      const response = await request(app.server)
        .get('/api/v1/receipts')
        .set(HTTPTestHelpers.createAuthHeaders(expiredToken))
        .expect(401);

      HTTPTestHelpers.assertErrorResponse(response, 401, 'token expired');
    });
  });

  describe('Receipt Management', () => {
    describe('GET /api/v1/receipts', () => {
      it('should return empty list when user has no receipts', async () => {
        const response = await request(app.server)
          .get('/api/v1/receipts')
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .expect(200);

        expect(response.body.data.receipts).toHaveLength(0);
        expect(response.body.data.total).toBe(0);
      });

      it('should return user receipts with pagination', async () => {
        // Create test receipts
        await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id);
        await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id);
        await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id);

        const response = await request(app.server)
          .get('/api/v1/receipts?page=1&limit=2')
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .expect(200);

        expect(response.body.data.receipts).toHaveLength(2);
        expect(response.body.data.total).toBe(3);
        expect(response.body.data.page).toBe(1);
        expect(response.body.data.limit).toBe(2);
        expect(response.body.data.totalPages).toBe(2);
      });

      it('should filter receipts by date range', async () => {
        const oldReceipt = await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id, {
          date: new Date('2023-01-01')
        });
        const newReceipt = await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id, {
          date: new Date('2024-01-01')
        });

        const response = await request(app.server)
          .get('/api/v1/receipts?startDate=2024-01-01&endDate=2024-12-31')
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .expect(200);

        expect(response.body.data.receipts).toHaveLength(1);
        expect(response.body.data.receipts[0].id).toBe(newReceipt.id);
      });

      it('should filter receipts by category', async () => {
        const foodReceipt = await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id, {
          category: 'Food & Dining'
        });
        const transportReceipt = await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id, {
          category: 'Transportation'
        });

        const response = await request(app.server)
          .get('/api/v1/receipts?category=Food & Dining')
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .expect(200);

        expect(response.body.data.receipts).toHaveLength(1);
        expect(response.body.data.receipts[0].category).toBe('Food & Dining');
      });
    });

    describe('POST /api/v1/receipts', () => {
      it('should create receipt successfully', async () => {
        const receiptData = TestDataFactory.createReceipt(testUser.id);

        const response = await request(app.server)
          .post('/api/v1/receipts')
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .send(receiptData)
          .expect(201);

        expect(response.body.data.receipt).toMatchObject({
          userId: testUser.id,
          merchant: receiptData.merchant,
          amount: receiptData.amount,
          category: receiptData.category
        });
        expect(response.body.data.receipt.id).toBeValidUUID();
      });

      it('should validate required fields', async () => {
        const invalidReceiptData = {
          // Missing required fields
          amount: 'invalid',
          date: 'invalid-date'
        };

        const response = await request(app.server)
          .post('/api/v1/receipts')
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .send(invalidReceiptData)
          .expect(400);

        HTTPTestHelpers.assertValidationError(response, 'merchant');
        HTTPTestHelpers.assertValidationError(response, 'amount');
      });

      it('should validate amount format', async () => {
        const receiptData = TestDataFactory.createReceipt(testUser.id, {
          amount: 'not-a-number'
        });

        const response = await request(app.server)
          .post('/api/v1/receipts')
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .send(receiptData)
          .expect(400);

        HTTPTestHelpers.assertValidationError(response, 'amount');
      });

      it('should validate currency codes', async () => {
        const receiptData = TestDataFactory.createReceipt(testUser.id, {
          currency: 'INVALID'
        });

        const response = await request(app.server)
          .post('/api/v1/receipts')
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .send(receiptData)
          .expect(400);

        HTTPTestHelpers.assertValidationError(response, 'currency');
      });
    });

    describe('GET /api/v1/receipts/:id', () => {
      it('should return receipt by ID', async () => {
        const receipt = await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id);

        const response = await request(app.server)
          .get(`/api/v1/receipts/${receipt.id}`)
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .expect(200);

        expect(response.body.data.receipt.id).toBe(receipt.id);
        expect(response.body.data.receipt.merchant).toBe(receipt.merchant);
      });

      it('should return 404 for non-existent receipt', async () => {
        const nonExistentId = 'non-existent-receipt-id';

        const response = await request(app.server)
          .get(`/api/v1/receipts/${nonExistentId}`)
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .expect(404);

        HTTPTestHelpers.assertErrorResponse(response, 404, 'Receipt not found');
      });

      it('should not return receipts belonging to other users', async () => {
        const otherUser = await TestDatabaseHelpers.createTestUser(testDb);
        const otherUserReceipt = await TestDatabaseHelpers.createTestReceipt(testDb, otherUser.id);

        const response = await request(app.server)
          .get(`/api/v1/receipts/${otherUserReceipt.id}`)
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .expect(404);

        HTTPTestHelpers.assertErrorResponse(response, 404, 'Receipt not found');
      });
    });

    describe('PUT /api/v1/receipts/:id', () => {
      it('should update receipt successfully', async () => {
        const receipt = await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id);
        const updateData = {
          merchant: 'Updated Merchant',
          amount: 199.99,
          category: 'Updated Category'
        };

        const response = await request(app.server)
          .put(`/api/v1/receipts/${receipt.id}`)
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .send(updateData)
          .expect(200);

        expect(response.body.data.receipt.merchant).toBe(updateData.merchant);
        expect(response.body.data.receipt.amount).toBe(updateData.amount);
        expect(response.body.data.receipt.category).toBe(updateData.category);
      });

      it('should validate update data', async () => {
        const receipt = await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id);
        const invalidUpdateData = {
          amount: -100 // Invalid negative amount
        };

        const response = await request(app.server)
          .put(`/api/v1/receipts/${receipt.id}`)
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .send(invalidUpdateData)
          .expect(400);

        HTTPTestHelpers.assertValidationError(response, 'amount');
      });
    });

    describe('DELETE /api/v1/receipts/:id', () => {
      it('should delete receipt successfully', async () => {
        const receipt = await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id);

        const response = await request(app.server)
          .delete(`/api/v1/receipts/${receipt.id}`)
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify receipt is deleted
        const verifyResponse = await request(app.server)
          .get(`/api/v1/receipts/${receipt.id}`)
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .expect(404);
      });
    });
  });

  describe('File Upload', () => {
    describe('POST /api/v1/receipts/upload', () => {
      it('should upload receipt image successfully', async () => {
        const response = await request(app.server)
          .post('/api/v1/receipts/upload')
          .set(HTTPTestHelpers.createMultipartHeaders(authToken))
          .attach('receipt', Buffer.from('fake-image-data'), 'receipt.jpg')
          .expect(201);

        expect(response.body.data.receipt).toBeDefined();
        expect(response.body.data.receipt.fileUrl).toBeDefined();
        expect(response.body.data.receipt.status).toBe('processing');
      });

      it('should reject files that are too large', async () => {
        const largeBuffer = Buffer.alloc(50 * 1024 * 1024); // 50MB

        const response = await request(app.server)
          .post('/api/v1/receipts/upload')
          .set(HTTPTestHelpers.createMultipartHeaders(authToken))
          .attach('receipt', largeBuffer, 'large-receipt.jpg')
          .expect(400);

        HTTPTestHelpers.assertErrorResponse(response, 400, 'File size exceeds maximum limit');
      });

      it('should reject unsupported file types', async () => {
        const response = await request(app.server)
          .post('/api/v1/receipts/upload')
          .set(HTTPTestHelpers.createMultipartHeaders(authToken))
          .attach('receipt', Buffer.from('fake-pdf-data'), 'document.pdf')
          .expect(400);

        HTTPTestHelpers.assertErrorResponse(response, 400, 'Unsupported file type');
      });

      it('should require authentication', async () => {
        const response = await request(app.server)
          .post('/api/v1/receipts/upload')
          .attach('receipt', Buffer.from('fake-image-data'), 'receipt.jpg')
          .expect(401);

        HTTPTestHelpers.assertErrorResponse(response, 401, 'authentication required');
      });
    });
  });

  describe('Search', () => {
    describe('GET /api/v1/receipts/search', () => {
      beforeEach(async () => {
        // Create test receipts for searching
        await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id, {
          merchant: 'Starbucks Coffee',
          amount: 15.75,
          category: 'Food & Dining'
        });
        await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id, {
          merchant: 'Shell Gas Station',
          amount: 45.00,
          category: 'Transportation'
        });
        await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id, {
          merchant: 'Best Buy Electronics',
          amount: 299.99,
          category: 'Electronics'
        });
      });

      it('should search receipts by merchant name', async () => {
        const response = await request(app.server)
          .get('/api/v1/receipts/search?q=Starbucks')
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .expect(200);

        expect(response.body.data.receipts).toHaveLength(1);
        expect(response.body.data.receipts[0].merchant).toContain('Starbucks');
      });

      it('should search receipts by amount range', async () => {
        const response = await request(app.server)
          .get('/api/v1/receipts/search?minAmount=40&maxAmount=50')
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .expect(200);

        expect(response.body.data.receipts).toHaveLength(1);
        expect(response.body.data.receipts[0].amount).toBe(45.00);
      });

      it('should search receipts by category', async () => {
        const response = await request(app.server)
          .get('/api/v1/receipts/search?category=Transportation')
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .expect(200);

        expect(response.body.data.receipts).toHaveLength(1);
        expect(response.body.data.receipts[0].category).toBe('Transportation');
      });

      it('should combine multiple search criteria', async () => {
        const response = await request(app.server)
          .get('/api/v1/receipts/search?q=Electronics&minAmount=200')
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .expect(200);

        expect(response.body.data.receipts).toHaveLength(1);
        expect(response.body.data.receipts[0].merchant).toContain('Electronics');
        expect(response.body.data.receipts[0].amount).toBeGreaterThan(200);
      });
    });
  });

  describe('Analytics', () => {
    describe('GET /api/v1/analytics/summary', () => {
      beforeEach(async () => {
        // Create test data for analytics
        await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id, {
          amount: 25.50,
          category: 'Food & Dining',
          date: new Date('2024-01-15')
        });
        await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id, {
          amount: 45.75,
          category: 'Food & Dining',
          date: new Date('2024-01-20')
        });
        await TestDatabaseHelpers.createTestReceipt(testDb, testUser.id, {
          amount: 100.00,
          category: 'Transportation',
          date: new Date('2024-02-10')
        });
      });

      it('should return expense summary', async () => {
        const response = await request(app.server)
          .get('/api/v1/analytics/summary')
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .expect(200);

        expect(response.body.data.summary.totalAmount).toBe(171.25);
        expect(response.body.data.summary.receiptCount).toBe(3);
        expect(response.body.data.summary.averageAmount).toBeCloseTo(57.08, 2);
      });

      it('should return category breakdown', async () => {
        const response = await request(app.server)
          .get('/api/v1/analytics/summary')
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .expect(200);

        const categories = response.body.data.summary.categories;
        expect(categories['Food & Dining'].amount).toBe(71.25);
        expect(categories['Food & Dining'].count).toBe(2);
        expect(categories['Transportation'].amount).toBe(100.00);
        expect(categories['Transportation'].count).toBe(1);
      });

      it('should filter summary by date range', async () => {
        const response = await request(app.server)
          .get('/api/v1/analytics/summary?startDate=2024-01-01&endDate=2024-01-31')
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
          .expect(200);

        expect(response.body.data.summary.totalAmount).toBe(71.25);
        expect(response.body.data.summary.receiptCount).toBe(2);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on API endpoints', async () => {
      // Make multiple rapid requests
      const promises = Array(10).fill(null).map(() =>
        request(app.server)
          .get('/api/v1/receipts')
          .set(HTTPTestHelpers.createAuthHeaders(authToken))
      );

      const responses = await Promise.all(promises);
      
      // At least one request should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(app.server)
        .options('/api/v1/receipts')
        .set('Origin', 'https://app.receiptvault.com')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors gracefully', async () => {
      const response = await request(app.server)
        .get('/api/v1/non-existent-endpoint')
        .set(HTTPTestHelpers.createAuthHeaders(authToken))
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Not found');
    });

    it('should handle 500 errors gracefully', async () => {
      // This would need a route that intentionally throws an error
      const response = await request(app.server)
        .get('/api/v1/test/error')
        .set(HTTPTestHelpers.createAuthHeaders(authToken))
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.headers['x-request-id']).toBeDefined();
    });
  });
}); 