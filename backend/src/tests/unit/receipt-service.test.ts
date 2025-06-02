import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TestDataFactory, MockServices, PerformanceTestHelpers } from '../fixtures/test-data';

// Mock dependencies
jest.mock('../../services/ocr-service');
jest.mock('../../services/storage-service');
jest.mock('../../services/notification-service');

// Import service after mocking
import { ReceiptService } from '../../services/receipt-service';

describe('ReceiptService', () => {
  let receiptService: ReceiptService;
  let mockOCRService: any;
  let mockStorageService: any;
  let mockNotificationService: any;

  beforeEach(() => {
    mockOCRService = MockServices.createMockOCRService();
    mockStorageService = MockServices.createMockStorageService();
    mockNotificationService = MockServices.createMockEmailService();

    receiptService = new ReceiptService({
      ocrService: mockOCRService,
      storageService: mockStorageService,
      notificationService: mockNotificationService
    });
  });

  describe('processReceiptUpload', () => {
    it('should process receipt upload successfully', async () => {
      // Arrange
      const userId = 'test-user-123';
      const fileUpload = TestDataFactory.createFileUpload();
      const expectedOCRResult = TestDataFactory.createOCRResult();
      
      mockOCRService.processReceipt.mockResolvedValue(expectedOCRResult);
      mockStorageService.uploadFile.mockResolvedValue({
        url: 'https://storage.example.com/receipt.jpg',
        thumbnailUrl: 'https://storage.example.com/thumbnail.jpg'
      });

      // Act
      const result = await receiptService.processReceiptUpload(userId, fileUpload);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe('processed');
      expect(result.userId).toBe(userId);
      expect(result.merchant).toBe(expectedOCRResult.extractedData.merchant);
      expect(result.amount).toBe(expectedOCRResult.extractedData.amount);
      expect(mockOCRService.processReceipt).toHaveBeenCalledWith(fileUpload);
      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(fileUpload);
    });

    it('should handle OCR processing failure gracefully', async () => {
      // Arrange
      const userId = 'test-user-123';
      const fileUpload = TestDataFactory.createFileUpload();
      
      mockOCRService.processReceipt.mockRejectedValue(new Error('OCR service unavailable'));
      mockStorageService.uploadFile.mockResolvedValue({
        url: 'https://storage.example.com/receipt.jpg'
      });

      // Act
      const result = await receiptService.processReceiptUpload(userId, fileUpload);

      // Assert
      expect(result.status).toBe('processing_failed');
      expect(result.metadata.error).toContain('OCR service unavailable');
      expect(mockStorageService.uploadFile).toHaveBeenCalled();
    });

    it('should reject files that are too large', async () => {
      // Arrange
      const userId = 'test-user-123';
      const largeFileUpload = TestDataFactory.createFileUpload({
        size: 50 * 1024 * 1024 // 50MB
      });

      // Act & Assert
      await expect(receiptService.processReceiptUpload(userId, largeFileUpload))
        .rejects.toThrow('File size exceeds maximum limit');
    });

    it('should reject unsupported file types', async () => {
      // Arrange
      const userId = 'test-user-123';
      const unsupportedFile = TestDataFactory.createFileUpload({
        mimetype: 'application/pdf',
        filename: 'document.pdf'
      });

      // Act & Assert
      await expect(receiptService.processReceiptUpload(userId, unsupportedFile))
        .rejects.toThrow('Unsupported file type');
    });

    it('should complete processing within performance threshold', async () => {
      // Arrange
      const userId = 'test-user-123';
      const fileUpload = TestDataFactory.createFileUpload();
      
      mockOCRService.processReceipt.mockResolvedValue(TestDataFactory.createOCRResult());
      mockStorageService.uploadFile.mockResolvedValue({
        url: 'https://storage.example.com/receipt.jpg'
      });

      // Act & Assert
      const { executionTime } = await PerformanceTestHelpers.measureExecutionTime(
        () => receiptService.processReceiptUpload(userId, fileUpload)
      );

      PerformanceTestHelpers.expectPerformance(executionTime, 5000); // 5 second threshold
    });
  });

  describe('validateReceiptData', () => {
    it('should validate receipt data successfully', () => {
      // Arrange
      const receiptData = TestDataFactory.createReceipt('test-user-123');

      // Act
      const result = receiptService.validateReceiptData(receiptData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for missing required fields', () => {
      // Arrange
      const invalidReceiptData = TestDataFactory.createReceipt('test-user-123', {
        merchant: '', // Required field missing
        amount: -10, // Invalid amount
        date: new Date('invalid-date') // Invalid date
      });

      // Act
      const result = receiptService.validateReceiptData(invalidReceiptData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Merchant name is required');
      expect(result.errors).toContain('Amount must be positive');
      expect(result.errors).toContain('Invalid date format');
    });

    it('should validate currency codes', () => {
      // Arrange
      const receiptWithInvalidCurrency = TestDataFactory.createReceipt('test-user-123', {
        currency: 'INVALID'
      });

      // Act
      const result = receiptService.validateReceiptData(receiptWithInvalidCurrency);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid currency code');
    });

    it('should validate amount precision', () => {
      // Arrange
      const receiptWithInvalidPrecision = TestDataFactory.createReceipt('test-user-123', {
        amount: 99.999 // Too many decimal places
      });

      // Act
      const result = receiptService.validateReceiptData(receiptWithInvalidPrecision);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount cannot have more than 2 decimal places');
    });
  });

  describe('categorizeReceipt', () => {
    it('should auto-categorize based on merchant patterns', () => {
      // Arrange
      const receiptData = TestDataFactory.createReceipt('test-user-123', {
        merchant: 'Starbucks Coffee #123',
        description: 'Coffee and pastry'
      });

      // Act
      const result = receiptService.categorizeReceipt(receiptData);

      // Assert
      expect(result.category).toBe('Food & Dining');
      expect(result.subcategory).toBe('Coffee Shops');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should categorize gas stations correctly', () => {
      // Arrange
      const receiptData = TestDataFactory.createReceipt('test-user-123', {
        merchant: 'Shell Gas Station',
        description: 'Fuel purchase'
      });

      // Act
      const result = receiptService.categorizeReceipt(receiptData);

      // Assert
      expect(result.category).toBe('Transportation');
      expect(result.subcategory).toBe('Fuel');
    });

    it('should handle unknown merchants gracefully', () => {
      // Arrange
      const receiptData = TestDataFactory.createReceipt('test-user-123', {
        merchant: 'Unknown Merchant XYZ123',
        description: 'Miscellaneous purchase'
      });

      // Act
      const result = receiptService.categorizeReceipt(receiptData);

      // Assert
      expect(result.category).toBe('Uncategorized');
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('calculateTotals', () => {
    it('should calculate totals correctly', () => {
      // Arrange
      const receiptData = {
        subtotal: 100.00,
        taxAmount: 8.50,
        tipAmount: 15.00,
        discountAmount: 5.00
      };

      // Act
      const result = receiptService.calculateTotals(receiptData);

      // Assert
      expect(result.total).toBe(118.50); // 100 + 8.50 + 15.00 - 5.00
      expect(result.taxRate).toBe(0.085); // 8.50 / 100
      expect(result.tipPercentage).toBe(0.15); // 15.00 / 100
    });

    it('should handle missing optional amounts', () => {
      // Arrange
      const receiptData = {
        subtotal: 50.00
      };

      // Act
      const result = receiptService.calculateTotals(receiptData);

      // Assert
      expect(result.total).toBe(50.00);
      expect(result.taxRate).toBe(0);
      expect(result.tipPercentage).toBe(0);
    });

    it('should validate calculation accuracy', () => {
      // Arrange
      const receiptData = {
        subtotal: 99.99,
        taxAmount: 8.50,
        tipAmount: 15.00,
        total: 123.49 // Expected calculated total
      };

      // Act
      const result = receiptService.calculateTotals(receiptData);

      // Assert
      expect(result.isAccurate).toBe(true);
      expect(result.calculatedTotal).toBe(123.49);
      expect(result.discrepancy).toBe(0);
    });

    it('should detect calculation discrepancies', () => {
      // Arrange
      const receiptData = {
        subtotal: 100.00,
        taxAmount: 8.50,
        tipAmount: 15.00,
        total: 130.00 // Incorrect total
      };

      // Act
      const result = receiptService.calculateTotals(receiptData);

      // Assert
      expect(result.isAccurate).toBe(false);
      expect(result.calculatedTotal).toBe(123.50);
      expect(result.discrepancy).toBe(6.50);
    });
  });

  describe('searchReceipts', () => {
    it('should search receipts by merchant name', async () => {
      // Arrange
      const userId = 'test-user-123';
      const searchQuery = 'Starbucks';
      const mockReceipts = [
        TestDataFactory.createReceipt(userId, { merchant: 'Starbucks Coffee' }),
        TestDataFactory.createReceipt(userId, { merchant: 'Starbucks Reserve' })
      ];

      jest.spyOn(receiptService, 'findReceiptsByUser').mockResolvedValue(mockReceipts);

      // Act
      const result = await receiptService.searchReceipts(userId, searchQuery);

      // Assert
      expect(result).toHaveLength(2);
      expect(result.every(r => r.merchant.includes('Starbucks'))).toBe(true);
    });

    it('should search receipts by amount range', async () => {
      // Arrange
      const userId = 'test-user-123';
      const searchQuery = 'amount:50-100';
      const mockReceipts = [
        TestDataFactory.createReceipt(userId, { amount: 75.50 }),
        TestDataFactory.createReceipt(userId, { amount: 99.99 })
      ];

      jest.spyOn(receiptService, 'findReceiptsByUser').mockResolvedValue(mockReceipts);

      // Act
      const result = await receiptService.searchReceipts(userId, searchQuery);

      // Assert
      expect(result).toHaveLength(2);
      expect(result.every(r => r.amount >= 50 && r.amount <= 100)).toBe(true);
    });

    it('should search receipts by date range', async () => {
      // Arrange
      const userId = 'test-user-123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const searchQuery = `date:${startDate.toISOString()}-${endDate.toISOString()}`;

      const mockReceipts = [
        TestDataFactory.createReceipt(userId, { date: new Date('2024-01-15') }),
        TestDataFactory.createReceipt(userId, { date: new Date('2024-01-20') })
      ];

      jest.spyOn(receiptService, 'findReceiptsByUser').mockResolvedValue(mockReceipts);

      // Act
      const result = await receiptService.searchReceipts(userId, searchQuery);

      // Assert
      expect(result).toHaveLength(2);
      expect(result.every(r => 
        new Date(r.date) >= startDate && new Date(r.date) <= endDate
      )).toBe(true);
    });
  });

  describe('generateReceiptSummary', () => {
    it('should generate comprehensive receipt summary', () => {
      // Arrange
      const receipts = [
        TestDataFactory.createReceipt('test-user-123', { amount: 25.50, category: 'Food & Dining' }),
        TestDataFactory.createReceipt('test-user-123', { amount: 45.75, category: 'Food & Dining' }),
        TestDataFactory.createReceipt('test-user-123', { amount: 100.00, category: 'Transportation' })
      ];

      // Act
      const summary = receiptService.generateReceiptSummary(receipts);

      // Assert
      expect(summary.totalAmount).toBe(171.25);
      expect(summary.receiptCount).toBe(3);
      expect(summary.categories['Food & Dining'].amount).toBe(71.25);
      expect(summary.categories['Food & Dining'].count).toBe(2);
      expect(summary.categories['Transportation'].amount).toBe(100.00);
      expect(summary.categories['Transportation'].count).toBe(1);
      expect(summary.averageAmount).toBe(57.08);
    });

    it('should calculate monthly trends', () => {
      // Arrange
      const receipts = [
        TestDataFactory.createReceipt('test-user-123', { 
          amount: 50.00, 
          date: new Date('2024-01-15') 
        }),
        TestDataFactory.createReceipt('test-user-123', { 
          amount: 75.00, 
          date: new Date('2024-02-15') 
        }),
        TestDataFactory.createReceipt('test-user-123', { 
          amount: 100.00, 
          date: new Date('2024-02-20') 
        })
      ];

      // Act
      const summary = receiptService.generateReceiptSummary(receipts);

      // Assert
      expect(summary.monthlyTrends['2024-01']).toBe(50.00);
      expect(summary.monthlyTrends['2024-02']).toBe(175.00);
    });
  });
}); 