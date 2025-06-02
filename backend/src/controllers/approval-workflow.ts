import { FastifyRequest, FastifyReply } from 'fastify';
import { approvalWorkflowService } from '@/services/approval-workflow';
import { logger } from '@/utils/logger';

interface CreateRuleBody {
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;
  conditions: {
    amountThreshold?: number;
    categories?: string[];
    vendors?: string[];
    timeWindow?: number;
    userRoles?: string[];
  };
  actions: {
    requiresApproval: boolean;
    autoApprove: boolean;
    approvers: string[];
    escalationChain?: string[];
    notifications: {
      onSubmission: boolean;
      onApproval: boolean;
      onRejection: boolean;
      reminderInterval?: number;
    };
  };
}

interface CreateRequestBody {
  receiptId: string;
  amount: number;
  category: string;
  vendor?: string;
  reason?: string;
}

interface ProcessActionBody {
  action: 'approve' | 'reject' | 'request_info';
  comments?: string;
}

interface HistoryQuery {
  status?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  approverId?: string;
  page?: number;
  limit?: number;
}

export const approvalWorkflowController = {
  /**
   * Create a new approval rule
   */
  async createRule(request: FastifyRequest<{ Body: CreateRuleBody }>, reply: FastifyReply): Promise<void> {
    try {
      const userId = (request.user as any).id;
      const companyId = (request.user as any).companyId;

      if (!companyId) {
        return reply.status(400).send({
          success: false,
          error: 'User must be associated with a company to create approval rules'
        });
      }

      // TODO: Check if user has admin permissions for the company

      const ruleData = {
        ...request.body,
        companyId,
        createdBy: userId
      };

      const rule = await approvalWorkflowService.createApprovalRule(ruleData);

      reply.status(201).send({
        success: true,
        data: rule
      });
    } catch (error) {
      logger.error('Error creating approval rule:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to create approval rule'
      });
    }
  },

  /**
   * Get approval rules for a company
   */
  async getRules(request: FastifyRequest<{ Querystring: { active?: boolean } }>, reply: FastifyReply): Promise<void> {
    try {
      const companyId = (request.user as any).companyId;
      const { active } = request.query;

      if (!companyId) {
        return reply.status(400).send({
          success: false,
          error: 'User must be associated with a company'
        });
      }

      const rules = await approvalWorkflowService.getApprovalRules(companyId, active);

      reply.status(200).send({
        success: true,
        data: rules
      });
    } catch (error) {
      logger.error('Error getting approval rules:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get approval rules'
      });
    }
  },

  /**
   * Check if a receipt requires approval
   */
  async checkRequirement(request: FastifyRequest<{ 
    Params: { receiptId: string };
    Querystring: { amount: number; category: string; vendor?: string };
  }>, reply: FastifyReply): Promise<void> {
    try {
      const userId = (request.user as any).id;
      const companyId = (request.user as any).companyId;
      const { receiptId } = request.params;
      const { amount, category, vendor } = request.query;

      if (!companyId) {
        return reply.status(200).send({
          success: true,
          data: { requiresApproval: false }
        });
      }

      const result = await approvalWorkflowService.checkApprovalRequirement(
        receiptId,
        userId,
        companyId,
        amount,
        category,
        vendor
      );

      reply.status(200).send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error checking approval requirement:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to check approval requirement'
      });
    }
  },

  /**
   * Create an approval request
   */
  async createRequest(request: FastifyRequest<{ Body: CreateRequestBody }>, reply: FastifyReply): Promise<void> {
    try {
      const userId = (request.user as any).id;
      const companyId = (request.user as any).companyId;
      const { receiptId, amount, category, vendor, reason } = request.body;

      if (!companyId) {
        return reply.status(400).send({
          success: false,
          error: 'User must be associated with a company'
        });
      }

      // First check if approval is required
      const requirement = await approvalWorkflowService.checkApprovalRequirement(
        receiptId,
        userId,
        companyId,
        amount,
        category,
        vendor
      );

      if (!requirement.requiresApproval || !requirement.rule) {
        return reply.status(400).send({
          success: false,
          error: 'This receipt does not require approval'
        });
      }

      const approvalRequest = await approvalWorkflowService.createApprovalRequest(
        receiptId,
        userId,
        companyId,
        requirement.rule.id,
        amount,
        category,
        vendor,
        reason
      );

      reply.status(201).send({
        success: true,
        data: approvalRequest
      });
    } catch (error) {
      logger.error('Error creating approval request:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to create approval request'
      });
    }
  },

  /**
   * Process an approval action (approve/reject)
   */
  async processAction(request: FastifyRequest<{ 
    Params: { requestId: string };
    Body: ProcessActionBody;
  }>, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const { requestId } = request.params;
      const { action, comments } = request.body;

      const updatedRequest = await approvalWorkflowService.processApprovalAction(
        requestId,
        userId,
        action,
        comments
      );

      reply.status(200).send({
        success: true,
        data: updatedRequest
      });
    } catch (error) {
      logger.error('Error processing approval action:', error);
      reply.status(400).send({
        success: false,
        error: error.message || 'Failed to process approval action'
      });
    }
  },

  /**
   * Get pending approvals for current user
   */
  async getPendingApprovals(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const userId = (request.user as any).id;
      const companyId = (request.user as any).companyId;

      const pendingApprovals = await approvalWorkflowService.getPendingApprovalsForUser(userId, companyId);

      reply.status(200).send({
        success: true,
        data: pendingApprovals
      });
    } catch (error) {
      logger.error('Error getting pending approvals:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get pending approvals'
      });
    }
  },

  /**
   * Get approval history
   */
  async getHistory(request: FastifyRequest<{ Querystring: HistoryQuery }>, reply: FastifyReply): Promise<void> {
    try {
      const companyId = (request.user as any).companyId;
      const { status, startDate, endDate, userId, approverId, page = 1, limit = 50 } = request.query;

      if (!companyId) {
        return reply.status(400).send({
          success: false,
          error: 'User must be associated with a company'
        });
      }

      const filters: any = {};
      if (status) filters.status = status;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);
      if (userId) filters.userId = userId;
      if (approverId) filters.approverId = approverId;

      const result = await approvalWorkflowService.getApprovalHistory(
        companyId,
        filters,
        page,
        limit
      );

      reply.status(200).send({
        success: true,
        data: result.requests,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      });
    } catch (error) {
      logger.error('Error getting approval history:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get approval history'
      });
    }
  },

  /**
   * Get approval request details
   */
  async getRequestDetails(request: FastifyRequest<{ Params: { requestId: string } }>, reply: FastifyReply): Promise<void> {
    try {
      const { requestId } = request.params;
      const companyId = (request.user as any).companyId;

      // Get approval request with receipt details
      const result = await approvalWorkflowService.getApprovalHistory(
        companyId!,
        { userId: undefined }, // Get all requests for this company
        1,
        1000 // Large limit to find the specific request
      );

      const approvalRequest = result.requests.find(req => req.id === requestId);

      if (!approvalRequest) {
        return reply.status(404).send({
          success: false,
          error: 'Approval request not found'
        });
      }

      reply.status(200).send({
        success: true,
        data: approvalRequest
      });
    } catch (error) {
      logger.error('Error getting request details:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get request details'
      });
    }
  },

  /**
   * Escalate an approval request
   */
  async escalateRequest(request: FastifyRequest<{ Params: { requestId: string } }>, reply: FastifyReply) {
    try {
      const { requestId } = request.params;

      const escalatedRequest = await approvalWorkflowService.escalateApproval(requestId);

      reply.status(200).send({
        success: true,
        data: escalatedRequest
      });
    } catch (error) {
      logger.error('Error escalating request:', error);
      reply.status(400).send({
        success: false,
        error: error.message || 'Failed to escalate request'
      });
    }
  },

  /**
   * Get approval statistics for dashboard
   */
  async getStatistics(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const companyId = (request.user as any).companyId;

      if (!companyId) {
        return reply.status(400).send({
          success: false,
          error: 'User must be associated with a company'
        });
      }

      // Get various statistics
      const [
        pendingCount,
        approvedThisMonth,
        rejectedThisMonth,
        averageApprovalTime
      ] = await Promise.all([
        approvalWorkflowService.getApprovalHistory(companyId, { status: 'pending' }, 1, 1000),
        approvalWorkflowService.getApprovalHistory(companyId, { 
          status: 'approved',
          startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }, 1, 1000),
        approvalWorkflowService.getApprovalHistory(companyId, { 
          status: 'rejected',
          startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }, 1, 1000),
        // TODO: Calculate average approval time
        Promise.resolve(0)
      ]);

      const statistics = {
        pending: pendingCount.total,
        approvedThisMonth: approvedThisMonth.total,
        rejectedThisMonth: rejectedThisMonth.total,
        averageApprovalTimeHours: averageApprovalTime,
        totalActiveRules: (await approvalWorkflowService.getApprovalRules(companyId, true)).length
      };

      reply.status(200).send({
        success: true,
        data: statistics
      });
    } catch (error) {
      logger.error('Error getting approval statistics:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get approval statistics'
      });
    }
  }
};