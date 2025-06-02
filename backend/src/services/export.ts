import PDFKit from 'pdfkit';
import ExcelJS from 'exceljs';
import * as createCsvWriter from 'csv-writer';
import { db } from '../database/connection';
import { redis as redisClient } from '../config/redis';
import { storageService } from './storage';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';

export interface ExportFilters {
  userId: string;
  companyId?: string;
  receiptIds?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  category?: string;
  tags?: string[];
  merchantName?: string;
  amountMin?: number;
  amountMax?: number;
  status?: string;
  requiresApproval?: boolean;
  approvedBy?: string;
}

export interface ExportOptions {
  format: 'pdf' | 'csv' | 'excel';
  includeImages?: boolean;
  includeOcrText?: boolean;
  groupByCategory?: boolean;
  groupByMerchant?: boolean;
  sortBy?: 'date' | 'amount' | 'merchant' | 'category';
  sortOrder?: 'asc' | 'desc';
  customFields?: string[];
  template?: 'summary' | 'detailed' | 'financial';
}

export interface ExportJob {
  id: string;
  userId: string;
  companyId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: string;
  filters: ExportFilters;
  options: ExportOptions;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  recordCount?: number;
  error?: string;
  progress?: number;
  createdAt: Date;
  completedAt?: Date;
  expiresAt: Date;
}

class ExportService {
  async createExportJob(
    userId: string, 
    filters: ExportFilters, 
    options: ExportOptions
  ): Promise<ExportJob> {
    const jobId = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const job: ExportJob = {
      id: jobId,
      userId,
      companyId: filters.companyId,
      status: 'pending',
      format: options.format,
      filters,
      options,
      progress: 0,
      createdAt: new Date(),
      expiresAt
    };

    // Create export_jobs table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS export_jobs (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        company_id UUID,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        format VARCHAR(10) NOT NULL,
        filters JSONB NOT NULL,
        options JSONB NOT NULL,
        file_name VARCHAR(255),
        file_url VARCHAR(500),
        file_size BIGINT,
        record_count INTEGER,
        error TEXT,
        progress INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Store job in database
    await db.query(
      `INSERT INTO export_jobs (
        id, user_id, company_id, status, format, filters, options, 
        progress, created_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)`,
      [
        jobId, userId, filters.companyId, 'pending', options.format,
        JSON.stringify(filters), JSON.stringify(options), 0, expiresAt
      ]
    );

    // Store in Redis for quick access
    await redisClient.setex(`export_job:${jobId}`, 7 * 24 * 3600, JSON.stringify(job));

    // Start processing asynchronously
    setImmediate(() => this.processExportJob(jobId));

    return job;
  }

