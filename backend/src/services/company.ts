import { randomUUID } from 'crypto';
import { db } from '@/database/connection';
import { redis as redisClient } from '@/config/redis';

export interface CreateCompanyData {
  name: string;
  domain?: string;
  adminUserId: string;
  subscriptionTier?: 'free' | 'personal' | 'business' | 'enterprise';
  maxUsers?: number;
  maxStorageGb?: number;
  billingEmail?: string;
  taxId?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  settings?: Record<string, any>;
  retentionPolicyDays?: number;
}

export interface UpdateCompanyData {
  name?: string;
  domain?: string;
  maxUsers?: number;
  maxStorageGb?: number;
  billingEmail?: string;
  taxId?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  settings?: Record<string, any>;
  retentionPolicyDays?: number;
}

export interface InviteUserData {
  email: string;
  role: 'company_admin' | 'company_employee';
  firstName?: string;
  lastName?: string;
}

export interface CompanyMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  joinedAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
}

export interface CompanyInvitation {
  id: string;
  companyId: string;
  email: string;
  role: string;
  invitedBy: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt?: Date;
  isExpired: boolean;
}

export interface CompanyAnalytics {
  memberCount: number;
  activeMembers: number;
  totalReceipts: number;
  totalStorageUsed: number;
  receiptsThisMonth: number;
  storageUsedThisMonth: number;
  topCategories: Array<{ category: string; count: number; totalAmount: number }>;
  monthlyTrends: Array<{ month: string; receipts: number; amount: number }>;
}

