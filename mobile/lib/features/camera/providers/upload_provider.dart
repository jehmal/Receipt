import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:dio/dio.dart';
import 'package:crypto/crypto.dart';
import 'dart:convert';

import '../../../core/config/app_config.dart';
import '../../../core/storage/local_storage.dart';
import '../../../shared/models/receipt.dart';

part 'upload_provider.g.dart';

@riverpod
class UploadNotifier extends _$UploadNotifier {
  @override
  UploadState build() => UploadState.idle();

  Future<void> uploadReceipt({
    required String imagePath,
    required String category,
    String? comment,
    String? voiceMemoPath,
    String? jobNumber,
    List<String> tags = const [],
  }) async {
    try {
      state = UploadState.uploading(progress: 0.0);
      
      final file = File(imagePath);
      final fileBytes = await file.readAsBytes();
      final fileHash = sha256.convert(fileBytes).toString();
      
      // Create form data
      final formData = FormData.fromMap({
        'receipt': await MultipartFile.fromFile(
          imagePath,
          filename: 'receipt_${DateTime.now().millisecondsSinceEpoch}.jpg',
        ),
        'metadata': jsonEncode({
          'description': comment,
          'category': category,
          'tags': tags,
          'fileHash': fileHash,
          'jobNumber': jobNumber,
          'capturedAt': DateTime.now().toIso8601String(),
        }),
        if (voiceMemoPath != null)
          'voiceMemo': await MultipartFile.fromFile(
            voiceMemoPath,
            filename: 'voice_memo_${DateTime.now().millisecondsSinceEpoch}.mp3',
          ),
      });

      // Upload with progress tracking
      final dio = Dio();
      final response = await dio.post(
        '${AppConfig.baseUrl}/receipts/upload',
        data: formData,
        options: Options(
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': 'Bearer ${await _getAuthToken()}',
          },
        ),
        onSendProgress: (sent, total) {
          final progress = sent / total;
          state = UploadState.uploading(progress: progress);
        },
      );

      if (response.statusCode == 200) {
        final receiptData = response.data;
        final receipt = Receipt.fromJson(receiptData);
        
        // Save to local storage
        await _saveReceiptLocally(receipt);
        
        state = UploadState.success(receipt: receipt);
      } else {
        throw Exception('Upload failed with status: ${response.statusCode}');
      }
    } catch (e) {
      state = UploadState.error(message: e.toString());
      
      // Save for retry later
      await _saveFailedUpload(imagePath, comment, category, voiceMemoPath, jobNumber, tags);
    }
  }

  Future<void> retryFailedUpload(String uploadId) async {
    // Implementation for retrying failed uploads
    try {
      state = UploadState.uploading(progress: 0.0);
      
      final failedUpload = await _getFailedUpload(uploadId);
      if (failedUpload != null) {
        await uploadReceipt(
          imagePath: failedUpload.imagePath,
          category: failedUpload.category,
          comment: failedUpload.comment,
          voiceMemoPath: failedUpload.voiceMemoPath,
          jobNumber: failedUpload.jobNumber,
          tags: failedUpload.tags,
        );
        
        // Remove from failed uploads
        await _removeFailedUpload(uploadId);
      }
    } catch (e) {
      state = UploadState.error(message: e.toString());
    }
  }

  Future<String> _getAuthToken() async {
    // Get auth token from secure storage
    final token = LocalStorage.getSetting<String>('access_token');
    if (token == null || token.isEmpty) {
      throw Exception('No authentication token available');
    }
    return token;
  }

  Future<void> _saveReceiptLocally(Receipt receipt) async {
    // Save to Hive local storage
    // Implementation depends on your local storage setup
  }

  Future<void> _saveFailedUpload(
    String imagePath,
    String? comment,
    String category,
    String? voiceMemoPath,
    String? jobNumber,
    List<String> tags,
  ) async {
    // Save failed upload for retry later
  }

  Future<FailedUpload?> _getFailedUpload(String uploadId) async {
    // Get failed upload details
    return null; // Replace with actual implementation
  }

  Future<void> _removeFailedUpload(String uploadId) async {
    // Remove failed upload from storage
  }

  void reset() {
    state = UploadState.idle();
  }
}

@riverpod
class UploadHistoryNotifier extends _$UploadHistoryNotifier {
  @override
  List<UploadHistoryItem> build() => [];

