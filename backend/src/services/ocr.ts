import { ImageAnnotatorClient } from '@google-cloud/vision';
import { config } from '@/config';
import { storageService } from './storage';
import { db } from '@/database/connection';
import { logger } from '@/utils/logger';

export interface OCRResult {
  success: boolean;
  text?: string;
  confidence?: number;
  vendorName?: string;
  totalAmount?: number;
  currency?: string;
  date?: Date;
  error?: string;
  rawData?: any;
  structuredData?: ReceiptStructuredData;
  language?: string;
  wordCount?: number;
}

export interface ReceiptStructuredData {
  vendor?: string;
  totalAmount?: number;
  currency?: string;
  date?: Date;
  items?: LineItem[];
  taxAmount?: number;
  subtotal?: number;
  receiptNumber?: string;
  paymentMethod?: string;
  category?: string;
  businessType?: string;
}

export interface LineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
}

export interface TextBlock {
  text: string;
  confidence: number;
  boundingBox: {
    vertices: Array<{ x: number; y: number }>;
  };
}

class OCRService {
  private visionClient: ImageAnnotatorClient;

  constructor() {
    // Initialize Google Vision client
    if (config.googleCloud.apiKey) {
      this.visionClient = new ImageAnnotatorClient({
        apiKey: config.googleCloud.apiKey,
      });
    } else if (config.googleCloud.serviceAccountPath) {
      this.visionClient = new ImageAnnotatorClient({
        keyFilename: config.googleCloud.serviceAccountPath,
      });
    } else {
      console.warn('No Google Cloud credentials configured. OCR service will not work.');
    }
  }

  async processImage(imageBuffer: Buffer, filename: string): Promise<OCRResult> {
    try {
      if (!this.visionClient) {
        throw new Error('Google Vision client not initialized');
      }

      const maxFileSize = 20 * 1024 * 1024; // 20MB limit for Vision API
      if (imageBuffer.length > maxFileSize) {
        throw new Error(`File size ${imageBuffer.length} exceeds maximum ${maxFileSize} bytes`);
      }

      // Perform both text detection and document text detection for better accuracy
      const [textResult] = await this.visionClient.textDetection({
        image: { content: imageBuffer },
      });

      const [documentResult] = await this.visionClient.documentTextDetection({
        image: { content: imageBuffer },
      });

      const textAnnotations = textResult.textAnnotations;
      const fullTextAnnotation = documentResult.fullTextAnnotation;

      if (!textAnnotations || textAnnotations.length === 0) {
        return {
          success: false,
          error: 'No text detected in image'
        };
      }

      // The first annotation contains all detected text
      const fullText = textAnnotations[0].description || '';
      const confidence = this.calculateConfidence(textAnnotations);

      // Create text blocks for enhanced processing
      const textBlocks: TextBlock[] = textAnnotations.slice(1).map(annotation => ({
        text: annotation.description || '',
        confidence: annotation.confidence || 0,
        boundingBox: {
          vertices: annotation.boundingPoly?.vertices?.map(vertex => ({
            x: vertex.x || 0,
            y: vertex.y || 0
          })) || []
        }
      }));

      // Extract structured data from the text
      const structuredData = await this.extractAdvancedReceiptData(fullText, textBlocks);
      
      // Detect language
      const language = fullTextAnnotation?.pages?.[0]?.property?.detectedLanguages?.[0]?.languageCode;

      return {
        success: true,
        text: fullText,
        confidence,
        vendorName: structuredData.vendor,
        totalAmount: structuredData.totalAmount,
        currency: structuredData.currency || 'USD',
        date: structuredData.date,
        structuredData,
        language,
        wordCount: fullText.split(/\s+/).length,
        rawData: {
          textAnnotations: textAnnotations.slice(1, 20), // Store first 20 individual text annotations
          documentResult: fullTextAnnotation,
          textBlocks: textBlocks.slice(0, 50) // Store first 50 text blocks
        }
      };
    } catch (error: any) {
      logger.error('OCR processing failed:', error);
      return {
        success: false,
        error: error.message || 'OCR processing failed'
      };
    }
  }

