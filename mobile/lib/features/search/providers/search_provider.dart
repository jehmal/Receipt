import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/config/app_config.dart';
import '../../../core/storage/local_storage.dart';
import '../../../shared/models/receipt.dart';

part 'search_provider.g.dart';

@riverpod
class SearchNotifier extends _$SearchNotifier {
  @override
  SearchState build() => SearchState.initial();

  Future<void> search(String query, {SearchFilters? filters}) async {
    if (query.trim().isEmpty && (filters == null || filters.isEmpty)) {
      state = SearchState.initial();
      return;
    }

    state = SearchState.loading();

    try {
      final results = await _performSearch(query, filters);
      state = SearchState.success(
        results: results,
        query: query,
        filters: filters,
      );
    } catch (e) {
      state = SearchState.error(message: e.toString());
    }
  }

  Future<void> semanticSearch(String query, {SearchFilters? filters}) async {
    state = SearchState.loading();

    try {
      final results = await _performSemanticSearch(query, filters);
      state = SearchState.success(
        results: results,
        query: query,
        filters: filters,
        isSemanticSearch: true,
      );
    } catch (e) {
      state = SearchState.error(message: e.toString());
    }
  }

  Future<void> quickFilter(QuickFilter filter) async {
    final filters = _getFiltersForQuickFilter(filter);
    state = SearchState.loading();

    try {
      final results = await _performSearch('', filters);
      state = SearchState.success(
        results: results,
        query: '',
        filters: filters,
        quickFilter: filter,
      );
    } catch (e) {
      state = SearchState.error(message: e.toString());
    }
  }

  Future<List<Receipt>> _performSearch(String query, SearchFilters? filters) async {
    final dio = Dio();
    
    final queryParams = <String, dynamic>{
      if (query.isNotEmpty) 'q': query,
      if (filters?.dateRange != null) ...{
        'from': filters!.dateRange!.start.toIso8601String(),
        'to': filters.dateRange!.end.toIso8601String(),
      },
      if (filters?.categories != null && filters!.categories.isNotEmpty)
        'categories': filters.categories.join(','),
      if (filters?.tags != null && filters!.tags.isNotEmpty)
        'tags': filters.tags.join(','),
      if (filters?.amountRange != null) ...{
        'min_amount': filters!.amountRange!.start,
        'max_amount': filters.amountRange!.end,
      },
      if (filters?.vendor != null && filters!.vendor!.isNotEmpty)
        'vendor': filters.vendor,
    };

    final response = await dio.get(
      '${AppConfig.baseUrl}/receipts/search',
      queryParameters: queryParams,
      options: Options(
        headers: {'Authorization': 'Bearer ${await _getAuthToken()}'},
      ),
    );

    if (response.statusCode == 200) {
      final data = response.data as List;
      return data.map((json) => Receipt.fromJson(json)).toList();
    } else {
      throw Exception('Search failed');
    }
  }

  Future<List<Receipt>> _performSemanticSearch(String query, SearchFilters? filters) async {
    final dio = Dio();
    
    final payload = {
      'query': query,
      'limit': 50,
      if (filters != null) 'filters': filters.toJson(),
    };

    final response = await dio.post(
      '${AppConfig.baseUrl}/receipts/semantic-search',
      data: payload,
      options: Options(
        headers: {'Authorization': 'Bearer ${await _getAuthToken()}'},
      ),
    );

    if (response.statusCode == 200) {
      final data = response.data['results'] as List;
      return data.map((json) => Receipt.fromJson(json)).toList();
    } else {
      throw Exception('Semantic search failed');
    }
  }

