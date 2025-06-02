import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:dio/dio.dart';

import '../../../core/config/app_config.dart';
import '../../../core/storage/local_storage.dart';
import '../../../shared/models/receipt.dart';

part 'company_analytics_provider.g.dart';

@riverpod
class CompanyAnalyticsNotifier extends _$CompanyAnalyticsNotifier {
  @override
  CompanyAnalyticsState build() => CompanyAnalyticsState.loading();

  Future<void> loadAnalytics(DateRange period) async {
    state = CompanyAnalyticsState.loading();
    
    try {
      final analytics = await _fetchAnalytics(period);
      state = CompanyAnalyticsState.loaded(analytics: analytics);
    } catch (e) {
      state = CompanyAnalyticsState.error(message: e.toString());
    }
  }

  Future<CompanyAnalytics> _fetchAnalytics(DateRange period) async {
    final dio = Dio();
    
    final queryParams = {
      'period': period.name,
      'from': _getStartDate(period).toIso8601String(),
      'to': _getEndDate(period).toIso8601String(),
    };

    final response = await dio.get(
      '${AppConfig.baseUrl}/company/analytics',
      queryParameters: queryParams,
      options: Options(
        headers: {'Authorization': 'Bearer ${await _getAuthToken()}'},
      ),
    );

    if (response.statusCode == 200) {
      return CompanyAnalytics.fromJson(response.data);
    } else {
      throw Exception('Failed to load analytics');
    }
  }

  DateTime _getStartDate(DateRange period) {
    final now = DateTime.now();
    
    return switch (period) {
      DateRange.thisWeek => now.subtract(Duration(days: now.weekday - 1)),
      DateRange.thisMonth => DateTime(now.year, now.month, 1),
      DateRange.lastMonth => DateTime(now.year, now.month - 1, 1),
      DateRange.thisQuarter => DateTime(now.year, ((now.month - 1) ~/ 3) * 3 + 1, 1),
      DateRange.thisYear => DateTime(now.year, 1, 1),
    };
  }

  DateTime _getEndDate(DateRange period) {
    final now = DateTime.now();
    
    return switch (period) {
      DateRange.thisWeek => now,
      DateRange.thisMonth => now,
      DateRange.lastMonth => DateTime(now.year, now.month, 0),
      DateRange.thisQuarter => now,
      DateRange.thisYear => now,
    };
  }

  Future<String> _getAuthToken() async {
    final token = LocalStorage.getSetting<String>('access_token');
    if (token == null || token.isEmpty) {
      throw Exception('No authentication token available');
    }
    return token;
  }

  Future<void> refreshAnalytics() async {
    if (state is CompanyAnalyticsLoaded) {
      // Keep current period when refreshing
      await loadAnalytics(DateRange.thisMonth); // Default or store current period
    }
  }
}

sealed class CompanyAnalyticsState {
  const CompanyAnalyticsState();
  
  factory CompanyAnalyticsState.loading() = CompanyAnalyticsLoading;
  factory CompanyAnalyticsState.loaded({required CompanyAnalytics analytics}) = CompanyAnalyticsLoaded;
  factory CompanyAnalyticsState.error({required String message}) = CompanyAnalyticsError;
}

class CompanyAnalyticsLoading extends CompanyAnalyticsState {
  const CompanyAnalyticsLoading();
}

class CompanyAnalyticsLoaded extends CompanyAnalyticsState {
  final CompanyAnalytics analytics;
  const CompanyAnalyticsLoaded({required this.analytics});
}

class CompanyAnalyticsError extends CompanyAnalyticsState {
  final String message;
  const CompanyAnalyticsError({required this.message});
}

class CompanyAnalytics {
  final double totalExpenses;
  final double averageReceiptAmount;
  final int totalReceipts;
  final int pendingApprovals;
  final int teamMemberCount;
  final int activeUsers;
  final double expenseTrend;
  final double averageTrend;
  final double receiptsTrend;
  final Map<String, double> categoryBreakdown;
  final List<ExpenseTrend> monthlyTrends;
  final List<Receipt> recentReceipts;
  final List<TeamActivity> teamActivity;
  final List<VendorExpense> topVendors;
  final List<UserExpense> topSpenders;

  const CompanyAnalytics({
    required this.totalExpenses,
    required this.averageReceiptAmount,
    required this.totalReceipts,
    required this.pendingApprovals,
    required this.teamMemberCount,
    required this.activeUsers,
    required this.expenseTrend,
    required this.averageTrend,
    required this.receiptsTrend,
    required this.categoryBreakdown,
    required this.monthlyTrends,
    required this.recentReceipts,
    required this.teamActivity,
    required this.topVendors,
    required this.topSpenders,
  });

