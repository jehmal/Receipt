import 'package:flutter/material.dart';

enum WarrantyFilter {
  all,
  active,
  expiring,
  expired,
}

enum WarrantySortBy {
  expiryDate,
  purchaseDate,
  itemName,
  value,
}

class WarrantyFilterChips extends StatelessWidget {
  final WarrantyFilter currentFilter;
  final WarrantySortBy currentSort;
  final Function(WarrantyFilter) onFilterChanged;
  final Function(WarrantySortBy) onSortChanged;

  const WarrantyFilterChips({
    super.key,
    required this.currentFilter,
    required this.currentSort,
    required this.onFilterChanged,
    required this.onSortChanged,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Filter by Status',
            style: theme.textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: WarrantyFilter.values.map((filter) {
                final isSelected = filter == currentFilter;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(_getFilterLabel(filter)),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) {
                        onFilterChanged(filter);
                      }
                    },
                    selectedColor: theme.colorScheme.primaryContainer,
                    checkmarkColor: theme.colorScheme.onPrimaryContainer,
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Sort by',
            style: theme.textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: WarrantySortBy.values.map((sort) {
                final isSelected = sort == currentSort;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(_getSortLabel(sort)),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) {
                        onSortChanged(sort);
                      }
                    },
                    selectedColor: theme.colorScheme.secondaryContainer,
                    checkmarkColor: theme.colorScheme.onSecondaryContainer,
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  String _getFilterLabel(WarrantyFilter filter) {
    switch (filter) {
      case WarrantyFilter.all:
        return 'All';
      case WarrantyFilter.active:
        return 'Active';
      case WarrantyFilter.expiring:
        return 'Expiring Soon';
      case WarrantyFilter.expired:
        return 'Expired';
    }
  }

  String _getSortLabel(WarrantySortBy sort) {
    switch (sort) {
      case WarrantySortBy.expiryDate:
        return 'Expiry Date';
      case WarrantySortBy.purchaseDate:
        return 'Purchase Date';
      case WarrantySortBy.itemName:
        return 'Item Name';
      case WarrantySortBy.value:
        return 'Value';
    }
  }
}