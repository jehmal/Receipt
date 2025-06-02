import { db } from '@/database/connection';
import { logger } from '@/utils/logger';
import { redis as redisClient } from '@/config/redis';
import { randomUUID } from 'crypto';

export interface ComplianceRule {
  id: string;
  companyId: string;
  name: string;
  description: string;
  ruleType: 'tax' | 'expense_limit' | 'category_restriction' | 'approval_required' | 'retention' | 'custom';
  conditions: Record<string, any>;
  actions: Record<string, any>;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceViolation {
  id: string;
  receiptId: string;
  ruleId: string;
  companyId: string;
  violationType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  autoResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
}

export interface ComplianceReport {
  companyId: string;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalReceipts: number;
    violationsCount: number;
    complianceRate: number;
    riskScore: number;
  };
  violationsByType: Array<{
    type: string;
    count: number;
    severity: string;
  }>;
  trends: Array<{
    date: string;
    violations: number;
    receipts: number;
  }>;
}

class ComplianceService {
  async createRule(companyId: string, ruleData: Omit<ComplianceRule, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>): Promise<ComplianceRule> {
    try {
      const ruleId = randomUUID();
      
      const query = `
        INSERT INTO compliance_rules (
          id, company_id, name, description, rule_type, conditions, actions,
          is_active, priority, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *
      `;

      const result = await db.query(query, [
        ruleId,
        companyId,
        ruleData.name,
        ruleData.description,
        ruleData.ruleType,
        JSON.stringify(ruleData.conditions),
        JSON.stringify(ruleData.actions),
        ruleData.isActive,
        ruleData.priority
      ]);

      // Clear cache
      await redisClient.del(`compliance:rules:${companyId}`);

      return this.mapDbRowToRule(result.rows[0]);
    } catch (error) {
      logger.error('Error creating compliance rule:', error);
      throw error;
    }
  }

