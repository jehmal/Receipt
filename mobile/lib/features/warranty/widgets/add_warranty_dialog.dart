import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/warranty.dart';

class AddWarrantyDialog extends StatefulWidget {
  final Warranty? warranty; // If provided, we're editing
  final Function(Warranty) onSave;

  const AddWarrantyDialog({
    super.key,
    this.warranty,
    required this.onSave,
  });

  @override
  State<AddWarrantyDialog> createState() => _AddWarrantyDialogState();
}

class _AddWarrantyDialogState extends State<AddWarrantyDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _itemNameController;
  late final TextEditingController _brandController;
  late final TextEditingController _modelController;
  late final TextEditingController _serialNumberController;
  late final TextEditingController _purchasePriceController;
  late final TextEditingController _storeController;
  late final TextEditingController _notesController;

  String _selectedCategory = WarrantyCategories.categories.first;
  DateTime _purchaseDate = DateTime.now();
  DateTime _expiryDate = DateTime.now().add(const Duration(days: 365));

  @override
  void initState() {
    super.initState();
    
    final warranty = widget.warranty;
    _itemNameController = TextEditingController(text: warranty?.itemName ?? '');
    _brandController = TextEditingController(text: warranty?.brand ?? '');
    _modelController = TextEditingController(text: warranty?.model ?? '');
    _serialNumberController = TextEditingController(text: warranty?.serialNumber ?? '');
    _purchasePriceController = TextEditingController(
      text: warranty?.purchasePrice?.toString() ?? '',
    );
    _storeController = TextEditingController(text: warranty?.store ?? '');
    _notesController = TextEditingController(text: warranty?.notes ?? '');

    if (warranty != null) {
      _selectedCategory = warranty.category;
      _purchaseDate = warranty.purchaseDate;
      _expiryDate = warranty.expiryDate;
    }
  }

  @override
  void dispose() {
    _itemNameController.dispose();
    _brandController.dispose();
    _modelController.dispose();
    _serialNumberController.dispose();
    _purchasePriceController.dispose();
    _storeController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isEditing = widget.warranty != null;

    return Dialog(
      child: Container(
        width: double.maxFinite,
        padding: const EdgeInsets.all(24),
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isEditing ? 'Edit Warranty' : 'Add Warranty',
                  style: theme.textTheme.headlineSmall,
                ),
                const SizedBox(height: 24),
                
                // Item Name
                TextFormField(
                  controller: _itemNameController,
                  decoration: const InputDecoration(
                    labelText: 'Item Name *',
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Item name is required';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Category
                DropdownButtonFormField<String>(
                  value: _selectedCategory,
                  decoration: const InputDecoration(
                    labelText: 'Category *',
                    border: OutlineInputBorder(),
                  ),
                  items: WarrantyCategories.categories.map((category) {
                    return DropdownMenuItem(
                      value: category,
                      child: Text(category),
                    );
                  }).toList(),
                  onChanged: (value) {
                    if (value != null) {
                      setState(() {
                        _selectedCategory = value;
                      });
                    }
                  },
                ),
                const SizedBox(height: 16),

                // Brand
                TextFormField(
                  controller: _brandController,
                  decoration: const InputDecoration(
                    labelText: 'Brand',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),

                // Model
                TextFormField(
                  controller: _modelController,
                  decoration: const InputDecoration(
                    labelText: 'Model',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),

                // Serial Number
                TextFormField(
                  controller: _serialNumberController,
                  decoration: const InputDecoration(
                    labelText: 'Serial Number',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),

                // Purchase Price
                TextFormField(
                  controller: _purchasePriceController,
                  decoration: const InputDecoration(
                    labelText: 'Purchase Price',
                    border: OutlineInputBorder(),
                    prefixText: '\$',
                  ),
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
                  ],
                ),
                const SizedBox(height: 16),

                // Store
                TextFormField(
                  controller: _storeController,
                  decoration: const InputDecoration(
                    labelText: 'Store/Vendor',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),

                // Purchase Date
                InkWell(
                  onTap: () => _selectDate(context, true),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
                    decoration: BoxDecoration(
                      border: Border.all(color: theme.colorScheme.outline),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Purchase Date: ${_formatDate(_purchaseDate)}',
                          style: theme.textTheme.bodyMedium,
                        ),
                        const Icon(Icons.calendar_today),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Expiry Date
                InkWell(
                  onTap: () => _selectDate(context, false),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
                    decoration: BoxDecoration(
                      border: Border.all(color: theme.colorScheme.outline),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Expiry Date: ${_formatDate(_expiryDate)}',
                          style: theme.textTheme.bodyMedium,
                        ),
                        const Icon(Icons.calendar_today),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Notes
                TextFormField(
                  controller: _notesController,
                  decoration: const InputDecoration(
                    labelText: 'Notes',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 3,
                ),
                const SizedBox(height: 24),

                // Action Buttons
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Cancel'),
                    ),
                    const SizedBox(width: 16),
                    ElevatedButton(
                      onPressed: _saveWarranty,
                      child: Text(isEditing ? 'Update' : 'Add'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _selectDate(BuildContext context, bool isPurchaseDate) async {
    final initialDate = isPurchaseDate ? _purchaseDate : _expiryDate;
    final firstDate = isPurchaseDate 
        ? DateTime(2000) 
        : _purchaseDate;
    final lastDate = isPurchaseDate 
        ? DateTime.now() 
        : DateTime.now().add(const Duration(days: 365 * 10));

    final selectedDate = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: firstDate,
      lastDate: lastDate,
    );

    if (selectedDate != null) {
      setState(() {
        if (isPurchaseDate) {
          _purchaseDate = selectedDate;
          // Auto-adjust expiry date if it's before purchase date
          if (_expiryDate.isBefore(_purchaseDate)) {
            _expiryDate = _purchaseDate.add(const Duration(days: 365));
          }
        } else {
          _expiryDate = selectedDate;
        }
      });
    }
  }

  void _saveWarranty() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    double? purchasePrice;
    if (_purchasePriceController.text.isNotEmpty) {
      purchasePrice = double.tryParse(_purchasePriceController.text);
    }

    final warranty = widget.warranty?.copyWith(
      itemName: _itemNameController.text.trim(),
      category: _selectedCategory,
      brand: _brandController.text.trim().isEmpty ? null : _brandController.text.trim(),
      model: _modelController.text.trim().isEmpty ? null : _modelController.text.trim(),
      serialNumber: _serialNumberController.text.trim().isEmpty ? null : _serialNumberController.text.trim(),
      purchasePrice: purchasePrice,
      store: _storeController.text.trim().isEmpty ? null : _storeController.text.trim(),
      purchaseDate: _purchaseDate,
      expiryDate: _expiryDate,
      notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      updatedAt: DateTime.now(),
    ) ?? Warranty.create(
      itemName: _itemNameController.text.trim(),
      category: _selectedCategory,
      brand: _brandController.text.trim().isEmpty ? null : _brandController.text.trim(),
      model: _modelController.text.trim().isEmpty ? null : _modelController.text.trim(),
      serialNumber: _serialNumberController.text.trim().isEmpty ? null : _serialNumberController.text.trim(),
      purchasePrice: purchasePrice,
      store: _storeController.text.trim().isEmpty ? null : _storeController.text.trim(),
      purchaseDate: _purchaseDate,
      expiryDate: _expiryDate,
      notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
    );

    widget.onSave(warranty);
    Navigator.of(context).pop();
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }
}