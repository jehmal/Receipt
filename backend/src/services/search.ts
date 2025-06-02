import { db } from '@/database/connection';
import { redis as redisClient } from '@/config/redis';
import { elasticsearchService, type ElasticsearchSearchOptions } from './elasticsearch';
import { logger } from '@/utils/logger';

export interface SearchFilters {
  userId: string;
  companyId?: string;
  query?: string;
  category?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  merchantName?: string;
  paymentMethod?: string;
  status?: string;
  hasAttachment?: boolean;
  requiresApproval?: boolean;
  approvedBy?: string;
  project?: string;
  department?: string;
  costCenter?: string;
}

export interface SearchOptions {
  page?: number;
  limit?: number;
  sortBy?: 'relevance' | 'date' | 'amount' | 'merchant' | 'created';
  sortOrder?: 'asc' | 'desc';
  facets?: string[];
  highlight?: boolean;
}

export interface SearchResult {
  id: string;
  originalFilename: string;
  fileUrl?: string;
  thumbnailUrl?: string;
  merchantName?: string;
  totalAmount?: number;
  currency?: string;
  receiptDate?: Date;
  category?: string;
  subcategory?: string;
  tags?: string[];
  description?: string;
  notes?: string;
  paymentMethod?: string;
  status: string;
  ocrText?: string;
  ocrConfidence?: number;
  projectCode?: string;
  department?: string;
  costCenter?: string;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  relevanceScore?: number;
  highlights?: {
    field: string;
    snippet: string;
  }[];
}

export interface SearchResponse {
  results: SearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  facets?: {
    [key: string]: Array<{ value: string; count: number }>;
  };
  suggestions?: string[];
  queryTime: number;
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  filters: SearchFilters;
  options: SearchOptions;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class SearchService {
  private useElasticsearch = true;

  async searchReceipts(filters: SearchFilters, options: SearchOptions = {}): Promise<SearchResponse> {
    const startTime = Date.now();
    
    const {
      page = 1,
      limit = 20,
      sortBy = 'relevance',
      sortOrder = 'desc',
      facets = [],
      highlight = false
    } = options;

    // Check cache for popular searches
    const cacheKey = this.generateCacheKey(filters, options);
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      const result = JSON.parse(cached);
      result.queryTime = Date.now() - startTime;
      return result;
    }

    let response: SearchResponse;

    try {
      // Try Elasticsearch first for better search capabilities
      if (this.useElasticsearch && filters.query) {
        response = await this.searchWithElasticsearch(filters, options);
      } else {
        // Fallback to PostgreSQL for non-text searches or when ES is unavailable
        response = await this.searchWithPostgreSQL(filters, options);
      }
    } catch (elasticsearchError) {
      logger.warn('Elasticsearch search failed, falling back to PostgreSQL:', elasticsearchError);
      this.useElasticsearch = false;
      response = await this.searchWithPostgreSQL(filters, options);
    }

    response.queryTime = Date.now() - startTime;

    // Cache results for 5 minutes for popular searches
    if (response.results.length > 0) {
      await redisClient.setex(cacheKey, 300, JSON.stringify(response));
    }

    return response;
  }

