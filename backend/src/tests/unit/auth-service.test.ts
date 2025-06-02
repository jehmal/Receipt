import { authService, CreateUserData, LoginCredentials } from '../../services/auth';
import { TestDataFactory } from '../fixtures/test-data';
import bcrypt from 'bcryptjs';
import { db } from '../../database/connection';
import { jwtService } from '../../config/jwt';

// Mock external dependencies
jest.mock('../../database/connection');
jest.mock('bcryptjs');
jest.mock('../../config/jwt');
jest.mock('../../config/redis', () => ({
  redis: {
    setex: jest.fn(),
    get: jest.fn(),
    del: jest.fn()
  }
}));

const mockedDb = jest.mocked(db);
const mockedBcrypt = jest.mocked(bcrypt);
const mockedJwtService = jest.mocked(jwtService);

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should successfully create a new user', async () => {
      // Arrange
      const userData: CreateUserData = {
        email: 'test@example.com',
        password: 'securePassword123',
        firstName: 'John',
        lastName: 'Doe'
      };
      
      const mockUser = {
        id: 'user-123',
        email: userData.email.toLowerCase(),
        first_name: userData.firstName,
        last_name: userData.lastName,
        role: 'individual',
        company_id: null,
        created_at: new Date()
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      };

      // Mock database responses
      mockedDb.query
        .mockResolvedValueOnce({ rows: [] }) // No existing user
        .mockResolvedValueOnce({ rows: [mockUser] }); // User creation result

      mockedBcrypt.hash.mockResolvedValue('hashed-password');
      mockedJwtService.generateTokenPair.mockReturnValue(mockTokens);

      // Act
      const result = await authService.createUser(userData);

      // Assert
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.first_name,
          lastName: mockUser.last_name,
          role: mockUser.role,
          companyId: mockUser.company_id
        },
        tokens: mockTokens,
        deviceId: expect.any(String),
        sessionId: expect.any(String)
      });

      expect(mockedDb.query).toHaveBeenCalledTimes(3); // Check existing, create user, create session
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(userData.password, expect.any(Number));
    });

    it('should throw error when user already exists', async () => {
      // Arrange
      const userData: CreateUserData = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Doe'
      };

      // Mock existing user found
      mockedDb.query.mockResolvedValueOnce({ 
        rows: [{ id: 'existing-user-id' }] 
      });

      // Act & Assert
      await expect(authService.createUser(userData)).rejects.toThrow(
        'User with this email already exists'
      );

      expect(mockedDb.query).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
        [userData.email.toLowerCase()]
      );
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const userData: CreateUserData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      // Mock database error
      mockedDb.query.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(authService.createUser(userData)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('authenticateUser', () => {
    it('should successfully authenticate user with valid credentials', async () => {
      // Arrange
      const credentials: LoginCredentials = {
        email: 'user@example.com',
        password: 'correctPassword'
      };

      const mockUser = {
        id: 'user-123',
        email: credentials.email.toLowerCase(),
        password_hash: 'hashed-password',
        first_name: 'John',
        last_name: 'Doe',
        role: 'individual',
        company_id: null,
        last_login_at: null
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      };

      // Mock database responses
      mockedDb.query
        .mockResolvedValueOnce({ rows: [mockUser] }) // User found
        .mockResolvedValueOnce({ rows: [{ last_login_at: new Date() }] }); // Update last login

      mockedBcrypt.compare.mockResolvedValue(true);
      mockedJwtService.generateTokenPair.mockReturnValue(mockTokens);

      // Act
      const result = await authService.authenticateUser(credentials);

      // Assert
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.first_name,
          lastName: mockUser.last_name,
          role: mockUser.role,
          companyId: mockUser.company_id,
          lastLoginAt: expect.any(Date)
        },
        tokens: mockTokens,
        deviceId: expect.any(String),
        sessionId: expect.any(String)
      });

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        credentials.password,
        mockUser.password_hash
      );
    });

    it('should throw error for non-existent user', async () => {
      // Arrange
      const credentials: LoginCredentials = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      // Mock no user found
      mockedDb.query.mockResolvedValueOnce({ rows: [] });

      // Act & Assert
      await expect(authService.authenticateUser(credentials)).rejects.toThrow(
        'Invalid email or password'
      );

      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, email, password_hash'),
        [credentials.email.toLowerCase()]
      );
    });

    it('should throw error for invalid password', async () => {
      // Arrange
      const credentials: LoginCredentials = {
        email: 'user@example.com',
        password: 'wrongPassword'
      };

      const mockUser = {
        id: 'user-123',
        email: credentials.email.toLowerCase(),
        password_hash: 'hashed-password',
        first_name: 'John',
        last_name: 'Doe',
        role: 'individual',
        company_id: null
      };

      // Mock user found but wrong password
      mockedDb.query.mockResolvedValueOnce({ rows: [mockUser] });
      mockedBcrypt.compare.mockResolvedValue(false);

      // Act & Assert
      await expect(authService.authenticateUser(credentials)).rejects.toThrow(
        'Invalid email or password'
      );

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        credentials.password,
        mockUser.password_hash
      );
    });

    it('should update last login timestamp', async () => {
      // Arrange
      const credentials: LoginCredentials = {
        email: 'user@example.com',
        password: 'correctPassword'
      };

      const mockUser = {
        id: 'user-123',
        email: credentials.email.toLowerCase(),
        password_hash: 'hashed-password',
        first_name: 'John',
        last_name: 'Doe',
        role: 'individual',
        company_id: null
      };

      const ipAddress = '192.168.1.1';

      mockedDb.query
        .mockResolvedValueOnce({ rows: [mockUser] })
        .mockResolvedValueOnce({ rows: [{ last_login_at: new Date() }] });
      
      mockedBcrypt.compare.mockResolvedValue(true);
      mockedJwtService.generateTokenPair.mockReturnValue({
        accessToken: 'token',
        refreshToken: 'refresh'
      });

      // Act
      await authService.authenticateUser(credentials, ipAddress);

      // Assert
      expect(mockedDb.query).toHaveBeenCalledWith(
        'UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2 RETURNING last_login_at',
        [ipAddress, mockUser.id]
      );
    });
  });

  describe('password hashing', () => {
    it('should hash password correctly', async () => {
      // Arrange
      const password = 'mySecurePassword123';
      const expectedHash = 'hashed-result';

      mockedBcrypt.hash.mockResolvedValue(expectedHash);

      // Act
      const result = await authService.hashPassword(password);

      // Assert
      expect(result).toBe(expectedHash);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, expect.any(Number));
    });

    it('should verify password correctly', async () => {
      // Arrange
      const password = 'originalPassword';
      const hash = 'stored-hash';

      mockedBcrypt.compare.mockResolvedValue(true);

      // Act
      const result = await authService.verifyPassword(password, hash);

      // Assert
      expect(result).toBe(true);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(password, hash);
    });

    it('should return false for incorrect password', async () => {
      // Arrange
      const password = 'wrongPassword';
      const hash = 'stored-hash';

      mockedBcrypt.compare.mockResolvedValue(false);

      // Act
      const result = await authService.verifyPassword(password, hash);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('token operations', () => {
    it('should verify access token successfully', async () => {
      // Arrange
      const token = 'valid-access-token';
      const mockPayload = {
        userId: 'user-123',
        sessionId: 'session-456'
      };

      const mockSession = {
        id: 'session-456',
        userId: 'user-123',
        isActive: true
      };

      mockedJwtService.verifyAccessToken.mockResolvedValue(mockPayload);
      mockedDb.query.mockResolvedValueOnce({ rows: [mockSession] });

      // Act
      const result = await authService.verifyAccessToken(token);

      // Assert
      expect(result).toEqual({
        userId: mockPayload.userId,
        sessionId: mockPayload.sessionId,
        payload: mockPayload
      });
    });

    it('should return null for invalid token', async () => {
      // Arrange
      const invalidToken = 'invalid-token';

      mockedJwtService.verifyAccessToken.mockResolvedValue(null);

      // Act
      const result = await authService.verifyAccessToken(invalidToken);

      // Assert
      expect(result).toBe(null);
    });

    it('should refresh tokens successfully', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      };

      const mockRefreshData = {
        userId: 'user-123',
        sessionId: 'session-456',
        deviceId: 'device-789',
        expiresAt: new Date(Date.now() + 86400000) // 24 hours
      };

      mockedDb.query.mockResolvedValueOnce({ rows: [mockRefreshData] });
      mockedJwtService.generateTokenPair.mockReturnValue(newTokens);

      // Act
      const result = await authService.refreshTokens(refreshToken);

      // Assert
      expect(result).toEqual(newTokens);
    });

    it('should throw error for expired refresh token', async () => {
      // Arrange
      const expiredRefreshToken = 'expired-refresh-token';

      const mockExpiredData = {
        userId: 'user-123',
        sessionId: 'session-456',
        deviceId: 'device-789',
        expiresAt: new Date(Date.now() - 86400000) // 24 hours ago
      };

      mockedDb.query.mockResolvedValueOnce({ rows: [mockExpiredData] });

      // Act & Assert
      await expect(authService.refreshTokens(expiredRefreshToken)).rejects.toThrow(
        'Refresh token has expired'
      );
    });
  });

  describe('session management', () => {
    it('should revoke user sessions successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const sessionId = 'session-456';

      mockedDb.query.mockResolvedValueOnce({ rows: [] });

      // Act
      await authService.revokeUserSessions(userId, sessionId);

      // Assert
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_sessions SET is_active = false'),
        expect.arrayContaining([userId])
      );
    });

    it('should get user sessions', async () => {
      // Arrange
      const userId = 'user-123';
      const mockSessions = [
        {
          id: 'session-1',
          user_id: userId,
          device_id: 'device-1',
          created_at: new Date(),
          last_accessed_at: new Date(),
          expires_at: new Date(Date.now() + 86400000),
          is_active: true
        }
      ];

      mockedDb.query.mockResolvedValueOnce({ rows: mockSessions });

      // Act
      const result = await authService.getUserSessions(userId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        userId: mockSessions[0].user_id,
        sessionId: mockSessions[0].id,
        deviceId: mockSessions[0].device_id,
        createdAt: mockSessions[0].created_at,
        lastAccessedAt: mockSessions[0].last_accessed_at,
        expiresAt: mockSessions[0].expires_at,
        isActive: mockSessions[0].is_active
      });
    });
  });
}); 