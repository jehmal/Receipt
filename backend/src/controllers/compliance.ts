import { FastifyRequest, FastifyReply } from 'fastify';
import { complianceService } from '@/services/compliance';
import { auditService } from '@/services/audit';
import { logger } from '@/utils/logger';

interface ComplianceReportQuery {
  jurisdiction?: string;
  startDate?: string;
  endDate?: string;
  format?: 'pdf' | 'csv' | 'json';
  includeAttachments?: boolean;
}

interface AuditExportQuery {
  startDate?: string;
  endDate?: string;
  eventTypes?: string;
  userIds?: string;
  format?: 'csv' | 'json';
}

export const complianceController = {
  async generateTaxComplianceReport(
    request: FastifyRequest<{ Querystring: ComplianceReportQuery }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { jurisdiction, startDate, endDate, format = 'pdf', includeAttachments = false } = request.query;

      const report = await complianceService.generateTaxComplianceReport(
        (user as any).companyId,
        new Date(startDate),
        new Date(endDate)
      );

      // Log report generation
      await auditService.logAction({
        userId: (user as any).id,
        action: 'tax_compliance_report_generated',
        resourceType: 'compliance_report',
        resourceId: report.companyId,
        details: { jurisdiction, startDate, endDate, format },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Error generating tax compliance report:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate tax compliance report'
      });
    }
  },

  async exportAuditLog(
    request: FastifyRequest<{ Querystring: AuditExportQuery }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { startDate, endDate, eventTypes, userIds, format = 'csv' } = request.query;

      const export_ = await complianceService.exportAuditLog(
        (user as any).companyId,
        {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          eventTypes: eventTypes ? eventTypes.split(',') : undefined,
          userIds: userIds ? userIds.split(',') : undefined,
          format
        }
      );

      // Log audit export
      await auditService.logAction({
        userId: (user as any).id,
        action: 'audit_log_exported',
        resourceType: 'audit_log',
        resourceId: (user as any).companyId,
        details: { startDate, endDate, eventTypes, userIds, format },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      const fileExtension = format === 'csv' ? 'csv' : 'json';

      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="audit-log-${startDate}-${endDate}.${fileExtension}"`)
        .send(export_);
    } catch (error) {
      logger.error('Error exporting audit log:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to export audit log'
      });
    }
  },

  async generateDataIntegrityReport(
    request: FastifyRequest<{ 
      Querystring: {
        startDate?: string;
        endDate?: string;
        includeHashVerification?: boolean;
        includeBackupVerification?: boolean;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { 
        startDate, 
        endDate, 
        includeHashVerification = true, 
        includeBackupVerification = false 
      } = request.query;

      const report = await complianceService.generateDataIntegrityReport((user as any).companyId);

      // Log report generation
      await auditService.logAction({
        userId: (user as any).id,
        action: 'data_integrity_report_generated',
        resourceType: 'compliance_report',
        resourceId: report.id,
        details: { startDate, endDate, includeHashVerification, includeBackupVerification },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Error generating data integrity report:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate data integrity report'
      });
    }
  },

  async getRetentionPolicy(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;

      const policy = await complianceService.getRetentionPolicy((user as any).companyId);

      return reply.send({
        success: true,
        data: policy
      });
    } catch (error) {
      logger.error('Error getting retention policy:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get retention policy'
      });
    }
  },

  async updateRetentionPolicy(
    request: FastifyRequest<{ 
      Body: {
        defaultRetentionYears: number;
        taxDocumentRetentionYears: number;
        auditLogRetentionYears: number;
        autoDeleteExpired?: boolean;
        complianceMode?: string;
        exceptions?: Array<{
          category: string;
          retentionYears: number;
          reason: string;
        }>;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const policyUpdate = request.body;

      const updatedPolicy = await complianceService.updateRetentionPolicy(
        (user as any).companyId,
        policyUpdate
      );

      // Log policy update
      await auditService.logAction({
        userId: (user as any).id,
        action: 'retention_policy_updated',
        resourceType: 'company',
        resourceId: (user as any).companyId,
        details: policyUpdate,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        data: updatedPolicy
      });
    } catch (error) {
      logger.error('Error updating retention policy:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update retention policy'
      });
    }
  },

  async applyRetentionPolicy(
    request: FastifyRequest<{ 
      Body: { dryRun?: boolean; categories?: string[] }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { dryRun = true, categories } = request.body;

      const result = await complianceService.applyRetentionPolicy((user as any).companyId);

      // Log policy application
      await auditService.logAction({
        userId: (user as any).id,
        action: dryRun ? 'retention_policy_simulated' : 'retention_policy_applied',
        resourceType: 'company',
        resourceId: (user as any).companyId,
        details: { dryRun, categories, ...result },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error applying retention policy:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to apply retention policy'
      });
    }
  },

  async getCertifications(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;

      const certifications = await complianceService.getCertifications((user as any).companyId);

      return reply.send({
        success: true,
        data: certifications
      });
    } catch (error) {
      logger.error('Error getting certifications:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get certifications'
      });
    }
  },

  async requestCertification(
    request: FastifyRequest<{ 
      Body: {
        certificationType: string;
        requestedBy: string;
        businessJustification: string;
        targetCompletionDate: string;
        additionalRequirements?: string[];
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const certificationRequest = request.body;

      const certification = await complianceService.requestCertification(
        (user as any).companyId,
        certificationRequest.certificationType
      );

      // Log certification request
      await auditService.logAction({
        userId: (user as any).id,
        action: 'certification_requested',
        resourceType: 'certification',
        resourceId: certification.id,
        details: certificationRequest,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.status(201).send({
        success: true,
        data: certification
      });
    } catch (error) {
      logger.error('Error requesting certification:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to request certification'
      });
    }
  },

  async getCertificationDetails(
    request: FastifyRequest<{ Params: { certificationId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { certificationId } = request.params;

      const certification = await complianceService.getCertificationDetails(certificationId);

      if (!certification) {
        return reply.status(404).send({
          success: false,
          error: 'Certification not found'
        });
      }

      return reply.send({
        success: true,
        data: certification
      });
    } catch (error) {
      logger.error('Error getting certification details:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get certification details'
      });
    }
  },

  async getLegalHolds(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;

      const legalHolds = await complianceService.getLegalHolds((user as any).companyId);

      return reply.send({
        success: true,
        data: legalHolds
      });
    } catch (error) {
      logger.error('Error getting legal holds:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get legal holds'
      });
    }
  },

  async createLegalHold(
    request: FastifyRequest<{ 
      Body: {
        name: string;
        description: string;
        startDate: string;
        endDate?: string;
        scope: {
          userIds?: string[];
          categories?: string[];
          dateRange?: { start: string; end: string };
        };
        legalContact: string;
        caseReference?: string;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const legalHoldData = request.body;

      const legalHold = await complianceService.createLegalHold(
        (user as any).companyId,
        {
          ...legalHoldData,
          createdBy: (user as any).id
        }
      );

      // Log legal hold creation
      await auditService.logAction({
        userId: (user as any).id,
        action: 'legal_hold_created',
        resourceType: 'legal_hold',
        resourceId: legalHold.id,
        details: legalHoldData,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.status(201).send({
        success: true,
        data: legalHold
      });
    } catch (error) {
      logger.error('Error creating legal hold:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create legal hold'
      });
    }
  },

  async releaseLegalHold(
    request: FastifyRequest<{ 
      Params: { holdId: string };
      Body: { reason: string; authorizedBy: string }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { holdId } = request.params;
      const { reason, authorizedBy } = request.body;

      const success = await complianceService.releaseLegalHold(holdId);

      if (!success) {
        return reply.status(404).send({
          success: false,
          error: 'Legal hold not found'
        });
      }

      // Log legal hold release
      await auditService.logAction({
        userId: (user as any).id,
        action: 'legal_hold_released',
        resourceType: 'legal_hold',
        resourceId: holdId,
        details: { reason, authorizedBy },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        message: 'Legal hold released successfully'
      });
    } catch (error) {
      logger.error('Error releasing legal hold:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to release legal hold'
      });
    }
  },

  async getDataMap(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;

      const dataMap = await complianceService.getDataMap((user as any).companyId);

      return reply.send({
        success: true,
        data: dataMap
      });
    } catch (error) {
      logger.error('Error getting data map:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get data map'
      });
    }
  },

  async createDataSubjectRequest(
    request: FastifyRequest<{ 
      Body: {
        requestType: string;
        subjectEmail: string;
        subjectName?: string;
        requestDetails: string;
        verificationMethod: string;
        urgency?: string;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const requestData = request.body;

      const dsrRequest = await complianceService.createDataSubjectRequest(
        (user as any).companyId,
        {
          ...requestData,
          submittedBy: (user as any).id
        }
      );

      // Log data subject request
      await auditService.logAction({
        userId: (user as any).id,
        action: 'data_subject_request_created',
        resourceType: 'data_subject_request',
        resourceId: dsrRequest.id,
        details: { requestType: requestData.requestType, subjectEmail: requestData.subjectEmail },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.status(201).send({
        success: true,
        data: dsrRequest
      });
    } catch (error) {
      logger.error('Error creating data subject request:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create data subject request'
      });
    }
  },

  async getDataSubjectRequests(
    request: FastifyRequest<{ 
      Querystring: {
        status?: string;
        requestType?: string;
        page?: number;
        limit?: number;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { status, requestType, page = 1, limit = 20 } = request.query;

      const requests = await complianceService.getDataSubjectRequests((user as any).companyId);

      return reply.send({
        success: true,
        data: requests,
        pagination: {
          page,
          limit,
          total: requests.length,
          totalPages: Math.ceil(requests.length / limit)
        }
      });
    } catch (error) {
      logger.error('Error getting data subject requests:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get data subject requests'
      });
    }
  },

  async getComplianceDashboard(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;

      const dashboard = await complianceService.getComplianceDashboard((user as any).companyId);

      return reply.send({
        success: true,
        data: dashboard
      });
    } catch (error) {
      logger.error('Error getting compliance dashboard:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get compliance dashboard'
      });
    }
  },

  async getComplianceScore(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;

      const score = await complianceService.getComplianceScore((user as any).companyId);

      return reply.send({
        success: true,
        data: score
      });
    } catch (error) {
      logger.error('Error getting compliance score:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get compliance score'
      });
    }
  },

  async getBlockchainVerification(
    request: FastifyRequest<{ Params: { receiptId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { receiptId } = request.params;

      const verification = await complianceService.getBlockchainVerification(receiptId);

      if (!verification) {
        return reply.status(404).send({
          success: false,
          error: 'Blockchain verification not found'
        });
      }

      return reply.send({
        success: true,
        data: verification
      });
    } catch (error) {
      logger.error('Error getting blockchain verification:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get blockchain verification'
      });
    }
  },

  async anchorToBlockchain(
    request: FastifyRequest<{ 
      Body: { receiptIds?: string[]; batchName?: string }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { receiptIds, batchName } = request.body;

      // For now, anchor the first receipt ID as the service only accepts one receiptId
      const receiptId = receiptIds?.[0];
      if (!receiptId) {
        return reply.status(400).send({
          success: false,
          error: 'At least one receipt ID is required'
        });
      }

      const anchor = await complianceService.anchorToBlockchain(receiptId);

      // Log blockchain anchoring
      await auditService.logAction({
        userId: (user as any).id,
        action: 'blockchain_anchor_created',
        resourceType: 'blockchain_anchor',
        resourceId: anchor.receiptId,
        details: { receiptIds, batchName },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.status(201).send({
        success: true,
        data: anchor
      });
    } catch (error) {
      logger.error('Error anchoring to blockchain:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to anchor to blockchain'
      });
    }
  },

  async getComplianceTemplates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = request.user;

      const templates = await complianceService.getComplianceTemplates();

      return reply.send({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error('Error getting compliance templates:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get compliance templates'
      });
    }
  },

  async getComplianceTemplate(
    request: FastifyRequest<{ Params: { templateId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { templateId } = request.params;

      const template = await complianceService.getComplianceTemplate(templateId);

      if (!template) {
        return reply.status(404).send({
          success: false,
          error: 'Compliance template not found'
        });
      }

      return reply.send({
        success: true,
        data: template
      });
    } catch (error) {
      logger.error('Error getting compliance template:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get compliance template'
      });
    }
  }
};