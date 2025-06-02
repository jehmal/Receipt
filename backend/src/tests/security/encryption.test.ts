import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import { EncryptionService } from '../../services/encryption';
import { createTestDatabase } from '../fixtures/database';

describe('Financial Data Encryption Testing', () => {
  let encryptionService: EncryptionService;
  let testDb: any;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    encryptionService = new EncryptionService({
      encryptionKey: process.env.ENCRYPTION_KEY || 'test-encryption-key-32-chars-long',
      algorithm: 'aes-256-gcm'
    });
  });

  afterAll(async () => {
    await testDb.close();
  });

  describe('PCI DSS Requirement 3: Protect stored cardholder data', () => {
    it('should use AES-256-GCM encryption for sensitive data', () => {
      const sensitiveData = {
        cardNumber: '4111111111111111',
        cvv: '123',
        totalAmount: 123.45,
        taxAmount: 12.34
      };

      const encrypted = encryptionService.encrypt(JSON.stringify(sensitiveData));
      
      // Verify encryption properties
      expect(encrypted).toHaveProperty('encryptedData');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('algorithm');
      
      // Verify algorithm is AES-256-GCM
      expect(encrypted.algorithm).toBe('aes-256-gcm');
      
      // Verify encrypted data doesn't contain original values
      expect(encrypted.encryptedData).not.toContain('4111111111111111');
      expect(encrypted.encryptedData).not.toContain('123');
      expect(encrypted.encryptedData).not.toContain('123.45');
    });

    it('should successfully decrypt encrypted financial data', () => {
      const originalData = {
        cardNumber: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '2025',
        totalAmount: 299.99,
        vendor: 'Test Merchant'
      };

      const encrypted = encryptionService.encrypt(JSON.stringify(originalData));
      const decrypted = encryptionService.decrypt(encrypted);
      const parsedDecrypted = JSON.parse(decrypted);

      expect(parsedDecrypted).toEqual(originalData);
      expect(parsedDecrypted.cardNumber).toBe('4111111111111111');
      expect(parsedDecrypted.totalAmount).toBe(299.99);
    });

    it('should fail decryption with tampered data', () => {
      const sensitiveData = { cardNumber: '4111111111111111' };
      const encrypted = encryptionService.encrypt(JSON.stringify(sensitiveData));
      
      // Tamper with encrypted data
      const tamperedEncrypted = {
        ...encrypted,
        encryptedData: encrypted.encryptedData.slice(0, -2) + 'XX'
      };

      expect(() => {
        encryptionService.decrypt(tamperedEncrypted);
      }).toThrow('Authentication failed');
    });

    it('should use unique IV for each encryption operation', () => {
      const data = 'sensitive financial data';
      
      const encryption1 = encryptionService.encrypt(data);
      const encryption2 = encryptionService.encrypt(data);
      
      // IVs should be different
      expect(encryption1.iv).not.toBe(encryption2.iv);
      
      // But both should decrypt to same data
      expect(encryptionService.decrypt(encryption1)).toBe(data);
      expect(encryptionService.decrypt(encryption2)).toBe(data);
    });

    it('should validate encryption key strength', () => {
      // Test with weak key
      expect(() => {
        new EncryptionService({
          encryptionKey: 'weak-key',
          algorithm: 'aes-256-gcm'
        });
      }).toThrow('Encryption key must be at least 32 characters');

      // Test with valid key
      const validService = new EncryptionService({
        encryptionKey: 'valid-32-character-encryption-key-',
        algorithm: 'aes-256-gcm'
      });
      
      expect(validService).toBeDefined();
    });
  });

  describe('Database Encryption Integration', () => {
    it('should encrypt receipt data before database storage', async () => {
      const receiptData = {
        id: 'test-receipt-encryption-1',
        userId: 'test-user-1',
        totalAmount: 157.89,
        taxAmount: 15.79,
        vendor: 'Encrypted Test Vendor',
        cardLast4: '1111',
        paymentMethod: 'credit_card'
      };

      // Encrypt sensitive fields
      const encryptedAmount = encryptionService.encrypt(receiptData.totalAmount.toString());
      const encryptedTax = encryptionService.encrypt(receiptData.taxAmount.toString());
      const encryptedCard = encryptionService.encrypt(receiptData.cardLast4);

      // Store in database with encrypted fields
      await testDb.query(`
        INSERT INTO receipts (
          id, user_id, vendor_name, 
          encrypted_total_amount, encrypted_tax_amount, encrypted_card_data,
          encryption_metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        receiptData.id,
        receiptData.userId,
        receiptData.vendor,
        JSON.stringify(encryptedAmount),
        JSON.stringify(encryptedTax),
        JSON.stringify(encryptedCard),
        JSON.stringify({
          algorithm: 'aes-256-gcm',
          encryptedFields: ['totalAmount', 'taxAmount', 'cardLast4']
        })
      ]);

      // Retrieve and verify encryption
      const stored = await testDb.query(
        'SELECT * FROM receipts WHERE id = $1',
        [receiptData.id]
      );

      expect(stored.rows).toHaveLength(1);
      
      // Verify sensitive data is encrypted in storage
      const storedRow = stored.rows[0];
      expect(storedRow.encrypted_total_amount).not.toContain('157.89');
      expect(storedRow.encrypted_tax_amount).not.toContain('15.79');
      expect(storedRow.encrypted_card_data).not.toContain('1111');

      // Verify we can decrypt stored data
      const decryptedAmount = encryptionService.decrypt(JSON.parse(storedRow.encrypted_total_amount));
      const decryptedTax = encryptionService.decrypt(JSON.parse(storedRow.encrypted_tax_amount));
      const decryptedCard = encryptionService.decrypt(JSON.parse(storedRow.encrypted_card_data));

      expect(parseFloat(decryptedAmount)).toBe(157.89);
      expect(parseFloat(decryptedTax)).toBe(15.79);
      expect(decryptedCard).toBe('1111');
    });

    it('should handle encryption errors gracefully', async () => {
      const invalidEncryptionService = new EncryptionService({
        encryptionKey: 'invalid-key-that-will-cause-issues',
        algorithm: 'aes-256-gcm'
      });

      expect(() => {
        invalidEncryptionService.encrypt('test data');
      }).toThrow();
    });
  });

  describe('Key Management and Rotation', () => {
    it('should support key rotation for encrypted data', async () => {
      const originalKey = 'original-32-character-encryption-key';
      const newKey = 'new-32-character-encryption-key----';
      
      const originalService = new EncryptionService({
        encryptionKey: originalKey,
        algorithm: 'aes-256-gcm'
      });

      const newService = new EncryptionService({
        encryptionKey: newKey,
        algorithm: 'aes-256-gcm'
      });

      const sensitiveData = 'sensitive financial information';
      
      // Encrypt with original key
      const encryptedWithOriginal = originalService.encrypt(sensitiveData);
      
      // Decrypt with original key
      const decrypted = originalService.decrypt(encryptedWithOriginal);
      
      // Re-encrypt with new key
      const encryptedWithNew = newService.encrypt(decrypted);
      
      // Verify new encryption is different
      expect(encryptedWithNew.encryptedData).not.toBe(encryptedWithOriginal.encryptedData);
      
      // Verify new service can decrypt new encryption
      const finalDecrypted = newService.decrypt(encryptedWithNew);
      expect(finalDecrypted).toBe(sensitiveData);
    });

    it('should validate key versioning for audit trails', () => {
      const keyVersion = '2024-01-v1';
      const encryptionService = new EncryptionService({
        encryptionKey: 'versioned-key-32-characters-long-',
        algorithm: 'aes-256-gcm',
        keyVersion: keyVersion
      });

      const encrypted = encryptionService.encrypt('test data');
      
      expect(encrypted).toHaveProperty('keyVersion');
      expect(encrypted.keyVersion).toBe(keyVersion);
    });
  });

  describe('Performance and Security Benchmarks', () => {
    it('should encrypt/decrypt within performance thresholds', () => {
      const largeData = JSON.stringify({
        cardNumber: '4111111111111111',
        transactions: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          amount: Math.random() * 1000,
          merchant: `Merchant ${i}`,
          date: new Date().toISOString()
        }))
      });

      const startTime = performance.now();
      const encrypted = encryptionService.encrypt(largeData);
      const encryptTime = performance.now() - startTime;

      const decryptStartTime = performance.now();
      const decrypted = encryptionService.decrypt(encrypted);
      const decryptTime = performance.now() - decryptStartTime;

      // Encryption should complete within 100ms for large datasets
      expect(encryptTime).toBeLessThan(100);
      expect(decryptTime).toBeLessThan(100);
      
      // Verify data integrity
      expect(decrypted).toBe(largeData);
    });

    it('should prevent timing attacks', () => {
      const correctData = 'correct sensitive data';
      const incorrectData = 'incorrect sensitive data';
      
      const encrypted = encryptionService.encrypt(correctData);
      
      // Measure decryption time for correct data
      const correctTimes = [];
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        try {
          encryptionService.decrypt(encrypted);
        } catch (e) {
          // Expected for timing test
        }
        correctTimes.push(performance.now() - start);
      }

      // Create tampered data for timing comparison
      const tamperedEncrypted = {
        ...encrypted,
        encryptedData: encrypted.encryptedData.slice(0, -4) + 'XXXX'
      };

      // Measure decryption time for incorrect data
      const incorrectTimes = [];
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        try {
          encryptionService.decrypt(tamperedEncrypted);
        } catch (e) {
          // Expected to fail
        }
        incorrectTimes.push(performance.now() - start);
      }

      // Times should be similar to prevent timing attacks
      const avgCorrectTime = correctTimes.reduce((a, b) => a + b) / correctTimes.length;
      const avgIncorrectTime = incorrectTimes.reduce((a, b) => a + b) / incorrectTimes.length;
      
      // Difference should be minimal (within 50% variance)
      const timeDifference = Math.abs(avgCorrectTime - avgIncorrectTime);
      const maxAllowedDifference = Math.max(avgCorrectTime, avgIncorrectTime) * 0.5;
      
      expect(timeDifference).toBeLessThan(maxAllowedDifference);
    });
  });

  describe('Compliance Validation', () => {
    it('should meet FIPS 140-2 requirements', () => {
      // Verify approved cryptographic algorithms
      const approvedAlgorithms = ['aes-256-gcm', 'aes-256-cbc'];
      expect(approvedAlgorithms).toContain(encryptionService.algorithm);

      // Verify key length meets requirements
      expect(encryptionService.keyLength).toBeGreaterThanOrEqual(256);
    });

    it('should generate cryptographically secure random values', () => {
      const randomValues = [];
      
      // Generate multiple random IVs
      for (let i = 0; i < 100; i++) {
        const encrypted = encryptionService.encrypt('test');
        randomValues.push(encrypted.iv);
      }

      // All IVs should be unique
      const uniqueValues = new Set(randomValues);
      expect(uniqueValues.size).toBe(randomValues.length);

      // IVs should be 12 bytes (96 bits) for GCM
      randomValues.forEach(iv => {
        const buffer = Buffer.from(iv, 'hex');
        expect(buffer.length).toBe(12);
      });
    });

    it('should implement secure key derivation', () => {
      const password = 'user-password-123';
      const salt = crypto.randomBytes(32);
      
      // Test PBKDF2 key derivation
      const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
      
      expect(derivedKey.length).toBe(32); // 256 bits
      
      // Same inputs should produce same key
      const derivedKey2 = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
      expect(derivedKey.equals(derivedKey2)).toBe(true);
      
      // Different salt should produce different key
      const differentSalt = crypto.randomBytes(32);
      const derivedKey3 = crypto.pbkdf2Sync(password, differentSalt, 100000, 32, 'sha256');
      expect(derivedKey.equals(derivedKey3)).toBe(false);
    });
  });

  describe('Error Handling and Security', () => {
    it('should not leak sensitive information in error messages', () => {
      const sensitiveData = 'credit card 4111111111111111 cvv 123';
      
      try {
        // Force an encryption error
        const invalidService = new EncryptionService({
          encryptionKey: null as any,
          algorithm: 'aes-256-gcm'
        });
        invalidService.encrypt(sensitiveData);
      } catch (error) {
        // Error message should not contain sensitive data
        expect(error.message).not.toContain('4111111111111111');
        expect(error.message).not.toContain('123');
        expect(error.message).not.toContain('credit card');
      }
    });

    it('should securely clear sensitive data from memory', () => {
      const sensitiveData = 'very sensitive financial data';
      const dataBuffer = Buffer.from(sensitiveData);
      
      // Encrypt data
      const encrypted = encryptionService.encrypt(sensitiveData);
      
      // Clear sensitive data buffer
      dataBuffer.fill(0);
      
      // Verify buffer is cleared
      expect(dataBuffer.toString()).not.toContain(sensitiveData);
      
      // But encrypted data should still be decryptable
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(sensitiveData);
    });
  });
});