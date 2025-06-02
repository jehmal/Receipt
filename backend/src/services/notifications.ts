import { logger } from '@/utils/logger';

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
  }
};

export default notificationService;