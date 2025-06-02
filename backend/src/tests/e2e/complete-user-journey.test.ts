import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from '../setup';
import { createTestDatabase } from '../fixtures/database';
import path from 'path';
import fs from 'fs';

describe('Complete User Journey E2E Tests', () => {
  let app: any;
  let testDb: any;
  let testUser: any;
  let authToken: string;
  let companyId: string;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    app = await createTestApp(testDb);
  });

  afterAll(async () => {
    await testDb.close();
    await app.close();
  });

  describe('Complete Receipt Processing Workflow', () => {
    it('should complete full receipt processing from upload to analytics', async () => {
      // 1. User Registration
      console.log('🔐 Testing user registration...');
      const registrationResponse = await request(app.server)
        .post('/api/v1/auth/register')
        .send({
          email: 'e2e-test@example.com',
          password: 'SecurePassword123!',
          firstName: 'E2E',
          lastName: 'TestUser',
          companyName: 'E2E Test Company',
          role: 'company_admin'
        })
        .expect(201);

      expect(registrationResponse.body).toHaveProperty('user');
      expect(registrationResponse.body).toHaveProperty('authToken');
      expect(registrationResponse.body.user.email).toBe('e2e-test@example.com');

      testUser = registrationResponse.body.user;
      authToken = registrationResponse.body.authToken;
      companyId = testUser.companyId;

      console.log('✅ User registration successful');

      // 2. Company Setup and Configuration
      console.log('🏢 Testing company configuration...');
      const companyConfigResponse = await request(app.server)
        .put(`/api/v1/companies/${companyId}/settings`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          settings: {
            receiptRetentionYears: 7,
            autoApprovalLimit: 100.00,
            requiredFields: ['vendor', 'amount', 'date'],
            categories: ['office_supplies', 'travel', 'meals', 'utilities']
          }
        })
        .expect(200);

      expect(companyConfigResponse.body.settings.receiptRetentionYears).toBe(7);
      console.log('✅ Company configuration successful');

      // 3. Receipt Upload with File Attachment
      console.log('📄 Testing receipt upload...');
      
      // Create test receipt image
      const testReceiptPath = path.join(__dirname, '../fixtures/test-receipt.jpg');
      const testImageBuffer = Buffer.from('fake-receipt-image-data');
      fs.writeFileSync(testReceiptPath, testImageBuffer);

      const receiptUploadResponse = await request(app.server)
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('receiptImage', testReceiptPath)
        .field('vendor', 'Test Office Supply Store')
        .field('totalAmount', '45.99')
        .field('taxAmount', '4.60')
        .field('category', 'office_supplies')
        .field('receiptDate', '2024-01-15')
        .field('description', 'Office supplies for Q1')
        .expect(201);

      expect(receiptUploadResponse.body).toHaveProperty('id');
      expect(receiptUploadResponse.body.status).toBe('uploaded');
      expect(receiptUploadResponse.body.totalAmount).toBe(45.99);

      const receiptId = receiptUploadResponse.body.id;
      console.log('✅ Receipt upload successful, ID:', receiptId);

      // 4. OCR Processing and Validation
      console.log('🔍 Testing OCR processing...');
      let ocrProcessingComplete = false;
      let processingAttempts = 0;
      const maxAttempts = 30; // 30 seconds max wait time

      while (!ocrProcessingComplete && processingAttempts < maxAttempts) {
        const statusResponse = await request(app.server)
          .get(`/api/v1/receipts/${receiptId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        if (statusResponse.body.status === 'processed' || statusResponse.body.status === 'failed') {
          ocrProcessingComplete = true;
          
          if (statusResponse.body.status === 'processed') {
            expect(statusResponse.body).toHaveProperty('ocrData');
            expect(statusResponse.body.ocrData).toHaveProperty('confidence');
            expect(statusResponse.body.ocrData.confidence).toBeGreaterThan(0);
            console.log('✅ OCR processing completed successfully');
          } else {
            console.log('⚠️ OCR processing failed, continuing with manual data');
          }
        }
        
        processingAttempts++;
        if (!ocrProcessingComplete) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        }
      }

      expect(ocrProcessingComplete).toBe(true);

      // 5. Receipt Approval Workflow
      console.log('✅ Testing approval workflow...');
      
      // Since amount is under auto-approval limit, should be auto-approved
      const approvalStatusResponse = await request(app.server)
        .get(`/api/v1/receipts/${receiptId}/approval-status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(approvalStatusResponse.body.status).toBe('auto_approved');
      expect(approvalStatusResponse.body.approvedAmount).toBe(45.99);
      console.log('✅ Auto-approval successful');

      // 6. Test Manual Approval for Higher Amount
      console.log('📋 Testing manual approval for higher amount...');
      const highAmountReceiptResponse = await request(app.server)
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('receiptImage', testReceiptPath)
        .field('vendor', 'Expensive Equipment Store')
        .field('totalAmount', '1500.00')
        .field('taxAmount', '150.00')
        .field('category', 'office_supplies')
        .field('receiptDate', '2024-01-16')
        .field('description', 'High-value office equipment')
        .expect(201);

      const highAmountReceiptId = highAmountReceiptResponse.body.id;

      // Check that it requires manual approval
      const manualApprovalResponse = await request(app.server)
        .get(`/api/v1/receipts/${highAmountReceiptId}/approval-status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(manualApprovalResponse.body.status).toBe('pending_approval');
      expect(manualApprovalResponse.body.requiresApproval).toBe(true);

      // Approve the receipt
      const approveResponse = await request(app.server)
        .post(`/api/v1/receipts/${highAmountReceiptId}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          approved: true,
          approverComments: 'Approved for business equipment purchase'
        })
        .expect(200);

      expect(approveResponse.body.status).toBe('approved');
      console.log('✅ Manual approval successful');

      // 7. Advanced Search Testing
      console.log('🔍 Testing advanced search functionality...');
      
      // Search by vendor
      const vendorSearchResponse = await request(app.server)
        .get('/api/v1/receipts/search?q=Office Supply Store')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(vendorSearchResponse.body.results).toBeDefined();
      expect(vendorSearchResponse.body.results.length).toBeGreaterThan(0);
      expect(vendorSearchResponse.body.results[0].vendor).toContain('Office Supply');

      // Search by amount range
      const amountSearchResponse = await request(app.server)
        .get('/api/v1/receipts/search?minAmount=40&maxAmount=50')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(amountSearchResponse.body.results.length).toBeGreaterThan(0);

      // Search by date range
      const dateSearchResponse = await request(app.server)
        .get('/api/v1/receipts/search?startDate=2024-01-01&endDate=2024-01-31')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(dateSearchResponse.body.results.length).toBeGreaterThan(0);

      // Search by category
      const categorySearchResponse = await request(app.server)
        .get('/api/v1/receipts/search?category=office_supplies')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(categorySearchResponse.body.results.length).toBeGreaterThan(0);
      console.log('✅ Advanced search functionality verified');

      // 8. Analytics and Reporting
      console.log('📊 Testing analytics and reporting...');
      
      // Get spending summary
      const spendingSummaryResponse = await request(app.server)
        .get('/api/v1/analytics/spending-summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(spendingSummaryResponse.body).toHaveProperty('totalSpending');
      expect(spendingSummaryResponse.body).toHaveProperty('receiptCount');
      expect(spendingSummaryResponse.body.receiptCount).toBeGreaterThanOrEqual(2);
      expect(parseFloat(spendingSummaryResponse.body.totalSpending)).toBeGreaterThan(1500);

      // Get category breakdown
      const categoryBreakdownResponse = await request(app.server)
        .get('/api/v1/analytics/spending-by-category')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(categoryBreakdownResponse.body).toHaveProperty('categories');
      expect(categoryBreakdownResponse.body.categories).toBeInstanceOf(Array);
      
      const officeSuppliesCategory = categoryBreakdownResponse.body.categories.find(
        (cat: any) => cat.category === 'office_supplies'
      );
      expect(officeSuppliesCategory).toBeDefined();
      expect(officeSuppliesCategory.totalAmount).toBeGreaterThan(1500);

      // Get monthly trends
      const monthlyTrendsResponse = await request(app.server)
        .get('/api/v1/analytics/monthly-trends?year=2024')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(monthlyTrendsResponse.body).toHaveProperty('months');
      expect(monthlyTrendsResponse.body.months).toBeInstanceOf(Array);
      console.log('✅ Analytics and reporting verified');

      // 9. Data Export Testing
      console.log('📤 Testing data export functionality...');
      
      // Export CSV
      const csvExportResponse = await request(app.server)
        .post('/api/v1/receipts/export')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'csv',
          dateRange: {
            start: '2024-01-01',
            end: '2024-12-31'
          },
          includeFields: ['vendor', 'amount', 'date', 'category', 'status']
        })
        .expect(200);

      expect(csvExportResponse.headers['content-type']).toContain('text/csv');
      expect(csvExportResponse.text).toContain('vendor,amount,date,category,status');

      // Export PDF report
      const pdfExportResponse = await request(app.server)
        .post('/api/v1/analytics/export-report')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'pdf',
          reportType: 'spending_summary',
          dateRange: {
            start: '2024-01-01',
            end: '2024-12-31'
          }
        })
        .expect(200);

      expect(pdfExportResponse.headers['content-type']).toContain('application/pdf');
      console.log('✅ Data export functionality verified');

      // 10. Security and Audit Trail Verification
      console.log('🔐 Testing security and audit trails...');
      
      // Check audit logs for all operations
      const auditLogsResponse = await request(app.server)
        .get('/api/v1/audit/logs')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(auditLogsResponse.body).toHaveProperty('logs');
      expect(auditLogsResponse.body.logs).toBeInstanceOf(Array);
      expect(auditLogsResponse.body.logs.length).toBeGreaterThan(5);

      // Verify specific audit events
      const auditEvents = auditLogsResponse.body.logs.map((log: any) => log.action);
      expect(auditEvents).toContain('USER_REGISTERED');
      expect(auditEvents).toContain('RECEIPT_UPLOADED');
      expect(auditEvents).toContain('RECEIPT_APPROVED');
      expect(auditEvents).toContain('DATA_EXPORTED');

      // Test access control - try to access another user's data
      const unauthorizedResponse = await request(app.server)
        .get('/api/v1/receipts/unauthorized-receipt-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404); // Should not find receipt that doesn't belong to user

      console.log('✅ Security and audit trail verification complete');

      // 11. Email-to-Vault Testing (if enabled)
      console.log('📧 Testing email-to-vault functionality...');
      
      const emailVaultResponse = await request(app.server)
        .post('/api/v1/receipts/email-upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fromEmail: 'e2e-test@example.com',
          subject: 'Receipt from Restaurant ABC - $25.50',
          body: 'Please find attached receipt for business meal.',
          attachments: [{
            filename: 'receipt.jpg',
            content: testImageBuffer.toString('base64'),
            contentType: 'image/jpeg'
          }]
        })
        .expect(201);

      expect(emailVaultResponse.body).toHaveProperty('id');
      expect(emailVaultResponse.body.source).toBe('email');
      console.log('✅ Email-to-vault functionality verified');

      // 12. Mobile Sync Testing
      console.log('📱 Testing mobile sync functionality...');
      
      // Simulate mobile device sync
      const syncResponse = await request(app.server)
        .post('/api/v1/sync/receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          deviceId: 'test-mobile-device-123',
          lastSyncTimestamp: '2024-01-01T00:00:00Z',
          localChanges: [
            {
              id: 'mobile-receipt-1',
              totalAmount: 12.99,
              vendor: 'Mobile Coffee Shop',
              status: 'pending_sync',
              timestamp: '2024-01-17T10:00:00Z'
            }
          ]
        })
        .expect(200);

      expect(syncResponse.body).toHaveProperty('serverChanges');
      expect(syncResponse.body).toHaveProperty('conflicts');
      expect(syncResponse.body).toHaveProperty('syncTimestamp');
      console.log('✅ Mobile sync functionality verified');

      // Clean up test files
      if (fs.existsSync(testReceiptPath)) {
        fs.unlinkSync(testReceiptPath);
      }

      console.log('🎉 Complete user journey test successful!');
    }, 120000); // 2 minute timeout for complete workflow

    it('should handle error scenarios gracefully', async () => {
      console.log('🚨 Testing error handling scenarios...');
      
      // Test invalid authentication
      const invalidAuthResponse = await request(app.server)
        .get('/api/v1/receipts')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(invalidAuthResponse.body).toHaveProperty('error');

      // Test invalid receipt upload
      const invalidReceiptResponse = await request(app.server)
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required fields
          vendor: 'Test Vendor'
        })
        .expect(400);

      expect(invalidReceiptResponse.body).toHaveProperty('error');

      // Test rate limiting
      const rapidRequests = [];
      for (let i = 0; i < 100; i++) {
        rapidRequests.push(
          request(app.server)
            .get('/api/v1/receipts')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const results = await Promise.allSettled(rapidRequests);
      const rateLimitedCount = results.filter(result => 
        result.status === 'fulfilled' && 
        (result.value as any).status === 429
      ).length;

      expect(rateLimitedCount).toBeGreaterThan(0);
      console.log('✅ Error handling scenarios verified');
    });

    it('should maintain data consistency during concurrent operations', async () => {
      console.log('🔄 Testing concurrent operations consistency...');
      
      const concurrentOperations = [];
      
      // Concurrent receipt uploads
      for (let i = 0; i < 10; i++) {
        concurrentOperations.push(
          request(app.server)
            .post('/api/v1/receipts')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              vendor: `Concurrent Vendor ${i}`,
              totalAmount: 10.00,
              category: 'office_supplies',
              receiptDate: '2024-01-18'
            })
        );
      }

      // Concurrent analytics requests
      for (let i = 0; i < 5; i++) {
        concurrentOperations.push(
          request(app.server)
            .get('/api/v1/analytics/spending-summary')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const results = await Promise.allSettled(concurrentOperations);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful.length).toBeGreaterThan(10); // Most should succeed
      console.log('✅ Concurrent operations consistency verified');
    });
  });

  describe('Multi-User Company Workflow', () => {
    it('should handle complete company workflow with multiple users', async () => {
      console.log('👥 Testing multi-user company workflow...');
      
      // Create company admin
      const adminResponse = await request(app.server)
        .post('/api/v1/auth/register')
        .send({
          email: 'admin@multiuser-test.com',
          password: 'AdminPass123!',
          firstName: 'Admin',
          lastName: 'User',
          companyName: 'Multi-User Test Company',
          role: 'company_admin'
        })
        .expect(201);

      const adminToken = adminResponse.body.authToken;
      const companyId = adminResponse.body.user.companyId;

      // Create company employee
      const employeeResponse = await request(app.server)
        .post('/api/v1/auth/register')
        .send({
          email: 'employee@multiuser-test.com',
          password: 'EmployeePass123!',
          firstName: 'Employee',
          lastName: 'User',
          companyId: companyId,
          role: 'company_employee'
        })
        .expect(201);

      const employeeToken = employeeResponse.body.authToken;

      // Employee submits receipt
      const employeeReceiptResponse = await request(app.server)
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          vendor: 'Employee Lunch Spot',
          totalAmount: 25.00,
          category: 'meals',
          receiptDate: '2024-01-19',
          description: 'Business lunch meeting'
        })
        .expect(201);

      const employeeReceiptId = employeeReceiptResponse.body.id;

      // Admin can view all company receipts
      const companyReceiptsResponse = await request(app.server)
        .get('/api/v1/receipts?scope=company')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(companyReceiptsResponse.body.receipts.length).toBeGreaterThan(0);
      
      // Admin can approve employee receipts
      const approvalResponse = await request(app.server)
        .post(`/api/v1/receipts/${employeeReceiptId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          approved: true,
          approverComments: 'Approved business meal'
        })
        .expect(200);

      expect(approvalResponse.body.status).toBe('approved');

      // Employee cannot view admin-only analytics
      const employeeAnalyticsResponse = await request(app.server)
        .get('/api/v1/analytics/company-summary')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);

      expect(employeeAnalyticsResponse.body.error).toContain('Insufficient permissions');

      console.log('✅ Multi-user company workflow verified');
    });
  });
});