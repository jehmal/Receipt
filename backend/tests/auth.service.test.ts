import { authService, CreateUserData, LoginCredentials, AuthResult } from '../src/services/auth';
import { jwtService, TokenPair, DeviceInfo } from '../src/config/jwt';
import { db } from '../src/database/connection';
import { redis as redisClient } from '../src/config/redis';
import bcrypt from 'bcryptjs';

// Mock external dependencies
jest.mock('../src/database/connection');
jest.mock('../src/config/redis');
jest.mock('bcryptjs');
jest.mock('../src/config/jwt');

const mockDb = db as jest.Mocked<typeof db>;
const mockRedis = redisClient as jest.Mocked<typeof redisClient>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwtService = jwtService as jest.Mocked<typeof jwtService>;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    (mockBcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
    
    const mockTokenPair: TokenPair = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 900,
      refreshExpiresIn: 2592000
    };
    
    (mockJwtService.generateTokenPair as jest.Mock).mockReturnValue(mockTokenPair);
    (mockJwtService.decodeTokenWithoutVerification as jest.Mock).mockReturnValue({
      sessionId: 'session-123',
      deviceId: 'device-123',
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'individual',
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      iss: 'receipt-vault',
      aud: 'receipt-vault-api'
    });
    
    (mockRedis.setex as jest.Mock).mockResolvedValue('OK' as any);
    (mockRedis.get as jest.Mock).mockResolvedValue(null);
    (mockRedis.del as jest.Mock).mockResolvedValue(1);
  });

  describe('createUser', () => {
    const mockUserData: CreateUserData = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      role: 'individual'
    };

    it('should successfully create a new user', async () => {
      // Arrange
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockResolvedValueOnce({ // Create user
          rows: [{
            id: 'user-123',
            email: 'test@example.com',
            first_name: 'John',
            last_name: 'Doe',
            role: 'individual',
            company_id: null,
            created_at: new Date()
          }]
        })
        .mockResolvedValueOnce({ rows: [{}] }); // Create session

      const deviceInfo: DeviceInfo = { fingerprint: 'device-123' };

      // Act
      const result = await authService.createUser(mockUserData, '127.0.0.1', deviceInfo);

      // Assert
      expect(result).toMatchObject({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'individual'
        },
        tokens: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: 900,
          refreshExpiresIn: 2592000
        },
        deviceId: 'device-123',
        sessionId: 'session-123'
      });

      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', expect.any(Number));
      expect(mockJwtService.generateTokenPair).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      // Arrange
      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ id: 'existing-user' }] 
      });

      // Act & Assert
      await expect(authService.createUser(mockUserData))
        .rejects.toThrow('User with this email already exists');
    });

    it('should handle database errors during user creation', async () => {
      // Arrange
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockRejectedValueOnce(new Error('Database connection failed'));

      // Act & Assert
      await expect(authService.createUser(mockUserData))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle bcrypt hashing errors', async () => {
      // Arrange
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      (mockBcrypt.hash as jest.Mock).mockRejectedValueOnce(new Error('Hashing failed'));

      // Act & Assert
      await expect(authService.createUser(mockUserData))
        .rejects.toThrow('Hashing failed');
    });
  });

  describe('authenticateUser', () => {
    const mockCredentials: LoginCredentials = {
      email: 'test@example.com',
      password: 'password123'
    };

    const mockUserRow = {
      id: 'user-123',
      email: 'test@example.com',
      password_hash: 'hashed-password',
      first_name: 'John',
      last_name: 'Doe',
      role: 'individual',
      company_id: null,
      last_login_at: new Date()
    };

    it('should successfully authenticate user with valid credentials', async () => {
      // Arrange
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockUserRow] }) // Get user
        .mockResolvedValueOnce({ rows: [{ last_login_at: new Date() }] }) // Update last login
        .mockResolvedValueOnce({ rows: [{}] }); // Create session

      (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      const deviceInfo: DeviceInfo = { fingerprint: 'device-123' };

      // Act
      const result = await authService.authenticateUser(mockCredentials, '127.0.0.1', deviceInfo);

      // Assert
      expect(result).toMatchObject({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'individual'
        },
        tokens: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token'
        }
      });

      expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
      expect(mockJwtService.generateTokenPair).toHaveBeenCalled();
    });

    it('should throw error for non-existent user', async () => {
      // Arrange
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      // Act & Assert
      await expect(authService.authenticateUser(mockCredentials))
        .rejects.toThrow('Invalid email or password');
    });

    it('should throw error for invalid password', async () => {
      // Arrange
      mockDb.query.mockResolvedValueOnce({ rows: [mockUserRow] });
      (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      // Act & Assert
      await expect(authService.authenticateUser(mockCredentials))
        .rejects.toThrow('Invalid email or password');
    });

    it('should handle case-insensitive email login', async () => {
      // Arrange
      const upperCaseCredentials = {
        email: 'TEST@EXAMPLE.COM',
        password: 'password123'
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockUserRow] })
        .mockResolvedValueOnce({ rows: [{ last_login_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [{}] });

      (mockBcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      // Act
      const result = await authService.authenticateUser(upperCaseCredentials);

      // Assert
      expect(result.user.email).toBe('test@example.com');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['test@example.com'])
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should successfully verify valid access token', async () => {
      // Arrange
      const token = 'valid-access-token';
      const mockPayload = {
        sub: 'user-123',
        sessionId: 'session-123',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      mockJwtService.verifyToken.mockReturnValueOnce(mockPayload as any);
      mockDb.query
        .mockResolvedValueOnce({ // Check session
          rows: [{
            user_id: 'user-123',
            token_hash: 'session-123',
            expires_at: new Date(Date.now() + 3600000),
            email: 'test@example.com',
            first_name: 'John',
            last_name: 'Doe',
            role: 'individual',
            company_id: null
          }]
        })
        .mockResolvedValueOnce({ rows: [{}] }); // Update last accessed

      // Act
      const result = await authService.verifyAccessToken(token);

      // Assert
      expect(result).toEqual({
        userId: 'user-123',
        sessionId: 'session-123',
        payload: mockPayload
      });
    });

    it('should return null for invalid token', async () => {
      // Arrange
      const token = 'invalid-token';
      mockJwtService.verifyToken.mockReturnValueOnce(null);

      // Act
      const result = await authService.verifyAccessToken(token);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for expired session', async () => {
      // Arrange
      const token = 'valid-token';
      const mockPayload = {
        sub: 'user-123',
        sessionId: 'session-123'
      };

      mockJwtService.verifyToken.mockReturnValueOnce(mockPayload as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // No active session

      // Act
      const result = await authService.verifyAccessToken(token);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('refreshTokens', () => {
    it('should successfully refresh tokens', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const mockPayload = {
        sessionId: 'session-123',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      mockJwtService.verifyToken.mockReturnValueOnce(mockPayload as any);
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        userId: 'user-123',
        sessionId: 'session-123',
        deviceId: 'device-123'
      }));

      mockDb.query
        .mockResolvedValueOnce({ // Check session
          rows: [{
            user_id: 'user-123',
            email: 'test@example.com',
            first_name: 'John',
            last_name: 'Doe',
            role: 'individual',
            company_id: null
          }]
        })
        .mockResolvedValueOnce({ rows: [{}] }); // Create new session

      // Act
      const result = await authService.refreshTokens(refreshToken);

      // Assert
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 900,
        refreshExpiresIn: 2592000
      });

      expect(mockRedis.del).toHaveBeenCalledWith('refresh_token:session-123');
    });

    it('should throw error for invalid refresh token', async () => {
      // Arrange
      const refreshToken = 'invalid-refresh-token';
      mockJwtService.verifyToken.mockReturnValueOnce(null);

      // Act & Assert
      await expect(authService.refreshTokens(refreshToken))
        .rejects.toThrow('Invalid refresh token');
    });

    it('should throw error for expired refresh token', async () => {
      // Arrange
      const refreshToken = 'expired-refresh-token';
      const mockPayload = { sessionId: 'session-123' };
      
      mockJwtService.verifyToken.mockReturnValueOnce(mockPayload as any);
      mockRedis.get.mockResolvedValueOnce(null); // Token not found in Redis

      // Act & Assert
      await expect(authService.refreshTokens(refreshToken))
        .rejects.toThrow('Refresh token not found or expired');
    });
  });

  describe('revokeUserSessions', () => {
    it('should revoke specific session', async () => {
      // Arrange
      const userId = 'user-123';
      const sessionId = 'session-123';

      mockDb.query.mockResolvedValueOnce({ rows: [{}] });

      // Act
      await authService.revokeUserSessions(userId, sessionId);

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM user_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, userId]
      );
      expect(mockRedis.del).toHaveBeenCalledWith('refresh_token:session-123');
    });

    it('should revoke all user sessions', async () => {
      // Arrange
      const userId = 'user-123';
      const mockSessions = [
        { id: 'session-1' },
        { id: 'session-2' }
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: mockSessions })
        .mockResolvedValueOnce({ rows: [{}] });

      // Act
      await authService.revokeUserSessions(userId);

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(
        'refresh_token:session-1',
        'refresh_token:session-2'
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [userId]
      );
    });
  });

  describe('getUserFromToken', () => {
    it('should return user data for valid token', async () => {
      // Arrange
      const token = 'valid-token';
      const mockTokenData = {
        userId: 'user-123',
        sessionId: 'session-123',
        payload: {}
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        role: 'individual',
        company_id: null
      };

      jest.spyOn(authService, 'verifyAccessToken').mockResolvedValueOnce(mockTokenData);
      mockDb.query.mockResolvedValueOnce({ rows: [mockUser] });

      // Act
      const result = await authService.getUserFromToken(token);

      // Assert
      expect(result).toEqual(mockUser);
    });

    it('should return null for invalid token', async () => {
      // Arrange
      const token = 'invalid-token';
      jest.spyOn(authService, 'verifyAccessToken').mockResolvedValueOnce(null);

      // Act
      const result = await authService.getUserFromToken(token);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('blacklistToken', () => {
    it('should blacklist token with TTL', async () => {
      // Arrange
      const token = 'token-to-blacklist';
      const mockPayload = {
        jti: 'token-id',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      mockJwtService.decodeTokenWithoutVerification.mockReturnValueOnce(mockPayload as any);

      // Act
      await authService.blacklistToken(token);

      // Assert
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'blacklist:token-id',
        expect.any(Number),
        '1'
      );
    });

    it('should handle token without JTI', async () => {
      // Arrange
      const token = 'token-without-jti';
      const mockPayload = {
        sessionId: 'session-123',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      mockJwtService.decodeTokenWithoutVerification.mockReturnValueOnce(mockPayload as any);

      // Act
      await authService.blacklistToken(token);

      // Assert
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'blacklist:session-123',
        expect.any(Number),
        '1'
      );
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true for blacklisted token', async () => {
      // Arrange
      const token = 'blacklisted-token';
      const mockPayload = { jti: 'token-id' };

      mockJwtService.decodeTokenWithoutVerification.mockReturnValueOnce(mockPayload as any);
      mockRedis.get.mockResolvedValueOnce('1');

      // Act
      const result = await authService.isTokenBlacklisted(token);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-blacklisted token', async () => {
      // Arrange
      const token = 'valid-token';
      const mockPayload = { jti: 'token-id' };

      mockJwtService.decodeTokenWithoutVerification.mockReturnValueOnce(mockPayload as any);
      mockRedis.get.mockResolvedValueOnce(null);

      // Act
      const result = await authService.isTokenBlacklisted(token);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getUserSessions', () => {
    it('should return active user sessions', async () => {
      // Arrange
      const userId = 'user-123';
      const mockSessions = [
        {
          id: 'session-1',
          user_id: 'user-123',
          device_info: { fingerprint: 'device-1' },
          ip_address: '127.0.0.1',
          expires_at: new Date(Date.now() + 3600000),
          created_at: new Date(),
          last_accessed_at: new Date()
        },
        {
          id: 'session-2',
          user_id: 'user-123',
          device_info: null,
          ip_address: '192.168.1.1',
          expires_at: new Date(Date.now() + 7200000),
          created_at: new Date(),
          last_accessed_at: new Date()
        }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockSessions });

      // Act
      const result = await authService.getUserSessions(userId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        userId: 'user-123',
        sessionId: 'session-1',
        deviceId: 'device-1',
        isActive: true
      });
      expect(result[1]).toMatchObject({
        userId: 'user-123',
        sessionId: 'session-2',
        deviceId: 'unknown',
        isActive: true
      });
    });

    it('should return empty array when no sessions found', async () => {
      // Arrange
      const userId = 'user-123';
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      // Act
      const result = await authService.getUserSessions(userId);

      // Assert
      expect(result).toEqual([]);
    });
  });
}); 