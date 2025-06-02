import { Client as ElasticsearchClient } from 'elasticsearch';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export interface ElasticsearchReceiptDocument {
  id: string;
  userId: string;
  companyId?: string;
  originalFilename: string;
  vendorName?: string;
  totalAmount?: number;
  currency?: string;
  receiptDate?: string;
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
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Enhanced search fields
  searchableText: string; // Combined text from all searchable fields
  businessType?: string;
  extractedItems?: Array<{
    description: string;
    price?: number;
  }>;
}

export interface ElasticsearchSearchOptions {
  query?: string;
  filters?: {
    userId: string;
    companyId?: string;
    category?: string[];
    tags?: string[];
    dateFrom?: string;
    dateTo?: string;
    amountMin?: number;
    amountMax?: number;
    vendorName?: string;
    paymentMethod?: string[];
    status?: string[];
    department?: string[];
    requiresApproval?: boolean;
  };
  pagination?: {
    page: number;
    size: number;
  };
  sorting?: {
    field: string;
    order: 'asc' | 'desc';
  };
  aggregations?: string[];
  highlight?: boolean;
}

export interface ElasticsearchSearchResult {
  hits: {
    total: number;
    documents: Array<{
      id: string;
      source: ElasticsearchReceiptDocument;
      score: number;
      highlights?: { [field: string]: string[] };
    }>;
  };
  aggregations?: { [key: string]: any };
  suggestions?: string[];
  queryTime: number;
}

class ElasticsearchService {
  private client: ElasticsearchClient;
  private indexName = 'receipt-vault-receipts';

  constructor() {
    try {
      this.client = new ElasticsearchClient({
        host: config.elasticsearch.url,
        log: 'error',
        apiVersion: '7.17',
        requestTimeout: 30000,
        pingTimeout: 3000,
        sniffOnStart: false,
        sniffOnConnectionFault: false,
      });

      this.initializeIndex();
    } catch (error) {
      logger.error('Failed to initialize Elasticsearch client:', error);
      throw new Error('Elasticsearch service initialization failed');
    }
  }

  /**
   * Initialize Elasticsearch index with proper mapping
   */
  private async initializeIndex(): Promise<void> {
    try {
      const indexExists = await this.client.indices.exists({
        index: this.indexName,
      });

      if (!indexExists) {
        await this.createIndex();
        logger.info(`Elasticsearch index ${this.indexName} created`);
      }
    } catch (error) {
      logger.error('Failed to initialize Elasticsearch index:', error);
    }
  }

  /**
   * Create Elasticsearch index with optimized mapping for receipt search
   */
  private async createIndex(): Promise<void> {
    const mapping = {
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        analysis: {
          analyzer: {
            receipt_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: [
                'lowercase',
                'asciifolding',
                'receipt_synonym_filter',
                'stop'
              ]
            },
            autocomplete_analyzer: {
              type: 'custom',
              tokenizer: 'keyword',
              filter: ['lowercase', 'edge_ngram_filter']
            }
          },
          filter: {
            receipt_synonym_filter: {
              type: 'synonym',
              synonyms: [
                'gas,fuel,gasoline,petrol',
                'restaurant,dining,food,cafe,eatery',
                'hotel,motel,accommodation,lodging',
                'taxi,uber,lyft,rideshare,transport',
                'office,supplies,stationery',
                'pharmacy,drugstore,medicine,medical'
              ]
            },
            edge_ngram_filter: {
              type: 'edge_ngram',
              min_gram: 1,
              max_gram: 20
            }
          }
        }
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          userId: { type: 'keyword' },
          companyId: { type: 'keyword' },
          originalFilename: {
            type: 'text',
            analyzer: 'receipt_analyzer',
            fields: {
              keyword: { type: 'keyword' },
              autocomplete: {
                type: 'text',
                analyzer: 'autocomplete_analyzer'
              }
            }
          },
          vendorName: {
            type: 'text',
            analyzer: 'receipt_analyzer',
            fields: {
              keyword: { type: 'keyword' },
              autocomplete: {
                type: 'text',
                analyzer: 'autocomplete_analyzer'
              }
            }
          },
          totalAmount: { type: 'float' },
          currency: { type: 'keyword' },
          receiptDate: { type: 'date' },
          category: {
            type: 'text',
            analyzer: 'receipt_analyzer',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          subcategory: {
            type: 'text',
            analyzer: 'receipt_analyzer',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          tags: { type: 'keyword' },
          description: {
            type: 'text',
            analyzer: 'receipt_analyzer'
          },
          notes: {
            type: 'text',
            analyzer: 'receipt_analyzer'
          },
          paymentMethod: { type: 'keyword' },
          status: { type: 'keyword' },
          ocrText: {
            type: 'text',
            analyzer: 'receipt_analyzer'
          },
          ocrConfidence: { type: 'float' },
          projectCode: { type: 'keyword' },
          department: { type: 'keyword' },
          costCenter: { type: 'keyword' },
          requiresApproval: { type: 'boolean' },
          approvedBy: { type: 'keyword' },
          approvedAt: { type: 'date' },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
          // Enhanced search fields
          searchableText: {
            type: 'text',
            analyzer: 'receipt_analyzer'
          },
          businessType: {
            type: 'text',
            analyzer: 'receipt_analyzer',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          extractedItems: {
            type: 'nested',
            properties: {
              description: {
                type: 'text',
                analyzer: 'receipt_analyzer'
              },
              price: { type: 'float' }
            }
          }
        }
      }
    };

    await this.client.indices.create({
      index: this.indexName,
      body: mapping,
    });
  }

