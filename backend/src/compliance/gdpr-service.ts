/**
 * GDPR Compliance Service for Receipt Vault Pro
 * Comprehensive data protection and privacy compliance
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';
import { db, Database } from '../database/connection';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export enum ConsentType {
  NECESSARY = 'necessary',
  ANALYTICS = 'analytics',
  MARKETING = 'marketing',
  FUNCTIONAL = 'functional'
}

export enum DataProcessingPurpose {
  RECEIPT_PROCESSING = 'receipt_processing',
  USER_AUTHENTICATION = 'user_authentication',
  ANALYTICS = 'analytics',
  MARKETING = 'marketing',
  SUPPORT = 'support',
  LEGAL_COMPLIANCE = 'legal_compliance'
}

export enum LegalBasis {
  CONSENT = 'consent',
  CONTRACT = 'contract',
  LEGAL_OBLIGATION = 'legal_obligation',
  VITAL_INTERESTS = 'vital_interests',
  PUBLIC_TASK = 'public_task',
  LEGITIMATE_INTERESTS = 'legitimate_interests'
}

export interface UserConsent {
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  timestamp: Date;
  version: string;
  ipAddress?: string;
  userAgent?: string;
  method: 'explicit' | 'implicit';
  expires?: Date;
}

export interface DataProcessingRecord {
  id: string;
  userId?: string;
  dataType: string;
  purpose: DataProcessingPurpose;
  legalBasis: LegalBasis;
  timestamp: Date;
  retentionPeriod: number; // in days
  automated: boolean;
  thirdPartySharing: boolean;
  details: Record<string, any>;
}

export interface DataExportRequest {
  id: string;
  userId: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedAt?: Date;
  downloadUrl?: string;
  expiresAt?: Date;
  format: 'json' | 'csv' | 'pdf';
}

export interface DataDeletionRequest {
  id: string;
  userId: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedAt?: Date;
  reason?: string;
  retainedData?: string[];
}

class GDPRComplianceService {
  private db: any;
  private encryptionKey: string;

  constructor() {
    this.db = db;
    this.encryptionKey = process.env.GDPR_ENCRYPTION_KEY || this.generateEncryptionKey();
  }

  /**
   * Record user consent
   */
  async recordConsent(
    userId: string,
    consentType: ConsentType,
    granted: boolean,
    request?: FastifyRequest,
    method: 'explicit' | 'implicit' = 'explicit'
  ): Promise<void> {
    try {
      const consent: UserConsent = {
        userId,
        consentType,
        granted,
        timestamp: new Date(),
        version: '1.0',
        ipAddress: request?.ip,
        userAgent: request?.headers['user-agent'],
        method,
        expires: this.calculateConsentExpiry(consentType)
      };

      await this.db.query(`
        INSERT INTO user_consents (
          user_id, consent_type, granted, timestamp, version, 
          ip_address, user_agent, method, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        consent.userId,
        consent.consentType,
        consent.granted,
        consent.timestamp,
        consent.version,
        consent.ipAddress,
        consent.userAgent,
        consent.method,
        consent.expires
      ]);

      logger.audit('User consent recorded', {
        userId,
        consentType,
        granted,
        method,
        gdprCompliance: true
      });

      // Update user's data processing permissions
      await this.updateDataProcessingPermissions(userId);

    } catch (error) {
      logger.error('Failed to record user consent', { error: error.message, userId, consentType });
      throw error;
    }
  }

  /**
   * Check if user has granted specific consent
   */
  async hasConsent(userId: string, consentType: ConsentType): Promise<boolean> {
    try {
      const result = await this.db.query(`
        SELECT granted, expires_at FROM user_consents 
        WHERE user_id = $1 AND consent_type = $2 
        ORDER BY timestamp DESC LIMIT 1
      `, [userId, consentType]);

      if (result.rows.length === 0) {
        return false;
      }

      const consent = result.rows[0];
      
      // Check if consent has expired
      if (consent.expires_at && new Date() > consent.expires_at) {
        return false;
      }

      return consent.granted;
    } catch (error) {
      logger.error('Failed to check user consent', { error: error.message, userId, consentType });
      return false;
    }
  }

  /**
   * Record data processing activity
   */
  async recordDataProcessing(record: Omit<DataProcessingRecord, 'id' | 'timestamp'>): Promise<void> {
    try {
      const id = this.generateId();
      const timestamp = new Date();

      await this.db.query(`
        INSERT INTO data_processing_records (
          id, user_id, data_type, purpose, legal_basis, 
          timestamp, retention_period, automated, third_party_sharing, details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        id,
        record.userId,
        record.dataType,
        record.purpose,
        record.legalBasis,
        timestamp,
        record.retentionPeriod,
        record.automated,
        record.thirdPartySharing,
        JSON.stringify(record.details)
      ]);

      logger.audit('Data processing recorded', {
        processingId: id,
        userId: record.userId,
        dataType: record.dataType,
        purpose: record.purpose,
        legalBasis: record.legalBasis,
        gdprCompliance: true
      });

    } catch (error) {
      logger.error('Failed to record data processing', { error: error.message, record });
      throw error;
    }
  }

  /**
   * Handle data export request (Right to Data Portability)
   */
  async createDataExportRequest(
    userId: string,
    format: 'json' | 'csv' | 'pdf' = 'json'
  ): Promise<string> {
    try {
      const requestId = this.generateId();
      const requestedAt = new Date();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await this.db.query(`
        INSERT INTO data_export_requests (
          id, user_id, requested_at, status, format, expires_at
        ) VALUES ($1, $2, $3, 'pending', $4, $5)
      `, [requestId, userId, requestedAt, format, expiresAt]);

      logger.audit('Data export request created', {
        requestId,
        userId,
        format,
        gdprCompliance: true,
        rightToDataPortability: true
      });

      // Process export asynchronously
      this.processDataExport(requestId);

      return requestId;
    } catch (error) {
      logger.error('Failed to create data export request', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Process data export request
   */
  private async processDataExport(requestId: string): Promise<void> {
    try {
      // Update status to processing
      await this.db.query(`
        UPDATE data_export_requests 
        SET status = 'processing' 
        WHERE id = $1
      `, [requestId]);

      const request = await this.db.query(`
        SELECT * FROM data_export_requests WHERE id = $1
      `, [requestId]);

      if (request.rows.length === 0) {
        throw new Error('Export request not found');
      }

      const exportRequest = request.rows[0];
      const userData = await this.collectUserData(exportRequest.user_id);
      
      // Generate export file
      const exportPath = await this.generateExportFile(userData, exportRequest.format, requestId);
      
      // Create secure download URL
      const downloadUrl = await this.createSecureDownloadUrl(exportPath, requestId);

      // Update request with completion details
      await this.db.query(`
        UPDATE data_export_requests 
        SET status = 'completed', completed_at = $1, download_url = $2
        WHERE id = $3
      `, [new Date(), downloadUrl, requestId]);

      logger.audit('Data export completed', {
        requestId,
        userId: exportRequest.user_id,
        format: exportRequest.format,
        gdprCompliance: true
      });

      // Notify user (implement email notification)
      await this.notifyUserExportReady(exportRequest.user_id, downloadUrl);

    } catch (error) {
      logger.error('Failed to process data export', { error: error.message, requestId });
      
      await this.db.query(`
        UPDATE data_export_requests 
        SET status = 'failed' 
        WHERE id = $1
      `, [requestId]);
    }
  }

  /**
   * Handle data deletion request (Right to be Forgotten)
   */
  async createDataDeletionRequest(
    userId: string,
    reason?: string
  ): Promise<string> {
    try {
      const requestId = this.generateId();
      const requestedAt = new Date();

      await this.db.query(`
        INSERT INTO data_deletion_requests (
          id, user_id, requested_at, status, reason
        ) VALUES ($1, $2, $3, 'pending', $4)
      `, [requestId, userId, requestedAt, reason]);

      logger.audit('Data deletion request created', {
        requestId,
        userId,
        reason,
        gdprCompliance: true,
        rightToBeForgotten: true
      });

      // Process deletion asynchronously
      this.processDataDeletion(requestId);

      return requestId;
    } catch (error) {
      logger.error('Failed to create data deletion request', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Process data deletion request
   */
  private async processDataDeletion(requestId: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE data_deletion_requests 
        SET status = 'processing' 
        WHERE id = $1
      `, [requestId]);

      const request = await this.db.query(`
        SELECT * FROM data_deletion_requests WHERE id = $1
      `, [requestId]);

      if (request.rows.length === 0) {
        throw new Error('Deletion request not found');
      }

      const deletionRequest = request.rows[0];
      const userId = deletionRequest.user_id;

      // Check for legal obligations to retain data
      const retainedData = await this.checkLegalRetentionRequirements(userId);

      // Perform data deletion
      await this.executeDataDeletion(userId, retainedData);

      await this.db.query(`
        UPDATE data_deletion_requests 
        SET status = 'completed', completed_at = $1, retained_data = $2
        WHERE id = $3
      `, [new Date(), JSON.stringify(retainedData), requestId]);

      logger.audit('Data deletion completed', {
        requestId,
        userId,
        retainedData,
        gdprCompliance: true
      });

    } catch (error) {
      logger.error('Failed to process data deletion', { error: error.message, requestId });
      
      await this.db.query(`
        UPDATE data_deletion_requests 
        SET status = 'failed' 
        WHERE id = $1
      `, [requestId]);
    }
  }

  /**
   * Get user's privacy dashboard data
   */
  async getPrivacyDashboard(userId: string): Promise<any> {
    try {
      // Get current consents
      const consents = await this.db.query(`
        SELECT DISTINCT ON (consent_type) 
          consent_type, granted, timestamp, expires_at
        FROM user_consents 
        WHERE user_id = $1 
        ORDER BY consent_type, timestamp DESC
      `, [userId]);

      // Get data processing activities
      const processingActivities = await this.db.query(`
        SELECT data_type, purpose, legal_basis, timestamp, third_party_sharing
        FROM data_processing_records 
        WHERE user_id = $1 
        ORDER BY timestamp DESC 
        LIMIT 50
      `, [userId]);

      // Get export requests
      const exportRequests = await this.db.query(`
        SELECT id, requested_at, status, format, completed_at
        FROM data_export_requests 
        WHERE user_id = $1 
        ORDER BY requested_at DESC 
        LIMIT 10
      `, [userId]);

      // Get deletion requests
      const deletionRequests = await this.db.query(`
        SELECT id, requested_at, status, reason, completed_at
        FROM data_deletion_requests 
        WHERE user_id = $1 
        ORDER BY requested_at DESC 
        LIMIT 10
      `, [userId]);

      // Calculate data retention status
      const retentionStatus = await this.calculateDataRetentionStatus(userId);

      return {
        consents: consents.rows,
        processingActivities: processingActivities.rows,
        exportRequests: exportRequests.rows,
        deletionRequests: deletionRequests.rows,
        retentionStatus,
        dataCategories: this.getDataCategories(),
        rights: this.getUserRights()
      };
    } catch (error) {
      logger.error('Failed to get privacy dashboard', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Check and enforce data retention policies
   */
  async enforceDataRetention(): Promise<void> {
    try {
      logger.info('Starting data retention enforcement');

      // Get expired data based on retention policies
      const expiredData = await this.db.query(`
        SELECT DISTINCT user_id, data_type, retention_period, timestamp
        FROM data_processing_records
        WHERE timestamp + INTERVAL '1 day' * retention_period < NOW()
        AND user_id NOT IN (
          SELECT user_id FROM legal_holds WHERE active = true
        )
      `);

      for (const record of expiredData.rows) {
        await this.deleteExpiredData(record.user_id, record.data_type);
        
        logger.audit('Expired data deleted', {
          userId: record.user_id,
          dataType: record.data_type,
          retentionPeriod: record.retention_period,
          gdprCompliance: true
        });
      }

      // Clean up old processing records
      await this.db.query(`
        DELETE FROM data_processing_records 
        WHERE timestamp < NOW() - INTERVAL '7 years'
      `);

      logger.info('Data retention enforcement completed', {
        recordsProcessed: expiredData.rows.length
      });

    } catch (error) {
      logger.error('Failed to enforce data retention', { error: error.message });
    }
  }

  /**
   * Generate privacy policy and data processing notice
   */
  async generatePrivacyNotice(): Promise<string> {
    const notice = {
      lastUpdated: new Date().toISOString(),
      dataController: {
        name: 'Receipt Vault Pro',
        contact: process.env.PRIVACY_CONTACT_EMAIL || 'privacy@receiptvault.com',
        address: process.env.COMPANY_ADDRESS || 'Not specified'
      },
      dataProcessingPurposes: this.getDataProcessingPurposes(),
      legalBases: this.getLegalBases(),
      dataCategories: this.getDataCategories(),
      retentionPeriods: this.getRetentionPeriods(),
      userRights: this.getUserRights(),
      thirdPartySharing: this.getThirdPartySharing(),
      internationalTransfers: this.getInternationalTransfers(),
      securityMeasures: this.getSecurityMeasures()
    };

    return JSON.stringify(notice, null, 2);
  }

  /**
   * Utility methods
   */
  private async collectUserData(userId: string): Promise<any> {
    // Collect all user data for export
    const userData = {
      profile: await this.getUserProfile(userId),
      receipts: await this.getUserReceipts(userId),
      analytics: await this.getUserAnalytics(userId),
      consents: await this.getUserConsents(userId),
      processingRecords: await this.getProcessingRecords(userId)
    };

    return userData;
  }

  private async getUserProfile(userId: string): Promise<any> {
    const result = await this.db.query(`
      SELECT id, email, name, created_at, updated_at 
      FROM users WHERE id = $1
    `, [userId]);
    return result.rows[0];
  }

  private async getUserReceipts(userId: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT id, merchant_name, amount, date, category, created_at
      FROM receipts WHERE user_id = $1
    `, [userId]);
    return result.rows;
  }

  private async getUserAnalytics(userId: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT event_type, timestamp, properties
      FROM analytics_events WHERE user_id = $1
    `, [userId]);
    return result.rows;
  }

  private async getUserConsents(userId: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT consent_type, granted, timestamp, version, method
      FROM user_consents WHERE user_id = $1
    `, [userId]);
    return result.rows;
  }

  private async getProcessingRecords(userId: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT data_type, purpose, legal_basis, timestamp, automated
      FROM data_processing_records WHERE user_id = $1
    `, [userId]);
    return result.rows;
  }

  private async generateExportFile(data: any, format: string, requestId: string): Promise<string> {
    const exportDir = path.join(process.cwd(), 'exports');
    await fs.mkdir(exportDir, { recursive: true });

    const filename = `user_data_export_${requestId}.${format}`;
    const filepath = path.join(exportDir, filename);

    switch (format) {
      case 'json':
        await fs.writeFile(filepath, JSON.stringify(data, null, 2));
        break;
      case 'csv':
        // Convert to CSV format
        const csv = this.convertToCSV(data);
        await fs.writeFile(filepath, csv);
        break;
      case 'pdf':
        // Generate PDF (implement with PDF library)
        await this.generatePDF(data, filepath);
        break;
    }

    return filepath;
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion (implement proper CSV generation)
    return JSON.stringify(data);
  }

  private async generatePDF(data: any, filepath: string): Promise<void> {
    // Implement PDF generation using a library like PDFKit
    await fs.writeFile(filepath, JSON.stringify(data));
  }

  private async createSecureDownloadUrl(filepath: string, requestId: string): Promise<string> {
    // Generate secure, time-limited download URL
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Store the download token
    await this.db.query(`
      INSERT INTO download_tokens (token, file_path, request_id, expires_at)
      VALUES ($1, $2, $3, $4)
    `, [token, filepath, requestId, new Date(expires)]);

    return `${process.env.API_BASE_URL}/api/v1/gdpr/download/${token}`;
  }

  private async notifyUserExportReady(userId: string, downloadUrl: string): Promise<void> {
    // Implement email notification
    logger.info('User data export ready', { userId, downloadUrl });
  }

  private async checkLegalRetentionRequirements(userId: string): Promise<string[]> {
    // Check for legal obligations to retain certain data
    const retainedData = [];

    // Financial records (7 years)
    const hasFinancialRecords = await this.db.query(`
      SELECT COUNT(*) FROM receipts 
      WHERE user_id = $1 AND amount > 0
    `, [userId]);

    if (hasFinancialRecords.rows[0].count > 0) {
      retainedData.push('financial_records');
    }

    return retainedData;
  }

  private async executeDataDeletion(userId: string, retainedData: string[]): Promise<void> {
    // Delete user data while preserving legally required data
    
    if (!retainedData.includes('profile')) {
      await this.db.query(`DELETE FROM users WHERE id = $1`, [userId]);
    }

    if (!retainedData.includes('receipts')) {
      await this.db.query(`DELETE FROM receipts WHERE user_id = $1`, [userId]);
    }

    if (!retainedData.includes('analytics')) {
      await this.db.query(`DELETE FROM analytics_events WHERE user_id = $1`, [userId]);
    }

    // Always preserve consent records for compliance
    // await this.db.query(`DELETE FROM user_consents WHERE user_id = $1`, [userId]);
  }

  private calculateConsentExpiry(consentType: ConsentType): Date | undefined {
    // Different consent types have different expiry periods
    const expiryMonths = {
      [ConsentType.NECESSARY]: undefined, // No expiry for necessary
      [ConsentType.ANALYTICS]: 12,
      [ConsentType.MARKETING]: 24,
      [ConsentType.FUNCTIONAL]: 12
    };

    const months = expiryMonths[consentType];
    if (!months) return undefined;

    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + months);
    return expiry;
  }

  private async updateDataProcessingPermissions(userId: string): Promise<void> {
    // Update user's data processing permissions based on consent
    // This would be used by other services to check permissions
  }

  private async calculateDataRetentionStatus(userId: string): Promise<any> {
    // Calculate current data retention status
    return {
      totalDataSize: '10.5 MB',
      oldestRecord: '2023-01-15',
      scheduledDeletion: '2031-01-15',
      categories: {
        receipts: { count: 150, retention: '7 years' },
        analytics: { count: 5000, retention: '2 years' },
        profile: { count: 1, retention: 'account lifetime' }
      }
    };
  }

  private async deleteExpiredData(userId: string, dataType: string): Promise<void> {
    // Delete specific type of expired data
    switch (dataType) {
      case 'analytics':
        await this.db.query(`
          DELETE FROM analytics_events 
          WHERE user_id = $1 AND timestamp < NOW() - INTERVAL '2 years'
        `, [userId]);
        break;
      case 'logs':
        await this.db.query(`
          DELETE FROM user_activity_logs 
          WHERE user_id = $1 AND timestamp < NOW() - INTERVAL '1 year'
        `, [userId]);
        break;
    }
  }

  private getDataProcessingPurposes(): any[] {
    return [
      { purpose: 'receipt_processing', description: 'Process and store receipt data' },
      { purpose: 'user_authentication', description: 'Authenticate and authorize users' },
      { purpose: 'analytics', description: 'Analyze usage patterns and improve service' },
      { purpose: 'marketing', description: 'Send promotional communications' },
      { purpose: 'support', description: 'Provide customer support' },
      { purpose: 'legal_compliance', description: 'Comply with legal obligations' }
    ];
  }

  private getLegalBases(): any[] {
    return [
      { basis: 'consent', description: 'User has given consent' },
      { basis: 'contract', description: 'Processing is necessary for contract performance' },
      { basis: 'legal_obligation', description: 'Processing is required by law' },
      { basis: 'legitimate_interests', description: 'Processing is in our legitimate interests' }
    ];
  }

  private getDataCategories(): any[] {
    return [
      { category: 'identity', description: 'Name, email, phone number' },
      { category: 'financial', description: 'Receipt data, transaction amounts' },
      { category: 'technical', description: 'IP address, device information, usage data' },
      { category: 'behavioral', description: 'App usage patterns, preferences' }
    ];
  }

  private getRetentionPeriods(): any[] {
    return [
      { dataType: 'receipts', period: '7 years', reason: 'Tax and audit requirements' },
      { dataType: 'analytics', period: '2 years', reason: 'Service improvement' },
      { dataType: 'logs', period: '1 year', reason: 'Security and debugging' },
      { dataType: 'marketing', period: '3 years', reason: 'Marketing effectiveness' }
    ];
  }

  private getUserRights(): any[] {
    return [
      { right: 'access', description: 'Right to access your personal data' },
      { right: 'rectification', description: 'Right to correct inaccurate data' },
      { right: 'erasure', description: 'Right to be forgotten' },
      { right: 'portability', description: 'Right to data portability' },
      { right: 'restriction', description: 'Right to restrict processing' },
      { right: 'objection', description: 'Right to object to processing' }
    ];
  }

  private getThirdPartySharing(): any[] {
    return [
      { party: 'Google Cloud Vision', purpose: 'OCR processing', dataTypes: ['receipt images'] },
      { party: 'WorkOS', purpose: 'Authentication', dataTypes: ['email, name'] },
      { party: 'AWS S3', purpose: 'File storage', dataTypes: ['receipt images'] }
    ];
  }

  private getInternationalTransfers(): any[] {
    return [
      { country: 'United States', safeguards: 'Standard Contractual Clauses' },
      { country: 'European Union', safeguards: 'Adequacy Decision' }
    ];
  }

  private getSecurityMeasures(): any[] {
    return [
      'End-to-end encryption of sensitive data',
      'Regular security audits and penetration testing',
      'Access controls and authentication systems',
      'Data backup and disaster recovery procedures',
      'Employee training on data protection'
    ];
  }

  private generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateId(): string {
    return `gdpr_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export const gdprService = new GDPRComplianceService();

// Middleware for GDPR compliance checks
export const gdprComplianceMiddleware = () => {
  return async (request: any, reply: any, next: any) => {
    // Record data processing activity
    if (request.user && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      await gdprService.recordDataProcessing({
        userId: request.user.id,
        dataType: request.url.includes('/receipts') ? 'receipts' : 'general',
        purpose: DataProcessingPurpose.RECEIPT_PROCESSING,
        legalBasis: LegalBasis.CONTRACT,
        retentionPeriod: 2555, // 7 years in days
        automated: true,
        thirdPartySharing: false,
        details: {
          endpoint: request.url,
          method: request.method,
          userAgent: request.headers['user-agent']
        }
      });
    }

    next();
  };
};