  async getExportJob(jobId: string, userId: string): Promise<ExportJob | null> {
    // Try Redis first
    const cached = await redisClient.get(`export_job:${jobId}`);
    if (cached) {
      const job = JSON.parse(cached);
      if (job.userId === userId) {
        return job;
      }
    }

    // Fall back to database
    const result = await db.query(
      `SELECT * FROM export_jobs 
       WHERE id = $1 AND user_id = $2`,
      [jobId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      status: row.status,
      format: row.format,
      filters: JSON.parse(row.filters),
      options: JSON.parse(row.options),
      fileName: row.file_name,
      fileUrl: row.file_url,
      fileSize: row.file_size,
      recordCount: row.record_count,
      error: row.error,
      progress: row.progress,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      expiresAt: row.expires_at
    };
  }

  async getUserExportJobs(userId: string, limit: number = 10): Promise<ExportJob[]> {
    const result = await db.query(
      `SELECT * FROM export_jobs 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      status: row.status,
      format: row.format,
      filters: JSON.parse(row.filters),
      options: JSON.parse(row.options),
      fileName: row.file_name,
      fileUrl: row.file_url,
      fileSize: row.file_size,
      recordCount: row.record_count,
      error: row.error,
      progress: row.progress,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      expiresAt: row.expires_at
    }));
  }

  private async processExportJob(jobId: string): Promise<void> {
    try {
      // Update status to processing
      await this.updateJobStatus(jobId, 'processing', 0);

      // Get job details
      const jobResult = await db.query('SELECT * FROM export_jobs WHERE id = $1', [jobId]);
      if (jobResult.rows.length === 0) {
        throw new Error('Export job not found');
      }

      const job = jobResult.rows[0];
      const filters: ExportFilters = JSON.parse(job.filters);
      const options: ExportOptions = JSON.parse(job.options);

      // Get receipts data
      const receipts = await this.getReceiptsForExport(filters);
      await this.updateJobProgress(jobId, 25);

      if (receipts.length === 0) {
        await this.updateJobStatus(jobId, 'completed', 100, {
          fileName: `no_receipts.${options.format}`,
          recordCount: 0
        });
        return;
      }

      // Generate export file
      let filePath: string;
      let fileName: string;
      let result: { filePath: string; fileName: string };

      switch (options.format) {
        case 'pdf':
          result = await this.generatePDF(receipts, options);
          filePath = result.filePath;
          fileName = result.fileName;
          break;
        case 'csv':
          result = await this.generateCSV(receipts, options);
          filePath = result.filePath;
          fileName = result.fileName;
          break;
        case 'excel':
          result = await this.generateExcel(receipts, options);
          filePath = result.filePath;
          fileName = result.fileName;
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      await this.updateJobProgress(jobId, 75);

      // Upload to MinIO
      const fileBuffer = fs.readFileSync(filePath);
      
      const uploadResult = await storageService.uploadFile(
        fileBuffer,
        job.user_id,
        fileName
      );

      // Clean up local file
      fs.unlinkSync(filePath);

      // Generate signed URL (valid for 7 days)
      const fileUrl = await storageService.generateSignedUrl(uploadResult.filePath, 7 * 24 * 3600);

      await this.updateJobStatus(jobId, 'completed', 100, {
        fileName,
        fileUrl,
        fileSize: fileBuffer.length,
        recordCount: receipts.length
      });

    } catch (error) {
      console.error(`Export job ${jobId} failed:`, error);
      await this.updateJobStatus(jobId, 'failed', 0, {
        error: error.message
      });
    }
  }

  private async getReceiptsForExport(filters: ExportFilters): Promise<any[]> {
    const whereConditions = ['r.deleted_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    // Base user filter
    whereConditions.push(`r.user_id = $${paramIndex++}`);
    params.push(filters.userId);

    if (filters.companyId) {
      whereConditions.push(`r.company_id = $${paramIndex++}`);
      params.push(filters.companyId);
    }

    // Specific receipt IDs
    if (filters.receiptIds && filters.receiptIds.length > 0) {
      whereConditions.push(`r.id = ANY($${paramIndex++})`);
      params.push(filters.receiptIds);
    }

    // Date range
    if (filters.dateFrom) {
      whereConditions.push(`r.receipt_date >= $${paramIndex++}`);
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      whereConditions.push(`r.receipt_date <= $${paramIndex++}`);
      params.push(filters.dateTo);
    }

    // Category filter
    if (filters.category) {
      whereConditions.push(`r.category = $${paramIndex++}`);
      params.push(filters.category);
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      whereConditions.push(`r.tags @> $${paramIndex++}`);
      params.push(JSON.stringify(filters.tags));
    }

    // Merchant filter
    if (filters.merchantName) {
      whereConditions.push(`r.vendor_name ILIKE $${paramIndex++}`);
      params.push(`%${filters.merchantName}%`);
    }

    // Amount range
    if (filters.amountMin !== undefined) {
      whereConditions.push(`r.total_amount >= $${paramIndex++}`);
      params.push(filters.amountMin);
    }

    if (filters.amountMax !== undefined) {
      whereConditions.push(`r.total_amount <= $${paramIndex++}`);
      params.push(filters.amountMax);
    }

    // Status filter
    if (filters.status) {
      whereConditions.push(`r.status = $${paramIndex++}`);
      params.push(filters.status);
    }

    // Approval filters
    if (filters.requiresApproval !== undefined) {
      whereConditions.push(`r.requires_approval = $${paramIndex++}`);
      params.push(filters.requiresApproval);
    }

    if (filters.approvedBy) {
      whereConditions.push(`r.approved_by = $${paramIndex++}`);
      params.push(filters.approvedBy);
    }

    const whereClause = whereConditions.join(' AND ');

    const query = `
      SELECT 
        r.id, r.original_filename, r.vendor_name, r.vendor_address,
        r.total_amount, r.subtotal_amount, r.tax_amount, r.tip_amount,
        r.currency, r.receipt_date, r.receipt_time, r.receipt_number,
        r.payment_method, r.category, r.subcategory, r.tags,
        r.description, r.notes, r.project_code, r.department,
        r.cost_center, r.employee_id, r.requires_approval,
        r.approved_by, r.approved_at, r.approval_notes,
        r.status, r.ocr_text, r.ocr_confidence, r.file_path,
        r.created_at, r.updated_at,
        u.first_name as approver_first_name,
        u.last_name as approver_last_name
      FROM receipts r
      LEFT JOIN users u ON r.approved_by = u.id
      WHERE ${whereClause}
      ORDER BY r.receipt_date DESC, r.created_at DESC
    `;

    const result = await db.query(query, params);
    return result.rows;
  }

  private async generatePDF(receipts: any[], options: ExportOptions): Promise<{ filePath: string; fileName: string }> {
    const fileName = `receipts_export_${Date.now()}.pdf`;
    const filePath = path.join('/tmp', fileName);
    
    const doc = new PDFKit({ margin: 50 });
    doc.pipe(fs.createWriteStream(filePath));

    // Title page
    doc.fontSize(20).text('Receipt Export Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.text(`Total Records: ${receipts.length}`, { align: 'center' });
    doc.moveDown(2);

    // Summary section
    if (options.template === 'summary' || options.template === 'financial') {
      const totalAmount = receipts.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
      const categories = [...new Set(receipts.map(r => r.category).filter(Boolean))];
      const merchants = [...new Set(receipts.map(r => r.vendor_name).filter(Boolean))];

      doc.fontSize(16).text('Summary', { underline: true });
      doc.fontSize(12);
      doc.text(`Total Amount: $${totalAmount.toFixed(2)}`);
      doc.text(`Categories: ${categories.length}`);
      doc.text(`Merchants: ${merchants.length}`);
      doc.moveDown();
    }

    // Group receipts if requested
    let groupedReceipts: { [key: string]: any[] } = { 'All Receipts': receipts };
    
    if (options.groupByCategory) {
      groupedReceipts = receipts.reduce((groups, receipt) => {
        const category = receipt.category || 'Uncategorized';
        if (!groups[category]) groups[category] = [];
        groups[category].push(receipt);
        return groups;
      }, {} as { [key: string]: any[] });
    } else if (options.groupByMerchant) {
      groupedReceipts = receipts.reduce((groups, receipt) => {
        const merchant = receipt.vendor_name || 'Unknown Merchant';
        if (!groups[merchant]) groups[merchant] = [];
        groups[merchant].push(receipt);
        return groups;
      }, {} as { [key: string]: any[] });
    }

    // Generate content for each group
    for (const [groupName, groupReceipts] of Object.entries(groupedReceipts)) {
      if (Object.keys(groupedReceipts).length > 1) {
        doc.addPage();
        doc.fontSize(16).text(groupName, { underline: true });
        doc.moveDown();
      }

      for (const receipt of groupReceipts) {
        // Check if we need a new page
        if (doc.y > 700) {
          doc.addPage();
        }

        doc.fontSize(14).text(`Receipt: ${receipt.vendor_name || 'Unknown'}`, { underline: true });
        doc.fontSize(10);
        
        const leftColumn = [
          `Date: ${receipt.receipt_date ? new Date(receipt.receipt_date).toLocaleDateString() : 'N/A'}`,
          `Amount: $${(parseFloat(receipt.total_amount) || 0).toFixed(2)}`,
          `Category: ${receipt.category || 'N/A'}`,
          `Payment: ${receipt.payment_method || 'N/A'}`
        ];

        const rightColumn = [
          `Receipt #: ${receipt.receipt_number || 'N/A'}`,
          `Currency: ${receipt.currency || 'USD'}`,
          `Status: ${receipt.status}`,
          `File: ${receipt.original_filename || 'N/A'}`
        ];

        // Two-column layout
        const startY = doc.y;
        leftColumn.forEach((line, index) => {
          doc.text(line, 50, startY + (index * 15));
        });
        rightColumn.forEach((line, index) => {
          doc.text(line, 300, startY + (index * 15));
        });

        doc.y = startY + (Math.max(leftColumn.length, rightColumn.length) * 15);

        if (receipt.description) {
          doc.text(`Description: ${receipt.description}`);
        }

        if (receipt.notes) {
          doc.text(`Notes: ${receipt.notes}`);
        }

        if (options.includeOcrText && receipt.ocr_text) {
          doc.fontSize(8).text(`OCR Text: ${receipt.ocr_text.substring(0, 200)}...`);
        }

        doc.moveDown();
      }
    }

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve({ filePath, fileName }));
      doc.on('error', reject);
    });
  }

  private async generateCSV(receipts: any[], options: ExportOptions): Promise<{ filePath: string; fileName: string }> {
    const fileName = `receipts_export_${Date.now()}.csv`;
    const filePath = path.join('/tmp', fileName);

    // Define CSV headers
    const headers = [
      { id: 'vendor_name', title: 'Merchant' },
      { id: 'receipt_date', title: 'Date' },
      { id: 'total_amount', title: 'Amount' },
      { id: 'currency', title: 'Currency' },
      { id: 'category', title: 'Category' },
      { id: 'subcategory', title: 'Subcategory' },
      { id: 'payment_method', title: 'Payment Method' },
      { id: 'receipt_number', title: 'Receipt Number' },
      { id: 'description', title: 'Description' },
      { id: 'notes', title: 'Notes' },
      { id: 'project_code', title: 'Project Code' },
      { id: 'department', title: 'Department' },
      { id: 'cost_center', title: 'Cost Center' },
      { id: 'status', title: 'Status' },
      { id: 'created_at', title: 'Created At' }
    ];

    // Add custom fields if specified
    if (options.customFields) {
      options.customFields.forEach(field => {
        if (!headers.find(h => h.id === field)) {
          headers.push({ id: field, title: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) });
        }
      });
    }

    // Include OCR text if requested
    if (options.includeOcrText) {
      headers.push({ id: 'ocr_text', title: 'OCR Text' });
      headers.push({ id: 'ocr_confidence', title: 'OCR Confidence' });
    }

    const csvWriter = createCsvWriter.createObjectCsvWriter({
      path: filePath,
      header: headers
    });

    // Process data
    const processedReceipts = receipts.map(receipt => {
      const processed: any = {
        vendor_name: receipt.vendor_name || '',
        receipt_date: receipt.receipt_date ? new Date(receipt.receipt_date).toLocaleDateString() : '',
        total_amount: receipt.total_amount || '',
        currency: receipt.currency || 'USD',
        category: receipt.category || '',
        subcategory: receipt.subcategory || '',
        payment_method: receipt.payment_method || '',
        receipt_number: receipt.receipt_number || '',
        description: receipt.description || '',
        notes: receipt.notes || '',
        project_code: receipt.project_code || '',
        department: receipt.department || '',
        cost_center: receipt.cost_center || '',
        status: receipt.status || '',
        created_at: new Date(receipt.created_at).toLocaleString()
      };

      if (options.includeOcrText) {
        processed.ocr_text = receipt.ocr_text || '';
        processed.ocr_confidence = receipt.ocr_confidence || '';
      }

      // Add custom fields
      if (options.customFields) {
        options.customFields.forEach(field => {
          if (receipt[field] !== undefined) {
            processed[field] = receipt[field];
          }
        });
      }

      return processed;
    });

    await csvWriter.writeRecords(processedReceipts);
    return { filePath, fileName };
  }

  private async generateExcel(receipts: any[], options: ExportOptions): Promise<{ filePath: string; fileName: string }> {
    const fileName = `receipts_export_${Date.now()}.xlsx`;
    const filePath = path.join('/tmp', fileName);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Receipt Vault';
    workbook.created = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Receipt Export Summary']);
    summarySheet.addRow(['Generated on:', new Date().toLocaleString()]);
    summarySheet.addRow(['Total Records:', receipts.length]);
    
    const totalAmount = receipts.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    summarySheet.addRow(['Total Amount:', `$${totalAmount.toFixed(2)}`]);
    
    const categories = [...new Set(receipts.map(r => r.category).filter(Boolean))];
    summarySheet.addRow(['Categories:', categories.length]);
    
    const merchants = [...new Set(receipts.map(r => r.vendor_name).filter(Boolean))];
    summarySheet.addRow(['Merchants:', merchants.length]);

    // Style summary sheet
    summarySheet.getCell('A1').font = { bold: true, size: 16 };
    summarySheet.getColumn('A').width = 20;
    summarySheet.getColumn('B').width = 30;

    // Main data sheet
    const dataSheet = workbook.addWorksheet('Receipts');
    
    // Headers
    const headers = [
      'Merchant', 'Date', 'Amount', 'Currency', 'Category', 'Subcategory',
      'Payment Method', 'Receipt Number', 'Description', 'Notes',
      'Project Code', 'Department', 'Cost Center', 'Status', 'Created At'
    ];

    if (options.includeOcrText) {
      headers.push('OCR Text', 'OCR Confidence');
    }

    dataSheet.addRow(headers);
    
    // Style headers
    const headerRow = dataSheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' }
    };

    // Data rows
    receipts.forEach(receipt => {
      const row = [
        receipt.vendor_name || '',
        receipt.receipt_date ? new Date(receipt.receipt_date).toLocaleDateString() : '',
        parseFloat(receipt.total_amount) || 0,
        receipt.currency || 'USD',
        receipt.category || '',
        receipt.subcategory || '',
        receipt.payment_method || '',
        receipt.receipt_number || '',
        receipt.description || '',
        receipt.notes || '',
        receipt.project_code || '',
        receipt.department || '',
        receipt.cost_center || '',
        receipt.status || '',
        new Date(receipt.created_at).toLocaleString()
      ];

      if (options.includeOcrText) {
        row.push(receipt.ocr_text || '', receipt.ocr_confidence || '');
      }

      dataSheet.addRow(row);
    });

    // Auto-fit columns
    dataSheet.columns.forEach(column => {
      column.width = 15;
    });

    // Add filters to data sheet
    dataSheet.autoFilter = {
      from: 'A1',
      to: `${String.fromCharCode(64 + headers.length)}${receipts.length + 1}`
    };

    // Category breakdown sheet
    if (options.groupByCategory) {
      const categorySheet = workbook.addWorksheet('By Category');
      const categoryBreakdown = receipts.reduce((acc, receipt) => {
        const category = receipt.category || 'Uncategorized';
        if (!acc[category]) {
          acc[category] = { count: 0, total: 0 };
        }
        acc[category].count++;
        acc[category].total += parseFloat(receipt.total_amount) || 0;
        return acc;
      }, {} as { [key: string]: { count: number; total: number } });

      categorySheet.addRow(['Category', 'Count', 'Total Amount']);
      const catHeaderRow = categorySheet.getRow(1);
      catHeaderRow.font = { bold: true };

      Object.entries(categoryBreakdown).forEach(([category, data]) => {
        const typedData = data as { count: number; total: number };
        categorySheet.addRow([category, typedData.count, typedData.total]);
      });

      categorySheet.getColumn('A').width = 20;
      categorySheet.getColumn('B').width = 10;
      categorySheet.getColumn('C').width = 15;
    }

    await workbook.xlsx.writeFile(filePath);
    return { filePath, fileName };
  }

  private async updateJobStatus(
    jobId: string, 
    status: string, 
    progress: number, 
    updates: any = {}
  ): Promise<void> {
    const updateFields = ['status = $2', 'progress = $3'];
    const params = [jobId, status, progress];
    let paramIndex = 4;

    if (updates.fileName) {
      updateFields.push(`file_name = $${paramIndex++}`);
      params.push(updates.fileName);
    }

    if (updates.fileUrl) {
      updateFields.push(`file_url = $${paramIndex++}`);
      params.push(updates.fileUrl);
    }

    if (updates.fileSize) {
      updateFields.push(`file_size = $${paramIndex++}`);
      params.push(updates.fileSize);
    }

    if (updates.recordCount !== undefined) {
      updateFields.push(`record_count = $${paramIndex++}`);
      params.push(updates.recordCount);
    }

    if (updates.error) {
      updateFields.push(`error = $${paramIndex++}`);
      params.push(updates.error);
    }

    if (status === 'completed' || status === 'failed') {
      updateFields.push('completed_at = NOW()');
    }

    const query = `
      UPDATE export_jobs 
      SET ${updateFields.join(', ')}
      WHERE id = $1
    `;

    await db.query(query, params);

    // Update Redis cache
    const job = await this.getExportJob(jobId, ''); // Get without user check for internal update
    if (job) {
      job.status = status as any;
      job.progress = progress;
      Object.assign(job, updates);
      await redisClient.setex(`export_job:${jobId}`, 7 * 24 * 3600, JSON.stringify(job));
    }
  }

  private async updateJobProgress(jobId: string, progress: number): Promise<void> {
    await this.updateJobStatus(jobId, 'processing', progress);
  }

  private getMimeType(format: string): string {
    const mimeTypes = {
      pdf: 'application/pdf',
      csv: 'text/csv',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return mimeTypes[format] || 'application/octet-stream';
  }

  async cleanupExpiredJobs(): Promise<void> {
    // Delete expired export jobs
    await db.query(
      'DELETE FROM export_jobs WHERE expires_at < NOW()'
    );
  }
}

export const exportService = new ExportService();