  /**
   * Enhanced search using Elasticsearch
   */
  private async searchWithElasticsearch(filters: SearchFilters, options: SearchOptions): Promise<SearchResponse> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'relevance',
      sortOrder = 'desc',
      facets = [],
      highlight = false
    } = options;

    // Convert filters to Elasticsearch format
    const esOptions: ElasticsearchSearchOptions = {
      query: filters.query,
      filters: {
        userId: filters.userId,
        companyId: filters.companyId,
        category: filters.category ? [filters.category] : undefined,
        tags: filters.tags,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
        amountMin: filters.amountMin,
        amountMax: filters.amountMax,
        vendorName: filters.merchantName,
        paymentMethod: filters.paymentMethod ? [filters.paymentMethod] : undefined,
        status: filters.status ? [filters.status] : undefined,
        department: filters.department ? [filters.department] : undefined,
        requiresApproval: filters.requiresApproval
      },
      pagination: {
        page,
        size: limit
      },
      sorting: {
        field: sortBy === 'merchant' ? 'vendor' : sortBy,
        order: sortOrder
      },
      aggregations: facets,
      highlight
    };

    const esResult = await elasticsearchService.searchReceipts(esOptions);

    // Convert Elasticsearch results to our format
    const results: SearchResult[] = esResult.hits.documents.map(doc => ({
      id: doc.id,
      originalFilename: doc.source.originalFilename,
      fileUrl: doc.source.originalFilename ? `/uploads/receipts/${doc.source.originalFilename}` : undefined,
      thumbnailUrl: doc.source.originalFilename ? `/uploads/thumbnails/${doc.source.originalFilename}` : undefined,
      merchantName: doc.source.vendorName,
      totalAmount: doc.source.totalAmount,
      currency: doc.source.currency,
      receiptDate: doc.source.receiptDate ? new Date(doc.source.receiptDate) : undefined,
      category: doc.source.category,
      subcategory: doc.source.subcategory,
      tags: doc.source.tags,
      description: doc.source.description,
      notes: doc.source.notes,
      paymentMethod: doc.source.paymentMethod,
      status: doc.source.status,
      ocrText: doc.source.ocrText,
      ocrConfidence: doc.source.ocrConfidence,
      projectCode: doc.source.projectCode,
      department: doc.source.department,
      costCenter: doc.source.costCenter,
      requiresApproval: doc.source.requiresApproval,
      approvedBy: doc.source.approvedBy,
      approvedAt: doc.source.approvedAt ? new Date(doc.source.approvedAt) : undefined,
      createdAt: new Date(doc.source.createdAt),
      updatedAt: new Date(doc.source.updatedAt),
      relevanceScore: doc.score,
      highlights: doc.highlights ? this.convertESHighlights(doc.highlights) : undefined
    }));

    // Convert aggregations to facets
    const facetsData = esResult.aggregations ? this.convertESAggregations(esResult.aggregations) : undefined;

    return {
      results,
      pagination: {
        page,
        limit,
        total: esResult.hits.total,
        totalPages: Math.ceil(esResult.hits.total / limit)
      },
      facets: facetsData,
      suggestions: esResult.suggestions,
      queryTime: esResult.queryTime
    };
  }

  /**
   * Fallback search using PostgreSQL
   */
  private async searchWithPostgreSQL(filters: SearchFilters, options: SearchOptions): Promise<SearchResponse> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'relevance',
      sortOrder = 'desc',
      facets = [],
      highlight = false
    } = options;

    // Build search query
    const query = this.buildSearchQuery(filters, options);
    
    // Execute search
    const [resultsQuery, countQuery] = await Promise.all([
      db.query(query.sql, query.params),
      db.query(query.countSql, query.countParams)
    ]);

    const total = parseInt(countQuery.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    // Process results
    const results = resultsQuery.rows.map(row => this.processSearchResult(row, highlight));

    // Build facets if requested
    const facetsData = facets.length > 0 ? await this.buildFacets(filters, facets) : undefined;

    // Generate suggestions for empty results
    const suggestions = results.length === 0 && filters.query ? 
      await this.generateSuggestions(filters.query) : undefined;

    return {
      results,
      pagination: {
        page,
        limit,
        total,
        totalPages
      },
      facets: facetsData,
      suggestions,
      queryTime: 0 // Will be set by caller
    };
  }

  /**
   * Convert Elasticsearch highlights to our format
   */
  private convertESHighlights(esHighlights: { [field: string]: string[] }): Array<{ field: string; snippet: string }> {
    const highlights: Array<{ field: string; snippet: string }> = [];
    
    Object.entries(esHighlights).forEach(([field, snippets]) => {
      highlights.push({
        field: field === 'vendorName' ? 'merchantName' : field,
        snippet: snippets[0] || ''
      });
    });

    return highlights;
  }

  /**
   * Convert Elasticsearch aggregations to our facets format
   */
  private convertESAggregations(esAggs: any): { [key: string]: Array<{ value: string; count: number }> } {
    const facets: { [key: string]: Array<{ value: string; count: number }> } = {};
    
    if (esAggs.categories) {
      facets.category = esAggs.categories.buckets.map((bucket: any) => ({
        value: bucket.key,
        count: bucket.doc_count
      }));
    }

    if (esAggs.vendors) {
      facets.merchant = esAggs.vendors.buckets.map((bucket: any) => ({
        value: bucket.key,
        count: bucket.doc_count
      }));
    }

    if (esAggs.paymentMethods) {
      facets.paymentMethod = esAggs.paymentMethods.buckets.map((bucket: any) => ({
        value: bucket.key,
        count: bucket.doc_count
      }));
    }

    if (esAggs.statuses) {
      facets.status = esAggs.statuses.buckets.map((bucket: any) => ({
        value: bucket.key,
        count: bucket.doc_count
      }));
    }

    if (esAggs.departments) {
      facets.department = esAggs.departments.buckets.map((bucket: any) => ({
        value: bucket.key,
        count: bucket.doc_count
      }));
    }

    if (esAggs.amountRanges) {
      facets.amountRange = esAggs.amountRanges.buckets.map((bucket: any) => ({
        value: bucket.key,
        count: bucket.doc_count
      }));
    }

    return facets;
  }

  /**
   * Index receipt in Elasticsearch when created/updated
   */
  async indexReceiptInElasticsearch(receiptData: any): Promise<void> {
    try {
      if (!this.useElasticsearch) return;

      const esDocument = {
        id: receiptData.id,
        userId: receiptData.user_id,
        companyId: receiptData.company_id,
        originalFilename: receiptData.original_filename,
        vendorName: receiptData.vendor_name,
        totalAmount: receiptData.total_amount ? parseFloat(receiptData.total_amount) : undefined,
        currency: receiptData.currency,
        receiptDate: receiptData.receipt_date,
        category: receiptData.category,
        subcategory: receiptData.subcategory,
        tags: receiptData.tags || [],
        description: receiptData.description,
        notes: receiptData.notes,
        paymentMethod: receiptData.payment_method,
        status: receiptData.status,
        ocrText: receiptData.ocr_text,
        ocrConfidence: receiptData.ocr_confidence,
        projectCode: receiptData.project_code,
        department: receiptData.department,
        costCenter: receiptData.cost_center,
        requiresApproval: receiptData.requires_approval || false,
        approvedBy: receiptData.approved_by,
        approvedAt: receiptData.approved_at,
        createdAt: receiptData.created_at,
        updatedAt: receiptData.updated_at,
        businessType: receiptData.structured_data?.businessType,
        extractedItems: receiptData.structured_data?.items || []
      };

      await elasticsearchService.indexReceipt(esDocument);
    } catch (error) {
      logger.error('Failed to index receipt in Elasticsearch:', error);
      // Don't fail the operation if Elasticsearch indexing fails
    }
  }

  /**
   * Remove receipt from Elasticsearch when deleted
   */
  async removeReceiptFromElasticsearch(receiptId: string): Promise<void> {
    try {
      if (!this.useElasticsearch) return;
      await elasticsearchService.deleteReceipt(receiptId);
    } catch (error) {
      logger.error('Failed to remove receipt from Elasticsearch:', error);
      // Don't fail the operation if Elasticsearch removal fails
    }
  }

  private buildSearchQuery(filters: SearchFilters, options: SearchOptions) {
    const {
      userId,
      companyId,
      query,
      category,
      tags,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
      merchantName,
      paymentMethod,
      status,
      hasAttachment,
      requiresApproval,
      approvedBy,
      project,
      department,
      costCenter
    } = filters;

    const {
      page = 1,
      limit = 20,
      sortBy = 'relevance',
      sortOrder = 'desc'
    } = options;

    const offset = (page - 1) * limit;
    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    // Base conditions
    whereConditions.push(`r.deleted_at IS NULL`);
    whereConditions.push(`r.user_id = $${paramIndex++}`);
    params.push(userId);

    if (companyId) {
      whereConditions.push(`r.company_id = $${paramIndex++}`);
      params.push(companyId);
    }

    // Full-text search
    if (query) {
      whereConditions.push(`(
        to_tsvector('english', 
          coalesce(r.vendor_name, '') || ' ' || 
          coalesce(r.description, '') || ' ' || 
          coalesce(r.notes, '') || ' ' || 
          coalesce(r.ocr_text, '')
        ) @@ plainto_tsquery('english', $${paramIndex++})
      )`);
      params.push(query);
    }

    // Category filter
    if (category) {
      whereConditions.push(`r.category = $${paramIndex++}`);
      params.push(category);
    }

    // Tags filter (contains all specified tags)
    if (tags && tags.length > 0) {
      whereConditions.push(`r.tags @> $${paramIndex++}`);
      params.push(JSON.stringify(tags));
    }

    // Date range
    if (dateFrom) {
      whereConditions.push(`r.receipt_date >= $${paramIndex++}`);
      params.push(dateFrom);
    }

    if (dateTo) {
      whereConditions.push(`r.receipt_date <= $${paramIndex++}`);
      params.push(dateTo);
    }

    // Amount range
    if (amountMin !== undefined) {
      whereConditions.push(`r.total_amount >= $${paramIndex++}`);
      params.push(amountMin);
    }

    if (amountMax !== undefined) {
      whereConditions.push(`r.total_amount <= $${paramIndex++}`);
      params.push(amountMax);
    }

    // Merchant name
    if (merchantName) {
      whereConditions.push(`r.vendor_name ILIKE $${paramIndex++}`);
      params.push(`%${merchantName}%`);
    }

    // Payment method
    if (paymentMethod) {
      whereConditions.push(`r.payment_method = $${paramIndex++}`);
      params.push(paymentMethod);
    }

    // Status
    if (status) {
      whereConditions.push(`r.status = $${paramIndex++}`);
      params.push(status);
    }

    // Has attachment filter
    if (hasAttachment !== undefined) {
      if (hasAttachment) {
        whereConditions.push(`r.file_path IS NOT NULL`);
      } else {
        whereConditions.push(`r.file_path IS NULL`);
      }
    }

    // Approval filters
    if (requiresApproval !== undefined) {
      whereConditions.push(`r.requires_approval = $${paramIndex++}`);
      params.push(requiresApproval);
    }

    if (approvedBy) {
      whereConditions.push(`r.approved_by = $${paramIndex++}`);
      params.push(approvedBy);
    }

    // Business filters
    if (project) {
      whereConditions.push(`r.project_code = $${paramIndex++}`);
      params.push(project);
    }

    if (department) {
      whereConditions.push(`r.department = $${paramIndex++}`);
      params.push(department);
    }

    if (costCenter) {
      whereConditions.push(`r.cost_center = $${paramIndex++}`);
      params.push(costCenter);
    }

    // Build ORDER BY clause
    let orderBy = '';
    switch (sortBy) {
      case 'relevance':
        if (query) {
          orderBy = `ts_rank(to_tsvector('english', 
            coalesce(r.vendor_name, '') || ' ' || 
            coalesce(r.description, '') || ' ' || 
            coalesce(r.notes, '') || ' ' || 
            coalesce(r.ocr_text, '')
          ), plainto_tsquery('english', '${query}')) ${sortOrder.toUpperCase()}`;
        } else {
          orderBy = `r.created_at ${sortOrder.toUpperCase()}`;
        }
        break;
      case 'date':
        orderBy = `r.receipt_date ${sortOrder.toUpperCase()}`;
        break;
      case 'amount':
        orderBy = `r.total_amount ${sortOrder.toUpperCase()}`;
        break;
      case 'merchant':
        orderBy = `r.vendor_name ${sortOrder.toUpperCase()}`;
        break;
      case 'created':
        orderBy = `r.created_at ${sortOrder.toUpperCase()}`;
        break;
      default:
        orderBy = `r.created_at ${sortOrder.toUpperCase()}`;
    }

    const selectFields = `
      r.id, r.original_filename, r.file_path, r.vendor_name, r.vendor_address,
      r.vendor_phone, r.vendor_email, r.total_amount, r.subtotal_amount,
      r.tax_amount, r.tip_amount, r.currency, r.receipt_date, r.receipt_time,
      r.receipt_number, r.payment_method, r.category, r.subcategory, r.tags,
      r.description, r.notes, r.project_code, r.department, r.cost_center,
      r.employee_id, r.requires_approval, r.approved_by, r.approved_at,
      r.approval_notes, r.status, r.processing_started_at, r.processing_completed_at,
      r.processing_error, r.ocr_text, r.ocr_confidence, r.ocr_language,
      r.file_size, r.file_hash, r.mime_type, r.created_at, r.updated_at,
      u.first_name as approver_first_name, u.last_name as approver_last_name
    `;

    const fromClause = `
      FROM receipts r
      LEFT JOIN users u ON r.approved_by = u.id
    `;

    const whereClause = whereConditions.length > 0 ? 
      `WHERE ${whereConditions.join(' AND ')}` : '';

    // Main query
    const sql = `
      SELECT ${selectFields}
      ${fromClause}
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    // Count query
    const countSql = `
      SELECT COUNT(*) as count
      ${fromClause}
      ${whereClause}
    `;

    const countParams = params.slice(0, -2); // Remove limit and offset

    return {
      sql,
      params,
      countSql,
      countParams
    };
  }

  private processSearchResult(row: any, highlight: boolean): SearchResult {
    return {
      id: row.id,
      originalFilename: row.original_filename,
      fileUrl: row.file_path ? `/uploads/receipts/${row.file_path}` : undefined,
      thumbnailUrl: row.file_path ? `/uploads/thumbnails/${row.file_path}` : undefined,
      merchantName: row.vendor_name,
      totalAmount: parseFloat(row.total_amount) || undefined,
      currency: row.currency,
      receiptDate: row.receipt_date,
      category: row.category,
      subcategory: row.subcategory,
      tags: row.tags || [],
      description: row.description,
      notes: row.notes,
      paymentMethod: row.payment_method,
      status: row.status,
      ocrText: row.ocr_text,
      ocrConfidence: row.ocr_confidence,
      projectCode: row.project_code,
      department: row.department,
      costCenter: row.cost_center,
      requiresApproval: row.requires_approval,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      highlights: highlight ? this.extractHighlights(row) : undefined
    };
  }

  private extractHighlights(row: any): Array<{ field: string; snippet: string }> {
    const highlights = [];
    
    // Simple highlighting - in production, use more sophisticated highlighting
    if (row.vendor_name) {
      highlights.push({
        field: 'merchantName',
        snippet: row.vendor_name
      });
    }

    if (row.description) {
      highlights.push({
        field: 'description',
        snippet: row.description.substring(0, 200) + '...'
      });
    }

    return highlights;
  }

  private async buildFacets(filters: SearchFilters, facetFields: string[]): Promise<{ [key: string]: Array<{ value: string; count: number }> }> {
    const facets: { [key: string]: Array<{ value: string; count: number }> } = {};

    for (const field of facetFields) {
      let facetQuery = '';
      const baseParams = [filters.userId];
      let paramIndex = 2;
      let whereClause = 'WHERE r.deleted_at IS NULL AND r.user_id = $1';

      if (filters.companyId) {
        whereClause += ` AND r.company_id = $${paramIndex++}`;
        baseParams.push(filters.companyId);
      }

      switch (field) {
        case 'category':
          facetQuery = `
            SELECT category as value, COUNT(*) as count
            FROM receipts r
            ${whereClause} AND category IS NOT NULL
            GROUP BY category
            ORDER BY count DESC
            LIMIT 20
          `;
          break;

        case 'merchant':
          facetQuery = `
            SELECT vendor_name as value, COUNT(*) as count
            FROM receipts r
            ${whereClause} AND vendor_name IS NOT NULL
            GROUP BY vendor_name
            ORDER BY count DESC
            LIMIT 20
          `;
          break;

        case 'paymentMethod':
          facetQuery = `
            SELECT payment_method as value, COUNT(*) as count
            FROM receipts r
            ${whereClause} AND payment_method IS NOT NULL
            GROUP BY payment_method
            ORDER BY count DESC
            LIMIT 10
          `;
          break;

        case 'status':
          facetQuery = `
            SELECT status as value, COUNT(*) as count
            FROM receipts r
            ${whereClause}
            GROUP BY status
            ORDER BY count DESC
          `;
          break;

        case 'department':
          facetQuery = `
            SELECT department as value, COUNT(*) as count
            FROM receipts r
            ${whereClause} AND department IS NOT NULL
            GROUP BY department
            ORDER BY count DESC
            LIMIT 15
          `;
          break;
      }

      if (facetQuery) {
        const result = await db.query(facetQuery, baseParams);
        facets[field] = result.rows.map(row => ({
          value: row.value,
          count: parseInt(row.count)
        }));
      }
    }

    return facets;
  }

  private async generateSuggestions(query: string): Promise<string[]> {
    // Simple suggestion system - could be enhanced with ML
    const suggestions = [];
    
    // Get similar merchant names
    const merchantSuggestions = await db.query(
      `SELECT DISTINCT vendor_name 
       FROM receipts 
       WHERE vendor_name ILIKE $1 
       AND deleted_at IS NULL 
       LIMIT 5`,
      [`%${query}%`]
    );

    suggestions.push(...merchantSuggestions.rows.map(row => row.vendor_name));

    // Get similar categories
    const categorySuggestions = await db.query(
      `SELECT DISTINCT category 
       FROM receipts 
       WHERE category ILIKE $1 
       AND deleted_at IS NULL 
       LIMIT 5`,
      [`%${query}%`]
    );

    suggestions.push(...categorySuggestions.rows.map(row => row.category));

    return suggestions.slice(0, 10);
  }

  private generateCacheKey(filters: SearchFilters, options: SearchOptions): string {
    const key = JSON.stringify({ filters, options });
    return `search:${Buffer.from(key).toString('base64').substring(0, 50)}`;
  }

  async saveSearch(userId: string, name: string, filters: SearchFilters, options: SearchOptions): Promise<SavedSearch> {
    const id = require('crypto').randomUUID();
    
    // Create saved_searches table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS saved_searches (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        name VARCHAR(100) NOT NULL,
        filters JSONB NOT NULL,
        options JSONB NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    
    const result = await db.query(
      `INSERT INTO saved_searches (id, user_id, name, filters, options, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [id, userId, name, JSON.stringify(filters), JSON.stringify(options)]
    );

    return {
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      name: result.rows[0].name,
      filters: JSON.parse(result.rows[0].filters),
      options: JSON.parse(result.rows[0].options),
      isDefault: result.rows[0].is_default,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };
  }

  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    const result = await db.query(
      `SELECT * FROM saved_searches 
       WHERE user_id = $1 
       ORDER BY is_default DESC, updated_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      filters: JSON.parse(row.filters),
      options: JSON.parse(row.options),
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async deleteSavedSearch(userId: string, searchId: string): Promise<void> {
    await db.query(
      'DELETE FROM saved_searches WHERE id = $1 AND user_id = $2',
      [searchId, userId]
    );
  }

  async getSearchAnalytics(userId: string, companyId?: string): Promise<any> {
    const cacheKey = `search_analytics:${userId}:${companyId || 'individual'}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    let whereClause = 'WHERE r.user_id = $1 AND r.deleted_at IS NULL';
    const params = [userId];
    
    if (companyId) {
      whereClause += ' AND r.company_id = $2';
      params.push(companyId);
    }

    const [
      topCategories,
      topMerchants,
      spendingTrends,
      recentSearches
    ] = await Promise.all([
      // Top categories
      db.query(
        `SELECT category, COUNT(*) as count, SUM(total_amount) as total_amount
         FROM receipts r
         ${whereClause} AND category IS NOT NULL
         GROUP BY category
         ORDER BY count DESC
         LIMIT 10`,
        params
      ),

      // Top merchants
      db.query(
        `SELECT vendor_name, COUNT(*) as count, SUM(total_amount) as total_amount
         FROM receipts r
         ${whereClause} AND vendor_name IS NOT NULL
         GROUP BY vendor_name
         ORDER BY total_amount DESC
         LIMIT 10`,
        params
      ),

      // Spending trends (last 12 months)
      db.query(
        `SELECT 
           DATE_TRUNC('month', receipt_date) as month,
           COUNT(*) as receipt_count,
           SUM(total_amount) as total_amount
         FROM receipts r
         ${whereClause} AND receipt_date > NOW() - INTERVAL '12 months'
         GROUP BY DATE_TRUNC('month', receipt_date)
         ORDER BY month DESC`,
        params
      ),

      // Most common search terms (if we track them)
      db.query(
        `SELECT 'No search tracking' as term, 0 as count LIMIT 0`,
        []
      )
    ]);

    const analytics = {
      topCategories: topCategories.rows.map(row => ({
        category: row.category,
        count: parseInt(row.count),
        totalAmount: parseFloat(row.total_amount)
      })),
      topMerchants: topMerchants.rows.map(row => ({
        merchant: row.vendor_name,
        count: parseInt(row.count),
        totalAmount: parseFloat(row.total_amount)
      })),
      spendingTrends: spendingTrends.rows.map(row => ({
        month: row.month.toISOString().substr(0, 7),
        receiptCount: parseInt(row.receipt_count),
        totalAmount: parseFloat(row.total_amount)
      })),
      recentSearches: [] // TODO: Implement search term tracking
    };

    // Cache for 1 hour
    await redisClient.setex(cacheKey, 3600, JSON.stringify(analytics));

    return analytics;
  }
}

export const searchService = new SearchService();