  SearchFilters _getFiltersForQuickFilter(QuickFilter filter) {
    final now = DateTime.now();
    
    return switch (filter) {
      QuickFilter.today => SearchFilters(
          dateRange: DateTimeRange(
            start: DateTime(now.year, now.month, now.day),
            end: now,
          ),
        ),
      QuickFilter.thisWeek => SearchFilters(
          dateRange: DateTimeRange(
            start: now.subtract(Duration(days: now.weekday - 1)),
            end: now,
          ),
        ),
      QuickFilter.thisMonth => SearchFilters(
          dateRange: DateTimeRange(
            start: DateTime(now.year, now.month, 1),
            end: now,
          ),
        ),
      QuickFilter.lastMonth => SearchFilters(
          dateRange: DateTimeRange(
            start: DateTime(now.year, now.month - 1, 1),
            end: DateTime(now.year, now.month, 0),
          ),
        ),
      QuickFilter.highValue => SearchFilters(
          amountRange: const RangeValues(100, double.infinity),
        ),
      QuickFilter.business => SearchFilters(
          categories: ['Business', 'Office', 'Travel'],
        ),
    };
  }

  Future<String> _getAuthToken() async {
    final token = LocalStorage.getSetting<String>('access_token');
    if (token == null || token.isEmpty) {
      throw Exception('No authentication token available');
    }
    return token;
  }

  void clearSearch() {
    state = SearchState.initial();
  }
}

@riverpod
class SearchSuggestionsNotifier extends _$SearchSuggestionsNotifier {
  @override
  List<String> build() => [];

  Future<void> getSuggestions(String query) async {
    if (query.length < 2) {
      state = [];
      return;
    }

    try {
      final dio = Dio();
      final response = await dio.get(
        '${AppConfig.baseUrl}/receipts/search/suggestions',
        queryParameters: {'q': query},
        options: Options(
          headers: {'Authorization': 'Bearer ${await _getAuthToken()}'},
        ),
      );

      if (response.statusCode == 200) {
        state = List<String>.from(response.data['suggestions'] ?? []);
      }
    } catch (e) {
      // Fallback to local suggestions
      state = _getLocalSuggestions(query);
    }
  }

  List<String> _getLocalSuggestions(String query) {
    const commonSuggestions = [
      'coffee', 'lunch', 'gas', 'office supplies', 'hotel',
      'restaurant', 'taxi', 'grocery', 'pharmacy', 'parking',
    ];
    
    return commonSuggestions
        .where((suggestion) => suggestion.toLowerCase().contains(query.toLowerCase()))
        .take(5)
        .toList();
  }

  Future<String> _getAuthToken() async {
    final token = LocalStorage.getSetting<String>('access_token');
    if (token == null || token.isEmpty) {
      throw Exception('No authentication token available');
    }
    return token;
  }
}

@riverpod
class FilterOptionsNotifier extends _$FilterOptionsNotifier {
  @override
  FilterOptions build() => FilterOptions.empty();

  Future<void> loadFilterOptions() async {
    try {
      final dio = Dio();
      final response = await dio.get(
        '${AppConfig.baseUrl}/receipts/filter-options',
        options: Options(
          headers: {'Authorization': 'Bearer ${await _getAuthToken()}'},
        ),
      );

      if (response.statusCode == 200) {
        state = FilterOptions.fromJson(response.data);
      }
    } catch (e) {
      // Fallback to default options
      state = FilterOptions.defaults();
    }
  }

  Future<String> _getAuthToken() async {
    final token = LocalStorage.getSetting<String>('access_token');
    if (token == null || token.isEmpty) {
      throw Exception('No authentication token available');
    }
    return token;
  }
}

sealed class SearchState {
  const SearchState();
  
  factory SearchState.initial() = SearchInitialState;
  factory SearchState.loading() = SearchLoadingState;
  factory SearchState.success({
    required List<Receipt> results,
    required String query,
    SearchFilters? filters,
    QuickFilter? quickFilter,
    bool isSemanticSearch,
  }) = SearchSuccessState;
  factory SearchState.error({required String message}) = SearchErrorState;
}

class SearchInitialState extends SearchState {
  const SearchInitialState();
}

class SearchLoadingState extends SearchState {
  const SearchLoadingState();
}