  async updateRule(ruleId: string, companyId: string, updates: Partial<ComplianceRule>): Promise<ComplianceRule> {
    try {
      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'companyId' && key !== 'createdAt') {
          const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          if (key === 'conditions' || key === 'actions') {
            updateFields.push(`${dbKey} = $${paramIndex++}`);
            values.push(JSON.stringify(value));
          } else if (key === 'isActive') {
            updateFields.push(`is_active = $${paramIndex++}`);
            values.push(value);
          } else {
            updateFields.push(`${dbKey} = $${paramIndex++}`);
            values.push(value);
          }
        }
      });

      updateFields.push(`updated_at = NOW()`);
      values.push(ruleId, companyId);

      const query = `
        UPDATE compliance_rules 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex++} AND company_id = $${paramIndex}
        RETURNING *
      `;

      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Compliance rule not found');
      }

      // Clear cache
      await redisClient.del(`compliance:rules:${companyId}`);

      return this.mapDbRowToRule(result.rows[0]);
    } catch (error) {
      logger.error('Error updating compliance rule:', error);
      throw error;
    }
  }

  async deleteRule(ruleId: string, companyId: string): Promise<void> {
    try {
      const result = await db.query(
        'UPDATE compliance_rules SET is_active = false, updated_at = NOW() WHERE id = $1 AND company_id = $2',
        [ruleId, companyId]
      );

      if (result.rowCount === 0) {
        throw new Error('Compliance rule not found');
      }

      // Clear cache
      await redisClient.del(`compliance:rules:${companyId}`);
    } catch (error) {
      logger.error('Error deleting compliance rule:', error);
      throw error;
    }
  }

  async getRules(companyId: string): Promise<ComplianceRule[]> {
    try {
      // Check cache first
      const cacheKey = `compliance:rules:${companyId}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const query = `
        SELECT * FROM compliance_rules 
        WHERE company_id = $1 AND is_active = true
        ORDER BY priority DESC, created_at ASC
      `;

      const result = await db.query(query, [companyId]);
      const rules = result.rows.map(row => this.mapDbRowToRule(row));

      // Cache for 10 minutes
      await redisClient.setex(cacheKey, 600, JSON.stringify(rules));

      return rules;
    } catch (error) {
      logger.error('Error getting compliance rules:', error);
      throw error;
    }
  }

  async validateReceipt(receiptId: string, companyId: string): Promise<ComplianceViolation[]> {
    try {
      // Get receipt data
      const receiptQuery = `
        SELECT r.*, u.role, u.id as user_id
        FROM receipts r
        JOIN users u ON r.user_id = u.id
        WHERE r.id = $1 AND r.company_id = $2
      `;
      
      const receiptResult = await db.query(receiptQuery, [receiptId, companyId]);
      
      if (receiptResult.rows.length === 0) {
        throw new Error('Receipt not found');
      }

      const receipt = receiptResult.rows[0];
      const rules = await this.getRules(companyId);
      const violations: ComplianceViolation[] = [];

      // Check each rule against the receipt
      for (const rule of rules) {
        const violation = await this.checkRuleViolation(receipt, rule);
        if (violation) {
          violations.push(violation);
        }
      }

      // Save violations to database
      for (const violation of violations) {
        await this.saveViolation(violation);
      }

      return violations;
    } catch (error) {
      logger.error('Error validating receipt compliance:', error);
      throw error;
    }
  }

  async getViolations(companyId: string, filters: {
    receiptId?: string;
    ruleId?: string;
    severity?: string;
    resolved?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: ComplianceViolation[]; total: number; page: number; limit: number }> {
    try {
      const { page = 1, limit = 20, ...filterParams } = filters;
      const offset = (page - 1) * limit;

      let whereConditions = ['cv.company_id = $1'];
      const values = [companyId];
      let paramIndex = 2;

      Object.entries(filterParams).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'receiptId') {
            whereConditions.push(`cv.receipt_id = $${paramIndex++}`);
            values.push(value);
          } else if (key === 'ruleId') {
            whereConditions.push(`cv.rule_id = $${paramIndex++}`);
            values.push(value);
          } else if (key === 'severity') {
            whereConditions.push(`cv.severity = $${paramIndex++}`);
            values.push(value);
          } else if (key === 'resolved') {
            if (value) {
              whereConditions.push(`cv.resolved_at IS NOT NULL`);
            } else {
              whereConditions.push(`cv.resolved_at IS NULL`);
            }
          }
        }
      });

      const query = `
        SELECT cv.*, cr.name as rule_name, r.merchant_name
        FROM compliance_violations cv
        JOIN compliance_rules cr ON cv.rule_id = cr.id
        JOIN receipts r ON cv.receipt_id = r.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY cv.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `;

      values.push(limit, offset);

      const result = await db.query(query, values);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM compliance_violations cv
        WHERE ${whereConditions.join(' AND ')}
      `;

      const countResult = await db.query(countQuery, values.slice(0, -2)); // Remove limit and offset

      return {
        data: result.rows.map(row => this.mapDbRowToViolation(row)),
        total: parseInt(countResult.rows[0].total),
        page,
        limit
      };
    } catch (error) {
      logger.error('Error getting compliance violations:', error);
      throw error;
    }
  }

  async resolveViolation(violationId: string, resolvedBy: string, companyId: string): Promise<void> {
    try {
      const result = await db.query(
        `UPDATE compliance_violations 
         SET resolved_at = NOW(), resolved_by = $1
         WHERE id = $2 AND company_id = $3`,
        [resolvedBy, violationId, companyId]
      );

      if (result.rowCount === 0) {
        throw new Error('Compliance violation not found');
      }
    } catch (error) {
      logger.error('Error resolving compliance violation:', error);
      throw error;
    }
  }

  async generateComplianceReport(companyId: string, startDate: Date, endDate: Date): Promise<ComplianceReport> {
    try {
      // Get total receipts in period
      const totalReceiptsQuery = `
        SELECT COUNT(*) as total
        FROM receipts
        WHERE company_id = $1 AND created_at BETWEEN $2 AND $3
      `;

      const totalReceiptsResult = await db.query(totalReceiptsQuery, [companyId, startDate, endDate]);
      const totalReceipts = parseInt(totalReceiptsResult.rows[0].total);

      // Get violations in period
      const violationsQuery = `
        SELECT COUNT(*) as total, severity
        FROM compliance_violations
        WHERE company_id = $1 AND created_at BETWEEN $2 AND $3
        GROUP BY severity
      `;

      const violationsResult = await db.query(violationsQuery, [companyId, startDate, endDate]);
      const violationsCount = violationsResult.rows.reduce((sum, row) => sum + parseInt(row.total), 0);

      // Get violations by type
      const violationsByTypeQuery = `
        SELECT cv.violation_type, COUNT(*) as count, cv.severity
        FROM compliance_violations cv
        WHERE cv.company_id = $1 AND cv.created_at BETWEEN $2 AND $3
        GROUP BY cv.violation_type, cv.severity
        ORDER BY count DESC
      `;

      const violationsByTypeResult = await db.query(violationsByTypeQuery, [companyId, startDate, endDate]);

      // Calculate compliance rate and risk score
      const complianceRate = totalReceipts > 0 ? ((totalReceipts - violationsCount) / totalReceipts) * 100 : 100;
      const riskScore = this.calculateRiskScore(violationsResult.rows);

      // Get daily trends
      const trendsQuery = `
        SELECT 
          DATE(cv.created_at) as date,
          COUNT(cv.id) as violations,
          COUNT(DISTINCT r.id) as receipts
        FROM compliance_violations cv
        RIGHT JOIN receipts r ON cv.receipt_id = r.id
        WHERE r.company_id = $1 AND r.created_at BETWEEN $2 AND $3
        GROUP BY DATE(cv.created_at)
        ORDER BY date
      `;

      const trendsResult = await db.query(trendsQuery, [companyId, startDate, endDate]);

      return {
        companyId,
        period: { start: startDate, end: endDate },
        summary: {
          totalReceipts,
          violationsCount,
          complianceRate: Math.round(complianceRate * 100) / 100,
          riskScore
        },
        violationsByType: violationsByTypeResult.rows.map(row => ({
          type: row.violation_type,
          count: parseInt(row.count),
          severity: row.severity
        })),
        trends: trendsResult.rows.map(row => ({
          date: row.date,
          violations: parseInt(row.violations || '0'),
          receipts: parseInt(row.receipts || '0')
        }))
      };
    } catch (error) {
      logger.error('Error generating compliance report:', error);
      throw error;
    }
  }

  private async checkRuleViolation(receipt: any, rule: ComplianceRule): Promise<ComplianceViolation | null> {
    try {
      let isViolation = false;
      let violationType = '';
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      let description = '';

      switch (rule.ruleType) {
        case 'expense_limit':
          if (rule.conditions.maxAmount && receipt.total_amount > rule.conditions.maxAmount) {
            isViolation = true;
            violationType = 'expense_limit_exceeded';
            severity = 'high';
            description = `Receipt amount $${receipt.total_amount} exceeds limit of $${rule.conditions.maxAmount}`;
          }
          break;

        case 'category_restriction':
          if (rule.conditions.restrictedCategories && 
              rule.conditions.restrictedCategories.includes(receipt.category)) {
            isViolation = true;
            violationType = 'restricted_category';
            severity = 'medium';
            description = `Category "${receipt.category}" is restricted for this user role`;
          }
          break;

        case 'approval_required':
          if (rule.conditions.requiresApproval && !receipt.approved_at) {
            isViolation = true;
            violationType = 'missing_approval';
            severity = 'high';
            description = 'Receipt requires approval but has not been approved';
          }
          break;

        case 'tax':
          // Implement tax compliance checks
          break;

        case 'retention':
          const retentionDays = rule.conditions.retentionDays || 2555; // 7 years default
          const daysSinceCreated = Math.floor(
            (new Date().getTime() - new Date(receipt.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          
          if (daysSinceCreated > retentionDays) {
            isViolation = true;
            violationType = 'retention_period_exceeded';
            severity = 'low';
            description = `Receipt exceeds retention period of ${retentionDays} days`;
          }
          break;
      }

      if (isViolation) {
        return {
          id: randomUUID(),
          receiptId: receipt.id,
          ruleId: rule.id,
          companyId: rule.companyId,
          violationType,
          severity,
          description,
          autoResolved: false,
          createdAt: new Date()
        };
      }

      return null;
    } catch (error) {
      logger.error('Error checking rule violation:', error);
      return null;
    }
  }

  private async saveViolation(violation: ComplianceViolation): Promise<void> {
    try {
      const query = `
        INSERT INTO compliance_violations (
          id, receipt_id, rule_id, company_id, violation_type, severity,
          description, auto_resolved, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (receipt_id, rule_id) DO NOTHING
      `;

      await db.query(query, [
        violation.id,
        violation.receiptId,
        violation.ruleId,
        violation.companyId,
        violation.violationType,
        violation.severity,
        violation.description,
        violation.autoResolved
      ]);
    } catch (error) {
      logger.error('Error saving compliance violation:', error);
      throw error;
    }
  }

  private calculateRiskScore(violationsBySeverity: Array<{ severity: string; total: string }>): number {
    let score = 0;
    
    violationsBySeverity.forEach(row => {
      const count = parseInt(row.total);
      switch (row.severity) {
        case 'critical':
          score += count * 10;
          break;
        case 'high':
          score += count * 5;
          break;
        case 'medium':
          score += count * 2;
          break;
        case 'low':
          score += count * 1;
          break;
      }
    });

    return Math.min(score, 100); // Cap at 100
  }

  private mapDbRowToRule(row: any): ComplianceRule {
    return {
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      description: row.description,
      ruleType: row.rule_type,
      conditions: JSON.parse(row.conditions || '{}'),
      actions: JSON.parse(row.actions || '{}'),
      isActive: row.is_active,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDbRowToViolation(row: any): ComplianceViolation {
    return {
      id: row.id,
      receiptId: row.receipt_id,
      ruleId: row.rule_id,
      companyId: row.company_id,
      violationType: row.violation_type,
      severity: row.severity,
      description: row.description,
      autoResolved: row.auto_resolved,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
      createdAt: row.created_at
    };
  }
}

export const complianceService = new ComplianceService();

// Export individual functions for controllers
export const createRule = complianceService.createRule.bind(complianceService);
export const updateRule = complianceService.updateRule.bind(complianceService);
export const deleteRule = complianceService.deleteRule.bind(complianceService);
export const getRules = complianceService.getRules.bind(complianceService);
export const validateReceipt = complianceService.validateReceipt.bind(complianceService);
export const getViolations = complianceService.getViolations.bind(complianceService);
export const resolveViolation = complianceService.resolveViolation.bind(complianceService);
export const generateComplianceReport = complianceService.generateComplianceReport.bind(complianceService);