  /**
   * Index a receipt document
   */
  async indexReceipt(receiptData: ElasticsearchReceiptDocument): Promise<void> {
    try {
      // Create searchable text combining all text fields
      const searchableFields = [
        receiptData.vendorName,
        receiptData.description,
        receiptData.notes,
        receiptData.ocrText,
        receiptData.category,
        receiptData.subcategory,
        receiptData.projectCode,
        receiptData.department,
        receiptData.paymentMethod,
        ...(receiptData.tags || []),
        ...(receiptData.extractedItems?.map(item => item.description) || [])
      ].filter(Boolean).join(' ');

      const documentToIndex = {
        ...receiptData,
        searchableText: searchableFields
      };

      await this.client.index({
        index: this.indexName,
        id: receiptData.id,
        body: documentToIndex,
        refresh: 'wait_for'
      });

      logger.debug(`Indexed receipt ${receiptData.id} in Elasticsearch`);
    } catch (error) {
      logger.error(`Failed to index receipt ${receiptData.id}:`, error);
      throw error;
    }
  }

  /**
   * Update a receipt document
   */
  async updateReceipt(receiptId: string, updates: Partial<ElasticsearchReceiptDocument>): Promise<void> {
    try {
      // If updating searchable fields, regenerate searchableText
      if (updates.vendorName || updates.description || updates.notes || updates.ocrText || updates.category) {
        const currentDoc = await this.getReceiptById(receiptId);
        if (currentDoc) {
          const mergedDoc = { ...currentDoc.source, ...updates };
          const searchableFields = [
            mergedDoc.vendorName,
            mergedDoc.description,
            mergedDoc.notes,
            mergedDoc.ocrText,
            mergedDoc.category,
            mergedDoc.subcategory,
            mergedDoc.projectCode,
            mergedDoc.department,
            mergedDoc.paymentMethod,
            ...(mergedDoc.tags || []),
            ...(mergedDoc.extractedItems?.map(item => item.description) || [])
          ].filter(Boolean).join(' ');

          updates.searchableText = searchableFields;
        }
      }

      await this.client.update({
        index: this.indexName,
        id: receiptId,
        body: {
          doc: updates
        },
        refresh: 'wait_for'
      });

      logger.debug(`Updated receipt ${receiptId} in Elasticsearch`);
    } catch (error) {
      logger.error(`Failed to update receipt ${receiptId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a receipt document
   */
  async deleteReceipt(receiptId: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.indexName,
        id: receiptId,
        refresh: 'wait_for'
      });

      logger.debug(`Deleted receipt ${receiptId} from Elasticsearch`);
    } catch (error) {
      if (error.status === 404) {
        logger.warn(`Receipt ${receiptId} not found in Elasticsearch`);
        return;
      }
      logger.error(`Failed to delete receipt ${receiptId}:`, error);
      throw error;
    }
  }

  /**
   * Get a receipt by ID
   */
  async getReceiptById(receiptId: string): Promise<{ id: string; source: ElasticsearchReceiptDocument } | null> {
    try {
      const response = await this.client.get({
        index: this.indexName,
        id: receiptId
      });

      return {
        id: response._id,
        source: response._source as ElasticsearchReceiptDocument
      };
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      logger.error(`Failed to get receipt ${receiptId}:`, error);
      throw error;
    }
  }

  /**
   * Advanced search with faceting and highlighting
   */
  async searchReceipts(options: ElasticsearchSearchOptions): Promise<ElasticsearchSearchResult> {
    const startTime = Date.now();
    
    try {
      const {
        query,
        filters = {},
        pagination = { page: 1, size: 20 },
        sorting = { field: 'createdAt', order: 'desc' },
        aggregations = [],
        highlight = false
      } = options;

      const searchBody: any = {
        size: pagination.size,
        from: (pagination.page - 1) * pagination.size,
        sort: this.buildSortClause(sorting, query),
        query: this.buildQueryClause(query, filters),
      };

      // Add highlighting
      if (highlight && query) {
        searchBody.highlight = {
          fields: {
            searchableText: {
              fragment_size: 150,
              number_of_fragments: 3,
              pre_tags: ['<mark>'],
              post_tags: ['</mark>']
            },
            vendorName: {
              pre_tags: ['<mark>'],
              post_tags: ['</mark>']
            },
            description: {
              fragment_size: 100,
              number_of_fragments: 2,
              pre_tags: ['<mark>'],
              post_tags: ['</mark>']
            }
          }
        };
      }

      // Add aggregations for faceting
      if (aggregations.length > 0) {
        searchBody.aggs = this.buildAggregations(aggregations, filters);
      }

      const response = await this.client.search({
        index: this.indexName,
        body: searchBody
      });

      const result: ElasticsearchSearchResult = {
        hits: {
          total: response.hits.total.value || response.hits.total,
          documents: response.hits.hits.map((hit: any) => ({
            id: hit._id,
            source: hit._source,
            score: hit._score,
            highlights: hit.highlight
          }))
        },
        aggregations: response.aggregations,
        queryTime: Date.now() - startTime
      };

      // Generate suggestions for empty results
      if (result.hits.total === 0 && query) {
        result.suggestions = await this.generateSuggestions(query, filters);
      }

      return result;
    } catch (error) {
      logger.error('Elasticsearch search failed:', error);
      throw error;
    }
  }

  /**
   * Build Elasticsearch query clause
   */
  private buildQueryClause(query?: string, filters: any = {}): any {
    const mustClauses = [];
    const filterClauses = [];

    // Security filter - always filter by user
    filterClauses.push({
      term: { userId: filters.userId }
    });

    // Company filter
    if (filters.companyId) {
      filterClauses.push({
        term: { companyId: filters.companyId }
      });
    }

    // Text search
    if (query) {
      mustClauses.push({
        multi_match: {
          query,
          fields: [
            'searchableText^1.0',
            'vendorName^2.0',
            'description^1.5',
            'category^1.5',
            'ocrText^1.0',
            'extractedItems.description^1.2'
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
          operator: 'or'
        }
      });
    }

    // Category filter
    if (filters.category && filters.category.length > 0) {
      filterClauses.push({
        terms: { 'category.keyword': filters.category }
      });
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      filterClauses.push({
        terms: { tags: filters.tags }
      });
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      const dateRange: any = {};
      if (filters.dateFrom) dateRange.gte = filters.dateFrom;
      if (filters.dateTo) dateRange.lte = filters.dateTo;
      
      filterClauses.push({
        range: { receiptDate: dateRange }
      });
    }

    // Amount range filter
    if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
      const amountRange: any = {};
      if (filters.amountMin !== undefined) amountRange.gte = filters.amountMin;
      if (filters.amountMax !== undefined) amountRange.lte = filters.amountMax;
      
      filterClauses.push({
        range: { totalAmount: amountRange }
      });
    }

    // Vendor name filter
    if (filters.vendorName) {
      filterClauses.push({
        wildcard: {
          'vendorName.keyword': `*${filters.vendorName}*`
        }
      });
    }

    // Payment method filter
    if (filters.paymentMethod && filters.paymentMethod.length > 0) {
      filterClauses.push({
        terms: { paymentMethod: filters.paymentMethod }
      });
    }

    // Status filter
    if (filters.status && filters.status.length > 0) {
      filterClauses.push({
        terms: { status: filters.status }
      });
    }

    // Department filter
    if (filters.department && filters.department.length > 0) {
      filterClauses.push({
        terms: { department: filters.department }
      });
    }

    // Approval filter
    if (filters.requiresApproval !== undefined) {
      filterClauses.push({
        term: { requiresApproval: filters.requiresApproval }
      });
    }

    return {
      bool: {
        must: mustClauses.length > 0 ? mustClauses : [{ match_all: {} }],
        filter: filterClauses
      }
    };
  }

  /**
   * Build sort clause
   */
  private buildSortClause(sorting: { field: string; order: 'asc' | 'desc' }, query?: string): any[] {
    const sortClauses = [];

    // Add relevance score if there's a query
    if (query) {
      sortClauses.push({ _score: { order: 'desc' } });
    }

    // Add specified sort field
    switch (sorting.field) {
      case 'relevance':
        // Already handled above
        break;
      case 'date':
        sortClauses.push({ receiptDate: { order: sorting.order } });
        break;
      case 'amount':
        sortClauses.push({ totalAmount: { order: sorting.order } });
        break;
      case 'vendor':
        sortClauses.push({ 'vendorName.keyword': { order: sorting.order } });
        break;
      case 'created':
      default:
        sortClauses.push({ createdAt: { order: sorting.order } });
        break;
    }

    // Add tie-breaker
    if (!query) {
      sortClauses.push({ createdAt: { order: 'desc' } });
    }

    return sortClauses;
  }

  /**
   * Build aggregations for faceting
   */
  private buildAggregations(aggregationFields: string[], filters: any): any {
    const aggs: any = {};

    aggregationFields.forEach(field => {
      switch (field) {
        case 'category':
          aggs.categories = {
            terms: {
              field: 'category.keyword',
              size: 20
            }
          };
          break;
        case 'vendor':
          aggs.vendors = {
            terms: {
              field: 'vendorName.keyword',
              size: 20
            }
          };
          break;
        case 'paymentMethod':
          aggs.paymentMethods = {
            terms: {
              field: 'paymentMethod',
              size: 10
            }
          };
          break;
        case 'status':
          aggs.statuses = {
            terms: {
              field: 'status',
              size: 10
            }
          };
          break;
        case 'department':
          aggs.departments = {
            terms: {
              field: 'department',
              size: 15
            }
          };
          break;
        case 'amountRanges':
          aggs.amountRanges = {
            range: {
              field: 'totalAmount',
              ranges: [
                { to: 10, key: 'Under $10' },
                { from: 10, to: 50, key: '$10-$50' },
                { from: 50, to: 100, key: '$50-$100' },
                { from: 100, to: 500, key: '$100-$500' },
                { from: 500, key: 'Over $500' }
              ]
            }
          };
          break;
      }
    });

    return aggs;
  }

  /**
   * Generate search suggestions for empty results
   */
  private async generateSuggestions(query: string, filters: any): Promise<string[]> {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          size: 0,
          query: {
            bool: {
              filter: [
                { term: { userId: filters.userId } },
                ...(filters.companyId ? [{ term: { companyId: filters.companyId } }] : [])
              ]
            }
          },
          suggest: {
            vendor_suggestions: {
              text: query,
              term: {
                field: 'vendorName.keyword',
                size: 3
              }
            },
            category_suggestions: {
              text: query,
              term: {
                field: 'category.keyword',
                size: 3
              }
            }
          }
        }
      });

      const suggestions = [];
      
      // Extract vendor suggestions
      if (response.suggest?.vendor_suggestions) {
        response.suggest.vendor_suggestions.forEach((suggestion: any) => {
          suggestion.options.forEach((option: any) => {
            suggestions.push(option.text);
          });
        });
      }

      // Extract category suggestions
      if (response.suggest?.category_suggestions) {
        response.suggest.category_suggestions.forEach((suggestion: any) => {
          suggestion.options.forEach((option: any) => {
            suggestions.push(option.text);
          });
        });
      }

      return suggestions.slice(0, 5);
    } catch (error) {
      logger.error('Failed to generate suggestions:', error);
      return [];
    }
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(userId: string, companyId?: string): Promise<any> {
    try {
      const filters = [
        { term: { userId } },
        ...(companyId ? [{ term: { companyId } }] : [])
      ];

      const response = await this.client.search({
        index: this.indexName,
        body: {
          size: 0,
          query: {
            bool: { filter: filters }
          },
          aggs: {
            categories: {
              terms: {
                field: 'category.keyword',
                size: 10
              },
              aggs: {
                total_amount: {
                  sum: { field: 'totalAmount' }
                }
              }
            },
            vendors: {
              terms: {
                field: 'vendorName.keyword',
                size: 10
              },
              aggs: {
                total_amount: {
                  sum: { field: 'totalAmount' }
                }
              }
            },
            monthly_trends: {
              date_histogram: {
                field: 'receiptDate',
                calendar_interval: 'month',
                min_doc_count: 1
              },
              aggs: {
                total_amount: {
                  sum: { field: 'totalAmount' }
                }
              }
            },
            amount_ranges: {
              range: {
                field: 'totalAmount',
                ranges: [
                  { to: 10, key: 'Under $10' },
                  { from: 10, to: 50, key: '$10-$50' },
                  { from: 50, to: 100, key: '$50-$100' },
                  { from: 100, to: 500, key: '$100-$500' },
                  { from: 500, key: 'Over $500' }
                ]
              }
            }
          }
        }
      });

      return {
        totalReceipts: response.hits.total.value || response.hits.total,
        topCategories: response.aggregations?.categories?.buckets || [],
        topVendors: response.aggregations?.vendors?.buckets || [],
        monthlyTrends: response.aggregations?.monthly_trends?.buckets || [],
        amountRanges: response.aggregations?.amount_ranges?.buckets || []
      };
    } catch (error) {
      logger.error('Failed to get search analytics:', error);
      throw error;
    }
  }

  /**
   * Bulk index multiple receipts
   */
  async bulkIndexReceipts(receipts: ElasticsearchReceiptDocument[]): Promise<void> {
    try {
      const body = [];
      
      for (const receipt of receipts) {
        // Create searchable text
        const searchableFields = [
          receipt.vendorName,
          receipt.description,
          receipt.notes,
          receipt.ocrText,
          receipt.category,
          receipt.subcategory,
          receipt.projectCode,
          receipt.department,
          receipt.paymentMethod,
          ...(receipt.tags || []),
          ...(receipt.extractedItems?.map(item => item.description) || [])
        ].filter(Boolean).join(' ');

        body.push(
          { index: { _index: this.indexName, _id: receipt.id } },
          { ...receipt, searchableText: searchableFields }
        );
      }

      const response = await this.client.bulk({
        body,
        refresh: 'wait_for'
      });

      if (response.errors) {
        logger.error('Bulk indexing had errors:', response.items.filter((item: any) => item.index?.error));
      } else {
        logger.info(`Bulk indexed ${receipts.length} receipts`);
      }
    } catch (error) {
      logger.error('Bulk indexing failed:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.ping();
      return response === true;
    } catch (error) {
      logger.error('Elasticsearch health check failed:', error);
      return false;
    }
  }
}

export const elasticsearchService = new ElasticsearchService();