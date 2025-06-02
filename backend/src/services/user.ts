import { query } from '../database/connection';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company_id: string;
  role: string;
  status: string;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserParams {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  company_id: string;
  role: string;
}

export interface UpdateUserParams {
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  status?: string;
}

export const createUser = async (params: CreateUserParams): Promise<User> => {
  const {
    email,
    password,
    first_name,
    last_name,
    company_id,
    role
  } = params;

  const hashedPassword = await bcrypt.hash(password, 12);

  const result = await query(
    `INSERT INTO users (email, password_hash, first_name, last_name, company_id, role, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'active')
     RETURNING id, email, first_name, last_name, company_id, role, status, created_at, updated_at`,
    [email, hashedPassword, first_name, last_name, company_id, role]
  );

  return result.rows[0];
};

export const getUserById = async (id: string): Promise<User | null> => {
  const result = await query(
    'SELECT id, email, first_name, last_name, company_id, role, status, last_login_at, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const result = await query(
    'SELECT id, email, first_name, last_name, company_id, role, status, last_login_at, created_at, updated_at FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
};

export const getUserByEmailWithPassword = async (email: string): Promise<(User & { password_hash: string }) | null> => {
  const result = await query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
};

export const getUsers = async (
  companyId?: string,
  limit = 50,
  offset = 0
): Promise<{ users: User[], total: number }> => {
  let whereClause = '';
  let queryParams: any[] = [limit, offset];
  let paramIndex = 3;

  if (companyId) {
    whereClause = 'WHERE company_id = $3';
    queryParams = [limit, offset, companyId];
    paramIndex = 4;
  }

  const [usersResult, countResult] = await Promise.all([
    query(
      `SELECT id, email, first_name, last_name, company_id, role, status, last_login_at, created_at, updated_at 
       FROM users ${whereClause} 
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      queryParams
    ),
    query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      companyId ? [companyId] : []
    )
  ]);

  return {
    users: usersResult.rows,
    total: parseInt(countResult.rows[0].count)
  };
};

export const updateUser = async (id: string, params: UpdateUserParams): Promise<User | null> => {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      updates.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  });

  if (updates.length === 0) {
    return getUserById(id);
  }

  values.push(id);
  const result = await query(
    `UPDATE users SET ${updates.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex}
     RETURNING id, email, first_name, last_name, company_id, role, status, last_login_at, created_at, updated_at`,
    values
  );

  return result.rows[0] || null;
};

export const updatePassword = async (id: string, newPassword: string): Promise<boolean> => {
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  
  const result = await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [hashedPassword, id]
  );

  return result.rowCount > 0;
};

export const deleteUser = async (id: string): Promise<boolean> => {
  const result = await query('DELETE FROM users WHERE id = $1', [id]);
  return result.rowCount > 0;
};

export const updateLastLogin = async (id: string): Promise<void> => {
  await query(
    'UPDATE users SET last_login_at = NOW() WHERE id = $1',
    [id]
  );
};

export const verifyPassword = async (plainPassword: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

export const updateUserStatus = async (userId: string, status: string): Promise<User | null> => {
  return updateUser(userId, { status });
};

export const getUsersWithFilters = async (params: {
  page: number;
  limit: number;
  search: string;
  companyId: string;
  status: string;
  includeInactive: boolean;
}): Promise<{ users: User[]; total: number }> => {
  const { page, limit, search, companyId, status, includeInactive } = params;
  const offset = (page - 1) * limit;
  
  let whereClause = 'WHERE 1=1';
  const queryParams: any[] = [];
  let paramIndex = 1;
  
  if (companyId) {
    whereClause += ` AND company_id = $${paramIndex}`;
    queryParams.push(companyId);
    paramIndex++;
  }
  
  if (search) {
    whereClause += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
    queryParams.push(`%${search}%`);
    paramIndex++;
  }
  
  if (status) {
    whereClause += ` AND status = $${paramIndex}`;
    queryParams.push(status);
    paramIndex++;
  }
  
  if (!includeInactive) {
    whereClause += ` AND status != 'inactive'`;
  }
  
  const [usersResult, countResult] = await Promise.all([
    query(
      `SELECT id, email, first_name, last_name, company_id, role, status, last_login_at, created_at, updated_at 
       FROM users ${whereClause} 
       ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    ),
    query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      queryParams
    )
  ]);

  return {
    users: usersResult.rows,
    total: parseInt(countResult.rows[0].count)
  };
};