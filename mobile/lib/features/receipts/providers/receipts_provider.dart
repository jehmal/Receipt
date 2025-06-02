import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/receipt.dart';
import '../../../core/storage/local_storage.dart';

class ReceiptsNotifier extends StateNotifier<AsyncValue<List<Receipt>>> {
  ReceiptsNotifier() : super(const AsyncValue.loading());

  Future<void> loadReceipts() async {
    state = const AsyncValue.loading();
    
    try {
      final receipts = LocalStorage.getAllReceipts();
      // Sort by creation date (newest first)
      receipts.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      state = AsyncValue.data(receipts);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> deleteReceipt(String id) async {
    try {
      await LocalStorage.deleteReceipt(id);
      await loadReceipts(); // Refresh the list
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> syncReceipts() async {
    // TODO: Implement sync with server
    await loadReceipts();
  }

  Future<void> filterReceipts(String filter) async {
    try {
      final allReceipts = LocalStorage.getAllReceipts();
      List<Receipt> filteredReceipts;

      switch (filter) {
        case 'recent':
          final weekAgo = DateTime.now().subtract(const Duration(days: 7));
          filteredReceipts = allReceipts
              .where((r) => r.createdAt.isAfter(weekAgo))
              .toList();
          break;
        case 'processed':
          filteredReceipts = allReceipts
              .where((r) => r.isProcessed)
              .toList();
          break;
        case 'unprocessed':
          filteredReceipts = allReceipts
              .where((r) => !r.isProcessed)
              .toList();
          break;
        default:
          filteredReceipts = allReceipts;
      }

      filteredReceipts.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      state = AsyncValue.data(filteredReceipts);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> exportReceipts(String format) async {
    // TODO: Implement export functionality
    // For now, just show a placeholder
    print('Exporting receipts in $format format');
  }
}

final receiptsProvider = StateNotifierProvider<ReceiptsNotifier, AsyncValue<List<Receipt>>>(
  (ref) => ReceiptsNotifier(),
);