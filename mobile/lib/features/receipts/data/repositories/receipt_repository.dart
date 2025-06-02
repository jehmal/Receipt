import 'dart:io';
import 'package:connectivity_plus/connectivity_plus.dart';

import '../../../../shared/models/receipt.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/storage/local_storage.dart';

abstract class ReceiptRepository {
  Future<Result<List<Receipt>>> getReceipts({
    int page = 1,
    int limit = 20,
    String? search,
    String? category,
    DateTime? startDate,
    DateTime? endDate,
    String? vendorName,
    double? minAmount,
    double? maxAmount,
    List<String>? tags,
    String sortBy = 'createdAt',
    String sortOrder = 'desc',
  });

  Future<Result<Receipt>> getReceiptById(String id);

  Future<Result<Receipt>> createReceipt({
    required File file,
    String? category,
    String? description,
    List<String>? tags,
  });

  Future<Result<Receipt>> updateReceipt(
    String id, {
    String? category,
    String? description,
    List<String>? tags,
    String? vendorName,
    double? totalAmount,
    String? currency,
    DateTime? receiptDate,
  });

  Future<Result<void>> deleteReceipt(String id);

  Future<Result<List<Receipt>>> syncReceipts();
}

class ReceiptRepositoryImpl implements ReceiptRepository {
  final ApiClient _apiClient = ApiClient.instance;

