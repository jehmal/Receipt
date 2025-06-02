import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../helpers/test-server';

describe('End-to-End User Workflows', () => {
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

  describe('Complete Receipt Management Workflow', () => {
    it('should complete full receipt lifecycle', async () => {
      // Step 1: Create a new receipt
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        },
        payload: {
          merchant: 'E2E Test Restaurant',
          amount: 45.67,
          category: 'Food & Dining',
          description: 'Business lunch',
          date: new Date().toISOString()
        }
      });

      expect(createResponse.statusCode).toBe(201);
      const createdReceipt = JSON.parse(createResponse.body).data.receipt;
      expect(createdReceipt.id).toBeDefined();
      const receiptId = createdReceipt.id;

      // Step 2: Retrieve the created receipt
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/receipts/${receiptId}`,
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(getResponse.statusCode).toBe(200);
      const retrievedReceipt = JSON.parse(getResponse.body).data.receipt;
      expect(retrievedReceipt.merchant).toBe('E2E Test Restaurant');
      expect(retrievedReceipt.amount).toBe(45.67);

      // Step 3: Update the receipt
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/api/v1/receipts/${receiptId}`,
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        },
        payload: {
          merchant: 'Updated E2E Restaurant',
          amount: 52.33,
          description: 'Updated: Business lunch with client'
        }
      });

      expect(updateResponse.statusCode).toBe(200);
      const updatedReceipt = JSON.parse(updateResponse.body).data.receipt;
      expect(updatedReceipt.merchant).toBe('Updated E2E Restaurant');
      expect(updatedReceipt.amount).toBe(52.33);

      // Step 4: Search for the receipt
      const searchResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts/search?q=Updated E2E',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(searchResponse.statusCode).toBe(200);
      const searchResults = JSON.parse(searchResponse.body).data.receipts;
      expect(searchResults.length).toBeGreaterThan(0);

      // Step 5: Delete the receipt
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/v1/receipts/${receiptId}`,
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(deleteResponse.statusCode).toBe(200);
      expect(JSON.parse(deleteResponse.body).success).toBe(true);

      // Step 6: Verify deletion (should return 404)
      const verifyDeleteResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/receipts/${receiptId}`,
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(verifyDeleteResponse.statusCode).toBe(404);
    });

    it('should handle file upload to analytics workflow', async () => {
      // Step 1: Upload a receipt file
      const form = new FormData();
      form.append('receipt', new Blob(['fake receipt image'], { type: 'image/jpeg' }), 'business-receipt.jpg');

      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/receipts/upload',
        headers: {
          'Authorization': 'Bearer valid-token'
        },
        payload: form
      });

      expect(uploadResponse.statusCode).toBe(201);
      const uploadedReceipt = JSON.parse(uploadResponse.body).data.receipt;
      expect(uploadedReceipt.status).toBe('processing');
      expect(uploadedReceipt.fileUrl).toBeDefined();

      // Step 2: Check processing status (simulate)
      // In real scenario, this would check actual processing status
      expect(uploadedReceipt.id).toBeDefined();

      // Step 3: View analytics with the new receipt
      const analyticsResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/summary',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(analyticsResponse.statusCode).toBe(200);
      const analytics = JSON.parse(analyticsResponse.body).data.summary;
      expect(analytics.totalAmount).toBeDefined();
      expect(analytics.receiptCount).toBeDefined();
      expect(analytics.categories).toBeDefined();
    });
  });

  describe('User Authentication Flow', () => {
    it('should handle complete authentication workflow', async () => {
      // Step 1: Attempt access without token (should fail)
      const unauthorizedResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts'
      });

      expect(unauthorizedResponse.statusCode).toBe(401);
      expect(JSON.parse(unauthorizedResponse.body).error).toContain('authentication required');

      // Step 2: Attempt access with invalid token (should fail)
      const invalidTokenResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });

      expect(invalidTokenResponse.statusCode).toBe(401);
      expect(JSON.parse(invalidTokenResponse.body).error).toContain('invalid token');

      // Step 3: Access with valid token (should succeed)
      const validTokenResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(validTokenResponse.statusCode).toBe(200);
      expect(JSON.parse(validTokenResponse.body).success).toBe(true);
    });

    it('should handle token expiration workflow', async () => {
      // Step 1: Use expired token
      const expiredTokenResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer expired-token-123'
        }
      });

      expect(expiredTokenResponse.statusCode).toBe(401);
      expect(JSON.parse(expiredTokenResponse.body).error).toContain('token expired');

      // Step 2: Use fresh token (simulate token refresh)
      const freshTokenResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer fresh-valid-token'
        }
      });

      expect(freshTokenResponse.statusCode).toBe(200);
    });
  });

  describe('Data Validation Workflows', () => {
    it('should validate receipt data throughout workflow', async () => {
      // Step 1: Try to create receipt with invalid data
      const invalidReceiptResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        },
        payload: {
          // Missing merchant
          amount: -50, // Invalid negative amount
          category: '', // Empty category
        }
      });

      expect(invalidReceiptResponse.statusCode).toBe(400);
      expect(JSON.parse(invalidReceiptResponse.body).error).toContain('validation failed');

      // Step 2: Create receipt with valid data
      const validReceiptResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        },
        payload: {
          merchant: 'Valid Merchant',
          amount: 29.99,
          category: 'Business',
          description: 'Valid receipt'
        }
      });

      expect(validReceiptResponse.statusCode).toBe(201);
      const validReceipt = JSON.parse(validReceiptResponse.body).data.receipt;

      // Step 3: Try to update with invalid data
      const invalidUpdateResponse = await app.inject({
        method: 'PUT',
        url: `/api/v1/receipts/${validReceipt.id}`,
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        },
        payload: {
          amount: -100 // Invalid negative amount
        }
      });

      expect(invalidUpdateResponse.statusCode).toBe(400);
      expect(JSON.parse(invalidUpdateResponse.body).error).toContain('validation failed');

      // Step 4: Update with valid data
      const validUpdateResponse = await app.inject({
        method: 'PUT',
        url: `/api/v1/receipts/${validReceipt.id}`,
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        },
        payload: {
          amount: 35.50,
          description: 'Updated valid receipt'
        }
      });

      expect(validUpdateResponse.statusCode).toBe(200);
      const updatedReceipt = JSON.parse(validUpdateResponse.body).data.receipt;
      expect(updatedReceipt.amount).toBe(35.50);
    });
  });

  describe('Search and Filter Workflows', () => {
    it('should support complex search workflows', async () => {
      // Step 1: Search with no results
      const emptySearchResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts/search?q=NonExistentMerchant',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(emptySearchResponse.statusCode).toBe(200);
      const emptyResults = JSON.parse(emptySearchResponse.body).data.receipts;
      expect(emptyResults).toHaveLength(0);

      // Step 2: Search by merchant name
      const merchantSearchResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts/search?q=Starbucks',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(merchantSearchResponse.statusCode).toBe(200);
      const merchantResults = JSON.parse(merchantSearchResponse.body).data.receipts;
      expect(merchantResults.length).toBeGreaterThan(0);
      expect(merchantResults[0].merchant).toContain('Starbucks');

      // Step 3: Filter by amount range
      const amountFilterResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts/search?minAmount=40&maxAmount=50',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(amountFilterResponse.statusCode).toBe(200);
      const amountResults = JSON.parse(amountFilterResponse.body).data.receipts;
      expect(amountResults.length).toBeGreaterThan(0);
      amountResults.forEach((receipt: any) => {
        expect(receipt.amount).toBeGreaterThanOrEqual(40);
        expect(receipt.amount).toBeLessThanOrEqual(50);
      });

      // Step 4: Filter by category
      const categoryFilterResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts/search?category=Transportation',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(categoryFilterResponse.statusCode).toBe(200);
      const categoryResults = JSON.parse(categoryFilterResponse.body).data.receipts;
      expect(categoryResults.length).toBeGreaterThan(0);
      categoryResults.forEach((receipt: any) => {
        expect(receipt.category).toBe('Transportation');
      });

      // Step 5: Combined filters
      const combinedFilterResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts/search?q=Electronics&minAmount=200',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(combinedFilterResponse.statusCode).toBe(200);
      const combinedResults = JSON.parse(combinedFilterResponse.body).data.receipts;
      expect(combinedResults.length).toBeGreaterThan(0);
      combinedResults.forEach((receipt: any) => {
        expect(receipt.merchant).toContain('Electronics');
        expect(receipt.amount).toBeGreaterThan(200);
      });
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should handle and recover from various error scenarios', async () => {
      // Step 1: Server error scenario
      const serverErrorResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/test/error',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(serverErrorResponse.statusCode).toBe(500);
      expect(JSON.parse(serverErrorResponse.body).success).toBe(false);

      // Step 2: Verify system still works after error
      const recoveryResponse = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(recoveryResponse.statusCode).toBe(200);
      expect(JSON.parse(recoveryResponse.body).status).toBe('ok');

      // Step 3: Normal operations should continue working
      const normalOperationResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      expect(normalOperationResponse.statusCode).toBe(200);
      expect(JSON.parse(normalOperationResponse.body).success).toBe(true);

      // Step 4: File upload errors should be handled gracefully
      const oversizedFileResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/receipts/upload',
        headers: {
          'Authorization': 'Bearer valid-token'
        },
        payload: new FormData() // Empty form, should cause validation error
      });

      // Should handle gracefully (either 400 for validation or 401 for auth)
      expect([400, 401]).toContain(oversizedFileResponse.statusCode);

      // Step 5: System should remain responsive
      const finalHealthResponse = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(finalHealthResponse.statusCode).toBe(200);
    });
  });

  describe('Performance Workflows', () => {
    it('should maintain performance across complete user session', async () => {
      const sessionStart = Date.now();
      const operations = [];

      // Simulate a complete user session
      const sessionOperations = [
        // Login check
        { method: 'GET' as const, url: '/api/v1/receipts', desc: 'session_start' },
        
        // Create multiple receipts
        { 
          method: 'POST' as const, 
          url: '/api/v1/receipts',
          payload: { merchant: 'Session Receipt 1', amount: 25.00, category: 'Food' },
          desc: 'create_receipt_1'
        },
        { 
          method: 'POST' as const, 
          url: '/api/v1/receipts',
          payload: { merchant: 'Session Receipt 2', amount: 50.00, category: 'Business' },
          desc: 'create_receipt_2'
        },
        
        // Search operations
        { method: 'GET' as const, url: '/api/v1/receipts/search?q=Session', desc: 'search_receipts' },
        { method: 'GET' as const, url: '/api/v1/receipts/search?category=Food', desc: 'filter_by_category' },
        
        // Analytics check
        { method: 'GET' as const, url: '/api/v1/analytics/summary', desc: 'view_analytics' },
        
        // Final receipt list
        { method: 'GET' as const, url: '/api/v1/receipts', desc: 'final_list' }
      ];

      for (const operation of sessionOperations) {
        const opStart = Date.now();
        
        const response = await app.inject({
          method: operation.method,
          url: operation.url,
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json'
          },
          payload: operation.payload
        });

        const opTime = Date.now() - opStart;
        
        operations.push({
          operation: operation.desc,
          responseTime: opTime,
          statusCode: response.statusCode,
          success: response.statusCode < 400
        });

        // Each operation should complete reasonably quickly
        expect(opTime).toBeLessThan(500);
        
        // Brief pause between operations (simulate user think time)
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const totalSessionTime = Date.now() - sessionStart;

      // Session should complete within reasonable time
      expect(totalSessionTime).toBeLessThan(10000); // 10 seconds

      // All operations should succeed
      const successfulOps = operations.filter(op => op.success);
      expect(successfulOps.length).toBe(operations.length);

      // Average response time should be acceptable
      const avgResponseTime = operations.reduce((sum, op) => sum + op.responseTime, 0) / operations.length;
      expect(avgResponseTime).toBeLessThan(200);
    });
  });
});