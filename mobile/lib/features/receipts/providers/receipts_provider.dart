import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/receipt.dart';
import '../data/repositories/receipt_repository.dart';
import '../../../core/sync/sync_service.dart';

class ReceiptsNotifier extends StateNotifier<AsyncValue<List<Receipt>>> {
  final ReceiptRepository _repository;
  final SyncService _syncService;

  ReceiptsNotifier(this._repository, this._syncService) : super(const AsyncValue.loading());

  Future<void> loadReceipts({
    int page = 1,
    int limit = 50,
    String? search,
    String? category,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    if (state is AsyncLoading && page == 1) {
      // Don't set loading if we're already loading the first page
    } else if (page == 1) {
      state = const AsyncValue.loading();
    }
    
    try {
      final result = await _repository.getReceipts(
        page: page,
        limit: limit,
        search: search,
        category: category,
        startDate: startDate,
        endDate: endDate,
      );

      if (result.isSuccess) {
        final receipts = result.data!;
        if (page == 1) {
          state = AsyncValue.data(receipts);
        } else {
          // Append to existing list for pagination
          state.whenData((currentReceipts) {
            final updatedList = [...currentReceipts, ...receipts];
            state = AsyncValue.data(updatedList);
          });
        }
      } else {
        state = AsyncValue.error(result.error!, StackTrace.current);
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> deleteReceipt(String id) async {
    try {
      final result = await _repository.deleteReceipt(id);
      
      if (result.isSuccess) {
        // Remove from current state
        state.whenData((receipts) {
          final updatedReceipts = receipts.where((r) => r.id != id).toList();
          state = AsyncValue.data(updatedReceipts);
        });
      } else {
        state = AsyncValue.error(result.error!, StackTrace.current);
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> syncReceipts() async {
    try {
      final result = await _repository.syncReceipts();
      
      if (result.isSuccess) {
        state = AsyncValue.data(result.data!);
      } else {
        // Don't show error for sync failure, just log it
        print('Sync failed: ${result.error?.message}');
      }
    } catch (e) {
      print('Sync error: $e');
    }
  }

  Future<void> filterReceipts(String filter) async {
    state = const AsyncValue.loading();
    
    try {
      DateTime? startDate;
      String? status;
      
      switch (filter) {
        case 'recent':
          startDate = DateTime.now().subtract(const Duration(days: 7));
          break;
        case 'processed':
          status = 'processed';
          break;
        case 'unprocessed':
          // Get all statuses except processed
          break;
        case 'all':
        default:
          // No filters
          break;
      }

      final result = await _repository.getReceipts(
        startDate: startDate,
        limit: 100, // Get more for filtering
      );

      if (result.isSuccess) {
        var filteredReceipts = result.data!;
        
        if (filter == 'unprocessed') {
          filteredReceipts = filteredReceipts.where((r) => !r.isProcessed).toList();
        }

        state = AsyncValue.data(filteredReceipts);
      } else {
        state = AsyncValue.error(result.error!, StackTrace.current);
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> exportReceipts(String format) async {
    // TODO: Implement export functionality
    print('Exporting receipts in $format format');
  }

  Future<void> refreshReceipts() async {
    await loadReceipts(page: 1);
  }

  void startAutoSync() {
    _syncService.startPeriodicSync();
  }

  void stopAutoSync() {
    _syncService.stopPeriodicSync();
  }
}

// Repository provider
final receiptRepositoryProvider = Provider<ReceiptRepository>((ref) {
  return ReceiptRepositoryImpl();
});

// Sync service provider
final syncServiceProvider = Provider<SyncService>((ref) {
  return SyncService.instance;
});

// Main receipts provider
final receiptsProvider = StateNotifierProvider<ReceiptsNotifier, AsyncValue<List<Receipt>>>(
  (ref) {
    final repository = ref.read(receiptRepositoryProvider);
    final syncService = ref.read(syncServiceProvider);
    return ReceiptsNotifier(repository, syncService);
  },
);