class SearchSuccessState extends SearchState {
  final List<Receipt> results;
  final String query;
  final SearchFilters? filters;
  final QuickFilter? quickFilter;
  final bool isSemanticSearch;

  const SearchSuccessState({
    required this.results,
    required this.query,
    this.filters,
    this.quickFilter,
    this.isSemanticSearch = false,
  });
}

class SearchErrorState extends SearchState {
  final String message;
  const SearchErrorState({required this.message});
}

class SearchFilters {
  final DateTimeRange? dateRange;
  final List<String> categories;
  final List<String> tags;
  final RangeValues? amountRange;
  final String? vendor;

  const SearchFilters({
    this.dateRange,
    this.categories = const [],
    this.tags = const [],
    this.amountRange,
    this.vendor,
  });

  bool get isEmpty => 
      dateRange == null &&
      categories.isEmpty &&
      tags.isEmpty &&
      amountRange == null &&
      (vendor?.isEmpty ?? true);

  Map<String, dynamic> toJson() {
    return {
      if (dateRange != null) 'dateRange': {
        'start': dateRange!.start.toIso8601String(),
        'end': dateRange!.end.toIso8601String(),
      },
      if (categories.isNotEmpty) 'categories': categories,
      if (tags.isNotEmpty) 'tags': tags,
      if (amountRange != null) 'amountRange': {
        'start': amountRange!.start,
        'end': amountRange!.end,
      },
      if (vendor?.isNotEmpty == true) 'vendor': vendor,
    };
  }

  SearchFilters copyWith({
    DateTimeRange? dateRange,
    List<String>? categories,
    List<String>? tags,
    RangeValues? amountRange,
    String? vendor,
  }) {
    return SearchFilters(
      dateRange: dateRange ?? this.dateRange,
      categories: categories ?? this.categories,
      tags: tags ?? this.tags,
      amountRange: amountRange ?? this.amountRange,
      vendor: vendor ?? this.vendor,
    );
  }
}

enum QuickFilter {
  today,
  thisWeek,
  thisMonth,
  lastMonth,
  highValue,
  business,
}

class FilterOptions {
  final List<String> categories;
  final List<String> tags;
  final List<String> vendors;
  final RangeValues amountRange;

  const FilterOptions({
    required this.categories,
    required this.tags,
    required this.vendors,
    required this.amountRange,
  });

  factory FilterOptions.empty() {
    return const FilterOptions(
      categories: [],
      tags: [],
      vendors: [],
      amountRange: RangeValues(0, 1000),
    );
  }

  factory FilterOptions.defaults() {
    return const FilterOptions(
      categories: [
        'Food & Dining',
        'Transportation',
        'Shopping',
        'Entertainment',
        'Business',
        'Travel',
        'Health',
        'Education',
        'Utilities',
        'Other',
      ],
      tags: [
        'business',
        'personal',
        'reimbursable',
        'tax-deductible',
        'urgent',
        'receipt',
        'invoice',
      ],
      vendors: [
        'Starbucks',
        'McDonald\'s',
        'Shell',
        'Target',
        'Amazon',
        'Uber',
        'Hotel',
        'Restaurant',
      ],
      amountRange: RangeValues(0, 10000),
    );
  }

  factory FilterOptions.fromJson(Map<String, dynamic> json) {
    return FilterOptions(
      categories: List<String>.from(json['categories'] ?? []),
      tags: List<String>.from(json['tags'] ?? []),
      vendors: List<String>.from(json['vendors'] ?? []),
      amountRange: RangeValues(
        (json['amountRange']?['min'] ?? 0).toDouble(),
        (json['amountRange']?['max'] ?? 10000).toDouble(),
      ),
    );
  }
}

// Legacy provider aliases for compatibility
final searchProvider = searchNotifierProvider;
final searchSuggestionsProvider = searchSuggestionsNotifierProvider;
final filterOptionsProvider = filterOptionsNotifierProvider;