import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import '../providers/search_provider.dart';
import '../widgets/search_bar_widget.dart';
import '../widgets/filter_chips_widget.dart';
import '../widgets/search_result_card.dart';
import '../../receipts/widgets/receipt_card.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocus = FocusNode();
  bool _showFilters = false;

  @override
  void initState() {
    super.initState();
    // Load filter options when screen initializes
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(filterOptionsProvider.notifier).loadFilterOptions();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final searchState = ref.watch(searchProvider);
    final suggestions = ref.watch(searchSuggestionsProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: CustomScrollView(
        slivers: [
          // Search App Bar
          SliverAppBar(
            floating: true,
            snap: true,
            elevation: 0,
            backgroundColor: Theme.of(context).colorScheme.surface,
            title: SearchBarWidget(
              controller: _searchController,
              focusNode: _searchFocus,
              onChanged: (query) {
                ref.read(searchSuggestionsProvider.notifier).getSuggestions(query);
              },
              onSubmitted: (query) {
                _performSearch(query);
              },
              onSemanticSearch: (query) {
                _performSemanticSearch(query);
              },
            ),
            actions: [
              IconButton(
                onPressed: () {
                  setState(() {
                    _showFilters = !_showFilters;
                  });
                },
                icon: Icon(
                  _showFilters ? Icons.filter_list_off : Icons.filter_list,
                ),
              ),
            ],
          ),

          // Quick Filters
          if (!_showFilters)
            SliverToBoxAdapter(
              child: _buildQuickFilters(),
            ),

          // Advanced Filters
          if (_showFilters)
            SliverToBoxAdapter(
              child: _buildAdvancedFilters(),
            ),

          // Search Suggestions
          if (_searchFocus.hasFocus && suggestions.isNotEmpty)
            SliverToBoxAdapter(
              child: _buildSuggestions(suggestions),
            ),

          // Search Results
          _buildSearchResults(searchState),
        ],
      ),
    );
  }

  Widget _buildQuickFilters() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildQuickFilterChip('Today', QuickFilter.today),
            _buildQuickFilterChip('This Week', QuickFilter.thisWeek),
            _buildQuickFilterChip('This Month', QuickFilter.thisMonth),
            _buildQuickFilterChip('High Value', QuickFilter.highValue),
            _buildQuickFilterChip('Business', QuickFilter.business),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickFilterChip(String label, QuickFilter filter) {
    final searchState = ref.watch(searchProvider);
    final isSelected = searchState is _SuccessState && searchState.quickFilter == filter;

    return Container(
      margin: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (selected) {
          if (selected) {
            ref.read(searchProvider.notifier).quickFilter(filter);
          } else {
            ref.read(searchProvider.notifier).clearSearch();
          }
        },
      ),
    );
  }

  Widget _buildAdvancedFilters() {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Advanced Filters',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              
              // Date Range Filter
              _buildDateRangeFilter(),
              
              const SizedBox(height: 16),
              
              // Category Filter
              _buildCategoryFilter(),
              
              const SizedBox(height: 16),
              
              // Amount Range Filter
              _buildAmountRangeFilter(),
              
              const SizedBox(height: 16),
              
              // Apply/Clear buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        ref.read(searchProvider.notifier).clearSearch();
                        setState(() {
                          _showFilters = false;
                        });
                      },
                      child: const Text('Clear'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: () {
                        // Apply current filters
                        _performSearch(_searchController.text);
                        setState(() {
                          _showFilters = false;
                        });
                      },
                      child: const Text('Apply'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDateRangeFilter() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Date Range',
          style: Theme.of(context).textTheme.labelLarge,
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () async {
            final dateRange = await showDateRangePicker(
              context: context,
              firstDate: DateTime(2020),
              lastDate: DateTime.now(),
            );
            if (dateRange != null) {
              // Update filter state
            }
          },
          icon: const Icon(Icons.date_range),
          label: const Text('Select Date Range'),
        ),
      ],
    );
  }

  Widget _buildCategoryFilter() {
    final filterOptions = ref.watch(filterOptionsProvider);
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Categories',
          style: Theme.of(context).textTheme.labelLarge,
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          children: filterOptions.categories.map((category) {
            return FilterChip(
              label: Text(category),
              selected: false, // Update with actual selection state
              onSelected: (selected) {
                // Update category filter
              },
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildAmountRangeFilter() {
    final filterOptions = ref.watch(filterOptionsProvider);
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Amount Range',
          style: Theme.of(context).textTheme.labelLarge,
        ),
        const SizedBox(height: 8),
        RangeSlider(
          values: const RangeValues(0, 100),
          min: filterOptions.amountRange.start,
          max: filterOptions.amountRange.end,
          divisions: 20,
          labels: const RangeLabels('\$0', '\$100'),
          onChanged: (values) {
            // Update amount range filter
          },
        ),
      ],
    );
  }

  Widget _buildSuggestions(List<String> suggestions) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Card(
        child: Column(
          children: suggestions.map((suggestion) {
            return ListTile(
              leading: const Icon(Icons.search),
              title: Text(suggestion),
              onTap: () {
                _searchController.text = suggestion;
                _performSearch(suggestion);
                _searchFocus.unfocus();
              },
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildSearchResults(SearchState state) {
    return switch (state) {
      _InitialState() => _buildEmptyState(),
      _LoadingState() => _buildLoadingState(),
      _SuccessState(results: final results) => _buildResultsList(results),
      _ErrorState(message: final message) => _buildErrorState(message),
    };
  }

  Widget _buildEmptyState() {
    return SliverFillRemaining(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.search,
              size: 64,
              color: Theme.of(context).colorScheme.outline,
            ),
            const SizedBox(height: 16),
            Text(
              'Search your receipts',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              'Use keywords, dates, or amounts to find receipts',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingState() {
    return const SliverFillRemaining(
      child: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }

  Widget _buildResultsList(List<Receipt> results) {
    if (results.isEmpty) {
      return SliverFillRemaining(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.search_off,
                size: 64,
                color: Theme.of(context).colorScheme.outline,
              ),
              const SizedBox(height: 16),
              Text(
                'No receipts found',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text(
                'Try adjusting your search terms or filters',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.all(16),
      sliver: SliverList(
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            final receipt = results[index];
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: ReceiptCard(receipt: receipt),
            );
          },
          childCount: results.length,
        ),
      ),
    );
  }

  Widget _buildErrorState(String message) {
    return SliverFillRemaining(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text(
              'Search failed',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () {
                _performSearch(_searchController.text);
              },
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  void _performSearch(String query) {
    _searchFocus.unfocus();
    ref.read(searchProvider.notifier).search(query);
  }

  void _performSemanticSearch(String query) {
    _searchFocus.unfocus();
    ref.read(searchProvider.notifier).semanticSearch(query);
  }
}