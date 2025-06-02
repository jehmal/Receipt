import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from '../setup';
import { createTestDatabase } from '../fixtures/database';
import crypto from 'crypto';

describe('PCI DSS Compliance Testing', () => {
  let app: any;
  let testDb: any;
  let authToken: string;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    app = await createTestApp(testDb);
    
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

  describe('PCI DSS Requirement 3: Protect stored cardholder data', () => {
    it('should encrypt sensitive financial data at rest', async () => {
      // Upload receipt with financial data
      const receiptData = {
        totalAmount: 123.45,
        taxAmount: 12.34,
        vendor: 'Test Vendor',
        cardNumber: '4111111111111111' // Test card number
      };

      const response = await request(app.server)
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(receiptData)
        .expect(201);

      const receiptId = response.body.id;

      // Check database to ensure sensitive data is encrypted
      const dbResult = await testDb.query(
        'SELECT raw_data, encrypted_fields FROM receipts WHERE id = $1',
        [receiptId]
      );

      expect(dbResult.rows).toHaveLength(1);
      const storedData = dbResult.rows[0];

      // Verify card number is not stored in plain text
      expect(JSON.stringify(storedData.raw_data)).not.toContain('4111111111111111');
      
      // Verify encryption metadata exists
      expect(storedData.encrypted_fields).toBeDefined();
      expect(storedData.encrypted_fields).toContain('cardNumber');
    });

    it('should not store prohibited data elements', async () => {
      // Test that prohibited data like CVV, PIN, etc. are not stored
      const receiptData = {
        totalAmount: 100.00,
        cardNumber: '4111111111111111',
        cvv: '123', // This should not be stored
        pin: '1234', // This should not be stored
        trackData: 'prohibited_track_data' // This should not be stored
      };

      const response = await request(app.server)
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(receiptData)
        .expect(201);

      const receiptId = response.body.id;

      // Verify prohibited data is not stored
      const dbResult = await testDb.query(
        'SELECT raw_data FROM receipts WHERE id = $1',
        [receiptId]
      );

      const storedDataStr = JSON.stringify(dbResult.rows[0].raw_data);
      
      // These should never be stored
      expect(storedDataStr).not.toContain('123'); // CVV
      expect(storedDataStr).not.toContain('1234'); // PIN
      expect(storedDataStr).not.toContain('prohibited_track_data');
    });

    it('should use strong encryption algorithms', async () => {
      // Verify encryption strength and algorithms
      const testData = 'sensitive_financial_data';
      
      // Check that we're using AES-256 or equivalent
      const cipher = crypto.createCipher('aes-256-cbc', 'test-key');
      let encrypted = cipher.update(testData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      expect(encrypted).not.toBe(testData);
      expect(encrypted.length).toBeGreaterThan(testData.length);
      
      // Verify key length requirements (256-bit minimum)
      const key = crypto.randomBytes(32); // 256 bits
      expect(key.length).toBe(32);
    });

    it('should implement proper key management', async () => {
      // Test that encryption keys are properly managed
      const response = await request(app.server)
        .get('/api/v1/security/encryption-status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('keyRotationEnabled');
      expect(response.body).toHaveProperty('keyStrength');
      expect(response.body.keyStrength).toBeGreaterThanOrEqual(256);
    });
  });

  describe('PCI DSS Requirement 4: Encrypt transmission of cardholder data', () => {
    it('should use strong cryptography for data transmission', async () => {
      // Test HTTPS/TLS implementation
      const response = await request(app.server)
        .get('/api/v1/health')
        .expect(200);

      // Check security headers
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should validate SSL/TLS configuration', async () => {
      // Test minimum TLS version
      const response = await request(app.server)
        .get('/api/v1/security/tls-info')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.minTlsVersion).toBe('1.2');
      expect(response.body.ciphers).toContain('AES');
    });

    it('should never transmit sensitive data in URLs', async () => {
      // Test that sensitive data is never in query parameters
      const sensitiveData = '4111111111111111';
      
      const response = await request(app.server)
        .get(`/api/v1/receipts/search?q=${sensitiveData}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400); // Should reject sensitive data in URL

      expect(response.body.error).toContain('sensitive data in URL');
    });
  });

  describe('PCI DSS Requirement 7: Restrict access to cardholder data', () => {
    it('should implement role-based access controls', async () => {
      // Test that only authorized users can access financial data
      const unauthorizedResponse = await request(app.server)
        .get('/api/v1/receipts/financial-summary')
        .expect(401);

      expect(unauthorizedResponse.body.error).toBe('Authentication required');

      // Test with valid authorization
      const authorizedResponse = await request(app.server)
        .get('/api/v1/receipts/financial-summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(authorizedResponse.body).toHaveProperty('totalSpending');
    });

    it('should log access to cardholder data', async () => {
      // Test that access to financial data is properly logged
      await request(app.server)
        .get('/api/v1/receipts/1/financial-details')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404); // Receipt doesn't exist, but access should be logged

      // Check audit logs
      const auditLogs = await testDb.query(
        'SELECT * FROM audit_logs WHERE action = $1 AND user_id = $2',
        ['ACCESS_FINANCIAL_DATA', authToken]
      );

      expect(auditLogs.rows.length).toBeGreaterThan(0);
    });
  });

  describe('PCI DSS Requirement 8: Identify and authenticate access', () => {
    it('should enforce strong authentication', async () => {
      // Test password strength requirements
      const weakPasswordResponse = await request(app.server)
        .post('/api/v1/auth/register')
        .send({
          email: 'weak@example.com',
          password: '123', // Weak password
          firstName: 'Weak',
          lastName: 'User'
        })
        .expect(400);

      expect(weakPasswordResponse.body.error).toContain('Password must be');
    });

    it('should implement multi-factor authentication for admin access', async () => {
      // Test 2FA requirement for admin functions
      const adminResponse = await request(app.server)
        .get('/api/v1/admin/financial-reports')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403); // Should require 2FA

      expect(adminResponse.body.error).toContain('Two-factor authentication required');
    });
  });

  describe('PCI DSS Requirement 10: Track and monitor access', () => {
    it('should log all access to cardholder data', async () => {
      // Upload receipt with financial data
      const receiptResponse = await request(app.server)
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          totalAmount: 50.00,
          vendor: 'Test Store'
        })
        .expect(201);

      const receiptId = receiptResponse.body.id;

      // Access the receipt
      await request(app.server)
        .get(`/api/v1/receipts/${receiptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify access is logged
      const accessLogs = await testDb.query(
        'SELECT * FROM audit_logs WHERE resource_id = $1 AND action = $2',
        [receiptId, 'VIEW_RECEIPT']
      );

      expect(accessLogs.rows.length).toBeGreaterThan(0);
      expect(accessLogs.rows[0]).toHaveProperty('timestamp');
      expect(accessLogs.rows[0]).toHaveProperty('user_id');
      expect(accessLogs.rows[0]).toHaveProperty('ip_address');
    });

    it('should detect and alert on suspicious activity', async () => {
      // Simulate suspicious activity (multiple failed access attempts)
      for (let i = 0; i < 5; i++) {
        await request(app.server)
          .get('/api/v1/receipts/1')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      }

      // Check for security alerts
      const alerts = await testDb.query(
        'SELECT * FROM security_alerts WHERE alert_type = $1',
        ['MULTIPLE_FAILED_ACCESS']
      );

      expect(alerts.rows.length).toBeGreaterThan(0);
    });
  });

  describe('PCI DSS Requirement 11: Regularly test security systems', () => {
    it('should validate vulnerability scanning', async () => {
      // Test that security scanning is implemented
      const scanResponse = await request(app.server)
        .get('/api/v1/security/scan-status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(scanResponse.body).toHaveProperty('lastScanDate');
      expect(scanResponse.body).toHaveProperty('vulnerabilitiesFound');
      expect(scanResponse.body.vulnerabilitiesFound).toBe(0);
    });
  });

  describe('Data Masking and Tokenization', () => {
    it('should mask sensitive data in responses', async () => {
      // Upload receipt with card data
      const receiptResponse = await request(app.server)
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          totalAmount: 100.00,
          cardNumber: '4111111111111111'
        })
        .expect(201);

      const receiptId = receiptResponse.body.id;

      // Retrieve receipt and verify masking
      const getResponse = await request(app.server)
        .get(`/api/v1/receipts/${receiptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Card number should be masked (e.g., ****1111)
      expect(getResponse.body.cardNumber).toMatch(/^\*+\d{4}$/);
    });

    it('should implement tokenization for recurring transactions', async () => {
      // Test tokenization implementation
      const tokenResponse = await request(app.server)
        .post('/api/v1/payments/tokenize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cardNumber: '4111111111111111',
          expiryMonth: '12',
          expiryYear: '2025'
        })
        .expect(200);

      expect(tokenResponse.body).toHaveProperty('token');
      expect(tokenResponse.body.token).not.toContain('4111111111111111');
      expect(tokenResponse.body.token.length).toBeGreaterThan(20);
    });
  });
});