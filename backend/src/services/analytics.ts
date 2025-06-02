import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { redis } from '../config/redis';

interface AnalyticsFilter {
  startDate?: Date;
  endDate?: Date;
  companyId?: string;
  groupBy?: string;
  categoryId?: string;
}

interface OverviewMetrics {
  totalUsers: number;
  totalCompanies: number;
  totalReceipts: number;
  totalSpending: number;
  activeUsers: number;
  receiptsThisMonth: number;
  spendingThisMonth: number;
  growthMetrics: {
    userGrowth: number;
    receiptGrowth: number;
    spendingGrowth: number;
  };
}

interface ReceiptAnalytics {
  totalReceipts: number;
  totalSpending: number;
  averageAmount: number;
  topCategories: Array<{
    category: string;
    count: number;
    totalAmount: number;
  }>;
  timeSeriesData: Array<{
    date: string;
    count: number;
    totalAmount: number;
  }>;
}

interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  userRetention: number;
  topCompanies: Array<{
    companyName: string;
    userCount: number;
    receiptCount: number;
  }>;
  userActivity: Array<{
    date: string;
    activeUsers: number;
    newUsers: number;
  }>;
}

interface SpendingAnalytics {
  totalSpending: number;
  averageSpending: number;
  spendingByCategory: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  spendingByCompany: Array<{
    companyName: string;
    amount: number;
    percentage: number;
  }>;
  spendingTrends: Array<{
    date: string;
    amount: number;
  }>;
}

