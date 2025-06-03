import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_theme.dart';
import '../../../core/config/app_config.dart';
import '../models/warranty.dart';
import '../providers/warranty_provider.dart';
import '../widgets/warranty_card.dart';
import '../widgets/warranty_filter_chips.dart';
import '../widgets/add_warranty_dialog.dart';

class WarrantyScreen extends ConsumerStatefulWidget {
  const WarrantyScreen({super.key});

  @override
  ConsumerState<WarrantyScreen> createState() => _WarrantyScreenState();
}

class _WarrantyScreenState extends ConsumerState<WarrantyScreen>
    with TickerProviderStateMixin {
  late AnimationController _fadeController;
  late Animation<double> _fadeAnimation;
  
  WarrantyFilter _currentFilter = WarrantyFilter.all;
  WarrantySortBy _currentSort = WarrantySortBy.expiryDate;

  @override
  void initState() {
    super.initState();
    
    _fadeController = AnimationController(
      duration: AppTheme.normalAnimation,
      vsync: this,
    );
    
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: AppTheme.defaultCurve,
    );
    
    _fadeController.forward();
    
    // Load warranties on init
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(warrantyNotifierProvider.notifier).loadWarranties();
    });
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final warrantiesAsync = ref.watch(warrantyNotifierProvider);
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tool Warranties'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          // Sort menu
          PopupMenuButton<WarrantySortBy>(
            icon: const Icon(Icons.sort),
            onSelected: (sort) {
              setState(() {
                _currentSort = sort;
              });
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: WarrantySortBy.expiryDate,
                child: Text('Sort by Expiry Date'),
              ),
              const PopupMenuItem(
                value: WarrantySortBy.purchaseDate,
                child: Text('Sort by Purchase Date'),
              ),
              const PopupMenuItem(
                value: WarrantySortBy.itemName,
                child: Text('Sort by Item Name'),
              ),
              const PopupMenuItem(
                value: WarrantySortBy.value,
                child: Text('Sort by Value'),
              ),
            ],
          ),
          
          // Search
          IconButton(
            onPressed: () => _showSearchDialog(),
            icon: const Icon(Icons.search),
          ),
        ],
      ),
      body: FadeTransition(
        opacity: _fadeAnimation,
        child: Column(
          children: [
            // Filter chips
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingM,
                vertical: AppTheme.spacingS,
              ),
              child: WarrantyFilterChips(
                currentFilter: _currentFilter,
                currentSort: _currentSort,
                onFilterChanged: (filter) {
                  setState(() {
                    _currentFilter = filter;
                  });
                },
                onSortChanged: (sort) {
                  setState(() {
                    _currentSort = sort;
                  });
                },
              ),
            ),
            
            // Main content
            Expanded(
              child: warrantiesAsync.when(
                data: (warranties) {
                  if (warranties.isEmpty) {
                    return _buildEmptyState();
                  }
                  
                  final filteredWarranties = _filterAndSortWarranties(warranties);
                  
                  return RefreshIndicator(
                    onRefresh: () async {
                      await ref.read(warrantyNotifierProvider.notifier).loadWarranties();
                    },
                    child: ListView.separated(
                      padding: const EdgeInsets.all(AppTheme.spacingM),
                      itemCount: filteredWarranties.length,
                      separatorBuilder: (context, index) => 
                          const SizedBox(height: AppTheme.spacingM),
                      itemBuilder: (context, index) {
                        final warranty = filteredWarranties[index];
                        return Hero(
                          tag: 'warranty_${warranty.id}',
                          child: WarrantyCard(
                            warranty: warranty,
                            onTap: () => _navigateToWarrantyDetail(warranty),
                            onEdit: () => _editWarranty(warranty),
                            onDelete: () => _deleteWarranty(warranty),
                          ),
                        );
                      },
                    ),
                  );
                },
                loading: () => _buildLoadingState(),
                error: (error, stack) => _buildErrorState(error),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addWarranty,
        icon: const Icon(Icons.add),
        label: const Text('Add Warranty'),
        backgroundColor: AppTheme.success,
      ),
    );
  }

  List<Warranty> _filterAndSortWarranties(List<Warranty> warranties) {
    // Apply filter
    List<Warranty> filtered = warranties;
    
    switch (_currentFilter) {
      case WarrantyFilter.active:
        filtered = warranties.where((w) => !w.isExpired).toList();
        break;
      case WarrantyFilter.expired:
        filtered = warranties.where((w) => w.isExpired).toList();
        break;
      case WarrantyFilter.expiring:
        final thirtyDaysFromNow = DateTime.now().add(const Duration(days: 30));
        filtered = warranties.where((w) => 
            !w.isExpired && 
            w.expiryDate.isBefore(thirtyDaysFromNow)
        ).toList();
        break;
      case WarrantyFilter.all:
        // No filtering
        break;
    }
    
    // Apply sort
    switch (_currentSort) {
      case WarrantySortBy.expiryDate:
        filtered.sort((a, b) => a.expiryDate.compareTo(b.expiryDate));
        break;
      case WarrantySortBy.purchaseDate:
        filtered.sort((a, b) => b.purchaseDate.compareTo(a.purchaseDate));
        break;
      case WarrantySortBy.itemName:
        filtered.sort((a, b) => a.itemName.compareTo(b.itemName));
        break;
      case WarrantySortBy.value:
        filtered.sort((a, b) => (b.purchasePrice ?? 0).compareTo(a.purchasePrice ?? 0));
        break;
    }
    
    return filtered;
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingXL),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.verified_user_outlined,
              size: 120,
              color: Theme.of(context).colorScheme.primary.withOpacity(0.5),
            ),
            const SizedBox(height: AppTheme.spacingL),
            Text(
              'No Warranties Yet',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: AppTheme.spacingM),
            Text(
              'Start tracking your tool warranties to never miss an expiration date.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: AppTheme.spacingXL),
            ElevatedButton.icon(
              onPressed: _addWarranty,
              icon: const Icon(Icons.add),
              label: const Text('Add Your First Warranty'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.success,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppTheme.spacingXL,
                  vertical: AppTheme.spacingM,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingState() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(),
          SizedBox(height: AppTheme.spacingM),
          Text('Loading warranties...'),
        ],
      ),
    );
  }

  Widget _buildErrorState(Object error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingXL),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: AppTheme.error,
            ),
            const SizedBox(height: AppTheme.spacingM),
            Text(
              'Failed to load warranties',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: AppTheme.error,
              ),
            ),
            const SizedBox(height: AppTheme.spacingS),
            Text(
              error.toString(),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: AppTheme.spacingL),
            ElevatedButton.icon(
              onPressed: () {
                ref.read(warrantyNotifierProvider.notifier).loadWarranties();
              },
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  void _addWarranty() {
    AppTheme.lightHaptic();
    showDialog(
      context: context,
      builder: (context) => AddWarrantyDialog(
        onSave: (warranty) {
          ref.read(warrantyNotifierProvider.notifier).addWarranty(warranty);
        },
      ),
    );
  }

  void _editWarranty(Warranty warranty) {
    AppTheme.lightHaptic();
    showDialog(
      context: context,
      builder: (context) => AddWarrantyDialog(
        warranty: warranty,
        onSave: (updatedWarranty) {
          ref.read(warrantyNotifierProvider.notifier).updateWarranty(updatedWarranty);
        },
      ),
    );
  }

  void _deleteWarranty(Warranty warranty) {
    AppTheme.mediumHaptic();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Warranty'),
        content: Text(
          'Are you sure you want to delete the warranty for "${warranty.itemName}"?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              ref.read(warrantyNotifierProvider.notifier).deleteWarranty(warranty.id);
              
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Warranty for "${warranty.itemName}" deleted'),
                  action: SnackBarAction(
                    label: 'Undo',
                    onPressed: () {
                      ref.read(warrantyNotifierProvider.notifier).addWarranty(warranty);
                    },
                  ),
                ),
              );
            },
            style: TextButton.styleFrom(foregroundColor: AppTheme.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _navigateToWarrantyDetail(Warranty warranty) {
    AppTheme.lightHaptic();
    Navigator.of(context).pushNamed(
      '/warranty-detail',
      arguments: warranty,
    );
  }

  void _showSearchDialog() {
    AppTheme.lightHaptic();
    showSearch(
      context: context,
      delegate: WarrantySearchDelegate(
        warranties: ref.read(warrantyNotifierProvider).asData?.value ?? [],
      ),
    );
  }
}

