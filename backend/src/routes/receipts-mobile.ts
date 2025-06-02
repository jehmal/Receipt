import { FastifyPluginAsync } from 'fastify';
import { receiptService } from '@/services/receipts';
import { ocrService } from '@/services/ocr';
import { voiceService } from '@/services/voice';
import { smartCategorizationService } from '@/services/smart-categorization';

const mobileReceiptRoutes: FastifyPluginAsync = async (fastify) => {
  // Enhanced upload endpoint for mobile with OCR processing
  fastify.post('/upload', {
    preHandler: [fastify.authenticate],
    schema: {
      consumes: ['multipart/form-data'],
    },
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      
      // Handle multipart file upload
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({
          success: false,
          message: 'No file uploaded'
        });
      }

      // Convert stream to buffer
      const buffer = await data.toBuffer();
      
      // Get additional fields from the multipart data
      const fields = data.fields;
      const category = (fields?.category as any)?.value as string;
      const description = (fields?.description as any)?.value as string;
      const jobNumber = (fields?.job_number as any)?.value as string;
      const context = (fields?.context as any)?.value as string; // 'personal' | 'company'
      const tags = (fields?.tags as any)?.value ? JSON.parse((fields.tags as any).value as string) : [];

      const uploadData = {
        userId: user.id,
        companyId: context === 'company' ? user.companyId : undefined,
        originalFilename: data.filename,
        fileBuffer: buffer,
        category,
        description,
        tags,
        jobNumber,
        context: context as 'personal' | 'company'
      };

      // Upload receipt
      const receipt = await receiptService.uploadReceipt(uploadData);

      // Process OCR immediately for mobile (for faster user feedback)
      try {
        const ocrResult = await ocrService.processImage(buffer, data.filename);
        
        // Update receipt with OCR data
        if (ocrResult.success) {
          await receiptService.updateReceiptOCR(receipt.id, {
            ocrText: ocrResult.text,
            ocrConfidence: ocrResult.confidence,
            vendorName: ocrResult.vendorName,
            totalAmount: ocrResult.totalAmount,
            currency: ocrResult.currency,
            receiptDate: ocrResult.date,
            status: 'processed'
          });

          // Smart categorization if no category provided
          if (!category && ocrResult.vendorName) {
            const suggestedCategory = await smartCategorizationService.suggestCategory({
              vendorName: ocrResult.vendorName,
              ocrText: ocrResult.text,
              amount: ocrResult.totalAmount
            });

            if (suggestedCategory.category) {
              await receiptService.updateReceipt(receipt.id, user.id, {
                category: suggestedCategory.category
              });
            }
          }
        }
      } catch (ocrError) {
        console.error('OCR processing failed:', ocrError);
        // Don't fail the entire upload, just mark as processing failed
        await receiptService.updateReceiptOCR(receipt.id, {
          status: 'failed',
          ocrText: 'OCR processing failed'
        });
      }

      // Get updated receipt with OCR data
      const updatedReceipt = await receiptService.getReceiptById(receipt.id, user.id);

      return reply.code(201).send({
        success: true,
        message: 'Receipt uploaded and processed successfully',
        data: {
          receipt: updatedReceipt
        }
      });
    } catch (error: any) {
      console.error('Mobile receipt upload error:', error);
      return reply.code(400).send({
        success: false,
        message: error.message || 'Failed to upload receipt'
      });
    }
  });

  // Voice memo processing endpoint
  fastify.post('/:id/voice-memo', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      consumes: ['multipart/form-data']
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { id } = request.params as any;

      // Check if receipt exists and belongs to user
      const receipt = await receiptService.getReceiptById(id, user.id);
      if (!receipt) {
        return reply.code(404).send({
          success: false,
          message: 'Receipt not found'
        });
      }

      // Handle audio file upload
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({
          success: false,
          message: 'No audio file uploaded'
        });
      }

      const audioBuffer = await data.toBuffer();

      // Process speech-to-text
      const transcription = await voiceService.transcribeAudio(audioBuffer, data.filename);

      if (!transcription.success) {
        return reply.code(400).send({
          success: false,
          message: 'Failed to transcribe audio'
        });
      }

      // Update receipt with transcribed memo
      const updatedReceipt = await receiptService.updateReceipt(id, user.id, {
        description: transcription.text
      });

      return reply.send({
        success: true,
        data: {
          transcription: transcription.text,
          confidence: transcription.confidence,
          language: transcription.language,
          receipt: updatedReceipt
        }
      });
    } catch (error: any) {
      console.error('Voice memo processing error:', error);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to process voice memo'
      });
    }
  });

  // Smart category suggestion endpoint
  fastify.post('/suggest-category', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['vendor_name'],
        properties: {
          vendor_name: { type: 'string' },
          ocr_text: { type: 'string' },
          amount: { type: 'number' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { vendor_name, ocr_text, amount } = request.body as any;

      const suggestion = await smartCategorizationService.suggestCategory({
        vendorName: vendor_name,
        ocrText: ocr_text,
        amount
      });

      return reply.send({
        success: true,
        data: suggestion
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to suggest category'
      });
    }
  });

  // Search receipts with enhanced mobile filtering
  fastify.get('/search', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          context: { type: 'string', enum: ['personal', 'company', 'all'] },
          categories: { type: 'string' }, // comma-separated
          tags: { type: 'string' }, // comma-separated
          from: { type: 'string', format: 'date' },
          to: { type: 'string', format: 'date' },
          min_amount: { type: 'number' },
          max_amount: { type: 'number' },
          vendor: { type: 'string' },
          job_number: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const query = request.query as any;

      const filter = {
        userId: user.id,
        companyId: query.context === 'company' ? user.companyId : 
                  query.context === 'personal' ? undefined : user.companyId,
        search: query.q,
        category: query.categories ? query.categories.split(',')[0] : undefined,
        tags: query.tags ? query.tags.split(',') : undefined,
        startDate: query.from ? new Date(query.from) : undefined,
        endDate: query.to ? new Date(query.to) : undefined,
        minAmount: query.min_amount,
        maxAmount: query.max_amount,
        vendorName: query.vendor
      };

      const pagination = {
        page: 1,
        limit: query.limit || 20,
        sortBy: 'created_at' as const,
        sortOrder: 'desc' as const
      };

      const result = await receiptService.getReceipts(filter, pagination);

      return reply.send({
        success: true,
        data: result.receipts
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Search failed'
      });
    }
  });

  // Semantic search endpoint (for advanced AI-powered search)
  fastify.post('/semantic-search', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          filters: {
            type: 'object',
            properties: {
              date_range: {
                type: 'object',
                properties: {
                  start: { type: 'string', format: 'date' },
                  end: { type: 'string', format: 'date' }
                }
              },
              categories: { type: 'array', items: { type: 'string' } },
              amount_range: {
                type: 'object',
                properties: {
                  min: { type: 'number' },
                  max: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { query, limit, filters } = request.body as any;

      // For now, fall back to regular search
      // TODO: Implement vector search when vector database is available
      const searchFilter = {
        userId: user.id,
        companyId: user.companyId,
        search: query,
        startDate: filters?.date_range?.start ? new Date(filters.date_range.start) : undefined,
        endDate: filters?.date_range?.end ? new Date(filters.date_range.end) : undefined,
        minAmount: filters?.amount_range?.min,
        maxAmount: filters?.amount_range?.max,
        category: filters?.categories?.[0] // Take first category for now
      };

      const pagination = {
        page: 1,
        limit: limit || 20,
        sortBy: 'created_at' as const,
        sortOrder: 'desc' as const
      };

      const result = await receiptService.getReceipts(searchFilter, pagination);

      return reply.send({
        success: true,
        data: {
          results: result.receipts
        }
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Semantic search failed'
      });
    }
  });

  // Search suggestions endpoint
  fastify.get('/search/suggestions', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', minLength: 2 }
        },
        required: ['q']
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { q } = request.query as any;

      // Get suggestions from recent vendor names and OCR text
      const suggestionsQuery = `
        SELECT DISTINCT vendor_name as suggestion
        FROM receipts 
        WHERE user_id = $1 
          AND vendor_name ILIKE $2 
          AND vendor_name IS NOT NULL
          AND deleted_at IS NULL
        UNION
        SELECT DISTINCT unnest(tags) as suggestion
        FROM receipts 
        WHERE user_id = $1 
          AND tags && ARRAY[SELECT * FROM unnest(tags) WHERE unnest ILIKE $2]
          AND deleted_at IS NULL
        LIMIT 10
      `;

      const { db } = await import('@/database/connection');
      const result = await db.query(suggestionsQuery, [
        user.id,
        `%${q}%`
      ]);

      const suggestions = result.rows.map((row: any) => row.suggestion);

      return reply.send({
        success: true,
        data: {
          suggestions
        }
      });
    } catch (error: any) {
      const { q } = request.query as any;
      // Return fallback suggestions on error
      const fallbackSuggestions = [
        'coffee', 'lunch', 'gas', 'office supplies', 'hotel',
        'restaurant', 'taxi', 'grocery', 'pharmacy', 'parking'
      ].filter(s => s.toLowerCase().includes((q || '').toLowerCase()));

      return reply.send({
        success: true,
        data: {
          suggestions: fallbackSuggestions
        }
      });
    }
  });

  // Filter options endpoint (for mobile app filter UI)
  fastify.get('/filter-options', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;

      // Get available categories, vendors, and tags for the user
      const optionsQuery = `
        SELECT 
          array_agg(DISTINCT category) FILTER (WHERE category IS NOT NULL) as categories,
          array_agg(DISTINCT vendor_name) FILTER (WHERE vendor_name IS NOT NULL) as vendors,
          array_agg(DISTINCT unnest(tags)) FILTER (WHERE tags IS NOT NULL) as tags,
          MIN(total_amount) as min_amount,
          MAX(total_amount) as max_amount
        FROM receipts 
        WHERE user_id = $1 AND deleted_at IS NULL
      `;

      const { db } = await import('@/database/connection');
      const result = await db.query(optionsQuery, [user.id]);
      const options = result.rows[0];

      return reply.send({
        success: true,
        data: {
          categories: options.categories || [],
          vendors: options.vendors || [],
          tags: options.tags || [],
          amountRange: {
            min: options.min_amount || 0,
            max: options.max_amount || 10000
          }
        }
      });
    } catch (error: any) {
      // Return default options on error
      return reply.send({
        success: true,
        data: {
          categories: [
            'Parts', 'Fuel', 'Tools', 'Parking', 'Warranty',
            'Food & Dining', 'Office Supplies', 'Travel', 'Other'
          ],
          vendors: [],
          tags: ['business', 'personal', 'reimbursable', 'tax-deductible'],
          amountRange: { min: 0, max: 10000 }
        }
      });
    }
  });

  // Sync endpoint for offline functionality
  fastify.post('/sync', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          operations: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type', 'data', 'local_id', 'timestamp'],
              properties: {
                type: { type: 'string', enum: ['create_receipt', 'update_receipt', 'delete_receipt'] },
                data: { type: 'object' },
                local_id: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        required: ['operations']
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { operations } = request.body as any;

      const results = [];

      for (const operation of operations) {
        try {
          let result;
          
          switch (operation.type) {
            case 'create_receipt':
              // Handle offline receipt creation
              result = await receiptService.uploadReceipt({
                ...operation.data,
                userId: user.id,
                companyId: user.companyId
              });
              break;
              
            case 'update_receipt':
              result = await receiptService.updateReceipt(
                operation.data.id,
                user.id,
                operation.data
              );
              break;
              
            case 'delete_receipt':
              result = await receiptService.deleteReceipt(
                operation.data.id,
                user.id
              );
              break;
              
            default:
              throw new Error(`Unknown operation type: ${operation.type}`);
          }

          results.push({
            local_id: operation.local_id,
            success: true,
            data: result
          });
        } catch (error: any) {
          results.push({
            local_id: operation.local_id,
            success: false,
            error: error.message
          });
        }
      }

      return reply.send({
        success: true,
        data: {
          results
        }
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Sync failed'
      });
    }
  });
};

export default mobileReceiptRoutes;