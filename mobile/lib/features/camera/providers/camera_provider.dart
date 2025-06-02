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
        userId: 'current_user', // TODO: Get from auth provider
        imagePath: imagePath,
        date: DateTime.now(),
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
}

final cameraProvider = StateNotifierProvider<CameraNotifier, CameraState>(
  (ref) => CameraNotifier(),
);