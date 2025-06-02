import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../helpers/test-server';
import { db } from '../../database/connection';

describe('API Endpoints Integration Tests', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUserId: string;
  let testCompanyId: string;

  beforeAll(async () => {
    app = await buildApp({
      logger: false,
      trustProxy: true
    });
    await app.ready();

    // Create test user and get auth token
    const authSetup = await setupTestAuthentication();
    authToken = authSetup.token;
    testUserId = authSetup.userId;
    testCompanyId = authSetup.companyId;
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up any test data between tests
    await cleanupReceiptData();
  });

  async function setupTestAuthentication() {
    // Create test company
    const companyResult = await db.query(`
      INSERT INTO companies (id, name, domain, status)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, ['test-company-id', 'Test Company', 'test.com', 'active']);

    const companyId = companyResult.rows[0].id;

    // Create test user
    const userResult = await db.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      'test-user-id',
      'test@example.com',
      '$2a$12$hashedpassword',
      'Test',
      'User',
      companyId,
      'user',
      'active'
    ]);

    const userId = userResult.rows[0].id;

    // Generate auth token (mock implementation)
    const token = 'test-auth-token-123';

    return { token, userId, companyId };
  }

  async function cleanupTestData() {
    await db.query('DELETE FROM receipts WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await db.query('DELETE FROM companies WHERE id = $1', [testCompanyId]);
  }

  async function cleanupReceiptData() {
    await db.query('DELETE FROM receipts WHERE user_id = $1', [testUserId]);
  }

  describe('Health Check Endpoints', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        environment: 'test'
      });
    });

    it('should include required headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.headers).toHaveProperty('content-type');
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should respond quickly', async () => {
      const start = Date.now();
      
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      const duration = Date.now() - start;
      
      expect(response.statusCode).toBe(200);
      expect(duration).toBeLessThan(100); // Should respond in under 100ms
    });
  });

  describe('Authentication Endpoints', () => {
    it('should reject requests without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts'
      });

      expect(response.statusCode).toBe(401);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        success: false,
        error: expect.stringContaining('authentication required')
      });
    });

    it('should reject requests with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'Bearer invalid-token-123'
        }
      });

      expect(response.statusCode).toBe(401);
      
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        success: false,
        error: expect.stringContaining('invalid token')
      });
    });

    it('should accept valid authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should handle malformed Authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': 'NotBearer token-here'
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should handle missing Bearer prefix', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': authToken
        }
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Receipt Management Endpoints', () => {
    describe('GET /api/v1/receipts', () => {
      it('should return empty list for new user', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/receipts',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body).toMatchObject({
          success: true,
          data: {
            receipts: [],
            total: 0,
            totalPages: 0
          }
        });
      });

      it('should return receipts for user', async () => {
        // Create test receipt
        await db.query(`
          INSERT INTO receipts (
            id, user_id, original_filename, file_path, file_size, file_hash, 
            mime_type, status, vendor_name, total_amount, currency, category
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          'test-receipt-1',
          testUserId,
          'receipt1.jpg',
          '/uploads/receipt1.jpg',
          1024,
          'hash123',
          'image/jpeg',
          'processed',
          'Test Vendor',
          25.99,
          'USD',
          'Food & Dining'
        ]);

        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/receipts',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.receipts).toHaveLength(1);
        expect(body.data.receipts[0]).toMatchObject({
          id: 'test-receipt-1',
          userId: testUserId,
          vendorName: 'Test Vendor',
          totalAmount: 25.99,
          currency: 'USD'
        });
      });

      it('should support pagination', async () => {
        // Create multiple test receipts
        for (let i = 1; i <= 5; i++) {
          await db.query(`
            INSERT INTO receipts (
              id, user_id, original_filename, file_path, file_size, file_hash, 
              mime_type, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            `test-receipt-${i}`,
            testUserId,
            `receipt${i}.jpg`,
            `/uploads/receipt${i}.jpg`,
            1024,
            `hash${i}`,
            'image/jpeg',
            'processed',
            new Date(Date.now() - i * 1000) // Different timestamps
          ]);
        }

        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/receipts?page=1&limit=3',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.data.receipts).toHaveLength(3);
        expect(body.data.total).toBe(5);
        expect(body.data.totalPages).toBe(2);
      });

      it('should support filtering by category', async () => {
        // Create receipts with different categories
        await db.query(`
          INSERT INTO receipts (
            id, user_id, original_filename, file_path, file_size, file_hash, 
            mime_type, status, category
          ) VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8, $9),
          ($10, $11, $12, $13, $14, $15, $16, $17, $18)
        `, [
          'receipt-food', testUserId, 'food.jpg', '/uploads/food.jpg', 1024, 'hash1', 'image/jpeg', 'processed', 'Food & Dining',
          'receipt-business', testUserId, 'business.jpg', '/uploads/business.jpg', 1024, 'hash2', 'image/jpeg', 'processed', 'Business'
        ]);

        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/receipts?category=Food%20%26%20Dining',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.data.receipts).toHaveLength(1);
        expect(body.data.receipts[0].category).toBe('Food & Dining');
      });

      it('should support date range filtering', async () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        await db.query(`
          INSERT INTO receipts (
            id, user_id, original_filename, file_path, file_size, file_hash, 
            mime_type, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          'receipt-today',
          testUserId,
          'today.jpg',
          '/uploads/today.jpg',
          1024,
          'hash1',
          'image/jpeg',
          'processed',
          now
        ]);

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/receipts?startDate=${yesterday.toISOString()}&endDate=${tomorrow.toISOString()}`,
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.data.receipts).toHaveLength(1);
        expect(body.data.receipts[0].id).toBe('receipt-today');
      });
    });

    describe('POST /api/v1/receipts', () => {
      it('should create receipt with valid data', async () => {
        const receiptData = {
          merchant: 'Test Restaurant',
          amount: 45.67,
          category: 'Food & Dining',
          description: 'Business lunch',
          date: new Date().toISOString()
        };

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/receipts',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          payload: receiptData
        });

        expect(response.statusCode).toBe(201);
        
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.receipt).toMatchObject({
          id: expect.any(String),
          userId: testUserId,
          merchant: 'Test Restaurant',
          amount: 45.67,
          category: 'Food & Dining'
        });

        // Verify receipt was saved to database
        const dbResult = await db.query(
          'SELECT * FROM receipts WHERE id = $1',
          [body.data.receipt.id]
        );
        expect(dbResult.rows).toHaveLength(1);
      });

      it('should validate required fields', async () => {
        const invalidData = {
          // Missing merchant
          amount: 25.00
        };

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/receipts',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          payload: invalidData
        });

        expect(response.statusCode).toBe(400);
        
        const body = JSON.parse(response.body);
        expect(body.success).toBe(false);
        expect(body.error).toContain('validation failed');
      });

      it('should validate amount is positive', async () => {
        const invalidData = {
          merchant: 'Test Vendor',
          amount: -10.00
        };

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/receipts',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          payload: invalidData
        });

        expect(response.statusCode).toBe(400);
        
        const body = JSON.parse(response.body);
        expect(body.error).toContain('validation failed');
      });

      it('should handle malformed JSON', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/receipts',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          payload: '{"invalid": json}'
        });

        expect(response.statusCode).toBe(400);
      });
    });

    describe('GET /api/v1/receipts/:id', () => {
      let receiptId: string;

      beforeEach(async () => {
        const result = await db.query(`
          INSERT INTO receipts (
            id, user_id, original_filename, file_path, file_size, file_hash, 
            mime_type, status, vendor_name, total_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `, [
          'test-receipt-detail',
          testUserId,
          'detail.jpg',
          '/uploads/detail.jpg',
          1024,
          'detailhash',
          'image/jpeg',
          'processed',
          'Detail Vendor',
          99.99
        ]);
        receiptId = result.rows[0].id;
      });

      it('should return receipt details', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/receipts/${receiptId}`,
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.receipt).toMatchObject({
          id: receiptId,
          userId: testUserId,
          vendorName: 'Detail Vendor',
          totalAmount: 99.99
        });
      });

      it('should return 404 for non-existent receipt', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/receipts/non-existent-id',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(404);
        
        const body = JSON.parse(response.body);
        expect(body.success).toBe(false);
        expect(body.error).toContain('Receipt not found');
      });

      it('should not return receipts from other users', async () => {
        // Create another user's receipt
        await db.query(`
          INSERT INTO receipts (
            id, user_id, original_filename, file_path, file_size, file_hash, 
            mime_type, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          'other-user-receipt',
          'other-user-id',
          'other.jpg',
          '/uploads/other.jpg',
          1024,
          'otherhash',
          'image/jpeg',
          'processed'
        ]);

        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/receipts/other-user-receipt',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(404);
      });
    });

    describe('PUT /api/v1/receipts/:id', () => {
      let receiptId: string;

      beforeEach(async () => {
        const result = await db.query(`
          INSERT INTO receipts (
            id, user_id, original_filename, file_path, file_size, file_hash, 
            mime_type, status, vendor_name, total_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `, [
          'test-receipt-update',
          testUserId,
          'update.jpg',
          '/uploads/update.jpg',
          1024,
          'updatehash',
          'image/jpeg',
          'processed',
          'Original Vendor',
          50.00
        ]);
        receiptId = result.rows[0].id;
      });

      it('should update receipt with valid data', async () => {
        const updateData = {
          vendorName: 'Updated Vendor',
          totalAmount: 75.99,
          category: 'Business',
          description: 'Updated description'
        };

        const response = await app.inject({
          method: 'PUT',
          url: `/api/v1/receipts/${receiptId}`,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          payload: updateData
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.receipt).toMatchObject({
          id: receiptId,
          vendorName: 'Updated Vendor',
          totalAmount: 75.99,
          category: 'Business',
          description: 'Updated description'
        });

        // Verify database was updated
        const dbResult = await db.query(
          'SELECT vendor_name, total_amount, category, description FROM receipts WHERE id = $1',
          [receiptId]
        );
        expect(dbResult.rows[0]).toMatchObject({
          vendor_name: 'Updated Vendor',
          total_amount: '75.99',
          category: 'Business',
          description: 'Updated description'
        });
      });

      it('should allow partial updates', async () => {
        const updateData = {
          vendorName: 'Partially Updated Vendor'
        };

        const response = await app.inject({
          method: 'PUT',
          url: `/api/v1/receipts/${receiptId}`,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          payload: updateData
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.data.receipt.vendorName).toBe('Partially Updated Vendor');
        expect(body.data.receipt.totalAmount).toBe(50.00); // Should remain unchanged
      });

      it('should validate update data', async () => {
        const invalidData = {
          totalAmount: -25.00 // Negative amount
        };

        const response = await app.inject({
          method: 'PUT',
          url: `/api/v1/receipts/${receiptId}`,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          payload: invalidData
        });

        expect(response.statusCode).toBe(400);
        
        const body = JSON.parse(response.body);
        expect(body.error).toContain('validation failed');
      });

      it('should return 404 for non-existent receipt', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: '/api/v1/receipts/non-existent-id',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          payload: { vendorName: 'Updated' }
        });

        expect(response.statusCode).toBe(404);
      });
    });

    describe('DELETE /api/v1/receipts/:id', () => {
      let receiptId: string;

      beforeEach(async () => {
        const result = await db.query(`
          INSERT INTO receipts (
            id, user_id, original_filename, file_path, file_size, file_hash, 
            mime_type, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [
          'test-receipt-delete',
          testUserId,
          'delete.jpg',
          '/uploads/delete.jpg',
          1024,
          'deletehash',
          'image/jpeg',
          'processed'
        ]);
        receiptId = result.rows[0].id;
      });

      it('should delete receipt', async () => {
        const response = await app.inject({
          method: 'DELETE',
          url: `/api/v1/receipts/${receiptId}`,
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);

        // Verify receipt was soft-deleted
        const dbResult = await db.query(
          'SELECT deleted_at FROM receipts WHERE id = $1',
          [receiptId]
        );
        expect(dbResult.rows[0].deleted_at).not.toBeNull();
      });

      it('should return 404 for non-existent receipt', async () => {
        const response = await app.inject({
          method: 'DELETE',
          url: '/api/v1/receipts/non-existent-id',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(404);
      });

      it('should not delete receipts from other users', async () => {
        // Create another user's receipt
        await db.query(`
          INSERT INTO receipts (
            id, user_id, original_filename, file_path, file_size, file_hash, 
            mime_type, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          'other-user-delete-receipt',
          'other-user-id',
          'other-delete.jpg',
          '/uploads/other-delete.jpg',
          1024,
          'otherdelethash',
          'image/jpeg',
          'processed'
        ]);

        const response = await app.inject({
          method: 'DELETE',
          url: '/api/v1/receipts/other-user-delete-receipt',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(404);
      });
    });
  });

  describe('Search Endpoints', () => {
    beforeEach(async () => {
      // Create test data for search
      await db.query(`
        INSERT INTO receipts (
          id, user_id, original_filename, file_path, file_size, file_hash, 
          mime_type, status, vendor_name, total_amount, category, ocr_text
        ) VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12),
        ($13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24),
        ($25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36)
      `, [
        'search-receipt-1', testUserId, 'coffee.jpg', '/uploads/coffee.jpg', 1024, 'hash1', 'image/jpeg', 'processed', 'Starbucks', 4.50, 'Food & Dining', 'STARBUCKS COFFEE TOTAL $4.50',
        'search-receipt-2', testUserId, 'gas.jpg', '/uploads/gas.jpg', 1024, 'hash2', 'image/jpeg', 'processed', 'Shell Gas Station', 45.00, 'Transportation', 'SHELL GAS STATION FUEL $45.00',
        'search-receipt-3', testUserId, 'office.jpg', '/uploads/office.jpg', 1024, 'hash3', 'image/jpeg', 'processed', 'Office Depot', 25.99, 'Business', 'OFFICE DEPOT SUPPLIES $25.99'
      ]);
    });

    describe('GET /api/v1/receipts/search', () => {
      it('should search by merchant name', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/receipts/search?q=Starbucks',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.receipts).toHaveLength(1);
        expect(body.data.receipts[0].vendorName).toBe('Starbucks');
      });

      it('should search by OCR text', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/receipts/search?q=COFFEE',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.data.receipts).toHaveLength(1);
        expect(body.data.receipts[0].ocrText).toContain('COFFEE');
      });

      it('should filter by amount range', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/receipts/search?minAmount=20&maxAmount=50',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.data.receipts).toHaveLength(2); // Shell ($45) and Office Depot ($25.99)
        body.data.receipts.forEach((receipt: any) => {
          expect(receipt.totalAmount).toBeGreaterThanOrEqual(20);
          expect(receipt.totalAmount).toBeLessThanOrEqual(50);
        });
      });

      it('should filter by category', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/receipts/search?category=Transportation',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.data.receipts).toHaveLength(1);
        expect(body.data.receipts[0].category).toBe('Transportation');
      });

      it('should combine multiple search criteria', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/receipts/search?q=OFFICE&category=Business&minAmount=20',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.data.receipts).toHaveLength(1);
        expect(body.data.receipts[0].vendorName).toBe('Office Depot');
      });

      it('should return empty results for no matches', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/receipts/search?q=NonExistentVendor',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.data.receipts).toHaveLength(0);
      });

      it('should handle special characters in search', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/receipts/search?q=$4.50',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.data.receipts).toHaveLength(1);
      });
    });
  });

  describe('File Upload Endpoints', () => {
    describe('POST /api/v1/receipts/upload', () => {
      it('should upload receipt file', async () => {
        const fakeImageBuffer = Buffer.from('fake-image-data');
        
        // Create form data
        const form = new FormData();
        form.append('receipt', new Blob([fakeImageBuffer], { type: 'image/jpeg' }), 'test-receipt.jpg');

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/receipts/upload',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          payload: form
        });

        expect(response.statusCode).toBe(201);
        
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.receipt).toMatchObject({
          id: expect.any(String),
          userId: testUserId,
          status: 'processing',
          originalFilename: 'test-receipt.jpg',
          fileUrl: expect.any(String)
        });
      });

      it('should reject oversized files', async () => {
        const largeBuffer = Buffer.alloc(60 * 1024 * 1024); // 60MB
        
        const form = new FormData();
        form.append('receipt', new Blob([largeBuffer], { type: 'image/jpeg' }), 'large-file.jpg');

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/receipts/upload',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          payload: form
        });

        expect(response.statusCode).toBe(400);
        
        const body = JSON.parse(response.body);
        expect(body.error).toContain('File size exceeds maximum limit');
      });

      it('should reject unsupported file types', async () => {
        const form = new FormData();
        form.append('receipt', new Blob(['fake-pdf-data'], { type: 'application/pdf' }), 'document.pdf');

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/receipts/upload',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          payload: form
        });

        expect(response.statusCode).toBe(400);
        
        const body = JSON.parse(response.body);
        expect(body.error).toContain('Unsupported file type');
      });

      it('should require authentication for file upload', async () => {
        const form = new FormData();
        form.append('receipt', new Blob(['data'], { type: 'image/jpeg' }), 'test.jpg');

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/receipts/upload',
          payload: form
        });

        expect(response.statusCode).toBe(401);
      });
    });
  });

  describe('Analytics Endpoints', () => {
    beforeEach(async () => {
      // Create test receipts for analytics
      await db.query(`
        INSERT INTO receipts (
          id, user_id, original_filename, file_path, file_size, file_hash, 
          mime_type, status, total_amount, category
        ) VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10),
        ($11, $12, $13, $14, $15, $16, $17, $18, $19, $20),
        ($21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
      `, [
        'analytics-1', testUserId, 'a1.jpg', '/uploads/a1.jpg', 1024, 'hash1', 'image/jpeg', 'processed', 50.00, 'Food & Dining',
        'analytics-2', testUserId, 'a2.jpg', '/uploads/a2.jpg', 1024, 'hash2', 'image/jpeg', 'processed', 100.00, 'Food & Dining',
        'analytics-3', testUserId, 'a3.jpg', '/uploads/a3.jpg', 1024, 'hash3', 'image/jpeg', 'processed', 75.00, 'Business'
      ]);
    });

    describe('GET /api/v1/analytics/summary', () => {
      it('should return expense summary', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/analytics/summary',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.summary).toMatchObject({
          totalAmount: expect.any(Number),
          receiptCount: 3,
          averageAmount: expect.any(Number),
          categories: expect.any(Object)
        });

        expect(body.data.summary.totalAmount).toBe(225.00);
        expect(body.data.summary.averageAmount).toBe(75.00);
      });

      it('should provide category breakdown', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/analytics/summary',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        const body = JSON.parse(response.body);
        const categories = body.data.summary.categories;

        expect(categories['Food & Dining']).toMatchObject({
          amount: 150.00,
          count: 2
        });

        expect(categories['Business']).toMatchObject({
          amount: 75.00,
          count: 1
        });
      });

      it('should return empty analytics for users with no receipts', async () => {
        // Clean up test receipts
        await cleanupReceiptData();

        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/analytics/summary',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.statusCode).toBe(200);
        
        const body = JSON.parse(response.body);
        expect(body.data.summary).toMatchObject({
          totalAmount: 0,
          receiptCount: 0,
          averageAmount: 0,
          categories: {}
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/non-existent-endpoint',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(404);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Not found');
    });

    it('should handle server errors gracefully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test/error', // This should trigger a 500 error
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(500);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });

    it('should maintain API after error', async () => {
      // Trigger error
      await app.inject({
        method: 'GET',
        url: '/api/v1/test/error',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      // Verify API still works
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = Array(15).fill(null).map(() =>
        app.inject({
          method: 'GET',
          url: '/api/v1/receipts',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        })
      );

      const responses = await Promise.all(requests);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should include rate limit headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Origin': 'http://localhost:3000'
        }
      });

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    it('should handle OPTIONS preflight requests', async () => {
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
  });
});