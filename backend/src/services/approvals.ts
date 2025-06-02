import { db } from '@/database/connection';
import { logger } from '@/utils/logger';
import { redis } from '@/config/redis';
import { v4 as uuidv4 } from 'uuid';

interface ApprovalFilter {
  companyId: string;
  userId?: string;
  userRole?: string;
  approverId?: string;
  submitterId?: string;
  status?: string;
  page: number;
  limit: number;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
}

interface SubmitApprovalParams {
  receiptId: string;
  submitterId: string;
  companyId: string;
  comments?: string;
  priority?: string;
  requestedApprover?: string;
}

interface ProcessApprovalParams {
  receiptId: string;
  approverId: string;
  action: 'approve' | 'reject';
  comments?: string;
  tags?: string[];
}

interface BulkApprovalParams {
  receiptIds: string[];
  approverId: string;
  action: 'approve' | 'reject';
  comments?: string;
  companyId: string;
}

interface WorkflowConfig {
  autoApprovalThreshold: number;
  requireApprovalAbove: number;
  defaultApprovers: string[];
  approvalLevels: Array<{
    threshold: number;
    requiredApprovers: number;
    approverRoles: string[];
  }>;
  notifications: {
    emailEnabled: boolean;
    slackEnabled: boolean;
    reminderAfterHours: number;
  };
}

interface ApprovalStats {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  averageApprovalTime: number;
  approvalRate: number;
  topApprovers: Array<{
    approverId: string;
    approverName: string;
    count: number;
    averageTime: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    pending: number;
    approved: number;
    rejected: number;
  }>;
  timelineData: Array<{
    date: string;
    pending: number;
    approved: number;
    rejected: number;
  }>;
}

