import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { db } from '@/database/connection';
import config from '@/config';
import { jwtService, TokenPair, DeviceInfo } from '@/config/jwt';
import { redis as redisClient } from '@/config/redis';
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
    lastLoginAt?: Date;
  };
  tokens: TokenPair;
  deviceId: string;
  sessionId: string;
}

export interface RefreshTokenData {
  userId: string;
  sessionId: string;
  deviceId: string;
  expiresAt: Date;
  deviceInfo?: DeviceInfo;
}

export interface SessionData {
  userId: string;
  sessionId: string;
  deviceId: string;
  deviceInfo?: DeviceInfo;
  createdAt: Date;
  lastAccessedAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.security.bcryptRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async createUser(userData: CreateUserData, ipAddress?: string, deviceInfo?: DeviceInfo): Promise<AuthResult> {
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
       RETURNING id, email, first_name, last_name, role, company_id, created_at`,
      [randomUUID(), email.toLowerCase(), passwordHash, firstName, lastName, phone, role, companyId]
    );

    const user = userResult.rows[0];

    // Generate JWT token pair
    const tokens = jwtService.generateTokenPair({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      companyId: user.company_id
    }, deviceInfo);

    // Store session in database and Redis
    const sessionData = await this.createSession(user.id, tokens, deviceInfo, ipAddress);

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
      tokens,
      deviceId: sessionData.deviceId,
      sessionId: sessionData.sessionId
    };
  }

  async authenticateUser(credentials: LoginCredentials, ipAddress?: string, deviceInfo?: DeviceInfo): Promise<AuthResult> {
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
    const updateResult = await db.query(
      'UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2 RETURNING last_login_at',
      [ipAddress, user.id]
    );

    // Generate JWT token pair
    const tokens = jwtService.generateTokenPair({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      companyId: user.company_id
    }, deviceInfo);

    // Store session in database and Redis
    const sessionData = await this.createSession(user.id, tokens, deviceInfo, ipAddress);

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
        companyId: user.company_id,
        lastLoginAt: updateResult.rows[0].last_login_at
      },
      tokens,
      deviceId: sessionData.deviceId,
      sessionId: sessionData.sessionId
    };
  }

  private async createSession(userId: string, tokens: TokenPair, deviceInfo?: DeviceInfo, ipAddress?: string): Promise<{ sessionId: string; deviceId: string }> {
    const payload = jwtService.decodeTokenWithoutVerification(tokens.refreshToken);
    if (!payload) {
      throw new Error('Invalid token payload');
    }

    const sessionId = payload.sessionId;
    const deviceId = payload.deviceId;
    const expiresAt = new Date(payload.exp * 1000);

    // Store session in PostgreSQL
    await db.query(
      `INSERT INTO user_sessions (id, user_id, token_hash, device_info, ip_address, expires_at, created_at, last_accessed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         token_hash = EXCLUDED.token_hash,
         device_info = EXCLUDED.device_info,
         ip_address = EXCLUDED.ip_address,
         expires_at = EXCLUDED.expires_at,
         last_accessed_at = NOW()`,
      [sessionId, userId, sessionId, deviceInfo ? JSON.stringify(deviceInfo) : null, ipAddress, expiresAt]
    );

    // Store refresh token in Redis for quick lookup
    const redisKey = `refresh_token:${sessionId}`;
    const refreshData: RefreshTokenData = {
      userId,
      sessionId,
      deviceId,
      expiresAt,
      deviceInfo
    };
    
    await redisClient.setex(redisKey, tokens.refreshExpiresIn, JSON.stringify(refreshData));

    return { sessionId, deviceId };
  }

  async verifyAccessToken(token: string): Promise<{ userId: string; sessionId: string; payload: any } | null> {
    try {
      // Verify JWT token
      const payload = jwtService.verifyToken(token, 'access');
      if (!payload) return null;

      // Check if session is still active in database
      const sessionResult = await db.query(
        `SELECT s.user_id, s.token_hash, s.expires_at, u.email, u.first_name, u.last_name, u.role, u.company_id
         FROM user_sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.id = $1 AND s.expires_at > NOW() AND u.deleted_at IS NULL`,
        [payload.sessionId]
      );

      if (sessionResult.rows.length === 0) return null;

      // Update last accessed time
      await db.query(
        'UPDATE user_sessions SET last_accessed_at = NOW() WHERE id = $1',
        [payload.sessionId]
      );

      return { 
        userId: payload.sub, 
        sessionId: payload.sessionId,
        payload
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }

  async refreshTokens(refreshToken: string, deviceInfo?: DeviceInfo): Promise<TokenPair> {
    // Verify refresh token
    const payload = jwtService.verifyToken(refreshToken, 'refresh');
    if (!payload) {
      throw new Error('Invalid refresh token');
    }

    // Check Redis for refresh token
    const redisKey = `refresh_token:${payload.sessionId}`;
    const refreshData = await redisClient.get(redisKey);
    if (!refreshData) {
      throw new Error('Refresh token not found or expired');
    }

    // Verify session exists in database
    const sessionResult = await db.query(
      `SELECT s.user_id, u.email, u.first_name, u.last_name, u.role, u.company_id
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1 AND s.expires_at > NOW() AND u.deleted_at IS NULL`,
      [payload.sessionId]
    );

    if (sessionResult.rows.length === 0) {
      // Clean up invalid refresh token from Redis
      await redisClient.del(redisKey);
      throw new Error('Session not found or expired');
    }

    const user = sessionResult.rows[0];

    // Generate new token pair with same session ID (token rotation)
    const newTokens = jwtService.generateTokenPair({
      id: user.user_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      companyId: user.company_id
    }, deviceInfo);

    // Update session with new tokens
    await this.createSession(user.user_id, newTokens, deviceInfo);

    // Remove old refresh token from Redis
    await redisClient.del(redisKey);

    return newTokens;
  }

  async revokeUserSessions(userId: string, sessionId?: string): Promise<void> {
    if (sessionId) {
      // Revoke specific session
      await db.query('DELETE FROM user_sessions WHERE id = $1 AND user_id = $2', [sessionId, userId]);
      await redisClient.del(`refresh_token:${sessionId}`);
    } else {
      // Revoke all user sessions
      const sessions = await db.query('SELECT id FROM user_sessions WHERE user_id = $1', [userId]);
      
      // Remove from Redis
      const redisKeys = sessions.rows.map(session => `refresh_token:${session.id}`);
      if (redisKeys.length > 0) {
        await redisClient.del(...redisKeys);
      }
      
      // Remove from database
      await db.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
    }
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

  async blacklistToken(token: string): Promise<void> {
    const payload = jwtService.decodeTokenWithoutVerification(token);
    if (!payload) return;

    const blacklistKey = `blacklist:${(payload as any).jti || (payload as any).sessionId}`;
    const ttl = payload.exp! - Math.floor(Date.now() / 1000);
    
    if (ttl > 0) {
      await redisClient.setex(blacklistKey, ttl, '1');
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const payload = jwtService.decodeTokenWithoutVerification(token);
    if (!payload) return true;

    const blacklistKey = `blacklist:${(payload as any).jti || (payload as any).sessionId}`;
    const result = await redisClient.get(blacklistKey);
    return result === '1';
  }

  async getUserSessions(userId: string): Promise<SessionData[]> {
    const sessions = await db.query(
      `SELECT id, user_id, device_info, ip_address, expires_at, created_at, last_accessed_at
       FROM user_sessions 
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY last_accessed_at DESC`,
      [userId]
    );

    return sessions.rows.map(session => ({
      userId: session.user_id,
      sessionId: session.id,
      deviceId: session.device_info?.fingerprint || 'unknown',
      deviceInfo: session.device_info,
      createdAt: session.created_at,
      lastAccessedAt: session.last_accessed_at,
      expiresAt: session.expires_at,
      isActive: session.expires_at > new Date()
    }));
  }
}

export const authService = new AuthService();
export { jwtService };