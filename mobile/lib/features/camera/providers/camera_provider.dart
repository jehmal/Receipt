import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import 'dart:io';
import 'package:crypto/crypto.dart';

import '../../../shared/models/receipt.dart';
import '../../../core/storage/local_storage.dart';

class CameraState {
  final bool isProcessing;
  final String? error;

  const CameraState({
    this.isProcessing = false,
    this.error,
  });

  CameraState copyWith({
    bool? isProcessing,
    String? error,
  }) {
    return CameraState(
      isProcessing: isProcessing ?? this.isProcessing,
      error: error,
    );
  }
}

class CameraNotifier extends StateNotifier<CameraState> {
  CameraNotifier() : super(const CameraState());

  Future<void> processReceipt(String imagePath) async {
    state = state.copyWith(isProcessing: true, error: null);

    try {
      // Generate hash for the image
      final file = File(imagePath);
      final bytes = await file.readAsBytes();
      final hash = sha256.convert(bytes).toString();

      // Create receipt object
      final receipt = Receipt(
        id: const Uuid().v4(),
        userId: await _getCurrentUserId(),
        localImagePath: imagePath,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
        fileHash: hash,
        tags: [],
      );

      // Save to local storage
      await LocalStorage.saveReceipt(receipt);

      // TODO: Queue for OCR processing
      // TODO: Upload to server when online

      state = state.copyWith(isProcessing: false);
    } catch (e) {
      state = state.copyWith(isProcessing: false, error: e.toString());
    }
  }

  Future<Receipt> saveReceipt(Map<String, dynamic> receiptData) async {
    state = state.copyWith(isProcessing: true, error: null);

    try {
      // Extract data from the map
      final imageFile = receiptData['image_file'] as File;
      final category = receiptData['category'] as String?;
      final tags = receiptData['tags'] as List<String>? ?? [];
      final description = receiptData['description'] as String?;
      final jobNumber = receiptData['job_number'] as String?;
      final context = receiptData['context'] as String?;

      // Generate hash for the image
      final bytes = await imageFile.readAsBytes();
      final hash = sha256.convert(bytes).toString();

      // Create receipt object
      final receipt = Receipt(
        id: const Uuid().v4(),
        userId: await _getCurrentUserId(),
        localImagePath: imageFile.path,
        category: category,
        description: description,
        tags: tags,
        jobNumber: jobNumber,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
        fileHash: hash,
        status: 'uploaded',
        isSynced: false,
      );

      // Save to local storage
      await LocalStorage.saveReceipt(receipt);

      // TODO: Queue for OCR processing
      // TODO: Upload to server when online

      state = state.copyWith(isProcessing: false);
      return receipt;
    } catch (e) {
      state = state.copyWith(isProcessing: false, error: e.toString());
      rethrow;
    }
  }

  Future<String> _getCurrentUserId() async {
    final userId = LocalStorage.getSetting<String>('user_id');
    if (userId == null || userId.isEmpty) {
      throw Exception('No user ID available');
    }
    return userId;
  }
}

final cameraProvider = StateNotifierProvider<CameraNotifier, CameraState>(
  (ref) => CameraNotifier(),
);