import { FastifyRequest, FastifyReply } from 'fastify';
import { analyticsService } from '../../services/analytics';
import { systemMetricsService } from '../../services/system-metrics';
import { logger } from '../../utils/logger';
import { AnalyticsFilter, SystemMetricsFilter } from '../../types/analytics';

interface AnalyticsQueryParams {
  startDate?: string;
  endDate?: string;
  companyId?: string;
  groupBy?: string;
  categoryId?: string;
}

interface SystemMetricsQuery {
  metric?: string;
  timeRange?: string;
}

export const adminAnalyticsController = {
  async getOverview(
    request: FastifyRequest<{ Querystring: AnalyticsQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { startDate, endDate, companyId } = request.query;
      
      const filter: AnalyticsFilter = {};
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);
      if (companyId) filter.companyId = companyId;
      
      const overview = await analyticsService.getOverviewMetrics(filter);

      return reply.send({
        success: true,
        data: overview
      });
    } catch (error) {
      logger.error('Error getting admin overview:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get overview metrics'
      });
    }
  },

  async getReceiptAnalytics(
    request: FastifyRequest<{ Querystring: AnalyticsQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { startDate, endDate, companyId, groupBy = 'day' } = request.query;

      const filter: AnalyticsFilter = {};
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);
      if (companyId) filter.companyId = companyId;
      if (groupBy) filter.groupBy = groupBy;
      
      const analytics = await analyticsService.getReceiptAnalytics(filter);

      return reply.send({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error getting receipt analytics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get receipt analytics'
      });
    }
  },

  async getUserAnalytics(
    request: FastifyRequest<{ Querystring: AnalyticsQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { startDate, endDate, companyId } = request.query;

      const filter: AnalyticsFilter = {};
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);
      if (companyId) filter.companyId = companyId;
      
      const analytics = await analyticsService.getUserAnalytics(filter);

      return reply.send({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error getting user analytics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get user analytics'
      });
    }
  },

  async getSpendingAnalytics(
    request: FastifyRequest<{ Querystring: AnalyticsQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { startDate, endDate, companyId, categoryId } = request.query;

      const filter: AnalyticsFilter = {};
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);
      if (companyId) filter.companyId = companyId;
      if (categoryId) filter.categoryId = categoryId;
      
      const analytics = await analyticsService.getSpendingAnalytics(filter);

      return reply.send({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error getting spending analytics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get spending analytics'
      });
    }
  },

  async getSystemHealth(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const health = await systemMetricsService.getSystemHealth();

      return reply.send({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Error getting system health:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get system health'
      });
    }
  },

  async getSystemMetrics(
    request: FastifyRequest<{ Querystring: SystemMetricsQuery }>,
    reply: FastifyReply
  ) {
    try {
      const { metric, timeRange = '24h' } = request.query;

      const filter: SystemMetricsFilter = {};
      if (metric) filter.metric = metric;
      if (timeRange) filter.timeRange = timeRange;
      
      const metrics = await systemMetricsService.getMetrics(filter);

      return reply.send({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error getting system metrics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get system metrics'
      });
    }
  }
};