export interface CategorySuggestion {
  category: string;
  confidence: number;
  reason: string;
  suggestedTags: string[];
}

export interface CategoryInput {
  vendorName?: string;
  ocrText?: string;
  amount?: number;
  userId?: string;
}

class SmartCategorizationService {
  private vendorMappings: Map<string, { category: string; tags: string[] }>;
  private keywordMappings: Map<string, { category: string; tags: string[]; weight: number }>;

  constructor() {
    this.initializeVendorMappings();
    this.initializeKeywordMappings();
  }

  async suggestCategory(input: CategoryInput): Promise<CategorySuggestion> {
    const suggestions: Array<{ category: string; confidence: number; reason: string; tags: string[] }> = [];

    // 1. Check vendor name mapping (highest confidence)
    if (input.vendorName) {
      const vendorSuggestion = this.suggestByVendor(input.vendorName);
      if (vendorSuggestion) {
        suggestions.push({
          ...vendorSuggestion,
          confidence: 0.9,
          reason: `Known vendor: ${input.vendorName}`
        });
      }
    }

    // 2. Check OCR text keywords (medium confidence)
    if (input.ocrText) {
      const keywordSuggestion = this.suggestByKeywords(input.ocrText);
      if (keywordSuggestion) {
        suggestions.push({
          ...keywordSuggestion,
          confidence: 0.7,
          reason: `Keywords found in receipt text`
        });
      }
    }

    // 3. Check amount patterns (lower confidence)
    if (input.amount) {
      const amountSuggestion = this.suggestByAmount(input.amount);
      if (amountSuggestion) {
        suggestions.push({
          ...amountSuggestion,
          confidence: 0.5,
          reason: `Amount pattern analysis`
        });
      }
    }

    // 4. Get user history patterns (if userId provided)
    if (input.userId) {
      const historySuggestion = await this.suggestByUserHistory(input.userId, input);
      if (historySuggestion) {
        suggestions.push({
          ...historySuggestion,
          confidence: 0.6,
          reason: `Based on your spending patterns`
        });
      }
    }

    // Return the highest confidence suggestion, or default
    if (suggestions.length > 0) {
      const best = suggestions.reduce((prev, current) => 
        (prev.confidence > current.confidence) ? prev : current
      );
      
      return {
        category: best.category,
        confidence: best.confidence,
        reason: best.reason,
        suggestedTags: best.tags
      };
    }

    // Default fallback
    return {
      category: 'Other',
      confidence: 0.1,
      reason: 'No specific patterns detected',
      suggestedTags: []
    };
  }

