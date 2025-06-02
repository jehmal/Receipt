import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/receipts_provider.dart';
import '../widgets/receipt_card.dart';
import '../widgets/receipts_filter.dart';
import '../../../shared/widgets/loading_skeleton.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../core/network/api_exception.dart';

class ReceiptsScreen extends ConsumerStatefulWidget {
  const ReceiptsScreen({super.key});

  @override
  ConsumerState<ReceiptsScreen> createState() => _ReceiptsScreenState();
}

class _ReceiptsScreenState extends ConsumerState<ReceiptsScreen> {
  final ScrollController _scrollController = ScrollController();
  String _selectedFilter = 'all';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(receiptsProvider.notifier).loadReceipts();
    });
  }

  @override
  Widget build(BuildContext context) {
    final receiptsState = ref.watch(receiptsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Receipts'),
        actions: [
          IconButton(
            onPressed: () {
              // Show export options
              _showExportDialog();
            },
            icon: const Icon(Icons.download),
          ),
          IconButton(
            onPressed: () {
              // Show sync status
              ref.read(receiptsProvider.notifier).syncReceipts();
            },
            icon: const Icon(Icons.sync),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter options
          ReceiptsFilter(
            selectedFilter: _selectedFilter,
            onFilterChanged: (filter) {
              setState(() {
                _selectedFilter = filter;
              });
              ref.read(receiptsProvider.notifier).filterReceipts(filter);
            },
          ),
          
          // Receipt list
          Expanded(
            child: receiptsState.when(
              data: (receipts) {
                if (receipts.isEmpty) {
                  return NoReceiptsEmptyState(
                    onAddReceipt: () {
                      // Navigate to camera tab
                      DefaultTabController.of(context).animateTo(1);
                    },
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async {
                    await ref.read(receiptsProvider.notifier).refreshReceipts();
                  },
                  child: ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: receipts.length,
                    itemBuilder: (context, index) {
                      final receipt = receipts[index];
                      return ReceiptCard(
                        receipt: receipt,
                        onTap: () {
                          _showReceiptDetail(receipt);
                        },
                        onDelete: () {
                          _confirmDelete(receipt);
                        },
                      );
                    },
                  ),
                );
              },
              loading: () => const ReceiptListSkeleton(),
              error: (error, stack) {
                final apiError = error is ApiException ? error : null;
                return ErrorView(
                  error: apiError,
                  message: apiError?.userFriendlyMessage ?? error.toString(),
                  onRetry: () {
                    ref.read(receiptsProvider.notifier).loadReceipts();
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showReceiptDetail(receipt) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.9,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (context, scrollController) => Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Receipt Details',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // Receipt details implementation
              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (receipt.vendor != null) ...[
                        Text(
                          'Vendor',
                          style: Theme.of(context).textTheme.labelLarge,
                        ),
                        Text(receipt.vendor!),
                        const SizedBox(height: 16),
                      ],
                      if (receipt.amount != null) ...[
                        Text(
                          'Amount',
                          style: Theme.of(context).textTheme.labelLarge,
                        ),
                        Text('${receipt.currency ?? 'USD'} ${receipt.amount}'),
                        const SizedBox(height: 16),
                      ],
                      Text(
                        'Date',
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                      Text(receipt.date.toString().split(' ')[0]),
                      const SizedBox(height: 16),
                      if (receipt.ocrText != null) ...[
                        Text(
                          'Receipt Text',
                          style: Theme.of(context).textTheme.labelLarge,
                        ),
                        Text(receipt.ocrText!),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmDelete(receipt) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Receipt'),
        content: const Text('Are you sure you want to delete this receipt?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ref.read(receiptsProvider.notifier).deleteReceipt(receipt.id);
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _showExportDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Export Receipts'),
        content: const Text('Choose export format:'),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ref.read(receiptsProvider.notifier).exportReceipts('pdf');
            },
            child: const Text('PDF'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ref.read(receiptsProvider.notifier).exportReceipts('csv');
            },
            child: const Text('CSV'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
        ],
      ),
    );
  }
}