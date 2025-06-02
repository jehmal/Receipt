import { randomUUID } from 'crypto';
import { db } from '../database/connection';
import { storageService } from './storage';
import { FileValidator } from '../utils/file-validation';

export interface CreateReceiptData {
  userId: string;
  companyId?: string;
  originalFilename: string;
  fileBuffer: Buffer;
  category?: string;
  description?: string;
  tags?: string[];
  jobNumber?: string;
  context?: 'personal' | 'company';
  metadata?: Record<string, any>;
}

export interface ReceiptFilter {
  userId: string;
  companyId?: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  tags?: string[];
  status?: 'uploaded' | 'processing' | 'processed' | 'failed';
  minAmount?: number;
  maxAmount?: number;
  vendorName?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: 'created_at' | 'receipt_date' | 'total_amount' | 'vendor_name';
  sortOrder?: 'asc' | 'desc';
}

export interface Receipt {
  id: string;
  userId: string;
  companyId?: string;
  originalFilename: string;
  filePath: string;
  fileSize: number;
  fileHash: string;
  mimeType: string;
  status: string;
  vendorName?: string;
  totalAmount?: number;
  currency?: string;
  receiptDate?: Date;
  category?: string;
  description?: string;
  tags?: string[];
  thumbnailPath?: string;
  ocrText?: string;
  ocrConfidence?: number;
  createdAt: Date;
  updatedAt: Date;
}

