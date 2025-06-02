import 'dart:async';
import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

import '../../../shared/models/receipt.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/database/database_helper.dart';

class SearchService {
  final ApiClient _apiClient = ApiClient.instance;
  final DatabaseHelper _db = DatabaseHelper.instance;
  
  static SearchService? _instance;

  SearchService._internal();

  static SearchService get instance {
    _instance ??= SearchService._internal();
    return _instance!;
  }

  // Advanced search with backend integration
  Future<SearchResult> searchReceipts({
    required String query,
    String? category,
    List<String>? tags,
    DateTime? dateFrom,
    DateTime? dateTo,
    double? amountMin,
    double? amountMax,
    String? merchantName,
    String? status,
    int page = 1,
    int limit = 20,
    String sortBy = 'relevance',
    String sortOrder = 'desc',
    bool highlight = false,
  }) async {
    try {
      final connectivityResult = await Connectivity().checkConnectivity();
      
      if (connectivityResult == ConnectivityResult.none) {
        // Perform local search when offline
        return await _searchLocal(
          query: query,
          category: category,
          tags: tags,
          dateFrom: dateFrom,
          dateTo: dateTo,
          amountMin: amountMin,
          amountMax: amountMax,
          merchantName: merchantName,
          limit: limit,
        );
      }

      // Online search using backend API
      final searchData = <String, dynamic>{
        'query': query,
        'page': page,
        'limit': limit,
        'sortBy': sortBy,
        'sortOrder': sortOrder,
        'highlight': highlight,
      };

      if (category != null) searchData['category'] = category;
      if (tags != null) searchData['tags'] = tags;
      if (dateFrom != null) searchData['dateFrom'] = dateFrom.toIso8601String().split('T')[0];
      if (dateTo != null) searchData['dateTo'] = dateTo.toIso8601String().split('T')[0];
      if (amountMin != null) searchData['amountMin'] = amountMin;
      if (amountMax != null) searchData['amountMax'] = amountMax;
      if (merchantName != null) searchData['merchantName'] = merchantName;
      if (status != null) searchData['status'] = status;

      final response = await _apiClient.post(
        '/search/receipts',
        searchData,
      );

      if (response.statusCode == 200) {
        final data = response.data['data'];
        final results = (data['results'] as List)
            .map((r) => Receipt.fromJson(r))
            .toList();

        return SearchResult(
          query: query,
          results: results,
          total: data['pagination']['total'],
          page: data['pagination']['page'],
          totalPages: data['pagination']['totalPages'],
          suggestions: _extractSuggestions(data),
          facets: _extractFacets(data),
          isOffline: false,
        );
      }

      throw ApiException(
        message: response.data['message'] ?? 'Search failed',
        statusCode: response.statusCode ?? 500,
        type: ApiExceptionType.serverError,
      );
    } catch (e) {
      if (e is ApiException && e.isNetworkError) {
        // Fallback to local search
        return await _searchLocal(
          query: query,
          category: category,
          tags: tags,
          dateFrom: dateFrom,
          dateTo: dateTo,
          amountMin: amountMin,
          amountMax: amountMax,
          merchantName: merchantName,
          limit: limit,
        );
      }

      throw e is ApiException ? e : ApiException(
        message: 'Search failed: $e',
        statusCode: 0,
        type: ApiExceptionType.unknown,
      );
    }
  }

  // Quick search for autocomplete suggestions
  Future<List<SearchSuggestion>> getQuickSuggestions({
    required String query,
    String type = 'all',
    int limit = 10,
  }) async {
    try {
      final connectivityResult = await Connectivity().checkConnectivity();
      
      if (connectivityResult == ConnectivityResult.none) {
        return await _getLocalSuggestions(query, type, limit);
      }

      final response = await _apiClient.get(
        '/search/quick',
        queryParameters: {
          'q': query,
          'type': type,
          'limit': limit,
        },
      );

      if (response.statusCode == 200) {
        final suggestions = response.data['data']['suggestions'] as List;
        return suggestions.map((s) => SearchSuggestion.fromJson(s)).toList();
      }

      // Fallback to local suggestions on error
      return await _getLocalSuggestions(query, type, limit);
    } catch (e) {
      // Always fallback to local suggestions
      return await _getLocalSuggestions(query, type, limit);
    }
  }

  // Get saved searches
  Future<List<SavedSearch>> getSavedSearches() async {
    try {
      final response = await _apiClient.get('/search/saved');
      
      if (response.statusCode == 200) {
        final searches = response.data['data'] as List;
        return searches.map((s) => SavedSearch.fromJson(s)).toList();
      }

      return [];
    } catch (e) {
      return [];
    }
  }

  // Save a search
  Future<bool> saveSearch({
    required String name,
    required Map<String, dynamic> filters,
    Map<String, dynamic>? options,
  }) async {
    try {
      final response = await _apiClient.post(
        '/search/saved',
        {
          'name': name,
          'filters': filters,
          'options': options ?? {},
        },
      );

      return response.statusCode == 201;
    } catch (e) {
      return false;
    }
  }

