import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/local_storage.dart';
import '../models/analytics_models.dart';

class AnalyticsNotifier extends StateNotifier<AsyncValue<AnalyticsDashboard>> {
  final ApiClient _apiClient;
  final LocalStorage _localStorage;
  
  AnalyticsNotifier(this._apiClient, this._localStorage) : super(const AsyncValue.loading());

  Timer? _refreshTimer;

  /// Load comprehensive analytics dashboard data
  Future<void> loadDashboard({
    DateTime? startDate,
    DateTime? endDate,
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh && state is AsyncLoading) return;

    if (forceRefresh || state is AsyncError) {
      state = const AsyncValue.loading();
    }

    try {
      // Build query parameters
      final queryParams = <String, String>{};
      if (startDate != null) {
        queryParams['start'] = startDate.toIso8601String().split('T')[0];
      }
      if (endDate != null) {
        queryParams['end'] = endDate.toIso8601String().split('T')[0];
      }

      final response = await _apiClient.get(
        '/analytics/user/dashboard',
        queryParameters: queryParams,
      );

      if (response.success) {
        final dashboard = AnalyticsDashboard.fromJson(response.data['data']);
        
        // Cache the dashboard data locally
        await _localStorage.setString(
          'analytics_dashboard_cache',
          response.data.toString(),
        );
        await _localStorage.setString(
          'analytics_cache_timestamp',
          DateTime.now().toIso8601String(),
        );

        state = AsyncValue.data(dashboard);
      } else {
        throw Exception(response.error ?? 'Failed to load analytics');
      }
    } catch (e, stack) {
      // Try to load from cache if network fails
      if (!forceRefresh) {
        final cachedData = await _loadFromCache();
        if (cachedData != null) {
          state = AsyncValue.data(cachedData);
          return;
        }
      }
      
      state = AsyncValue.error(e, stack);
    }
  }

