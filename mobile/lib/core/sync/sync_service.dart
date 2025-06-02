import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

import '../database/database_helper.dart';
import '../network/api_client.dart';
import '../network/api_exception.dart';
import '../auth/auth_service.dart';

class SyncService {
  final DatabaseHelper _db = DatabaseHelper.instance;
  final ApiClient _apiClient = ApiClient.instance;
  final AuthService _authService = AuthService.instance;
  
  Timer? _syncTimer;
  bool _isSyncing = false;
  final Duration _syncInterval = const Duration(minutes: 5);
  final int _maxRetries = 3;

  static SyncService? _instance;

  SyncService._internal();

  static SyncService get instance {
    _instance ??= SyncService._internal();
    return _instance!;
  }

  // Start periodic sync
  void startPeriodicSync() {
    if (_syncTimer?.isActive == true) return;

    _syncTimer = Timer.periodic(_syncInterval, (_) {
      if (!_isSyncing) {
        syncPendingActions();
      }
    });

    debugPrint('Sync service started with ${_syncInterval.inMinutes}min interval');
  }

  // Stop periodic sync
  void stopPeriodicSync() {
    _syncTimer?.cancel();
    _syncTimer = null;
    debugPrint('Sync service stopped');
  }

  // Manual sync trigger
  Future<SyncResult> syncNow() async {
    return await syncPendingActions();
  }

  // Sync pending actions from the queue
  Future<SyncResult> syncPendingActions() async {
    if (_isSyncing) {
      return SyncResult.inProgress();
    }

    _isSyncing = true;

    try {
      // Check connectivity
      final connectivityResult = await Connectivity().checkConnectivity();
      if (connectivityResult == ConnectivityResult.none) {
        return SyncResult.noConnection();
      }

      // Check authentication
      if (!_authService.isAuthenticated) {
        return SyncResult.notAuthenticated();
      }

      final pendingItems = await _db.getPendingSyncItems(limit: 20);
      if (pendingItems.isEmpty) {
        return SyncResult.success(syncedCount: 0);
      }

      int successCount = 0;
      int failureCount = 0;

      for (final item in pendingItems) {
        final result = await _processSyncItem(item);
        if (result) {
          successCount++;
          await _db.removeSyncItem(item['id']);
        } else {
          failureCount++;
          await _incrementRetryCount(item);
        }
      }

      debugPrint('Sync completed: $successCount success, $failureCount failed');

      return SyncResult.success(
        syncedCount: successCount,
        failedCount: failureCount,
      );
    } catch (e) {
      debugPrint('Sync error: $e');
      return SyncResult.error(e.toString());
    } finally {
      _isSyncing = false;
    }
  }

  // Process individual sync item
  Future<bool> _processSyncItem(Map<String, dynamic> item) async {
    try {
      final action = item['action'] as String;
      final entityType = item['entity_type'] as String;
      final entityId = item['entity_id'] as String?;
      final payload = _parsePayload(item['payload'] as String);

      switch (entityType) {
        case 'receipt':
          return await _syncReceiptAction(action, entityId, payload);
        case 'user':
          return await _syncUserAction(action, entityId, payload);
        default:
          debugPrint('Unknown entity type: $entityType');
          return false;
      }
    } catch (e) {
      debugPrint('Error processing sync item: $e');
      return false;
    }
  }

  // Sync receipt actions with conflict resolution
  Future<bool> _syncReceiptAction(
    String action,
    String? entityId,
    Map<String, dynamic> payload,
  ) async {
    try {
      switch (action) {
        case 'create':
          return await _syncCreateReceipt(payload);
        case 'update':
          return await _syncUpdateReceiptWithConflictResolution(entityId!, payload);
        case 'delete':
          return await _syncDeleteReceipt(entityId!);
        default:
          debugPrint('Unknown receipt action: $action');
          return false;
      }
    } catch (e) {
      debugPrint('Error syncing receipt action $action: $e');
      return false;
    }
  }