// Search delegate for warranty search
class WarrantySearchDelegate extends SearchDelegate<Warranty?> {
  final List<Warranty> warranties;

  WarrantySearchDelegate({required this.warranties});

  @override
  List<Widget> buildActions(BuildContext context) {
    return [
      IconButton(
        onPressed: () => query = '',
        icon: const Icon(Icons.clear),
      ),
    ];
  }

  @override
  Widget buildLeading(BuildContext context) {
    return IconButton(
      onPressed: () => close(context, null),
      icon: const Icon(Icons.arrow_back),
    );
  }

  @override
  Widget buildResults(BuildContext context) {
    return _buildSearchResults();
  }

  @override
  Widget buildSuggestions(BuildContext context) {
    return _buildSearchResults();
  }

  Widget _buildSearchResults() {
    final filtered = warranties.where((warranty) {
      return warranty.itemName.toLowerCase().contains(query.toLowerCase()) ||
             warranty.category.toLowerCase().contains(query.toLowerCase()) ||
             warranty.brand?.toLowerCase().contains(query.toLowerCase()) == true;
    }).toList();

    if (filtered.isEmpty) {
      return const Center(
        child: Text('No warranties found'),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(AppTheme.spacingM),
      itemCount: filtered.length,
      separatorBuilder: (context, index) => const SizedBox(height: AppTheme.spacingM),
      itemBuilder: (context, index) {
        final warranty = filtered[index];
        return WarrantyCard(
          warranty: warranty,
          onTap: () => close(context, warranty),
        );
      },
    );
  }
}