class CompanyService {
  async createCompany(data: CreateCompanyData): Promise<any> {
    const {
      name,
      domain,
      adminUserId,
      subscriptionTier = 'business',
      maxUsers = 5,
      maxStorageGb = 100,
      billingEmail,
      taxId,
      address,
      settings = {},
      retentionPolicyDays = 2555 // 7 years default
    } = data;

    // Verify admin user exists
    const userResult = await db.query(
      'SELECT id, email FROM users WHERE id = $1 AND deleted_at IS NULL',
      [adminUserId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('Admin user not found');
    }

    // Check if domain is already taken
    if (domain) {
      const domainCheck = await db.query(
        'SELECT id FROM companies WHERE domain = $1 AND deleted_at IS NULL',
        [domain]
      );

      if (domainCheck.rows.length > 0) {
        throw new Error('Domain is already taken');
      }
    }

    const companyId = randomUUID();

    // Create company
    const companyResult = await db.query(
      `INSERT INTO companies (
        id, name, domain, admin_user_id, subscription_tier, max_users, max_storage_gb,
        billing_email, tax_id, address_line1, address_line2, city, state, postal_code,
        country, settings, retention_policy_days, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
      RETURNING *`,
      [
        companyId, name, domain, adminUserId, subscriptionTier, maxUsers, maxStorageGb,
        billingEmail, taxId, address?.line1, address?.line2, address?.city,
        address?.state, address?.postalCode, address?.country || 'US',
        JSON.stringify(settings), retentionPolicyDays
      ]
    );

    // Update user to be company admin
    await db.query(
      'UPDATE users SET role = $1, company_id = $2, updated_at = NOW() WHERE id = $3',
      ['company_admin', companyId, adminUserId]
    );

    // Clear user cache
    await this.clearUserCache(adminUserId);

    return {
      ...companyResult.rows[0],
      memberCount: 1,
      storageUsed: 0
    };
  }

  async getCompanyById(companyId: string, userId?: string): Promise<any> {
    // Check cache first
    const cacheKey = `company:${companyId}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      const company = JSON.parse(cached);
      
      // If userId provided, verify access
      if (userId) {
        const hasAccess = await this.verifyUserCompanyAccess(userId, companyId);
        if (!hasAccess) {
          throw new Error('Access denied to company');
        }
      }
      
      return company;
    }

    // Get from database
    const companyResult = await db.query(
      `SELECT c.*, 
        COUNT(u.id) as member_count,
        COALESCE(SUM(r.file_size), 0) as storage_used
       FROM companies c
       LEFT JOIN users u ON c.id = u.company_id AND u.deleted_at IS NULL
       LEFT JOIN receipts r ON c.id = r.company_id AND r.deleted_at IS NULL
       WHERE c.id = $1 AND c.deleted_at IS NULL
       GROUP BY c.id`,
      [companyId]
    );

    if (companyResult.rows.length === 0) {
      throw new Error('Company not found');
    }

    const company = {
      ...companyResult.rows[0],
      memberCount: parseInt(companyResult.rows[0].member_count),
      storageUsed: parseInt(companyResult.rows[0].storage_used)
    };

    // Cache for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(company));

    // If userId provided, verify access
    if (userId) {
      const hasAccess = await this.verifyUserCompanyAccess(userId, companyId);
      if (!hasAccess) {
        throw new Error('Access denied to company');
      }
    }

    return company;
  }

  async getUserCompanies(userId: string): Promise<any[]> {
    const companiesResult = await db.query(
      `SELECT c.*, u.role as user_role, u.created_at as joined_at,
        COUNT(users.id) as member_count,
        COALESCE(SUM(r.file_size), 0) as storage_used
       FROM companies c
       JOIN users u ON c.id = u.company_id
       LEFT JOIN users users ON c.id = users.company_id AND users.deleted_at IS NULL
       LEFT JOIN receipts r ON c.id = r.company_id AND r.deleted_at IS NULL
       WHERE u.id = $1 AND c.deleted_at IS NULL AND u.deleted_at IS NULL
       GROUP BY c.id, u.role, u.created_at
       ORDER BY u.created_at DESC`,
      [userId]
    );

    return companiesResult.rows.map(row => ({
      company: {
        id: row.id,
        name: row.name,
        domain: row.domain,
        subscriptionTier: row.subscription_tier,
        maxUsers: row.max_users,
        maxStorageGb: row.max_storage_gb,
        createdAt: row.created_at,
        memberCount: parseInt(row.member_count),
        storageUsed: parseInt(row.storage_used)
      },
      userRole: row.user_role,
      joinedAt: row.joined_at
    }));
  }

  async updateCompany(companyId: string, userId: string, updates: UpdateCompanyData): Promise<any> {
    // Verify user has admin access
    const hasAccess = await this.verifyUserCompanyAccess(userId, companyId, ['company_admin', 'system_admin']);
    if (!hasAccess) {
      throw new Error('Insufficient permissions to update company');
    }

    // Check domain availability if changing
    if (updates.domain) {
      const domainCheck = await db.query(
        'SELECT id FROM companies WHERE domain = $1 AND id != $2 AND deleted_at IS NULL',
        [updates.domain, companyId]
      );

      if (domainCheck.rows.length > 0) {
        throw new Error('Domain is already taken');
      }
    }

    // Build update query
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'address') {
          // Handle address separately
          if (value.line1 !== undefined) {
            updateFields.push(`address_line1 = $${paramCount++}`);
            values.push(value.line1);
          }
          if (value.line2 !== undefined) {
            updateFields.push(`address_line2 = $${paramCount++}`);
            values.push(value.line2);
          }
          if (value.city !== undefined) {
            updateFields.push(`city = $${paramCount++}`);
            values.push(value.city);
          }
          if (value.state !== undefined) {
            updateFields.push(`state = $${paramCount++}`);
            values.push(value.state);
          }
          if (value.postalCode !== undefined) {
            updateFields.push(`postal_code = $${paramCount++}`);
            values.push(value.postalCode);
          }
          if (value.country !== undefined) {
            updateFields.push(`country = $${paramCount++}`);
            values.push(value.country);
          }
        } else if (key === 'settings') {
          updateFields.push(`settings = $${paramCount++}`);
          values.push(JSON.stringify(value));
        } else {
          // Convert camelCase to snake_case
          const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          updateFields.push(`${dbField} = $${paramCount++}`);
          values.push(value);
        }
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(companyId);

    const query = `
      UPDATE companies 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Company not found');
    }

    // Clear cache
    await this.clearCompanyCache(companyId);

    return result.rows[0];
  }