  /// Load specific analytics summary
  Future<AnalyticsSummary?> loadSummary({
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    try {
      final queryParams = <String, String>{};
      if (startDate != null) {
        queryParams['start'] = startDate.toIso8601String().split('T')[0];
      }
      if (endDate != null) {
        queryParams['end'] = endDate.toIso8601String().split('T')[0];
      }

      final response = await _apiClient.get(
        '/analytics/user/summary',
        queryParameters: queryParams,
      );

      if (response.success) {
        return AnalyticsSummary.fromJson(response.data['data']);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Load expenses by category
  Future<List<ExpenseCategory>?> loadExpensesByCategory({
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    try {
      final queryParams = <String, String>{};
      if (startDate != null) {
        queryParams['start'] = startDate.toIso8601String().split('T')[0];
      }
      if (endDate != null) {
        queryParams['end'] = endDate.toIso8601String().split('T')[0];
      }

      final response = await _apiClient.get(
        '/analytics/user/categories',
        queryParameters: queryParams,
      );

      if (response.success) {
        return (response.data['data'] as List)
            .map((json) => ExpenseCategory.fromJson(json))
            .toList();
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Load spending trends
  Future<List<SpendingTrend>?> loadSpendingTrends({
    DateTime? startDate,
    DateTime? endDate,
    String period = 'day',
  }) async {
    try {
      final queryParams = <String, String>{
        'period': period,
      };
      if (startDate != null) {
        queryParams['start'] = startDate.toIso8601String().split('T')[0];
      }
      if (endDate != null) {
        queryParams['end'] = endDate.toIso8601String().split('T')[0];
      }

      final response = await _apiClient.get(
        '/analytics/user/trends',
        queryParameters: queryParams,
      );

      if (response.success) {
        return (response.data['data'] as List)
            .map((json) => SpendingTrend.fromJson(json))
            .toList();
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Load business insights
  Future<BusinessInsights?> loadBusinessInsights({
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    try {
      final queryParams = <String, String>{};
      if (startDate != null) {
        queryParams['start'] = startDate.toIso8601String().split('T')[0];
      }
      if (endDate != null) {
        queryParams['end'] = endDate.toIso8601String().split('T')[0];
      }

      final response = await _apiClient.get(
        '/analytics/user/business-insights',
        queryParameters: queryParams,
      );

      if (response.success) {
        return BusinessInsights.fromJson(response.data['data']);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Load top vendors
  Future<List<TopVendor>?> loadTopVendors({
    DateTime? startDate,
    DateTime? endDate,
    int limit = 10,
  }) async {
    try {
      final queryParams = <String, String>{
        'limit': limit.toString(),
      };
      if (startDate != null) {
        queryParams['start'] = startDate.toIso8601String().split('T')[0];
      }
      if (endDate != null) {
        queryParams['end'] = endDate.toIso8601String().split('T')[0];
      }

      final response = await _apiClient.get(
        '/analytics/user/vendors',
        queryParameters: queryParams,
      );

      if (response.success) {
        return (response.data['data'] as List)
            .map((json) => TopVendor.fromJson(json))
            .toList();
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Export analytics data
  Future<String?> exportData({
    DateTime? startDate,
    DateTime? endDate,
    String format = 'csv',
  }) async {
    try {
      final queryParams = <String, String>{
        'format': format,
      };
      if (startDate != null) {
        queryParams['start'] = startDate.toIso8601String().split('T')[0];
      }
      if (endDate != null) {
        queryParams['end'] = endDate.toIso8601String().split('T')[0];
      }

      final response = await _apiClient.get(
        '/analytics/user/export',
        queryParameters: queryParams,
      );

      if (response.success) {
        // Return the file content or download URL
        return response.data.toString();
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Refresh dashboard data
  Future<void> refresh() async {
    await loadDashboard(forceRefresh: true);
  }

  /// Filter dashboard by date range
  Future<void> filterByDateRange(DateTime startDate, DateTime endDate) async {
    await loadDashboard(
      startDate: startDate,
      endDate: endDate,
      forceRefresh: true,
    );
  }

  /// Filter by preset time periods
  Future<void> filterByPeriod(AnalyticsPeriod period) async {
    final now = DateTime.now();
    DateTime startDate;

    switch (period) {
      case AnalyticsPeriod.lastWeek:
        startDate = now.subtract(const Duration(days: 7));
        break;
      case AnalyticsPeriod.lastMonth:
        startDate = DateTime(now.year, now.month - 1, now.day);
        break;
      case AnalyticsPeriod.lastQuarter:
        startDate = DateTime(now.year, now.month - 3, now.day);
        break;
      case AnalyticsPeriod.lastYear:
        startDate = DateTime(now.year - 1, now.month, now.day);
        break;
      case AnalyticsPeriod.allTime:
        await loadDashboard(forceRefresh: true);
        return;
    }

    await filterByDateRange(startDate, now);
  }

  /// Start auto-refresh timer
  void startAutoRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(const Duration(minutes: 5), (_) {
      if (!state.isLoading) {
        refresh();
      }
    });
  }

  /// Stop auto-refresh timer
  void stopAutoRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
  }

  /// Load from local cache
  Future<AnalyticsDashboard?> _loadFromCache() async {
    try {
      final cachedData = await _localStorage.getString('analytics_dashboard_cache');
      final cacheTimestamp = await _localStorage.getString('analytics_cache_timestamp');
      
      if (cachedData != null && cacheTimestamp != null) {
        final timestamp = DateTime.parse(cacheTimestamp);
        final now = DateTime.now();
        
        // Use cache if it's less than 30 minutes old
        if (now.difference(timestamp).inMinutes < 30) {
          // Parse the cached JSON and return the dashboard
          // This is a simplified version - you'd need to properly parse the JSON
          return null; // TODO: Implement proper JSON parsing
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  @override
  void dispose() {
    stopAutoRefresh();
    super.dispose();
  }
}

// Providers
final apiClientProvider = Provider<ApiClient>((ref) => ApiClient.instance);
final localStorageProvider = Provider<LocalStorage>((ref) => LocalStorage());

final analyticsProvider = StateNotifierProvider<AnalyticsNotifier, AsyncValue<AnalyticsDashboard>>(
  (ref) {
    final apiClient = ref.read(apiClientProvider);
    final localStorage = ref.read(localStorageProvider);
    return AnalyticsNotifier(apiClient, localStorage);
  },
);

// Specific analytics providers for different data types
final analyticsSummaryProvider = FutureProvider.family<AnalyticsSummary?, DateRange?>((ref, dateRange) async {
  final notifier = ref.read(analyticsProvider.notifier);
  return await notifier.loadSummary(
    startDate: dateRange?.start,
    endDate: dateRange?.end,
  );
});

final expensesByCategoryProvider = FutureProvider.family<List<ExpenseCategory>?, DateRange?>((ref, dateRange) async {
  final notifier = ref.read(analyticsProvider.notifier);
  return await notifier.loadExpensesByCategory(
    startDate: dateRange?.start,
    endDate: dateRange?.end,
  );
});

final spendingTrendsProvider = FutureProvider.family<List<SpendingTrend>?, SpendingTrendsParams>((ref, params) async {
  final notifier = ref.read(analyticsProvider.notifier);
  return await notifier.loadSpendingTrends(
    startDate: params.dateRange?.start,
    endDate: params.dateRange?.end,
    period: params.period,
  );
});

final businessInsightsProvider = FutureProvider.family<BusinessInsights?, DateRange?>((ref, dateRange) async {
  final notifier = ref.read(analyticsProvider.notifier);
  return await notifier.loadBusinessInsights(
    startDate: dateRange?.start,
    endDate: dateRange?.end,
  );
});

final topVendorsProvider = FutureProvider.family<List<TopVendor>?, TopVendorsParams>((ref, params) async {
  final notifier = ref.read(analyticsProvider.notifier);
  return await notifier.loadTopVendors(
    startDate: params.dateRange?.start,
    endDate: params.dateRange?.end,
    limit: params.limit,
  );
});

// Helper classes for provider parameters
class DateRange {
  final DateTime start;
  final DateTime end;

  DateRange({required this.start, required this.end});
}

class SpendingTrendsParams {
  final DateRange? dateRange;
  final String period;

  SpendingTrendsParams({this.dateRange, this.period = 'day'});
}

class TopVendorsParams {
  final DateRange? dateRange;
  final int limit;

  TopVendorsParams({this.dateRange, this.limit = 10});
}

enum AnalyticsPeriod {
  lastWeek,
  lastMonth,
  lastQuarter,
  lastYear,
  allTime,
}