  // Delete saved search
  Future<bool> deleteSavedSearch(String id) async {
    try {
      final response = await _apiClient.delete('/search/saved/$id');
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  // Local search implementation for offline mode
  Future<SearchResult> _searchLocal({
    required String query,
    String? category,
    List<String>? tags,
    DateTime? dateFrom,
    DateTime? dateTo,
    double? amountMin,
    double? amountMax,
    String? merchantName,
    int limit = 20,
  }) async {
    final results = await _db.searchReceipts(
      query: query.isNotEmpty ? query : null,
      category: category,
      startDate: dateFrom,
      endDate: dateTo,
      vendorName: merchantName,
      minAmount: amountMin,
      maxAmount: amountMax,
      tags: tags,
    );

    final limitedResults = results.take(limit).toList();

    return SearchResult(
      query: query,
      results: limitedResults,
      total: results.length,
      page: 1,
      totalPages: (results.length / limit).ceil(),
      suggestions: _generateLocalSuggestions(results),
      facets: {},
      isOffline: true,
    );
  }

  // Get local suggestions for offline mode
  Future<List<SearchSuggestion>> _getLocalSuggestions(
    String query,
    String type,
    int limit,
  ) async {
    final suggestions = <SearchSuggestion>[];
    
    if (query.isEmpty) return suggestions;

    final receipts = await _db.getAllReceipts();
    
    // Extract merchants
    if (type == 'all' || type == 'merchants') {
      final merchants = receipts
          .where((r) => r.vendorName != null && r.vendorName!.toLowerCase().contains(query.toLowerCase()))
          .map((r) => r.vendorName!)
          .toSet()
          .take(limit ~/ 2)
          .map((m) => SearchSuggestion(
                suggestion: m,
                type: 'merchant',
                count: receipts.where((r) => r.vendorName == m).length,
              ))
          .toList();
      suggestions.addAll(merchants);
    }

    // Extract categories
    if (type == 'all' || type == 'categories') {
      final categories = receipts
          .where((r) => r.category != null && r.category!.toLowerCase().contains(query.toLowerCase()))
          .map((r) => r.category!)
          .toSet()
          .take(limit ~/ 2)
          .map((c) => SearchSuggestion(
                suggestion: c,
                type: 'category',
                count: receipts.where((r) => r.category == c).length,
              ))
          .toList();
      suggestions.addAll(categories);
    }

    // Extract tags
    if (type == 'all' || type == 'tags') {
      final tags = receipts
          .expand((r) => r.tags)
          .where((tag) => tag.toLowerCase().contains(query.toLowerCase()))
          .toSet()
          .take(limit ~/ 3)
          .map((t) => SearchSuggestion(
                suggestion: t,
                type: 'tag',
                count: receipts.where((r) => r.tags.contains(t)).length,
              ))
          .toList();
      suggestions.addAll(tags);
    }

    return suggestions.take(limit).toList();
  }

  List<String> _generateLocalSuggestions(List<Receipt> receipts) {
    final suggestions = <String>{};
    
    for (final receipt in receipts.take(10)) {
      if (receipt.vendorName != null) suggestions.add(receipt.vendorName!);
      if (receipt.category != null) suggestions.add(receipt.category!);
      suggestions.addAll(receipt.tags);
    }
    
    return suggestions.take(5).toList();
  }

  List<String> _extractSuggestions(Map<String, dynamic> data) {
    final suggestions = data['suggestions'] as List?;
    return suggestions?.cast<String>() ?? [];
  }

  Map<String, List<FacetItem>> _extractFacets(Map<String, dynamic> data) {
    final facets = data['facets'] as Map<String, dynamic>?;
    if (facets == null) return {};

    final result = <String, List<FacetItem>>{};
    
    for (final entry in facets.entries) {
      final items = (entry.value as List)
          .map((item) => FacetItem.fromJson(item))
          .toList();
      result[entry.key] = items;
    }
    
    return result;
  }
}

class SearchResult {
  final String query;
  final List<Receipt> results;
  final int total;
  final int page;
  final int totalPages;
  final List<String> suggestions;
  final Map<String, List<FacetItem>> facets;
  final bool isOffline;

  SearchResult({
    required this.query,
    required this.results,
    required this.total,
    required this.page,
    required this.totalPages,
    required this.suggestions,
    required this.facets,
    required this.isOffline,
  });

  bool get isEmpty => results.isEmpty;
  bool get hasMore => page < totalPages;
}

class SearchSuggestion {
  final String suggestion;
  final String type;
  final int count;

  SearchSuggestion({
    required this.suggestion,
    required this.type,
    required this.count,
  });

  factory SearchSuggestion.fromJson(Map<String, dynamic> json) {
    return SearchSuggestion(
      suggestion: json['suggestion'],
      type: json['type'],
      count: json['count'] ?? 0,
    );
  }

  IconData get icon {
    switch (type) {
      case 'merchant':
        return Icons.store;
      case 'category':
        return Icons.category;
      case 'tag':
        return Icons.tag;
      default:
        return Icons.search;
    }
  }
}

class SavedSearch {
  final String id;
  final String name;
  final Map<String, dynamic> filters;
  final Map<String, dynamic> options;
  final DateTime createdAt;

  SavedSearch({
    required this.id,
    required this.name,
    required this.filters,
    required this.options,
    required this.createdAt,
  });

  factory SavedSearch.fromJson(Map<String, dynamic> json) {
    return SavedSearch(
      id: json['id'],
      name: json['name'],
      filters: json['filters'] ?? {},
      options: json['options'] ?? {},
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}

class FacetItem {
  final String value;
  final int count;

  FacetItem({
    required this.value,
    required this.count,
  });

  factory FacetItem.fromJson(Map<String, dynamic> json) {
    return FacetItem(
      value: json['value'],
      count: json['count'],
    );
  }
}