  async getCompanyMembers(companyId: string, userId: string): Promise<CompanyMember[]> {
    // Verify user has access to company
    const hasAccess = await this.verifyUserCompanyAccess(userId, companyId);
    if (!hasAccess) {
      throw new Error('Access denied to company members');
    }

    const membersResult = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, 
        u.created_at as joined_at, u.last_login_at, u.deleted_at IS NULL as is_active
       FROM users u
       WHERE u.company_id = $1 AND u.deleted_at IS NULL
       ORDER BY u.created_at ASC`,
      [companyId]
    );

    return membersResult.rows.map(row => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      joinedAt: row.joined_at,
      lastLoginAt: row.last_login_at,
      isActive: row.is_active
    }));
  }

  async inviteUser(companyId: string, inviterId: string, inviteData: InviteUserData): Promise<CompanyInvitation> {
    // Verify inviter has admin access
    const hasAccess = await this.verifyUserCompanyAccess(inviterId, companyId, ['company_admin', 'system_admin']);
    if (!hasAccess) {
      throw new Error('Insufficient permissions to invite users');
    }

    // Check if user already exists in company
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1 AND company_id = $2 AND deleted_at IS NULL',
      [inviteData.email.toLowerCase(), companyId]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('User is already a member of this company');
    }

    // Check company member limits
    const company = await this.getCompanyById(companyId);
    if (company.memberCount >= company.max_users) {
      throw new Error('Company has reached maximum user limit');
    }

    // Create invitation
    const invitationId = randomUUID();
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create company_invitations table if not exists (this would be in migration)
    await db.query(`
      CREATE TABLE IF NOT EXISTS company_invitations (
        id UUID PRIMARY KEY,
        company_id UUID NOT NULL REFERENCES companies(id),
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        invited_by UUID NOT NULL REFERENCES users(id),
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        accepted_at TIMESTAMP WITH TIME ZONE,
        accepted_by UUID REFERENCES users(id)
      )
    `);

    await db.query(
      `INSERT INTO company_invitations (
        id, company_id, email, role, invited_by, token, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [invitationId, companyId, inviteData.email.toLowerCase(), inviteData.role, inviterId, token, expiresAt]
    );

    // Store invitation in Redis for quick lookup
    const redisKey = `invitation:${token}`;
    const invitationData = {
      id: invitationId,
      companyId,
      email: inviteData.email.toLowerCase(),
      role: inviteData.role,
      invitedBy: inviterId,
      firstName: inviteData.firstName,
      lastName: inviteData.lastName
    };
    
    await redisClient.setex(redisKey, 7 * 24 * 3600, JSON.stringify(invitationData)); // 7 days

    // TODO: Send invitation email
    // await emailService.sendInvitation(inviteData.email, company.name, token);

    return {
      id: invitationId,
      companyId,
      email: inviteData.email,
      role: inviteData.role,
      invitedBy: inviterId,
      token,
      expiresAt,
      createdAt: new Date(),
      isExpired: false
    };
  }

  async acceptInvitation(token: string, acceptingUserId: string): Promise<void> {
    // Get invitation from Redis
    const redisKey = `invitation:${token}`;
    const invitationData = await redisClient.get(redisKey);
    
    if (!invitationData) {
      throw new Error('Invalid or expired invitation');
    }

    const invitation = JSON.parse(invitationData);

    // Verify user email matches invitation
    const userResult = await db.query(
      'SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL',
      [acceptingUserId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].email !== invitation.email) {
      throw new Error('User email does not match invitation');
    }

    // Update user with company and role
    await db.query(
      'UPDATE users SET company_id = $1, role = $2, updated_at = NOW() WHERE id = $3',
      [invitation.companyId, invitation.role, acceptingUserId]
    );

    // Mark invitation as accepted
    await db.query(
      'UPDATE company_invitations SET accepted_at = NOW(), accepted_by = $1 WHERE token = $2',
      [acceptingUserId, token]
    );

    // Remove from Redis
    await redisClient.del(redisKey);

    // Clear caches
    await this.clearUserCache(acceptingUserId);
    await this.clearCompanyCache(invitation.companyId);
  }

