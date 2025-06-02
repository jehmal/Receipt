export interface AnalyticsFilter {
  startDate?: Date;
  endDate?: Date;
  companyId?: string;
  groupBy?: string;
  categoryId?: string;
}

export interface AnalyticsQuery {
  startDate?: string;
  endDate?: string;
  companyId?: string;
  groupBy?: 'day' | 'week' | 'month' | 'year';
  category?: string;
  userId?: string;
}

export interface SystemMetricsFilter {
  metric?: string;
  timeRange?: string;
}

export interface OverviewMetrics {
  totalReceipts: number;
  totalUsers: number;
  totalCompanies: number;
  storageUsed: number;
  recentActivity: any[];
}

export interface TrendData {
  date: string;
  value: number;
  label?: string;
}

export interface CategoryAnalytics {
  categoryId: string;
  categoryName: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

export interface SystemMetrics {
  metric: string;
  value: number;
  unit: string;
  timestamp: Date;
}

export interface ElasticsearchReceiptDocument {
  id: string;
  userId: string;
  companyId: string;
  originalFilename: string;
  vendorName: string;
  totalAmount: number;
  currency: string;
  receiptDate: string;
  category: string;
  subcategory?: string;
  tags: string[];
  description?: string;
  notes?: string;
  searchableText: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  extractedItems?: any[];
}

export interface ReceiptSearchQuery {
  query?: string;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  companyId?: string;
  userId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'amount' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}