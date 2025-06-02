import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from '../setup';
import { createTestDatabase } from '../fixtures/database';
import { ReceiptService } from '../../services/receipts';
import { OCRService } from '../../services/ocr';

describe('Financial Transaction Integrity Testing', () => {
  let app: any;
  let testDb: any;
  let authToken: string;
  let receiptService: ReceiptService;
  let ocrService: OCRService;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    app = await createTestApp(testDb);
    receiptService = new ReceiptService(testDb);
    ocrService = new OCRService();
    
    // Create test user and get auth token
    const response = await request(app.server)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User'
      });
    
    authToken = response.body.authToken;
  });

  afterAll(async () => {
    await testDb.close();
    await app.close();
  });

  beforeEach(async () => {
    // Start transaction for each test
    await testDb.query('BEGIN');
  });

  afterEach(async () => {
    // Rollback transaction after each test
    await testDb.query('ROLLBACK');
  });

  describe('Atomic Receipt Processing', () => {
    it('should rollback receipt creation on OCR processing failure', async () => {
      // Mock OCR service to simulate failure
      const originalProcessImage = ocrService.processImage;
      ocrService.processImage = jest.fn().mockRejectedValue(new Error('OCR Service Unavailable'));

      const receiptData = {
        id: 'test-receipt-1',
        userId: 'test-user-1',
        totalAmount: 123.45,
        imageData: 'base64-encoded-image-data'
      };

      // Attempt to process receipt
      await expect(
        receiptService.processReceiptWithTransaction(receiptData)
      ).rejects.toThrow('OCR Service Unavailable');

      // Verify receipt was not saved to database
      const savedReceipt = await testDb.query(
        'SELECT * FROM receipts WHERE id = $1',
        [receiptData.id]
      );
      expect(savedReceipt.rows).toHaveLength(0);

      // Verify no OCR data was saved
      const ocrData = await testDb.query(
        'SELECT * FROM receipt_ocr_data WHERE receipt_id = $1',
        [receiptData.id]
      );
      expect(ocrData.rows).toHaveLength(0);

      // Restore original function
      ocrService.processImage = originalProcessImage;
    });

    it('should rollback on database constraint violations', async () => {
      const receiptData = {
        id: 'test-receipt-2',
        userId: 'non-existent-user', // This should violate foreign key constraint
        totalAmount: 123.45,
        imageData: 'base64-encoded-image-data'
      };

      await expect(
        receiptService.processReceiptWithTransaction(receiptData)
      ).rejects.toThrow();

      // Verify no partial data was saved
      const savedReceipt = await testDb.query(
        'SELECT * FROM receipts WHERE id = $1',
        [receiptData.id]
      );
      expect(savedReceipt.rows).toHaveLength(0);
    });

    it('should handle partial OCR failure gracefully', async () => {
      // Mock OCR to return partial data
      const originalProcessImage = ocrService.processImage;
      ocrService.processImage = jest.fn().mockResolvedValue({
        totalAmount: null, // Failed to extract total
        vendor: 'Test Vendor',
        date: '2024-01-15',
        confidence: 0.3 // Low confidence
      });

      const receiptData = {
        id: 'test-receipt-3',
        userId: 'test-user-1',
        totalAmount: 123.45,
        imageData: 'base64-encoded-image-data'
      };

      // Process should succeed but with partial data
      const result = await receiptService.processReceiptWithTransaction(receiptData);
      
      expect(result.success).toBe(true);
      expect(result.ocrData.vendor).toBe('Test Vendor');
      expect(result.requiresManualReview).toBe(true);

      // Verify receipt was saved with manual review flag
      const savedReceipt = await testDb.query(
        'SELECT * FROM receipts WHERE id = $1',
        [receiptData.id]
      );
      expect(savedReceipt.rows[0].requires_manual_review).toBe(true);

      // Restore original function
      ocrService.processImage = originalProcessImage;
    });
  });

  describe('Duplicate Receipt Prevention', () => {
    it('should prevent duplicate receipt submissions by hash', async () => {
      const receiptHash = 'unique-hash-123';
      
      const receiptData1 = {
        id: 'test-receipt-4',
        userId: 'test-user-1',
        totalAmount: 123.45,
        imageHash: receiptHash,
        imageData: 'base64-encoded-image-data'
      };

      // First submission should succeed
      const result1 = await receiptService.processReceiptWithTransaction(receiptData1);
      expect(result1.success).toBe(true);

      const receiptData2 = {
        id: 'test-receipt-5',
        userId: 'test-user-1',
        totalAmount: 123.45,
        imageHash: receiptHash, // Same hash
        imageData: 'base64-encoded-image-data'
      };

      // Second submission should fail
      await expect(
        receiptService.processReceiptWithTransaction(receiptData2)
      ).rejects.toThrow('Duplicate receipt detected');

      // Verify only one receipt exists
      const receipts = await testDb.query(
        'SELECT * FROM receipts WHERE image_hash = $1',
        [receiptHash]
      );
      expect(receipts.rows).toHaveLength(1);
    });

    it('should handle duplicate detection across users', async () => {
      const receiptHash = 'shared-hash-456';
      
      // User 1 submits receipt
      const receiptData1 = {
        id: 'test-receipt-6',
        userId: 'test-user-1',
        totalAmount: 123.45,
        imageHash: receiptHash,
        imageData: 'base64-encoded-image-data'
      };

      await receiptService.processReceiptWithTransaction(receiptData1);

      // User 2 tries to submit same receipt
      const receiptData2 = {
        id: 'test-receipt-7',
        userId: 'test-user-2',
        totalAmount: 123.45,
        imageHash: receiptHash,
        imageData: 'base64-encoded-image-data'
      };

      // Should allow if it's a different user (e.g., shared business expense)
      // but flag for review
      const result2 = await receiptService.processReceiptWithTransaction(receiptData2);
      expect(result2.success).toBe(true);
      expect(result2.requiresManualReview).toBe(true);
      expect(result2.duplicateWarning).toBe(true);
    });
  });

  describe('Concurrent Financial Operations', () => {
    it('should handle concurrent receipt processing', async () => {
      const concurrentCount = 10;
      const promises = [];

      for (let i = 0; i < concurrentCount; i++) {
        const receiptData = {
          id: `concurrent-receipt-${i}`,
          userId: 'test-user-1',
          totalAmount: Math.random() * 1000,
          imageData: `base64-encoded-image-data-${i}`
        };

        promises.push(receiptService.processReceiptWithTransaction(receiptData));
      }

      // All operations should complete successfully
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful).toHaveLength(concurrentCount);

      // Verify all receipts were saved
      const savedReceipts = await testDb.query(
        'SELECT COUNT(*) FROM receipts WHERE id LIKE $1',
        ['concurrent-receipt-%']
      );
      expect(parseInt(savedReceipts.rows[0].count)).toBe(concurrentCount);
    });

    it('should handle concurrent user spending calculations', async () => {
      const userId = 'test-user-1';
      
      // Create multiple receipts for the user
      const receiptPromises = [];
      for (let i = 0; i < 5; i++) {
        receiptPromises.push(
          receiptService.processReceiptWithTransaction({
            id: `spending-receipt-${i}`,
            userId: userId,
            totalAmount: 100.00,
            imageData: `base64-data-${i}`
          })
        );
      }

      await Promise.all(receiptPromises);

      // Concurrent spending calculations
      const spendingPromises = [];
      for (let i = 0; i < 5; i++) {
        spendingPromises.push(
          receiptService.calculateUserSpending(userId, '2024-01-01', '2024-12-31')
        );
      }

      const spendingResults = await Promise.all(spendingPromises);
      
      // All results should be consistent
      const expectedTotal = 500.00; // 5 receipts × $100
      spendingResults.forEach(result => {
        expect(result.totalSpending).toBe(expectedTotal);
      });
    });

    it('should prevent race conditions in financial calculations', async () => {
      const userId = 'test-user-1';
      
      // Simulate concurrent receipt additions and spending calculations
      const operations = [];
      
      // Add receipts concurrently
      for (let i = 0; i < 3; i++) {
        operations.push(
          receiptService.processReceiptWithTransaction({
            id: `race-receipt-${i}`,
            userId: userId,
            totalAmount: 50.00,
            imageData: `base64-data-${i}`
          })
        );
      }
      
      // Calculate spending concurrently
      for (let i = 0; i < 2; i++) {
        operations.push(
          receiptService.calculateUserSpending(userId, '2024-01-01', '2024-12-31')
        );
      }

      const results = await Promise.allSettled(operations);
      
      // All operations should complete without errors
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });

      // Final spending calculation should be accurate
      const finalSpending = await receiptService.calculateUserSpending(userId, '2024-01-01', '2024-12-31');
      expect(finalSpending.totalSpending).toBe(150.00); // 3 receipts × $50
    });
  });

  describe('Financial Data Consistency', () => {
    it('should maintain data consistency during system failures', async () => {
      const receiptData = {
        id: 'consistency-test-1',
        userId: 'test-user-1',
        totalAmount: 299.99,
        imageData: 'base64-encoded-image-data'
      };

      // Simulate system failure during processing
      const originalQuery = testDb.query;
      let queryCount = 0;
      
      testDb.query = jest.fn().mockImplementation((...args) => {
        queryCount++;
        if (queryCount === 3) { // Fail on third query
          throw new Error('System failure');
        }
        return originalQuery.apply(testDb, args);
      });

      await expect(
        receiptService.processReceiptWithTransaction(receiptData)
      ).rejects.toThrow('System failure');

      // Restore original query function
      testDb.query = originalQuery;

      // Verify database is in consistent state (no partial data)
      const receipts = await testDb.query(
        'SELECT * FROM receipts WHERE id = $1',
        [receiptData.id]
      );
      expect(receipts.rows).toHaveLength(0);

      const ocrData = await testDb.query(
        'SELECT * FROM receipt_ocr_data WHERE receipt_id = $1',
        [receiptData.id]
      );
      expect(ocrData.rows).toHaveLength(0);
    });

    it('should validate financial calculations accuracy', async () => {
      const userId = 'test-user-1';
      
      // Create receipts with known amounts
      const receiptAmounts = [25.50, 100.00, 75.25, 200.00];
      const expectedTotal = receiptAmounts.reduce((sum, amount) => sum + amount, 0);

      for (let i = 0; i < receiptAmounts.length; i++) {
        await receiptService.processReceiptWithTransaction({
          id: `accuracy-receipt-${i}`,
          userId: userId,
          totalAmount: receiptAmounts[i],
          imageData: `base64-data-${i}`
        });
      }

      // Calculate total spending
      const spendingResult = await receiptService.calculateUserSpending(userId, '2024-01-01', '2024-12-31');
      
      expect(spendingResult.totalSpending).toBe(expectedTotal);
      expect(spendingResult.receiptCount).toBe(receiptAmounts.length);
      
      // Verify individual receipt totals
      const receipts = await testDb.query(
        'SELECT total_amount FROM receipts WHERE user_id = $1 ORDER BY created_at',
        [userId]
      );
      
      receipts.rows.forEach((row, index) => {
        expect(parseFloat(row.total_amount)).toBe(receiptAmounts[index]);
      });
    });
  });

  describe('Financial Audit Trail', () => {
    it('should maintain complete audit trail for financial operations', async () => {
      const receiptData = {
        id: 'audit-test-1',
        userId: 'test-user-1',
        totalAmount: 150.75,
        imageData: 'base64-encoded-image-data'
      };

      // Process receipt
      await receiptService.processReceiptWithTransaction(receiptData);

      // Verify audit trail exists
      const auditLogs = await testDb.query(
        'SELECT * FROM audit_logs WHERE resource_id = $1 ORDER BY created_at',
        [receiptData.id]
      );

      expect(auditLogs.rows.length).toBeGreaterThan(0);
      
      // Check for required audit events
      const auditEvents = auditLogs.rows.map(log => log.action);
      expect(auditEvents).toContain('RECEIPT_CREATED');
      expect(auditEvents).toContain('OCR_PROCESSED');
      
      // Verify audit log completeness
      auditLogs.rows.forEach(log => {
        expect(log).toHaveProperty('user_id');
        expect(log).toHaveProperty('timestamp');
        expect(log).toHaveProperty('action');
        expect(log).toHaveProperty('resource_id');
      });
    });

    it('should track financial data modifications', async () => {
      const receiptId = 'audit-test-2';
      
      // Create receipt
      await receiptService.processReceiptWithTransaction({
        id: receiptId,
        userId: 'test-user-1',
        totalAmount: 100.00,
        imageData: 'base64-data'
      });

      // Modify receipt total (manual correction)
      await receiptService.updateReceiptTotal(receiptId, 125.00, 'Manual correction');

      // Verify modification audit trail
      const modifications = await testDb.query(
        'SELECT * FROM audit_logs WHERE resource_id = $1 AND action = $2',
        [receiptId, 'TOTAL_AMOUNT_MODIFIED']
      );

      expect(modifications.rows).toHaveLength(1);
      expect(modifications.rows[0].old_value).toBe('100.00');
      expect(modifications.rows[0].new_value).toBe('125.00');
      expect(modifications.rows[0].reason).toBe('Manual correction');
    });
  });
});