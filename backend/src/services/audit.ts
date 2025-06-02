import { query } from '../database/connection';

export interface AuditLog {
  id: string;
  user_id: string;
  company_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: object;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface CreateAuditLogParams {
  user_id: string;
  company_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: object;
  ip_address?: string;
  user_agent?: string;
}

export interface AuditLogFilter {
  user_id?: string;
  company_id?: string;
  action?: string;
  resource_type?: string;
  start_date?: Date;
  end_date?: Date;
}

export const createAuditLog = async (params: CreateAuditLogParams): Promise<AuditLog> => {
  const {
    user_id,
    company_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  } = params;

  const result = await query(
    `INSERT INTO audit_logs (user_id, company_id, action, resource_type, resource_id, details, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [user_id, company_id, action, resource_type, resource_id, JSON.stringify(details), ip_address, user_agent]
  );

  const auditLog = result.rows[0];
  if (auditLog.details) {
    auditLog.details = JSON.parse(auditLog.details);
  }

  return auditLog;
};

export const getAuditLogs = async (
  filter: AuditLogFilter = {},
  limit = 50,
  offset = 0
): Promise<{ logs: AuditLog[], total: number }> => {
  const whereClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  // Build WHERE clause based on filters
  if (filter.user_id) {
    whereClauses.push(`user_id = $${paramIndex}`);
    values.push(filter.user_id);
    paramIndex++;
  }

  if (filter.company_id) {
    whereClauses.push(`company_id = $${paramIndex}`);
    values.push(filter.company_id);
    paramIndex++;
  }

  if (filter.action) {
    whereClauses.push(`action = $${paramIndex}`);
    values.push(filter.action);
    paramIndex++;
  }

  if (filter.resource_type) {
    whereClauses.push(`resource_type = $${paramIndex}`);
    values.push(filter.resource_type);
    paramIndex++;
  }

  if (filter.start_date) {
    whereClauses.push(`created_at >= $${paramIndex}`);
    values.push(filter.start_date);
    paramIndex++;
  }

  if (filter.end_date) {
    whereClauses.push(`created_at <= $${paramIndex}`);
    values.push(filter.end_date);
    paramIndex++;
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Add pagination parameters
  values.push(limit, offset);
  const limitClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

  const [logsResult, countResult] = await Promise.all([
    query(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC ${limitClause}`,
      values
    ),
    query(
      `SELECT COUNT(*) FROM audit_logs ${whereClause}`,
      values.slice(0, -2) // Remove limit and offset for count query
    )
  ]);

  // Parse details JSON for each log
  const logs = logsResult.rows.map((log: any) => {
    if (log.details) {
      try {
        log.details = JSON.parse(log.details);
      } catch (e) {
        log.details = {};
      }
    }
    return log;
  });

  return {
    logs,
    total: parseInt(countResult.rows[0].count)
  };
};

export const getAuditLogById = async (id: string): Promise<AuditLog | null> => {
  const result = await query('SELECT * FROM audit_logs WHERE id = $1', [id]);
  
  if (result.rows.length === 0) {
    return null;
  }

  const auditLog = result.rows[0];
  if (auditLog.details) {
    try {
      auditLog.details = JSON.parse(auditLog.details);
    } catch (e) {
      auditLog.details = {};
    }
  }

  return auditLog;
};

export const deleteOldAuditLogs = async (beforeDate: Date): Promise<number> => {
  const result = await query(
    'DELETE FROM audit_logs WHERE created_at < $1',
    [beforeDate]
  );

  return result.rowCount;
};

// Utility function to log common actions
export const logUserAction = async (
  userId: string,
  companyId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: object,
  request?: { ip?: string, headers?: { 'user-agent'?: string } }
): Promise<void> => {
  await createAuditLog({
    user_id: userId,
    company_id: companyId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    details,
    ip_address: request?.ip,
    user_agent: request?.headers?.['user-agent']
  });
};

// Alternative function signature that controllers expect
export const logAction = async (params: {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: object;
  companyId?: string;
  ipAddress?: string;
  userAgent?: string;
  request?: { ip?: string, headers?: { 'user-agent'?: string } };
}): Promise<void> => {
  const { userId, action, resourceType, resourceId, details, companyId, ipAddress, userAgent, request } = params;
  
  // If companyId is not provided, we might need to fetch it from the user
  // For now, we'll use the provided companyId or empty string
  const finalCompanyId = companyId || '';
  
  await createAuditLog({
    user_id: userId,
    company_id: finalCompanyId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    details,
    ip_address: ipAddress || request?.ip,
    user_agent: userAgent || request?.headers?.['user-agent']
  });
};

// Export service object for controllers
export const auditService = {
  createAuditLog,
  getAuditLogs,
  getAuditLogById,
  deleteOldAuditLogs,
  logUserAction,
  logAction
};