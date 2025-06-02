/**
 * GDPR Compliance API Routes
 * Handles user privacy rights and data protection requests
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { gdprService, ConsentType } from '../compliance/gdpr-service';
import { logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';
import { ValidationMiddleware } from '../middleware/validation';

// Request schemas
const consentRequestSchema = z.object({
  consentType: z.enum(['necessary', 'analytics', 'marketing', 'functional']),
  granted: z.boolean(),
  method: z.enum(['explicit', 'implicit']).optional().default('explicit')
});

const exportRequestSchema = z.object({
  format: z.enum(['json', 'csv', 'pdf']).optional().default('json')
});

const deletionRequestSchema = z.object({
  reason: z.string().max(500).optional(),
  confirmDeletion: z.boolean().refine(val => val === true, {
    message: 'Must confirm deletion by setting confirmDeletion to true'
  })
});

const privacySettingsSchema = z.object({
  marketingConsent: z.boolean().optional(),
  analyticsConsent: z.boolean().optional(),
  thirdPartySharing: z.boolean().optional(),
  dataRetentionPreference: z.enum(['minimal', 'standard', 'extended']).optional(),
  privacyLevel: z.enum(['minimal', 'standard', 'full']).optional(),
  communicationPreferences: z.object({
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
    push: z.boolean().optional()
  }).optional()
});

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

export async function gdprRoutes(app: FastifyInstance) {
  // Apply authentication middleware to all GDPR routes
  app.addHook('preHandler', authMiddleware);

  /**
   * Get user's privacy dashboard
   * GET /api/v1/gdpr/privacy-dashboard
   */
  app.get('/privacy-dashboard', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const dashboard = await gdprService.getPrivacyDashboard(request.user.id);
      
      logger.audit('Privacy dashboard accessed', {
        userId: request.user.id,
        ip: request.ip,
        gdprCompliance: true
      });

      return reply.send({
        status: 'success',
        data: dashboard
      });
    } catch (error) {
      logger.error('Failed to get privacy dashboard', {
        error: error.message,
        userId: request.user.id
      });
      
      return reply.status(500).send({
        status: 'error',
        message: 'Failed to retrieve privacy dashboard'
      });
    }
  });

  /**
   * Record user consent
   * POST /api/v1/gdpr/consent
   */
  app.post('/consent', {
    preHandler: ValidationMiddleware.validate(consentRequestSchema)
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { consentType, granted, method } = request.body as z.infer<typeof consentRequestSchema>;

      await gdprService.recordConsent(
        request.user.id,
        consentType as ConsentType,
        granted,
        request,
        method
      );

      logger.audit('User consent recorded', {
        userId: request.user.id,
        consentType,
        granted,
        method,
        ip: request.ip,
        gdprCompliance: true
      });

      return reply.send({
        status: 'success',
        message: 'Consent recorded successfully',
        data: {
          consentType,
          granted,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to record consent', {
        error: error.message,
        userId: request.user.id,
        body: request.body
      });
      
      return reply.status(500).send({
        status: 'error',
        message: 'Failed to record consent'
      });
    }
  });

  /**
   * Get user's current consents
   * GET /api/v1/gdpr/consent
   */
  app.get('/consent', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const consents = await Promise.all([
        gdprService.hasConsent(request.user.id, ConsentType.NECESSARY),
        gdprService.hasConsent(request.user.id, ConsentType.ANALYTICS),
        gdprService.hasConsent(request.user.id, ConsentType.MARKETING),
        gdprService.hasConsent(request.user.id, ConsentType.FUNCTIONAL)
      ]);

      const consentStatus = {
        necessary: consents[0],
        analytics: consents[1],
        marketing: consents[2],
        functional: consents[3]
      };

      return reply.send({
        status: 'success',
        data: consentStatus
      });
    } catch (error) {
      logger.error('Failed to get consent status', {
        error: error.message,
        userId: request.user.id
      });
      
      return reply.status(500).send({
        status: 'error',
        message: 'Failed to retrieve consent status'
      });
    }
  });

  /**
   * Request data export (Right to Data Portability)
   * POST /api/v1/gdpr/export
   */
  app.post('/export', {
    preHandler: ValidationMiddleware.validate(exportRequestSchema)
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { format } = request.body as z.infer<typeof exportRequestSchema>;

      const requestId = await gdprService.createDataExportRequest(request.user.id, format);

      logger.audit('Data export requested', {
        userId: request.user.id,
        requestId,
        format,
        ip: request.ip,
        gdprCompliance: true,
        rightToDataPortability: true
      });

      return reply.send({
        status: 'success',
        message: 'Data export request submitted successfully',
        data: {
          requestId,
          format,
          estimatedProcessingTime: '24-48 hours',
          notificationMethod: 'email'
        }
      });
    } catch (error) {
      logger.error('Failed to create data export request', {
        error: error.message,
        userId: request.user.id,
        body: request.body
      });
      
      return reply.status(500).send({
        status: 'error',
        message: 'Failed to create data export request'
      });
    }
  });

  /**
   * Get data export requests status
   * GET /api/v1/gdpr/export
   */
  app.get('/export', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      // Get user's export requests from database
      const requests = await app.db.query(`
        SELECT id, requested_at, status, format, completed_at, expires_at
        FROM data_export_requests
        WHERE user_id = $1
        ORDER BY requested_at DESC
        LIMIT 10
      `, [request.user.id]);

      return reply.send({
        status: 'success',
        data: requests.rows
      });
    } catch (error) {
      logger.error('Failed to get export requests', {
        error: error.message,
        userId: request.user.id
      });
      
      return reply.status(500).send({
        status: 'error',
        message: 'Failed to retrieve export requests'
      });
    }
  });

  /**
   * Download exported data
   * GET /api/v1/gdpr/download/:token
   */
  app.get('/download/:token', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.params as { token: string };

      // Validate download token
      const tokenResult = await app.db.query(`
        SELECT dt.file_path, dt.downloads_count, dt.max_downloads, dt.expires_at,
               der.user_id, der.format
        FROM download_tokens dt
        JOIN data_export_requests der ON dt.request_id = der.id
        WHERE dt.token = $1 AND dt.expires_at > NOW()
      `, [token]);

      if (tokenResult.rows.length === 0) {
        return reply.status(404).send({
          status: 'error',
          message: 'Download link not found or expired'
        });
      }

      const tokenData = tokenResult.rows[0];

      // Check download limit
      if (tokenData.downloads_count >= tokenData.max_downloads) {
        return reply.status(403).send({
          status: 'error',
          message: 'Download limit exceeded'
        });
      }

      // Update download count
      await app.db.query(`
        UPDATE download_tokens 
        SET downloads_count = downloads_count + 1, last_accessed = NOW()
        WHERE token = $1
      `, [token]);

      // Serve the file
      const fs = require('fs');
      const path = require('path');
      
      if (!fs.existsSync(tokenData.file_path)) {
        return reply.status(404).send({
          status: 'error',
          message: 'File not found'
        });
      }

      const filename = `user_data_export.${tokenData.format}`;
      const fileStream = fs.createReadStream(tokenData.file_path);

      logger.audit('Data export downloaded', {
        userId: tokenData.user_id,
        token,
        format: tokenData.format,
        downloadsCount: tokenData.downloads_count + 1,
        ip: request.ip,
        gdprCompliance: true
      });

      return reply
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .header('Content-Type', 'application/octet-stream')
        .send(fileStream);

    } catch (error) {
      logger.error('Failed to download exported data', {
        error: error.message,
        token: (request.params as any)?.token
      });
      
      return reply.status(500).send({
        status: 'error',
        message: 'Failed to download data'
      });
    }
  });

  /**
   * Request data deletion (Right to be Forgotten)
   * POST /api/v1/gdpr/delete
   */
  app.post('/delete', {
    preHandler: ValidationMiddleware.validate(deletionRequestSchema)
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { reason, confirmDeletion } = request.body as z.infer<typeof deletionRequestSchema>;

      if (!confirmDeletion) {
        return reply.status(400).send({
          status: 'error',
          message: 'Deletion must be explicitly confirmed'
        });
      }

      const requestId = await gdprService.createDataDeletionRequest(request.user.id, reason);

      logger.audit('Data deletion requested', {
        userId: request.user.id,
        requestId,
        reason,
        ip: request.ip,
        gdprCompliance: true,
        rightToBeForgotten: true
      });

      return reply.send({
        status: 'success',
        message: 'Data deletion request submitted successfully',
        data: {
          requestId,
          estimatedProcessingTime: '30 days',
          importantNote: 'Some data may be retained for legal compliance purposes',
          contactInfo: 'privacy@receiptvault.com'
        }
      });
    } catch (error) {
      logger.error('Failed to create data deletion request', {
        error: error.message,
        userId: request.user.id,
        body: request.body
      });
      
      return reply.status(500).send({
        status: 'error',
        message: 'Failed to create data deletion request'
      });
    }
  });

  /**
   * Get data deletion requests status
   * GET /api/v1/gdpr/delete
   */
  app.get('/delete', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const requests = await app.db.query(`
        SELECT id, requested_at, status, reason, completed_at, retained_data
        FROM data_deletion_requests
        WHERE user_id = $1
        ORDER BY requested_at DESC
        LIMIT 10
      `, [request.user.id]);

      return reply.send({
        status: 'success',
        data: requests.rows
      });
    } catch (error) {
      logger.error('Failed to get deletion requests', {
        error: error.message,
        userId: request.user.id
      });
      
      return reply.status(500).send({
        status: 'error',
        message: 'Failed to retrieve deletion requests'
      });
    }
  });

  /**
   * Update privacy settings
   * PUT /api/v1/gdpr/privacy-settings
   */
  app.put('/privacy-settings', {
    preHandler: ValidationMiddleware.validate(privacySettingsSchema)
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const settings = request.body as z.infer<typeof privacySettingsSchema>;

      // Update user privacy settings
      await app.db.query(`
        INSERT INTO user_privacy_settings (
          user_id, marketing_consent, analytics_consent, third_party_sharing,
          data_retention_preference, privacy_level, communication_preferences
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
          marketing_consent = COALESCE($2, user_privacy_settings.marketing_consent),
          analytics_consent = COALESCE($3, user_privacy_settings.analytics_consent),
          third_party_sharing = COALESCE($4, user_privacy_settings.third_party_sharing),
          data_retention_preference = COALESCE($5, user_privacy_settings.data_retention_preference),
          privacy_level = COALESCE($6, user_privacy_settings.privacy_level),
          communication_preferences = COALESCE($7, user_privacy_settings.communication_preferences),
          updated_at = NOW()
      `, [
        request.user.id,
        settings.marketingConsent,
        settings.analyticsConsent,
        settings.thirdPartySharing,
        settings.dataRetentionPreference,
        settings.privacyLevel,
        JSON.stringify(settings.communicationPreferences || {})
      ]);

      logger.audit('Privacy settings updated', {
        userId: request.user.id,
        settings,
        ip: request.ip,
        gdprCompliance: true
      });

      return reply.send({
        status: 'success',
        message: 'Privacy settings updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update privacy settings', {
        error: error.message,
        userId: request.user.id,
        body: request.body
      });
      
      return reply.status(500).send({
        status: 'error',
        message: 'Failed to update privacy settings'
      });
    }
  });

  /**
   * Get privacy policy and data processing notice
   * GET /api/v1/gdpr/privacy-policy
   */
  app.get('/privacy-policy', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const privacyNotice = await gdprService.generatePrivacyNotice();

      return reply.send({
        status: 'success',
        data: JSON.parse(privacyNotice)
      });
    } catch (error) {
      logger.error('Failed to get privacy policy', {
        error: error.message
      });
      
      return reply.status(500).send({
        status: 'error',
        message: 'Failed to retrieve privacy policy'
      });
    }
  });

  /**
   * Submit data rectification request (Right to Rectification)
   * POST /api/v1/gdpr/rectify
   */
  app.post('/rectify', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { field, currentValue, correctedValue, reason } = request.body as {
        field: string;
        currentValue: string;
        correctedValue: string;
        reason?: string;
      };

      // Create rectification request
      const requestId = `rect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await app.db.query(`
        INSERT INTO gdpr_audit_log (
          user_id, action, details, ip_address, user_agent, timestamp
        ) VALUES ($1, 'rectification_request', $2, $3, $4, NOW())
      `, [
        request.user.id,
        JSON.stringify({
          requestId,
          field,
          currentValue,
          correctedValue,
          reason
        }),
        request.ip,
        request.headers['user-agent']
      ]);

      logger.audit('Data rectification requested', {
        userId: request.user.id,
        requestId,
        field,
        reason,
        ip: request.ip,
        gdprCompliance: true,
        rightToRectification: true
      });

      return reply.send({
        status: 'success',
        message: 'Data rectification request submitted',
        data: {
          requestId,
          field,
          estimatedProcessingTime: '30 days'
        }
      });
    } catch (error) {
      logger.error('Failed to create rectification request', {
        error: error.message,
        userId: request.user.id,
        body: request.body
      });
      
      return reply.status(500).send({
        status: 'error',
        message: 'Failed to create rectification request'
      });
    }
  });

  /**
   * Object to data processing (Right to Object)
   * POST /api/v1/gdpr/object
   */
  app.post('/object', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { processingType, reason } = request.body as {
        processingType: string;
        reason: string;
      };

      const requestId = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await app.db.query(`
        INSERT INTO gdpr_audit_log (
          user_id, action, details, ip_address, user_agent, timestamp
        ) VALUES ($1, 'objection_request', $2, $3, $4, NOW())
      `, [
        request.user.id,
        JSON.stringify({
          requestId,
          processingType,
          reason
        }),
        request.ip,
        request.headers['user-agent']
      ]);

      logger.audit('Data processing objection submitted', {
        userId: request.user.id,
        requestId,
        processingType,
        reason,
        ip: request.ip,
        gdprCompliance: true,
        rightToObject: true
      });

      return reply.send({
        status: 'success',
        message: 'Objection to data processing submitted',
        data: {
          requestId,
          processingType,
          estimatedProcessingTime: '30 days'
        }
      });
    } catch (error) {
      logger.error('Failed to create objection request', {
        error: error.message,
        userId: request.user.id,
        body: request.body
      });
      
      return reply.status(500).send({
        status: 'error',
        message: 'Failed to create objection request'
      });
    }
  });
}