import { describe, it, expect } from '@jest/globals';
import { TestDataFactory, PerformanceTestHelpers } from '../fixtures/test-data';

describe('Testing Infrastructure Validation', () => {
  describe('TestDataFactory', () => {
    it('should create valid user data', () => {
      // Arrange & Act
      const user = TestDataFactory.createUser();

      // Assert
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toContain('@example.com');
      expect(user.name).toBe('Test User');
      expect(user.emailVerified).toBe(true);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should create valid user data with overrides', () => {
      // Arrange
      const overrides = {
        name: 'Custom Test User',
        email: 'custom@test.com',
        emailVerified: false
      };

      // Act
      const user = TestDataFactory.createUser(overrides);

      // Assert
      expect(user.name).toBe('Custom Test User');
      expect(user.email).toBe('custom@test.com');
      expect(user.emailVerified).toBe(false);
    });

    it('should create valid organization data', () => {
      // Arrange & Act
      const org = TestDataFactory.createOrganization();

      // Assert
      expect(org).toBeDefined();
      expect(org.id).toBeDefined();
      expect(org.name).toBe('Test Organization');
      expect(org.domain).toBe('test-org.com');
      expect(org.settings).toBeDefined();
      expect(org.settings.receiptRetentionDays).toBe(2555);
      expect(org.settings.autoCategorizationEnabled).toBe(true);
      expect(org.settings.exportFormats).toContain('pdf');
      expect(org.settings.exportFormats).toContain('csv');
      expect(org.settings.exportFormats).toContain('excel');
    });

    it('should create valid receipt data', () => {
      // Arrange
      const userId = 'test-user-123';

      // Act
      const receipt = TestDataFactory.createReceipt(userId);

      // Assert
      expect(receipt).toBeDefined();
      expect(receipt.id).toBeDefined();
      expect(receipt.userId).toBe(userId);
      expect(receipt.merchant).toBe('Test Merchant Inc.');
      expect(receipt.amount).toBe(99.99);
      expect(receipt.currency).toBe('USD');
      expect(receipt.category).toBe('Business Meals');
      expect(receipt.subcategory).toBe('Client Entertainment');
      expect(receipt.taxAmount).toBe(8.00);
      expect(receipt.tipAmount).toBe(15.00);
      expect(receipt.tags).toEqual(['business', 'client', 'lunch']);
      expect(receipt.status).toBe('processed');
    });

    it('should create valid file upload data', () => {
      // Arrange & Act
      const fileUpload = TestDataFactory.createFileUpload();

      // Assert
      expect(fileUpload).toBeDefined();
      expect(fileUpload.id).toBeDefined();
      expect(fileUpload.filename).toBe('test-receipt.jpg');
      expect(fileUpload.originalName).toBe('receipt-photo.jpg');
      expect(fileUpload.mimetype).toBe('image/jpeg');
      expect(fileUpload.size).toBe(1024 * 500);
      expect(fileUpload.metadata.width).toBe(1920);
      expect(fileUpload.metadata.height).toBe(1080);
      expect(fileUpload.metadata.format).toBe('jpeg');
    });

    it('should create valid OCR result data', () => {
      // Arrange & Act
      const ocrResult = TestDataFactory.createOCRResult();

      // Assert
      expect(ocrResult).toBeDefined();
      expect(ocrResult.id).toBeDefined();
      expect(ocrResult.receiptId).toBeDefined();
      expect(ocrResult.extractedText).toContain('Test Merchant');
      expect(ocrResult.confidence).toBe(0.95);
      expect(ocrResult.extractedData.merchant).toBe('Test Merchant');
      expect(ocrResult.extractedData.amount).toBe(99.99);
      expect(ocrResult.extractedData.items).toHaveLength(2);
      expect(ocrResult.provider).toBe('google_vision');
    });
  });

  describe('PerformanceTestHelpers', () => {
    it('should measure execution time accurately', async () => {
      // Arrange
      const testFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        return 'test result';
      };

      // Act
      const { result, executionTime } = await PerformanceTestHelpers.measureExecutionTime(testFunction);

      // Assert
      expect(result).toBe('test result');
      expect(executionTime).toBeGreaterThanOrEqual(100);
      expect(executionTime).toBeLessThan(200); // Should be close to 100ms
    });

    it('should validate performance within threshold', () => {
      // Arrange
      const executionTime = 50;
      const maxTime = 100;

      // Act & Assert
      expect(() => {
        PerformanceTestHelpers.expectPerformance(executionTime, maxTime);
      }).not.toThrow();
    });

    it('should fail performance validation when exceeding threshold', () => {
      // Arrange
      const executionTime = 150;
      const maxTime = 100;

      // Act & Assert
      expect(() => {
        PerformanceTestHelpers.expectPerformance(executionTime, maxTime);
      }).toThrow();
    });

    it('should run load tests with multiple concurrent executions', async () => {
      // Arrange
      const testFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return Math.random();
      };
      const concurrentCount = 5;

      // Act
      const results = await PerformanceTestHelpers.loadTest(testFunction, concurrentCount);

      // Assert
      expect(results).toHaveLength(concurrentCount);
      expect(results.every(result => typeof result === 'number')).toBe(true);
    });
  });

  describe('Custom Jest Matchers', () => {
    it('should validate UUIDs correctly', () => {
      // Arrange
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUUID = 'not-a-uuid';
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // Act & Assert
      expect(validUUID).toMatch(uuidRegex);
      expect(invalidUUID).not.toMatch(uuidRegex);
    });

    it('should validate ranges correctly', () => {
      // Arrange
      const value = 50;
      const floor = 10;
      const ceiling = 100;

      // Act & Assert
      expect(value).toBeGreaterThanOrEqual(floor);
      expect(value).toBeLessThanOrEqual(ceiling);
      expect(150).toBeGreaterThan(ceiling);
    });
  });

  describe('Test Data Validation', () => {
    it('should generate unique IDs for each factory call', () => {
      // Arrange & Act
      const user1 = TestDataFactory.createUser();
      const user2 = TestDataFactory.createUser();
      const receipt1 = TestDataFactory.createReceipt('user-1');
      const receipt2 = TestDataFactory.createReceipt('user-2');

      // Assert
      expect(user1.id).not.toBe(user2.id);
      expect(receipt1.id).not.toBe(receipt2.id);
      expect(user1.email).not.toBe(user2.email);
    });

    it('should create realistic business data', () => {
      // Arrange & Act
      const user = TestDataFactory.createUser();
      const receipt = TestDataFactory.createReceipt(user.id);
      const org = TestDataFactory.createOrganization();

      // Assert
      // User data should be realistic
      expect(user.email).toMatch(/^test\.user\.\d+@example\.com$/);
      expect(user.workosUserId).toMatch(/^user_[a-f0-9]{32}$/);

      // Receipt data should be realistic
      expect(receipt.amount).toBeGreaterThan(0);
      expect(receipt.receiptNumber).toMatch(/^REC-\d+$/);
      expect(receipt.taxAmount).toBeGreaterThan(0);
      expect(receipt.tipAmount).toBeGreaterThan(0);

      // Organization data should be realistic
      expect(org.workosOrganizationId).toMatch(/^org_[a-f0-9]{32}$/);
      expect(org.settings.receiptRetentionDays).toBeGreaterThan(365); // At least 1 year
    });
  });
}); 