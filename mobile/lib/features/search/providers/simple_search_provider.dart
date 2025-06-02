import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/receipt.dart';
import '../data/search_service.dart';

class SimpleSearchState {
  final String query;
  final List<Receipt> results;
  final List<SearchSuggestion> suggestions;
  final bool isLoading;
  final String? error;
  final bool isOffline;

  const SimpleSearchState({
    this.query = '',
    this.results = const [],
    this.suggestions = const [],
    this.isLoading = false,
    this.error,
    this.isOffline = false,
  });

  SimpleSearchState copyWith({
    String? query,
    List<Receipt>? results,
    List<SearchSuggestion>? suggestions,
    bool? isLoading,
    String? error,
    bool? isOffline,
  }) {
    return SimpleSearchState(
      query: query ?? this.query,
      results: results ?? this.results,
      suggestions: suggestions ?? this.suggestions,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      isOffline: isOffline ?? this.isOffline,
    );
  }

  bool get hasResults => results.isNotEmpty;
  bool get hasError => error != null;
  bool get isEmpty => !isLoading && !hasError && !hasResults && query.isNotEmpty;
}

class SimpleSearchNotifier extends StateNotifier<SimpleSearchState> {
  final SearchService _searchService;
  Timer? _debounceTimer;

  SimpleSearchNotifier(this._searchService) : super(const SimpleSearchState());

  void search(String query) {
    if (query.isEmpty) {
      state = state.copyWith(
        query: '',
        results: [],
        suggestions: [],
        error: null,
      );
      return;
    }

    state = state.copyWith(
      query: query,
      isLoading: true,
      error: null,
    );

    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 500), () async {
      try {
        final result = await _searchService.searchReceipts(query: query);

        if (mounted) {
          state = state.copyWith(
            results: result.results,
            suggestions: [],
            isLoading: false,
            isOffline: result.isOffline,
          );
        }
      } catch (e) {
        if (mounted) {
          state = state.copyWith(
            isLoading: false,
            error: e.toString(),
          );
        }
      }
    });
  }

  Future<void> getSuggestions(String query) async {
    if (query.isEmpty) {
      state = state.copyWith(suggestions: []);
      return;
    }

    try {
      final suggestions = await _searchService.getQuickSuggestions(
        query: query,
        limit: 8,
      );

      if (mounted) {
        state = state.copyWith(suggestions: suggestions);
      }
    } catch (e) {
      // Ignore suggestion errors
    }
  }

  void clearSearch() {
    _debounceTimer?.cancel();
    state = const SimpleSearchState();
  }

  void applySuggestion(SearchSuggestion suggestion) {
    search(suggestion.suggestion);
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    super.dispose();
  }
}

final simpleSearchProvider = StateNotifierProvider<SimpleSearchNotifier, SimpleSearchState>((ref) {
  final searchService = SearchService.instance;
  return SimpleSearchNotifier(searchService);
});