  /**
   * Process a receipt with enhanced OCR and update database
   */
  async processReceiptWithId(receiptId: string, filePath: string, userId?: string, companyId?: string): Promise<OCRResult> {
    try {
      logger.info(`Starting OCR processing for receipt ${receiptId}`);
      
      // Update receipt status to processing
      await this.updateReceiptStatus(receiptId, 'processing');

      // Get file from storage
      const fileBuffer = await storageService.getFile(filePath);
      
      // Process with enhanced OCR
      const ocrResult = await this.processImage(fileBuffer, filePath);
      
      if (!ocrResult.success) {
        await this.updateReceiptStatus(receiptId, 'failed', ocrResult.error);
        return ocrResult;
      }

      // Enhance categorization with user context if available
      if (userId && ocrResult.structuredData) {
        try {
          const enhancedCategory = await this.categorizeReceipt(
            ocrResult.structuredData.vendor,
            ocrResult.text,
            ocrResult.structuredData.totalAmount,
            ocrResult.structuredData.date,
            userId,
            companyId
          );
          if (enhancedCategory) {
            ocrResult.structuredData.category = enhancedCategory;
          }
        } catch (error) {
          logger.warn('Enhanced categorization failed:', error);
        }
      }

      // Update receipt with OCR results
      await this.updateReceiptWithOCRData(receiptId, ocrResult);
      
      // Update status to processed
      await this.updateReceiptStatus(receiptId, 'processed');
      
      logger.info(`OCR processing completed for receipt ${receiptId}`);
      return ocrResult;

    } catch (error: any) {
      logger.error(`OCR processing failed for receipt ${receiptId}:`, error);
      
      // Update status to failed
      await this.updateReceiptStatus(receiptId, 'failed', error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  private calculateConfidence(textAnnotations: any[]): number {
    if (!textAnnotations || textAnnotations.length <= 1) {
      return 0;
    }

    // Calculate average confidence from individual text annotations
    const individualAnnotations = textAnnotations.slice(1); // Skip the full text annotation
    let totalConfidence = 0;
    let count = 0;

    for (const annotation of individualAnnotations) {
      if (annotation.confidence !== undefined) {
        totalConfidence += annotation.confidence;
        count++;
      }
    }

    return count > 0 ? totalConfidence / count : 0.5; // Default to 50% if no confidence data
  }

  private async extractReceiptData(text: string): Promise<{
    vendorName?: string;
    totalAmount?: number;
    currency?: string;
    date?: Date;
  }> {
    const result: any = {};

    // Extract vendor name (usually in the first few lines)
    const vendorName = this.extractVendorName(text);
    if (vendorName) {
      result.vendorName = vendorName;
    }

    // Extract total amount
    const totalAmount = this.extractTotalAmount(text);
    if (totalAmount) {
      result.totalAmount = totalAmount;
    }

    // Extract currency
    const currency = this.extractCurrency(text);
    if (currency) {
      result.currency = currency;
    }

    // Extract date
    const date = this.extractDate(text);
    if (date) {
      result.date = date;
    }

    return result;
  }

  /**
   * Enhanced receipt data extraction with line items and detailed analysis
   */
  private async extractAdvancedReceiptData(text: string, textBlocks: TextBlock[]): Promise<ReceiptStructuredData> {
    const structuredData: ReceiptStructuredData = {};

    // Clean and normalize text
    const cleanText = text.replace(/\n+/g, ' ').trim();
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    try {
      // Extract vendor name (usually at the top)
      structuredData.vendor = this.extractVendorNameAdvanced(lines, textBlocks);
      
      // Extract total amount
      structuredData.totalAmount = this.extractTotalAmountAdvanced(cleanText, lines);
      
      // Extract currency
      structuredData.currency = this.extractCurrencyAdvanced(cleanText);
      
      // Extract date
      structuredData.date = this.extractDateAdvanced(cleanText, lines);
      
      // Extract receipt number
      structuredData.receiptNumber = this.extractReceiptNumber(cleanText);
      
      // Extract tax amount
      structuredData.taxAmount = this.extractTaxAmount(cleanText, lines);
      
      // Extract subtotal
      structuredData.subtotal = this.extractSubtotal(cleanText, lines);
      
      // Extract payment method
      structuredData.paymentMethod = this.extractPaymentMethod(cleanText);
      
      // Extract line items
      structuredData.items = this.extractLineItems(lines);
      
      // Determine category and business type
      structuredData.category = this.categorizeReceipt(structuredData.vendor, cleanText);
      structuredData.businessType = this.determineBusinessType(structuredData.vendor, cleanText);

    } catch (error) {
      logger.warn('Error extracting advanced structured data:', error);
      // Return partial data even if some extraction fails
    }

    return structuredData;
  }

  private extractVendorName(text: string): string | undefined {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Known vendor patterns
    const knownVendors = [
      'shell', 'bp', 'exxon', 'chevron', 'mobil', 'texaco', 'sunoco',
      'walmart', 'target', 'costco', 'home depot', 'lowes', 'bunnings',
      'mcdonalds', 'burger king', 'starbucks', 'subway', 'kfc',
      'office depot', 'staples', 'best buy', 'amazon'
    ];

    // Check first few lines for known vendors
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].toLowerCase();
      for (const vendor of knownVendors) {
        if (line.includes(vendor)) {
          return this.capitalizeWords(vendor);
        }
      }
    }

    // If no known vendor found, return the first substantial line
    for (const line of lines.slice(0, 3)) {
      if (line.length > 3 && !this.isAmountLine(line) && !this.isDateLine(line)) {
        return this.cleanVendorName(line);
      }
    }

    return undefined;
  }

  private extractTotalAmount(text: string): number | undefined {
    // Common patterns for total amounts
    const totalPatterns = [
      /total[:\s]*\$?(\d+\.?\d*)/i,
      /amount[:\s]*\$?(\d+\.?\d*)/i,
      /sum[:\s]*\$?(\d+\.?\d*)/i,
      /\$(\d+\.\d{2})/g, // Generic dollar amount pattern
      /(\d+\.\d{2})/g    // Generic decimal pattern
    ];

    const lines = text.split('\n');
    
    // Look for explicit total/amount labels first
    for (const line of lines) {
      for (let i = 0; i < totalPatterns.length - 2; i++) { // Skip generic patterns for now
        const match = line.match(totalPatterns[i]);
        if (match) {
          const amount = parseFloat(match[1]);
          if (amount > 0 && amount < 10000) { // Reasonable range
            return amount;
          }
        }
      }
    }

    // If no labeled total found, look for the largest reasonable amount
    const amounts: number[] = [];
    const allText = text.replace(/\n/g, ' ');
    
    for (let i = totalPatterns.length - 2; i < totalPatterns.length; i++) {
      let match;
      while ((match = totalPatterns[i].exec(allText)) !== null) {
        const amount = parseFloat(match[1]);
        if (amount > 0 && amount < 10000) {
          amounts.push(amount);
        }
      }
    }

    if (amounts.length > 0) {
      // Return the largest amount (likely to be the total)
      return Math.max(...amounts);
    }

    return undefined;
  }

  private extractCurrency(text: string): string | undefined {
    // Look for currency symbols or codes
    if (text.includes('$')) {
      return 'USD';
    }
    if (text.includes('€')) {
      return 'EUR';
    }
    if (text.includes('£')) {
      return 'GBP';
    }
    if (/AUD|AU\$/i.test(text)) {
      return 'AUD';
    }
    if (/CAD|CA\$/i.test(text)) {
      return 'CAD';
    }

    // Default to USD for common patterns
    if (/\d+\.\d{2}/.test(text)) {
      return 'USD';
    }

    return undefined;
  }

  private extractDate(text: string): Date | undefined {
    // Common date patterns
    const datePatterns = [
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,     // MM/DD/YYYY or DD/MM/YYYY
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/,     // MM/DD/YY or DD/MM/YY
      /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,     // YYYY/MM/DD
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s\-]*(\d{1,2})[\s\-,]*(\d{4})/i,
      /(\d{1,2})[\s\-]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s\-]+(\d{4})/i
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          let date: Date;
          
          if (pattern === datePatterns[3]) { // Month name first
            const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                              'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            const month = monthNames.indexOf(match[1].toLowerCase());
            date = new Date(parseInt(match[3]), month, parseInt(match[2]));
          } else if (pattern === datePatterns[4]) { // Day month year
            const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                              'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            const month = monthNames.indexOf(match[2].toLowerCase());
            date = new Date(parseInt(match[3]), month, parseInt(match[1]));
          } else if (pattern === datePatterns[2]) { // YYYY/MM/DD
            date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
          } else {
            // MM/DD/YYYY or DD/MM/YYYY - assume MM/DD/YYYY for US receipts
            const year = match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3]);
            date = new Date(year, parseInt(match[1]) - 1, parseInt(match[2]));
          }

          // Validate date is reasonable (within last 5 years, not future)
          const now = new Date();
          const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
          
          if (date >= fiveYearsAgo && date <= now) {
            return date;
          }
        } catch (error) {
          // Continue to next pattern if date parsing fails
          continue;
        }
      }
    }

    return undefined;
  }

  private isAmountLine(line: string): boolean {
    return /\$?\d+\.?\d*/.test(line) || /total|amount|sum/i.test(line);
  }

  private isDateLine(line: string): boolean {
    return /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(line) || 
           /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line);
  }

  private cleanVendorName(name: string): string {
    // Remove common receipt prefixes/suffixes and clean up
    return name
      .replace(/^(receipt|invoice|bill|store|shop|location)/i, '')
      .replace(/(inc|llc|ltd|corp|co)\.?$/i, '')
      .trim()
      .substring(0, 50); // Limit length
  }

  private capitalizeWords(str: string): string {
    return str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Enhanced extraction methods
  private extractVendorNameAdvanced(lines: string[], textBlocks: TextBlock[]): string | undefined {
    // Look for vendor name in the first few lines
    const topLines = lines.slice(0, 5);
    
    // Skip very short lines (likely not vendor names)
    const candidateLines = topLines.filter(line => line.length > 2 && line.length < 50);
    
    if (candidateLines.length > 0) {
      // Return the first substantial line that's not just numbers/symbols
      const vendorLine = candidateLines.find(line => 
        /[a-zA-Z]/.test(line) && // Contains letters
        !/^\d+$/.test(line) && // Not just numbers
        !/^[\W\d]+$/.test(line) // Not just symbols and numbers
      );
      
      if (vendorLine) {
        return vendorLine.replace(/[^\w\s&'-]/g, '').trim();
      }
    }
    
    return undefined;
  }

  private extractTotalAmountAdvanced(text: string, lines: string[]): number | undefined {
    // Look for patterns like "Total", "Amount", "Grand Total", etc.
    const totalPatterns = [
      /(?:total|amount|grand\s*total|final\s*total|balance\s*due)[\s:]*\$?([0-9,]+\.?\d{0,2})/i,
      /\$([0-9,]+\.\d{2})(?:\s*(?:total|amount|due))?/i,
      /([0-9,]+\.\d{2})\s*(?:total|amount|due)/i
    ];

    // Check each line for total amount
    for (const line of lines) {
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match) {
          const amount = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(amount) && amount > 0 && amount < 10000) { // Reasonable range
            return amount;
          }
        }
      }
    }

    // Fallback: look for largest dollar amount in the text
    const amounts = text.match(/\$([0-9,]+\.\d{2})/g);
    if (amounts && amounts.length > 0) {
      const numericAmounts = amounts
        .map(amt => parseFloat(amt.replace(/[$,]/g, '')))
        .filter(amt => !isNaN(amt) && amt > 0);
      
      if (numericAmounts.length > 0) {
        return Math.max(...numericAmounts);
      }
    }

    return undefined;
  }

  private extractCurrencyAdvanced(text: string): string {
    // Look for currency symbols or codes
    if (text.includes('$') || text.includes('USD')) return 'USD';
    if (text.includes('€') || text.includes('EUR')) return 'EUR';
    if (text.includes('£') || text.includes('GBP')) return 'GBP';
    if (text.includes('¥') || text.includes('JPY')) return 'JPY';
    if (text.includes('CAD')) return 'CAD';
    if (text.includes('AUD')) return 'AUD';
    
    return 'USD'; // Default
  }

  private extractDateAdvanced(text: string, lines: string[]): Date | undefined {
    const datePatterns = [
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(\d{1,2}\s+\w+\s+\d{2,4})/,
      /(\w+\s+\d{1,2},?\s+\d{2,4})/,
      /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/
    ];

    for (const line of lines) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          const dateStr = match[1];
          const date = new Date(dateStr);
          if (!isNaN(date.getTime()) && date.getFullYear() > 2000) {
            return date;
          }
        }
      }
    }

    return undefined;
  }

  private extractReceiptNumber(text: string): string | undefined {
    const patterns = [
      /(?:receipt|ref|reference|order|transaction)[\s#:]*([a-zA-Z0-9\-]+)/i,
      /(?:no|number|#)[\s:]*([a-zA-Z0-9\-]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1].length > 3) {
        return match[1];
      }
    }

    return undefined;
  }

  private extractTaxAmount(text: string, lines: string[]): number | undefined {
    const taxPatterns = [
      /(?:tax|vat|gst|hst)[\s:]*\$?([0-9,]+\.?\d{0,2})/i,
      /\$([0-9,]+\.\d{2})\s*(?:tax|vat|gst|hst)/i
    ];

    for (const line of lines) {
      for (const pattern of taxPatterns) {
        const match = line.match(pattern);
        if (match) {
          const amount = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(amount) && amount >= 0) {
            return amount;
          }
        }
      }
    }

    return undefined;
  }

  private extractSubtotal(text: string, lines: string[]): number | undefined {
    const subtotalPatterns = [
      /(?:subtotal|sub-total|sub\s*total)[\s:]*\$?([0-9,]+\.?\d{0,2})/i,
      /\$([0-9,]+\.\d{2})\s*(?:subtotal|sub-total|sub\s*total)/i
    ];

    for (const line of lines) {
      for (const pattern of subtotalPatterns) {
        const match = line.match(pattern);
        if (match) {
          const amount = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(amount) && amount >= 0) {
            return amount;
          }
        }
      }
    }

    return undefined;
  }

  private extractPaymentMethod(text: string): string | undefined {
    const methods = ['cash', 'credit', 'debit', 'visa', 'mastercard', 'amex', 'discover', 'paypal', 'apple pay', 'google pay'];
    
    for (const method of methods) {
      if (text.toLowerCase().includes(method)) {
        return method.charAt(0).toUpperCase() + method.slice(1);
      }
    }

    return undefined;
  }

  private extractLineItems(lines: string[]): LineItem[] {
    const items: LineItem[] = [];
    
    // Look for lines that might contain item information
    for (const line of lines) {
      // Skip header lines and totals
      if (this.isHeaderOrTotal(line)) continue;
      
      // Look for item patterns: description followed by price
      const itemMatch = line.match(/(.+?)\s+\$?([0-9,]+\.\d{2})/);
      if (itemMatch) {
        const description = itemMatch[1].trim();
        const price = parseFloat(itemMatch[2].replace(/,/g, ''));
        
        if (description.length > 2 && !isNaN(price) && price > 0) {
          items.push({
            description,
            totalPrice: price
          });
        }
      }
    }

    return items;
  }

  private isHeaderOrTotal(line: string): boolean {
    const headerWords = ['receipt', 'total', 'subtotal', 'tax', 'amount', 'thank', 'visit', 'phone', 'address'];
    const lowerLine = line.toLowerCase();
    
    return headerWords.some(word => lowerLine.includes(word));
  }

  private async categorizeReceipt(vendor?: string, text?: string, amount?: number, date?: Date, userId?: string, companyId?: string): Promise<string | undefined> {
    if (!vendor && !text) return 'Other';
    
    // Try ML-powered categorization first if we have enough context
    if (userId && (vendor || text)) {
      try {
        const { mlCategorizationService } = await import('./ml-categorization');
        const predictions = await mlCategorizationService.predictCategory({
          vendorName: vendor,
          ocrText: text,
          amount,
          date,
          userId,
          companyId
        });

        if (predictions.length > 0 && predictions[0].confidence > 0.3) {
          return predictions[0].category;
        }
      } catch (error) {
        logger.warn('ML categorization failed, falling back to rule-based:', error);
      }
    }

    // Fallback to rule-based categorization
    const searchText = `${vendor || ''} ${text || ''}`.toLowerCase();
    
    const categories = {
      'Food & Dining': ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'food', 'dining', 'lunch', 'dinner', 'breakfast'],
      'Transportation': ['uber', 'lyft', 'taxi', 'gas', 'fuel', 'parking', 'toll', 'bus', 'subway', 'train'],
      'Shopping': ['store', 'shop', 'retail', 'amazon', 'target', 'walmart', 'mall', 'clothing'],
      'Entertainment': ['movie', 'theater', 'concert', 'show', 'entertainment', 'game', 'sport'],
      'Business': ['office', 'supplies', 'business', 'meeting', 'conference', 'hotel', 'travel'],
      'Health': ['pharmacy', 'medical', 'doctor', 'hospital', 'clinic', 'health', 'medicine'],
      'Utilities': ['electric', 'gas', 'water', 'internet', 'phone', 'utility', 'bill']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => searchText.includes(keyword))) {
        return category;
      }
    }

    return 'Other';
  }

  private determineBusinessType(vendor?: string, text?: string): string | undefined {
    if (!vendor && !text) return undefined;
    
    const searchText = `${vendor || ''} ${text || ''}`.toLowerCase();
    
    const businessTypes = {
      'Gas Station': ['shell', 'bp', 'exxon', 'chevron', 'mobil', 'texaco', 'sunoco', 'gas', 'fuel'],
      'Restaurant': ['restaurant', 'cafe', 'diner', 'bistro', 'grill', 'eatery'],
      'Retail Store': ['walmart', 'target', 'costco', 'store', 'shop', 'retail'],
      'Hotel': ['hotel', 'inn', 'resort', 'motel', 'lodge'],
      'Office Supplies': ['office depot', 'staples', 'office', 'supplies'],
      'Electronics': ['best buy', 'electronics', 'computer', 'tech'],
      'Pharmacy': ['pharmacy', 'cvs', 'walgreens', 'drugstore'],
      'Grocery': ['grocery', 'supermarket', 'market', 'food']
    };

    for (const [type, keywords] of Object.entries(businessTypes)) {
      if (keywords.some(keyword => searchText.includes(keyword))) {
        return type;
      }
    }

    return 'Other';
  }

  /**
   * Update receipt status in database
   */
  private async updateReceiptStatus(receiptId: string, status: string, errorMessage?: string): Promise<void> {
    try {
      const query = errorMessage 
        ? `UPDATE receipts SET status = $1, processing_error = $2, updated_at = NOW() WHERE id = $3`
        : `UPDATE receipts SET status = $1, updated_at = NOW() WHERE id = $2`;
      
      const params = errorMessage 
        ? [status, errorMessage, receiptId]
        : [status, receiptId];

      await db.query(query, params);
    } catch (error) {
      logger.error(`Failed to update receipt status for ${receiptId}:`, error);
    }
  }

  /**
   * Update receipt with OCR data
   */
  private async updateReceiptWithOCRData(receiptId: string, ocrResult: OCRResult): Promise<void> {
    try {
      const { text, confidence, structuredData } = ocrResult;
      
      const updateResult = await db.query(`
        UPDATE receipts SET
          ocr_text = $1,
          ocr_confidence = $2,
          vendor_name = COALESCE($3, vendor_name),
          total_amount = COALESCE($4, total_amount),
          currency = COALESCE($5, currency),
          receipt_date = COALESCE($6, receipt_date),
          category = COALESCE($7, category),
          structured_data = $8,
          updated_at = NOW()
        WHERE id = $9
        RETURNING *
      `, [
        text,
        confidence,
        structuredData?.vendor,
        structuredData?.totalAmount,
        structuredData?.currency,
        structuredData?.date,
        structuredData?.category,
        JSON.stringify(structuredData),
        receiptId
      ]);

      // Also insert any line items
      if (structuredData?.items && structuredData.items.length > 0) {
        await this.insertReceiptItems(receiptId, structuredData.items);
      }

      // Index in Elasticsearch for enhanced search capabilities
      if (updateResult.rows.length > 0) {
        try {
          const { searchService } = await import('./search');
          await searchService.indexReceiptInElasticsearch(updateResult.rows[0]);
        } catch (searchError) {
          logger.warn(`Failed to index receipt ${receiptId} in Elasticsearch:`, searchError);
          // Don't fail OCR processing if search indexing fails
        }
      }

    } catch (error) {
      logger.error(`Failed to update receipt ${receiptId} with OCR data:`, error);
      throw error;
    }
  }

  /**
   * Insert receipt line items
   */
  private async insertReceiptItems(receiptId: string, items: LineItem[]): Promise<void> {
    try {
      const itemInserts = items.map((item, index) => db.query(`
        INSERT INTO receipt_items (receipt_id, item_order, description, quantity, unit_price, total_price)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (receipt_id, item_order) DO UPDATE SET
          description = EXCLUDED.description,
          quantity = EXCLUDED.quantity,
          unit_price = EXCLUDED.unit_price,
          total_price = EXCLUDED.total_price
      `, [
        receiptId,
        index + 1,
        item.description,
        item.quantity || 1,
        item.unitPrice,
        item.totalPrice
      ]));

      await Promise.all(itemInserts);
    } catch (error) {
      logger.error(`Failed to insert receipt items for ${receiptId}:`, error);
      // Don't throw here - items are optional
    }
  }

  /**
   * Retry OCR processing for failed receipts
   */
  async retryFailedReceipt(receiptId: string): Promise<OCRResult> {
    const receiptResult = await db.query(
      'SELECT file_path FROM receipts WHERE id = $1',
      [receiptId]
    );

    if (receiptResult.rows.length === 0) {
      throw new Error(`Receipt ${receiptId} not found`);
    }

    const filePath = receiptResult.rows[0].file_path;
    return this.processReceiptWithId(receiptId, filePath);
  }

  /**
   * Get OCR processing stats
   */
  async getProcessingStats(): Promise<{
    total: number;
    processed: number;
    processing: number;
    failed: number;
    pending: number;
  }> {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'uploaded' THEN 1 END) as pending
      FROM receipts
      WHERE deleted_at IS NULL
    `);

    return result.rows[0];
  }

  // Method to update receipt with OCR results (used by receipt service)
  async updateReceiptOCR(receiptId: string, ocrData: {
    ocrText?: string;
    ocrConfidence?: number;
    vendorName?: string;
    totalAmount?: number;
    currency?: string;
    receiptDate?: Date;
    status?: string;
  }): Promise<void> {
    // This method is called by receiptService.updateReceiptOCR()
    // The actual database update is handled in the receipt service
  }
}

export const ocrService = new OCRService();