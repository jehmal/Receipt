import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { redis as redisClient } from '../config/redis';
import { randomUUID } from 'crypto';

export interface UserSession {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  ipAddress: string;
  userAgent: string;
  refreshToken: string;
  isActive: boolean;
  lastActivity: Date;
  createdAt: Date;
  expiresAt: Date;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  deviceBreakdown: Record<string, number>;
  locationBreakdown: Record<string, number>;
  recentActivity: Array<{
    sessionId: string;
    deviceName: string;
    lastActivity: Date;
    ipAddress: string;
  }>;
}

class SessionService {
  async createSession(
    userId: string,
    deviceInfo: {
      deviceId: string;
      deviceName: string;
      deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
    },
    networkInfo: {
      ipAddress: string;
      userAgent: string;
    },
    refreshToken: string,
    expiresAt: Date
  ): Promise<UserSession> {
    try {
      const sessionId = randomUUID();

      const query = `
        INSERT INTO user_sessions (
          id, user_id, device_id, device_name, device_type,
          ip_address, user_agent, refresh_token, is_active,
          last_activity, created_at, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW(), $9)
        RETURNING *
      `;

      const result = await db.query(query, [
        sessionId,
        userId,
        deviceInfo.deviceId,
        deviceInfo.deviceName,
        deviceInfo.deviceType,
        networkInfo.ipAddress,
        networkInfo.userAgent,
        refreshToken,
        expiresAt
      ]);

      const session = this.mapDbRowToSession(result.rows[0]);

      // Cache session for quick lookup
      await redisClient.setex(
        `session:${sessionId}`,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000),
        JSON.stringify(session)
      );

      // Clear user sessions cache
      await redisClient.del(`user:sessions:${userId}`);

      return session;
    } catch (error) {
      logger.error('Error creating session:', error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<UserSession | null> {
    try {
      // Check cache first
      const cached = await redisClient.get(`session:${sessionId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get from database
      const query = `
        SELECT * FROM user_sessions 
        WHERE id = $1 AND is_active = true AND expires_at > NOW()
      `;

      const result = await db.query(query, [sessionId]);

      if (result.rows.length === 0) {
        return null;
      }

      const session = this.mapDbRowToSession(result.rows[0]);

      // Cache for remaining lifetime
      const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
      if (ttl > 0) {
        await redisClient.setex(`session:${sessionId}`, ttl, JSON.stringify(session));
      }

      return session;
    } catch (error) {
      logger.error('Error getting session:', error);
      return null;
    }
  }

  async getUserSessions(userId: string): Promise<UserSession[]> {
    try {
      // Check cache first
      const cacheKey = `user:sessions:${userId}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const query = `
        SELECT * FROM user_sessions 
        WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
        ORDER BY last_activity DESC
      `;

      const result = await db.query(query, [userId]);
      const sessions = result.rows.map(row => this.mapDbRowToSession(row));

      // Cache for 5 minutes
      await redisClient.setex(cacheKey, 300, JSON.stringify(sessions));

      return sessions;
    } catch (error) {
      logger.error('Error getting user sessions:', error);
      return [];
    }
  }

  async updateSessionActivity(sessionId: string, ipAddress?: string): Promise<void> {
    try {
      const updateFields = ['last_activity = NOW()'];
      const values = [sessionId];
      let paramIndex = 2;

      if (ipAddress) {
        updateFields.push(`ip_address = $${paramIndex++}`);
        values.push(ipAddress);
      }

      const query = `
        UPDATE user_sessions 
        SET ${updateFields.join(', ')}
        WHERE id = $1 AND is_active = true
      `;

      await db.query(query, values);

      // Update cache
      const session = await this.getSession(sessionId);
      if (session) {
        session.lastActivity = new Date();
        if (ipAddress) {
          session.ipAddress = ipAddress;
        }

        const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
        if (ttl > 0) {
          await redisClient.setex(`session:${sessionId}`, ttl, JSON.stringify(session));
        }

        // Clear user sessions cache
        await redisClient.del(`user:sessions:${session.userId}`);
      }
    } catch (error) {
      logger.error('Error updating session activity:', error);
      throw error;
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    try {
      const result = await db.query(
        'UPDATE user_sessions SET is_active = false WHERE id = $1 RETURNING user_id',
        [sessionId]
      );

      if (result.rows.length > 0) {
        const userId = result.rows[0].user_id;
        
        // Clear cache
        await redisClient.del(`session:${sessionId}`);
        await redisClient.del(`user:sessions:${userId}`);
      }
    } catch (error) {
      logger.error('Error revoking session:', error);
      throw error;
    }
  }

  async revokeUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    try {
      let query = 'UPDATE user_sessions SET is_active = false WHERE user_id = $1';
      const values = [userId];

      if (exceptSessionId) {
        query += ' AND id != $2';
        values.push(exceptSessionId);
      }

      const result = await db.query(query, values);

      // Clear all session caches for this user
      const sessions = await this.getUserSessions(userId);
      for (const session of sessions) {
        if (session.id !== exceptSessionId) {
          await redisClient.del(`session:${session.id}`);
        }
      }

      await redisClient.del(`user:sessions:${userId}`);

      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error revoking user sessions:', error);
      throw error;
    }
  }

  async revokeExpiredSessions(): Promise<number> {
    try {
      const result = await db.query(
        'UPDATE user_sessions SET is_active = false WHERE expires_at <= NOW() AND is_active = true'
      );

      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error revoking expired sessions:', error);
      return 0;
    }
  }

  async getSessionStats(userId: string): Promise<SessionStats> {
    try {
      // Get all sessions (active and inactive)
      const totalQuery = `
        SELECT COUNT(*) as total FROM user_sessions WHERE user_id = $1
      `;
      
      const activeQuery = `
        SELECT COUNT(*) as active FROM user_sessions 
        WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
      `;

      const deviceQuery = `
        SELECT device_type, COUNT(*) as count
        FROM user_sessions 
        WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
        GROUP BY device_type
      `;

      const locationQuery = `
        SELECT ip_address, COUNT(*) as count
        FROM user_sessions 
        WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
        GROUP BY ip_address
        ORDER BY count DESC
        LIMIT 10
      `;

      const recentQuery = `
        SELECT id, device_name, last_activity, ip_address
        FROM user_sessions 
        WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
        ORDER BY last_activity DESC
        LIMIT 10
      `;

      const [totalResult, activeResult, deviceResult, locationResult, recentResult] = await Promise.all([
        db.query(totalQuery, [userId]),
        db.query(activeQuery, [userId]),
        db.query(deviceQuery, [userId]),
        db.query(locationQuery, [userId]),
        db.query(recentQuery, [userId])
      ]);

      const deviceBreakdown: Record<string, number> = {};
      deviceResult.rows.forEach(row => {
        deviceBreakdown[row.device_type] = parseInt(row.count);
      });

      const locationBreakdown: Record<string, number> = {};
      locationResult.rows.forEach(row => {
        locationBreakdown[row.ip_address] = parseInt(row.count);
      });

      const recentActivity = recentResult.rows.map(row => ({
        sessionId: row.id,
        deviceName: row.device_name,
        lastActivity: row.last_activity,
        ipAddress: row.ip_address
      }));

      return {
        totalSessions: parseInt(totalResult.rows[0].total),
        activeSessions: parseInt(activeResult.rows[0].active),
        deviceBreakdown,
        locationBreakdown,
        recentActivity
      };
    } catch (error) {
      logger.error('Error getting session stats:', error);
      throw error;
    }
  }

  async validateRefreshToken(refreshToken: string): Promise<UserSession | null> {
    try {
      const query = `
        SELECT * FROM user_sessions 
        WHERE refresh_token = $1 AND is_active = true AND expires_at > NOW()
      `;

      const result = await db.query(query, [refreshToken]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDbRowToSession(result.rows[0]);
    } catch (error) {
      logger.error('Error validating refresh token:', error);
      return null;
    }
  }

  async updateRefreshToken(sessionId: string, newRefreshToken: string): Promise<void> {
    try {
      await db.query(
        'UPDATE user_sessions SET refresh_token = $1 WHERE id = $2',
        [newRefreshToken, sessionId]
      );

      // Update cache
      const session = await this.getSession(sessionId);
      if (session) {
        session.refreshToken = newRefreshToken;
        
        const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
        if (ttl > 0) {
          await redisClient.setex(`session:${sessionId}`, ttl, JSON.stringify(session));
        }
      }
    } catch (error) {
      logger.error('Error updating refresh token:', error);
      throw error;
    }
  }

  async cleanupInactiveSessions(): Promise<number> {
    try {
      // Remove sessions that haven't been active for 30 days
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const result = await db.query(
        'DELETE FROM user_sessions WHERE last_activity < $1',
        [cutoffDate]
      );

      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error cleaning up inactive sessions:', error);
      return 0;
    }
  }

  private mapDbRowToSession(row: any): UserSession {
    return {
      id: row.id,
      userId: row.user_id,
      deviceId: row.device_id,
      deviceName: row.device_name,
      deviceType: row.device_type,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      refreshToken: row.refresh_token,
      isActive: row.is_active,
      lastActivity: row.last_activity,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    };
  }
}

export const sessionService = new SessionService();

// Export individual functions for controllers
export const createSession = sessionService.createSession.bind(sessionService);
export const getSession = sessionService.getSession.bind(sessionService);
export const getUserSessions = sessionService.getUserSessions.bind(sessionService);
export const updateSessionActivity = sessionService.updateSessionActivity.bind(sessionService);
export const revokeSession = sessionService.revokeSession.bind(sessionService);
export const revokeUserSessions = sessionService.revokeUserSessions.bind(sessionService);
export const revokeExpiredSessions = sessionService.revokeExpiredSessions.bind(sessionService);
export const getSessionStats = sessionService.getSessionStats.bind(sessionService);
export const validateRefreshToken = sessionService.validateRefreshToken.bind(sessionService);
export const updateRefreshToken = sessionService.updateRefreshToken.bind(sessionService);
export const cleanupInactiveSessions = sessionService.cleanupInactiveSessions.bind(sessionService);