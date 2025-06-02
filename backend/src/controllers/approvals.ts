import { FastifyRequest, FastifyReply } from 'fastify';
import { approvalsService } from '@/services/approvals';
import { notificationService } from '@/services/notifications';
import * as auditService from '@/services/audit';
import { logger } from '@/utils/logger';

interface ApprovalQueryParams {
  status?: string;
  submitterId?: string;
  approverId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
}

export const approvalsController = {
  async getPendingApprovals(
    request: FastifyRequest<{ Querystring: ApprovalQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { page = 1, limit = 20, ...filters } = request.query;

      const approvals = await approvalsService.getPendingApprovals({
        approverId: (user as any).id,
        companyId: (user as any).companyId,
        page,
        limit,
        ...filters
      });

      return reply.send({
        success: true,
        data: approvals.data,
        pagination: {
          page,
          limit,
          total: approvals.total,
          totalPages: Math.ceil(approvals.total / limit)
        }
      });
    } catch (error) {
      logger.error('Error getting pending approvals:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get pending approvals'
      });
    }
  },

  async getApprovals(
    request: FastifyRequest<{ Querystring: ApprovalQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { page = 1, limit = 20, ...filters } = request.query;

      const approvals = await approvalsService.getApprovals({
        companyId: (user as any).companyId,
        userId: (user as any).id,
        userRole: (user as any).role,
        page,
        limit,
        ...filters
      });

      return reply.send({
        success: true,
        data: approvals.data,
        pagination: {
          page,
          limit,
          total: approvals.total,
          totalPages: Math.ceil(approvals.total / limit)
        }
      });
    } catch (error) {
      logger.error('Error getting approvals:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get approvals'
      });
    }
  },

  async getApprovalDetails(
    request: FastifyRequest<{ Params: { receiptId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { receiptId } = request.params;
      const user = request.user;

      const approval = await approvalsService.getApprovalDetails(receiptId, {
        userId: (user as any).id,
        companyId: (user as any).companyId,
        userRole: (user as any).role
      });

      if (!approval) {
        return reply.status(404).send({
          success: false,
          error: 'Approval not found'
        });
      }

      return reply.send({
        success: true,
        data: approval
      });
    } catch (error) {
      logger.error('Error getting approval details:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get approval details'
      });
    }
  },

  async submitForApproval(
    request: FastifyRequest<{ 
      Params: { receiptId: string };
      Body: { comments?: string; priority?: string; requestedApprover?: string }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { receiptId } = request.params;
      const { comments, priority = 'normal', requestedApprover } = request.body;
      const user = request.user;

      const approval = await approvalsService.submitForApproval({
        receiptId,
        submitterId: (user as any).id,
        companyId: (user as any).companyId,
        comments,
        priority,
        requestedApprover
      });

      // Send notification to approvers
      await notificationService.notifyApprovers({
        companyId: (user as any).companyId,
        receiptId,
        submitterName: (user as any).name,
        priority,
        requestedApprover
      });

      // Log the submission
      await auditService.logAction({
        userId: (user as any).id,
        action: 'receipt_submitted_for_approval',
        resourceType: 'receipt',
        resourceId: receiptId,
        details: { priority, comments, requestedApprover },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.status(201).send({
        success: true,
        data: approval
      });
    } catch (error) {
      logger.error('Error submitting for approval:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to submit for approval'
      });
    }
  },

  async processApproval(
    request: FastifyRequest<{ 
      Params: { receiptId: string };
      Body: { action: 'approve' | 'reject'; comments?: string; tags?: string[] }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { receiptId } = request.params;
      const { action, comments, tags } = request.body;
      const user = request.user;

      // Check if user has approval authority
      const hasAuthority = await approvalsService.checkApprovalAuthority({
        userId: (user as any).id,
        receiptId,
        companyId: (user as any).companyId
      });

      if (!hasAuthority) {
        return reply.status(403).send({
          success: false,
          error: 'Insufficient approval authority'
        });
      }

      const result = await approvalsService.processApproval({
        receiptId,
        approverId: (user as any).id,
        action,
        comments,
        tags
      });

      // Send notification to submitter
      await notificationService.notifySubmitter({
        receiptId,
        action,
        approverName: (user as any).name,
        comments
      });

      // Log the approval action
      await auditService.logAction({
        userId: (user as any).id,
        action: `receipt_${action}`,
        resourceType: 'receipt',
        resourceId: receiptId,
        details: { comments, tags },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error processing approval:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to process approval'
      });
    }
  },

  async bulkProcessApprovals(
    request: FastifyRequest<{ 
      Body: { receiptIds: string[]; action: 'approve' | 'reject'; comments?: string }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { receiptIds, action, comments } = request.body;
      const user = request.user;

      const results = await approvalsService.bulkProcessApprovals({
        receiptIds,
        approverId: (user as any).id,
        action,
        comments,
        companyId: (user as any).companyId
      });

      // Send bulk notifications
      await notificationService.notifyBulkApproval({
        receiptIds: results.successful,
        action,
        approverName: (user as any).name,
        comments
      });

      // Log bulk action
      await auditService.logAction({
        userId: (user as any).id,
        action: `bulk_receipt_${action}`,
        resourceType: 'receipt',
        resourceId: receiptIds.join(','),
        details: { 
          comments, 
          successful: results.successful.length,
          failed: results.failed.length 
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Error bulk processing approvals:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to bulk process approvals'
      });
    }
  },

  async getWorkflowConfig(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;

      const config = await approvalsService.getWorkflowConfig((user as any).companyId);

      return reply.send({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('Error getting workflow config:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get workflow configuration'
      });
    }
  },

  async updateWorkflowConfig(
    request: FastifyRequest<{ 
      Body: {
        autoApprovalThreshold?: number;
        requireApprovalAbove?: number;
        defaultApprovers?: string[];
        approvalLevels?: Array<{
          threshold: number;
          requiredApprovers: number;
          approverRoles: string[];
        }>;
        notifications?: {
          emailEnabled?: boolean;
          slackEnabled?: boolean;
          reminderAfterHours?: number;
        };
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const config = request.body;

      const updatedConfig = await approvalsService.updateWorkflowConfig(
        (user as any).companyId,
        {
          ...config,
          notifications: config.notifications ? {
            emailEnabled: config.notifications.emailEnabled ?? true,
            slackEnabled: config.notifications.slackEnabled ?? false,
            reminderAfterHours: config.notifications.reminderAfterHours ?? 24
          } : {
            emailEnabled: true,
            slackEnabled: false,
            reminderAfterHours: 24
          }
        }
      );

      // Log configuration change
      await auditService.logAction({
        userId: (user as any).id,
        action: 'workflow_config_updated',
        resourceType: 'company',
        resourceId: (user as any).companyId,
        details: config,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.send({
        success: true,
        data: updatedConfig
      });
    } catch (error) {
      logger.error('Error updating workflow config:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update workflow configuration'
      });
    }
  },

  async getApprovalStats(
    request: FastifyRequest<{ 
      Querystring: {
        startDate?: string;
        endDate?: string;
        approverId?: string;
        submitterId?: string;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const { startDate, endDate, approverId, submitterId } = request.query;

      const stats = await approvalsService.getApprovalStats({
        companyId: (user as any).companyId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        approverId,
        submitterId
      });

      return reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error getting approval stats:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get approval statistics'
      });
    }
  },

  async getApprovalHistory(
    request: FastifyRequest<{ Params: { receiptId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { receiptId } = request.params;
      const user = request.user;

      const history = await approvalsService.getApprovalHistory({
        receiptId,
        companyId: (user as any).companyId,
        userId: (user as any).id,
        userRole: (user as any).role
      });

      return reply.send({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Error getting approval history:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get approval history'
      });
    }
  },

  async delegateApproval(
    request: FastifyRequest<{ 
      Body: {
        delegateeTo: string;
        startDate: string;
        endDate: string;
        maxAmount?: number;
        categories?: string[];
        reason?: string;
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const user = request.user;
      const {
        delegateeTo,
        startDate,
        endDate,
        maxAmount,
        categories,
        reason
      } = request.body;

      const delegation = await approvalsService.delegateApproval({
        delegatorId: (user as any).id,
        delegateToId: delegateeTo,
        companyId: (user as any).companyId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        maxAmount,
        categories,
        reason
      });

      // Notify the delegate
      await notificationService.notifyApprovalDelegation({
        delegatorName: (user as any).name,
        delegateToId: delegateeTo,
        startDate,
        endDate,
        maxAmount,
        categories,
        reason
      });

      // Log the delegation
      await auditService.logAction({
        userId: (user as any).id,
        action: 'approval_delegated',
        resourceType: 'user',
        resourceId: delegateeTo,
        details: { startDate, endDate, maxAmount, categories, reason },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.status(201).send({
        success: true,
        data: delegation
      });
    } catch (error) {
      logger.error('Error delegating approval:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delegate approval authority'
      });
    }
  }
};