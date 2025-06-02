import { query } from '@/database/connection';

export interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  logo_url?: string;
  subscription_plan: string;
  subscription_status: string;
  status: string; // alias for subscription_status for backward compatibility
  max_users: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCompanyParams {
  name: string;
  email: string;
  phone: string;
  address: string;
  subscription_plan: string;
  max_users: number;
  logo_url?: string;
}

export interface UpdateCompanyParams {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  subscription_plan?: string;
  max_users?: number;
}

export const createCompany = async (params: CreateCompanyParams): Promise<Company> => {
  const {
    name,
    email,
    phone,
    address,
    subscription_plan,
    max_users,
    logo_url
  } = params;

  const result = await query(
    `INSERT INTO companies (name, email, phone, address, subscription_plan, max_users, logo_url, subscription_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
     RETURNING *`,
    [name, email, phone, address, subscription_plan, max_users, logo_url]
  );

  return result.rows[0];
};

export const getCompanyById = async (id: string): Promise<Company | null> => {
  const result = await query('SELECT * FROM companies WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export interface GetCompaniesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  includeInactive?: boolean;
  includeStats?: boolean;
}

export const getCompanies = async (params: GetCompaniesParams = {}): Promise<{ 
  data: Company[], 
  total: number, 
  page: number, 
  totalPages: number 
}> => {
  const { 
    page = 1, 
    limit = 20, 
    search, 
    status, 
    includeInactive = false 
  } = params;
  
  const offset = (page - 1) * limit;
  const whereClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (search) {
    whereClauses.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
    values.push(`%${search}%`);
    paramIndex++;
  }

  if (status) {
    whereClauses.push(`subscription_status = $${paramIndex}`);
    values.push(status);
    paramIndex++;
  }

  if (!includeInactive) {
    whereClauses.push(`subscription_status = 'active'`);
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  values.push(limit, offset);
  const [companiesResult, countResult] = await Promise.all([
    query(
      `SELECT * FROM companies ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, 
      values
    ),
    query(`SELECT COUNT(*) FROM companies ${whereClause}`, values.slice(0, -2))
  ]);

  const total = parseInt(countResult.rows[0].count);
  const totalPages = Math.ceil(total / limit);

  return {
    data: companiesResult.rows,
    total,
    page,
    totalPages
  };
};

export const updateCompany = async (id: string, params: UpdateCompanyParams): Promise<Company | null> => {
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
    return getCompanyById(id);
  }

  values.push(id);
  const result = await query(
    `UPDATE companies SET ${updates.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0] || null;
};

export const deleteCompany = async (id: string): Promise<boolean> => {
  const result = await query('DELETE FROM companies WHERE id = $1', [id]);
  return result.rowCount > 0;
};

export const getCompanyStats = async (companyId: string): Promise<{
  userCount: number;
  receiptCount: number;
  storageUsed: number;
}> => {
  const [userResult, receiptResult, storageResult] = await Promise.all([
    query('SELECT COUNT(*) FROM users WHERE company_id = $1', [companyId]),
    query('SELECT COUNT(*) FROM receipts WHERE company_id = $1', [companyId]),
    query('SELECT COALESCE(SUM(file_size), 0) as total_size FROM receipts WHERE company_id = $1', [companyId])
  ]);

  return {
    userCount: parseInt(userResult.rows[0].count),
    receiptCount: parseInt(receiptResult.rows[0].count),
    storageUsed: parseInt(storageResult.rows[0].total_size || '0')
  };
};

export const updateCompanyStatus = async (id: string, status: string, reason?: string): Promise<Company | null> => {
  const result = await query(
    'UPDATE companies SET subscription_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, id]
  );
  
  return result.rows[0] || null;
};