  // Sync user actions
  Future<bool> _syncUserAction(
    String action,
    String? entityId,
    Map<String, dynamic> payload,
  ) async {
    try {
      switch (action) {
        case 'update':
          return await _syncUpdateUser(entityId!, payload);
        default:
          debugPrint('Unknown user action: $action');
          return false;
      }
    } catch (e) {
      debugPrint('Error syncing user action $action: $e');
      return false;
    }
  }

  // Create receipt on server
  Future<bool> _syncCreateReceipt(Map<String, dynamic> payload) async {
    final filePath = payload['file'] as String?;
    if (filePath == null) return false;

    final file = File(filePath);
    if (!await file.exists()) {
      debugPrint('File not found for sync: $filePath');
      return false;
    }

    final fields = <String, dynamic>{};
    if (payload['category'] != null) fields['category'] = payload['category'];
    if (payload['description'] != null) fields['description'] = payload['description'];
    if (payload['tags'] != null) fields['tags'] = payload['tags'];

    try {
      final response = await _apiClient.uploadFile(
        '/receipts',
        file: file,
        fieldName: 'file',
        fields: fields,
      );

      if (response.statusCode == 201) {
        // Update local receipt with server data
        final serverReceipt = response.data['data']['receipt'];
        final localReceipt = await _db.getReceiptById(payload['local_id']);
        
        if (localReceipt != null) {
          final updatedReceipt = localReceipt.copyWith(
            id: serverReceipt['id'],
            filePath: serverReceipt['filePath'],
            fileHash: serverReceipt['fileHash'],
            status: serverReceipt['status'],
            isSynced: true,
            syncError: null,
          );
          
          await _db.updateReceipt(updatedReceipt);
        }

        return true;
      }

      return false;
    } catch (e) {
      debugPrint('Error creating receipt on server: $e');
      return false;
    }
  }

  // Update receipt on server with conflict resolution
  Future<bool> _syncUpdateReceiptWithConflictResolution(String receiptId, Map<String, dynamic> payload) async {
    try {
      // First, get the latest version from server to check for conflicts
      final latestResponse = await _apiClient.get('/receipts/$receiptId');
      
      if (latestResponse.statusCode == 200) {
        final serverReceipt = latestResponse.data['data']['receipt'];
        final localReceipt = await _db.getReceiptById(receiptId);
        
        if (localReceipt != null && _hasConflict(localReceipt, serverReceipt)) {
          // Conflict detected - resolve using last-write-wins strategy
          final localTimestamp = DateTime.parse(localReceipt.updatedAt);
          final serverTimestamp = DateTime.parse(serverReceipt['updated_at']);
          
          if (serverTimestamp.isAfter(localTimestamp)) {
            // Server wins - update local with server data
            await _updateLocalReceiptFromServer(receiptId, serverReceipt);
            return true;
          }
        }
      }
      
      // No conflict or local wins - proceed with update
      final response = await _apiClient.put(
        '/receipts/$receiptId',
        data: {
          ...payload,
          'version': payload['version'], // Include version for optimistic locking
        },
      );

      if (response.statusCode == 200) {
        // Update local receipt sync status
        final localReceipt = await _db.getReceiptById(receiptId);
        if (localReceipt != null) {
          final updatedReceipt = localReceipt.copyWith(
            isSynced: true,
            syncError: null,
            version: response.data['data']['receipt']['version'],
          );
          await _db.updateReceipt(updatedReceipt);
        }
        return true;
      } else if (response.statusCode == 409) {
        // Conflict on server - handle conflict resolution
        return await _handleServerConflict(receiptId, payload);
      }

      return false;
    } catch (e) {
      debugPrint('Error updating receipt on server: $e');
      return false;
    }
  }
  
