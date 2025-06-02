import { authService, CreateUserData, LoginCredentials } from '../../services/auth';
import { TestDataFactory } from '../fixtures/test-data';
import bcrypt from 'bcryptjs';
import { db } from '../../database/connection';
import { jwtService, TokenPair } from '../../config/jwt';

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

const mockedDb = db as jest.Mocked<typeof db>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedJwtService = jwtService as jest.Mocked<typeof jwtService>;

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

      const mockTokens: TokenPair = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        refreshExpiresIn: 2592000
      };

      // Mock database responses
      mockedDb.query
        .mockResolvedValueOnce({ rows: [] }) // No existing user
        .mockResolvedValueOnce({ rows: [mockUser] }) // User creation result
        .mockResolvedValueOnce({ rows: [] }); // Session creation

      (mockedBcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>).mockResolvedValue('hashed-password' as never);
      (mockedJwtService.generateTokenPair as jest.MockedFunction<typeof jwtService.generateTokenPair>).mockReturnValue(mockTokens);

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

      expect(mockedDb.query).toHaveBeenCalledTimes(3);
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
      mockedDb.query.mockRejectedValueOnce(new Error('Database connection failed'));

      // Act & Assert
      await expect(authService.createUser(userData)).rejects.toThrow('Database connection failed');
    });
  });

  describe('authenticateUser', () => {
    it('should successfully authenticate a user', async () => {
      // Arrange
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockUser = {
        id: 'user-123',
        email: credentials.email.toLowerCase(),
        first_name: 'John',
        last_name: 'Doe',
        role: 'individual',
        company_id: null,
        password_hash: 'hashed-password',
        last_login_at: null
      };

      const mockTokens: TokenPair = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        refreshExpiresIn: 2592000
      };

      // Mock database and crypto responses
      mockedDb.query
        .mockResolvedValueOnce({ rows: [mockUser] }) // User lookup
        .mockResolvedValueOnce({ rows: [{ last_login_at: new Date() }] }) // Update last login
        .mockResolvedValueOnce({ rows: [] }); // Create session

      (mockedBcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(true as never);
      (mockedJwtService.generateTokenPair as jest.MockedFunction<typeof jwtService.generateTokenPair>).mockReturnValue(mockTokens);

      // Act
      const result = await authService.authenticateUser(credentials);

      // Assert
      expect(result.user.email).toBe(mockUser.email);
      expect(result.tokens).toEqual(mockTokens);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(credentials.password, mockUser.password_hash);
    });

    it('should throw error for invalid credentials', async () => {
      // Arrange
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const mockUser = {
        id: 'user-123',
        email: credentials.email.toLowerCase(),
        password_hash: 'hashed-password'
      };

      mockedDb.query.mockResolvedValueOnce({ rows: [mockUser] });
      (mockedBcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(false as never);

      // Act & Assert
      await expect(authService.authenticateUser(credentials)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      // Arrange
      const password = 'testPassword123';
      const expectedHash = 'hashed-result';

      (mockedBcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>).mockResolvedValue(expectedHash as never);

      // Act
      const result = await authService.hashPassword(password);

      // Assert
      expect(result).toBe(expectedHash);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, expect.any(Number));
    });
  });

  describe('verifyPassword', () => {
    it('should verify password correctly for valid password', async () => {
      // Arrange
      const password = 'testPassword123';
      const hash = 'hashed-password';

      (mockedBcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(true as never);

      // Act
      const result = await authService.verifyPassword(password, hash);

      // Assert
      expect(result).toBe(true);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(password, hash);
    });

    it('should verify password correctly for invalid password', async () => {
      // Arrange
      const password = 'wrongPassword';
      const hash = 'hashed-password';

      (mockedBcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(false as never);

      // Act
      const result = await authService.verifyPassword(password, hash);

      // Assert
      expect(result).toBe(false);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(password, hash);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify access token successfully', async () => {
      // Arrange
      const token = 'valid-jwt-token';
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        sessionId: 'session-123'
      };

      const mockSessionResult = {
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
      };

      (mockedJwtService.verifyToken as jest.MockedFunction<any>).mockReturnValue(mockPayload);
      mockedDb.query
        .mockResolvedValueOnce(mockSessionResult) // Session lookup
        .mockResolvedValueOnce({ rows: [] }); // Update last accessed

      // Act
      const result = await authService.verifyAccessToken(token);

      // Assert
      expect(result).toEqual({
        userId: mockPayload.sub,
        sessionId: mockPayload.sessionId,
        payload: mockPayload
      });
      expect(mockedJwtService.verifyToken).toHaveBeenCalledWith(token, 'access');
    });

    it('should return null for invalid token', async () => {
      // Arrange
      const token = 'invalid-jwt-token';

      (mockedJwtService.verifyToken as jest.MockedFunction<any>).mockReturnValue(null);

      // Act
      const result = await authService.verifyAccessToken(token);

      // Assert
      expect(result).toBeNull();
      expect(mockedJwtService.verifyToken).toHaveBeenCalledWith(token, 'access');
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const newTokens: TokenPair = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
        refreshExpiresIn: 2592000
      };

      (mockedJwtService.generateTokenPair as jest.MockedFunction<typeof jwtService.generateTokenPair>).mockReturnValue(newTokens);

      // Mock token validation and session lookup
      mockedDb.query.mockResolvedValueOnce({ 
        rows: [{ user_id: 'user-123', session_id: 'session-123' }] 
      });

      // Act
      const result = await authService.refreshTokens(refreshToken);

      // Assert
      expect(result).toEqual(newTokens);
    });
  });
});