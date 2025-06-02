import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:io';

import '../../../shared/models/receipt.dart';
import '../../../shared/widgets/context_toggle.dart';
import '../providers/camera_provider.dart';
import '../widgets/voice_memo_widget.dart';
import '../widgets/smart_category_dropdown.dart';
import '../widgets/job_number_field.dart';

class ReceiptProcessingScreen extends ConsumerStatefulWidget {
  final File imageFile;
  final Map<String, dynamic>? ocrResult;

  const ReceiptProcessingScreen({
    super.key,
    required this.imageFile,
    this.ocrResult,
  });

  @override
  ConsumerState<ReceiptProcessingScreen> createState() => _ReceiptProcessingScreenState();
}

class _ReceiptProcessingScreenState extends ConsumerState<ReceiptProcessingScreen> {
  late TextEditingController _memoController;
  late TextEditingController _jobNumberController;
  
  String? _selectedCategory;
  List<String> _selectedTags = [];
  String _voiceMemo = '';
  bool _isProcessing = false;

  // Pre-defined categories for tradies/business
  final List<String> _categories = [
    'Parts',
    'Fuel', 
    'Tools',
    'Parking',
    'Warranty',
    'Food & Dining',
    'Office Supplies',
    'Travel',
    'Other',
  ];

  final List<String> _availableTags = [
    'business',
    'personal', 
    'reimbursable',
    'tax-deductible',
    'warranty',
    'urgent',
  ];

  @override
  void initState() {
    super.initState();
    _memoController = TextEditingController();
    _jobNumberController = TextEditingController();
    
    // Pre-populate with OCR results if available
    if (widget.ocrResult != null) {
      _selectedCategory = _smartCategoryGuess(widget.ocrResult!);
    }
  }

  @override
  void dispose() {
    _memoController.dispose();
    _jobNumberController.dispose();
    super.dispose();
  }

  String? _smartCategoryGuess(Map<String, dynamic> ocrResult) {
    final text = (ocrResult['text'] as String? ?? '').toLowerCase();
    
    if (text.contains('shell') || text.contains('bp') || text.contains('fuel') || text.contains('gas')) {
      return 'Fuel';
    } else if (text.contains('bunnings') || text.contains('tools') || text.contains('hardware')) {
      return 'Tools';
    } else if (text.contains('parking') || text.contains('meter')) {
      return 'Parking';
    } else if (text.contains('warranty') || text.contains('receipt')) {
      return 'Warranty';
    }
    
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final currentContext = ref.watch(receiptContextProvider);

    return Scaffold(
      backgroundColor: colorScheme.surface,
      appBar: AppBar(
        title: const Text('Process Receipt'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          if (_isProcessing)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else
            TextButton.icon(
              onPressed: _saveReceipt,
              icon: const Icon(Icons.check),
              label: const Text('Save'),
              style: TextButton.styleFrom(
                foregroundColor: colorScheme.primary,
              ),
            ),
        ],
      ),
      body: CustomScrollView(
        slivers: [
          // Receipt Image Preview
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.all(16),
              height: 200,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(
                  widget.imageFile,
                  fit: BoxFit.cover,
                ),
              ),
            ),
          ),

          // OCR Results (if available)
          if (widget.ocrResult != null) ...[
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.auto_awesome,
                          color: colorScheme.onPrimaryContainer,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Auto-Detected',
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            color: colorScheme.onPrimaryContainer,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    if (widget.ocrResult!['amount'] != null)
                      Text(
                        'Amount: \$${widget.ocrResult!['amount']}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onPrimaryContainer,
                        ),
                      ),
                    if (widget.ocrResult!['vendor'] != null)
                      Text(
                        'Vendor: ${widget.ocrResult!['vendor']}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onPrimaryContainer,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 16)),
          ],

          // Form Fields
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Category Selection
                  Text(
                    'Category',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  SmartCategoryDropdown(
                    categories: _categories,
                    selectedCategory: _selectedCategory,
                    onChanged: (category) {
                      setState(() {
                        _selectedCategory = category;
                      });
                    },
                  ),
                  
                  const SizedBox(height: 24),

                  // Tags Selection
                  Text(
                    'Tags',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: _availableTags.map((tag) {
                      final isSelected = _selectedTags.contains(tag);
                      return FilterChip(
                        label: Text(tag),
                        selected: isSelected,
                        onSelected: (selected) {
                          setState(() {
                            if (selected) {
                              _selectedTags.add(tag);
                            } else {
                              _selectedTags.remove(tag);
                            }
                          });
                        },
                        backgroundColor: colorScheme.surfaceVariant,
                        selectedColor: colorScheme.primaryContainer,
                        labelStyle: TextStyle(
                          color: isSelected 
                            ? colorScheme.onPrimaryContainer
                            : colorScheme.onSurfaceVariant,
                        ),
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 24),

                  // Job Number (only for company context)
                  if (currentContext == ReceiptContext.company) ...[
                    Text(
                      'Job Number (Optional)',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    JobNumberField(
                      controller: _jobNumberController,
                    ),
                    const SizedBox(height: 24),
                  ],

                  // Voice Memo
                  Text(
                    'Memo',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  VoiceMemoWidget(
                    onVoiceMemo: (memo) {
                      setState(() {
                        _voiceMemo = memo;
                        _memoController.text = memo;
                      });
                    },
                    textController: _memoController,
                  ),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _saveReceipt() async {
    if (_isProcessing) return;

    setState(() {
      _isProcessing = true;
    });

    try {
      final currentContext = ref.read(receiptContextProvider);
      
      // Create receipt data
      final receiptData = {
        'image_file': widget.imageFile,
        'category': _selectedCategory,
        'tags': _selectedTags,
        'description': _memoController.text.trim(),
        'job_number': currentContext == ReceiptContext.company 
          ? _jobNumberController.text.trim()
          : null,
        'context': currentContext.name,
        'ocr_data': widget.ocrResult,
      };

      // Save via provider
      await ref.read(cameraProvider.notifier).saveReceipt(receiptData);

      if (mounted) {
        // Show success and navigate back
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(
                  Icons.check_circle,
                  color: Theme.of(context).colorScheme.onPrimary,
                ),
                const SizedBox(width: 8),
                const Text('Receipt saved successfully!'),
              ],
            ),
            backgroundColor: Theme.of(context).colorScheme.primary,
            behavior: SnackBarBehavior.floating,
          ),
        );

        // Navigate back to home
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save receipt: $error'),
            backgroundColor: Theme.of(context).colorScheme.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isProcessing = false;
        });
      }
    }
  }
}