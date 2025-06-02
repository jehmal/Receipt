import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { analyticsController } from '@/controllers/analytics';
import { requireAuth } from '@/middleware/auth';

interface TimeRangeQuery {
  start?: string;
  end?: string;
}

interface AnalyticsQuery extends TimeRangeQuery {
  period?: 'day' | 'week' | 'month';
  limit?: number;
  format?: 'csv' | 'json' | 'pdf';
}

interface AdminAnalyticsQuery {
  startDate?: string;
  endDate?: string;
  companyId?: string;
  groupBy?: string;
  categoryId?: string;
}

export default async function analyticsRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth);

  // User analytics endpoints
  fastify.get('/user/summary', {
    schema: {
      description: 'Get user analytics summary',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          start: { type: 'string', format: 'date' },
          end: { type: 'string', format: 'date' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalReceipts: { type: 'number' },
                totalSpending: { type: 'number' },
                averagePerReceipt: { type: 'number' },
                topCategory: { type: 'string' },
                monthlyGrowth: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: TimeRangeQuery }>, reply: FastifyReply) => {
    return analyticsController.getUserSummary(request, reply);
  });

  fastify.get('/user/categories', {
    schema: {
      description: 'Get user expenses by category',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          start: { type: 'string', format: 'date' },
          end: { type: 'string', format: 'date' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  category: { type: 'string' },
                  amount: { type: 'number' },
                  count: { type: 'number' },
                  percentage: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: TimeRangeQuery }>, reply: FastifyReply) => {
    return analyticsController.getUserExpensesByCategory(request, reply);
  });

  fastify.get('/user/trends', {
    schema: {
      description: 'Get user spending trends',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          start: { type: 'string', format: 'date' },
          end: { type: 'string', format: 'date' },
          period: { type: 'string', enum: ['day', 'week', 'month'], default: 'day' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  amount: { type: 'number' },
                  count: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Querystring: TimeRangeQuery & { period?: 'day' | 'week' | 'month' }
  }>, reply: FastifyReply) => {
    return analyticsController.getUserSpendingTrends(request, reply);
  });

  fastify.get('/user/business-insights', {
    schema: {
      description: 'Get user business insights for tax purposes',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          start: { type: 'string', format: 'date' },
          end: { type: 'string', format: 'date' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                taxDeductibleAmount: { type: 'number' },
                taxDeductiblePercentage: { type: 'number' },
                businessExpenses: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      category: { type: 'string' },
                      amount: { type: 'number' },
                      percentage: { type: 'number' }
                    }
                  }
                },
                complianceScore: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: TimeRangeQuery }>, reply: FastifyReply) => {
    return analyticsController.getUserBusinessInsights(request, reply);
  });

  fastify.get('/user/vendors', {
    schema: {
      description: 'Get top vendors for user',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          start: { type: 'string', format: 'date' },
          end: { type: 'string', format: 'date' },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 10 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  vendorName: { type: 'string' },
                  amount: { type: 'number' },
                  count: { type: 'number' },
                  lastVisit: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Querystring: TimeRangeQuery & { limit?: number }
  }>, reply: FastifyReply) => {
    return analyticsController.getTopVendors(request, reply);
  });

  fastify.get('/user/dashboard', {
    schema: {
      description: 'Get comprehensive dashboard data for user',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          start: { type: 'string', format: 'date' },
          end: { type: 'string', format: 'date' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                summary: { type: 'object' },
                expensesByCategory: { type: 'array' },
                spendingTrends: { type: 'array' },
                businessInsights: { type: 'object' },
                topVendors: { type: 'array' },
                generatedAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: TimeRangeQuery }>, reply: FastifyReply) => {
    return analyticsController.getDashboardData(request, reply);
  });

  fastify.get('/user/export', {
    schema: {
      description: 'Export user analytics data',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          start: { type: 'string', format: 'date' },
          end: { type: 'string', format: 'date' },
          format: { type: 'string', enum: ['csv', 'json'], default: 'csv' }
        }
      },
      response: {
        200: {
          description: 'File download'
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Querystring: TimeRangeQuery & { format?: 'csv' | 'json' | 'pdf' }
  }>, reply: FastifyReply) => {
    return analyticsController.exportData(request, reply);
  });

  // Admin analytics endpoints (existing functionality)
  fastify.get('/admin/overview', {
    schema: {
      description: 'Get system overview metrics (admin only)',
      tags: ['Admin Analytics'],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          companyId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: AdminAnalyticsQuery }>, reply: FastifyReply) => {
    // TODO: Add admin role check
    return analyticsController.getOverviewMetrics(request, reply);
  });

  fastify.get('/admin/receipts', {
    schema: {
      description: 'Get receipt analytics (admin only)',
      tags: ['Admin Analytics'],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          companyId: { type: 'string', format: 'uuid' },
          groupBy: { type: 'string', enum: ['day', 'week', 'month'] }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: AdminAnalyticsQuery }>, reply: FastifyReply) => {
    // TODO: Add admin role check
    return analyticsController.getReceiptAnalytics(request, reply);
  });

  fastify.get('/admin/users', {
    schema: {
      description: 'Get user analytics (admin only)',
      tags: ['Admin Analytics'],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          companyId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: AdminAnalyticsQuery }>, reply: FastifyReply) => {
    // TODO: Add admin role check
    return analyticsController.getUserAnalytics(request, reply);
  });

  fastify.get('/admin/spending', {
    schema: {
      description: 'Get spending analytics (admin only)',
      tags: ['Admin Analytics'],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          companyId: { type: 'string', format: 'uuid' },
          groupBy: { type: 'string', enum: ['day', 'week', 'month'] }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: AdminAnalyticsQuery }>, reply: FastifyReply) => {
    // TODO: Add admin role check
    return analyticsController.getSpendingAnalytics(request, reply);
  });
}