class ReceiptService {
  async uploadReceipt(data: CreateReceiptData): Promise<Receipt> {
    const receiptId = randomUUID();
    
    try {
      // 1. Validate file
      const validation = await FileValidator.validateFile(
        data.fileBuffer, 
        data.originalFilename
      );

      if (!validation.isValid) {
        throw new Error(`File validation failed: ${validation.error}`);
      }

      // 2. Upload to storage
      const uploadResult = await storageService.uploadFile(
        data.fileBuffer,
        data.userId,
        data.originalFilename
      );

      // 3. Check for duplicate file
      const existingReceipt = await this.findReceiptByHash(uploadResult.fileHash, data.userId);
      if (existingReceipt) {
        throw new Error('A receipt with this file already exists');
      }

      // 4. Create receipt record in database
      const receiptData = await db.query(
        `INSERT INTO receipts (
          id, user_id, company_id, original_filename, file_path, file_size, 
          file_hash, mime_type, status, category, description, tags, job_number,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
        RETURNING *`,
        [
          receiptId,
          data.userId,
          data.companyId || null,
          data.originalFilename,
          uploadResult.filePath,
          uploadResult.fileSize,
          uploadResult.fileHash,
          uploadResult.mimeType,
          'uploaded',
          data.category || null,
          data.description || null,
          data.tags || null,
          data.jobNumber || null
        ]
      );

      const receipt = receiptData.rows[0];

      // 5. Queue OCR processing
      try {
        const { jobQueueService } = await import('./job-queue');
        await jobQueueService.addOCRJob({
          receiptId,
          filePath: uploadResult.filePath,
          userId: data.userId,
          priority: data.context === 'company' ? 1 : 0 // Higher priority for company receipts
        });
        console.log(`Receipt ${receiptId} uploaded and queued for OCR processing`);
      } catch (queueError) {
        console.warn(`Failed to queue OCR job for receipt ${receiptId}:`, queueError);
        // Don't fail the upload if queueing fails - can be retried later
      }

      return this.mapDbReceiptToReceipt(receipt, uploadResult.thumbnailPath);
    } catch (error) {
      console.error(`Failed to upload receipt ${receiptId}:`, error);
      
      // Cleanup uploaded file if database operation failed
      try {
        if (data.fileBuffer) {
          // Note: We can't easily clean up at this point since we may not have the file path
          // This is a limitation of the current error handling approach
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup file after upload error:', cleanupError);
      }
      
      throw error;
    }
  }

  async updateReceiptOCR(receiptId: string, ocrData: {
    ocrText?: string;
    ocrConfidence?: number;
    vendorName?: string;
    totalAmount?: number;
    currency?: string;
    receiptDate?: Date;
    status?: string;
  }): Promise<Receipt | null> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    // Build dynamic update query
    if (ocrData.ocrText !== undefined) {
      updateFields.push(`ocr_text = $${++paramCount}`);
      params.push(ocrData.ocrText);
    }
    if (ocrData.ocrConfidence !== undefined) {
      updateFields.push(`ocr_confidence = $${++paramCount}`);
      params.push(ocrData.ocrConfidence);
    }
    if (ocrData.vendorName !== undefined) {
      updateFields.push(`vendor_name = $${++paramCount}`);
      params.push(ocrData.vendorName);
    }
    if (ocrData.totalAmount !== undefined) {
      updateFields.push(`total_amount = $${++paramCount}`);
      params.push(ocrData.totalAmount);
    }
    if (ocrData.currency !== undefined) {
      updateFields.push(`currency = $${++paramCount}`);
      params.push(ocrData.currency);
    }
    if (ocrData.receiptDate !== undefined) {
      updateFields.push(`receipt_date = $${++paramCount}`);
      params.push(ocrData.receiptDate);
    }
    if (ocrData.status !== undefined) {
      updateFields.push(`status = $${++paramCount}`);
      params.push(ocrData.status);
    }

    if (updateFields.length === 0) {
      return null;
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(receiptId);

    const query = `
      UPDATE receipts 
      SET ${updateFields.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `;

    const result = await db.query(query, params);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapDbReceiptToReceipt(result.rows[0]);
  }

  async getReceipts(
    filter: ReceiptFilter, 
    pagination: PaginationOptions
  ): Promise<{ receipts: Receipt[]; total: number; totalPages: number }> {
    const offset = (pagination.page - 1) * pagination.limit;
    const sortBy = pagination.sortBy || 'created_at';
    const sortOrder = pagination.sortOrder || 'desc';

    // Build WHERE clause
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];
    let paramCount = 0;

    // User/Company filter
    conditions.push(`user_id = $${++paramCount}`);
    params.push(filter.userId);

    if (filter.companyId) {
      conditions.push(`company_id = $${++paramCount}`);
      params.push(filter.companyId);
    }

    // Additional filters
    if (filter.category) {
      conditions.push(`category = $${++paramCount}`);
      params.push(filter.category);
    }

    if (filter.status) {
      conditions.push(`status = $${++paramCount}`);
      params.push(filter.status);
    }

    if (filter.startDate) {
      conditions.push(`created_at >= $${++paramCount}`);
      params.push(filter.startDate);
    }

    if (filter.endDate) {
      conditions.push(`created_at <= $${++paramCount}`);
      params.push(filter.endDate);
    }

    if (filter.minAmount) {
      conditions.push(`total_amount >= $${++paramCount}`);
      params.push(filter.minAmount);
    }

    if (filter.maxAmount) {
      conditions.push(`total_amount <= $${++paramCount}`);
      params.push(filter.maxAmount);
    }

    if (filter.vendorName) {
      conditions.push(`vendor_name ILIKE $${++paramCount}`);
      params.push(`%${filter.vendorName}%`);
    }

    if (filter.search) {
      conditions.push(`(
        ocr_text ILIKE $${++paramCount} OR 
        vendor_name ILIKE $${++paramCount} OR 
        description ILIKE $${++paramCount}
      )`);
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
      paramCount += 2; // We added 2 extra parameters
    }

    if (filter.tags && filter.tags.length > 0) {
      conditions.push(`tags && $${++paramCount}`);
      params.push(filter.tags);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM receipts WHERE ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Get receipts
    const receiptsQuery = `
      SELECT * FROM receipts 
      WHERE ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    params.push(pagination.limit, offset);

    const receiptsResult = await db.query(receiptsQuery, params);
    const receipts = receiptsResult.rows.map(row => this.mapDbReceiptToReceipt(row));

    return {
      receipts,
      total,
      totalPages: Math.ceil(total / pagination.limit)
    };
  }

  async getReceiptById(receiptId: string, userId: string): Promise<Receipt | null> {
    const result = await db.query(
      `SELECT * FROM receipts 
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [receiptId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapDbReceiptToReceipt(result.rows[0]);
  }

  async updateReceipt(
    receiptId: string, 
    userId: string, 
    updates: Partial<{
      vendorName: string;
      totalAmount: number;
      currency: string;
      receiptDate: Date;
      category: string;
      description: string;
      tags: string[];
    }>
  ): Promise<Receipt | null> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    // Build dynamic update query
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = this.mapFieldToDbColumn(key);
        updateFields.push(`${dbField} = $${++paramCount}`);
        params.push(value);
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(receiptId, userId);

    const query = `
      UPDATE receipts 
      SET ${updateFields.join(', ')}
      WHERE id = $${++paramCount} AND user_id = $${++paramCount} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, params);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapDbReceiptToReceipt(result.rows[0]);
  }

  async deleteReceipt(receiptId: string, userId: string): Promise<boolean> {
    // Get receipt first to get file path
    const receipt = await this.getReceiptById(receiptId, userId);
    if (!receipt) {
      return false;
    }

    // Soft delete in database
    const result = await db.query(
      `UPDATE receipts 
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [receiptId, userId]
    );

    if (result.rowCount === 0) {
      return false;
    }

    // Delete from storage (async, don't wait)
    storageService.deleteFile(receipt.filePath).catch(error => {
      console.error(`Failed to delete file ${receipt.filePath}:`, error);
    });

    return true;
  }

  private async findReceiptByHash(fileHash: string, userId: string): Promise<Receipt | null> {
    const result = await db.query(
      `SELECT * FROM receipts 
       WHERE file_hash = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [fileHash, userId]
    );

    return result.rows.length > 0 ? this.mapDbReceiptToReceipt(result.rows[0]) : null;
  }

  private mapDbReceiptToReceipt(row: any, thumbnailPath?: string): Receipt {
    return {
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      originalFilename: row.original_filename,
      filePath: row.file_path,
      fileSize: row.file_size,
      fileHash: row.file_hash,
      mimeType: row.mime_type,
      status: row.status,
      vendorName: row.vendor_name,
      totalAmount: row.total_amount ? parseFloat(row.total_amount) : undefined,
      currency: row.currency,
      receiptDate: row.receipt_date,
      category: row.category,
      description: row.description,
      tags: row.tags,
      thumbnailPath: thumbnailPath || row.thumbnail_path,
      ocrText: row.ocr_text,
      ocrConfidence: row.ocr_confidence,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapFieldToDbColumn(field: string): string {
    const mapping: Record<string, string> = {
      vendorName: 'vendor_name',
      totalAmount: 'total_amount',
      receiptDate: 'receipt_date'
    };
    return mapping[field] || field;
  }
}

export const receiptService = new ReceiptService();