  private initializeVendorMappings(): void {
    this.vendorMappings = new Map([
      // Fuel/Gas Stations
      ['shell', { category: 'Fuel', tags: ['fuel', 'vehicle', 'business'] }],
      ['bp', { category: 'Fuel', tags: ['fuel', 'vehicle', 'business'] }],
      ['exxon', { category: 'Fuel', tags: ['fuel', 'vehicle', 'business'] }],
      ['mobil', { category: 'Fuel', tags: ['fuel', 'vehicle', 'business'] }],
      ['chevron', { category: 'Fuel', tags: ['fuel', 'vehicle', 'business'] }],
      ['sunoco', { category: 'Fuel', tags: ['fuel', 'vehicle', 'business'] }],
      ['texaco', { category: 'Fuel', tags: ['fuel', 'vehicle', 'business'] }],
      ['7-eleven', { category: 'Fuel', tags: ['fuel', 'convenience', 'business'] }],
      
      // Tools & Hardware
      ['bunnings', { category: 'Tools', tags: ['tools', 'hardware', 'business', 'construction'] }],
      ['home depot', { category: 'Tools', tags: ['tools', 'hardware', 'business', 'construction'] }],
      ['lowes', { category: 'Tools', tags: ['tools', 'hardware', 'business', 'construction'] }],
      ['harbor freight', { category: 'Tools', tags: ['tools', 'hardware', 'business'] }],
      ['ace hardware', { category: 'Tools', tags: ['tools', 'hardware', 'business'] }],
      ['menards', { category: 'Tools', tags: ['tools', 'hardware', 'business'] }],
      
      // Automotive Parts
      ['autozone', { category: 'Parts', tags: ['parts', 'automotive', 'vehicle', 'business'] }],
      ['advance auto', { category: 'Parts', tags: ['parts', 'automotive', 'vehicle', 'business'] }],
      ['oreilly', { category: 'Parts', tags: ['parts', 'automotive', 'vehicle', 'business'] }],
      ['napa', { category: 'Parts', tags: ['parts', 'automotive', 'vehicle', 'business'] }],
      ['pep boys', { category: 'Parts', tags: ['parts', 'automotive', 'vehicle', 'business'] }],
      
      // Food & Dining
      ['mcdonalds', { category: 'Food & Dining', tags: ['food', 'lunch', 'business'] }],
      ['burger king', { category: 'Food & Dining', tags: ['food', 'lunch', 'business'] }],
      ['subway', { category: 'Food & Dining', tags: ['food', 'lunch', 'business'] }],
      ['starbucks', { category: 'Food & Dining', tags: ['food', 'coffee', 'business'] }],
      ['dunkin', { category: 'Food & Dining', tags: ['food', 'coffee', 'business'] }],
      ['panera', { category: 'Food & Dining', tags: ['food', 'lunch', 'business'] }],
      
      // Office Supplies
      ['staples', { category: 'Office Supplies', tags: ['office', 'supplies', 'business'] }],
      ['office depot', { category: 'Office Supplies', tags: ['office', 'supplies', 'business'] }],
      ['best buy', { category: 'Office Supplies', tags: ['electronics', 'office', 'business'] }],
      
      // Parking
      ['parking', { category: 'Parking', tags: ['parking', 'travel', 'business'] }],
      ['meter', { category: 'Parking', tags: ['parking', 'travel', 'business'] }],
      ['parkwhiz', { category: 'Parking', tags: ['parking', 'travel', 'business'] }],
      ['spothero', { category: 'Parking', tags: ['parking', 'travel', 'business'] }],
      
      // Travel
      ['uber', { category: 'Travel', tags: ['travel', 'transportation', 'business'] }],
      ['lyft', { category: 'Travel', tags: ['travel', 'transportation', 'business'] }],
      ['taxi', { category: 'Travel', tags: ['travel', 'transportation', 'business'] }],
      ['airport', { category: 'Travel', tags: ['travel', 'business'] }],
      ['hotel', { category: 'Travel', tags: ['travel', 'accommodation', 'business'] }],
      ['marriott', { category: 'Travel', tags: ['travel', 'accommodation', 'business'] }],
      ['hilton', { category: 'Travel', tags: ['travel', 'accommodation', 'business'] }],
    ]);
  }

