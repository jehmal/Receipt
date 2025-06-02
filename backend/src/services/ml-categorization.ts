import { db } from '@/database/connection';
import { redis as redisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

export interface CategoryPrediction {
  category: string;
  confidence: number;
  subcategory?: string;
  suggestedTags?: string[];
  businessType?: string;
}

export interface VendorInsight {
  vendorName: string;
  normalizedName: string;
  commonCategory: string;
  commonSubcategory?: string;
  businessType: string;
  frequency: number;
  averageAmount: number;
  suggestedTags: string[];
  lastSeen: Date;
}

export interface SpendingPattern {
  userId: string;
  category: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: string;
  frequency: number;
  averageAmount: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface CategoryRule {
  id: string;
  userId: string;
  companyId?: string;
  priority: number;
  conditions: {
    vendorPattern?: string;
    amountRange?: { min?: number; max?: number };
    keywordPatterns?: string[];
    timePatterns?: string[];
  };
  actions: {
    category: string;
    subcategory?: string;
    tags?: string[];
    confidence: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class MLCategorizationService {
  private readonly categoryHierarchy = {
    'Food & Dining': {
      subcategories: ['Fast Food', 'Restaurant', 'Coffee Shop', 'Grocery', 'Catering', 'Food Delivery'],
      keywords: ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'food', 'dining', 'lunch', 'dinner', 'breakfast', 'grocery', 'market'],
      businessTypes: ['Restaurant', 'Cafe', 'Fast Food', 'Grocery Store', 'Food Truck']
    },
    'Transportation': {
      subcategories: ['Gas/Fuel', 'Public Transit', 'Rideshare', 'Parking', 'Car Rental', 'Maintenance'],
      keywords: ['uber', 'lyft', 'taxi', 'gas', 'fuel', 'parking', 'toll', 'bus', 'subway', 'train', 'airline', 'flight'],
      businessTypes: ['Gas Station', 'Transportation Service', 'Parking', 'Car Rental', 'Airline']
    },
    'Business': {
      subcategories: ['Office Supplies', 'Software', 'Equipment', 'Services', 'Travel', 'Marketing'],
      keywords: ['office', 'supplies', 'business', 'meeting', 'conference', 'hotel', 'travel', 'software', 'subscription'],
      businessTypes: ['Office Supplies', 'Software Company', 'Business Service', 'Hotel', 'Consulting']
    },
    'Shopping': {
      subcategories: ['Clothing', 'Electronics', 'Home & Garden', 'Personal Care', 'Books', 'Gifts'],
      keywords: ['amazon', 'store', 'shop', 'retail', 'clothing', 'electronics', 'home', 'garden', 'personal', 'care'],
      businessTypes: ['Retail Store', 'Department Store', 'Specialty Store', 'Online Retailer']
    },
    'Health': {
      subcategories: ['Medical', 'Pharmacy', 'Dental', 'Vision', 'Fitness', 'Mental Health'],
      keywords: ['pharmacy', 'medical', 'doctor', 'hospital', 'clinic', 'health', 'medicine', 'dental', 'vision'],
      businessTypes: ['Pharmacy', 'Medical Office', 'Hospital', 'Clinic', 'Fitness Center']
    },
    'Entertainment': {
      subcategories: ['Movies', 'Music', 'Sports', 'Gaming', 'Books', 'Events'],
      keywords: ['movie', 'theater', 'concert', 'show', 'entertainment', 'game', 'sport', 'music', 'event'],
      businessTypes: ['Entertainment Venue', 'Theater', 'Sports Venue', 'Gaming']
    },
    'Utilities': {
      subcategories: ['Electric', 'Gas', 'Water', 'Internet', 'Phone', 'Waste'],
      keywords: ['electric', 'gas', 'water', 'internet', 'phone', 'utility', 'bill', 'cable', 'wireless'],
      businessTypes: ['Utility Company', 'Telecom', 'Internet Provider']
    },
    'Education': {
      subcategories: ['Tuition', 'Books', 'Supplies', 'Online Courses', 'Training'],
      keywords: ['school', 'education', 'tuition', 'books', 'course', 'training', 'university', 'college'],
      businessTypes: ['Educational Institution', 'Online Learning', 'Training Center']
    },
    'Home': {
      subcategories: ['Rent/Mortgage', 'Maintenance', 'Furniture', 'Utilities', 'Insurance'],
      keywords: ['rent', 'mortgage', 'home', 'house', 'maintenance', 'furniture', 'insurance', 'repair'],
      businessTypes: ['Real Estate', 'Home Improvement', 'Furniture Store', 'Insurance']
    },
    'Personal Care': {
      subcategories: ['Salon', 'Spa', 'Gym', 'Personal Services'],
      keywords: ['salon', 'spa', 'gym', 'fitness', 'personal', 'beauty', 'hair', 'massage'],
      businessTypes: ['Salon', 'Spa', 'Fitness Center', 'Personal Service']
    }
  };

  /**
   * Predict category for a receipt using ML and rule-based approaches
   */
  async predictCategory(receiptData: {
    vendorName?: string;
    ocrText?: string;
    amount?: number;
    date?: Date;
    userId: string;
    companyId?: string;
  }): Promise<CategoryPrediction[]> {
    try {
      const predictions: CategoryPrediction[] = [];

      // 1. Check user-defined rules first (highest priority)
      const rulePredictions = await this.applyUserRules(receiptData);
      predictions.push(...rulePredictions);

      // 2. Use vendor intelligence
      if (receiptData.vendorName) {
        const vendorPrediction = await this.predictFromVendor(receiptData.vendorName, receiptData.userId, receiptData.companyId);
        if (vendorPrediction) {
          predictions.push(vendorPrediction);
        }
      }

      // 3. Keyword-based classification
      const keywordPrediction = await this.predictFromKeywords(receiptData);
      if (keywordPrediction) {
        predictions.push(keywordPrediction);
      }

      // 4. Amount-based patterns
      const amountPrediction = await this.predictFromAmountPatterns(receiptData);
      if (amountPrediction) {
        predictions.push(amountPrediction);
      }

      // 5. Time-based patterns
      const timePrediction = await this.predictFromTimePatterns(receiptData);
      if (timePrediction) {
        predictions.push(timePrediction);
      }

      // Sort by confidence and remove duplicates
      return this.consolidatePredictions(predictions);

    } catch (error) {
      logger.error('Error predicting category:', error);
      return [{
        category: 'Other',
        confidence: 0.1,
        suggestedTags: ['uncategorized']
      }];
    }
  }

  /**
   * Apply user-defined categorization rules
   */
  private async applyUserRules(receiptData: {
    vendorName?: string;
    ocrText?: string;
    amount?: number;
    date?: Date;
    userId: string;
    companyId?: string;
  }): Promise<CategoryPrediction[]> {
    try {
      const rules = await this.getUserRules(receiptData.userId, receiptData.companyId);
      const predictions: CategoryPrediction[] = [];

      for (const rule of rules) {
        if (!rule.isActive) continue;

        let matches = true;

        // Check vendor pattern
        if (rule.conditions.vendorPattern && receiptData.vendorName) {
          try {
            const regex = new RegExp(rule.conditions.vendorPattern, 'i');
            if (!regex.test(receiptData.vendorName)) {
              matches = false;
            }
          } catch (error) {
            matches = false;
          }
        }

        // Check amount range
        if (rule.conditions.amountRange && receiptData.amount) {
          const { min, max } = rule.conditions.amountRange;
          if ((min && receiptData.amount < min) || (max && receiptData.amount > max)) {
            matches = false;
          }
        }

        // Check keyword patterns
        if (rule.conditions.keywordPatterns && (receiptData.vendorName || receiptData.ocrText)) {
          const text = `${receiptData.vendorName || ''} ${receiptData.ocrText || ''}`.toLowerCase();
          const hasKeyword = rule.conditions.keywordPatterns.some(keyword => 
            text.includes(keyword.toLowerCase())
          );
          if (!hasKeyword) {
            matches = false;
          }
        }

        if (matches) {
          predictions.push({
            category: rule.actions.category,
            subcategory: rule.actions.subcategory,
            confidence: rule.actions.confidence,
            suggestedTags: rule.actions.tags || []
          });
        }
      }

      return predictions;
    } catch (error) {
      logger.error('Error applying user rules:', error);
      return [];
    }
  }

  /**
   * Predict category based on vendor intelligence
   */
  private async predictFromVendor(vendorName: string, userId: string, companyId?: string): Promise<CategoryPrediction | null> {
    try {
      // Normalize vendor name
      const normalizedVendor = this.normalizeVendorName(vendorName);

      // Check cache first
      const cacheKey = `vendor:category:${normalizedVendor}`;
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const prediction = JSON.parse(cached);
        return prediction;
      }

      // Get vendor history from user's receipts
      const vendorHistory = await this.getVendorHistory(normalizedVendor, userId, companyId);
      
      if (vendorHistory.length > 0) {
        const categories = vendorHistory.map(r => r.category).filter(Boolean);
        const mostCommonCategory = this.getMostFrequent(categories);
        
        if (mostCommonCategory) {
          const prediction: CategoryPrediction = {
            category: mostCommonCategory,
            confidence: Math.min(0.9, 0.5 + (categories.length * 0.1)),
            businessType: vendorHistory[0].business_type
          };

          // Cache for 24 hours
          await redisClient.setex(cacheKey, 86400, JSON.stringify(prediction));
          return prediction;
        }
      }

      // Fallback to global vendor intelligence
      const globalVendor = await this.getGlobalVendorIntelligence(normalizedVendor);
      if (globalVendor) {
        const prediction: CategoryPrediction = {
          category: globalVendor.category,
          confidence: 0.7,
          businessType: globalVendor.business_type
        };

        // Cache for 24 hours
        await redisClient.setex(cacheKey, 86400, JSON.stringify(prediction));
        return prediction;
      }

      return null;
    } catch (error) {
      logger.error('Error predicting from vendor:', error);
      return null;
    }
  }

  /**
   * Predict category based on keywords in vendor name and OCR text
   */
  private async predictFromKeywords(receiptData: {
    vendorName?: string;
    ocrText?: string;
  }): Promise<CategoryPrediction | null> {
    const text = `${receiptData.vendorName || ''} ${receiptData.ocrText || ''}`.toLowerCase();
    
    let bestMatch: { category: string; score: number; businessType?: string } | null = null;

    for (const [category, config] of Object.entries(this.categoryHierarchy)) {
      const keywordMatches = config.keywords.filter(keyword => text.includes(keyword));
      
      if (keywordMatches.length > 0) {
        const score = keywordMatches.length / config.keywords.length;
        
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            category,
            score,
            businessType: config.businessTypes[0]
          };
        }
      }
    }

    if (bestMatch) {
      return {
        category: bestMatch.category,
        confidence: Math.min(0.8, 0.3 + bestMatch.score),
        businessType: bestMatch.businessType,
        suggestedTags: [bestMatch.category.toLowerCase().replace(/\s+/g, '-')]
      };
    }

    return null;
  }

  /**
   * Predict category based on amount patterns
   */
  private async predictFromAmountPatterns(receiptData: {
    amount?: number;
    userId: string;
    companyId?: string;
  }): Promise<CategoryPrediction | null> {
    if (!receiptData.amount) return null;

    try {
      // Get user's spending patterns
      const patterns = await this.getUserSpendingPatterns(receiptData.userId, receiptData.companyId);
      
      for (const pattern of patterns) {
        if (this.isAmountInTypicalRange(receiptData.amount, pattern)) {
          return {
            category: pattern.category,
            confidence: 0.4,
            suggestedTags: ['amount-pattern']
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Error predicting from amount patterns:', error);
      return null;
    }
  }

  /**
   * Predict category based on time patterns
   */
  private async predictFromTimePatterns(receiptData: {
    date?: Date;
    userId: string;
    companyId?: string;
  }): Promise<CategoryPrediction | null> {
    if (!receiptData.date) return null;

    try {
      const hour = receiptData.date.getHours();
      const dayOfWeek = receiptData.date.getDay();

      // Morning coffee/breakfast (6-10 AM)
      if (hour >= 6 && hour <= 10) {
        return {
          category: 'Food & Dining',
          subcategory: 'Coffee Shop',
          confidence: 0.3,
          suggestedTags: ['morning', 'breakfast']
        };
      }

      // Lunch time (11 AM - 2 PM)
      if (hour >= 11 && hour <= 14) {
        return {
          category: 'Food & Dining',
          subcategory: 'Restaurant',
          confidence: 0.3,
          suggestedTags: ['lunch']
        };
      }

      // Dinner time (5-9 PM)
      if (hour >= 17 && hour <= 21) {
        return {
          category: 'Food & Dining',
          subcategory: 'Restaurant',
          confidence: 0.3,
          suggestedTags: ['dinner']
        };
      }

      // Weekend entertainment
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        if (hour >= 18 && hour <= 23) {
          return {
            category: 'Entertainment',
            confidence: 0.2,
            suggestedTags: ['weekend', 'entertainment']
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Error predicting from time patterns:', error);
      return null;
    }
  }

  /**
   * Consolidate multiple predictions into ranked list
   */
  private consolidatePredictions(predictions: CategoryPrediction[]): CategoryPrediction[] {
    const consolidated = new Map<string, CategoryPrediction>();

    for (const prediction of predictions) {
      const key = `${prediction.category}-${prediction.subcategory || ''}`;
      
      if (consolidated.has(key)) {
        const existing = consolidated.get(key)!;
        existing.confidence = Math.max(existing.confidence, prediction.confidence);
        existing.suggestedTags = [...new Set([...(existing.suggestedTags || []), ...(prediction.suggestedTags || [])])];
      } else {
        consolidated.set(key, { ...prediction });
      }
    }

    return Array.from(consolidated.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Return top 5 predictions
  }

  /**
   * Learn from user categorization to improve future predictions
   */
  async learnFromUserCategorization(receiptData: {
    vendorName?: string;
    category: string;
    subcategory?: string;
    amount?: number;
    userId: string;
    companyId?: string;
  }): Promise<void> {
    try {
      // Update vendor intelligence
      if (receiptData.vendorName) {
        await this.updateVendorIntelligence({
          vendorName: receiptData.vendorName,
          category: receiptData.category,
          subcategory: receiptData.subcategory,
          amount: receiptData.amount,
          userId: receiptData.userId,
          companyId: receiptData.companyId
        });
      }

      // Update spending patterns
      await this.updateSpendingPatterns(receiptData);

      logger.debug(`Learned from categorization: ${receiptData.vendorName} -> ${receiptData.category}`);
    } catch (error) {
      logger.error('Error learning from user categorization:', error);
    }
  }

  /**
   * Get vendor insights for a user
   */
  async getVendorInsights(userId: string, companyId?: string, limit = 50): Promise<VendorInsight[]> {
    try {
      let query = `
        SELECT 
          vendor_name,
          category,
          subcategory,
          business_type,
          COUNT(*) as frequency,
          AVG(total_amount) as average_amount,
          MAX(created_at) as last_seen,
          array_agg(DISTINCT unnest(tags)) FILTER (WHERE tags IS NOT NULL) as all_tags
        FROM receipts 
        WHERE user_id = $1 AND vendor_name IS NOT NULL AND deleted_at IS NULL
      `;
      
      const params = [userId];
      
      if (companyId) {
        query += ` AND company_id = $2`;
        params.push(companyId);
      }
      
      query += `
        GROUP BY vendor_name, category, subcategory, business_type
        HAVING COUNT(*) >= 2
        ORDER BY frequency DESC, average_amount DESC
        LIMIT $${params.length + 1}
      `;
      
      params.push(limit.toString());

      const result = await db.query(query, params);

      return result.rows.map(row => ({
        vendorName: row.vendor_name,
        normalizedName: this.normalizeVendorName(row.vendor_name),
        commonCategory: row.category || 'Other',
        commonSubcategory: row.subcategory,
        businessType: row.business_type || 'Unknown',
        frequency: parseInt(row.frequency),
        averageAmount: parseFloat(row.average_amount) || 0,
        suggestedTags: row.all_tags || [],
        lastSeen: new Date(row.last_seen)
      }));
    } catch (error) {
      logger.error('Error getting vendor insights:', error);
      return [];
    }
  }

  /**
   * Create a custom categorization rule
   */
  async createCategorizationRule(
    userId: string,
    companyId: string | undefined,
    ruleData: Omit<CategoryRule, 'id' | 'userId' | 'companyId' | 'createdAt' | 'updatedAt'>
  ): Promise<CategoryRule> {
    const result = await db.query(`
      INSERT INTO categorization_rules (
        id, user_id, company_id, priority, conditions, actions, is_active, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW()
      ) RETURNING *
    `, [
      userId,
      companyId,
      ruleData.priority,
      JSON.stringify(ruleData.conditions),
      JSON.stringify(ruleData.actions),
      ruleData.isActive
    ]);

    // Clear cache
    await redisClient.del(`user:rules:${userId}`);

    return this.mapRuleFromDb(result.rows[0]);
  }

  // Helper methods
  private normalizeVendorName(vendorName: string): string {
    return vendorName
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
  }

  private getMostFrequent<T>(items: T[]): T | null {
    if (items.length === 0) return null;
    
    const counts = new Map<T, number>();
    for (const item of items) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }

    let maxCount = 0;
    let mostFrequent: T | null = null;

    for (const [item, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = item;
      }
    }

    return mostFrequent;
  }

  private async getUserRules(userId: string, companyId?: string): Promise<CategoryRule[]> {
    // Implementation would fetch user-defined rules from database
    // For now, return empty array
    return [];
  }

  private async getVendorHistory(vendorName: string, userId: string, companyId?: string): Promise<any[]> {
    // Implementation would fetch vendor history from user's receipts
    return [];
  }

  private async getGlobalVendorIntelligence(vendorName: string): Promise<any> {
    // Implementation would fetch from global vendor database
    return null;
  }

  private async getUserSpendingPatterns(userId: string, companyId?: string): Promise<SpendingPattern[]> {
    // Implementation would analyze user's spending patterns
    return [];
  }

  private isAmountInTypicalRange(amount: number, pattern: SpendingPattern): boolean {
    const variance = pattern.averageAmount * 0.3; // 30% variance
    return amount >= (pattern.averageAmount - variance) && amount <= (pattern.averageAmount + variance);
  }

  private async updateVendorIntelligence(data: any): Promise<void> {
    // Implementation would update vendor intelligence database
  }

  private async updateSpendingPatterns(data: any): Promise<void> {
    // Implementation would update spending patterns
  }

  private mapRuleFromDb(row: any): CategoryRule {
    return {
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      priority: row.priority,
      conditions: JSON.parse(row.conditions),
      actions: JSON.parse(row.actions),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const mlCategorizationService = new MLCategorizationService();