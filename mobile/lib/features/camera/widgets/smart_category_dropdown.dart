import 'package:flutter/material.dart';

class SmartCategoryDropdown extends StatelessWidget {
  final List<String> categories;
  final String? selectedCategory;
  final ValueChanged<String?> onChanged;

  const SmartCategoryDropdown({
    super.key,
    required this.categories,
    required this.selectedCategory,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: colorScheme.outline.withOpacity(0.3),
        ),
        color: colorScheme.surfaceVariant.withOpacity(0.3),
      ),
      child: DropdownButtonFormField<String>(
        value: selectedCategory,
        decoration: InputDecoration(
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          border: InputBorder.none,
          prefixIcon: Icon(
            _getCategoryIcon(selectedCategory),
            color: selectedCategory != null 
              ? colorScheme.primary
              : colorScheme.onSurfaceVariant,
          ),
          hintText: 'Select category',
          hintStyle: TextStyle(
            color: colorScheme.onSurfaceVariant.withOpacity(0.7),
          ),
        ),
        dropdownColor: colorScheme.surface,
        icon: Icon(
          Icons.keyboard_arrow_down,
          color: colorScheme.onSurfaceVariant,
        ),
        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
          color: colorScheme.onSurface,
        ),
        items: categories.map((String category) {
          return DropdownMenuItem<String>(
            value: category,
            child: Row(
              children: [
                Icon(
                  _getCategoryIcon(category),
                  size: 20,
                  color: colorScheme.primary,
                ),
                const SizedBox(width: 12),
                Text(category),
              ],
            ),
          );
        }).toList(),
        onChanged: onChanged,
        validator: (value) {
          if (value == null || value.isEmpty) {
            return 'Please select a category';
          }
          return null;
        },
      ),
    );
  }

  IconData _getCategoryIcon(String? category) {
    switch (category) {
      case 'Parts':
        return Icons.build_circle;
      case 'Fuel':
        return Icons.local_gas_station;
      case 'Tools':
        return Icons.construction;
      case 'Parking':
        return Icons.local_parking;
      case 'Warranty':
        return Icons.verified_user;
      case 'Food & Dining':
        return Icons.restaurant;
      case 'Office Supplies':
        return Icons.business_center;
      case 'Travel':
        return Icons.flight;
      case 'Other':
        return Icons.category;
      default:
        return Icons.category_outlined;
    }
  }
}