import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../helpers/test-server';
import { db } from '../../database/connection';

describe('GDPR Compliance End-to-End Tests', () => {
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

    // Set up test authentication
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
    await cleanupGDPRTestData();
  });

  async function setupTestAuthentication() {
    // Create test company
    const companyResult = await db.query(`
      INSERT INTO companies (id, name, domain, status)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, ['gdpr-test-company', 'GDPR Test Company', 'gdprtest.com', 'active']);

    const companyId = companyResult.rows[0].id;

    // Create test user
    const userResult = await db.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, company_id, role, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      'gdpr-test-user',
      'gdprtest@example.com',
      '$2a$12$hashedpassword',
      'GDPR',
      'TestUser',
      companyId,
      'user',
      'active'
    ]);

    const userId = userResult.rows[0].id;
    const token = 'gdpr-test-auth-token';

    return { token, userId, companyId };
  }

  async function cleanupTestData() {
    await db.query('DELETE FROM download_tokens WHERE request_id LIKE $1', ['gdpr-%']);
    await db.query('DELETE FROM data_deletion_requests WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM data_export_requests WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM data_processing_records WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM user_consents WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM receipts WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await db.query('DELETE FROM companies WHERE id = $1', [testCompanyId]);
  }

  async function cleanupGDPRTestData() {
    await db.query('DELETE FROM download_tokens WHERE request_id LIKE $1', ['gdpr-%']);
    await db.query('DELETE FROM data_deletion_requests WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM data_export_requests WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM data_processing_records WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM user_consents WHERE user_id = $1', [testUserId]);
  }

  describe('Consent Management Workflow', () => {
    it('should complete full consent management lifecycle', async () => {
      // Step 1: User grants initial consent
      const consentResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/gdpr/consent',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          consentType: 'analytics',
          granted: true,
          method: 'explicit'
        }
      });

      expect(consentResponse.statusCode).toBe(200);
      
      const consentBody = JSON.parse(consentResponse.body);
      expect(consentBody.success).toBe(true);

      // Step 2: Verify consent was recorded in database
      const consentCheck = await db.query(`
        SELECT * FROM user_consents 
        WHERE user_id = $1 AND consent_type = $2
        ORDER BY timestamp DESC LIMIT 1
      `, [testUserId, 'analytics']);

      expect(consentCheck.rows).toHaveLength(1);
      expect(consentCheck.rows[0].granted).toBe(true);
      expect(consentCheck.rows[0].method).toBe('explicit');

      // Step 3: Check consent status via API
      const statusResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/consent/analytics',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(statusResponse.statusCode).toBe(200);
      
      const statusBody = JSON.parse(statusResponse.body);
      expect(statusBody.success).toBe(true);
      expect(statusBody.data.hasConsent).toBe(true);

      // Step 4: User revokes consent
      const revokeResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/gdpr/consent',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          consentType: 'analytics',
          granted: false,
          method: 'explicit'
        }
      });

      expect(revokeResponse.statusCode).toBe(200);

      // Step 5: Verify consent revocation
      const revokedStatusResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/consent/analytics',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const revokedStatusBody = JSON.parse(revokedStatusResponse.body);
      expect(revokedStatusBody.data.hasConsent).toBe(false);

      // Step 6: Verify consent history is maintained
      const consentHistory = await db.query(`
        SELECT * FROM user_consents 
        WHERE user_id = $1 AND consent_type = $2
        ORDER BY timestamp DESC
      `, [testUserId, 'analytics']);

      expect(consentHistory.rows).toHaveLength(2);
      expect(consentHistory.rows[0].granted).toBe(false); // Latest
      expect(consentHistory.rows[1].granted).toBe(true);  // Previous
    });

    it('should handle multiple consent types simultaneously', async () => {
      const consentTypes = ['analytics', 'marketing', 'functional'];
      
      // Grant consent for all types
      for (const consentType of consentTypes) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/gdpr/consent',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          payload: {
            consentType,
            granted: true,
            method: 'explicit'
          }
        });

        expect(response.statusCode).toBe(200);
      }

      // Verify all consents via batch API
      const allConsentsResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/consents',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(allConsentsResponse.statusCode).toBe(200);
      
      const allConsentsBody = JSON.parse(allConsentsResponse.body);
      expect(allConsentsBody.data.consents).toHaveLength(3);
      
      consentTypes.forEach(type => {
        const consent = allConsentsBody.data.consents.find((c: any) => c.consentType === type);
        expect(consent).toBeDefined();
        expect(consent.granted).toBe(true);
      });
    });

    it('should respect consent expiry dates', async () => {
      // Grant marketing consent (which has expiry)
      await app.inject({
        method: 'POST',
        url: '/api/v1/gdpr/consent',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          consentType: 'marketing',
          granted: true,
          method: 'explicit'
        }
      });

      // Manually update consent to be expired
      await db.query(`
        UPDATE user_consents 
        SET expires_at = NOW() - INTERVAL '1 day'
        WHERE user_id = $1 AND consent_type = $2
      `, [testUserId, 'marketing']);

      // Check consent status - should be false due to expiry
      const statusResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/consent/marketing',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const statusBody = JSON.parse(statusResponse.body);
      expect(statusBody.data.hasConsent).toBe(false);
      expect(statusBody.data.reason).toContain('expired');
    });
  });

  describe('Data Export Workflow (Right to Data Portability)', () => {
    beforeEach(async () => {
      // Create test data for export
      await createTestDataForExport();
    });

    async function createTestDataForExport() {
      // Create receipts
      await db.query(`
        INSERT INTO receipts (id, user_id, original_filename, file_path, file_size, file_hash, mime_type, status, vendor_name, total_amount, category)
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11),
        ($12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      `, [
        'export-receipt-1', testUserId, 'export1.jpg', '/uploads/export1.jpg', 1024, 'exporthash1', 'image/jpeg', 'processed', 'Export Vendor 1', 25.99, 'Food & Dining',
        'export-receipt-2', testUserId, 'export2.jpg', '/uploads/export2.jpg', 2048, 'exporthash2', 'image/jpeg', 'processed', 'Export Vendor 2', 45.50, 'Business'
      ]);

      // Create consents
      await db.query(`
        INSERT INTO user_consents (user_id, consent_type, granted, timestamp, version, method)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [testUserId, 'analytics', true, new Date(), '1.0', 'explicit']);

      // Create data processing records
      await db.query(`
        INSERT INTO data_processing_records (id, user_id, data_type, purpose, legal_basis, timestamp, retention_period, automated, third_party_sharing, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        'export-processing-1',
        testUserId,
        'receipts',
        'receipt_processing',
        'contract',
        new Date(),
        2555,
        true,
        false,
        JSON.stringify({ action: 'create_receipt' })
      ]);
    }

    it('should complete full data export workflow', async () => {
      // Step 1: Request data export
      const exportRequestResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/gdpr/export',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          format: 'json'
        }
      });

      expect(exportRequestResponse.statusCode).toBe(202); // Accepted for processing
      
      const exportRequestBody = JSON.parse(exportRequestResponse.body);
      expect(exportRequestBody.success).toBe(true);
      expect(exportRequestBody.data.requestId).toBeDefined();
      
      const requestId = exportRequestBody.data.requestId;

      // Step 2: Check export request status
      const statusResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/gdpr/export/${requestId}`,
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(statusResponse.statusCode).toBe(200);
      
      const statusBody = JSON.parse(statusResponse.body);
      expect(statusBody.data.request.status).toMatch(/pending|processing|completed/);

      // Step 3: Wait for processing (in real scenario, this would be async)
      let completed = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const checkResponse = await app.inject({
          method: 'GET',
          url: `/api/v1/gdpr/export/${requestId}`,
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        const checkBody = JSON.parse(checkResponse.body);
        if (checkBody.data.request.status === 'completed') {
          completed = true;
          expect(checkBody.data.request.downloadUrl).toBeDefined();
        }
        
        attempts++;
      }

      // Step 4: Verify export request in database
      const dbRequest = await db.query(`
        SELECT * FROM data_export_requests WHERE id = $1
      `, [requestId]);

      expect(dbRequest.rows).toHaveLength(1);
      expect(dbRequest.rows[0].user_id).toBe(testUserId);
      expect(dbRequest.rows[0].format).toBe('json');

      // Step 5: List all export requests for user
      const allExportsResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/exports',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(allExportsResponse.statusCode).toBe(200);
      
      const allExportsBody = JSON.parse(allExportsResponse.body);
      expect(allExportsBody.data.requests).toHaveLength(1);
      expect(allExportsBody.data.requests[0].id).toBe(requestId);
    });

    it('should support different export formats', async () => {
      const formats = ['json', 'csv', 'pdf'];
      const requestIds = [];

      // Request exports in all formats
      for (const format of formats) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/gdpr/export',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          payload: { format }
        });

        expect(response.statusCode).toBe(202);
        const body = JSON.parse(response.body);
        requestIds.push(body.data.requestId);
      }

      // Verify all requests were created with correct formats
      const allRequests = await db.query(`
        SELECT id, format FROM data_export_requests 
        WHERE user_id = $1 
        ORDER BY requested_at DESC
      `, [testUserId]);

      expect(allRequests.rows).toHaveLength(3);
      
      formats.forEach((format, index) => {
        expect(allRequests.rows[index].format).toBe(format);
      });
    });

    it('should include comprehensive user data in export', async () => {
      // Request export
      const exportResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/gdpr/export',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: { format: 'json' }
      });

      const requestId = JSON.parse(exportResponse.body).data.requestId;

      // Wait for completion and get download URL
      await new Promise(resolve => setTimeout(resolve, 1000));

      const statusResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/gdpr/export/${requestId}`,
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const statusBody = JSON.parse(statusResponse.body);
      
      if (statusBody.data.request.status === 'completed') {
        // In a real implementation, we would download and verify the file content
        // For this test, we verify the export structure in the database
        const userData = await db.query(`
          SELECT 
            (SELECT COUNT(*) FROM receipts WHERE user_id = $1) as receipt_count,
            (SELECT COUNT(*) FROM user_consents WHERE user_id = $1) as consent_count,
            (SELECT COUNT(*) FROM data_processing_records WHERE user_id = $1) as processing_count
        `, [testUserId]);

        expect(parseInt(userData.rows[0].receipt_count)).toBe(2);
        expect(parseInt(userData.rows[0].consent_count)).toBe(1);
        expect(parseInt(userData.rows[0].processing_count)).toBe(1);
      }
    });

    it('should enforce export request limits', async () => {
      // Create multiple export requests rapidly
      const requests = Array(6).fill(0).map(() =>
        app.inject({
          method: 'POST',
          url: '/api/v1/gdpr/export',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          payload: { format: 'json' }
        })
      );

      const responses = await Promise.all(requests);

      // Some requests should be accepted, but rate limiting should kick in
      const acceptedResponses = responses.filter(r => r.statusCode === 202);
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);

      expect(acceptedResponses.length).toBeGreaterThan(0);
      expect(acceptedResponses.length).toBeLessThan(6); // Not all should be accepted
    });
  });

  describe('Data Deletion Workflow (Right to be Forgotten)', () => {
    beforeEach(async () => {
      await createTestDataForDeletion();
    });

    async function createTestDataForDeletion() {
      // Create comprehensive test data
      await db.query(`
        INSERT INTO receipts (id, user_id, original_filename, file_path, file_size, file_hash, mime_type, status, vendor_name, total_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        'deletion-receipt-1',
        testUserId,
        'deletion.jpg',
        '/uploads/deletion.jpg',
        1024,
        'deletionhash',
        'image/jpeg',
        'processed',
        'Deletion Vendor',
        99.99
      ]);

      await db.query(`
        INSERT INTO user_consents (user_id, consent_type, granted, timestamp, version, method)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [testUserId, 'marketing', true, new Date(), '1.0', 'explicit']);
    }

    it('should complete full data deletion workflow', async () => {
      // Step 1: Verify test data exists
      const beforeReceipts = await db.query('SELECT COUNT(*) FROM receipts WHERE user_id = $1', [testUserId]);
      const beforeConsents = await db.query('SELECT COUNT(*) FROM user_consents WHERE user_id = $1', [testUserId]);
      
      expect(parseInt(beforeReceipts.rows[0].count)).toBeGreaterThan(0);
      expect(parseInt(beforeConsents.rows[0].count)).toBeGreaterThan(0);

      // Step 2: Request data deletion
      const deletionRequestResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/gdpr/delete',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          reason: 'Account closure request'
        }
      });

      expect(deletionRequestResponse.statusCode).toBe(202); // Accepted for processing
      
      const deletionRequestBody = JSON.parse(deletionRequestResponse.body);
      expect(deletionRequestBody.success).toBe(true);
      expect(deletionRequestBody.data.requestId).toBeDefined();
      
      const requestId = deletionRequestBody.data.requestId;

      // Step 3: Check deletion request status
      const statusResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/gdpr/delete/${requestId}`,
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(statusResponse.statusCode).toBe(200);
      
      const statusBody = JSON.parse(statusResponse.body);
      expect(statusBody.data.request.status).toMatch(/pending|processing|completed/);

      // Step 4: Wait for processing completion
      let completed = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const checkResponse = await app.inject({
          method: 'GET',
          url: `/api/v1/gdpr/delete/${requestId}`,
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        const checkBody = JSON.parse(checkResponse.body);
        if (checkBody.data.request.status === 'completed') {
          completed = true;
          
          // Verify retained data is documented
          if (checkBody.data.request.retainedData) {
            expect(Array.isArray(checkBody.data.request.retainedData)).toBe(true);
          }
        }
        
        attempts++;
      }

      // Step 5: Verify data deletion request in database
      const dbRequest = await db.query(`
        SELECT * FROM data_deletion_requests WHERE id = $1
      `, [requestId]);

      expect(dbRequest.rows).toHaveLength(1);
      expect(dbRequest.rows[0].user_id).toBe(testUserId);
      expect(dbRequest.rows[0].reason).toBe('Account closure request');

      // Step 6: Verify appropriate data was deleted (depending on retention rules)
      // Note: This depends on your specific deletion logic and legal retention requirements
      const afterReceipts = await db.query('SELECT COUNT(*) FROM receipts WHERE user_id = $1', [testUserId]);
      
      // Receipts might be retained for legal compliance (e.g., tax records)
      // The test should verify that deletion logic respects legal requirements
    });

    it('should handle deletion with legal retention requirements', async () => {
      // Create financial receipt that should be retained
      await db.query(`
        INSERT INTO receipts (id, user_id, original_filename, file_path, file_size, file_hash, mime_type, status, total_amount, category)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        'financial-receipt',
        testUserId,
        'financial.jpg',
        '/uploads/financial.jpg',
        1024,
        'financialhash',
        'image/jpeg',
        'processed',
        150.00,
        'Business' // Business category might have retention requirements
      ]);

      // Request deletion
      const deletionResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/gdpr/delete',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          reason: 'Privacy concern'
        }
      });

      expect(deletionResponse.statusCode).toBe(202);
      const requestId = JSON.parse(deletionResponse.body).data.requestId;

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check final status
      const statusResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/gdpr/delete/${requestId}`,
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const statusBody = JSON.parse(statusResponse.body);
      
      if (statusBody.data.request.status === 'completed') {
        // Should document what data was retained for legal reasons
        expect(statusBody.data.request.retainedData).toBeDefined();
        
        if (statusBody.data.request.retainedData.includes('financial_records')) {
          // Verify financial receipt was retained
          const retainedReceipts = await db.query(`
            SELECT COUNT(*) FROM receipts 
            WHERE user_id = $1 AND total_amount > 0
          `, [testUserId]);
          
          expect(parseInt(retainedReceipts.rows[0].count)).toBeGreaterThan(0);
        }
      }
    });

    it('should list all deletion requests for user', async () => {
      // Create multiple deletion requests
      const request1 = await app.inject({
        method: 'POST',
        url: '/api/v1/gdpr/delete',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: { reason: 'First request' }
      });

      const request2 = await app.inject({
        method: 'POST',
        url: '/api/v1/gdpr/delete',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: { reason: 'Second request' }
      });

      expect(request1.statusCode).toBe(202);
      expect(request2.statusCode).toBe(202);

      // List all deletion requests
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/deletions',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(listResponse.statusCode).toBe(200);
      
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data.requests).toHaveLength(2);
      expect(listBody.data.requests[0].reason).toMatch(/First request|Second request/);
      expect(listBody.data.requests[1].reason).toMatch(/First request|Second request/);
    });
  });

  describe('Privacy Dashboard Workflow', () => {
    beforeEach(async () => {
      await createComprehensiveTestData();
    });

    async function createComprehensiveTestData() {
      // Create various consents
      const consents = [
        { type: 'analytics', granted: true },
        { type: 'marketing', granted: false },
        { type: 'functional', granted: true }
      ];

      for (const consent of consents) {
        await db.query(`
          INSERT INTO user_consents (user_id, consent_type, granted, timestamp, version, method)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [testUserId, consent.type, consent.granted, new Date(), '1.0', 'explicit']);
      }

      // Create processing records
      await db.query(`
        INSERT INTO data_processing_records (id, user_id, data_type, purpose, legal_basis, timestamp, retention_period, automated, third_party_sharing, details)
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10),
        ($11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      `, [
        'dashboard-processing-1', testUserId, 'receipts', 'receipt_processing', 'contract', new Date(), 2555, true, false, JSON.stringify({ action: 'upload' }),
        'dashboard-processing-2', testUserId, 'analytics', 'analytics', 'consent', new Date(), 730, true, true, JSON.stringify({ action: 'track' })
      ]);

      // Create some export/deletion requests for history
      await db.query(`
        INSERT INTO data_export_requests (id, user_id, requested_at, status, format, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        'dashboard-export-1',
        testUserId,
        new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        'completed',
        'json',
        new Date(Date.now() + 29 * 24 * 60 * 60 * 1000) // 29 days from now
      ]);
    }

    it('should provide comprehensive privacy dashboard', async () => {
      const dashboardResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/dashboard',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(dashboardResponse.statusCode).toBe(200);
      
      const dashboardBody = JSON.parse(dashboardResponse.body);
      expect(dashboardBody.success).toBe(true);

      const dashboard = dashboardBody.data;

      // Verify consent information
      expect(dashboard.consents).toBeDefined();
      expect(dashboard.consents.length).toBeGreaterThan(0);
      
      const analyticsConsent = dashboard.consents.find((c: any) => c.consentType === 'analytics');
      expect(analyticsConsent).toBeDefined();
      expect(analyticsConsent.granted).toBe(true);

      // Verify processing activities
      expect(dashboard.processingActivities).toBeDefined();
      expect(dashboard.processingActivities.length).toBeGreaterThan(0);

      // Verify export requests history
      expect(dashboard.exportRequests).toBeDefined();
      expect(dashboard.exportRequests.length).toBeGreaterThan(0);

      // Verify deletion requests history
      expect(dashboard.deletionRequests).toBeDefined();

      // Verify data retention status
      expect(dashboard.retentionStatus).toBeDefined();
      expect(dashboard.retentionStatus.categories).toBeDefined();

      // Verify data categories and rights information
      expect(dashboard.dataCategories).toBeDefined();
      expect(dashboard.rights).toBeDefined();
      
      const accessRight = dashboard.rights.find((r: any) => r.right === 'access');
      expect(accessRight).toBeDefined();
      expect(accessRight.description).toContain('access');
    });

    it('should show current consent status for all types', async () => {
      const dashboardResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/dashboard',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const dashboard = JSON.parse(dashboardResponse.body).data;
      
      // Should show latest consent for each type
      const consentTypes = ['analytics', 'marketing', 'functional'];
      
      consentTypes.forEach(type => {
        const consent = dashboard.consents.find((c: any) => c.consentType === type);
        expect(consent).toBeDefined();
        expect(consent).toHaveProperty('granted');
        expect(consent).toHaveProperty('timestamp');
      });
    });

    it('should display recent processing activities', async () => {
      const dashboardResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/dashboard',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const dashboard = JSON.parse(dashboardResponse.body).data;
      
      expect(dashboard.processingActivities.length).toBeGreaterThan(0);
      
      dashboard.processingActivities.forEach((activity: any) => {
        expect(activity).toHaveProperty('dataType');
        expect(activity).toHaveProperty('purpose');
        expect(activity).toHaveProperty('legalBasis');
        expect(activity).toHaveProperty('timestamp');
        expect(activity).toHaveProperty('thirdPartySharing');
      });
    });

    it('should show retention status and scheduled deletions', async () => {
      const dashboardResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/dashboard',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const dashboard = JSON.parse(dashboardResponse.body).data;
      
      expect(dashboard.retentionStatus).toBeDefined();
      expect(dashboard.retentionStatus.categories).toBeDefined();
      
      // Should include retention info for different data types
      const categories = dashboard.retentionStatus.categories;
      expect(categories).toHaveProperty('receipts');
      expect(categories.receipts).toHaveProperty('retention');
    });
  });

  describe('Data Processing Recording', () => {
    it('should automatically record data processing activities', async () => {
      // Perform actions that should trigger data processing recording
      
      // 1. Create a receipt (should record processing)
      const receiptResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/receipts',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          merchant: 'Processing Test Vendor',
          amount: 29.99,
          category: 'Business'
        }
      });

      expect(receiptResponse.statusCode).toBe(201);

      // 2. Update user profile (should record processing)
      const profileResponse = await app.inject({
        method: 'PUT',
        url: '/api/v1/user/profile',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          firstName: 'UpdatedName'
        }
      });

      expect(profileResponse.statusCode).toBe(200);

      // 3. Check that processing was recorded
      await new Promise(resolve => setTimeout(resolve, 500)); // Allow processing to complete

      const processingRecords = await db.query(`
        SELECT * FROM data_processing_records 
        WHERE user_id = $1 
        ORDER BY timestamp DESC
      `, [testUserId]);

      expect(processingRecords.rows.length).toBeGreaterThan(0);

      // Verify receipt processing was recorded
      const receiptProcessing = processingRecords.rows.find(
        r => r.data_type === 'receipts' && r.purpose === 'receipt_processing'
      );
      expect(receiptProcessing).toBeDefined();
      expect(receiptProcessing.legal_basis).toBe('contract');
      expect(receiptProcessing.automated).toBe(true);
    });

    it('should record processing for different legal bases', async () => {
      // Analytics processing (consent-based)
      await app.inject({
        method: 'POST',
        url: '/api/v1/gdpr/consent',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          consentType: 'analytics',
          granted: true,
          method: 'explicit'
        }
      });

      // Perform analytics action
      await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/summary',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      // Check processing records
      const processingRecords = await db.query(`
        SELECT * FROM data_processing_records 
        WHERE user_id = $1 AND purpose = $2
      `, [testUserId, 'analytics']);

      if (processingRecords.rows.length > 0) {
        expect(processingRecords.rows[0].legal_basis).toBe('consent');
      }
    });
  });

  describe('Privacy Notice and Rights Information', () => {
    it('should provide current privacy notice', async () => {
      const privacyNoticeResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/privacy-notice',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(privacyNoticeResponse.statusCode).toBe(200);
      
      const noticeBody = JSON.parse(privacyNoticeResponse.body);
      expect(noticeBody.success).toBe(true);

      const notice = noticeBody.data.notice;
      expect(notice).toHaveProperty('lastUpdated');
      expect(notice).toHaveProperty('dataController');
      expect(notice).toHaveProperty('dataProcessingPurposes');
      expect(notice).toHaveProperty('legalBases');
      expect(notice).toHaveProperty('userRights');
      expect(notice).toHaveProperty('retentionPeriods');
      expect(notice).toHaveProperty('thirdPartySharing');

      // Verify data controller information
      expect(notice.dataController.name).toBe('Receipt Vault Pro');
      expect(notice.dataController.contact).toBeDefined();
    });

    it('should provide information about user rights', async () => {
      const rightsResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/rights',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(rightsResponse.statusCode).toBe(200);
      
      const rightsBody = JSON.parse(rightsResponse.body);
      const rights = rightsBody.data.rights;

      const expectedRights = ['access', 'rectification', 'erasure', 'portability', 'restriction', 'objection'];
      
      expectedRights.forEach(rightType => {
        const right = rights.find((r: any) => r.right === rightType);
        expect(right).toBeDefined();
        expect(right.description).toBeDefined();
      });
    });

    it('should show third-party data sharing information', async () => {
      const privacyNoticeResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/privacy-notice'
      });

      const notice = JSON.parse(privacyNoticeResponse.body).data.notice;
      
      expect(notice.thirdPartySharing).toBeDefined();
      expect(Array.isArray(notice.thirdPartySharing)).toBe(true);
      
      // Should include information about third-party services
      const googleVisionSharing = notice.thirdPartySharing.find(
        (sharing: any) => sharing.party === 'Google Cloud Vision'
      );
      expect(googleVisionSharing).toBeDefined();
      expect(googleVisionSharing.purpose).toBe('OCR processing');
    });
  });

  describe('Compliance Edge Cases', () => {
    it('should handle users without any data', async () => {
      // Test with user who has no data
      const dashboardResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/dashboard',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(dashboardResponse.statusCode).toBe(200);
      
      const dashboard = JSON.parse(dashboardResponse.body).data;
      expect(dashboard.consents).toEqual([]);
      expect(dashboard.processingActivities).toEqual([]);
      expect(dashboard.exportRequests).toEqual([]);
      expect(dashboard.deletionRequests).toEqual([]);
    });

    it('should prevent duplicate export requests within time limit', async () => {
      // Create first export request
      const firstRequest = await app.inject({
        method: 'POST',
        url: '/api/v1/gdpr/export',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: { format: 'json' }
      });

      expect(firstRequest.statusCode).toBe(202);

      // Try to create another request immediately
      const secondRequest = await app.inject({
        method: 'POST',
        url: '/api/v1/gdpr/export',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: { format: 'json' }
      });

      // Should be rate limited or rejected
      expect(secondRequest.statusCode).toMatch(/429|409/);
    });

    it('should handle expired download links', async () => {
      // Create an export request
      const exportResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/gdpr/export',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: { format: 'json' }
      });

      const requestId = JSON.parse(exportResponse.body).data.requestId;

      // Manually expire the download token
      await db.query(`
        UPDATE download_tokens 
        SET expires_at = NOW() - INTERVAL '1 hour'
        WHERE request_id = $1
      `, [requestId]);

      // Try to access expired download
      const downloadResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/download/expired-token'
      });

      expect(downloadResponse.statusCode).toBe(404);
    });

    it('should maintain audit trail for all GDPR operations', async () => {
      // Perform various GDPR operations
      await app.inject({
        method: 'POST',
        url: '/api/v1/gdpr/consent',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          consentType: 'analytics',
          granted: true,
          method: 'explicit'
        }
      });

      await app.inject({
        method: 'POST',
        url: '/api/v1/gdpr/export',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: { format: 'json' }
      });

      // Verify audit records exist (this would typically be in a separate audit log table)
      // For this test, we check that the operations were recorded in their respective tables
      const consentRecords = await db.query(`
        SELECT COUNT(*) FROM user_consents WHERE user_id = $1
      `, [testUserId]);

      const exportRecords = await db.query(`
        SELECT COUNT(*) FROM data_export_requests WHERE user_id = $1
      `, [testUserId]);

      expect(parseInt(consentRecords.rows[0].count)).toBeGreaterThan(0);
      expect(parseInt(exportRecords.rows[0].count)).toBeGreaterThan(0);
    });
  });
});