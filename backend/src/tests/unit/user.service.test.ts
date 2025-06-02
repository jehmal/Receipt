import * as userService from '../../services/user';
import { query } from '../../database/connection';
import bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('../../database/connection');
jest.mock('bcryptjs');

describe('UserService', () => {
  let mockQuery: jest.MockedFunction<typeof query>;
  let mockBcrypt: jest.Mocked<typeof bcrypt>;

  beforeEach(() => {
    mockQuery = query as jest.MockedFunction<typeof query>;
    mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

    // Setup default mocks
    mockBcrypt.hash = jest.fn().mockResolvedValue('hashedPassword123');
    mockBcrypt.compare = jest.fn().mockResolvedValue(true);

    jest.clearAllMocks();
  });

  describe('createUser', () => {
    const mockCreateUserParams: userService.CreateUserParams = {
      email: 'test@example.com',
      password: 'plainPassword123',
      first_name: 'John',
      last_name: 'Doe',
      company_id: 'company-123',
      role: 'user'
    };

    const mockUserRow = {
      id: 'user-123',
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
      company_id: 'company-123',
      role: 'user',
      status: 'active',
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01')
    };

    it('should create a new user with hashed password', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUserRow] });

      const result = await userService.createUser(mockCreateUserParams);

      expect(mockBcrypt.hash).toHaveBeenCalledWith('plainPassword123', 12);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['test@example.com', 'hashedPassword123', 'John', 'Doe', 'company-123', 'user']
      );

      expect(result).toEqual(mockUserRow);
    });

    it('should set default status as active', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUserRow] });

      await userService.createUser(mockCreateUserParams);

      const query = mockQuery.mock.calls[0][0] as string;
      expect(query).toContain("status) VALUES ($1, $2, $3, $4, $5, $6, 'active')");
    });

    it('should handle bcrypt hashing errors', async () => {
      mockBcrypt.hash = jest.fn().mockRejectedValue(new Error('Hashing failed'));

      await expect(userService.createUser(mockCreateUserParams))
        .rejects.toThrow('Hashing failed');

      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should handle database insertion errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database constraint violation'));

      await expect(userService.createUser(mockCreateUserParams))
        .rejects.toThrow('Database constraint violation');
    });

    it('should return only safe user fields', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUserRow] });

      const result = await userService.createUser(mockCreateUserParams);

      expect(result).not.toHaveProperty('password_hash');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('first_name');
      expect(result).toHaveProperty('last_name');
    });

    it('should handle special characters in user data', async () => {
      const specialCharsParams: userService.CreateUserParams = {
        ...mockCreateUserParams,
        first_name: "O'Connor",
        last_name: 'D\'Angelo',
        email: 'test+special@example.co.uk'
      };

      const specialUserRow = {
        ...mockUserRow,
        first_name: "O'Connor",
        last_name: 'D\'Angelo',
        email: 'test+special@example.co.uk'
      };

      mockQuery.mockResolvedValue({ rows: [specialUserRow] });

      const result = await userService.createUser(specialCharsParams);

      expect(result.first_name).toBe("O'Connor");
      expect(result.last_name).toBe('D\'Angelo');
      expect(result.email).toBe('test+special@example.co.uk');
    });
  });

  describe('getUserById', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
      company_id: 'company-123',
      role: 'user',
      status: 'active',
      last_login_at: new Date('2024-01-01'),
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01')
    };

    it('should return user by ID', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await userService.getUserById('user-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, email, first_name, last_name, company_id, role, status, last_login_at, created_at, updated_at FROM users WHERE id = $1'),
        ['user-123']
      );

      expect(result).toEqual(mockUser);
    });

    it('should return null for non-existent user', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await userService.getUserById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should not return password_hash in result', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await userService.getUserById('user-123');

      const selectQuery = mockQuery.mock.calls[0][0] as string;
      expect(selectQuery).not.toContain('password_hash');
      expect(result).not.toHaveProperty('password_hash');
    });

    it('should handle database query errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(userService.getUserById('user-123'))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle UUID validation', async () => {
      // Test with various ID formats
      const testIds = ['user-123', '123e4567-e89b-12d3-a456-426614174000', 'invalid-id'];

      for (const id of testIds) {
        mockQuery.mockResolvedValue({ rows: [] });
        await userService.getUserById(id);
        expect(mockQuery).toHaveBeenCalledWith(
          expect.any(String),
          [id]
        );
      }
    });
  });

  describe('getUserByEmail', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe'
    };

    it('should return user by email', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await userService.getUserByEmail('test@example.com');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, email, first_name, last_name, company_id, role, status, last_login_at, created_at, updated_at FROM users WHERE email = $1'),
        ['test@example.com']
      );

      expect(result).toEqual(mockUser);
    });

    it('should return null for non-existent email', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await userService.getUserByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should handle case sensitivity', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      await userService.getUserByEmail('TEST@EXAMPLE.COM');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['TEST@EXAMPLE.COM']
      );
    });

    it('should handle special email formats', async () => {
      const specialEmails = [
        'user+tag@example.com',
        'user.with.dots@example.com',
        'user-with-dashes@example.co.uk',
        'user123@subdomain.example.org'
      ];

      for (const email of specialEmails) {
        mockQuery.mockResolvedValue({ rows: [] });
        await userService.getUserByEmail(email);
        expect(mockQuery).toHaveBeenCalledWith(
          expect.any(String),
          [email]
        );
      }
    });
  });

  describe('getUserByEmailWithPassword', () => {
    const mockUserWithPassword = {
      id: 'user-123',
      email: 'test@example.com',
      password_hash: 'hashedPassword123',
      first_name: 'John',
      last_name: 'Doe',
      company_id: 'company-123',
      role: 'user',
      status: 'active'
    };

    it('should return user with password hash', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUserWithPassword] });

      const result = await userService.getUserByEmailWithPassword('test@example.com');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        ['test@example.com']
      );

      expect(result).toEqual(mockUserWithPassword);
      expect(result).toHaveProperty('password_hash');
    });

    it('should return null for non-existent email', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await userService.getUserByEmailWithPassword('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('getUsers', () => {
    const mockUsers = [
      {
        id: 'user-1',
        email: 'user1@example.com',
        first_name: 'User',
        last_name: 'One',
        company_id: 'company-123',
        role: 'user',
        status: 'active',
        created_at: new Date('2024-01-02')
      },
      {
        id: 'user-2',
        email: 'user2@example.com',
        first_name: 'User',
        last_name: 'Two',
        company_id: 'company-123',
        role: 'admin',
        status: 'active',
        created_at: new Date('2024-01-01')
      }
    ];

    it('should return all users with default pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: mockUsers }) // users query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }); // count query

      const result = await userService.getUsers();

      expect(result).toEqual({
        users: mockUsers,
        total: 2
      });

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(1,
        expect.stringContaining('ORDER BY created_at DESC LIMIT $1 OFFSET $2'),
        [50, 0] // default limit and offset
      );
    });

    it('should filter by company ID', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: mockUsers })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const result = await userService.getUsers('company-123');

      expect(mockQuery).toHaveBeenNthCalledWith(1,
        expect.stringContaining('WHERE company_id = $3'),
        [50, 0, 'company-123']
      );

      expect(mockQuery).toHaveBeenNthCalledWith(2,
        expect.stringContaining('WHERE company_id = $1'),
        ['company-123']
      );
    });

    it('should handle custom pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: mockUsers.slice(0, 1) })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const result = await userService.getUsers(undefined, 1, 1);

      expect(mockQuery).toHaveBeenNthCalledWith(1,
        expect.any(String),
        [1, 1] // custom limit and offset
      );

      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(2);
    });

    it('should run count and users queries in parallel', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: mockUsers })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const startTime = Date.now();
      await userService.getUsers();
      const endTime = Date.now();

      // Should complete quickly due to parallel execution
      expect(endTime - startTime).toBeLessThan(50);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should order by created_at DESC', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: mockUsers })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      await userService.getUsers();

      const usersQuery = mockQuery.mock.calls[0][0] as string;
      expect(usersQuery).toContain('ORDER BY created_at DESC');
    });

    it('should handle empty results', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await userService.getUsers();

      expect(result).toEqual({
        users: [],
        total: 0
      });
    });
  });

  describe('updateUser', () => {
    const mockUpdatedUser = {
      id: 'user-123',
      email: 'updated@example.com',
      first_name: 'Updated',
      last_name: 'User',
      role: 'admin',
      status: 'active'
    };

    it('should update user with provided fields', async () => {
      const updateParams: userService.UpdateUserParams = {
        email: 'updated@example.com',
        first_name: 'Updated',
        role: 'admin'
      };

      mockQuery.mockResolvedValue({ rows: [mockUpdatedUser] });

      const result = await userService.updateUser('user-123', updateParams);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET email = $1, first_name = $2, role = $3, updated_at = NOW()'),
        ['updated@example.com', 'Updated', 'admin', 'user-123']
      );

      expect(result).toEqual(mockUpdatedUser);
    });

    it('should skip undefined fields', async () => {
      const updateParams: userService.UpdateUserParams = {
        email: 'updated@example.com',
        first_name: undefined,
        role: 'admin'
      };

      mockQuery.mockResolvedValue({ rows: [mockUpdatedUser] });

      await userService.updateUser('user-123', updateParams);

      const query = mockQuery.mock.calls[0][0] as string;
      expect(query).toContain('email = $1');
      expect(query).toContain('role = $2');
      expect(query).not.toContain('first_name');
    });

    it('should return current user if no updates provided', async () => {
      const currentUser = { id: 'user-123', email: 'current@example.com' };
      mockQuery.mockResolvedValue({ rows: [currentUser] });

      // Mock getUserById
      const getUserByIdSpy = jest.spyOn(userService, 'getUserById')
        .mockResolvedValue(currentUser as userService.User);

      const result = await userService.updateUser('user-123', {});

      expect(getUserByIdSpy).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(currentUser);

      getUserByIdSpy.mockRestore();
    });

    it('should return null for non-existent user', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await userService.updateUser('nonexistent', { email: 'test@example.com' });

      expect(result).toBeNull();
    });

    it('should handle partial updates', async () => {
      const updateParams: userService.UpdateUserParams = {
        status: 'inactive'
      };

      mockQuery.mockResolvedValue({ rows: [{ ...mockUpdatedUser, status: 'inactive' }] });

      const result = await userService.updateUser('user-123', updateParams);

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, first_name, last_name, company_id, role, status, last_login_at, created_at, updated_at',
        ['inactive', 'user-123']
      );

      expect(result?.status).toBe('inactive');
    });

    it('should always update updated_at field', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUpdatedUser] });

      await userService.updateUser('user-123', { email: 'test@example.com' });

      const query = mockQuery.mock.calls[0][0] as string;
      expect(query).toContain('updated_at = NOW()');
    });
  });

  describe('updatePassword', () => {
    it('should update password with hashed value', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await userService.updatePassword('user-123', 'newPassword123');

      expect(mockBcrypt.hash).toHaveBeenCalledWith('newPassword123', 12);
      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        ['hashedPassword123', 'user-123']
      );

      expect(result).toBe(true);
    });

    it('should return false for non-existent user', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });

      const result = await userService.updatePassword('nonexistent', 'newPassword123');

      expect(result).toBe(false);
    });

    it('should handle bcrypt hashing errors', async () => {
      mockBcrypt.hash = jest.fn().mockRejectedValue(new Error('Hashing failed'));

      await expect(userService.updatePassword('user-123', 'newPassword123'))
        .rejects.toThrow('Hashing failed');

      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should always update updated_at field', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      await userService.updatePassword('user-123', 'newPassword123');

      const query = mockQuery.mock.calls[0][0] as string;
      expect(query).toContain('updated_at = NOW()');
    });
  });

  describe('deleteUser', () => {
    it('should delete user and return true', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await userService.deleteUser('user-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = $1',
        ['user-123']
      );

      expect(result).toBe(true);
    });

    it('should return false for non-existent user', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });

      const result = await userService.deleteUser('nonexistent');

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Foreign key constraint violation'));

      await expect(userService.deleteUser('user-123'))
        .rejects.toThrow('Foreign key constraint violation');
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      await userService.updateLastLogin('user-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        ['user-123']
      );
    });

    it('should not throw error for non-existent user', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });

      await expect(userService.updateLastLogin('nonexistent'))
        .resolves.toBeUndefined();
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(userService.updateLastLogin('user-123'))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      mockBcrypt.compare = jest.fn().mockResolvedValue(true);

      const result = await userService.verifyPassword('plainPassword', 'hashedPassword');

      expect(mockBcrypt.compare).toHaveBeenCalledWith('plainPassword', 'hashedPassword');
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      mockBcrypt.compare = jest.fn().mockResolvedValue(false);

      const result = await userService.verifyPassword('wrongPassword', 'hashedPassword');

      expect(result).toBe(false);
    });

    it('should handle bcrypt comparison errors', async () => {
      mockBcrypt.compare = jest.fn().mockRejectedValue(new Error('Comparison failed'));

      await expect(userService.verifyPassword('password', 'hash'))
        .rejects.toThrow('Comparison failed');
    });

    it('should handle empty passwords', async () => {
      await userService.verifyPassword('', 'hashedPassword');

      expect(mockBcrypt.compare).toHaveBeenCalledWith('', 'hashedPassword');
    });

    it('should handle special characters in passwords', async () => {
      const specialPassword = 'p@ssw0rd!#$%^&*()';
      
      await userService.verifyPassword(specialPassword, 'hashedPassword');

      expect(mockBcrypt.compare).toHaveBeenCalledWith(specialPassword, 'hashedPassword');
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status using updateUser', async () => {
      const mockUser = { id: 'user-123', status: 'inactive' };
      mockQuery.mockResolvedValue({ rows: [mockUser] });

      const result = await userService.updateUserStatus('user-123', 'inactive');

      expect(result).toEqual(mockUser);
    });

    it('should handle common status values', async () => {
      const statuses = ['active', 'inactive', 'pending', 'suspended'];

      for (const status of statuses) {
        mockQuery.mockResolvedValue({ rows: [{ id: 'user-123', status }] });
        
        const result = await userService.updateUserStatus('user-123', status);
        
        expect(result?.status).toBe(status);
      }
    });
  });

  describe('getUsersWithFilters', () => {
    const mockUsers = [
      {
        id: 'user-1',
        email: 'john.doe@example.com',
        first_name: 'John',
        last_name: 'Doe',
        company_id: 'company-123',
        role: 'user',
        status: 'active'
      },
      {
        id: 'user-2',
        email: 'jane.smith@example.com',
        first_name: 'Jane',
        last_name: 'Smith',
        company_id: 'company-123',
        role: 'admin',
        status: 'active'
      }
    ];

    const defaultParams = {
      page: 1,
      limit: 10,
      search: '',
      companyId: '',
      status: '',
      includeInactive: false
    };

    it('should return filtered users with pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: mockUsers })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const result = await userService.getUsersWithFilters(defaultParams);

      expect(result).toEqual({
        users: mockUsers,
        total: 2
      });

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should filter by company ID', async () => {
      const params = { ...defaultParams, companyId: 'company-123' };

      mockQuery
        .mockResolvedValueOnce({ rows: mockUsers })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      await userService.getUsersWithFilters(params);

      const usersQuery = mockQuery.mock.calls[0][0] as string;
      expect(usersQuery).toContain('AND company_id = $1');
      
      const usersParams = mockQuery.mock.calls[0][1] as any[];
      expect(usersParams).toContain('company-123');
    });

    it('should search across multiple fields', async () => {
      const params = { ...defaultParams, search: 'john' };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUsers[0]] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      await userService.getUsersWithFilters(params);

      const usersQuery = mockQuery.mock.calls[0][0] as string;
      expect(usersQuery).toContain('AND (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1)');
      
      const usersParams = mockQuery.mock.calls[0][1] as any[];
      expect(usersParams).toContain('%john%');
    });

    it('should filter by status', async () => {
      const params = { ...defaultParams, status: 'active' };

      mockQuery
        .mockResolvedValueOnce({ rows: mockUsers })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      await userService.getUsersWithFilters(params);

      const usersQuery = mockQuery.mock.calls[0][0] as string;
      expect(usersQuery).toContain('AND status = $1');
      
      const usersParams = mockQuery.mock.calls[0][1] as any[];
      expect(usersParams).toContain('active');
    });

    it('should exclude inactive users by default', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: mockUsers })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      await userService.getUsersWithFilters(defaultParams);

      const usersQuery = mockQuery.mock.calls[0][0] as string;
      expect(usersQuery).toContain("AND status != 'inactive'");
    });

    it('should include inactive users when requested', async () => {
      const params = { ...defaultParams, includeInactive: true };

      mockQuery
        .mockResolvedValueOnce({ rows: mockUsers })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      await userService.getUsersWithFilters(params);

      const usersQuery = mockQuery.mock.calls[0][0] as string;
      expect(usersQuery).not.toContain("AND status != 'inactive'");
    });

    it('should handle pagination correctly', async () => {
      const params = { ...defaultParams, page: 2, limit: 5 };

      mockQuery
        .mockResolvedValueOnce({ rows: mockUsers })
        .mockResolvedValueOnce({ rows: [{ count: '10' }] });

      await userService.getUsersWithFilters(params);

      const usersParams = mockQuery.mock.calls[0][1] as any[];
      expect(usersParams).toContain(5); // limit
      expect(usersParams).toContain(5); // offset (page-1) * limit = (2-1) * 5
    });

    it('should combine multiple filters', async () => {
      const params = {
        page: 1,
        limit: 10,
        search: 'john',
        companyId: 'company-123',
        status: 'active',
        includeInactive: false
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUsers[0]] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      await userService.getUsersWithFilters(params);

      const usersQuery = mockQuery.mock.calls[0][0] as string;
      expect(usersQuery).toContain('AND company_id = $1');
      expect(usersQuery).toContain('AND (first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2)');
      expect(usersQuery).toContain('AND status = $3');
      expect(usersQuery).toContain("AND status != 'inactive'");

      const usersParams = mockQuery.mock.calls[0][1] as any[];
      expect(usersParams).toContain('company-123');
      expect(usersParams).toContain('%john%');
      expect(usersParams).toContain('active');
      expect(usersParams).toContain(10); // limit
      expect(usersParams).toContain(0); // offset
    });

    it('should handle case-insensitive search', async () => {
      const params = { ...defaultParams, search: 'JOHN' };

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await userService.getUsersWithFilters(params);

      const usersParams = mockQuery.mock.calls[0][1] as any[];
      expect(usersParams).toContain('%JOHN%');
    });

    it('should handle empty results', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await userService.getUsersWithFilters(defaultParams);

      expect(result).toEqual({
        users: [],
        total: 0
      });
    });

    it('should handle special characters in search', async () => {
      const params = { ...defaultParams, search: "O'Connor" };

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await userService.getUsersWithFilters(params);

      const usersParams = mockQuery.mock.calls[0][1] as any[];
      expect(usersParams).toContain("%O'Connor%");
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent user operations', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 'user-123' }] });

      const operations = [
        userService.getUserById('user-123'),
        userService.updateUser('user-123', { first_name: 'Updated' }),
        userService.updateLastLogin('user-123')
      ];

      const results = await Promise.all(operations);

      expect(results).toHaveLength(3);
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should handle database connection failures', async () => {
      mockQuery.mockRejectedValue(new Error('Connection timeout'));

      await expect(userService.getUserById('user-123'))
        .rejects.toThrow('Connection timeout');
    });

    it('should handle extremely long input values', async () => {
      const longString = 'a'.repeat(10000);
      const params: userService.CreateUserParams = {
        email: `${longString}@example.com`,
        password: longString,
        first_name: longString,
        last_name: longString,
        company_id: 'company-123',
        role: 'user'
      };

      mockQuery.mockResolvedValue({ rows: [{ id: 'user-123' }] });

      await userService.createUser(params);

      expect(mockBcrypt.hash).toHaveBeenCalledWith(longString, 12);
    });

    it('should handle SQL injection attempts', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      mockQuery.mockResolvedValue({ rows: [] });

      await userService.getUserByEmail(maliciousInput);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [maliciousInput] // Should be parameterized
      );
    });

    it('should handle Unicode characters in user data', async () => {
      const unicodeParams: userService.CreateUserParams = {
        email: 'test@example.com',
        password: 'password123',
        first_name: '🚀👨‍💻',
        last_name: 'François',
        company_id: 'company-123',
        role: 'user'
      };

      mockQuery.mockResolvedValue({ 
        rows: [{ 
          id: 'user-123', 
          first_name: '🚀👨‍💻',
          last_name: 'François' 
        }] 
      });

      const result = await userService.createUser(unicodeParams);

      expect(result.first_name).toBe('🚀👨‍💻');
      expect(result.last_name).toBe('François');
    });

    it('should handle very large result sets', async () => {
      const largeUserSet = Array(10000).fill(0).map((_, i) => ({
        id: `user-${i}`,
        email: `user${i}@example.com`,
        first_name: `User${i}`,
        last_name: 'Test'
      }));

      mockQuery
        .mockResolvedValueOnce({ rows: largeUserSet.slice(0, 100) })
        .mockResolvedValueOnce({ rows: [{ count: '10000' }] });

      const result = await userService.getUsersWithFilters({
        page: 1,
        limit: 100,
        search: '',
        companyId: '',
        status: '',
        includeInactive: false
      });

      expect(result.users).toHaveLength(100);
      expect(result.total).toBe(10000);
    });
  });
});