  Future<void> loadUploadHistory() async {
    // Load upload history from storage
    state = [
      // Mock data for development
      UploadHistoryItem(
        id: '1',
        filename: 'receipt_001.jpg',
        status: UploadStatus.completed,
        progress: 1.0,
        timestamp: DateTime.now().subtract(const Duration(hours: 1)),
      ),
      UploadHistoryItem(
        id: '2',
        filename: 'receipt_002.jpg',
        status: UploadStatus.failed,
        progress: 0.3,
        timestamp: DateTime.now().subtract(const Duration(hours: 2)),
        errorMessage: 'Network connection lost',
      ),
      UploadHistoryItem(
        id: '3',
        filename: 'receipt_003.jpg',
        status: UploadStatus.uploading,
        progress: 0.7,
        timestamp: DateTime.now().subtract(const Duration(minutes: 30)),
      ),
    ];
  }

  Future<void> retryUpload(String uploadId) async {
    final index = state.indexWhere((item) => item.id == uploadId);
    if (index != -1) {
      final item = state[index];
      final updatedItem = item.copyWith(
        status: UploadStatus.uploading,
        progress: 0.0,
        errorMessage: null,
      );
      
      state = [
        ...state.take(index),
        updatedItem,
        ...state.skip(index + 1),
      ];

      // Trigger actual retry
      await ref.read(uploadNotifierProvider.notifier).retryFailedUpload(uploadId);
    }
  }

  void removeUpload(String uploadId) {
    state = state.where((item) => item.id != uploadId).toList();
  }
}

sealed class UploadState {
  const UploadState();
  
  factory UploadState.idle() = UploadIdleState;
  factory UploadState.uploading({required double progress}) = UploadUploadingState;
  factory UploadState.success({required Receipt receipt}) = UploadSuccessState;
  factory UploadState.error({required String message}) = UploadErrorState;
  
  // Convenience getters
  bool get isIdle => this is UploadIdleState;
  bool get isUploading => this is UploadUploadingState;
  bool get isSuccess => this is UploadSuccessState;
  bool get isError => this is UploadErrorState;
  
  double get progress {
    if (this is UploadUploadingState) {
      return (this as UploadUploadingState).progress;
    }
    if (this is UploadSuccessState) {
      return 1.0;
    }
    return 0.0;
  }
  
  String get status {
    if (this is UploadIdleState) return 'Ready';
    if (this is UploadUploadingState) return 'Uploading...';
    if (this is UploadSuccessState) return 'Success';
    if (this is UploadErrorState) return 'Error';
    return 'Unknown';
  }
  
  String? get errorMessage {
    if (this is UploadErrorState) {
      return (this as UploadErrorState).message;
    }
    return null;
  }
  
  Receipt? get receipt {
    if (this is UploadSuccessState) {
      return (this as UploadSuccessState).receipt;
    }
    return null;
  }
}

class UploadIdleState extends UploadState {
  const UploadIdleState();
}

class UploadUploadingState extends UploadState {
  final double progress;
  const UploadUploadingState({required this.progress});
}

class UploadSuccessState extends UploadState {
  final Receipt receipt;
  const UploadSuccessState({required this.receipt});
}

class UploadErrorState extends UploadState {
  final String message;
  const UploadErrorState({required this.message});
}

class UploadHistoryItem {
  final String id;
  final String filename;
  final UploadStatus status;
  final double progress;
  final DateTime timestamp;
  final String? errorMessage;

  const UploadHistoryItem({
    required this.id,
    required this.filename,
    required this.status,
    required this.progress,
    required this.timestamp,
    this.errorMessage,
  });

  UploadHistoryItem copyWith({
    String? id,
    String? filename,
    UploadStatus? status,
    double? progress,
    DateTime? timestamp,
    String? errorMessage,
  }) {
    return UploadHistoryItem(
      id: id ?? this.id,
      filename: filename ?? this.filename,
      status: status ?? this.status,
      progress: progress ?? this.progress,
      timestamp: timestamp ?? this.timestamp,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

enum UploadStatus {
  uploading,
  completed,
  failed,
  cancelled,
}

class FailedUpload {
  final String id;
  final String imagePath;
  final String? comment;
  final String category;
  final String? voiceMemoPath;
  final String? jobNumber;
  final List<String> tags;
  final DateTime failedAt;
  final String errorMessage;

  const FailedUpload({
    required this.id,
    required this.imagePath,
    this.comment,
    required this.category,
    this.voiceMemoPath,
    this.jobNumber,
    required this.tags,
    required this.failedAt,
    required this.errorMessage,
  });
}

// Legacy provider aliases for compatibility
final uploadProvider = uploadNotifierProvider;
final uploadHistoryProvider = uploadHistoryNotifierProvider;