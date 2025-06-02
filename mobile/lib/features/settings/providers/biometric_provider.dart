import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/biometric_service.dart';

class BiometricNotifier extends StateNotifier<AsyncValue<BiometricStatus>> {
  final BiometricService _biometricService;

  BiometricNotifier(this._biometricService) : super(const AsyncValue.loading());

  Future<void> loadStatus() async {
    state = const AsyncValue.loading();
    
    try {
      final status = await _biometricService.getStatus();
      state = AsyncValue.data(status);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<bool> enableBiometric() async {
    try {
      final success = await _biometricService.enableBiometric();
      if (success) {
        await loadStatus(); // Refresh status
      }
      return success;
    } catch (e) {
      return false;
    }
  }

  Future<void> disableBiometric() async {
    try {
      await _biometricService.disableBiometric();
      await loadStatus(); // Refresh status
    } catch (e) {
      // Handle error silently
    }
  }

  Future<BiometricAuthResult> testAuthentication() async {
    return await _biometricService.authenticate(
      reason: 'Test biometric authentication',
      biometricOnly: true,
    );
  }
}

final biometricServiceProvider = Provider<BiometricService>((ref) {
  return BiometricService.instance;
});

final biometricProvider = StateNotifierProvider<BiometricNotifier, AsyncValue<BiometricStatus>>((ref) {
  final biometricService = ref.read(biometricServiceProvider);
  return BiometricNotifier(biometricService);
});