export const approvalsService = {
  async getPendingApprovals(filter: ApprovalFilter) {
    try {
      const { companyId, approverId, page, limit } = filter;
      const offset = (page - 1) * limit;

      let whereClause = `
        WHERE r.company_id = $1 
        AND a.status = 'pending'
        AND (a.assigned_approver_id = $2 OR $2 IN (
          SELECT user_id FROM company_users 
          WHERE company_id = $1 AND role IN ('admin', 'approver')
        ))
      `;
      
      const params = [companyId, approverId];
      let paramIndex = 3;

      // Add additional filters
      if (filter.category) {
        whereClause += ` AND r.category = $${paramIndex}`;
        params.push(filter.category);
        paramIndex++;
      }

      if (filter.minAmount) {
        whereClause += ` AND r.amount >= $${paramIndex}`;
        params.push(filter.minAmount.toString());
        paramIndex++;
      }

      if (filter.maxAmount) {
        whereClause += ` AND r.amount <= $${paramIndex}`;
        params.push(filter.maxAmount.toString());
        paramIndex++;
      }

      if (filter.startDate) {
        whereClause += ` AND r.created_at >= $${paramIndex}`;
        params.push(filter.startDate);
        paramIndex++;
      }

      if (filter.endDate) {
        whereClause += ` AND r.created_at <= $${paramIndex}`;
        params.push(filter.endDate);
        paramIndex++;
      }

      const query = `
        SELECT 
          r.id as receipt_id,
          r.vendor,
          r.amount,
          r.currency,
          r.category,
          r.date as receipt_date,
          r.image_url,
          r.ocr_text,
          a.id as approval_id,
          a.status,
          a.priority,
          a.submitted_at,
          a.comments as submission_comments,
          u.name as submitter_name,
          u.email as submitter_email,
          ap.name as assigned_approver_name
        FROM receipts r
        JOIN approvals a ON r.id = a.receipt_id
        JOIN users u ON a.submitter_id = u.id
        LEFT JOIN users ap ON a.assigned_approver_id = ap.id
        ${whereClause}
        ORDER BY 
          CASE a.priority 
            WHEN 'high' THEN 1 
            WHEN 'normal' THEN 2 
            WHEN 'low' THEN 3 
          END,
          a.submitted_at ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit.toString(), offset.toString());

      const countQuery = `
        SELECT COUNT(*) as total
        FROM receipts r
        JOIN approvals a ON r.id = a.receipt_id
        ${whereClause}
      `;

      const [dataResult, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, params.slice(0, -2))
      ]);

      return {
        data: dataResult.rows,
        total: parseInt(countResult.rows[0].total)
      };
    } catch (error) {
      logger.error('Error getting pending approvals:', error);
      throw error;
    }
  },

  async getApprovals(filter: ApprovalFilter) {
    try {
      const { companyId, userId, userRole, page, limit } = filter;
      const offset = (page - 1) * limit;

      let whereClause = `WHERE r.company_id = $1`;
      const params = [companyId];
      let paramIndex = 2;

      // Role-based filtering
      if (userRole !== 'admin') {
        whereClause += ` AND (a.submitter_id = $${paramIndex} OR a.assigned_approver_id = $${paramIndex})`;
        params.push(userId);
        paramIndex++;
      }

      // Add status filter
      if (filter.status) {
        whereClause += ` AND a.status = $${paramIndex}`;
        params.push(filter.status);
        paramIndex++;
      }

      // Add other filters...
      if (filter.submitterId) {
        whereClause += ` AND a.submitter_id = $${paramIndex}`;
        params.push(filter.submitterId);
        paramIndex++;
      }

      if (filter.approverId) {
        whereClause += ` AND a.assigned_approver_id = $${paramIndex}`;
        params.push(filter.approverId);
        paramIndex++;
      }

      const query = `
        SELECT 
          r.id as receipt_id,
          r.vendor,
          r.amount,
          r.currency,
          r.category,
          r.date as receipt_date,
          a.id as approval_id,
          a.status,
          a.priority,
          a.submitted_at,
          a.approved_at,
          a.comments as submission_comments,
          a.approval_comments,
          u.name as submitter_name,
          ap.name as approver_name,
          aa.name as approved_by_name
        FROM receipts r
        JOIN approvals a ON r.id = a.receipt_id
        JOIN users u ON a.submitter_id = u.id
        LEFT JOIN users ap ON a.assigned_approver_id = ap.id
        LEFT JOIN users aa ON a.approved_by_id = aa.id
        ${whereClause}
        ORDER BY a.submitted_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit.toString(), offset.toString());

      const countQuery = `
        SELECT COUNT(*) as total
        FROM receipts r
        JOIN approvals a ON r.id = a.receipt_id
        ${whereClause}
      `;

      const [dataResult, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, params.slice(0, -2))
      ]);

      return {
        data: dataResult.rows,
        total: parseInt(countResult.rows[0].total)
      };
    } catch (error) {
      logger.error('Error getting approvals:', error);
      throw error;
    }
  },

  async getApprovalDetails(
    receiptId: string, 
    context: { userId: string; companyId: string; userRole: string }
  ) {
    try {
      const query = `
        SELECT 
          r.*,
          a.id as approval_id,
          a.status,
          a.priority,
          a.submitted_at,
          a.approved_at,
          a.comments as submission_comments,
          a.approval_comments,
          a.tags,
          u.name as submitter_name,
          u.email as submitter_email,
          ap.name as assigned_approver_name,
          aa.name as approved_by_name,
          wc.auto_approval_threshold,
          wc.require_approval_above
        FROM receipts r
        JOIN approvals a ON r.id = a.receipt_id
        JOIN users u ON a.submitter_id = u.id
        LEFT JOIN users ap ON a.assigned_approver_id = ap.id
        LEFT JOIN users aa ON a.approved_by_id = aa.id
        LEFT JOIN workflow_configs wc ON r.company_id = wc.company_id
        WHERE r.id = $1 AND r.company_id = $2
      `;

      const result = await db.query(query, [receiptId, context.companyId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const approval = result.rows[0];

      // Check if user has permission to view this approval
      if (context.userRole !== 'admin' && 
          approval.submitter_id !== context.userId && 
          approval.assigned_approver_id !== context.userId) {
        throw new Error('Insufficient permissions to view this approval');
      }

      return approval;
    } catch (error) {
      logger.error('Error getting approval details:', error);
      throw error;
    }
  },

  async submitForApproval(params: SubmitApprovalParams) {
    try {
      const {
        receiptId,
        submitterId,
        companyId,
        comments,
        priority = 'normal',
        requestedApprover
      } = params;

      // Get workflow config to determine approval requirements
      const workflowConfig = await this.getWorkflowConfig(companyId);
      
      // Check if receipt exists and belongs to user
      const receiptQuery = `
        SELECT * FROM receipts 
        WHERE id = $1 AND user_id = $2 AND company_id = $3
      `;
      const receiptResult = await db.query(receiptQuery, [receiptId, submitterId, companyId]);
      
      if (receiptResult.rows.length === 0) {
        throw new Error('Receipt not found or access denied');
      }

      const receipt = receiptResult.rows[0];

      // Check if auto-approval applies
      if (receipt.amount <= workflowConfig.autoApprovalThreshold) {
        // Auto-approve the receipt
        return this.autoApprove(receiptId, submitterId);
      }

      // Determine assigned approver
      let assignedApproverId = requestedApprover;
      if (!assignedApproverId) {
        assignedApproverId = await this.getNextApprover(companyId, receipt.amount);
      }

      // Create approval record
      const approvalId = uuidv4();
      const insertQuery = `
        INSERT INTO approvals (
          id, receipt_id, submitter_id, assigned_approver_id, 
          status, priority, comments, submitted_at, company_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
        RETURNING *
      `;

      const result = await db.query(insertQuery, [
        approvalId,
        receiptId,
        submitterId,
        assignedApproverId,
        'pending',
        priority,
        comments,
        companyId
      ]);

      // Update receipt status
      await db.query(
        'UPDATE receipts SET status = $1 WHERE id = $2',
        ['pending_approval', receiptId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error submitting for approval:', error);
      throw error;
    }
  },

  async processApproval(params: ProcessApprovalParams) {
    try {
      const { receiptId, approverId, action, comments, tags } = params;

      // Get approval record
      const approvalQuery = `
        SELECT * FROM approvals 
        WHERE receipt_id = $1 AND status = 'pending'
      `;
      const approvalResult = await db.query(approvalQuery, [receiptId]);
      
      if (approvalResult.rows.length === 0) {
        throw new Error('Pending approval not found');
      }

      const approval = approvalResult.rows[0];

      // Update approval record
      const updateQuery = `
        UPDATE approvals 
        SET 
          status = $1,
          approved_by_id = $2,
          approved_at = NOW(),
          approval_comments = $3,
          tags = $4
        WHERE id = $5
        RETURNING *
      `;

      const result = await db.query(updateQuery, [
        action === 'approve' ? 'approved' : 'rejected',
        approverId,
        comments,
        tags ? JSON.stringify(tags) : null,
        approval.id
      ]);

      // Update receipt status
      const receiptStatus = action === 'approve' ? 'approved' : 'rejected';
      await db.query(
        'UPDATE receipts SET status = $1 WHERE id = $2',
        [receiptStatus, receiptId]
      );

      // If approved, apply any tags to the receipt
      if (action === 'approve' && tags && tags.length > 0) {
        await this.applyTagsToReceipt(receiptId, tags);
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error processing approval:', error);
      throw error;
    }
  },

  async bulkProcessApprovals(params: BulkApprovalParams) {
    try {
      const { receiptIds, approverId, action, comments, companyId } = params;

      const successful: string[] = [];
      const failed: Array<{ receiptId: string; error: string }> = [];

      for (const receiptId of receiptIds) {
        try {
          // Check approval authority for each receipt
          const hasAuthority = await this.checkApprovalAuthority({
            userId: approverId,
            receiptId,
            companyId
          });

          if (!hasAuthority) {
            failed.push({
              receiptId,
              error: 'Insufficient approval authority'
            });
            continue;
          }

          await this.processApproval({
            receiptId,
            approverId,
            action,
            comments
          });

          successful.push(receiptId);
        } catch (error) {
          failed.push({
            receiptId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return { successful, failed };
    } catch (error) {
      logger.error('Error bulk processing approvals:', error);
      throw error;
    }
  },

  async checkApprovalAuthority(params: {
    userId: string;
    receiptId: string;
    companyId: string;
  }): Promise<boolean> {
    try {
      const { userId, receiptId, companyId } = params;

      // Check if user is assigned approver or has admin/approver role
      const query = `
        SELECT 
          a.assigned_approver_id,
          cu.role,
          r.amount,
          wc.approval_levels
        FROM approvals a
        JOIN receipts r ON a.receipt_id = r.id
        JOIN company_users cu ON cu.user_id = $1 AND cu.company_id = $2
        LEFT JOIN workflow_configs wc ON wc.company_id = $2
        WHERE a.receipt_id = $3 AND a.status = 'pending'
      `;

      const result = await db.query(query, [userId, companyId, receiptId]);
      
      if (result.rows.length === 0) {
        return false;
      }

      const { assigned_approver_id, role, amount, approval_levels } = result.rows[0];

      // Check if user is the assigned approver
      if (assigned_approver_id === userId) {
        return true;
      }

      // Check if user has admin role
      if (role === 'admin') {
        return true;
      }

      // Check approval levels based on amount
      if (approval_levels && role === 'approver') {
        const levels = JSON.parse(approval_levels);
        for (const level of levels) {
          if (amount >= level.threshold && level.approverRoles.includes(role)) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      logger.error('Error checking approval authority:', error);
      return false;
    }
  },

  async getWorkflowConfig(companyId: string): Promise<WorkflowConfig> {
    try {
      const cacheKey = `workflow_config:${companyId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const query = `
        SELECT * FROM workflow_configs WHERE company_id = $1
      `;
      const result = await db.query(query, [companyId]);

      let config: WorkflowConfig;
      
      if (result.rows.length === 0) {
        // Create default config
        config = {
          autoApprovalThreshold: 50,
          requireApprovalAbove: 100,
          defaultApprovers: [],
          approvalLevels: [
            {
              threshold: 100,
              requiredApprovers: 1,
              approverRoles: ['approver', 'admin']
            },
            {
              threshold: 1000,
              requiredApprovers: 2,
              approverRoles: ['admin']
            }
          ],
          notifications: {
            emailEnabled: true,
            slackEnabled: false,
            reminderAfterHours: 24
          }
        };

        await this.createDefaultWorkflowConfig(companyId, config);
      } else {
        const row = result.rows[0];
        config = {
          autoApprovalThreshold: row.auto_approval_threshold,
          requireApprovalAbove: row.require_approval_above,
          defaultApprovers: row.default_approvers || [],
          approvalLevels: row.approval_levels || [],
          notifications: row.notifications || {
            emailEnabled: true,
            slackEnabled: false,
            reminderAfterHours: 24
          }
        };
      }

      await redis.setex(cacheKey, 3600, JSON.stringify(config)); // Cache for 1 hour
      return config;
    } catch (error) {
      logger.error('Error getting workflow config:', error);
      throw error;
    }
  },

  async updateWorkflowConfig(companyId: string, updates: Partial<WorkflowConfig>): Promise<WorkflowConfig> {
    try {
      const currentConfig = await this.getWorkflowConfig(companyId);
      const newConfig = { ...currentConfig, ...updates };

      const query = `
        UPDATE workflow_configs 
        SET 
          auto_approval_threshold = $1,
          require_approval_above = $2,
          default_approvers = $3,
          approval_levels = $4,
          notifications = $5,
          updated_at = NOW()
        WHERE company_id = $6
        RETURNING *
      `;

      await db.query(query, [
        newConfig.autoApprovalThreshold,
        newConfig.requireApprovalAbove,
        JSON.stringify(newConfig.defaultApprovers),
        JSON.stringify(newConfig.approvalLevels),
        JSON.stringify(newConfig.notifications),
        companyId
      ]);

      // Clear cache
      await redis.del(`workflow_config:${companyId}`);

      return newConfig;
    } catch (error) {
      logger.error('Error updating workflow config:', error);
      throw error;
    }
  },

  async getApprovalStats(params: {
    companyId: string;
    startDate?: Date;
    endDate?: Date;
    approverId?: string;
    submitterId?: string;
  }): Promise<ApprovalStats> {
    try {
      // Implementation for approval statistics
      // This would involve complex queries to gather metrics
      
      // Placeholder implementation
      return {
        totalPending: 0,
        totalApproved: 0,
        totalRejected: 0,
        averageApprovalTime: 0,
        approvalRate: 0,
        topApprovers: [],
        categoryBreakdown: [],
        timelineData: []
      };
    } catch (error) {
      logger.error('Error getting approval stats:', error);
      throw error;
    }
  },

  async getApprovalHistory(params: {
    receiptId: string;
    companyId: string;
    userId: string;
    userRole: string;
  }) {
    try {
      const query = `
        SELECT 
          ah.*,
          u.name as user_name,
          u.email as user_email
        FROM approval_history ah
        JOIN users u ON ah.user_id = u.id
        WHERE ah.receipt_id = $1
        ORDER BY ah.created_at ASC
      `;

      const result = await db.query(query, [params.receiptId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting approval history:', error);
      throw error;
    }
  },

  async delegateApproval(params: {
    delegatorId: string;
    delegateToId: string;
    companyId: string;
    startDate: Date;
    endDate: Date;
    maxAmount?: number;
    categories?: string[];
    reason?: string;
  }) {
    try {
      const delegationId = uuidv4();
      
      const query = `
        INSERT INTO approval_delegations (
          id, delegator_id, delegate_to_id, company_id,
          start_date, end_date, max_amount, categories,
          reason, created_at, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'active')
        RETURNING *
      `;

      const result = await db.query(query, [
        delegationId,
        params.delegatorId,
        params.delegateToId,
        params.companyId,
        params.startDate,
        params.endDate,
        params.maxAmount,
        params.categories ? JSON.stringify(params.categories) : null,
        params.reason
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error delegating approval:', error);
      throw error;
    }
  },

  async autoApprove(receiptId: string, submitterId: string) {
    // Implementation for auto-approval
    const approvalId = uuidv4();
    
    const query = `
      INSERT INTO approvals (
        id, receipt_id, submitter_id, status, 
        approved_at, approval_comments, auto_approved
      )
      VALUES ($1, $2, $3, 'approved', NOW(), 'Auto-approved based on company policy', true)
      RETURNING *
    `;

    const result = await db.query(query, [approvalId, receiptId, submitterId]);
    
    // Update receipt status
    await db.query(
      'UPDATE receipts SET status = $1 WHERE id = $2',
      ['approved', receiptId]
    );

    return result.rows[0];
  },

  async getNextApprover(companyId: string, amount: number): Promise<string> {
    // Implementation to determine next approver based on workflow config
    const config = await this.getWorkflowConfig(companyId);
    
    // Return first default approver for now
    if (config.defaultApprovers.length > 0) {
      return config.defaultApprovers[0];
    }

    // Find an admin or approver
    const query = `
      SELECT user_id FROM company_users 
      WHERE company_id = $1 AND role IN ('admin', 'approver')
      ORDER BY created_at ASC
      LIMIT 1
    `;
    
    const result = await db.query(query, [companyId]);
    return result.rows[0]?.user_id;
  },

  async applyTagsToReceipt(receiptId: string, tags: string[]) {
    // Implementation to apply tags to receipt
    for (const tag of tags) {
      await db.query(
        'INSERT INTO receipt_tags (receipt_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [receiptId, tag]
      );
    }
  },

  async createDefaultWorkflowConfig(companyId: string, config: WorkflowConfig) {
    const query = `
      INSERT INTO workflow_configs (
        company_id, auto_approval_threshold, require_approval_above,
        default_approvers, approval_levels, notifications, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `;

    await db.query(query, [
      companyId,
      config.autoApprovalThreshold,
      config.requireApprovalAbove,
      JSON.stringify(config.defaultApprovers),
      JSON.stringify(config.approvalLevels),
      JSON.stringify(config.notifications)
    ]);
  }
};