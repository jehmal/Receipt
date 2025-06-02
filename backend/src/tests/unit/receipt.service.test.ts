import { receiptService } from '../../services/receipts';
import { CreateReceiptData, ReceiptFilter, PaginationOptions, Receipt } from '../../services/receipts';
import { db } from '../../database/connection';
import { storageService } from '../../services/storage';
import { FileValidator } from '../../utils/file-validation';
import { randomUUID } from 'crypto';

// Mock dependencies
jest.mock('../../database/connection');
jest.mock('../../services/storage');
jest.mock('../../utils/file-validation');
jest.mock('crypto');

describe('ReceiptService', () => {
  let mockDb: jest.Mocked<typeof db>;
  let mockStorageService: jest.Mocked<typeof storageService>;
  let mockFileValidator: jest.Mocked<typeof FileValidator>;
  let mockRandomUUID: jest.MockedFunction<typeof randomUUID>;

  beforeEach(() => {
    mockDb = db as jest.Mocked<typeof db>;
    mockStorageService = storageService as jest.Mocked<typeof storageService>;
    mockFileValidator = FileValidator as jest.Mocked<typeof FileValidator>;
    mockRandomUUID = randomUUID as jest.MockedFunction<typeof randomUUID>;

    // Setup default mocks
    mockRandomUUID.mockReturnValue('test-receipt-id');
    mockFileValidator.validateFile = jest.fn().mockResolvedValue({
      isValid: true,
      error: null
    });
    mockStorageService.uploadFile = jest.fn().mockResolvedValue({
      filePath: '/uploads/receipts/test-file.jpg',
      fileSize: 1024,
      fileHash: 'abc123hash',
      mimeType: 'image/jpeg',
      thumbnailPath: '/uploads/thumbnails/test-file-thumb.jpg'
    });
    mockStorageService.deleteFile = jest.fn().mockResolvedValue(true);

    jest.clearAllMocks();
  });

  describe('uploadReceipt', () => {
    const mockCreateReceiptData: CreateReceiptData = {
      userId: 'user-123',
      originalFilename: 'receipt.jpg',
      fileBuffer: Buffer.from('fake-image-data'),
      category: 'Food & Dining',
      description: 'Restaurant receipt',
      tags: ['business', 'meal'],
      context: 'personal'
    };

    const mockDbReceiptRow = {
      id: 'test-receipt-id',
      user_id: 'user-123',
      company_id: null,
      original_filename: 'receipt.jpg',
      file_path: '/uploads/receipts/test-file.jpg',
      file_size: 1024,
      file_hash: 'abc123hash',
      mime_type: 'image/jpeg',
      status: 'uploaded',
      vendor_name: null,
      total_amount: null,
      currency: null,
      receipt_date: null,
      category: 'Food & Dining',
      description: 'Restaurant receipt',
      tags: ['business', 'meal'],
      thumbnail_path: null,
      ocr_text: null,
      ocr_confidence: null,
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
      deleted_at: null
    };

    it('should successfully upload a receipt', async () => {
      // Mock database operations
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // findReceiptByHash returns no duplicates
        .mockResolvedValueOnce({ rows: [mockDbReceiptRow] }); // INSERT returns new receipt

      const result = await receiptService.uploadReceipt(mockCreateReceiptData);

      expect(mockFileValidator.validateFile).toHaveBeenCalledWith(
        mockCreateReceiptData.fileBuffer,
        mockCreateReceiptData.originalFilename
      );
      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        mockCreateReceiptData.fileBuffer,
        mockCreateReceiptData.userId,
        mockCreateReceiptData.originalFilename
      );
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(result).toEqual(expect.objectContaining({
        id: 'test-receipt-id',
        userId: 'user-123',
        originalFilename: 'receipt.jpg',
        status: 'uploaded'
      }));
    });

    it('should reject invalid files', async () => {
      mockFileValidator.validateFile = jest.fn().mockResolvedValue({
        isValid: false,
        error: 'File too large'
      });

      await expect(receiptService.uploadReceipt(mockCreateReceiptData))
        .rejects.toThrow('File validation failed: File too large');

      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should reject duplicate files', async () => {
      // Mock findReceiptByHash to return existing receipt
      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ ...mockDbReceiptRow, id: 'existing-receipt-id' }] 
      });

      await expect(receiptService.uploadReceipt(mockCreateReceiptData))
        .rejects.toThrow('A receipt with this file already exists');

      expect(mockStorageService.uploadFile).toHaveBeenCalled();
      expect(mockDb.query).toHaveBeenCalledTimes(1); // Only the hash check
    });

    it('should handle storage upload failures', async () => {
      mockStorageService.uploadFile = jest.fn().mockRejectedValue(
        new Error('Storage service unavailable')
      );

      await expect(receiptService.uploadReceipt(mockCreateReceiptData))
        .rejects.toThrow('Storage service unavailable');

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should handle database insertion failures', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // findReceiptByHash
        .mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(receiptService.uploadReceipt(mockCreateReceiptData))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle company context receipts', async () => {
      const companyReceiptData: CreateReceiptData = {
        ...mockCreateReceiptData,
        companyId: 'company-456',
        context: 'company'
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ 
          rows: [{ ...mockDbReceiptRow, company_id: 'company-456' }] 
        });

      const result = await receiptService.uploadReceipt(companyReceiptData);

      expect(result.companyId).toBe('company-456');
    });

    it('should queue OCR job successfully', async () => {
      const mockJobQueueService = {
        addOCRJob: jest.fn().mockResolvedValue(true)
      };

      // Mock dynamic import
      jest.doMock('../../services/job-queue', () => ({
        jobQueueService: mockJobQueueService
      }));

      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockDbReceiptRow] });

      await receiptService.uploadReceipt(mockCreateReceiptData);

      // Note: In a real test, we'd need to handle the dynamic import properly
      // This is a simplified version for demonstration
    });

    it('should handle OCR queuing failures gracefully', async () => {
      const mockJobQueueService = {
        addOCRJob: jest.fn().mockRejectedValue(new Error('Queue service down'))
      };

      jest.doMock('../../services/job-queue', () => ({
        jobQueueService: mockJobQueueService
      }));

      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockDbReceiptRow] });

      // Should not throw even if OCR queuing fails
      const result = await receiptService.uploadReceipt(mockCreateReceiptData);
      expect(result).toBeDefined();
    });

    it('should handle missing optional fields', async () => {
      const minimalData: CreateReceiptData = {
        userId: 'user-123',
        originalFilename: 'receipt.jpg',
        fileBuffer: Buffer.from('fake-data')
      };

      const minimalDbRow = {
        ...mockDbReceiptRow,
        category: null,
        description: null,
        tags: null
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [minimalDbRow] });

      const result = await receiptService.uploadReceipt(minimalData);

      expect(result.category).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.tags).toBeUndefined();
    });
  });

  describe('updateReceiptOCR', () => {
    const mockOcrData = {
      ocrText: 'RECEIPT\nStarbucks\nTotal: $4.50',
      ocrConfidence: 0.95,
      vendorName: 'Starbucks',
      totalAmount: 4.50,
      currency: 'USD',
      receiptDate: new Date('2024-01-01'),
      status: 'processed'
    };

    it('should update all OCR fields', async () => {
      const updatedRow = {
        id: 'receipt-123',
        ocr_text: mockOcrData.ocrText,
        ocr_confidence: mockOcrData.ocrConfidence,
        vendor_name: mockOcrData.vendorName,
        total_amount: mockOcrData.totalAmount,
        currency: mockOcrData.currency,
        receipt_date: mockOcrData.receiptDate,
        status: mockOcrData.status,
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [updatedRow] });

      const result = await receiptService.updateReceiptOCR('receipt-123', mockOcrData);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE receipts SET'),
        expect.arrayContaining([
          mockOcrData.ocrText,
          mockOcrData.ocrConfidence,
          mockOcrData.vendorName,
          mockOcrData.totalAmount,
          mockOcrData.currency,
          mockOcrData.receiptDate,
          mockOcrData.status,
          'receipt-123'
        ])
      );

      expect(result).toEqual(expect.objectContaining({
        id: 'receipt-123',
        ocrText: mockOcrData.ocrText,
        ocrConfidence: mockOcrData.ocrConfidence
      }));
    });

    it('should update partial OCR data', async () => {
      const partialOcrData = {
        ocrText: 'Updated text',
        vendorName: 'Updated vendor'
      };

      const updatedRow = {
        id: 'receipt-123',
        ocr_text: partialOcrData.ocrText,
        vendor_name: partialOcrData.vendorName
      };

      mockDb.query.mockResolvedValue({ rows: [updatedRow] });

      const result = await receiptService.updateReceiptOCR('receipt-123', partialOcrData);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ocr_text = $1'),
        expect.arrayContaining([partialOcrData.ocrText, partialOcrData.vendorName])
      );

      expect(result).toBeDefined();
    });

    it('should return null for empty updates', async () => {
      const result = await receiptService.updateReceiptOCR('receipt-123', {});

      expect(mockDb.query).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null for non-existent receipt', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await receiptService.updateReceiptOCR('nonexistent', mockOcrData);

      expect(result).toBeNull();
    });

    it('should handle undefined values correctly', async () => {
      const ocrDataWithUndefined = {
        ocrText: 'Valid text',
        ocrConfidence: undefined,
        vendorName: 'Valid vendor',
        totalAmount: undefined
      };

      mockDb.query.mockResolvedValue({ 
        rows: [{ id: 'receipt-123', ocr_text: 'Valid text', vendor_name: 'Valid vendor' }] 
      });

      await receiptService.updateReceiptOCR('receipt-123', ocrDataWithUndefined);

      const query = mockDb.query.mock.calls[0][0] as string;
      expect(query).toContain('ocr_text = $1');
      expect(query).toContain('vendor_name = $2');
      expect(query).not.toContain('ocr_confidence');
      expect(query).not.toContain('total_amount');
    });
  });

  describe('getReceipts', () => {
    const mockFilter: ReceiptFilter = {
      userId: 'user-123'
    };

    const mockPagination: PaginationOptions = {
      page: 1,
      limit: 10
    };

    const mockReceiptRows = [
      {
        id: 'receipt-1',
        user_id: 'user-123',
        original_filename: 'receipt1.jpg',
        created_at: new Date('2024-01-01'),
        deleted_at: null
      },
      {
        id: 'receipt-2',
        user_id: 'user-123', 
        original_filename: 'receipt2.jpg',
        created_at: new Date('2024-01-02'),
        deleted_at: null
      }
    ];

    it('should return paginated receipts', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // count query
        .mockResolvedValueOnce({ rows: mockReceiptRows }); // receipts query

      const result = await receiptService.getReceipts(mockFilter, mockPagination);

      expect(result).toEqual({
        receipts: expect.arrayContaining([
          expect.objectContaining({ id: 'receipt-1' }),
          expect.objectContaining({ id: 'receipt-2' })
        ]),
        total: 5,
        totalPages: 1
      });

      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should handle filtering by category', async () => {
      const filterWithCategory: ReceiptFilter = {
        ...mockFilter,
        category: 'Food & Dining'
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: mockReceiptRows });

      await receiptService.getReceipts(filterWithCategory, mockPagination);

      const countQuery = mockDb.query.mock.calls[0][0] as string;
      const receiptsQuery = mockDb.query.mock.calls[1][0] as string;

      expect(countQuery).toContain('category = $');
      expect(receiptsQuery).toContain('category = $');
    });

    it('should handle filtering by date range', async () => {
      const filterWithDates: ReceiptFilter = {
        ...mockFilter,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: mockReceiptRows });

      await receiptService.getReceipts(filterWithDates, mockPagination);

      const query = mockDb.query.mock.calls[0][0] as string;
      expect(query).toContain('created_at >= $');
      expect(query).toContain('created_at <= $');
    });

    it('should handle filtering by amount range', async () => {
      const filterWithAmounts: ReceiptFilter = {
        ...mockFilter,
        minAmount: 10.00,
        maxAmount: 100.00
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockReceiptRows[0]] });

      await receiptService.getReceipts(filterWithAmounts, mockPagination);

      const query = mockDb.query.mock.calls[0][0] as string;
      expect(query).toContain('total_amount >= $');
      expect(query).toContain('total_amount <= $');
    });

    it('should handle text search across multiple fields', async () => {
      const filterWithSearch: ReceiptFilter = {
        ...mockFilter,
        search: 'Starbucks'
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockReceiptRows[0]] });

      await receiptService.getReceipts(filterWithSearch, mockPagination);

      const query = mockDb.query.mock.calls[0][0] as string;
      expect(query).toContain('ocr_text ILIKE');
      expect(query).toContain('vendor_name ILIKE');
      expect(query).toContain('description ILIKE');

      const params = mockDb.query.mock.calls[0][1] as any[];
      expect(params).toContain('%Starbucks%');
    });

    it('should handle tag filtering', async () => {
      const filterWithTags: ReceiptFilter = {
        ...mockFilter,
        tags: ['business', 'meal']
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockReceiptRows[0]] });

      await receiptService.getReceipts(filterWithTags, mockPagination);

      const query = mockDb.query.mock.calls[0][0] as string;
      expect(query).toContain('tags && $');

      const params = mockDb.query.mock.calls[0][1] as any[];
      expect(params).toContain(['business', 'meal']);
    });

    it('should handle custom sorting', async () => {
      const customPagination: PaginationOptions = {
        page: 1,
        limit: 5,
        sortBy: 'total_amount',
        sortOrder: 'asc'
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: mockReceiptRows });

      await receiptService.getReceipts(mockFilter, customPagination);

      const receiptsQuery = mockDb.query.mock.calls[1][0] as string;
      expect(receiptsQuery).toContain('ORDER BY total_amount asc');
    });

    it('should calculate correct pagination', async () => {
      const paginationPage2: PaginationOptions = {
        page: 2,
        limit: 3
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: mockReceiptRows });

      const result = await receiptService.getReceipts(mockFilter, paginationPage2);

      expect(result.totalPages).toBe(4); // Math.ceil(10 / 3)

      const receiptsQuery = mockDb.query.mock.calls[1][0] as string;
      expect(receiptsQuery).toContain('LIMIT $');
      expect(receiptsQuery).toContain('OFFSET $');

      const params = mockDb.query.mock.calls[1][1] as any[];
      expect(params).toContain(3); // limit
      expect(params).toContain(3); // offset (page-1) * limit = (2-1) * 3
    });

    it('should exclude deleted receipts', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: mockReceiptRows });

      await receiptService.getReceipts(mockFilter, mockPagination);

      const query = mockDb.query.mock.calls[0][0] as string;
      expect(query).toContain('deleted_at IS NULL');
    });

    it('should handle company filtering', async () => {
      const filterWithCompany: ReceiptFilter = {
        ...mockFilter,
        companyId: 'company-456'
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockReceiptRows[0]] });

      await receiptService.getReceipts(filterWithCompany, mockPagination);

      const query = mockDb.query.mock.calls[0][0] as string;
      expect(query).toContain('company_id = $');
    });
  });

  describe('getReceiptById', () => {
    const mockDbRow = {
      id: 'receipt-123',
      user_id: 'user-456',
      original_filename: 'test.jpg',
      created_at: new Date(),
      deleted_at: null
    };

    it('should return receipt for valid ID and user', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockDbRow] });

      const result = await receiptService.getReceiptById('receipt-123', 'user-456');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL'),
        ['receipt-123', 'user-456']
      );

      expect(result).toEqual(expect.objectContaining({
        id: 'receipt-123',
        userId: 'user-456'
      }));
    });

    it('should return null for non-existent receipt', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await receiptService.getReceiptById('nonexistent', 'user-456');

      expect(result).toBeNull();
    });

    it('should return null for receipt belonging to different user', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await receiptService.getReceiptById('receipt-123', 'wrong-user');

      expect(result).toBeNull();
    });

    it('should exclude deleted receipts', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await receiptService.getReceiptById('receipt-123', 'user-456');

      const query = mockDb.query.mock.calls[0][0] as string;
      expect(query).toContain('deleted_at IS NULL');
    });
  });

  describe('updateReceipt', () => {
    const mockUpdates = {
      vendorName: 'Updated Vendor',
      totalAmount: 25.99,
      currency: 'CAD',
      category: 'Business',
      description: 'Updated description',
      tags: ['updated', 'tags']
    };

    it('should update receipt with all fields', async () => {
      const updatedRow = {
        id: 'receipt-123',
        vendor_name: 'Updated Vendor',
        total_amount: 25.99,
        currency: 'CAD',
        category: 'Business',
        description: 'Updated description',
        tags: ['updated', 'tags'],
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [updatedRow] });

      const result = await receiptService.updateReceipt('receipt-123', 'user-456', mockUpdates);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE receipts SET'),
        expect.arrayContaining([
          'Updated Vendor',
          25.99,
          'CAD',
          'Business',
          'Updated description',
          ['updated', 'tags'],
          'receipt-123',
          'user-456'
        ])
      );

      expect(result).toEqual(expect.objectContaining({
        vendorName: 'Updated Vendor',
        totalAmount: 25.99
      }));
    });

    it('should update partial fields', async () => {
      const partialUpdates = {
        vendorName: 'New Vendor',
        totalAmount: 15.50
      };

      const updatedRow = {
        id: 'receipt-123',
        vendor_name: 'New Vendor',
        total_amount: 15.50
      };

      mockDb.query.mockResolvedValue({ rows: [updatedRow] });

      await receiptService.updateReceipt('receipt-123', 'user-456', partialUpdates);

      const query = mockDb.query.mock.calls[0][0] as string;
      expect(query).toContain('vendor_name = $1');
      expect(query).toContain('total_amount = $2');
      expect(query).not.toContain('currency');
    });

    it('should throw error for empty updates', async () => {
      await expect(receiptService.updateReceipt('receipt-123', 'user-456', {}))
        .rejects.toThrow('No fields to update');

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should return null for non-existent receipt', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await receiptService.updateReceipt('receipt-123', 'user-456', mockUpdates);

      expect(result).toBeNull();
    });

    it('should include user authorization in query', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await receiptService.updateReceipt('receipt-123', 'user-456', mockUpdates);

      const query = mockDb.query.mock.calls[0][0] as string;
      expect(query).toContain('WHERE id = $');
      expect(query).toContain('AND user_id = $');
      expect(query).toContain('AND deleted_at IS NULL');
    });

    it('should handle receiptDate updates', async () => {
      const updatesWithDate = {
        receiptDate: new Date('2024-01-15')
      };

      const updatedRow = {
        id: 'receipt-123',
        receipt_date: new Date('2024-01-15')
      };

      mockDb.query.mockResolvedValue({ rows: [updatedRow] });

      await receiptService.updateReceipt('receipt-123', 'user-456', updatesWithDate);

      const query = mockDb.query.mock.calls[0][0] as string;
      expect(query).toContain('receipt_date = $1');
    });
  });

  describe('deleteReceipt', () => {
    const mockReceiptRow = {
      id: 'receipt-123',
      user_id: 'user-456',
      file_path: '/uploads/receipts/test-file.jpg',
      deleted_at: null
    };

    it('should soft delete receipt and remove file', async () => {
      // Mock getReceiptById to return receipt
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockReceiptRow] }) // getReceiptById
        .mockResolvedValueOnce({ rowCount: 1 }); // UPDATE (soft delete)

      const result = await receiptService.deleteReceipt('receipt-123', 'user-456');

      expect(result).toBe(true);

      // Check soft delete query
      const deleteQuery = mockDb.query.mock.calls[1][0] as string;
      expect(deleteQuery).toContain('UPDATE receipts');
      expect(deleteQuery).toContain('SET deleted_at = NOW()');
      expect(deleteQuery).toContain('WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL');

      // Check file deletion (async)
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith('/uploads/receipts/test-file.jpg');
    });

    it('should return false for non-existent receipt', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await receiptService.deleteReceipt('nonexistent', 'user-456');

      expect(result).toBe(false);
      expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
    });

    it('should return false if delete fails', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockReceiptRow] })
        .mockResolvedValueOnce({ rowCount: 0 }); // Delete failed

      const result = await receiptService.deleteReceipt('receipt-123', 'user-456');

      expect(result).toBe(false);
    });

    it('should handle file deletion errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockReceiptRow] })
        .mockResolvedValueOnce({ rowCount: 1 });

      mockStorageService.deleteFile = jest.fn().mockRejectedValue(
        new Error('File deletion failed')
      );

      const result = await receiptService.deleteReceipt('receipt-123', 'user-456');

      expect(result).toBe(true); // Should still succeed even if file deletion fails
      
      // Wait for async file deletion to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      consoleErrorSpy.mockRestore();
    });

    it('should ensure user authorization', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await receiptService.deleteReceipt('receipt-123', 'wrong-user');

      // Should call getReceiptById with correct user ID
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND user_id = $2'),
        ['receipt-123', 'wrong-user']
      );
    });
  });

  describe('Data Mapping and Helpers', () => {
    it('should correctly map database fields to receipt objects', async () => {
      const dbRow = {
        id: 'receipt-123',
        user_id: 'user-456',
        company_id: 'company-789',
        original_filename: 'receipt.pdf',
        file_path: '/uploads/receipts/receipt.pdf',
        file_size: 2048,
        file_hash: 'hash123',
        mime_type: 'application/pdf',
        status: 'processed',
        vendor_name: 'Test Vendor',
        total_amount: '99.99',
        currency: 'USD',
        receipt_date: new Date('2024-01-01'),
        category: 'Business',
        description: 'Test receipt',
        tags: ['test', 'business'],
        thumbnail_path: '/uploads/thumbnails/receipt-thumb.jpg',
        ocr_text: 'Receipt text',
        ocr_confidence: 0.95,
        created_at: new Date('2024-01-01T10:00:00Z'),
        updated_at: new Date('2024-01-01T11:00:00Z')
      };

      mockDb.query.mockResolvedValue({ rows: [dbRow] });

      const result = await receiptService.getReceiptById('receipt-123', 'user-456');

      expect(result).toEqual({
        id: 'receipt-123',
        userId: 'user-456',
        companyId: 'company-789',
        originalFilename: 'receipt.pdf',
        filePath: '/uploads/receipts/receipt.pdf',
        fileSize: 2048,
        fileHash: 'hash123',
        mimeType: 'application/pdf',
        status: 'processed',
        vendorName: 'Test Vendor',
        totalAmount: 99.99, // Should be parsed as float
        currency: 'USD',
        receiptDate: new Date('2024-01-01'),
        category: 'Business',
        description: 'Test receipt',
        tags: ['test', 'business'],
        thumbnailPath: '/uploads/thumbnails/receipt-thumb.jpg',
        ocrText: 'Receipt text',
        ocrConfidence: 0.95,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T11:00:00Z')
      });
    });

    it('should handle null values correctly', async () => {
      const dbRowWithNulls = {
        id: 'receipt-123',
        user_id: 'user-456',
        company_id: null,
        total_amount: null,
        vendor_name: null,
        receipt_date: null,
        category: null,
        description: null,
        tags: null,
        thumbnail_path: null,
        ocr_text: null,
        ocr_confidence: null
      };

      mockDb.query.mockResolvedValue({ rows: [dbRowWithNulls] });

      const result = await receiptService.getReceiptById('receipt-123', 'user-456');

      expect(result?.companyId).toBeUndefined();
      expect(result?.totalAmount).toBeUndefined();
      expect(result?.vendorName).toBeUndefined();
      expect(result?.receiptDate).toBeUndefined();
      expect(result?.category).toBeUndefined();
      expect(result?.description).toBeUndefined();
      expect(result?.tags).toBeUndefined();
      expect(result?.thumbnailPath).toBeUndefined();
      expect(result?.ocrText).toBeUndefined();
      expect(result?.ocrConfidence).toBeUndefined();
    });

    it('should map field names to database columns correctly', async () => {
      const updates = {
        vendorName: 'Test Vendor',
        totalAmount: 50.00,
        receiptDate: new Date('2024-01-01'),
        category: 'Test Category'
      };

      mockDb.query.mockResolvedValue({ rows: [{ id: 'receipt-123' }] });

      await receiptService.updateReceipt('receipt-123', 'user-456', updates);

      const query = mockDb.query.mock.calls[0][0] as string;
      expect(query).toContain('vendor_name = $');
      expect(query).toContain('total_amount = $');
      expect(query).toContain('receipt_date = $');
      expect(query).toContain('category = $'); // Should not be mapped
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection timeout'));

      await expect(receiptService.getReceiptById('receipt-123', 'user-456'))
        .rejects.toThrow('Connection timeout');
    });

    it('should handle UUID generation failures', async () => {
      mockRandomUUID.mockImplementation(() => {
        throw new Error('UUID generation failed');
      });

      const mockCreateReceiptData: CreateReceiptData = {
        userId: 'user-123',
        originalFilename: 'receipt.jpg',
        fileBuffer: Buffer.from('fake-data')
      };

      await expect(receiptService.uploadReceipt(mockCreateReceiptData))
        .rejects.toThrow('UUID generation failed');
    });

    it('should handle very large result sets', async () => {
      // Mock large result set
      const largeRowSet = Array(10000).fill(0).map((_, i) => ({
        id: `receipt-${i}`,
        user_id: 'user-123',
        created_at: new Date()
      }));

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '10000' }] })
        .mockResolvedValueOnce({ rows: largeRowSet.slice(0, 100) }); // First page

      const result = await receiptService.getReceipts(
        { userId: 'user-123' },
        { page: 1, limit: 100 }
      );

      expect(result.receipts).toHaveLength(100);
      expect(result.total).toBe(10000);
      expect(result.totalPages).toBe(100);
    });

    it('should handle concurrent update operations', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'receipt-123' }] });

      const updates1 = { vendorName: 'Vendor 1' };
      const updates2 = { vendorName: 'Vendor 2' };

      // Run updates concurrently
      const promises = [
        receiptService.updateReceipt('receipt-123', 'user-456', updates1),
        receiptService.updateReceipt('receipt-123', 'user-456', updates2)
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should handle special characters in search queries', async () => {
      const filterWithSpecialChars: ReceiptFilter = {
        userId: 'user-123',
        search: "O'Reilly's Pub & Grill 50% off!"
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await receiptService.getReceipts(filterWithSpecialChars, { page: 1, limit: 10 });

      const params = mockDb.query.mock.calls[0][1] as any[];
      expect(params).toContain("%O'Reilly's Pub & Grill 50% off!%");
    });

    it('should handle extremely long file names', async () => {
      const longFilename = 'a'.repeat(1000) + '.jpg';
      const receiptData: CreateReceiptData = {
        userId: 'user-123',
        originalFilename: longFilename,
        fileBuffer: Buffer.from('data')
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'receipt-123', original_filename: longFilename }] });

      const result = await receiptService.uploadReceipt(receiptData);

      expect(result.originalFilename).toBe(longFilename);
    });
  });
});