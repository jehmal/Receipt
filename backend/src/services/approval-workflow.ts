import { db } from '../database/connection';
import { redis as redisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { sendNotification } from './notifications';

export interface ApprovalRule {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;
  conditions: {
    amountThreshold?: number;
    categories?: string[];
    vendors?: string[];
    timeWindow?: number; // hours
    userRoles?: string[];
  };
  actions: {
    requiresApproval: boolean;
    autoApprove: boolean;
    approvers: string[]; // user IDs
    escalationChain?: string[]; // user IDs for escalation
    notifications: {
      onSubmission: boolean;
      onApproval: boolean;
      onRejection: boolean;
      reminderInterval?: number; // hours
    };
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ApprovalRequest {
  id: string;
  receiptId: string;
  userId: string;
  companyId: string;
  ruleId: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'auto_approved';
  currentApprovers: string[];
  requestedAmount: number;
  category: string;
  vendor?: string;
  reason?: string;
  submittedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  approvedBy?: string;
  rejectedBy?: string;
  comments?: string;
  escalationLevel: number;
  dueDate?: Date;
}

export interface ApprovalAction {
  id: string;
  requestId: string;
  userId: string;
  action: 'approve' | 'reject' | 'request_info' | 'escalate';
  comments?: string;
  timestamp: Date;
}

class ApprovalWorkflowService {
  /**
   * Create a new approval rule
   */
  async createApprovalRule(ruleData: Omit<ApprovalRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApprovalRule> {
    try {
      const result = await db.query(`
        INSERT INTO approval_rules (
          id, company_id, name, description, is_active, priority, 
          conditions, actions, created_at, updated_at, created_by
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8
        ) RETURNING *
      `, [
        ruleData.companyId,
        ruleData.name,
        ruleData.description,
        ruleData.isActive,
        ruleData.priority,
        JSON.stringify(ruleData.conditions),
        JSON.stringify(ruleData.actions),
        ruleData.createdBy
      ]);

      // Clear cache for company approval rules
      await redisClient.del(`approval_rules:${ruleData.companyId}`);

      return this.mapRuleFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Error creating approval rule:', error);
      throw error;
    }
  }

  /**
   * Get approval rules for a company
   */
  async getApprovalRules(companyId: string, activeOnly: boolean = false): Promise<ApprovalRule[]> {
    try {
      const cacheKey = `approval_rules:${companyId}:${activeOnly}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      let query = `
        SELECT * FROM approval_rules 
        WHERE company_id = $1
      `;
      
      const params = [companyId];
      
      if (activeOnly) {
        query += ' AND is_active = TRUE';
      }
      
      query += ' ORDER BY priority ASC, created_at DESC';

      const result = await db.query(query, params);
      const rules = result.rows.map(row => this.mapRuleFromDb(row));

      // Cache for 30 minutes
      await redisClient.setex(cacheKey, 1800, JSON.stringify(rules));

      return rules;
    } catch (error) {
      logger.error('Error getting approval rules:', error);
      throw error;
    }
  }

  /**
   * Check if a receipt requires approval based on rules
   */
  async checkApprovalRequirement(
    receiptId: string,
    userId: string,
    companyId: string,
    amount: number,
    category: string,
    vendor?: string
  ): Promise<{ requiresApproval: boolean; rule?: ApprovalRule; autoApprove?: boolean }> {
    try {
      const rules = await this.getApprovalRules(companyId, true);
      
      // Get user role for rule matching
      const userResult = await db.query(
        'SELECT role FROM users WHERE id = $1',
        [userId]
      );
      const userRole = userResult.rows[0]?.role;

      for (const rule of rules) {
        if (this.matchesRule(rule, amount, category, vendor, userRole)) {
          return {
            requiresApproval: rule.actions.requiresApproval,
            rule,
            autoApprove: rule.actions.autoApprove
          };
        }
      }

      return { requiresApproval: false };
    } catch (error) {
      logger.error('Error checking approval requirement:', error);
      throw error;
    }
  }

  /**
   * Create an approval request
   */
  async createApprovalRequest(
    receiptId: string,
    userId: string,
    companyId: string,
    ruleId: string,
    amount: number,
    category: string,
    vendor?: string,
    reason?: string
  ): Promise<ApprovalRequest> {
    try {
      const rule = await this.getApprovalRule(ruleId);
      if (!rule) {
        throw new Error('Approval rule not found');
      }

      // Calculate due date if time window is specified
      let dueDate: Date | undefined;
      if (rule.conditions.timeWindow) {
        dueDate = new Date();
        dueDate.setHours(dueDate.getHours() + rule.conditions.timeWindow);
      }

      const status = rule.actions.autoApprove ? 'auto_approved' : 'pending';
      const approvedAt = rule.actions.autoApprove ? new Date() : undefined;

      const result = await db.query(`
        INSERT INTO approval_requests (
          id, receipt_id, user_id, company_id, rule_id, status, 
          current_approvers, requested_amount, category, vendor, 
          reason, submitted_at, approved_at, escalation_level, due_date
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, 0, $12
        ) RETURNING *
      `, [
        receiptId,
        userId,
        companyId,
        ruleId,
        status,
        JSON.stringify(rule.actions.approvers),
        amount,
        category,
        vendor,
        reason,
        approvedAt,
        dueDate
      ]);

      const request = this.mapRequestFromDb(result.rows[0]);

      // Send notifications if not auto-approved
      if (!rule.actions.autoApprove && rule.actions.notifications.onSubmission) {
        await this.sendApprovalNotifications(request, 'submitted');
      }

      // Update receipt status
      await db.query(
        'UPDATE receipts SET approval_status = $1 WHERE id = $2',
        [status === 'auto_approved' ? 'approved' : 'pending_approval', receiptId]
      );

      return request;
    } catch (error) {
      logger.error('Error creating approval request:', error);
      throw error;
    }
  }

  /**
   * Process approval action (approve/reject)
   */
  async processApprovalAction(
    requestId: string,
    approverId: string,
    action: 'approve' | 'reject' | 'request_info',
    comments?: string
  ): Promise<ApprovalRequest> {
    try {
      const request = await this.getApprovalRequest(requestId);
      if (!request) {
        throw new Error('Approval request not found');
      }

      if (request.status !== 'pending') {
        throw new Error('Request is not in pending status');
      }

      // Verify approver is authorized
      if (!request.currentApprovers.includes(approverId)) {
        throw new Error('User is not authorized to approve this request');
      }

      // Record the action
      await db.query(`
        INSERT INTO approval_actions (id, request_id, user_id, action, comments, timestamp)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
      `, [requestId, approverId, action, comments]);

      let newStatus: string;
      let updateFields: any = {
        comments: comments
      };

      if (action === 'approve') {
        newStatus = 'approved';
        updateFields.approved_at = new Date();
        updateFields.approved_by = approverId;
        
        // Update receipt approval status
        await db.query(
          'UPDATE receipts SET approval_status = $1 WHERE id = $2',
          ['approved', request.receiptId]
        );
      } else if (action === 'reject') {
        newStatus = 'rejected';
        updateFields.rejected_at = new Date();
        updateFields.rejected_by = approverId;
        
        // Update receipt approval status
        await db.query(
          'UPDATE receipts SET approval_status = $1 WHERE id = $2',
          ['rejected', request.receiptId]
        );
      } else {
        // request_info - keep pending but update comments
        newStatus = 'pending';
      }

      // Update approval request
      const result = await db.query(`
        UPDATE approval_requests SET
          status = $1,
          comments = $2,
          approved_at = $3,
          rejected_at = $4,
          approved_by = $5,
          rejected_by = $6
        WHERE id = $7
        RETURNING *
      `, [
        newStatus,
        updateFields.comments,
        updateFields.approved_at,
        updateFields.rejected_at,
        updateFields.approved_by,
        updateFields.rejected_by,
        requestId
      ]);

      const updatedRequest = this.mapRequestFromDb(result.rows[0]);

      // Send notifications
      const rule = await this.getApprovalRule(request.ruleId);
      if (rule) {
        if (action === 'approve' && rule.actions.notifications.onApproval) {
          await this.sendApprovalNotifications(updatedRequest, 'approved');
        } else if (action === 'reject' && rule.actions.notifications.onRejection) {
          await this.sendApprovalNotifications(updatedRequest, 'rejected');
        }
      }

      return updatedRequest;
    } catch (error) {
      logger.error('Error processing approval action:', error);
      throw error;
    }
  }

  /**
   * Get pending approval requests for a user
   */
  async getPendingApprovalsForUser(userId: string, companyId?: string): Promise<ApprovalRequest[]> {
    try {
      let query = `
        SELECT ar.*, r.vendor_name, r.total_amount, r.file_path, u.name as submitter_name
        FROM approval_requests ar
        JOIN receipts r ON ar.receipt_id = r.id
        JOIN users u ON ar.user_id = u.id
        WHERE ar.status = 'pending' 
        AND $1 = ANY(string_to_array(ar.current_approvers::text, ','))
      `;
      
      const params = [userId];
      
      if (companyId) {
        query += ' AND ar.company_id = $2';
        params.push(companyId);
      }
      
      query += ' ORDER BY ar.submitted_at ASC';

      const result = await db.query(query, params);
      return result.rows.map(row => this.mapRequestFromDb(row));
    } catch (error) {
      logger.error('Error getting pending approvals:', error);
      throw error;
    }
  }

  /**
   * Get approval history for a company
   */
  async getApprovalHistory(
    companyId: string,
    filters: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
      userId?: string;
      approverId?: string;
    } = {},
    page: number = 1,
    limit: number = 50
  ): Promise<{ requests: ApprovalRequest[]; total: number }> {
    try {
      let whereClause = 'WHERE ar.company_id = $1';
      const params = [companyId];
      let paramCount = 1;

      if (filters.status) {
        whereClause += ` AND ar.status = $${++paramCount}`;
        params.push(filters.status);
      }

      if (filters.startDate) {
        whereClause += ` AND ar.submitted_at >= $${++paramCount}`;
        params.push(filters.startDate.toISOString());
      }

      if (filters.endDate) {
        whereClause += ` AND ar.submitted_at <= $${++paramCount}`;
        params.push(filters.endDate.toISOString());
      }

      if (filters.userId) {
        whereClause += ` AND ar.user_id = $${++paramCount}`;
        params.push(filters.userId);
      }

      if (filters.approverId) {
        whereClause += ` AND (ar.approved_by = $${++paramCount} OR ar.rejected_by = $${paramCount})`;
        params.push(filters.approverId);
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM approval_requests ar
        ${whereClause}
      `;
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      const query = `
        SELECT ar.*, r.vendor_name, r.total_amount, u.name as submitter_name
        FROM approval_requests ar
        JOIN receipts r ON ar.receipt_id = r.id
        JOIN users u ON ar.user_id = u.id
        ${whereClause}
        ORDER BY ar.submitted_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;
      
      params.push(limit.toString(), ((page - 1) * limit).toString());

      const result = await db.query(query, params);
      const requests = result.rows.map(row => this.mapRequestFromDb(row));

      return { requests, total };
    } catch (error) {
      logger.error('Error getting approval history:', error);
      throw error;
    }
  }

  /**
   * Check for overdue approval requests and send reminders
   */
  async checkOverdueApprovals(): Promise<void> {
    try {
      const overdueQuery = `
        SELECT ar.*, ar_rule.actions
        FROM approval_requests ar
        JOIN approval_rules ar_rule ON ar.rule_id = ar_rule.id
        WHERE ar.status = 'pending' 
        AND ar.due_date < NOW()
      `;

      const result = await db.query(overdueQuery);
      
      for (const row of result.rows) {
        const request = this.mapRequestFromDb(row);
        const actions = JSON.parse(row.actions);
        
        if (actions.notifications.reminderInterval) {
          await this.sendApprovalNotifications(request, 'reminder');
        }
        
        // Check if escalation is needed
        if (actions.escalationChain && actions.escalationChain.length > request.escalationLevel) {
          await this.escalateApproval(request.id);
        }
      }
    } catch (error) {
      logger.error('Error checking overdue approvals:', error);
    }
  }

  /**
   * Escalate approval to next level
   */
  async escalateApproval(requestId: string): Promise<ApprovalRequest> {
    try {
      const request = await this.getApprovalRequest(requestId);
      if (!request) {
        throw new Error('Approval request not found');
      }

      const rule = await this.getApprovalRule(request.ruleId);
      if (!rule || !rule.actions.escalationChain) {
        throw new Error('No escalation chain defined');
      }

      const nextLevel = request.escalationLevel + 1;
      if (nextLevel >= rule.actions.escalationChain.length) {
        throw new Error('Maximum escalation level reached');
      }

      const nextApprovers = [rule.actions.escalationChain[nextLevel]];

      const result = await db.query(`
        UPDATE approval_requests SET
          status = 'escalated',
          current_approvers = $1,
          escalation_level = $2
        WHERE id = $3
        RETURNING *
      `, [JSON.stringify(nextApprovers), nextLevel, requestId]);

      const updatedRequest = this.mapRequestFromDb(result.rows[0]);

      // Send escalation notifications
      await this.sendApprovalNotifications(updatedRequest, 'escalated');

      return updatedRequest;
    } catch (error) {
      logger.error('Error escalating approval:', error);
      throw error;
    }
  }

  // Helper methods
  private matchesRule(
    rule: ApprovalRule,
    amount: number,
    category: string,
    vendor?: string,
    userRole?: string
  ): boolean {
    const { conditions } = rule;

    // Check amount threshold
    if (conditions.amountThreshold && amount < conditions.amountThreshold) {
      return false;
    }

    // Check categories
    if (conditions.categories && conditions.categories.length > 0) {
      if (!conditions.categories.includes(category)) {
        return false;
      }
    }

    // Check vendors
    if (conditions.vendors && conditions.vendors.length > 0 && vendor) {
      if (!conditions.vendors.includes(vendor)) {
        return false;
      }
    }

    // Check user roles
    if (conditions.userRoles && conditions.userRoles.length > 0 && userRole) {
      if (!conditions.userRoles.includes(userRole)) {
        return false;
      }
    }

    return true;
  }

  private async getApprovalRule(ruleId: string): Promise<ApprovalRule | null> {
    try {
      const result = await db.query(
        'SELECT * FROM approval_rules WHERE id = $1',
        [ruleId]
      );
      
      return result.rows.length > 0 ? this.mapRuleFromDb(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error getting approval rule:', error);
      return null;
    }
  }

  private async getApprovalRequest(requestId: string): Promise<ApprovalRequest | null> {
    try {
      const result = await db.query(
        'SELECT * FROM approval_requests WHERE id = $1',
        [requestId]
      );
      
      return result.rows.length > 0 ? this.mapRequestFromDb(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error getting approval request:', error);
      return null;
    }
  }

  private async sendApprovalNotifications(
    request: ApprovalRequest,
    type: 'submitted' | 'approved' | 'rejected' | 'escalated' | 'reminder'
  ): Promise<void> {
    try {
      let recipients: string[] = [];
      let subject: string;
      let message: string;

      switch (type) {
        case 'submitted':
          recipients = request.currentApprovers;
          subject = 'New Approval Request';
          message = `A new receipt approval request for $${request.requestedAmount} requires your attention.`;
          break;
        case 'approved':
          recipients = [request.userId];
          subject = 'Receipt Approved';
          message = `Your receipt for $${request.requestedAmount} has been approved.`;
          break;
        case 'rejected':
          recipients = [request.userId];
          subject = 'Receipt Rejected';
          message = `Your receipt for $${request.requestedAmount} has been rejected.`;
          break;
        case 'escalated':
          recipients = request.currentApprovers;
          subject = 'Escalated Approval Request';
          message = `An approval request for $${request.requestedAmount} has been escalated to you.`;
          break;
        case 'reminder':
          recipients = request.currentApprovers;
          subject = 'Overdue Approval Request';
          message = `Reminder: An approval request for $${request.requestedAmount} is overdue.`;
          break;
      }

      for (const userId of recipients) {
        // TODO: Implement notification service
        // await sendNotification(userId, subject, message, {
        //   type: 'approval',
        //   requestId: request.id,
        //   action: type
        // });
      }
    } catch (error) {
      logger.error('Error sending approval notifications:', error);
    }
  }

  private mapRuleFromDb(row: any): ApprovalRule {
    return {
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      description: row.description,
      isActive: row.is_active,
      priority: row.priority,
      conditions: JSON.parse(row.conditions),
      actions: JSON.parse(row.actions),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by
    };
  }

  private mapRequestFromDb(row: any): ApprovalRequest {
    return {
      id: row.id,
      receiptId: row.receipt_id,
      userId: row.user_id,
      companyId: row.company_id,
      ruleId: row.rule_id,
      status: row.status,
      currentApprovers: JSON.parse(row.current_approvers || '[]'),
      requestedAmount: parseFloat(row.requested_amount),
      category: row.category,
      vendor: row.vendor,
      reason: row.reason,
      submittedAt: row.submitted_at,
      approvedAt: row.approved_at,
      rejectedAt: row.rejected_at,
      approvedBy: row.approved_by,
      rejectedBy: row.rejected_by,
      comments: row.comments,
      escalationLevel: row.escalation_level || 0,
      dueDate: row.due_date
    };
  }
}

export const approvalWorkflowService = new ApprovalWorkflowService();