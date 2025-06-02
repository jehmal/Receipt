import { FastifyPluginAsync } from 'fastify';
import { searchService } from '../services/search';
import { db } from '../database/connection';

const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // Advanced receipt search
  fastify.post('/receipts', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          // Search query
          query: { type: 'string', maxLength: 500 },
          
          // Basic filters
          category: { type: 'string', maxLength: 100 },
          tags: { 
            type: 'array', 
            items: { type: 'string' },
            maxItems: 10
          },
          
          // Date filters
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          
          // Amount filters
          amountMin: { type: 'number', minimum: 0 },
          amountMax: { type: 'number', minimum: 0 },
          
          // Merchant filters
          merchantName: { type: 'string', maxLength: 255 },
          
          // Payment and status filters
          paymentMethod: { type: 'string', maxLength: 50 },
          status: { 
            type: 'string', 
            enum: ['uploaded', 'processing', 'processed', 'failed'] 
          },
          
          // Business filters
          project: { type: 'string', maxLength: 50 },
          department: { type: 'string', maxLength: 100 },
          costCenter: { type: 'string', maxLength: 50 },
          
          // Approval filters
          requiresApproval: { type: 'boolean' },
          approvedBy: { type: 'string', format: 'uuid' },
          
          // File filters
          hasAttachment: { type: 'boolean' },
          
          // Search options
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          sortBy: { 
            type: 'string', 
            enum: ['relevance', 'date', 'amount', 'merchant', 'created'],
            default: 'relevance'
          },
          sortOrder: { 
            type: 'string', 
            enum: ['asc', 'desc'],
            default: 'desc'
          },
          facets: {
            type: 'array',
            items: { 
              type: 'string',
              enum: ['category', 'merchant', 'paymentMethod', 'status', 'department']
            },
            maxItems: 5
          },
          highlight: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const searchParams = request.body as any;

      // Convert date strings to Date objects
      const filters = {
        userId: user.id,
        companyId: user.companyId,
        query: searchParams.query,
        category: searchParams.category,
        tags: searchParams.tags,
        dateFrom: searchParams.dateFrom ? new Date(searchParams.dateFrom) : undefined,
        dateTo: searchParams.dateTo ? new Date(searchParams.dateTo) : undefined,
        amountMin: searchParams.amountMin,
        amountMax: searchParams.amountMax,
        merchantName: searchParams.merchantName,
        paymentMethod: searchParams.paymentMethod,
        status: searchParams.status,
        hasAttachment: searchParams.hasAttachment,
        requiresApproval: searchParams.requiresApproval,
        approvedBy: searchParams.approvedBy,
        project: searchParams.project,
        department: searchParams.department,
        costCenter: searchParams.costCenter
      };

      const options = {
        page: searchParams.page,
        limit: searchParams.limit,
        sortBy: searchParams.sortBy,
        sortOrder: searchParams.sortOrder,
        facets: searchParams.facets,
        highlight: searchParams.highlight
      };

      const results = await searchService.searchReceipts(filters, options);

      reply.send({
        success: true,
        data: results
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: error.message || 'Search failed'
      });
    }
  });

  // Quick search endpoint for autocomplete
  fastify.get('/quick', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 1, maxLength: 100 },
          type: { 
            type: 'string',
            enum: ['all', 'merchants', 'categories', 'tags'],
            default: 'all'
          },
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { q, type, limit } = request.query as any;

      let suggestions = [];

      if (type === 'all' || type === 'merchants') {
        const merchantQuery = await db.query(
          `SELECT DISTINCT vendor_name as suggestion, 'merchant' as type
           FROM receipts 
           WHERE user_id = $1 AND vendor_name ILIKE $2 AND deleted_at IS NULL
           ORDER BY vendor_name
           LIMIT $3`,
          [user.id, `%${q}%`, Math.floor(limit / 2)]
        );
        suggestions.push(...merchantQuery.rows);
      }

      if (type === 'all' || type === 'categories') {
        const categoryQuery = await db.query(
          `SELECT DISTINCT category as suggestion, 'category' as type
           FROM receipts 
           WHERE user_id = $1 AND category ILIKE $2 AND deleted_at IS NULL
           ORDER BY category
           LIMIT $3`,
          [user.id, `%${q}%`, Math.floor(limit / 2)]
        );
        suggestions.push(...categoryQuery.rows);
      }

      if (type === 'all' || type === 'tags') {
        // Search in tags array
        const tagQuery = await db.query(
          `SELECT DISTINCT unnest(tags) as suggestion, 'tag' as type
           FROM receipts 
           WHERE user_id = $1 AND $2 = ANY(tags) AND deleted_at IS NULL
           ORDER BY suggestion
           LIMIT $3`,
          [user.id, q, Math.floor(limit / 2)]
        );
        suggestions.push(...tagQuery.rows);
      }

      reply.send({
        success: true,
        data: {
          suggestions: suggestions.slice(0, limit),
          query: q
        }
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: error.message || 'Quick search failed'
      });
    }
  });

  // Save search for future use
  fastify.post('/saved', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'filters'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          filters: { type: 'object' },
          options: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { name, filters, options = {} } = request.body as any;

      // Add user context to filters
      const searchFilters = {
        ...filters,
        userId: user.id,
        companyId: user.companyId
      };

      const savedSearch = await searchService.saveSearch(
        user.id,
        name,
        searchFilters,
        options
      );

      reply.code(201).send({
        success: true,
        message: 'Search saved successfully',
        data: savedSearch
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        message: error.message || 'Failed to save search'
      });
    }
  });

  // Get saved searches
  fastify.get('/saved', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const savedSearches = await searchService.getSavedSearches(user.id);

      reply.send({
        success: true,
        data: savedSearches
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get saved searches'
      });
    }
  });

  // Delete saved search
  fastify.delete('/saved/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { id } = request.params as any;

      await searchService.deleteSavedSearch(user.id, id);

      reply.send({
        success: true,
        message: 'Saved search deleted successfully'
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: error.message || 'Failed to delete saved search'
      });
    }
  });

  // Get search analytics and insights
  fastify.get('/analytics', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const analytics = await searchService.getSearchAnalytics(user.id, user.companyId);

      reply.send({
        success: true,
        data: analytics
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get search analytics'
      });
    }
  });

  // Advanced faceted search - for when users want to explore data
  fastify.get('/facets', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          facets: {
            type: 'string', // comma-separated list
            default: 'category,merchant,paymentMethod,status'
          },
          query: { type: 'string' },
          category: { type: 'string' },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const query = request.query as any;

      const filters = {
        userId: user.id,
        companyId: user.companyId,
        query: query.query,
        category: query.category,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined
      };

      const options = {
        facets: query.facets.split(','),
        limit: 0 // We only want facets, not results
      };

      const results = await searchService.searchReceipts(filters, options);

      reply.send({
        success: true,
        data: {
          facets: results.facets,
          total: results.pagination.total
        }
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        message: error.message || 'Failed to get facets'
      });
    }
  });

  // Semantic search (future enhancement)
  fastify.post('/semantic', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
          threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.7 },
        },
      },
    },
  }, async (request, reply) => {
    // TODO: Implement semantic search with vector embeddings
    reply.status(501).send({ 
      success: false,
      message: 'Semantic search endpoint not implemented yet' 
    });
  });

  // Visual search (future enhancement)
  fastify.post('/visual', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    // TODO: Implement visual search using image similarity
    reply.status(501).send({ 
      success: false,
      message: 'Visual search endpoint not implemented yet' 
    });
  });
};

export default searchRoutes;