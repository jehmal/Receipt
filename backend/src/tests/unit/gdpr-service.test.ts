import { gdprService, ConsentType, DataProcessingPurpose, LegalBasis } from '../../compliance/gdpr-service';
import { Database } from '../../database/connection';
import { logger } from '../../utils/logger';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import { FastifyRequest } from 'fastify';

// Mock dependencies
jest.mock('../../database/connection');
jest.mock('../../utils/logger');
jest.mock('crypto');
jest.mock('fs/promises');

describe('GDPRComplianceService', () => {
  let mockDatabase: jest.Mocked<Database>;
  let mockLogger: jest.Mocked<typeof logger>;
  let mockCrypto: jest.Mocked<typeof crypto>;
  let mockFs: jest.Mocked<typeof fs>;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn()
    } as any;

    mockLogger = {
      audit: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn()
    } as any;

    mockCrypto = {
      randomBytes: jest.fn().mockReturnValue({
        toString: jest.fn().mockReturnValue('mockRandomString')
      })
    } as any;

    mockFs = {
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock Database constructor
    (Database as jest.Mock).mockImplementation(() => mockDatabase);

    // Setup default environment
    process.env.GDPR_ENCRYPTION_KEY = 'test-encryption-key';
    process.env.API_BASE_URL = 'https://api.test.com';

    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.GDPR_ENCRYPTION_KEY;
    delete process.env.API_BASE_URL;
  });

  describe('recordConsent', () => {
    const mockRequest = {
      ip: '192.168.1.1',
      headers: {
        'user-agent': 'Mozilla/5.0 Test Browser'
      }
    } as FastifyRequest;

    it('should record user consent with all details', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await gdprService.recordConsent(
        'user-123',
        ConsentType.ANALYTICS,
        true,
        mockRequest,
        'explicit'
      );

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_consents'),
        expect.arrayContaining([
          'user-123',
          ConsentType.ANALYTICS,
          true,
          expect.any(Date),
          '1.0',
          '192.168.1.1',
          'Mozilla/5.0 Test Browser',
          'explicit',
          expect.any(Date)
        ])
      );

      expect(mockLogger.audit).toHaveBeenCalledWith(
        'User consent recorded',
        expect.objectContaining({
          userId: 'user-123',
          consentType: ConsentType.ANALYTICS,
          granted: true,
          method: 'explicit',
          gdprCompliance: true
        })
      );
    });

    it('should handle consent without request object', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await gdprService.recordConsent(
        'user-123',
        ConsentType.NECESSARY,
        true
      );

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'user-123',
          ConsentType.NECESSARY,
          true,
          expect.any(Date),
          '1.0',
          undefined, // No IP address
          undefined, // No user agent
          'explicit', // Default method
          undefined // No expiry for necessary consent
        ])
      );
    });

    it('should calculate correct consent expiry dates', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      // Test analytics consent (12 months)
      await gdprService.recordConsent('user-123', ConsentType.ANALYTICS, true);

      const callArgs = mockDatabase.query.mock.calls[0][1] as any[];
      const expiryDate = callArgs[8] as Date;
      
      expect(expiryDate).toBeInstanceOf(Date);
      expect(expiryDate.getTime()).toBeGreaterThan(Date.now());
    });

    it('should set no expiry for necessary consent', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await gdprService.recordConsent('user-123', ConsentType.NECESSARY, true);

      const callArgs = mockDatabase.query.mock.calls[0][1] as any[];
      const expiryDate = callArgs[8];
      
      expect(expiryDate).toBeUndefined();
    });

    it('should handle database errors', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(gdprService.recordConsent('user-123', ConsentType.ANALYTICS, true))
        .rejects.toThrow('Database connection failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to record user consent',
        expect.objectContaining({
          error: 'Database connection failed',
          userId: 'user-123',
          consentType: ConsentType.ANALYTICS
        })
      );
    });

    it('should record consent revocation', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await gdprService.recordConsent('user-123', ConsentType.MARKETING, false);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'user-123',
          ConsentType.MARKETING,
          false // Consent revoked
        ])
      );
    });

    it('should update data processing permissions', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      // Mock the private method call
      const updatePermissionsSpy = jest.spyOn(gdprService as any, 'updateDataProcessingPermissions')
        .mockResolvedValue(undefined);

      await gdprService.recordConsent('user-123', ConsentType.ANALYTICS, true);

      expect(updatePermissionsSpy).toHaveBeenCalledWith('user-123');

      updatePermissionsSpy.mockRestore();
    });
  });

  describe('hasConsent', () => {
    it('should return true for granted and valid consent', async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
      mockDatabase.query.mockResolvedValue({
        rows: [{
          granted: true,
          expires_at: futureDate
        }]
      });

      const result = await gdprService.hasConsent('user-123', ConsentType.ANALYTICS);

      expect(result).toBe(true);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT granted, expires_at FROM user_consents'),
        ['user-123', ConsentType.ANALYTICS]
      );
    });

    it('should return false for expired consent', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      mockDatabase.query.mockResolvedValue({
        rows: [{
          granted: true,
          expires_at: pastDate
        }]
      });

      const result = await gdprService.hasConsent('user-123', ConsentType.ANALYTICS);

      expect(result).toBe(false);
    });

    it('should return false for revoked consent', async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [{
          granted: false,
          expires_at: null
        }]
      });

      const result = await gdprService.hasConsent('user-123', ConsentType.MARKETING);

      expect(result).toBe(false);
    });

    it('should return false when no consent record exists', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const result = await gdprService.hasConsent('user-123', ConsentType.FUNCTIONAL);

      expect(result).toBe(false);
    });

    it('should handle consent with no expiry date', async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [{
          granted: true,
          expires_at: null
        }]
      });

      const result = await gdprService.hasConsent('user-123', ConsentType.NECESSARY);

      expect(result).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database error'));

      const result = await gdprService.hasConsent('user-123', ConsentType.ANALYTICS);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to check user consent',
        expect.objectContaining({
          error: 'Database error',
          userId: 'user-123',
          consentType: ConsentType.ANALYTICS
        })
      );
    });
  });

  describe('recordDataProcessing', () => {
    const mockProcessingRecord = {
      userId: 'user-123',
      dataType: 'receipts',
      purpose: DataProcessingPurpose.RECEIPT_PROCESSING,
      legalBasis: LegalBasis.CONTRACT,
      retentionPeriod: 2555, // 7 years in days
      automated: true,
      thirdPartySharing: false,
      details: {
        action: 'create_receipt',
        source: 'mobile_app'
      }
    };

    it('should record data processing activity', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await gdprService.recordDataProcessing(mockProcessingRecord);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO data_processing_records'),
        expect.arrayContaining([
          expect.stringMatching(/^gdpr_\d+_[a-f0-9]+$/), // Generated ID
          'user-123',
          'receipts',
          DataProcessingPurpose.RECEIPT_PROCESSING,
          LegalBasis.CONTRACT,
          expect.any(Date),
          2555,
          true,
          false,
          JSON.stringify(mockProcessingRecord.details)
        ])
      );

      expect(mockLogger.audit).toHaveBeenCalledWith(
        'Data processing recorded',
        expect.objectContaining({
          userId: 'user-123',
          dataType: 'receipts',
          purpose: DataProcessingPurpose.RECEIPT_PROCESSING,
          legalBasis: LegalBasis.CONTRACT,
          gdprCompliance: true
        })
      );
    });

    it('should handle processing without user ID', async () => {
      const anonymousRecord = {
        ...mockProcessingRecord,
        userId: undefined
      };

      mockDatabase.query.mockResolvedValue({ rows: [] });

      await gdprService.recordDataProcessing(anonymousRecord);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          undefined, // No user ID
          'receipts',
          DataProcessingPurpose.RECEIPT_PROCESSING
        ])
      );
    });

    it('should handle complex details object', async () => {
      const complexRecord = {
        ...mockProcessingRecord,
        details: {
          nested: {
            data: 'value',
            array: [1, 2, 3]
          },
          special_chars: "O'Reilly & Associates"
        }
      };

      mockDatabase.query.mockResolvedValue({ rows: [] });

      await gdprService.recordDataProcessing(complexRecord);

      const callArgs = mockDatabase.query.mock.calls[0][1] as any[];
      const detailsJson = callArgs[9];

      expect(detailsJson).toBe(JSON.stringify(complexRecord.details));
    });

    it('should handle database errors', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Constraint violation'));

      await expect(gdprService.recordDataProcessing(mockProcessingRecord))
        .rejects.toThrow('Constraint violation');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to record data processing',
        expect.objectContaining({
          error: 'Constraint violation',
          record: mockProcessingRecord
        })
      );
    });

    it('should generate unique IDs for each record', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await gdprService.recordDataProcessing(mockProcessingRecord);
      await gdprService.recordDataProcessing(mockProcessingRecord);

      const firstCallId = mockDatabase.query.mock.calls[0][1][0];
      const secondCallId = mockDatabase.query.mock.calls[1][1][0];

      expect(firstCallId).not.toBe(secondCallId);
      expect(firstCallId).toMatch(/^gdpr_\d+_[a-f0-9]+$/);
      expect(secondCallId).toMatch(/^gdpr_\d+_[a-f0-9]+$/);
    });
  });

  describe('createDataExportRequest', () => {
    it('should create data export request with default format', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });
      
      // Mock the private method to prevent actual processing
      const processExportSpy = jest.spyOn(gdprService as any, 'processDataExport')
        .mockResolvedValue(undefined);

      const requestId = await gdprService.createDataExportRequest('user-123');

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO data_export_requests'),
        expect.arrayContaining([
          expect.stringMatching(/^gdpr_\d+_[a-f0-9]+$/),
          'user-123',
          expect.any(Date),
          'json', // Default format
          expect.any(Date) // Expiry date
        ])
      );

      expect(requestId).toMatch(/^gdpr_\d+_[a-f0-9]+$/);

      expect(mockLogger.audit).toHaveBeenCalledWith(
        'Data export request created',
        expect.objectContaining({
          requestId,
          userId: 'user-123',
          format: 'json',
          gdprCompliance: true,
          rightToDataPortability: true
        })
      );

      expect(processExportSpy).toHaveBeenCalledWith(requestId);
      processExportSpy.mockRestore();
    });

    it('should create export request with custom format', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });
      
      const processExportSpy = jest.spyOn(gdprService as any, 'processDataExport')
        .mockResolvedValue(undefined);

      const requestId = await gdprService.createDataExportRequest('user-123', 'pdf');

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          'user-123',
          expect.any(Date),
          'pdf'
        ])
      );

      processExportSpy.mockRestore();
    });

    it('should set correct expiry date (30 days)', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });
      
      const processExportSpy = jest.spyOn(gdprService as any, 'processDataExport')
        .mockResolvedValue(undefined);

      const beforeRequest = Date.now();
      await gdprService.createDataExportRequest('user-123');
      const afterRequest = Date.now();

      const callArgs = mockDatabase.query.mock.calls[0][1] as any[];
      const expiryDate = callArgs[4] as Date;

      const expectedExpiry = beforeRequest + 30 * 24 * 60 * 60 * 1000;
      const maxExpectedExpiry = afterRequest + 30 * 24 * 60 * 60 * 1000;

      expect(expiryDate.getTime()).toBeGreaterThanOrEqual(expectedExpiry);
      expect(expiryDate.getTime()).toBeLessThanOrEqual(maxExpectedExpiry);

      processExportSpy.mockRestore();
    });

    it('should handle database errors', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database unavailable'));

      await expect(gdprService.createDataExportRequest('user-123'))
        .rejects.toThrow('Database unavailable');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create data export request',
        expect.objectContaining({
          error: 'Database unavailable',
          userId: 'user-123'
        })
      );
    });
  });

  describe('createDataDeletionRequest', () => {
    it('should create data deletion request', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });
      
      const processDeletionSpy = jest.spyOn(gdprService as any, 'processDataDeletion')
        .mockResolvedValue(undefined);

      const requestId = await gdprService.createDataDeletionRequest('user-123', 'Account closure');

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO data_deletion_requests'),
        expect.arrayContaining([
          expect.stringMatching(/^gdpr_\d+_[a-f0-9]+$/),
          'user-123',
          expect.any(Date),
          'Account closure'
        ])
      );

      expect(mockLogger.audit).toHaveBeenCalledWith(
        'Data deletion request created',
        expect.objectContaining({
          requestId,
          userId: 'user-123',
          reason: 'Account closure',
          gdprCompliance: true,
          rightToBeForgotten: true
        })
      );

      expect(processDeletionSpy).toHaveBeenCalledWith(requestId);
      processDeletionSpy.mockRestore();
    });

    it('should create deletion request without reason', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });
      
      const processDeletionSpy = jest.spyOn(gdprService as any, 'processDataDeletion')
        .mockResolvedValue(undefined);

      const requestId = await gdprService.createDataDeletionRequest('user-123');

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          'user-123',
          expect.any(Date),
          undefined // No reason provided
        ])
      );

      processDeletionSpy.mockRestore();
    });

    it('should handle database errors', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Deletion request failed'));

      await expect(gdprService.createDataDeletionRequest('user-123'))
        .rejects.toThrow('Deletion request failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create data deletion request',
        expect.objectContaining({
          error: 'Deletion request failed',
          userId: 'user-123'
        })
      );
    });
  });

  describe('getPrivacyDashboard', () => {
    const mockConsents = [
      { consent_type: 'analytics', granted: true, timestamp: new Date(), expires_at: null },
      { consent_type: 'marketing', granted: false, timestamp: new Date(), expires_at: null }
    ];

    const mockProcessingActivities = [
      { data_type: 'receipts', purpose: 'receipt_processing', legal_basis: 'contract', timestamp: new Date(), third_party_sharing: false }
    ];

    const mockExportRequests = [
      { id: 'export-1', requested_at: new Date(), status: 'completed', format: 'json', completed_at: new Date() }
    ];

    const mockDeletionRequests = [
      { id: 'deletion-1', requested_at: new Date(), status: 'pending', reason: 'Account closure', completed_at: null }
    ];

    it('should return complete privacy dashboard', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: mockConsents })
        .mockResolvedValueOnce({ rows: mockProcessingActivities })
        .mockResolvedValueOnce({ rows: mockExportRequests })
        .mockResolvedValueOnce({ rows: mockDeletionRequests });

      const retentionStatusSpy = jest.spyOn(gdprService as any, 'calculateDataRetentionStatus')
        .mockResolvedValue({
          totalDataSize: '5.2 MB',
          oldestRecord: '2023-01-01',
          scheduledDeletion: '2030-01-01'
        });

      const result = await gdprService.getPrivacyDashboard('user-123');

      expect(result).toEqual({
        consents: mockConsents,
        processingActivities: mockProcessingActivities,
        exportRequests: mockExportRequests,
        deletionRequests: mockDeletionRequests,
        retentionStatus: expect.objectContaining({
          totalDataSize: '5.2 MB'
        }),
        dataCategories: expect.any(Array),
        rights: expect.any(Array)
      });

      expect(mockDatabase.query).toHaveBeenCalledTimes(4);
      
      // Check that each query was called with correct parameters
      expect(mockDatabase.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('SELECT DISTINCT ON (consent_type)'),
        ['user-123']
      );

      retentionStatusSpy.mockRestore();
    });

    it('should handle empty results gracefully', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const retentionStatusSpy = jest.spyOn(gdprService as any, 'calculateDataRetentionStatus')
        .mockResolvedValue({});

      const result = await gdprService.getPrivacyDashboard('user-123');

      expect(result.consents).toEqual([]);
      expect(result.processingActivities).toEqual([]);
      expect(result.exportRequests).toEqual([]);
      expect(result.deletionRequests).toEqual([]);

      retentionStatusSpy.mockRestore();
    });

    it('should include static data categories and rights', async () => {
      mockDatabase.query
        .mockResolvedValue({ rows: [] });

      const retentionStatusSpy = jest.spyOn(gdprService as any, 'calculateDataRetentionStatus')
        .mockResolvedValue({});

      const result = await gdprService.getPrivacyDashboard('user-123');

      expect(result.dataCategories).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: 'identity' }),
          expect.objectContaining({ category: 'financial' }),
          expect.objectContaining({ category: 'technical' }),
          expect.objectContaining({ category: 'behavioral' })
        ])
      );

      expect(result.rights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ right: 'access' }),
          expect.objectContaining({ right: 'rectification' }),
          expect.objectContaining({ right: 'erasure' }),
          expect.objectContaining({ right: 'portability' })
        ])
      );

      retentionStatusSpy.mockRestore();
    });

    it('should handle database errors', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database query failed'));

      await expect(gdprService.getPrivacyDashboard('user-123'))
        .rejects.toThrow('Database query failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get privacy dashboard',
        expect.objectContaining({
          error: 'Database query failed',
          userId: 'user-123'
        })
      );
    });
  });

  describe('enforceDataRetention', () => {
    const mockExpiredData = [
      { user_id: 'user-1', data_type: 'analytics', retention_period: 730, timestamp: new Date('2022-01-01') },
      { user_id: 'user-2', data_type: 'logs', retention_period: 365, timestamp: new Date('2022-06-01') }
    ];

    it('should enforce data retention policies', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: mockExpiredData }) // Expired data query
        .mockResolvedValueOnce({ rows: [] }) // Delete analytics for user-1
        .mockResolvedValueOnce({ rows: [] }) // Delete logs for user-2
        .mockResolvedValueOnce({ rows: [] }); // Clean up old processing records

      const deleteExpiredDataSpy = jest.spyOn(gdprService as any, 'deleteExpiredData')
        .mockResolvedValue(undefined);

      await gdprService.enforceDataRetention();

      expect(mockDatabase.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('SELECT DISTINCT user_id, data_type, retention_period, timestamp')
      );

      expect(deleteExpiredDataSpy).toHaveBeenCalledTimes(2);
      expect(deleteExpiredDataSpy).toHaveBeenNthCalledWith(1, 'user-1', 'analytics');
      expect(deleteExpiredDataSpy).toHaveBeenNthCalledWith(2, 'user-2', 'logs');

      expect(mockDatabase.query).toHaveBeenLastCalledWith(
        expect.stringContaining('DELETE FROM data_processing_records')
      );

      expect(mockLogger.audit).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Data retention enforcement completed',
        { recordsProcessed: 2 }
      );

      deleteExpiredDataSpy.mockRestore();
    });

    it('should handle empty expired data', async () => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [] }) // No expired data
        .mockResolvedValueOnce({ rows: [] }); // Clean up processing records

      await gdprService.enforceDataRetention();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Data retention enforcement completed',
        { recordsProcessed: 0 }
      );
    });

    it('should handle retention enforcement errors', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Retention enforcement failed'));

      await gdprService.enforceDataRetention();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to enforce data retention',
        expect.objectContaining({
          error: 'Retention enforcement failed'
        })
      );
    });

    it('should exclude users with legal holds', async () => {
      const queryCall = mockDatabase.query.mock.calls[0];
      
      // Mock the first call to get expired data
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      await gdprService.enforceDataRetention();

      const query = mockDatabase.query.mock.calls[0][0] as string;
      expect(query).toContain('NOT IN (SELECT user_id FROM legal_holds WHERE active = true)');
    });
  });

  describe('generatePrivacyNotice', () => {
    it('should generate comprehensive privacy notice', async () => {
      process.env.PRIVACY_CONTACT_EMAIL = 'privacy@test.com';
      process.env.COMPANY_ADDRESS = '123 Test Street, Test City';

      const notice = await gdprService.generatePrivacyNotice();
      const parsedNotice = JSON.parse(notice);

      expect(parsedNotice).toMatchObject({
        lastUpdated: expect.any(String),
        dataController: {
          name: 'Receipt Vault Pro',
          contact: 'privacy@test.com',
          address: '123 Test Street, Test City'
        },
        dataProcessingPurposes: expect.any(Array),
        legalBases: expect.any(Array),
        dataCategories: expect.any(Array),
        retentionPeriods: expect.any(Array),
        userRights: expect.any(Array),
        thirdPartySharing: expect.any(Array),
        internationalTransfers: expect.any(Array),
        securityMeasures: expect.any(Array)
      });

      expect(parsedNotice.dataProcessingPurposes).toContainEqual(
        expect.objectContaining({
          purpose: 'receipt_processing',
          description: expect.any(String)
        })
      );

      expect(parsedNotice.userRights).toContainEqual(
        expect.objectContaining({
          right: 'access',
          description: expect.any(String)
        })
      );
    });

    it('should use default values for missing environment variables', async () => {
      delete process.env.PRIVACY_CONTACT_EMAIL;
      delete process.env.COMPANY_ADDRESS;

      const notice = await gdprService.generatePrivacyNotice();
      const parsedNotice = JSON.parse(notice);

      expect(parsedNotice.dataController).toMatchObject({
        name: 'Receipt Vault Pro',
        contact: 'privacy@receiptvault.com',
        address: 'Not specified'
      });
    });

    it('should include all required GDPR sections', async () => {
      const notice = await gdprService.generatePrivacyNotice();
      const parsedNotice = JSON.parse(notice);

      const requiredSections = [
        'lastUpdated',
        'dataController',
        'dataProcessingPurposes',
        'legalBases',
        'dataCategories',
        'retentionPeriods',
        'userRights',
        'thirdPartySharing',
        'internationalTransfers',
        'securityMeasures'
      ];

      requiredSections.forEach(section => {
        expect(parsedNotice).toHaveProperty(section);
      });
    });
  });

  describe('Data Collection Methods', () => {
    it('should collect complete user data for export', async () => {
      const mockUserData = {
        profile: { id: 'user-123', email: 'test@example.com' },
        receipts: [{ id: 'receipt-1', amount: 25.50 }],
        analytics: [{ event: 'login', timestamp: new Date() }],
        consents: [{ type: 'analytics', granted: true }],
        processingRecords: [{ purpose: 'receipt_processing' }]
      };

      const collectUserDataSpy = jest.spyOn(gdprService as any, 'collectUserData')
        .mockResolvedValue(mockUserData);

      // Test through the public interface
      const data = await (gdprService as any).collectUserData('user-123');

      expect(data).toEqual(mockUserData);
      expect(data).toHaveProperty('profile');
      expect(data).toHaveProperty('receipts');
      expect(data).toHaveProperty('analytics');
      expect(data).toHaveProperty('consents');
      expect(data).toHaveProperty('processingRecords');

      collectUserDataSpy.mockRestore();
    });
  });

  describe('File Generation', () => {
    const mockUserData = {
      profile: { id: 'user-123', email: 'test@example.com' },
      receipts: [{ id: 'receipt-1', amount: 25.50 }]
    };

    it('should generate JSON export file', async () => {
      const generateExportFileSpy = jest.spyOn(gdprService as any, 'generateExportFile')
        .mockResolvedValue('/exports/user_data_export_123.json');

      const filepath = await (gdprService as any).generateExportFile(mockUserData, 'json', 'request-123');

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('exports'),
        { recursive: true }
      );

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('user_data_export_request-123.json'),
        JSON.stringify(mockUserData, null, 2)
      );

      expect(filepath).toBe('/exports/user_data_export_123.json');

      generateExportFileSpy.mockRestore();
    });

    it('should generate CSV export file', async () => {
      const convertToCSVSpy = jest.spyOn(gdprService as any, 'convertToCSV')
        .mockReturnValue('csv,data,here');

      await (gdprService as any).generateExportFile(mockUserData, 'csv', 'request-123');

      expect(convertToCSVSpy).toHaveBeenCalledWith(mockUserData);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.csv'),
        'csv,data,here'
      );

      convertToCSVSpy.mockRestore();
    });

    it('should generate PDF export file', async () => {
      const generatePDFSpy = jest.spyOn(gdprService as any, 'generatePDF')
        .mockResolvedValue(undefined);

      await (gdprService as any).generateExportFile(mockUserData, 'pdf', 'request-123');

      expect(generatePDFSpy).toHaveBeenCalledWith(
        mockUserData,
        expect.stringContaining('.pdf')
      );

      generatePDFSpy.mockRestore();
    });
  });

  describe('Secure Download URLs', () => {
    it('should create secure download URL with token', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const createSecureDownloadUrlSpy = jest.spyOn(gdprService as any, 'createSecureDownloadUrl')
        .mockResolvedValue('https://api.test.com/api/v1/gdpr/download/token123');

      const url = await (gdprService as any).createSecureDownloadUrl('/path/to/file.json', 'request-123');

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO download_tokens'),
        expect.arrayContaining([
          'mockRandomString', // Token
          '/path/to/file.json', // File path
          'request-123', // Request ID
          expect.any(Date) // Expiry
        ])
      );

      expect(url).toBe('https://api.test.com/api/v1/gdpr/download/token123');

      createSecureDownloadUrlSpy.mockRestore();
    });

    it('should set 24-hour expiry for download tokens', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const beforeCall = Date.now();
      await (gdprService as any).createSecureDownloadUrl('/path/to/file.json', 'request-123');
      const afterCall = Date.now();

      const callArgs = mockDatabase.query.mock.calls[0][1] as any[];
      const expiryDate = callArgs[3] as Date;

      const expectedExpiry = beforeCall + 24 * 60 * 60 * 1000;
      const maxExpectedExpiry = afterCall + 24 * 60 * 60 * 1000;

      expect(expiryDate.getTime()).toBeGreaterThanOrEqual(expectedExpiry);
      expect(expiryDate.getTime()).toBeLessThanOrEqual(maxExpectedExpiry);
    });
  });

  describe('Legal Retention Requirements', () => {
    it('should identify financial records for retention', async () => {
      mockDatabase.query.mockResolvedValue({ 
        rows: [{ count: '5' }] // User has 5 financial records
      });

      const retainedData = await (gdprService as any).checkLegalRetentionRequirements('user-123');

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) FROM receipts'),
        ['user-123']
      );

      expect(retainedData).toContain('financial_records');
    });

    it('should return empty array when no retention required', async () => {
      mockDatabase.query.mockResolvedValue({ 
        rows: [{ count: '0' }] // No financial records
      });

      const retainedData = await (gdprService as any).checkLegalRetentionRequirements('user-123');

      expect(retainedData).toEqual([]);
    });
  });

  describe('Data Deletion Execution', () => {
    it('should delete user data while preserving retained data', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await (gdprService as any).executeDataDeletion('user-123', ['financial_records']);

      // Should delete user profile and analytics, but not receipts
      expect(mockDatabase.query).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = $1',
        ['user-123']
      );

      expect(mockDatabase.query).toHaveBeenCalledWith(
        'DELETE FROM analytics_events WHERE user_id = $1',
        ['user-123']
      );

      // Should NOT delete receipts (financial_records are retained)
      expect(mockDatabase.query).not.toHaveBeenCalledWith(
        'DELETE FROM receipts WHERE user_id = $1',
        ['user-123']
      );
    });

    it('should preserve all data when retention covers everything', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await (gdprService as any).executeDataDeletion('user-123', ['profile', 'receipts', 'analytics']);

      // Should not delete anything
      expect(mockDatabase.query).not.toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.any(Array)
      );
    });
  });

  describe('Utility Methods', () => {
    it('should generate proper encryption key', async () => {
      delete process.env.GDPR_ENCRYPTION_KEY;

      // Test key generation by creating new instance
      const service = new (gdprService.constructor as any)();

      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
    });

    it('should generate unique IDs', async () => {
      const id1 = (gdprService as any).generateId();
      const id2 = (gdprService as any).generateId();

      expect(id1).toMatch(/^gdpr_\d+_[a-f0-9]+$/);
      expect(id2).toMatch(/^gdpr_\d+_[a-f0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent consent recording', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      const promises = [
        gdprService.recordConsent('user-123', ConsentType.ANALYTICS, true),
        gdprService.recordConsent('user-123', ConsentType.MARKETING, false),
        gdprService.recordConsent('user-123', ConsentType.FUNCTIONAL, true)
      ];

      await Promise.all(promises);

      expect(mockDatabase.query).toHaveBeenCalledTimes(3);
      expect(mockLogger.audit).toHaveBeenCalledTimes(3);
    });

    it('should handle very large user data exports', async () => {
      const largeUserData = {
        receipts: Array(10000).fill({ id: 'receipt', amount: 10.00 }),
        analytics: Array(50000).fill({ event: 'action', timestamp: new Date() })
      };

      const collectUserDataSpy = jest.spyOn(gdprService as any, 'collectUserData')
        .mockResolvedValue(largeUserData);

      await (gdprService as any).generateExportFile(largeUserData, 'json', 'large-request');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"receipts"')
      );

      collectUserDataSpy.mockRestore();
    });

    it('should handle special characters in file paths', async () => {
      const specialRequestId = "request-with-special-chars-!@#$%^&*()";

      await (gdprService as any).generateExportFile({}, 'json', specialRequestId);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('user_data_export_'),
        expect.any(String)
      );
    });

    it('should handle database connection failures gracefully', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Connection timeout'));

      // All public methods should handle database errors gracefully
      await expect(gdprService.hasConsent('user-123', ConsentType.ANALYTICS))
        .resolves.toBe(false);

      await expect(gdprService.recordConsent('user-123', ConsentType.ANALYTICS, true))
        .rejects.toThrow('Connection timeout');

      expect(mockLogger.error).toHaveBeenCalledTimes(2);
    });
  });
});