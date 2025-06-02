export interface AnalyticsFilter {
  startDate?: Date;
  endDate?: Date;
  companyId?: string;
  groupBy?: string;
  categoryId?: string;
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