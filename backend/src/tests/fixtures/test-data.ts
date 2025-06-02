import { v4 as uuidv4 } from 'uuid';

// Test Data Factories
export class TestDataFactory {
  static createUser(overrides: Partial<any> = {}) {
    return {
      id: uuidv4(),
      email: `test.user.${Date.now()}@example.com`,
      name: 'Test User',
      organizationId: uuidv4(),
      workosUserId: `user_${uuidv4().replace(/-/g, '')}`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static createOrganization(overrides: Partial<any> = {}) {
    return {
      id: uuidv4(),
      name: 'Test Organization',
      workosOrganizationId: `org_${uuidv4().replace(/-/g, '')}`,
      domain: 'test-org.com',
      settings: {
        receiptRetentionDays: 2555, // 7 years
        autoCategorizationEnabled: true,
        exportFormats: ['pdf', 'csv', 'excel']
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static createReceipt(userId: string, overrides: Partial<any> = {}) {
    return {
      id: uuidv4(),
      userId,
      organizationId: uuidv4(),
      merchant: 'Test Merchant Inc.',
      amount: 99.99,
      currency: 'USD',
      date: new Date(),
      category: 'Business Meals',
      subcategory: 'Client Entertainment',
      description: 'Business lunch with client',
      paymentMethod: 'Credit Card',
      receiptNumber: `REC-${Date.now()}`,
      taxAmount: 8.00,
      tipAmount: 15.00,
      tags: ['business', 'client', 'lunch'],
      metadata: {
        uploadedVia: 'mobile_app',
        ocrConfidence: 0.95,
        autoProcessed: true
      },
      fileUrl: `https://storage.example.com/receipts/${uuidv4()}.jpg`,
      thumbnailUrl: `https://storage.example.com/thumbnails/${uuidv4()}.jpg`,
      status: 'processed',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static createExpenseReport(userId: string, organizationId: string, overrides: Partial<any> = {}) {
    return {
      id: uuidv4(),
      userId,
      organizationId,
      title: `Expense Report - ${new Date().toLocaleDateString()}`,
      description: 'Monthly business expenses',
      status: 'draft',
      period: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      },
      totalAmount: 0,
      submittedAt: null,
      approvedAt: null,
      receipts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static createFileUpload(overrides: Partial<any> = {}) {
    return {
      id: uuidv4(),
      filename: 'test-receipt.jpg',
      originalName: 'receipt-photo.jpg',
      mimetype: 'image/jpeg',
      size: 1024 * 500, // 500KB
      path: '/tmp/uploads/test-receipt.jpg',
      url: `https://storage.example.com/uploads/${uuidv4()}.jpg`,
      metadata: {
        width: 1920,
        height: 1080,
        format: 'jpeg'
      },
      uploadedAt: new Date(),
      ...overrides
    };
  }

  static createOCRResult(overrides: Partial<any> = {}) {
    return {
      id: uuidv4(),
      receiptId: uuidv4(),
      extractedText: 'Test Merchant\n123 Main St\nTotal: $99.99\nDate: 2024-01-15',
      confidence: 0.95,
      extractedData: {
        merchant: 'Test Merchant',
        amount: 99.99,
        date: '2024-01-15',
        items: [
          { name: 'Test Item 1', price: 49.99 },
          { name: 'Test Item 2', price: 49.99 }
        ],
        tax: 8.00,
        total: 99.99
      },
      processingTime: 2.5,
      provider: 'google_vision',
      createdAt: new Date(),
      ...overrides
    };
  }

  static createAPIRequest(overrides: Partial<any> = {}) {
    return {
      method: 'POST',
      url: '/api/v1/receipts',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'X-Request-ID': uuidv4()
      },
      body: {},
      timestamp: new Date(),
      ...overrides
    };
  }

  static createAPIResponse(overrides: Partial<any> = {}) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': uuidv4(),
        'X-Response-Time': '125ms'
      },
      data: {
        success: true,
        message: 'Operation completed successfully'
      },
      timestamp: new Date(),
      ...overrides
    };
  }
}

// Test Database Helpers
export class TestDatabaseHelpers {
  static async cleanupDatabase(db: any) {
    // Clean up in reverse dependency order
    await db.query('DELETE FROM expense_reports_receipts');
    await db.query('DELETE FROM expense_reports');
    await db.query('DELETE FROM receipts');
    await db.query('DELETE FROM users');
    await db.query('DELETE FROM organizations');
  }

  static async createTestUser(db: any, userData?: Partial<any>) {
    const user = TestDataFactory.createUser(userData);
    const result = await db.query(`
      INSERT INTO users (id, email, name, organization_id, workos_user_id, email_verified, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      user.id, user.email, user.name, user.organizationId, 
      user.workosUserId, user.emailVerified, user.createdAt, user.updatedAt
    ]);
    return result.rows[0];
  }

  static async createTestOrganization(db: any, orgData?: Partial<any>) {
    const org = TestDataFactory.createOrganization(orgData);
    const result = await db.query(`
      INSERT INTO organizations (id, name, workos_organization_id, domain, settings, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      org.id, org.name, org.workosOrganizationId, org.domain,
      JSON.stringify(org.settings), org.createdAt, org.updatedAt
    ]);
    return result.rows[0];
  }

  static async createTestReceipt(db: any, userId: string, receiptData?: Partial<any>) {
    const receipt = TestDataFactory.createReceipt(userId, receiptData);
    const result = await db.query(`
      INSERT INTO receipts (
        id, user_id, organization_id, merchant, amount, currency, date, 
        category, subcategory, description, payment_method, receipt_number,
        tax_amount, tip_amount, tags, metadata, file_url, thumbnail_url,
        status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      ) RETURNING *
    `, [
      receipt.id, receipt.userId, receipt.organizationId, receipt.merchant,
      receipt.amount, receipt.currency, receipt.date, receipt.category,
      receipt.subcategory, receipt.description, receipt.paymentMethod,
      receipt.receiptNumber, receipt.taxAmount, receipt.tipAmount,
      receipt.tags, JSON.stringify(receipt.metadata), receipt.fileUrl,
      receipt.thumbnailUrl, receipt.status, receipt.createdAt, receipt.updatedAt
    ]);
    return result.rows[0];
  }
}

// Mock Services
export class MockServices {
  static createMockOCRService() {
    return {
      processReceipt: jest.fn().mockResolvedValue(TestDataFactory.createOCRResult()),
      extractText: jest.fn().mockResolvedValue('Mocked extracted text'),
      getConfidenceScore: jest.fn().mockReturnValue(0.95)
    };
  }

  static createMockStorageService() {
    return {
      uploadFile: jest.fn().mockResolvedValue({
        url: 'https://storage.example.com/file.jpg',
        key: 'uploads/file.jpg'
      }),
      deleteFile: jest.fn().mockResolvedValue(true),
      getSignedUrl: jest.fn().mockReturnValue('https://storage.example.com/signed-url')
    };
  }

  static createMockEmailService() {
    return {
      sendEmail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
      sendReceiptProcessedNotification: jest.fn().mockResolvedValue(true),
      sendExpenseReportSubmitted: jest.fn().mockResolvedValue(true)
    };
  }

  static createMockAuthService() {
    return {
      verifyToken: jest.fn().mockResolvedValue({ userId: 'test-user-123' }),
      generateToken: jest.fn().mockReturnValue('test-jwt-token'),
      refreshToken: jest.fn().mockResolvedValue('new-test-jwt-token')
    };
  }
}

// HTTP Testing Helpers
export class HTTPTestHelpers {
  static createAuthHeaders(token: string = 'test-token') {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Request-ID': uuidv4()
    };
  }

  static createMultipartHeaders(token: string = 'test-token') {
    return {
      'Authorization': `Bearer ${token}`,
      'X-Request-ID': uuidv4()
    };
  }

  static assertSuccessResponse(response: any) {
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
  }

  static assertErrorResponse(response: any, expectedStatus: number, expectedMessage?: string) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    if (expectedMessage) {
      expect(response.body.error).toContain(expectedMessage);
    }
  }

  static assertValidationError(response: any, field?: string) {
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('validation');
    if (field) {
      expect(response.body.error).toContain(field);
    }
  }
}

// Performance Testing Helpers
export class PerformanceTestHelpers {
  static async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; executionTime: number }> {
    const startTime = Date.now();
    const result = await fn();
    const executionTime = Date.now() - startTime;
    return { result, executionTime };
  }

  static expectPerformance(executionTime: number, maxTime: number) {
    expect(executionTime).toBeLessThanOrEqual(maxTime);
  }

  static async loadTest(fn: () => Promise<any>, concurrent: number = 10): Promise<any[]> {
    const promises = Array(concurrent).fill(null).map(() => fn());
    return Promise.all(promises);
  }
}

export { TestDataFactory as Factory, MockServices as Mocks }; 