  @override
  Future<Result<List<Receipt>>> getReceipts({
    int page = 1,
    int limit = 20,
    String? search,
    String? category,
    DateTime? startDate,
    DateTime? endDate,
    String? vendorName,
    double? minAmount,
    double? maxAmount,
    List<String>? tags,
    String sortBy = 'createdAt',
    String sortOrder = 'desc',
  }) async {
    try {
      final connectivityResult = await Connectivity().checkConnectivity();
      
      if (connectivityResult == ConnectivityResult.none) {
        // Return cached data when offline
        final cachedReceipts = LocalStorage.getAllReceipts();
        return Result.success(_filterReceiptsLocally(
          cachedReceipts,
          search: search,
          category: category,
          startDate: startDate,
          endDate: endDate,
          vendorName: vendorName,
          minAmount: minAmount,
          maxAmount: maxAmount,
          tags: tags,
        ));
      }

      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
        'sortBy': sortBy,
        'sortOrder': sortOrder,
      };

      if (search != null) queryParams['search'] = search;
      if (category != null) queryParams['category'] = category;
      if (startDate != null) queryParams['startDate'] = startDate.toIso8601String();
      if (endDate != null) queryParams['endDate'] = endDate.toIso8601String();
      if (vendorName != null) queryParams['vendorName'] = vendorName;
      if (minAmount != null) queryParams['minAmount'] = minAmount;
      if (maxAmount != null) queryParams['maxAmount'] = maxAmount;
      if (tags != null && tags.isNotEmpty) queryParams['tags'] = tags;

      final response = await _apiClient.get(
        '/receipts',
        queryParameters: queryParams,
      );

      if (response.statusCode == 200) {
        final data = response.data['data'];
        final receiptsData = data['receipts'] as List;
        final receipts = receiptsData.map((r) => Receipt.fromJson(r)).toList();

        // Cache receipts locally
        for (final receipt in receipts) {
          await LocalStorage.saveReceipt(receipt.copyWith(isSynced: true));
        }

        return Result.success(receipts);
      }

      return Result.failure(ApiException(
        message: response.data['message'] ?? 'Failed to fetch receipts',
        statusCode: response.statusCode ?? 500,
        type: ApiExceptionType.serverError,
      ));
    } catch (e) {
      if (e is ApiException) {
        // If it's a network error, return cached data
        if (e.isNetworkError) {
          final cachedReceipts = LocalStorage.getAllReceipts();
          return Result.success(_filterReceiptsLocally(
            cachedReceipts,
            search: search,
            category: category,
            startDate: startDate,
            endDate: endDate,
            vendorName: vendorName,
            minAmount: minAmount,
            maxAmount: maxAmount,
            tags: tags,
          ));
        }
        return Result.failure(e);
      }

      return Result.failure(ApiException(
        message: 'Failed to fetch receipts: $e',
        statusCode: 0,
        type: ApiExceptionType.unknown,
      ));
    }
  }

  @override
  Future<Result<Receipt>> getReceiptById(String id) async {
    try {
      // Try to get from local storage first
      final localReceipt = LocalStorage.getReceipt(id);
      
      final connectivityResult = await Connectivity().checkConnectivity();
      if (connectivityResult == ConnectivityResult.none) {
        if (localReceipt != null) {
          return Result.success(localReceipt);
        }
        return Result.failure(ApiException(
          message: 'Receipt not found locally and no internet connection',
          statusCode: 404,
          type: ApiExceptionType.notFound,
        ));
      }

      final response = await _apiClient.get('/receipts/$id');

      if (response.statusCode == 200) {
        final receiptData = response.data['data']['receipt'];
        final receipt = Receipt.fromJson(receiptData);

        // Update local storage
        await LocalStorage.saveReceipt(receipt.copyWith(isSynced: true));

        return Result.success(receipt);
      }

      return Result.failure(ApiException(
        message: response.data['message'] ?? 'Receipt not found',
        statusCode: response.statusCode ?? 404,
        type: ApiExceptionType.notFound,
      ));
    } catch (e) {
      if (e is ApiException && e.isNetworkError) {
        // Try to get from local storage first
        final localReceipt = LocalStorage.getReceipt(id);
        if (localReceipt != null) {
          return Result.success(localReceipt);
        }
      }

      return Result.failure(e is ApiException ? e : ApiException(
        message: 'Failed to fetch receipt: $e',
        statusCode: 0,
        type: ApiExceptionType.unknown,
      ));
    }
  }

  @override
  Future<Result<Receipt>> createReceipt({
    required File file,
    String? category,
    String? description,
    List<String>? tags,
  }) async {
    try {
      final connectivityResult = await Connectivity().checkConnectivity();
      
      if (connectivityResult == ConnectivityResult.none) {
        // Store locally and queue for sync
        final localReceipt = await _createLocalReceipt(
          file: file,
          category: category,
          description: description,
          tags: tags,
        );
        
        await _queueForSync('create', localReceipt.id, {
          'file': file.path,
          'category': category,
          'description': description,
          'tags': tags,
        });

        return Result.success(localReceipt);
      }

      final fields = <String, dynamic>{};
      if (category != null) fields['category'] = category;
      if (description != null) fields['description'] = description;
      if (tags != null) fields['tags'] = tags.join(',');

      final response = await _apiClient.uploadFile(
        '/receipts',
        file: file,
        fieldName: 'file',
        fields: fields,
        onSendProgress: (sent, total) {
          // TODO: Update upload progress
        },
      );

      if (response.statusCode == 201) {
        final receiptData = response.data['data']['receipt'];
        final receipt = Receipt.fromJson(receiptData);

        // Save locally
        await LocalStorage.saveReceipt(receipt.copyWith(
          localImagePath: file.path,
          isSynced: true,
        ));

        return Result.success(receipt);
      }

      return Result.failure(ApiException(
        message: response.data['message'] ?? 'Failed to create receipt',
        statusCode: response.statusCode ?? 500,
        type: ApiExceptionType.serverError,
      ));
    } catch (e) {
      if (e is ApiException && e.isNetworkError) {
        // Store locally and queue for sync
        final localReceipt = await _createLocalReceipt(
          file: file,
          category: category,
          description: description,
          tags: tags,
        );
        
        await _queueForSync('create', localReceipt.id, {
          'file': file.path,
          'category': category,
          'description': description,
          'tags': tags,
        });

        return Result.success(localReceipt);
      }

      return Result.failure(e is ApiException ? e : ApiException(
        message: 'Failed to create receipt: $e',
        statusCode: 0,
        type: ApiExceptionType.unknown,
      ));
    }
  }

  @override
  Future<Result<Receipt>> updateReceipt(
    String id, {
    String? category,
    String? description,
    List<String>? tags,
    String? vendorName,
    double? totalAmount,
    String? currency,
    DateTime? receiptDate,
  }) async {
    try {
      final connectivityResult = await Connectivity().checkConnectivity();
      
      final updateData = <String, dynamic>{};
      if (category != null) updateData['category'] = category;
      if (description != null) updateData['description'] = description;
      if (tags != null) updateData['tags'] = tags;
      if (vendorName != null) updateData['vendorName'] = vendorName;
      if (totalAmount != null) updateData['totalAmount'] = totalAmount;
      if (currency != null) updateData['currency'] = currency;
      if (receiptDate != null) updateData['receiptDate'] = receiptDate.toIso8601String();

      if (connectivityResult == ConnectivityResult.none) {
        // Update locally and queue for sync
        final localReceipt = LocalStorage.getReceipt(id);
        if (localReceipt != null) {
          final updatedReceipt = localReceipt.copyWith(
            category: category ?? localReceipt.category,
            description: description ?? localReceipt.description,
            tags: tags ?? localReceipt.tags,
            vendorName: vendorName ?? localReceipt.vendorName,
            totalAmount: totalAmount ?? localReceipt.totalAmount,
            currency: currency ?? localReceipt.currency,
            receiptDate: receiptDate ?? localReceipt.receiptDate,
            updatedAt: DateTime.now(),
            isSynced: false,
          );

          await LocalStorage.saveReceipt(updatedReceipt);
          await _queueForSync('update', id, updateData);

          return Result.success(updatedReceipt);
        }

        return Result.failure(ApiException(
          message: 'Receipt not found locally',
          statusCode: 404,
          type: ApiExceptionType.notFound,
        ));
      }

      final response = await _apiClient.put(
        '/receipts/$id',
        data: updateData,
      );

      if (response.statusCode == 200) {
        final receiptData = response.data['data']['receipt'];
        final receipt = Receipt.fromJson(receiptData);

        // Update local storage
        final localReceipt = LocalStorage.getReceipt(id);
        await LocalStorage.saveReceipt(receipt.copyWith(
          localImagePath: localReceipt?.localImagePath,
          isSynced: true,
        ));

        return Result.success(receipt);
      }

      return Result.failure(ApiException(
        message: response.data['message'] ?? 'Failed to update receipt',
        statusCode: response.statusCode ?? 500,
        type: ApiExceptionType.serverError,
      ));
    } catch (e) {
      if (e is ApiException && e.isNetworkError) {
        // Update locally and queue for sync
        final localReceipt = LocalStorage.getReceipt(id);
        if (localReceipt != null) {
          final updatedReceipt = localReceipt.copyWith(
            category: category ?? localReceipt.category,
            description: description ?? localReceipt.description,
            tags: tags ?? localReceipt.tags,
            vendorName: vendorName ?? localReceipt.vendorName,
            totalAmount: totalAmount ?? localReceipt.totalAmount,
            currency: currency ?? localReceipt.currency,
            receiptDate: receiptDate ?? localReceipt.receiptDate,
            updatedAt: DateTime.now(),
            isSynced: false,
          );

          await LocalStorage.saveReceipt(updatedReceipt);
          
          // Recreate updateData for sync queue
          final updateDataForSync = <String, dynamic>{};
          if (category != null) updateDataForSync['category'] = category;
          if (description != null) updateDataForSync['description'] = description;
          if (tags != null) updateDataForSync['tags'] = tags;
          if (vendorName != null) updateDataForSync['vendorName'] = vendorName;
          if (totalAmount != null) updateDataForSync['totalAmount'] = totalAmount;
          if (currency != null) updateDataForSync['currency'] = currency;
          if (receiptDate != null) updateDataForSync['receiptDate'] = receiptDate.toIso8601String();
          
          await _queueForSync('update', id, updateDataForSync);

          return Result.success(updatedReceipt);
        }
      }

      return Result.failure(e is ApiException ? e : ApiException(
        message: 'Failed to update receipt: $e',
        statusCode: 0,
        type: ApiExceptionType.unknown,
      ));
    }
  }

  @override
  Future<Result<void>> deleteReceipt(String id) async {
    try {
      final connectivityResult = await Connectivity().checkConnectivity();
      
      if (connectivityResult == ConnectivityResult.none) {
        // Mark for deletion locally and queue for sync
        await LocalStorage.deleteReceipt(id);
        await _queueForSync('delete', id, {});
        return Result.success(null);
      }

      final response = await _apiClient.delete('/receipts/$id');

      if (response.statusCode == 200 || response.statusCode == 204) {
        await LocalStorage.deleteReceipt(id);
        return Result.success(null);
      }

      return Result.failure(ApiException(
        message: response.data['message'] ?? 'Failed to delete receipt',
        statusCode: response.statusCode ?? 500,
        type: ApiExceptionType.serverError,
      ));
    } catch (e) {
      if (e is ApiException && e.isNetworkError) {
        // Delete locally and queue for sync
        await LocalStorage.deleteReceipt(id);
        await _queueForSync('delete', id, {});
        return Result.success(null);
      }

      return Result.failure(e is ApiException ? e : ApiException(
        message: 'Failed to delete receipt: $e',
        statusCode: 0,
        type: ApiExceptionType.unknown,
      ));
    }
  }

  @override
  Future<Result<List<Receipt>>> syncReceipts() async {
    try {
      // This will be implemented when we create the sync service
      // For now, just fetch latest receipts
      return await getReceipts(limit: 100);
    } catch (e) {
      return Result.failure(e is ApiException ? e : ApiException(
        message: 'Sync failed: $e',
        statusCode: 0,
        type: ApiExceptionType.unknown,
      ));
    }
  }

  List<Receipt> _filterReceiptsLocally(
    List<Receipt> receipts, {
    String? search,
    String? category,
    DateTime? startDate,
    DateTime? endDate,
    String? vendorName,
    double? minAmount,
    double? maxAmount,
    List<String>? tags,
  }) {
    var filtered = receipts;

    if (search != null && search.isNotEmpty) {
      final searchLower = search.toLowerCase();
      filtered = filtered.where((r) =>
        (r.vendorName?.toLowerCase().contains(searchLower) ?? false) ||
        (r.description?.toLowerCase().contains(searchLower) ?? false) ||
        (r.ocrText?.toLowerCase().contains(searchLower) ?? false)
      ).toList();
    }

    if (category != null) {
      filtered = filtered.where((r) => r.category == category).toList();
    }

    if (vendorName != null) {
      filtered = filtered.where((r) => r.vendorName == vendorName).toList();
    }

    if (startDate != null || endDate != null) {
      filtered = filtered.where((r) {
        final date = r.receiptDate ?? r.createdAt;
        if (startDate != null && date.isBefore(startDate)) return false;
        if (endDate != null && date.isAfter(endDate)) return false;
        return true;
      }).toList();
    }

    if (minAmount != null || maxAmount != null) {
      filtered = filtered.where((r) {
        final amount = r.totalAmount;
        if (amount == null) return false;
        if (minAmount != null && amount < minAmount) return false;
        if (maxAmount != null && amount > maxAmount) return false;
        return true;
      }).toList();
    }

    if (tags != null && tags.isNotEmpty) {
      filtered = filtered.where((r) =>
        tags.any((tag) => r.tags.contains(tag))
      ).toList();
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => b.createdAt.compareTo(a.createdAt));

    return filtered;
  }

  Future<Receipt> _createLocalReceipt({
    required File file,
    String? category,
    String? description,
    List<String>? tags,
  }) async {
    final now = DateTime.now();
    final receipt = Receipt(
      id: 'local_${now.millisecondsSinceEpoch}',
      userId: await _getCurrentUserId(),
      status: 'uploaded',
      createdAt: now,
      updatedAt: now,
      localImagePath: file.path,
      category: category,
      description: description,
      tags: tags ?? [],
      isSynced: false,
    );

    await LocalStorage.saveReceipt(receipt);
    return receipt;
  }

  Future<void> _queueForSync(String action, String receiptId, Map<String, dynamic> data) async {
    // TODO: Implement sync queue when we create the offline sync service
    // For now, just mark the receipt as not synced
  }
}

// Result wrapper for better error handling
class Result<T> {
  final T? data;
  final ApiException? error;
  final bool isSuccess;

  Result._({this.data, this.error, required this.isSuccess});

  factory Result.success(T data) => Result._(data: data, isSuccess: true);
  factory Result.failure(ApiException error) => Result._(error: error, isSuccess: false);

  bool get isFailure => !isSuccess;
}

// Helper method to get current user ID
Future<String> _getCurrentUserId() async {
  final userId = LocalStorage.getSetting<String>('user_id');
  if (userId == null || userId.isEmpty) {
    throw Exception('No user ID available');
  }
  return userId;
}