  async removeMember(companyId: string, adminId: string, memberId: string): Promise<void> {
    // Verify admin has access
    const hasAccess = await this.verifyUserCompanyAccess(adminId, companyId, ['company_admin', 'system_admin']);
    if (!hasAccess) {
      throw new Error('Insufficient permissions to remove members');
    }

    // Cannot remove company admin
    const memberResult = await db.query(
      'SELECT role FROM users WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [memberId, companyId]
    );

    if (memberResult.rows.length === 0) {
      throw new Error('Member not found in company');
    }

    if (memberResult.rows[0].role === 'company_admin' && memberId !== adminId) {
      throw new Error('Cannot remove company admin');
    }

    // Update user to remove company association
    await db.query(
      'UPDATE users SET company_id = NULL, role = $1, updated_at = NOW() WHERE id = $2',
      ['individual', memberId]
    );

    // Clear caches
    await this.clearUserCache(memberId);
    await this.clearCompanyCache(companyId);
  }

  async updateMemberRole(companyId: string, adminId: string, memberId: string, newRole: string): Promise<void> {
    // Verify admin has access
    const hasAccess = await this.verifyUserCompanyAccess(adminId, companyId, ['company_admin', 'system_admin']);
    if (!hasAccess) {
      throw new Error('Insufficient permissions to update member roles');
    }

    // Validate role
    const validRoles = ['company_admin', 'company_employee'];
    if (!validRoles.includes(newRole)) {
      throw new Error('Invalid role');
    }

    // Verify member exists in company
    const memberResult = await db.query(
      'SELECT id FROM users WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [memberId, companyId]
    );

    if (memberResult.rows.length === 0) {
      throw new Error('Member not found in company');
    }

    // Update role
    await db.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
      [newRole, memberId]
    );

