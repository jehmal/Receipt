import * as nodemailer from 'nodemailer';
import { createHash } from 'crypto';
import { storageService } from './storage';
import { receiptService, CreateReceiptData } from './receipts';
import { jobQueueService } from './job-queue';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { config } from '../config/index';

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  data: Buffer;
  contentId?: string;
}

export interface ProcessedEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: Date;
  body: string;
  attachments: EmailAttachment[];
  messageId: string;
  headers: { [key: string]: string };
}

export interface EmailProcessingRule {
  id: string;
  userId: string;
  companyId?: string;
  name: string;
  isActive: boolean;
  fromEmailPattern?: string;
  subjectPattern?: string;
  autoCategory?: string;
  autoTags?: string[];
  requiresApproval?: boolean;
  defaultProject?: string;
  defaultDepartment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailToVaultResult {
  emailId: string;
  processedAttachments: number;
  createdReceipts: Array<{
    receiptId: string;
    filename: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
  skippedAttachments: number;
  totalAttachments: number;
}

class EmailProcessorService {
  private readonly allowedFileTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'application/pdf',
    'image/webp'
  ];

  private readonly maxFileSize = 20 * 1024 * 1024; // 20MB
  private readonly maxAttachmentsPerEmail = 10;

  /**
   * Process an email and extract receipt attachments
   */
  async processEmail(email: ProcessedEmail, userId: string, companyId?: string): Promise<EmailToVaultResult> {
    try {
      logger.info(`Processing email ${email.id} from ${email.from} with ${email.attachments.length} attachments`);

      // Store email record for tracking
      const emailRecord = await this.storeEmailRecord(email, userId, companyId);

      // Find applicable processing rules
      const rules = await this.getProcessingRules(userId, companyId, email);

      const result: EmailToVaultResult = {
        emailId: email.id,
        processedAttachments: 0,
        createdReceipts: [],
        skippedAttachments: 0,
        totalAttachments: email.attachments.length
      };

      // Process each attachment
      for (const attachment of email.attachments.slice(0, this.maxAttachmentsPerEmail)) {
        try {
          const processed = await this.processAttachment(
            attachment, 
            email, 
            userId, 
            companyId, 
            rules,
            emailRecord.id
          );

          if (processed) {
            result.processedAttachments++;
            result.createdReceipts.push({
              receiptId: processed.receiptId,
              filename: attachment.filename,
              status: 'success'
            });
          } else {
            result.skippedAttachments++;
          }
        } catch (error: any) {
          logger.error(`Failed to process attachment ${attachment.filename}:`, error);
          result.skippedAttachments++;
          result.createdReceipts.push({
            receiptId: '',
            filename: attachment.filename,
            status: 'failed',
            error: error.message
          });
        }
      }

      // Update email record with processing results
      await this.updateEmailRecord(emailRecord.id, {
        processed_attachments: result.processedAttachments,
        skipped_attachments: result.skippedAttachments,
        processing_completed_at: new Date(),
        status: result.processedAttachments > 0 ? 'completed' : 'no_attachments'
      });

      logger.info(`Email processing completed: ${result.processedAttachments} receipts created, ${result.skippedAttachments} attachments skipped`);
      return result;

    } catch (error: any) {
      logger.error(`Email processing failed for ${email.id}:`, error);
      throw error;
    }
  }

  /**
   * Process a single email attachment
   */
  private async processAttachment(
    attachment: EmailAttachment,
    email: ProcessedEmail,
    userId: string,
    companyId?: string,
    rules: EmailProcessingRule[] = [],
    emailRecordId?: string
  ): Promise<{ receiptId: string } | null> {
    // Validate file type
    if (!this.allowedFileTypes.includes(attachment.contentType.toLowerCase())) {
      logger.debug(`Skipping attachment ${attachment.filename} - unsupported type: ${attachment.contentType}`);
      return null;
    }

    // Validate file size
    if (attachment.size > this.maxFileSize) {
      logger.debug(`Skipping attachment ${attachment.filename} - too large: ${attachment.size} bytes`);
      return null;
    }

    // Check for suspicious files
    if (this.isSuspiciousFile(attachment)) {
      logger.warn(`Skipping suspicious attachment: ${attachment.filename}`);
      return null;
    }

    // Apply processing rules to determine metadata
    const metadata = this.applyProcessingRules(email, attachment, rules);

    // Create receipt data
    const receiptData: CreateReceiptData = {
      userId,
      companyId,
      originalFilename: attachment.filename,
      fileBuffer: attachment.data,
      category: metadata.category,
      description: metadata.description,
      tags: metadata.tags,
      jobNumber: metadata.jobNumber,
      context: companyId ? 'company' : 'personal',
      metadata: {
        source: 'email',
        emailId: email.id,
        emailRecordId,
        emailFrom: email.from,
        emailSubject: email.subject,
        emailDate: email.date,
        autoProcessed: true,
        processingRules: rules.map(r => r.id)
      }
    };

    // Upload receipt
    const receipt = await receiptService.uploadReceipt(receiptData);

    logger.info(`Created receipt ${receipt.id} from email attachment ${attachment.filename}`);
    return { receiptId: receipt.id };
  }

  /**
   * Apply processing rules to determine receipt metadata
   */
  private applyProcessingRules(
    email: ProcessedEmail, 
    attachment: EmailAttachment, 
    rules: EmailProcessingRule[]
  ): {
    category?: string;
    description?: string;
    tags?: string[];
    jobNumber?: string;
    requiresApproval?: boolean;
    project?: string;
    department?: string;
  } {
    const metadata: any = {};

    // Start with email-derived metadata
    metadata.description = `${email.subject} - ${attachment.filename}`;
    metadata.tags = ['email-import'];

    // Extract potential job/reference numbers from subject
    const jobNumberMatch = email.subject.match(/(job|ref|order|invoice)[\s#:]*([a-zA-Z0-9\-]+)/i);
    if (jobNumberMatch) {
      metadata.jobNumber = jobNumberMatch[2];
      metadata.tags.push('job-' + jobNumberMatch[2]);
    }

    // Apply each rule in order of priority
    for (const rule of rules) {
      if (!rule.isActive) continue;

      let ruleMatches = true;

      // Check from email pattern
      if (rule.fromEmailPattern) {
        const fromRegex = new RegExp(rule.fromEmailPattern, 'i');
        if (!fromRegex.test(email.from)) {
          ruleMatches = false;
        }
      }

      // Check subject pattern
      if (rule.subjectPattern && ruleMatches) {
        const subjectRegex = new RegExp(rule.subjectPattern, 'i');
        if (!subjectRegex.test(email.subject)) {
          ruleMatches = false;
        }
      }

      // Apply rule if it matches
      if (ruleMatches) {
        if (rule.autoCategory) {
          metadata.category = rule.autoCategory;
        }
        if (rule.autoTags && rule.autoTags.length > 0) {
          metadata.tags.push(...rule.autoTags);
        }
        if (rule.requiresApproval !== undefined) {
          metadata.requiresApproval = rule.requiresApproval;
        }
        if (rule.defaultProject) {
          metadata.project = rule.defaultProject;
        }
        if (rule.defaultDepartment) {
          metadata.department = rule.defaultDepartment;
        }

        logger.debug(`Applied email processing rule: ${rule.name}`);
        break; // Use first matching rule
      }
    }

    // Auto-categorize based on common email patterns
    if (!metadata.category) {
      metadata.category = this.autoCategorizeFromEmail(email, attachment);
    }

    return metadata;
  }

  /**
   * Auto-categorize receipts based on email content
   */
  private autoCategorizeFromEmail(email: ProcessedEmail, attachment: EmailAttachment): string {
    const searchText = `${email.from} ${email.subject} ${attachment.filename}`.toLowerCase();

    // Define category patterns
    const categoryPatterns = {
      'Transportation': [
        'uber', 'lyft', 'taxi', 'gas', 'fuel', 'parking', 'toll', 'airline', 'flight',
        'car rental', 'train', 'bus', 'metro', 'transit'
      ],
      'Food & Dining': [
        'restaurant', 'cafe', 'coffee', 'pizza', 'food', 'dining', 'lunch', 'dinner',
        'grubhub', 'doordash', 'ubereats', 'catering'
      ],
      'Business': [
        'office', 'supplies', 'business', 'meeting', 'conference', 'hotel', 'travel',
        'software', 'subscription', 'service', 'consulting'
      ],
      'Utilities': [
        'electric', 'gas', 'water', 'internet', 'phone', 'utility', 'bill', 'invoice'
      ],
      'Shopping': [
        'amazon', 'store', 'shop', 'retail', 'purchase', 'order', 'receipt'
      ],
      'Health': [
        'pharmacy', 'medical', 'doctor', 'hospital', 'clinic', 'health', 'medicine'
      ]
    };

    for (const [category, keywords] of Object.entries(categoryPatterns)) {
      if (keywords.some(keyword => searchText.includes(keyword))) {
        return category;
      }
    }

    return 'Other';
  }

  /**
   * Check if file appears suspicious
   */
  private isSuspiciousFile(attachment: EmailAttachment): boolean {
    const filename = attachment.filename.toLowerCase();
    
    // Check for executable files disguised as images/PDFs
    const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif', '.vbs', '.js'];
    if (suspiciousExtensions.some(ext => filename.includes(ext))) {
      return true;
    }

    // Check for very small files that claim to be images
    if (attachment.contentType.startsWith('image/') && attachment.size < 1000) {
      return true;
    }

    // Check for files with suspicious names
    const suspiciousNames = ['virus', 'trojan', 'malware', 'backdoor'];
    if (suspiciousNames.some(name => filename.includes(name))) {
      return true;
    }

    return false;
  }

  /**
   * Store email record for tracking and audit
   */
  private async storeEmailRecord(email: ProcessedEmail, userId: string, companyId?: string): Promise<any> {
    const emailHash = createHash('sha256')
      .update(`${email.messageId}-${email.from}-${email.date.toISOString()}`)
      .digest('hex');

    // Check if email already processed
    const existing = await db.query(
      'SELECT id FROM email_receipts WHERE email_hash = $1',
      [emailHash]
    );

    if (existing.rows.length > 0) {
      throw new Error(`Email ${email.messageId} already processed`);
    }

    const result = await db.query(`
      INSERT INTO email_receipts (
        id, user_id, company_id, email_hash, message_id, from_email, to_email,
        subject, email_date, body_preview, attachment_count, status,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'processing',
        NOW(), NOW()
      ) RETURNING *
    `, [
      userId,
      companyId,
      emailHash,
      email.messageId,
      email.from,
      email.to,
      email.subject,
      email.date,
      email.body.substring(0, 500), // Store preview
      email.attachments.length
    ]);

    return result.rows[0];
  }

  /**
   * Update email record with processing results
   */
  private async updateEmailRecord(emailId: string, updates: any): Promise<void> {
    const updateFields = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const params = [emailId, ...Object.values(updates)];

    await db.query(`
      UPDATE email_receipts 
      SET ${updateFields}, updated_at = NOW()
      WHERE id = $1
    `, params);
  }

  /**
   * Get processing rules for user/company and email
   */
  private async getProcessingRules(
    userId: string, 
    companyId?: string, 
    email?: ProcessedEmail
  ): Promise<EmailProcessingRule[]> {
    let query = `
      SELECT * FROM email_processing_rules 
      WHERE user_id = $1 AND is_active = true
    `;
    const params = [userId];

    if (companyId) {
      query += ` AND (company_id = $2 OR company_id IS NULL)`;
      params.push(companyId);
    } else {
      query += ` AND company_id IS NULL`;
    }

    query += ` ORDER BY created_at ASC`;

    const result = await db.query(query, params);
    
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      name: row.name,
      isActive: row.is_active,
      fromEmailPattern: row.from_email_pattern,
      subjectPattern: row.subject_pattern,
      autoCategory: row.auto_category,
      autoTags: row.auto_tags || [],
      requiresApproval: row.requires_approval,
      defaultProject: row.default_project,
      defaultDepartment: row.default_department,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  /**
   * Create email processing rule
   */
  async createProcessingRule(
    userId: string, 
    companyId: string | undefined, 
    ruleData: Omit<EmailProcessingRule, 'id' | 'userId' | 'companyId' | 'createdAt' | 'updatedAt'>
  ): Promise<EmailProcessingRule> {
    const result = await db.query(`
      INSERT INTO email_processing_rules (
        id, user_id, company_id, name, is_active, from_email_pattern,
        subject_pattern, auto_category, auto_tags, requires_approval,
        default_project, default_department, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
      ) RETURNING *
    `, [
      userId,
      companyId,
      ruleData.name,
      ruleData.isActive,
      ruleData.fromEmailPattern,
      ruleData.subjectPattern,
      ruleData.autoCategory,
      ruleData.autoTags,
      ruleData.requiresApproval,
      ruleData.defaultProject,
      ruleData.defaultDepartment
    ]);

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      name: row.name,
      isActive: row.is_active,
      fromEmailPattern: row.from_email_pattern,
      subjectPattern: row.subject_pattern,
      autoCategory: row.auto_category,
      autoTags: row.auto_tags || [],
      requiresApproval: row.requires_approval,
      defaultProject: row.default_project,
      defaultDepartment: row.default_department,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Get processing rules for user
   */
  async getProcessingRulesForUser(userId: string, companyId?: string): Promise<EmailProcessingRule[]> {
    return this.getProcessingRules(userId, companyId);
  }

  /**
   * Update processing rule
   */
  async updateProcessingRule(
    ruleId: string, 
    userId: string, 
    updates: Partial<EmailProcessingRule>
  ): Promise<EmailProcessingRule | null> {
    const updateFields = [];
    const params = [ruleId, userId];
    let paramIndex = 3;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'userId' && key !== 'companyId' && key !== 'createdAt' && key !== 'updatedAt') {
        const dbField = this.mapFieldToDbColumn(key);
        updateFields.push(`${dbField} = $${paramIndex++}`);
        params.push(String(value));
      }
    });

    if (updateFields.length === 0) {
      return null;
    }

    updateFields.push('updated_at = NOW()');

    const result = await db.query(`
      UPDATE email_processing_rules
      SET ${updateFields.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      name: row.name,
      isActive: row.is_active,
      fromEmailPattern: row.from_email_pattern,
      subjectPattern: row.subject_pattern,
      autoCategory: row.auto_category,
      autoTags: row.auto_tags || [],
      requiresApproval: row.requires_approval,
      defaultProject: row.default_project,
      defaultDepartment: row.default_department,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Delete processing rule
   */
  async deleteProcessingRule(ruleId: string, userId: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM email_processing_rules WHERE id = $1 AND user_id = $2',
      [ruleId, userId]
    );

    return result.rowCount > 0;
  }

  /**
   * Get email processing statistics
   */
  async getProcessingStats(userId: string, companyId?: string): Promise<any> {
    let whereClause = 'WHERE user_id = $1';
    const params = [userId];

    if (companyId) {
      whereClause += ' AND company_id = $2';
      params.push(companyId);
    }

    const result = await db.query(`
      SELECT 
        COUNT(*) as total_emails,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as processed_emails,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_emails,
        SUM(processed_attachments) as total_receipts_created,
        SUM(skipped_attachments) as total_attachments_skipped,
        AVG(processed_attachments) as avg_receipts_per_email
      FROM email_receipts
      ${whereClause}
    `, params);

    return result.rows[0];
  }

  private mapFieldToDbColumn(field: string): string {
    const mapping: Record<string, string> = {
      isActive: 'is_active',
      fromEmailPattern: 'from_email_pattern',
      subjectPattern: 'subject_pattern',
      autoCategory: 'auto_category',
      autoTags: 'auto_tags',
      requiresApproval: 'requires_approval',
      defaultProject: 'default_project',
      defaultDepartment: 'default_department'
    };
    return mapping[field] || field;
  }
}

export const emailProcessorService = new EmailProcessorService();