  private initializeKeywordMappings(): void {
    this.keywordMappings = new Map([
      // Fuel keywords
      ['unleaded', { category: 'Fuel', tags: ['fuel', 'vehicle'], weight: 1.0 }],
      ['diesel', { category: 'Fuel', tags: ['fuel', 'vehicle'], weight: 1.0 }],
      ['premium', { category: 'Fuel', tags: ['fuel', 'vehicle'], weight: 0.8 }],
      ['gasoline', { category: 'Fuel', tags: ['fuel', 'vehicle'], weight: 1.0 }],
      ['fuel', { category: 'Fuel', tags: ['fuel', 'vehicle'], weight: 1.0 }],
      
      // Tools keywords
      ['hammer', { category: 'Tools', tags: ['tools', 'hardware'], weight: 1.0 }],
      ['drill', { category: 'Tools', tags: ['tools', 'hardware'], weight: 1.0 }],
      ['saw', { category: 'Tools', tags: ['tools', 'hardware'], weight: 1.0 }],
      ['wrench', { category: 'Tools', tags: ['tools', 'hardware'], weight: 1.0 }],
      ['screwdriver', { category: 'Tools', tags: ['tools', 'hardware'], weight: 1.0 }],
      ['tool', { category: 'Tools', tags: ['tools', 'hardware'], weight: 0.8 }],
      ['hardware', { category: 'Tools', tags: ['tools', 'hardware'], weight: 0.7 }],
      
      // Parts keywords
      ['bolt', { category: 'Parts', tags: ['parts', 'hardware'], weight: 0.9 }],
      ['screw', { category: 'Parts', tags: ['parts', 'hardware'], weight: 0.9 }],
      ['nail', { category: 'Parts', tags: ['parts', 'hardware'], weight: 0.9 }],
      ['fitting', { category: 'Parts', tags: ['parts', 'plumbing'], weight: 0.8 }],
      ['pipe', { category: 'Parts', tags: ['parts', 'plumbing'], weight: 0.8 }],
      ['wire', { category: 'Parts', tags: ['parts', 'electrical'], weight: 0.8 }],
      ['cable', { category: 'Parts', tags: ['parts', 'electrical'], weight: 0.8 }],
      
      // Parking keywords
      ['parking', { category: 'Parking', tags: ['parking', 'travel'], weight: 1.0 }],
      ['meter', { category: 'Parking', tags: ['parking', 'travel'], weight: 0.9 }],
      ['garage', { category: 'Parking', tags: ['parking', 'travel'], weight: 0.7 }],
      ['lot', { category: 'Parking', tags: ['parking', 'travel'], weight: 0.6 }],
      
      // Food keywords
      ['lunch', { category: 'Food & Dining', tags: ['food', 'meal'], weight: 0.8 }],
      ['dinner', { category: 'Food & Dining', tags: ['food', 'meal'], weight: 0.8 }],
      ['breakfast', { category: 'Food & Dining', tags: ['food', 'meal'], weight: 0.8 }],
      ['coffee', { category: 'Food & Dining', tags: ['food', 'beverage'], weight: 0.7 }],
      ['restaurant', { category: 'Food & Dining', tags: ['food', 'meal'], weight: 0.8 }],
      
      // Office keywords
      ['paper', { category: 'Office Supplies', tags: ['office', 'supplies'], weight: 0.7 }],
      ['pen', { category: 'Office Supplies', tags: ['office', 'supplies'], weight: 0.8 }],
      ['stapler', { category: 'Office Supplies', tags: ['office', 'supplies'], weight: 0.9 }],
      ['ink', { category: 'Office Supplies', tags: ['office', 'supplies'], weight: 0.8 }],
      ['toner', { category: 'Office Supplies', tags: ['office', 'supplies'], weight: 0.9 }],
      
      // Warranty keywords
      ['warranty', { category: 'Warranty', tags: ['warranty', 'protection'], weight: 1.0 }],
      ['extended', { category: 'Warranty', tags: ['warranty', 'protection'], weight: 0.6 }],
      ['protection', { category: 'Warranty', tags: ['warranty', 'protection'], weight: 0.7 }],
      ['service plan', { category: 'Warranty', tags: ['warranty', 'service'], weight: 0.8 }],
    ]);
  }

  private suggestByVendor(vendorName: string): { category: string; tags: string[] } | null {
    const normalizedVendor = vendorName.toLowerCase().trim();
    
    // Direct mapping
    if (this.vendorMappings.has(normalizedVendor)) {
      return this.vendorMappings.get(normalizedVendor)!;
    }

    // Partial matching
    for (const [vendor, mapping] of this.vendorMappings.entries()) {
      if (normalizedVendor.includes(vendor) || vendor.includes(normalizedVendor)) {
        return mapping;
      }
    }

    return null;
  }

  private suggestByKeywords(text: string): { category: string; tags: string[] } | null {
    const normalizedText = text.toLowerCase();
    const categoryScores = new Map<string, { score: number; tags: Set<string> }>();

    // Score each category based on keyword matches
    for (const [keyword, mapping] of this.keywordMappings.entries()) {
      if (normalizedText.includes(keyword)) {
        const current = categoryScores.get(mapping.category) || { score: 0, tags: new Set() };
        current.score += mapping.weight;
        mapping.tags.forEach(tag => current.tags.add(tag));
        categoryScores.set(mapping.category, current);
      }
    }

    if (categoryScores.size === 0) {
      return null;
    }

    // Find category with highest score
    let bestCategory = '';
    let bestScore = 0;
    let bestTags: string[] = [];

    for (const [category, data] of categoryScores.entries()) {
      if (data.score > bestScore) {
        bestCategory = category;
        bestScore = data.score;
        bestTags = Array.from(data.tags);
      }
    }

    return bestScore > 0 ? { category: bestCategory, tags: bestTags } : null;
  }