  // Handle server-side conflicts
  Future<bool> _handleServerConflict(String receiptId, Map<String, dynamic> payload) async {
    debugPrint('Handling server conflict for receipt $receiptId');
    
    try {
      // Get fresh server data
      final serverResponse = await _apiClient.get('/receipts/$receiptId');
      if (serverResponse.statusCode != 200) return false;
      
      final serverReceipt = serverResponse.data['data']['receipt'];
      final localReceipt = await _db.getReceiptById(receiptId);
      
      if (localReceipt == null) return false;
      
      // Merge strategy: prefer local user changes, keep server OCR data
      final mergedData = _mergeReceiptData(localReceipt, serverReceipt, payload);
      
      // Attempt update with merged data
      final response = await _apiClient.put(
        '/receipts/$receiptId',
        data: mergedData,
      );
      
      if (response.statusCode == 200) {
        await _updateLocalReceiptFromServer(receiptId, response.data['data']['receipt']);
        return true;
      }
      
      return false;
    } catch (e) {
      debugPrint('Error handling server conflict: $e');
      return false;
    }
  }
  
  // Merge receipt data with conflict resolution strategy
  Map<String, dynamic> _mergeReceiptData(
    dynamic localReceipt, 
    Map<String, dynamic> serverReceipt, 
    Map<String, dynamic> localChanges
  ) {
    return {
      // Server data for OCR fields (authoritative)
      'ocr_text': serverReceipt['ocr_text'],
      'ocr_confidence': serverReceipt['ocr_confidence'],
      'vendor_name': serverReceipt['vendor_name'],
      'total_amount': serverReceipt['total_amount'],
      'receipt_date': serverReceipt['receipt_date'],
      
      // Local data for user-modified fields
      'category': localChanges['category'] ?? localReceipt.category,
      'description': localChanges['description'] ?? localReceipt.description,
      'tags': localChanges['tags'] ?? localReceipt.tags,
      'notes': localChanges['notes'] ?? localReceipt.notes,
      
      // Version control
      'version': serverReceipt['version'],
    };
  }
  
  // Update local receipt from server data
  Future<void> _updateLocalReceiptFromServer(String receiptId, Map<String, dynamic> serverReceipt) async {
    final localReceipt = await _db.getReceiptById(receiptId);
    if (localReceipt == null) return;
    
    final updatedReceipt = localReceipt.copyWith(
      vendorName: serverReceipt['vendor_name'],
      totalAmount: serverReceipt['total_amount']?.toDouble(),
      receiptDate: serverReceipt['receipt_date'] != null 
          ? DateTime.parse(serverReceipt['receipt_date']) 
          : null,
      category: serverReceipt['category'],
      ocrText: serverReceipt['ocr_text'],
      ocrConfidence: serverReceipt['ocr_confidence']?.toDouble(),
      version: serverReceipt['version'],
      isSynced: true,
      syncError: null,
    );
    
    await _db.updateReceipt(updatedReceipt);
  }
  
  // Check if there's a conflict between local and server data
  bool _hasConflict(dynamic localReceipt, Map<String, dynamic> serverReceipt) {
    final localTimestamp = DateTime.parse(localReceipt.updatedAt);
    final serverTimestamp = DateTime.parse(serverReceipt['updated_at']);
    
    // Consider it a conflict if both have been modified and versions differ
    return localReceipt.version != serverReceipt['version'] && 
           localTimestamp.isAfter(serverTimestamp.subtract(const Duration(seconds: 30)));
  }

  // Update receipt on server (legacy method)
  Future<bool> _syncUpdateReceipt(String receiptId, Map<String, dynamic> payload) async {
    return await _syncUpdateReceiptWithConflictResolution(receiptId, payload);
  }

  // Delete receipt on server
  Future<bool> _syncDeleteReceipt(String receiptId) async {
    try {
      final response = await _apiClient.delete('/receipts/$receiptId');
      return response.statusCode == 200 || response.statusCode == 204;
    } catch (e) {
      debugPrint('Error deleting receipt on server: $e');
      return false;
    }
  }

  // Update user on server
  Future<bool> _syncUpdateUser(String userId, Map<String, dynamic> payload) async {
    try {
      final response = await _apiClient.put(
        '/users/$userId',
        data: payload,
      );

      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Error updating user on server: $e');
      return false;
    }
  }