export const analyticsService = {
  async getOverviewMetrics(filter: AnalyticsFilter): Promise<OverviewMetrics> {
    try {
      const cacheKey = `analytics:overview:${JSON.stringify(filter)}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const { startDate, endDate, companyId } = filter;
      const whereClause = this.buildWhereClause(filter);

      // Get current metrics
      const [
        totalUsers,
        totalCompanies,
        totalReceipts,
        totalSpending,
        activeUsers,
        receiptsThisMonth,
        spendingThisMonth
      ] = await Promise.all([
        this.getTotalUsers(companyId),
        this.getTotalCompanies(),
        this.getTotalReceipts(whereClause),
        this.getTotalSpending(whereClause),
        this.getActiveUsers(companyId),
        this.getReceiptsThisMonth(companyId),
        this.getSpendingThisMonth(companyId)
      ]);

      // Calculate growth metrics (compared to previous period)
      const growthMetrics = await this.calculateGrowthMetrics(filter);

      const overview: OverviewMetrics = {
        totalUsers: totalUsers.count,
        totalCompanies: totalCompanies.count,
        totalReceipts: totalReceipts.count,
        totalSpending: totalSpending.sum || 0,
        activeUsers: activeUsers.count,
        receiptsThisMonth: receiptsThisMonth.count,
        spendingThisMonth: spendingThisMonth.sum || 0,
        growthMetrics
      };

      await redis.setex(cacheKey, 300, JSON.stringify(overview)); // Cache for 5 minutes
      return overview;
    } catch (error) {
      logger.error('Error getting overview metrics:', error);
      throw error;
    }
  },

  async getReceiptAnalytics(filter: AnalyticsFilter): Promise<ReceiptAnalytics> {
    try {
      const cacheKey = `analytics:receipts:${JSON.stringify(filter)}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const whereClause = this.buildWhereClause(filter);
      const { groupBy = 'day' } = filter;

      const [
        totalStats,
        topCategories,
        timeSeriesData
      ] = await Promise.all([
        this.getReceiptStats(whereClause),
        this.getTopCategories(whereClause),
        this.getReceiptTimeSeries(whereClause, groupBy)
      ]);

      const analytics: ReceiptAnalytics = {
        totalReceipts: totalStats.count,
        totalSpending: totalStats.sum || 0,
        averageAmount: totalStats.avg || 0,
        topCategories,
        timeSeriesData
      };

      await redis.setex(cacheKey, 300, JSON.stringify(analytics));
      return analytics;
    } catch (error) {
      logger.error('Error getting receipt analytics:', error);
      throw error;
    }
  },

  async getUserAnalytics(filter: AnalyticsFilter): Promise<UserAnalytics> {
    try {
      const cacheKey = `analytics:users:${JSON.stringify(filter)}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const { companyId } = filter;

      const [
        totalUsers,
        activeUsers,
        newUsers,
        userRetention,
        topCompanies,
        userActivity
      ] = await Promise.all([
        this.getTotalUsers(companyId),
        this.getActiveUsers(companyId),
        this.getNewUsers(filter),
        this.getUserRetention(filter),
        this.getTopCompanies(filter),
        this.getUserActivity(filter)
      ]);

      const analytics: UserAnalytics = {
        totalUsers: totalUsers.count,
        activeUsers: activeUsers.count,
        newUsers: newUsers.count,
        userRetention,
        topCompanies,
        userActivity
      };

      await redis.setex(cacheKey, 300, JSON.stringify(analytics));
      return analytics;
    } catch (error) {
      logger.error('Error getting user analytics:', error);
      throw error;
    }
  },

  async getSpendingAnalytics(filter: AnalyticsFilter): Promise<SpendingAnalytics> {
    try {
      const cacheKey = `analytics:spending:${JSON.stringify(filter)}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const whereClause = this.buildWhereClause(filter);

      const [
        totalSpending,
        spendingByCategory,
        spendingByCompany,
        spendingTrends
      ] = await Promise.all([
        this.getTotalSpending(whereClause),
        this.getSpendingByCategory(whereClause),
        this.getSpendingByCompany(whereClause),
        this.getSpendingTrends(whereClause, filter.groupBy || 'day')
      ]);

      const analytics: SpendingAnalytics = {
        totalSpending: totalSpending.sum || 0,
        averageSpending: totalSpending.avg || 0,
        spendingByCategory,
        spendingByCompany,
        spendingTrends
      };

      await redis.setex(cacheKey, 300, JSON.stringify(analytics));
      return analytics;
    } catch (error) {
      logger.error('Error getting spending analytics:', error);
      throw error;
    }
  },

  buildWhereClause(filter: AnalyticsFilter): string {
    const conditions: string[] = ['1=1'];
    
    if (filter.startDate) {
      conditions.push(`created_at >= '${filter.startDate.toISOString()}'`);
    }
    
    if (filter.endDate) {
      conditions.push(`created_at <= '${filter.endDate.toISOString()}'`);
    }
    
    if (filter.companyId) {
      conditions.push(`company_id = '${filter.companyId}'`);
    }
    
    if (filter.categoryId) {
      conditions.push(`category_id = '${filter.categoryId}'`);
    }
    
    return conditions.join(' AND ');
  },

  async getTotalUsers(companyId?: string): Promise<{ count: number }> {
    const query = companyId 
      ? 'SELECT COUNT(*) as count FROM users WHERE company_id = $1'
      : 'SELECT COUNT(*) as count FROM users';
    
    const params = companyId ? [companyId] : [];
    const result = await db.query(query, params);
    return { count: parseInt(result.rows[0].count) };
  },

  async getTotalCompanies(): Promise<{ count: number }> {
    const result = await db.query('SELECT COUNT(*) as count FROM companies');
    return { count: parseInt(result.rows[0].count) };
  },

  async getTotalReceipts(whereClause: string): Promise<{ count: number }> {
    const query = `SELECT COUNT(*) as count FROM receipts WHERE ${whereClause}`;
    const result = await db.query(query);
    return { count: parseInt(result.rows[0].count) };
  },

  async getTotalSpending(whereClause: string): Promise<{ sum: number; avg: number }> {
    const query = `
      SELECT 
        COALESCE(SUM(amount), 0) as sum,
        COALESCE(AVG(amount), 0) as avg
      FROM receipts 
      WHERE ${whereClause}
    `;
    const result = await db.query(query);
    return {
      sum: parseFloat(result.rows[0].sum),
      avg: parseFloat(result.rows[0].avg)
    };
  },

  async getActiveUsers(companyId?: string): Promise<{ count: number }> {
    const query = companyId
      ? `SELECT COUNT(DISTINCT user_id) as count 
         FROM receipts 
         WHERE company_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`
      : `SELECT COUNT(DISTINCT user_id) as count 
         FROM receipts 
         WHERE created_at >= NOW() - INTERVAL '30 days'`;
    
    const params = companyId ? [companyId] : [];
    const result = await db.query(query, params);
    return { count: parseInt(result.rows[0].count) };
  },

  async getReceiptsThisMonth(companyId?: string): Promise<{ count: number }> {
    const query = companyId
      ? `SELECT COUNT(*) as count 
         FROM receipts 
         WHERE company_id = $1 AND created_at >= DATE_TRUNC('month', NOW())`
      : `SELECT COUNT(*) as count 
         FROM receipts 
         WHERE created_at >= DATE_TRUNC('month', NOW())`;
    
    const params = companyId ? [companyId] : [];
    const result = await db.query(query, params);
    return { count: parseInt(result.rows[0].count) };
  },

  async getSpendingThisMonth(companyId?: string): Promise<{ sum: number }> {
    const query = companyId
      ? `SELECT COALESCE(SUM(amount), 0) as sum 
         FROM receipts 
         WHERE company_id = $1 AND created_at >= DATE_TRUNC('month', NOW())`
      : `SELECT COALESCE(SUM(amount), 0) as sum 
         FROM receipts 
         WHERE created_at >= DATE_TRUNC('month', NOW())`;
    
    const params = companyId ? [companyId] : [];
    const result = await db.query(query, params);
    return { sum: parseFloat(result.rows[0].sum) };
  },

  async calculateGrowthMetrics(filter: AnalyticsFilter): Promise<{
    userGrowth: number;
    receiptGrowth: number;
    spendingGrowth: number;
  }> {
    // Implementation for calculating growth metrics compared to previous period
    // This would involve getting metrics for current period vs previous period
    return {
      userGrowth: 12.5, // Placeholder
      receiptGrowth: 8.3,
      spendingGrowth: 15.7
    };
  },

  async getReceiptStats(whereClause: string): Promise<{ count: number; sum: number; avg: number }> {
    const query = `
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as sum,
        COALESCE(AVG(amount), 0) as avg
      FROM receipts 
      WHERE ${whereClause}
    `;
    const result = await db.query(query);
    return {
      count: parseInt(result.rows[0].count),
      sum: parseFloat(result.rows[0].sum),
      avg: parseFloat(result.rows[0].avg)
    };
  },

  async getTopCategories(whereClause: string): Promise<Array<{
    category: string;
    count: number;
    totalAmount: number;
  }>> {
    const query = `
      SELECT 
        category,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM receipts 
      WHERE ${whereClause}
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    `;
    const result = await db.query(query);
    return result.rows.map(row => ({
      category: row.category,
      count: parseInt(row.count),
      totalAmount: parseFloat(row.total_amount)
    }));
  },

  async getReceiptTimeSeries(whereClause: string, groupBy: string): Promise<Array<{
    date: string;
    count: number;
    totalAmount: number;
  }>> {
    const dateFormat = groupBy === 'month' ? 'YYYY-MM' : 
                      groupBy === 'week' ? 'YYYY-"W"WW' : 'YYYY-MM-DD';
    
    const query = `
      SELECT 
        TO_CHAR(created_at, '${dateFormat}') as date,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM receipts 
      WHERE ${whereClause}
      GROUP BY TO_CHAR(created_at, '${dateFormat}')
      ORDER BY date
    `;
    const result = await db.query(query);
    return result.rows.map(row => ({
      date: row.date,
      count: parseInt(row.count),
      totalAmount: parseFloat(row.total_amount)
    }));
  },

  async getNewUsers(filter: AnalyticsFilter): Promise<{ count: number }> {
    const whereClause = this.buildWhereClause(filter);
    const query = `SELECT COUNT(*) as count FROM users WHERE created_at >= NOW() - INTERVAL '30 days'`;
    const result = await db.query(query);
    return { count: parseInt(result.rows[0].count) };
  },

  async getUserRetention(filter: AnalyticsFilter): Promise<number> {
    // Calculate user retention rate - placeholder implementation
    return 85.2;
  },

  async getTopCompanies(filter: AnalyticsFilter): Promise<Array<{
    companyName: string;
    userCount: number;
    receiptCount: number;
  }>> {
    const query = `
      SELECT 
        c.name as company_name,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(r.id) as receipt_count
      FROM companies c
      LEFT JOIN users u ON c.id = u.company_id
      LEFT JOIN receipts r ON u.id = r.user_id
      GROUP BY c.id, c.name
      ORDER BY receipt_count DESC
      LIMIT 10
    `;
    const result = await db.query(query);
    return result.rows.map(row => ({
      companyName: row.company_name,
      userCount: parseInt(row.user_count),
      receiptCount: parseInt(row.receipt_count)
    }));
  },

  async getUserActivity(filter: AnalyticsFilter): Promise<Array<{
    date: string;
    activeUsers: number;
    newUsers: number;
  }>> {
    // Implementation for user activity over time
    return [];
  },

  async getSpendingByCategory(whereClause: string): Promise<Array<{
    category: string;
    amount: number;
    percentage: number;
  }>> {
    const query = `
      SELECT 
        category,
        COALESCE(SUM(amount), 0) as amount
      FROM receipts 
      WHERE ${whereClause}
      GROUP BY category
      ORDER BY amount DESC
    `;
    const result = await db.query(query);
    const total = result.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0);
    
    return result.rows.map(row => ({
      category: row.category,
      amount: parseFloat(row.amount),
      percentage: total > 0 ? (parseFloat(row.amount) / total) * 100 : 0
    }));
  },

  async getSpendingByCompany(whereClause: string): Promise<Array<{
    companyName: string;
    amount: number;
    percentage: number;
  }>> {
    const query = `
      SELECT 
        c.name as company_name,
        COALESCE(SUM(r.amount), 0) as amount
      FROM receipts r
      JOIN users u ON r.user_id = u.id
      JOIN companies c ON u.company_id = c.id
      WHERE ${whereClause}
      GROUP BY c.id, c.name
      ORDER BY amount DESC
    `;
    const result = await db.query(query);
    const total = result.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0);
    
    return result.rows.map(row => ({
      companyName: row.company_name,
      amount: parseFloat(row.amount),
      percentage: total > 0 ? (parseFloat(row.amount) / total) * 100 : 0
    }));
  },

  async getSpendingTrends(whereClause: string, groupBy: string): Promise<Array<{
    date: string;
    amount: number;
  }>> {
    const dateFormat = groupBy === 'month' ? 'YYYY-MM' : 
                      groupBy === 'week' ? 'YYYY-"W"WW' : 'YYYY-MM-DD';
    
    const query = `
      SELECT 
        TO_CHAR(created_at, '${dateFormat}') as date,
        COALESCE(SUM(amount), 0) as amount
      FROM receipts 
      WHERE ${whereClause}
      GROUP BY TO_CHAR(created_at, '${dateFormat}')
      ORDER BY date
    `;
    const result = await db.query(query);
    return result.rows.map(row => ({
      date: row.date,
      amount: parseFloat(row.amount)
    }));
  },

  // User-specific analytics methods
  async getUserAnalyticsSummary(userId: string, timeRange?: { start: Date; end: Date }): Promise<{
    totalReceipts: number;
    totalSpending: number;
    averagePerReceipt: number;
    topCategory: string;
    monthlyGrowth: number;
  }> {
    try {
      const cacheKey = `user:analytics:${userId}:${timeRange?.start || 'all'}:${timeRange?.end || 'all'}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      let whereClause = 'user_id = $1 AND deleted_at IS NULL';
      const params = [userId];

      if (timeRange) {
        whereClause += ' AND receipt_date >= $2 AND receipt_date <= $3';
        params.push(timeRange.start, timeRange.end);
      }

      const summaryQuery = `
        SELECT 
          COUNT(*) as total_receipts,
          COALESCE(SUM(total_amount), 0) as total_spending,
          COALESCE(AVG(total_amount), 0) as average_per_receipt
        FROM receipts 
        WHERE ${whereClause}
      `;

      const topCategoryQuery = `
        SELECT category, SUM(total_amount) as amount
        FROM receipts 
        WHERE ${whereClause} AND category IS NOT NULL
        GROUP BY category
        ORDER BY amount DESC
        LIMIT 1
      `;

      const [summaryResult, categoryResult] = await Promise.all([
        db.query(summaryQuery, params),
        db.query(topCategoryQuery, params)
      ]);

      const summary = summaryResult.rows[0];
      const topCategory = categoryResult.rows[0]?.category || 'Other';

      // Calculate monthly growth (placeholder - would need previous period data)
      const monthlyGrowth = 8.5;

      const result = {
        totalReceipts: parseInt(summary.total_receipts),
        totalSpending: parseFloat(summary.total_spending),
        averagePerReceipt: parseFloat(summary.average_per_receipt),
        topCategory,
        monthlyGrowth,
      };

      await redis.setex(cacheKey, 300, JSON.stringify(result));
      return result;

    } catch (error) {
      logger.error('Error getting user analytics summary:', error);
      throw error;
    }
  },

  async getUserExpensesByCategory(userId: string, timeRange?: { start: Date; end: Date }): Promise<Array<{
    category: string;
    amount: number;
    count: number;
    percentage: number;
  }>> {
    try {
      let whereClause = 'user_id = $1 AND deleted_at IS NULL';
      const params = [userId];

      if (timeRange) {
        whereClause += ' AND receipt_date >= $2 AND receipt_date <= $3';
        params.push(timeRange.start, timeRange.end);
      }

      const query = `
        WITH category_totals AS (
          SELECT 
            COALESCE(category, 'Other') as category,
            SUM(total_amount) as amount,
            COUNT(*) as count
          FROM receipts 
          WHERE ${whereClause}
          GROUP BY COALESCE(category, 'Other')
        ),
        grand_total AS (
          SELECT SUM(amount) as total FROM category_totals
        )
        SELECT 
          ct.category,
          ct.amount,
          ct.count,
          CASE 
            WHEN gt.total > 0 THEN (ct.amount / gt.total * 100)
            ELSE 0
          END as percentage
        FROM category_totals ct
        CROSS JOIN grand_total gt
        ORDER BY ct.amount DESC
      `;

      const result = await db.query(query, params);
      return result.rows.map(row => ({
        category: row.category,
        amount: parseFloat(row.amount),
        count: parseInt(row.count),
        percentage: parseFloat(row.percentage),
      }));

    } catch (error) {
      logger.error('Error getting user expenses by category:', error);
      throw error;
    }
  },

  async getUserBusinessInsights(userId: string, timeRange?: { start: Date; end: Date }): Promise<{
    taxDeductibleAmount: number;
    taxDeductiblePercentage: number;
    businessExpenses: Array<{ category: string; amount: number; percentage: number }>;
    complianceScore: number;
  }> {
    try {
      const businessCategories = [
        'Business', 'Office Supplies', 'Transportation', 'Travel', 
        'Entertainment', 'Professional Services', 'Equipment', 'Software'
      ];

      let whereClause = 'user_id = $1 AND deleted_at IS NULL';
      const params = [userId];

      if (timeRange) {
        whereClause += ' AND receipt_date >= $2 AND receipt_date <= $3';
        params.push(timeRange.start, timeRange.end);
      }

      const businessQuery = `
        SELECT 
          COALESCE(SUM(CASE WHEN category = ANY($${params.length + 1}) THEN total_amount ELSE 0 END), 0) as business_amount,
          COALESCE(SUM(total_amount), 0) as total_amount,
          COUNT(CASE WHEN category IS NULL OR category = '' THEN 1 END) as uncategorized_count,
          COUNT(*) as total_count
        FROM receipts 
        WHERE ${whereClause}
      `;

      const result = await db.query(businessQuery, [...params, businessCategories]);
      const data = result.rows[0];

      const businessAmount = parseFloat(data.business_amount);
      const totalAmount = parseFloat(data.total_amount);
      const uncategorizedCount = parseInt(data.uncategorized_count);
      const totalCount = parseInt(data.total_count);

      const taxDeductiblePercentage = totalAmount > 0 ? (businessAmount / totalAmount) * 100 : 0;
      const complianceScore = totalCount > 0 ? ((totalCount - uncategorizedCount) / totalCount) * 100 : 100;

      // Get business expenses breakdown
      const businessExpenses = await this.getUserExpensesByCategory(userId, timeRange);
      const businessBreakdown = businessExpenses.filter(exp => 
        businessCategories.includes(exp.category)
      );

      return {
        taxDeductibleAmount: businessAmount,
        taxDeductiblePercentage,
        businessExpenses: businessBreakdown,
        complianceScore,
      };

    } catch (error) {
      logger.error('Error getting user business insights:', error);
      throw error;
    }
  },

  async getUserSpendingTrends(userId: string, period: 'day' | 'week' | 'month' = 'day', timeRange?: { start: Date; end: Date }): Promise<Array<{
    date: string;
    amount: number;
    count: number;
  }>> {
    try {
      let whereClause = 'user_id = $1 AND deleted_at IS NULL';
      const params = [userId];

      if (timeRange) {
        whereClause += ' AND receipt_date >= $2 AND receipt_date <= $3';
        params.push(timeRange.start, timeRange.end);
      }

      const dateFormat = period === 'month' ? 'YYYY-MM' : 
                        period === 'week' ? 'YYYY-"W"WW' : 'YYYY-MM-DD';
      
      const query = `
        SELECT 
          TO_CHAR(receipt_date, '${dateFormat}') as date,
          COALESCE(SUM(total_amount), 0) as amount,
          COUNT(*) as count
        FROM receipts 
        WHERE ${whereClause}
        GROUP BY TO_CHAR(receipt_date, '${dateFormat}')
        ORDER BY date
      `;

      const result = await db.query(query, params);
      return result.rows.map(row => ({
        date: row.date,
        amount: parseFloat(row.amount),
        count: parseInt(row.count),
      }));

    } catch (error) {
      logger.error('Error getting user spending trends:', error);
      throw error;
    }
  },

  async getTopVendorsForUser(userId: string, timeRange?: { start: Date; end: Date }, limit: number = 10): Promise<Array<{
    vendorName: string;
    amount: number;
    count: number;
    lastVisit: Date;
  }>> {
    try {
      let whereClause = 'user_id = $1 AND deleted_at IS NULL AND vendor_name IS NOT NULL';
      const params = [userId];

      if (timeRange) {
        whereClause += ' AND receipt_date >= $2 AND receipt_date <= $3';
        params.push(timeRange.start, timeRange.end);
      }

      const query = `
        SELECT 
          vendor_name,
          SUM(total_amount) as amount,
          COUNT(*) as count,
          MAX(receipt_date) as last_visit
        FROM receipts 
        WHERE ${whereClause}
        GROUP BY vendor_name
        ORDER BY amount DESC
        LIMIT $${params.length + 1}
      `;

      const result = await db.query(query, [...params, limit]);
      return result.rows.map(row => ({
        vendorName: row.vendor_name,
        amount: parseFloat(row.amount),
        count: parseInt(row.count),
        lastVisit: new Date(row.last_visit),
      }));

    } catch (error) {
      logger.error('Error getting top vendors for user:', error);
      throw error;
    }
  }
};