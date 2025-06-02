import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { db } from '@/database/connection';
import config from '@/config';
// import { logAction } from '@/services/audit';

export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: 'individual' | 'company_admin' | 'company_employee';
  companyId?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    companyId?: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenData {
  userId: string;
  tokenId: string;
  expiresAt: Date;
}

class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.security.bcryptRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async createUser(userData: CreateUserData, ipAddress?: string): Promise<AuthResult> {
    const { email, password, firstName, lastName, phone, role = 'individual', companyId } = userData;

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const userResult = await db.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, company_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id, email, first_name, last_name, role, company_id`,
      [randomUUID(), email.toLowerCase(), passwordHash, firstName, lastName, phone, role, companyId]
    );

    const user = userResult.rows[0];

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user.id);

    // Log registration (temporarily disabled)
    // await logAction({
    //   userId: user.id,
    //   action: 'create',
    //   resourceType: 'user',
    //   resourceId: user.id,
    //   ipAddress,
    //   metadata: { email: user.email, role }
    // });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        companyId: user.company_id
      },
      accessToken,
      refreshToken
    };
  }

  async authenticateUser(credentials: LoginCredentials, ipAddress?: string): Promise<AuthResult> {
    const { email, password } = credentials;

    // Get user with password
    const userResult = await db.query(
      `SELECT id, email, password_hash, first_name, last_name, role, company_id, last_login_at
       FROM users 
       WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      // await logAction({
      //   action: 'read',
      //   resourceType: 'authentication',
      //   ipAddress,
      //   metadata: { email, result: 'failed', reason: 'user_not_found' }
      // });
      throw new Error('Invalid email or password');
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await this.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      // await logAction({
      //   userId: user.id,
      //   action: 'read',
      //   resourceType: 'authentication',
      //   ipAddress,
      //   metadata: { email, result: 'failed', reason: 'invalid_password' }
      // });
      throw new Error('Invalid email or password');
    }

    // Update last login
    await db.query(
      'UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2',
      [ipAddress, user.id]
    );

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user.id);

    // Log successful login (temporarily disabled)
    // await logAction({
    //   userId: user.id,
    //   action: 'read',
    //   resourceType: 'authentication',
    //   ipAddress,
    //   metadata: { email, result: 'success' }
    // });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        companyId: user.company_id
      },
      accessToken,
      refreshToken
    };
  }

  async generateTokens(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
    const sessionId = randomUUID();
    const tokenId = randomUUID();
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 30); // 30 days

    // Store session in database
    await db.query(
      `INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at, last_accessed_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [sessionId, userId, tokenId, refreshTokenExpiry]
    );

    // Create simplified tokens (in production, use proper JWT)
    return {
      accessToken: userId + '.' + tokenId,
      refreshToken: userId + '.' + tokenId + '.refresh'
    };
  }

  async verifyAccessToken(token: string): Promise<{ userId: string; tokenId: string } | null> {
    try {
      const parts = token.split('.');
      if (parts.length !== 2) return null;

      const [userId, tokenId] = parts;

      // Verify session exists and is valid
      const sessionResult = await db.query(
        `SELECT s.user_id, s.token_hash, u.email, u.first_name, u.last_name, u.role, u.company_id
         FROM user_sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.user_id = $1 AND s.token_hash = $2 AND s.expires_at > NOW() AND u.deleted_at IS NULL`,
        [userId, tokenId]
      );

      if (sessionResult.rows.length === 0) return null;

      // Update last accessed time
      await db.query(
        'UPDATE user_sessions SET last_accessed_at = NOW() WHERE user_id = $1 AND token_hash = $2',
        [userId, tokenId]
      );

      return { userId, tokenId };
    } catch (error) {
      return null;
    }
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const parts = refreshToken.split('.');
    if (parts.length !== 3 || parts[2] !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    const [userId, tokenId] = parts;

    // Verify refresh token
    const sessionResult = await db.query(
      'SELECT user_id FROM user_sessions WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()',
      [userId, tokenId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Invalid or expired refresh token');
    }

    // Generate new tokens
    return this.generateTokens(userId);
  }

  async revokeRefreshToken(userId: string): Promise<void> {
    await db.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
  }

  async getUserFromToken(token: string): Promise<any> {
    const tokenData = await this.verifyAccessToken(token);
    if (!tokenData) return null;

    const userResult = await db.query(
      'SELECT id, email, first_name, last_name, role, company_id FROM users WHERE id = $1 AND deleted_at IS NULL',
      [tokenData.userId]
    );

    return userResult.rows[0] || null;
  }
}

export const authService = new AuthService();