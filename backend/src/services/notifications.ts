import { logger } from '../utils/logger';

export interface NotifyApproversParams {
  companyId: string;
  receiptId: string;
  submitterName: string;
  priority: string;
  requestedApprover?: string;
}

export interface NotifySubmitterParams {
  receiptId: string;
  action: string;
  approverName: string;
  comments?: string;
}

export interface NotifyBulkApprovalParams {
  receiptIds: string[];
  action: string;
  approverName: string;
  comments?: string;
}

export interface NotifyApprovalDelegationParams {
  delegatorName: string;
  delegateToId: string;
  startDate: string;
  endDate: string;
  maxAmount?: number;
  categories?: string[];
  reason?: string;
}

export const notificationService = {
  async notifyApprovers(params: NotifyApproversParams): Promise<void> {
    const { companyId, receiptId, submitterName, priority, requestedApprover } = params;
    
    logger.info('Notifying approvers of new submission:', {
      companyId,
      receiptId,
      submitterName,
      priority,
      requestedApprover
    });
    
    // Mock notification - would send emails/push notifications in real implementation
  },

  async notifySubmitter(params: NotifySubmitterParams): Promise<void> {
    const { receiptId, action, approverName, comments } = params;
    
    logger.info('Notifying submitter of approval decision:', {
      receiptId,
      action,
      approverName,
      comments
    });
    
    // Mock notification - would send emails/push notifications in real implementation
  },

  async notifyBulkApproval(params: NotifyBulkApprovalParams): Promise<void> {
    const { receiptIds, action, approverName, comments } = params;
    
    logger.info('Notifying bulk approval decision:', {
      receiptIds,
      action,
      approverName,
      comments
    });
    
    // Mock notification - would send bulk emails/push notifications in real implementation
  },

  async notifyApprovalDelegation(params: NotifyApprovalDelegationParams): Promise<void> {
    const { delegatorName, delegateToId, startDate, endDate, maxAmount, categories, reason } = params;
    
    logger.info('Notifying approval delegation:', {
      delegatorName,
      delegateToId,
      startDate,
      endDate,
      maxAmount,
      categories,
      reason
    });
    
    // Mock notification - would send emails/push notifications in real implementation
  },

  async send2FASetupConfirmation(userId: string, method: string): Promise<void> {
    logger.info('Sending 2FA setup confirmation:', {
      userId,
      method
    });
    
    // Mock notification - would send confirmation email/SMS in real implementation
  },

  async sendSecurityAlert(params: {
    userId: string;
    alertType: string;
    severity: string;
    title: string;
    message: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const { userId, alertType, severity, title, message, ipAddress, userAgent } = params;
    
    logger.info('Sending security alert:', {
      userId,
      alertType,
      severity,
      title,
      message,
      ipAddress,
      userAgent
    });
    
    // Mock notification - would send security alert email/push notification in real implementation
  }
};

export default notificationService;