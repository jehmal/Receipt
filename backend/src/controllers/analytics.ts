import { FastifyRequest, FastifyReply } from 'fastify';
import { analyticsService } from '@/services/analytics';
import { logger } from '@/utils/logger';

interface AnalyticsQuery {
  startDate?: string;
  endDate?: string;
  period?: 'day' | 'week' | 'month';
  category?: string;
  limit?: number;
}

interface TimeRangeQuery {
  start?: string;
  end?: string;
}

export const analyticsController = {
  /**
   * Get user analytics summary
   */
  async getUserSummary(request: FastifyRequest<{ Querystring: TimeRangeQuery }>, reply: FastifyReply) {
    try {
      const userId = request.user.id;
      const { start, end } = request.query;

      const timeRange = start && end ? {
        start: new Date(start),
        end: new Date(end)
      } : undefined;

      const summary = await analyticsService.getUserAnalyticsSummary(userId, timeRange);

      reply.status(200).send({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error getting user analytics summary:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get analytics summary'
      });
    }
  },

  /**
   * Get user expenses by category
   */
  async getUserExpensesByCategory(request: FastifyRequest<{ Querystring: TimeRangeQuery }>, reply: FastifyReply) {
    try {
      const userId = request.user.id;
      const { start, end } = request.query;

      const timeRange = start && end ? {
        start: new Date(start),
        end: new Date(end)
      } : undefined;

      const expenses = await analyticsService.getUserExpensesByCategory(userId, timeRange);

      reply.status(200).send({
        success: true,
        data: expenses
      });
    } catch (error) {
      logger.error('Error getting user expenses by category:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get expenses by category'
      });
    }
  },

  /**
   * Get user spending trends
   */
  async getUserSpendingTrends(request: FastifyRequest<{ 
    Querystring: TimeRangeQuery & { period?: 'day' | 'week' | 'month' }
  }>, reply: FastifyReply) {
    try {
      const userId = request.user.id;
      const { start, end, period = 'day' } = request.query;

      const timeRange = start && end ? {
        start: new Date(start),
        end: new Date(end)
      } : undefined;

      const trends = await analyticsService.getUserSpendingTrends(userId, period, timeRange);

      reply.status(200).send({
        success: true,
        data: trends
      });
    } catch (error) {
      logger.error('Error getting user spending trends:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get spending trends'
      });
    }
  },

  /**
   * Get user business insights
   */
  async getUserBusinessInsights(request: FastifyRequest<{ Querystring: TimeRangeQuery }>, reply: FastifyReply) {
    try {
      const userId = request.user.id;
      const { start, end } = request.query;

      const timeRange = start && end ? {
        start: new Date(start),
        end: new Date(end)
      } : undefined;

      const insights = await analyticsService.getUserBusinessInsights(userId, timeRange);

      reply.status(200).send({
        success: true,
        data: insights
      });
    } catch (error) {
      logger.error('Error getting user business insights:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get business insights'
      });
    }
  },

  /**
   * Get top vendors for user
   */
  async getTopVendors(request: FastifyRequest<{ 
    Querystring: TimeRangeQuery & { limit?: number }
  }>, reply: FastifyReply) {
    try {
      const userId = request.user.id;
      const { start, end, limit = 10 } = request.query;

      const timeRange = start && end ? {
        start: new Date(start),
        end: new Date(end)
      } : undefined;

      const vendors = await analyticsService.getTopVendorsForUser(userId, timeRange, limit);

      reply.status(200).send({
        success: true,
        data: vendors
      });
    } catch (error) {
      logger.error('Error getting top vendors:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get top vendors'
      });
    }
  },

  /**
   * Get comprehensive analytics dashboard data
   */
  async getDashboardData(request: FastifyRequest<{ Querystring: TimeRangeQuery }>, reply: FastifyReply) {
    try {
      const userId = request.user.id;
      const { start, end } = request.query;

      const timeRange = start && end ? {
        start: new Date(start),
        end: new Date(end)
      } : undefined;

      // Get all analytics data in parallel
      const [
        summary,
        expensesByCategory,
        spendingTrends,
        businessInsights,
        topVendors
      ] = await Promise.all([
        analyticsService.getUserAnalyticsSummary(userId, timeRange),
        analyticsService.getUserExpensesByCategory(userId, timeRange),
        analyticsService.getUserSpendingTrends(userId, 'day', timeRange),
        analyticsService.getUserBusinessInsights(userId, timeRange),
        analyticsService.getTopVendorsForUser(userId, timeRange, 5)
      ]);

      reply.status(200).send({
        success: true,
        data: {
          summary,
          expensesByCategory,
          spendingTrends,
          businessInsights,
          topVendors,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error getting dashboard data:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get dashboard data'
      });
    }
  },

  /**
   * Export analytics data
   */
  async exportData(request: FastifyRequest<{ 
    Querystring: TimeRangeQuery & { format?: 'csv' | 'json' | 'pdf' }
  }>, reply: FastifyReply) {
    try {
      const userId = request.user.id;
      const { start, end, format = 'csv' } = request.query;

      const timeRange = start && end ? {
        start: new Date(start),
        end: new Date(end)
      } : undefined;

      // Get comprehensive analytics data
      const [
        summary,
        expensesByCategory,
        spendingTrends,
        businessInsights,
        topVendors
      ] = await Promise.all([
        analyticsService.getUserAnalyticsSummary(userId, timeRange),
        analyticsService.getUserExpensesByCategory(userId, timeRange),
        analyticsService.getUserSpendingTrends(userId, 'day', timeRange),
        analyticsService.getUserBusinessInsights(userId, timeRange),
        analyticsService.getTopVendorsForUser(userId, timeRange, 20)
      ]);

      const exportData = {
        summary,
        expensesByCategory,
        spendingTrends,
        businessInsights,
        topVendors,
        timeRange,
        exportedAt: new Date().toISOString(),
        userId
      };

      if (format === 'csv') {
        const csvData = convertToCSV(exportData);
        const timestamp = new Date().toISOString().split('T')[0];
        
        reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename="analytics-${timestamp}.csv"`)
          .send(csvData);
      } else if (format === 'json') {
        const timestamp = new Date().toISOString().split('T')[0];
        
        reply
          .header('Content-Type', 'application/json')
          .header('Content-Disposition', `attachment; filename="analytics-${timestamp}.json"`)
          .send(exportData);
      } else {
        reply.status(400).send({
          success: false,
          error: 'Unsupported export format'
        });
      }
    } catch (error) {
      logger.error('Error exporting analytics data:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to export data'
      });
    }
  },

  // Admin analytics endpoints (existing functionality)
  async getOverviewMetrics(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    try {
      const { startDate, endDate, companyId } = request.query;
      
      const filter = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        companyId
      };

      const metrics = await analyticsService.getOverviewMetrics(filter);
      
      reply.status(200).send({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error getting overview metrics:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get overview metrics'
      });
    }
  },

  async getReceiptAnalytics(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    try {
      const { startDate, endDate, companyId, groupBy } = request.query;
      
      const filter = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        companyId,
        groupBy
      };

      const analytics = await analyticsService.getReceiptAnalytics(filter);
      
      reply.status(200).send({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error getting receipt analytics:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get receipt analytics'
      });
    }
  },

  async getUserAnalytics(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    try {
      const { startDate, endDate, companyId } = request.query;
      
      const filter = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        companyId
      };

      const analytics = await analyticsService.getUserAnalytics(filter);
      
      reply.status(200).send({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error getting user analytics:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get user analytics'
      });
    }
  },

  async getSpendingAnalytics(request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) {
    try {
      const { startDate, endDate, companyId, groupBy } = request.query;
      
      const filter = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        companyId,
        groupBy
      };

      const analytics = await analyticsService.getSpendingAnalytics(filter);
      
      reply.status(200).send({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error getting spending analytics:', error);
      reply.status(500).send({
        success: false,
        error: 'Failed to get spending analytics'
      });
    }
  }
};

// Helper function to convert data to CSV format
function convertToCSV(data: any): string {
  const lines = [];
  
  // Summary section
  lines.push('=== ANALYTICS SUMMARY ===');
  lines.push(`Generated At,${data.exportedAt}`);
  lines.push(`Total Receipts,${data.summary.totalReceipts}`);
  lines.push(`Total Spending,${data.summary.totalSpending}`);
  lines.push(`Average per Receipt,${data.summary.averagePerReceipt}`);
  lines.push(`Top Category,${data.summary.topCategory}`);
  lines.push(`Monthly Growth,${data.summary.monthlyGrowth}%`);
  lines.push('');
  
  // Expenses by category
  lines.push('=== EXPENSES BY CATEGORY ===');
  lines.push('Category,Amount,Count,Percentage');
  data.expensesByCategory.forEach((cat: any) => {
    lines.push(`${cat.category},${cat.amount},${cat.count},${cat.percentage.toFixed(2)}%`);
  });
  lines.push('');
  
  // Business insights
  lines.push('=== BUSINESS INSIGHTS ===');
  lines.push(`Tax Deductible Amount,${data.businessInsights.taxDeductibleAmount}`);
  lines.push(`Tax Deductible Percentage,${data.businessInsights.taxDeductiblePercentage.toFixed(2)}%`);
  lines.push(`Compliance Score,${data.businessInsights.complianceScore.toFixed(2)}%`);
  lines.push('');
  
  // Top vendors
  lines.push('=== TOP VENDORS ===');
  lines.push('Vendor,Amount,Count,Last Visit');
  data.topVendors.forEach((vendor: any) => {
    lines.push(`${vendor.vendorName},${vendor.amount},${vendor.count},${vendor.lastVisit}`);
  });
  lines.push('');
  
  // Spending trends
  lines.push('=== SPENDING TRENDS ===');
  lines.push('Date,Amount,Count');
  data.spendingTrends.forEach((trend: any) => {
    lines.push(`${trend.date},${trend.amount},${trend.count}`);
  });
  
  return lines.join('\n');
}