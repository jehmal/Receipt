class AnalyticsDashboard {
  final AnalyticsSummary summary;
  final List<ExpenseCategory> expensesByCategory;
  final List<SpendingTrend> spendingTrends;
  final BusinessInsights businessInsights;
  final List<TopVendor> topVendors;
  final DateTime generatedAt;

  AnalyticsDashboard({
    required this.summary,
    required this.expensesByCategory,
    required this.spendingTrends,
    required this.businessInsights,
    required this.topVendors,
    required this.generatedAt,
  });

  factory AnalyticsDashboard.fromJson(Map<String, dynamic> json) {
    return AnalyticsDashboard(
      summary: AnalyticsSummary.fromJson(json['summary']),
      expensesByCategory: (json['expensesByCategory'] as List)
          .map((e) => ExpenseCategory.fromJson(e))
          .toList(),
      spendingTrends: (json['spendingTrends'] as List)
          .map((e) => SpendingTrend.fromJson(e))
          .toList(),
      businessInsights: BusinessInsights.fromJson(json['businessInsights']),
      topVendors: (json['topVendors'] as List)
          .map((e) => TopVendor.fromJson(e))
          .toList(),
      generatedAt: DateTime.parse(json['generatedAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'summary': summary.toJson(),
      'expensesByCategory': expensesByCategory.map((e) => e.toJson()).toList(),
      'spendingTrends': spendingTrends.map((e) => e.toJson()).toList(),
      'businessInsights': businessInsights.toJson(),
      'topVendors': topVendors.map((e) => e.toJson()).toList(),
      'generatedAt': generatedAt.toIso8601String(),
    };
  }
}

class AnalyticsSummary {
  final int totalReceipts;
  final double totalSpending;
  final double averagePerReceipt;
  final String topCategory;
  final double monthlyGrowth;

  AnalyticsSummary({
    required this.totalReceipts,
    required this.totalSpending,
    required this.averagePerReceipt,
    required this.topCategory,
    required this.monthlyGrowth,
  });

  factory AnalyticsSummary.fromJson(Map<String, dynamic> json) {
    return AnalyticsSummary(
      totalReceipts: json['totalReceipts'] ?? 0,
      totalSpending: (json['totalSpending'] ?? 0.0).toDouble(),
      averagePerReceipt: (json['averagePerReceipt'] ?? 0.0).toDouble(),
      topCategory: json['topCategory'] ?? 'Other',
      monthlyGrowth: (json['monthlyGrowth'] ?? 0.0).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'totalReceipts': totalReceipts,
      'totalSpending': totalSpending,
      'averagePerReceipt': averagePerReceipt,
      'topCategory': topCategory,
      'monthlyGrowth': monthlyGrowth,
    };
  }

  String get formattedTotalSpending {
    return '\$${totalSpending.toStringAsFixed(2)}';
  }

  String get formattedAveragePerReceipt {
    return '\$${averagePerReceipt.toStringAsFixed(2)}';
  }

  String get formattedMonthlyGrowth {
    final sign = monthlyGrowth >= 0 ? '+' : '';
    return '$sign${monthlyGrowth.toStringAsFixed(1)}%';
  }

  bool get isGrowthPositive => monthlyGrowth > 0;
}

class ExpenseCategory {
  final String category;
  final double amount;
  final int count;
  final double percentage;

  ExpenseCategory({
    required this.category,
    required this.amount,
    required this.count,
    required this.percentage,
  });

  factory ExpenseCategory.fromJson(Map<String, dynamic> json) {
    return ExpenseCategory(
      category: json['category'] ?? 'Other',
      amount: (json['amount'] ?? 0.0).toDouble(),
      count: json['count'] ?? 0,
      percentage: (json['percentage'] ?? 0.0).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'category': category,
      'amount': amount,
      'count': count,
      'percentage': percentage,
    };
  }

  String get formattedAmount {
    return '\$${amount.toStringAsFixed(2)}';
  }

  String get formattedPercentage {
    return '${percentage.toStringAsFixed(1)}%';
  }
}

class SpendingTrend {
  final String date;
  final double amount;
  final int count;

  SpendingTrend({
    required this.date,
    required this.amount,
    required this.count,
  });

  factory SpendingTrend.fromJson(Map<String, dynamic> json) {
    return SpendingTrend(
      date: json['date'] ?? '',
      amount: (json['amount'] ?? 0.0).toDouble(),
      count: json['count'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'date': date,
      'amount': amount,
      'count': count,
    };
  }

  DateTime get parsedDate {
    try {
      return DateTime.parse(date);
    } catch (e) {
      return DateTime.now();
    }
  }

  String get formattedAmount {
    return '\$${amount.toStringAsFixed(2)}';
  }
}

class BusinessInsights {
  final double taxDeductibleAmount;
  final double taxDeductiblePercentage;
  final List<ExpenseCategory> businessExpenses;
  final double complianceScore;

  BusinessInsights({
    required this.taxDeductibleAmount,
    required this.taxDeductiblePercentage,
    required this.businessExpenses,
    required this.complianceScore,
  });

  factory BusinessInsights.fromJson(Map<String, dynamic> json) {
    return BusinessInsights(
      taxDeductibleAmount: (json['taxDeductibleAmount'] ?? 0.0).toDouble(),
      taxDeductiblePercentage: (json['taxDeductiblePercentage'] ?? 0.0).toDouble(),
      businessExpenses: (json['businessExpenses'] as List? ?? [])
          .map((e) => ExpenseCategory.fromJson(e))
          .toList(),
      complianceScore: (json['complianceScore'] ?? 100.0).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'taxDeductibleAmount': taxDeductibleAmount,
      'taxDeductiblePercentage': taxDeductiblePercentage,
      'businessExpenses': businessExpenses.map((e) => e.toJson()).toList(),
      'complianceScore': complianceScore,
    };
  }

  String get formattedTaxDeductibleAmount {
    return '\$${taxDeductibleAmount.toStringAsFixed(2)}';
  }

  String get formattedTaxDeductiblePercentage {
    return '${taxDeductiblePercentage.toStringAsFixed(1)}%';
  }

  String get formattedComplianceScore {
    return '${complianceScore.toStringAsFixed(1)}%';
  }

  ComplianceLevel get complianceLevel {
    if (complianceScore >= 90) return ComplianceLevel.excellent;
    if (complianceScore >= 75) return ComplianceLevel.good;
    if (complianceScore >= 50) return ComplianceLevel.fair;
    return ComplianceLevel.poor;
  }
}

class TopVendor {
  final String vendorName;
  final double amount;
  final int count;
  final DateTime lastVisit;

  TopVendor({
    required this.vendorName,
    required this.amount,
    required this.count,
    required this.lastVisit,
  });

  factory TopVendor.fromJson(Map<String, dynamic> json) {
    return TopVendor(
      vendorName: json['vendorName'] ?? 'Unknown',
      amount: (json['amount'] ?? 0.0).toDouble(),
      count: json['count'] ?? 0,
      lastVisit: DateTime.tryParse(json['lastVisit'] ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'vendorName': vendorName,
      'amount': amount,
      'count': count,
      'lastVisit': lastVisit.toIso8601String(),
    };
  }

  String get formattedAmount {
    return '\$${amount.toStringAsFixed(2)}';
  }

  String get formattedLastVisit {
    final now = DateTime.now();
    final difference = now.difference(lastVisit);

    if (difference.inDays < 1) {
      return 'Today';
    } else if (difference.inDays < 7) {
      return '${difference.inDays} day${difference.inDays > 1 ? 's' : ''} ago';
    } else if (difference.inDays < 30) {
      final weeks = (difference.inDays / 7).floor();
      return '$weeks week${weeks > 1 ? 's' : ''} ago';
    } else {
      final months = (difference.inDays / 30).floor();
      return '$months month${months > 1 ? 's' : ''} ago';
    }
  }

  double get averagePerVisit => count > 0 ? amount / count : 0.0;

  String get formattedAveragePerVisit {
    return '\$${averagePerVisit.toStringAsFixed(2)}';
  }
}

enum ComplianceLevel {
  excellent,
  good,
  fair,
  poor,
}

extension ComplianceLevelExtension on ComplianceLevel {
  String get displayName {
    switch (this) {
      case ComplianceLevel.excellent:
        return 'Excellent';
      case ComplianceLevel.good:
        return 'Good';
      case ComplianceLevel.fair:
        return 'Fair';
      case ComplianceLevel.poor:
        return 'Poor';
    }
  }

  String get description {
    switch (this) {
      case ComplianceLevel.excellent:
        return 'Your receipts are well organized and categorized.';
      case ComplianceLevel.good:
        return 'Most receipts are properly categorized.';
      case ComplianceLevel.fair:
        return 'Some receipts need better categorization.';
      case ComplianceLevel.poor:
        return 'Many receipts are missing categories.';
    }
  }
}

// Chart data models
class ChartDataPoint {
  final String label;
  final double value;
  final DateTime? date;

  ChartDataPoint({
    required this.label,
    required this.value,
    this.date,
  });

  factory ChartDataPoint.fromSpendingTrend(SpendingTrend trend) {
    return ChartDataPoint(
      label: trend.date,
      value: trend.amount,
      date: trend.parsedDate,
    );
  }

  factory ChartDataPoint.fromExpenseCategory(ExpenseCategory category) {
    return ChartDataPoint(
      label: category.category,
      value: category.amount,
    );
  }
}

class AnalyticsFilter {
  final DateTime? startDate;
  final DateTime? endDate;
  final String? category;
  final String period;

  AnalyticsFilter({
    this.startDate,
    this.endDate,
    this.category,
    this.period = 'day',
  });

  Map<String, String> toQueryParameters() {
    final params = <String, String>{
      'period': period,
    };

    if (startDate != null) {
      params['start'] = startDate!.toIso8601String().split('T')[0];
    }

    if (endDate != null) {
      params['end'] = endDate!.toIso8601String().split('T')[0];
    }

    if (category != null && category!.isNotEmpty) {
      params['category'] = category!;
    }

    return params;
  }

  AnalyticsFilter copyWith({
    DateTime? startDate,
    DateTime? endDate,
    String? category,
    String? period,
  }) {
    return AnalyticsFilter(
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      category: category ?? this.category,
      period: period ?? this.period,
    );
  }
}

// Export options
enum ExportFormat {
  csv,
  json,
  pdf,
}

class ExportOptions {
  final ExportFormat format;
  final DateTime? startDate;
  final DateTime? endDate;
  final List<String> includedSections;

  ExportOptions({
    required this.format,
    this.startDate,
    this.endDate,
    this.includedSections = const [
      'summary',
      'categories',
      'trends',
      'vendors',
      'business_insights'
    ],
  });

  Map<String, String> toQueryParameters() {
    final params = <String, String>{
      'format': format.name,
    };

    if (startDate != null) {
      params['start'] = startDate!.toIso8601String().split('T')[0];
    }

    if (endDate != null) {
      params['end'] = endDate!.toIso8601String().split('T')[0];
    }

    return params;
  }
}

extension ExportFormatExtension on ExportFormat {
  String get displayName {
    switch (this) {
      case ExportFormat.csv:
        return 'CSV';
      case ExportFormat.json:
        return 'JSON';
      case ExportFormat.pdf:
        return 'PDF';
    }
  }

  String get fileExtension {
    switch (this) {
      case ExportFormat.csv:
        return 'csv';
      case ExportFormat.json:
        return 'json';
      case ExportFormat.pdf:
        return 'pdf';
    }
  }

  String get mimeType {
    switch (this) {
      case ExportFormat.csv:
        return 'text/csv';
      case ExportFormat.json:
        return 'application/json';
      case ExportFormat.pdf:
        return 'application/pdf';
    }
  }
}