    // Clear caches
    await this.clearUserCache(memberId);
    await this.clearCompanyCache(companyId);
  }

  async getCompanyAnalytics(companyId: string, userId: string): Promise<CompanyAnalytics> {
    // Verify user has access
    const hasAccess = await this.verifyUserCompanyAccess(userId, companyId);
    if (!hasAccess) {
      throw new Error('Access denied to company analytics');
    }

    // Check cache first
    const cacheKey = `analytics:${companyId}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Get analytics data
    const [
      memberStats,
      receiptStats,
      storageStats,
      categoryStats,
      monthlyTrends
    ] = await Promise.all([
      // Member statistics
      db.query(
        `SELECT 
          COUNT(*) as total_members,
          COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '30 days' THEN 1 END) as active_members
         FROM users 
         WHERE company_id = $1 AND deleted_at IS NULL`,
        [companyId]
      ),
      
      // Receipt statistics
      db.query(
        `SELECT 
          COUNT(*) as total_receipts,
          COUNT(CASE WHEN created_at > DATE_TRUNC('month', NOW()) THEN 1 END) as receipts_this_month
         FROM receipts 
         WHERE company_id = $1 AND deleted_at IS NULL`,
        [companyId]
      ),
      
      // Storage statistics
      db.query(
        `SELECT 
          COALESCE(SUM(file_size), 0) as total_storage,
          COALESCE(SUM(CASE WHEN created_at > DATE_TRUNC('month', NOW()) THEN file_size ELSE 0 END), 0) as storage_this_month
         FROM receipts 
         WHERE company_id = $1 AND deleted_at IS NULL`,
        [companyId]
      ),
      
      // Category statistics
      db.query(
        `SELECT 
          category,
          COUNT(*) as count,
          COALESCE(SUM(total_amount), 0) as total_amount
         FROM receipts 
         WHERE company_id = $1 AND deleted_at IS NULL AND category IS NOT NULL
         GROUP BY category 
         ORDER BY count DESC 
         LIMIT 10`,
        [companyId]
      ),
      
      // Monthly trends (last 12 months)
      db.query(
        `SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as receipts,
          COALESCE(SUM(total_amount), 0) as amount
         FROM receipts 
         WHERE company_id = $1 AND deleted_at IS NULL 
           AND created_at > NOW() - INTERVAL '12 months'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY month DESC`,
        [companyId]
      )
    ]);

    const analytics: CompanyAnalytics = {
      memberCount: parseInt(memberStats.rows[0].total_members),
      activeMembers: parseInt(memberStats.rows[0].active_members),
      totalReceipts: parseInt(receiptStats.rows[0].total_receipts),
      totalStorageUsed: parseInt(storageStats.rows[0].total_storage),
      receiptsThisMonth: parseInt(receiptStats.rows[0].receipts_this_month),
      storageUsedThisMonth: parseInt(storageStats.rows[0].storage_this_month),
      topCategories: categoryStats.rows.map(row => ({
        category: row.category,
        count: parseInt(row.count),
        totalAmount: parseFloat(row.total_amount)
      })),
      monthlyTrends: monthlyTrends.rows.map(row => ({
        month: row.month.toISOString().substr(0, 7), // YYYY-MM format
        receipts: parseInt(row.receipts),
        amount: parseFloat(row.amount)
      }))
    };

    // Cache for 15 minutes
    await redisClient.setex(cacheKey, 900, JSON.stringify(analytics));

    return analytics;
  }

  async deleteCompany(companyId: string, adminId: string): Promise<void> {
    // Verify user is company admin
    const hasAccess = await this.verifyUserCompanyAccess(adminId, companyId, ['company_admin', 'system_admin']);
    if (!hasAccess) {
      throw new Error('Insufficient permissions to delete company');
    }

    // Soft delete company
    await db.query(
      'UPDATE companies SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
      [companyId]
    );

    // Update all company users to individual role
    await db.query(
      'UPDATE users SET company_id = NULL, role = $1, updated_at = NOW() WHERE company_id = $2',
      ['individual', companyId]
    );

    // Clear all related caches
    await this.clearCompanyCache(companyId);
  }

  private async verifyUserCompanyAccess(
    userId: string, 
    companyId: string, 
    allowedRoles: string[] = ['company_admin', 'company_employee', 'system_admin']
  ): Promise<boolean> {
    const userResult = await db.query(
      'SELECT role, company_id FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return false;
    }

    const user = userResult.rows[0];
    
    // System admin has access to all companies
    if (user.role === 'system_admin') {
      return true;
    }

    // User must be member of the company and have appropriate role
    return user.company_id === companyId && allowedRoles.includes(user.role);
  }

  private async clearUserCache(userId: string): Promise<void> {
    await redisClient.del(`user:${userId}`);
  }

  private async clearCompanyCache(companyId: string): Promise<void> {
    await redisClient.del(`company:${companyId}`);
    await redisClient.del(`analytics:${companyId}`);
  }
}

export const companyService = new CompanyService();

// Export individual functions for controllers
export const createCompany = companyService.createCompany.bind(companyService);
export const getCompanies = companyService.getUserCompanies.bind(companyService);
export const getCompanyById = companyService.getCompanyById.bind(companyService);
export const updateCompany = companyService.updateCompany.bind(companyService);
export const updateCompanyStatus = companyService.updateCompany.bind(companyService);
export const deleteCompany = companyService.deleteCompany.bind(companyService);
export const inviteUser = companyService.inviteUser.bind(companyService);
export const acceptInvitation = companyService.acceptInvitation.bind(companyService);
export const getCompanyMembers = companyService.getCompanyMembers.bind(companyService);
export const updateMemberRole = companyService.updateMemberRole.bind(companyService);
export const removeMember = companyService.removeMember.bind(companyService);
export const getCompanyAnalytics = companyService.getCompanyAnalytics.bind(companyService);