  // Add action to sync queue
  Future<void> queueForSync({
    required String action,
    required String entityType,
    String? entityId,
    required Map<String, dynamic> payload,
  }) async {
    await _db.addToSyncQueue(
      action: action,
      entityType: entityType,
      entityId: entityId,
      payload: payload,
    );

    debugPrint('Queued for sync: $action $entityType ${entityId ?? 'new'}');

    // Try immediate sync if connected
    final connectivityResult = await Connectivity().checkConnectivity();
    if (connectivityResult != ConnectivityResult.none && !_isSyncing) {
      syncPendingActions();
    }
  }

  // Increment retry count for failed sync items
  Future<void> _incrementRetryCount(Map<String, dynamic> item) async {
    final currentRetries = item['retry_count'] as int;
    final newRetryCount = currentRetries + 1;

    if (newRetryCount >= _maxRetries) {
      // Move to dead letter queue or mark as permanently failed
      await _db.updateSyncItem(
        item['id'],
        retryCount: newRetryCount,
        errorMessage: 'Max retries exceeded',
      );
      debugPrint('Sync item ${item['id']} failed permanently after $newRetryCount retries');
    } else {
      await _db.updateSyncItem(item['id'], retryCount: newRetryCount);
    }
  }

  // Parse payload string back to Map
  Map<String, dynamic> _parsePayload(String payloadString) {
    try {
      return json.decode(payloadString) as Map<String, dynamic>;
    } catch (e) {
      debugPrint('Error parsing payload: $e');
      return {};
    }
  }

  // Get sync status
  Future<SyncStatus> getSyncStatus() async {
    final pendingItems = await _db.getPendingSyncItems();
    final failedItems = pendingItems.where((item) => item['retry_count'] >= _maxRetries).length;
    
    return SyncStatus(
      isActive: _syncTimer?.isActive == true,
      isSyncing: _isSyncing,
      pendingCount: pendingItems.length,
      failedCount: failedItems,
      lastSyncTime: null, // TODO: Store last sync time
    );
  }

  // Clear sync queue (for testing or reset)
  Future<void> clearSyncQueue() async {
    final db = await _db.database;
    await db.delete('sync_queue');
    debugPrint('Sync queue cleared');
  }

  void dispose() {
    stopPeriodicSync();
  }
}

class SyncResult {
  final SyncResultType type;
  final String? message;
  final int syncedCount;
  final int failedCount;

  SyncResult._({
    required this.type,
    this.message,
    this.syncedCount = 0,
    this.failedCount = 0,
  });

  factory SyncResult.success({int syncedCount = 0, int failedCount = 0}) =>
      SyncResult._(
        type: SyncResultType.success,
        syncedCount: syncedCount,
        failedCount: failedCount,
      );

  factory SyncResult.error(String message) =>
      SyncResult._(type: SyncResultType.error, message: message);

  factory SyncResult.noConnection() =>
      SyncResult._(type: SyncResultType.noConnection, message: 'No internet connection');

  factory SyncResult.notAuthenticated() =>
      SyncResult._(type: SyncResultType.notAuthenticated, message: 'Not authenticated');

  factory SyncResult.inProgress() =>
      SyncResult._(type: SyncResultType.inProgress, message: 'Sync already in progress');

  bool get isSuccess => type == SyncResultType.success;
  bool get hasError => type == SyncResultType.error;
  bool get needsConnection => type == SyncResultType.noConnection;
  bool get needsAuth => type == SyncResultType.notAuthenticated;
}

enum SyncResultType {
  success,
  error,
  noConnection,
  notAuthenticated,
  inProgress,
}

class SyncStatus {
  final bool isActive;
  final bool isSyncing;
  final int pendingCount;
  final int failedCount;
  final DateTime? lastSyncTime;

  SyncStatus({
    required this.isActive,
    required this.isSyncing,
    required this.pendingCount,
    required this.failedCount,
    this.lastSyncTime,
  });

  bool get hasPendingItems => pendingCount > 0;
  bool get hasFailedItems => failedCount > 0;
  bool get isHealthy => !hasFailedItems && pendingCount < 10;
}