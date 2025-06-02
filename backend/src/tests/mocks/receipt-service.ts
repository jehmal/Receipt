import { TestDataFactory } from '../fixtures/test-data';

export class ReceiptService {
  private ocrService: any;
  private storageService: any;
  private notificationService: any;

  constructor(deps: { ocrService?: any; storageService?: any; notificationService?: any } = {}) {
    this.ocrService = deps.ocrService;
    this.storageService = deps.storageService;
    this.notificationService = deps.notificationService;
  }

  async processReceiptUpload(userId: string, fileUpload: any): Promise<any> {
    // Validate file size
    if (fileUpload.size > 25 * 1024 * 1024) { // 25MB limit
      throw new Error('File size exceeds maximum limit');
    }

    // Validate file type
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!supportedTypes.includes(fileUpload.mimetype)) {
      throw new Error('Unsupported file type');
    }

    try {
      // Mock OCR processing
      const ocrResult = await this.ocrService.processReceipt(fileUpload);
      
      // Mock storage upload
      const storageResult = await this.storageService.uploadFile(fileUpload);

      return {
        id: TestDataFactory.createReceipt(userId).id,
        userId,
        status: 'processed',
        merchant: ocrResult.extractedData.merchant,
        amount: ocrResult.extractedData.amount,
        fileUrl: storageResult.url,
        thumbnailUrl: storageResult.thumbnailUrl,
        ocrData: ocrResult,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      // Return failed processing result
      const storageResult = await this.storageService.uploadFile(fileUpload);
      
      return {
        id: TestDataFactory.createReceipt(userId).id,
        userId,
        status: 'processing_failed',
        fileUrl: storageResult.url,
        metadata: {
          error: error.message
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  }

  validateReceiptData(receiptData: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate merchant
    if (!receiptData.merchant || receiptData.merchant.trim().length === 0) {
      errors.push('Merchant name is required');
    }

    // Validate amount
    if (typeof receiptData.amount !== 'number' || receiptData.amount <= 0) {
      errors.push('Amount must be positive');
    }

    // Validate amount precision
    if (receiptData.amount && receiptData.amount.toString().includes('.')) {
      const decimalPlaces = receiptData.amount.toString().split('.')[1].length;
      if (decimalPlaces > 2) {
        errors.push('Amount cannot have more than 2 decimal places');
      }
    }

    // Validate date
    if (receiptData.date && isNaN(Date.parse(receiptData.date))) {
      errors.push('Invalid date format');
    }

    // Validate currency code
    const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
    if (receiptData.currency && !validCurrencies.includes(receiptData.currency)) {
      errors.push('Invalid currency code');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  categorizeReceipt(receiptData: any): { category: string; subcategory?: string; confidence: number } {
    const merchant = receiptData.merchant.toLowerCase();
    const description = (receiptData.description || '').toLowerCase();

    // Coffee shops
    if (merchant.includes('starbucks') || merchant.includes('coffee')) {
      return {
        category: 'Food & Dining',
        subcategory: 'Coffee Shops',
        confidence: 0.9
      };
    }

    // Gas stations
    if (merchant.includes('shell') || merchant.includes('gas') || description.includes('fuel')) {
      return {
        category: 'Transportation',
        subcategory: 'Fuel',
        confidence: 0.85
      };
    }

    // Electronics
    if (merchant.includes('best buy') || merchant.includes('electronics')) {
      return {
        category: 'Electronics',
        subcategory: 'Consumer Electronics',
        confidence: 0.8
      };
    }

    // Default
    return {
      category: 'Uncategorized',
      confidence: 0.3
    };
  }

  calculateTotals(receiptData: any): any {
    const subtotal = receiptData.subtotal || 0;
    const taxAmount = receiptData.taxAmount || 0;
    const tipAmount = receiptData.tipAmount || 0;
    const discountAmount = receiptData.discountAmount || 0;
    
    const calculatedTotal = subtotal + taxAmount + tipAmount - discountAmount;
    const taxRate = subtotal > 0 ? taxAmount / subtotal : 0;
    const tipPercentage = subtotal > 0 ? tipAmount / subtotal : 0;
    
    const isAccurate = !receiptData.total || Math.abs(receiptData.total - calculatedTotal) < 0.01;
    const discrepancy = receiptData.total ? Math.abs(receiptData.total - calculatedTotal) : 0;

    return {
      total: calculatedTotal,
      calculatedTotal,
      taxRate,
      tipPercentage,
      isAccurate,
      discrepancy
    };
  }

  async searchReceipts(userId: string, searchQuery: string): Promise<any[]> {
    // Mock search implementation
    const mockReceipts = await this.findReceiptsByUser(userId);
    
    // Parse search query
    if (searchQuery.includes('amount:')) {
      const amountRange = searchQuery.split('amount:')[1].split('-');
      const minAmount = parseFloat(amountRange[0]);
      const maxAmount = parseFloat(amountRange[1]);
      
      return mockReceipts.filter(r => r.amount >= minAmount && r.amount <= maxAmount);
    }
    
    if (searchQuery.includes('date:')) {
      const dateRange = searchQuery.split('date:')[1].split('-');
      const startDate = new Date(dateRange[0]);
      const endDate = new Date(dateRange[1]);
      
      return mockReceipts.filter(r => {
        const receiptDate = new Date(r.date);
        return receiptDate >= startDate && receiptDate <= endDate;
      });
    }
    
    // Text search
    return mockReceipts.filter(r => 
      r.merchant.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  async findReceiptsByUser(userId: string): Promise<any[]> {
    // Mock implementation
    return [
      TestDataFactory.createReceipt(userId, { merchant: 'Starbucks Coffee' }),
      TestDataFactory.createReceipt(userId, { merchant: 'Shell Gas Station' })
    ];
  }

  generateReceiptSummary(receipts: any[]): any {
    const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
    const receiptCount = receipts.length;
    const averageAmount = receiptCount > 0 ? Math.round((totalAmount / receiptCount) * 100) / 100 : 0;
    
    // Category breakdown
    const categories: Record<string, { amount: number; count: number }> = {};
    receipts.forEach(receipt => {
      const category = receipt.category || 'Uncategorized';
      if (!categories[category]) {
        categories[category] = { amount: 0, count: 0 };
      }
      categories[category].amount += receipt.amount;
      categories[category].count += 1;
    });

    // Monthly trends
    const monthlyTrends: Record<string, number> = {};
    receipts.forEach(receipt => {
      const month = new Date(receipt.date).toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyTrends[month]) {
        monthlyTrends[month] = 0;
      }
      monthlyTrends[month] += receipt.amount;
    });

    return {
      totalAmount,
      receiptCount,
      averageAmount,
      categories,
      monthlyTrends
    };
  }
}