  factory CompanyAnalytics.fromJson(Map<String, dynamic> json) {
    return CompanyAnalytics(
      totalExpenses: (json['totalExpenses'] ?? 0).toDouble(),
      averageReceiptAmount: (json['averageReceiptAmount'] ?? 0).toDouble(),
      totalReceipts: json['totalReceipts'] ?? 0,
      pendingApprovals: json['pendingApprovals'] ?? 0,
      teamMemberCount: json['teamMemberCount'] ?? 0,
      activeUsers: json['activeUsers'] ?? 0,
      expenseTrend: (json['expenseTrend'] ?? 0).toDouble(),
      averageTrend: (json['averageTrend'] ?? 0).toDouble(),
      receiptsTrend: (json['receiptsTrend'] ?? 0).toDouble(),
      categoryBreakdown: Map<String, double>.from(
        (json['categoryBreakdown'] ?? {}).map(
          (key, value) => MapEntry(key, value.toDouble()),
        ),
      ),
      monthlyTrends: (json['monthlyTrends'] as List? ?? [])
          .map((item) => ExpenseTrend.fromJson(item))
          .toList(),
      recentReceipts: (json['recentReceipts'] as List? ?? [])
          .map((item) => Receipt.fromJson(item))
          .toList(),
      teamActivity: (json['teamActivity'] as List? ?? [])
          .map((item) => TeamActivity.fromJson(item))
          .toList(),
      topVendors: (json['topVendors'] as List? ?? [])
          .map((item) => VendorExpense.fromJson(item))
          .toList(),
      topSpenders: (json['topSpenders'] as List? ?? [])
          .map((item) => UserExpense.fromJson(item))
          .toList(),
    );
  }

  // Mock data for development
  factory CompanyAnalytics.mock() {
    return CompanyAnalytics(
      totalExpenses: 15432.50,
      averageReceiptAmount: 87.32,
      totalReceipts: 177,
      pendingApprovals: 12,
      teamMemberCount: 25,
      activeUsers: 18,
      expenseTrend: 12.5,
      averageTrend: -3.2,
      receiptsTrend: 8.1,
      categoryBreakdown: {
        'Food & Dining': 4250.00,
        'Transportation': 3150.00,
        'Office Supplies': 2890.00,
        'Travel': 2650.00,
        'Entertainment': 1890.00,
        'Other': 602.50,
      },
      monthlyTrends: [
        ExpenseTrend(month: 'Jan', amount: 12000),
        ExpenseTrend(month: 'Feb', amount: 13500),
        ExpenseTrend(month: 'Mar', amount: 15432.50),
      ],
      recentReceipts: [], // Would be populated with actual receipts
      teamActivity: [
        TeamActivity(
          id: '1',
          userId: 'user1',
          userName: 'John Doe',
          action: 'uploaded receipt',
          details: 'Coffee at Starbucks - \$12.50',
          timestamp: DateTime.now().subtract(const Duration(minutes: 30)),
        ),
        TeamActivity(
          id: '2',
          userId: 'user2',
          userName: 'Jane Smith',
          action: 'approved expense',
          details: 'Travel expense for client meeting',
          timestamp: DateTime.now().subtract(const Duration(hours: 2)),
        ),
      ],
      topVendors: [
        VendorExpense(name: 'Starbucks', totalAmount: 850.00, receiptCount: 34),
        VendorExpense(name: 'Uber', totalAmount: 720.00, receiptCount: 28),
        VendorExpense(name: 'Amazon', totalAmount: 650.00, receiptCount: 15),
      ],
      topSpenders: [
        UserExpense(
          userId: 'user1',
          name: 'John Doe',
          totalAmount: 2850.00,
          receiptCount: 45,
          avatarUrl: null,
        ),
        UserExpense(
          userId: 'user2',
          name: 'Jane Smith',
          totalAmount: 2320.00,
          receiptCount: 38,
          avatarUrl: null,
        ),
      ],
    );
  }
}

class ExpenseTrend {
  final String month;
  final double amount;

  const ExpenseTrend({
    required this.month,
    required this.amount,
  });

  factory ExpenseTrend.fromJson(Map<String, dynamic> json) {
    return ExpenseTrend(
      month: json['month'],
      amount: (json['amount'] ?? 0).toDouble(),
    );
  }
}

class TeamActivity {
  final String id;
  final String userId;
  final String userName;
  final String action;
  final String details;
  final DateTime timestamp;

  const TeamActivity({
    required this.id,
    required this.userId,
    required this.userName,
    required this.action,
    required this.details,
    required this.timestamp,
  });

  factory TeamActivity.fromJson(Map<String, dynamic> json) {
    return TeamActivity(
      id: json['id'],
      userId: json['userId'],
      userName: json['userName'],
      action: json['action'],
      details: json['details'],
      timestamp: DateTime.parse(json['timestamp']),
    );
  }
}

class VendorExpense {
  final String name;
  final double totalAmount;
  final int receiptCount;

  const VendorExpense({
    required this.name,
    required this.totalAmount,
    required this.receiptCount,
  });

  factory VendorExpense.fromJson(Map<String, dynamic> json) {
    return VendorExpense(
      name: json['name'],
      totalAmount: (json['totalAmount'] ?? 0).toDouble(),
      receiptCount: json['receiptCount'] ?? 0,
    );
  }
}

class UserExpense {
  final String userId;
  final String name;
  final double totalAmount;
  final int receiptCount;
  final String? avatarUrl;

  const UserExpense({
    required this.userId,
    required this.name,
    required this.totalAmount,
    required this.receiptCount,
    this.avatarUrl,
  });

  factory UserExpense.fromJson(Map<String, dynamic> json) {
    return UserExpense(
      userId: json['userId'],
      name: json['name'],
      totalAmount: (json['totalAmount'] ?? 0).toDouble(),
      receiptCount: json['receiptCount'] ?? 0,
      avatarUrl: json['avatarUrl'],
    );
  }
}

enum DateRange {
  thisWeek,
  thisMonth,
  lastMonth,
  thisQuarter,
  thisYear,
}

enum ExportFormat {
  pdf,
  excel,
  csv,
}