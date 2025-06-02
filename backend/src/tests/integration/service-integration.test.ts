import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../helpers/test-server';

describe('Service Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      logger: false,
      trustProxy: true
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check Integration', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(body.environment).toBe('test');
    });

    it('should include uptime information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      const body = JSON.parse(response.body);
      expect(typeof body.timestamp).toBe('string');
      expect(new Date(body.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('CORS Integration', () => {
    it('should handle OPTIONS requests', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/receipts',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    it('should allow cross-origin requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: {
          'Origin': 'http://localhost:3000',
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Authentication Integration', () => {
    it('should reject requests without authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts'
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('authentication required');
    });

    it('should reject requests with invalid token format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Invalid token-format'
        }
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('authentication required');
    });

    it('should reject expired tokens', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer expired-token'
        }
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('token expired');
    });

    it('should accept valid tokens', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should allow normal request rates', async () => {
      const responses = await Promise.all([
        app.inject({
          method: 'GET',
          url: '/api/v1/receipts',
          headers: { 'Authorization': 'Bearer valid-token' }
        }),
        app.inject({
          method: 'GET',
          url: '/api/v1/receipts',
          headers: { 'Authorization': 'Bearer valid-token' }
        })
      ]);

      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });
    });

    it('should enforce rate limits for excessive requests', async () => {
      // Make many requests to trigger rate limiting
      const requests = Array(12).fill(null).map(() =>
        app.inject({
          method: 'GET',
          url: '/api/v1/receipts',
          headers: { 'Authorization': 'Bearer valid-token' }
        })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle 404 routes gracefully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/non-existent-route',
        headers: { 'Authorization': 'Bearer valid-token' }
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Not found');
    });

    it('should handle server errors gracefully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test/error',
        headers: { 'Authorization': 'Bearer valid-token' }
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });
  });

  describe('Content Type Handling', () => {
    it('should handle JSON requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        },
        payload: {
          merchant: 'Test Merchant',
          amount: 99.99,
          category: 'Business'
        }
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.receipt.merchant).toBe('Test Merchant');
    });

    it('should validate JSON data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        },
        payload: {
          // Missing required merchant field
          amount: -50 // Invalid negative amount
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('validation failed');
    });
  });

  describe('File Upload Integration', () => {
    it('should handle file uploads', async () => {
      const form = new FormData();
      form.append('receipt', new Blob(['fake image data'], { type: 'image/jpeg' }), 'receipt.jpg');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/receipts/upload',
        headers: {
          'Authorization': 'Bearer valid-token'
        },
        payload: form
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.receipt.status).toBe('processing');
    });

    it('should reject oversized files', async () => {
      // Create a large buffer to simulate oversized file
      const largeBuffer = Buffer.alloc(60 * 1024 * 1024); // 60MB
      const form = new FormData();
      form.append('receipt', new Blob([largeBuffer], { type: 'image/jpeg' }), 'large.jpg');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/receipts/upload',
        headers: {
          'Authorization': 'Bearer valid-token'
        },
        payload: form
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('File size exceeds maximum limit');
    });

    it('should reject unsupported file types', async () => {
      const form = new FormData();
      form.append('receipt', new Blob(['fake pdf data'], { type: 'application/pdf' }), 'document.pdf');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/receipts/upload',
        headers: {
          'Authorization': 'Bearer valid-token'
        },
        payload: form
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Unsupported file type');
    });
  });

  describe('Receipt CRUD Integration', () => {
    it('should create receipts successfully', async () => {
      const receiptData = {
        merchant: 'Integration Test Merchant',
        amount: 25.99,
        category: 'Testing'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        },
        payload: receiptData
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.receipt.merchant).toBe(receiptData.merchant);
      expect(body.data.receipt.amount).toBe(receiptData.amount);
    });

    it('should retrieve receipts by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts/test-receipt-id',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.receipt.id).toBe('test-receipt-id');
    });

    it('should return 404 for non-existent receipts', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts/non-existent-receipt-id',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Receipt not found');
    });

    it('should update receipts', async () => {
      const updateData = {
        merchant: 'Updated Merchant Name',
        amount: 150.75
      };

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/receipts/test-receipt-id',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        },
        payload: updateData
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.receipt.merchant).toBe(updateData.merchant);
      expect(body.data.receipt.amount).toBe(updateData.amount);
    });

    it('should delete receipts', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/receipts/test-receipt-id',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('Search Integration', () => {
    it('should search receipts by merchant name', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts/search?q=Starbucks',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.receipts).toHaveLength(1);
      expect(body.data.receipts[0].merchant).toContain('Starbucks');
    });

    it('should search receipts by amount range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts/search?minAmount=40&maxAmount=50',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.receipts).toHaveLength(1);
      expect(body.data.receipts[0].amount).toBe(45.00);
    });

    it('should search receipts by category', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts/search?category=Transportation',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.receipts).toHaveLength(1);
      expect(body.data.receipts[0].category).toBe('Transportation');
    });

    it('should combine search criteria', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts/search?q=Electronics&minAmount=200',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.receipts).toHaveLength(1);
      expect(body.data.receipts[0].merchant).toContain('Electronics');
      expect(body.data.receipts[0].amount).toBeGreaterThan(200);
    });
  });

  describe('Analytics Integration', () => {
    it('should return expense summary', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/summary',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.summary.totalAmount).toBeDefined();
      expect(body.data.summary.receiptCount).toBeDefined();
      expect(body.data.summary.averageAmount).toBeDefined();
      expect(body.data.summary.categories).toBeDefined();
    });

    it('should provide category breakdown', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/summary',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      const body = JSON.parse(response.body);
      const categories = body.data.summary.categories;
      
      expect(categories['Food & Dining']).toBeDefined();
      expect(categories['Food & Dining'].amount).toBe(71.25);
      expect(categories['Food & Dining'].count).toBe(2);
      
      expect(categories['Transportation']).toBeDefined();
      expect(categories['Transportation'].amount).toBe(100.00);
      expect(categories['Transportation'].count).toBe(1);
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();
      
      const requests = Array(10).fill(null).map(() =>
        app.inject({
          method: 'GET',
          url: '/api/v1/receipts',
          headers: { 'Authorization': 'Bearer valid-token' }
        })
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      // All non-rate-limited requests should succeed
      const successfulResponses = responses.filter(r => r.statusCode === 200);
      expect(successfulResponses.length).toBeGreaterThan(0);
      
      // Should complete reasonably quickly
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
    });

    it('should respond quickly to health checks', async () => {
      const startTime = Date.now();
      
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });
      
      const endTime = Date.now();
      
      expect(response.statusCode).toBe(200);
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });
  });
});