  private suggestByAmount(amount: number): { category: string; tags: string[] } | null {
    // Common amount patterns for different categories
    if (amount >= 20 && amount <= 150) {
      // Typical fuel fill-up range
      return { category: 'Fuel', tags: ['fuel', 'vehicle'] };
    }
    
    if (amount >= 1 && amount <= 50) {
      // Typical parking or small food purchase
      if (amount <= 20) {
        return { category: 'Parking', tags: ['parking', 'travel'] };
      } else {
        return { category: 'Food & Dining', tags: ['food', 'meal'] };
      }
    }

    if (amount >= 50 && amount <= 500) {
      // Could be tools or parts
      return { category: 'Tools', tags: ['tools', 'business'] };
    }

    if (amount >= 500) {
      // Likely major tools or equipment
      return { category: 'Tools', tags: ['tools', 'equipment', 'business'] };
    }

    return null;
  }

  private async suggestByUserHistory(userId: string, input: CategoryInput): Promise<{ category: string; tags: string[] } | null> {
    try {
      // Query user's historical spending patterns
      const historyQuery = `
        SELECT category, COUNT(*) as frequency, AVG(total_amount) as avg_amount
        FROM receipts 
        WHERE user_id = $1 
          AND category IS NOT NULL 
          AND deleted_at IS NULL
          AND created_at > NOW() - INTERVAL '6 months'
        GROUP BY category
        ORDER BY frequency DESC
        LIMIT 5
      `;

      const { db } = await import('@/database/connection');
      const result = await db.query(historyQuery, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      // If vendor name matches user's frequent categories
      if (input.vendorName) {
        for (const row of result.rows) {
          if (input.vendorName.toLowerCase().includes(row.category.toLowerCase())) {
            return {
              category: row.category,
              tags: ['frequent', 'personal-pattern']
            };
          }
        }
      }

      // If amount matches user's typical spending in a category
      if (input.amount) {
        for (const row of result.rows) {
          const avgAmount = parseFloat(row.avg_amount);
          if (Math.abs(input.amount - avgAmount) < avgAmount * 0.3) { // Within 30% of average
            return {
              category: row.category,
              tags: ['frequent', 'amount-pattern']
            };
          }
        }
      }

      // Default to user's most frequent category
      return {
        category: result.rows[0].category,
        tags: ['frequent', 'default-pattern']
      };

    } catch (error) {
      console.error('Error analyzing user history:', error);
      return null;
    }
  }

  // Method to learn from user corrections
  async learnFromUserCorrection(userId: string, originalSuggestion: CategorySuggestion, userChoice: string, input: CategoryInput): Promise<void> {
    try {
      // Store learning data for future model improvements
      const learningData = {
        userId,
        vendorName: input.vendorName,
        ocrText: input.ocrText?.substring(0, 500), // Limit text length
        amount: input.amount,
        suggestedCategory: originalSuggestion.category,
        actualCategory: userChoice,
        correctionDate: new Date()
      };

      // TODO: Store in a learning database table for ML model training
      console.log('Learning from user correction:', learningData);

    } catch (error) {
      console.error('Error storing learning data:', error);
    }
  }

  // Get category statistics for analytics
  async getCategoryStats(userId: string, timeRange: 'week' | 'month' | 'quarter' | 'year' = 'month'): Promise<Array<{
    category: string;
    count: number;
    totalAmount: number;
    percentage: number;
  }>> {
    try {
      let interval = '';
      switch (timeRange) {
        case 'week': interval = '7 days'; break;
        case 'month': interval = '30 days'; break;
        case 'quarter': interval = '90 days'; break;
        case 'year': interval = '365 days'; break;
      }

      const statsQuery = `
        WITH category_totals AS (
          SELECT 
            category,
            COUNT(*) as count,
            COALESCE(SUM(total_amount), 0) as total_amount
          FROM receipts 
          WHERE user_id = $1 
            AND category IS NOT NULL 
            AND deleted_at IS NULL
            AND created_at > NOW() - INTERVAL '${interval}'
          GROUP BY category
        ),
        grand_total AS (
          SELECT SUM(total_amount) as grand_total
          FROM category_totals
        )
        SELECT 
          ct.category,
          ct.count,
          ct.total_amount,
          ROUND((ct.total_amount / NULLIF(gt.grand_total, 0) * 100)::numeric, 2) as percentage
        FROM category_totals ct
        CROSS JOIN grand_total gt
        ORDER BY ct.total_amount DESC
      `;

      const { db } = await import('@/database/connection');
      const result = await db.query(statsQuery, [userId]);
      return result.rows;

    } catch (error) {
      console.error('Error getting category stats:', error);
      return [];
    }
  }
}

export const smartCategorizationService = new SmartCategorizationService();