import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:local_auth_android/local_auth_android.dart';
import 'package:local_auth_ios/local_auth_ios.dart';

import '../storage/local_storage.dart';

class BiometricService {
  final LocalAuthentication _localAuth = LocalAuthentication();
  
  static BiometricService? _instance;

  BiometricService._internal();

  static BiometricService get instance {
    _instance ??= BiometricService._internal();
    return _instance!;
  }

  // Check if biometric authentication is available on the device
  Future<bool> isBiometricAvailable() async {
    try {
      final isAvailable = await _localAuth.canCheckBiometrics;
      final isDeviceSupported = await _localAuth.isDeviceSupported();
      return isAvailable && isDeviceSupported;
    } catch (e) {
      debugPrint('Error checking biometric availability: $e');
      return false;
    }
  }

  // Get available biometric types
  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _localAuth.getAvailableBiometrics();
    } catch (e) {
      debugPrint('Error getting available biometrics: $e');
      return [];
    }
  }

  // Get the primary biometric type available
  Future<BiometricType?> getPrimaryBiometricType() async {
    final availableBiometrics = await getAvailableBiometrics();
    
    if (availableBiometrics.isEmpty) return null;

    // Priority order: Face ID > Touch ID > Fingerprint > Iris > Other
    if (Platform.isIOS) {
      if (availableBiometrics.contains(BiometricType.face)) {
        return BiometricType.face;
      } else if (availableBiometrics.contains(BiometricType.fingerprint)) {
        return BiometricType.fingerprint;
      }
    } else if (Platform.isAndroid) {
      if (availableBiometrics.contains(BiometricType.fingerprint)) {
        return BiometricType.fingerprint;
      } else if (availableBiometrics.contains(BiometricType.face)) {
        return BiometricType.face;
      } else if (availableBiometrics.contains(BiometricType.iris)) {
        return BiometricType.iris;
      }
    }

    return availableBiometrics.first;
  }

  // Get user-friendly name for biometric type
  String getBiometricTypeName(BiometricType type) {
    switch (type) {
      case BiometricType.face:
        return Platform.isIOS ? 'Face ID' : 'Face Recognition';
      case BiometricType.fingerprint:
        return Platform.isIOS ? 'Touch ID' : 'Fingerprint';
      case BiometricType.iris:
        return 'Iris Scan';
      case BiometricType.strong:
        return 'Biometric Authentication';
      case BiometricType.weak:
        return 'Basic Authentication';
    }
  }

  // Authenticate using biometrics
  Future<BiometricAuthResult> authenticate({
    required String reason,
    bool biometricOnly = true,
    bool stickyAuth = true,
    bool sensitiveTransaction = true,
  }) async {
    try {
      // Check if biometrics are available
      if (!await isBiometricAvailable()) {
        return BiometricAuthResult.notAvailable();
      }

      // Check if biometric authentication is enabled by user
      if (!await isBiometricEnabled()) {
        return BiometricAuthResult.notEnabled();
      }

      final bool didAuthenticate = await _localAuth.authenticate(
        localizedReason: reason,
        authMessages: [
          AndroidAuthMessages(
            signInTitle: 'Biometric Authentication',
            cancelButton: 'Cancel',
            deviceCredentialsRequiredTitle: 'Device Credentials Required',
            deviceCredentialsSetupDescription: 'Please set up device credentials to use biometric authentication.',
            goToSettingsButton: 'Go to Settings',
            goToSettingsDescription: 'Please set up biometric authentication in your device settings.',
          ),
          const IOSAuthMessages(
            cancelButton: 'Cancel',
            goToSettingsButton: 'Go to Settings',
            goToSettingsDescription: 'Please set up biometric authentication in your device settings.',
            lockOut: 'Biometric authentication is temporarily locked. Please try again later.',
          ),
        ],
        options: AuthenticationOptions(
          biometricOnly: biometricOnly,
          stickyAuth: stickyAuth,
          sensitiveTransaction: sensitiveTransaction,
        ),
      );

      if (didAuthenticate) {
        await _updateLastAuthTime();
        return BiometricAuthResult.success();
      } else {
        return BiometricAuthResult.failed('Authentication was cancelled or failed');
      }
    } on PlatformException catch (e) {
      return _handlePlatformException(e);
    } catch (e) {
      debugPrint('Biometric authentication error: $e');
      return BiometricAuthResult.failed('An unexpected error occurred: $e');
    }
  }

  // Quick authentication for app lock/unlock
  Future<BiometricAuthResult> authenticateForAppAccess() async {
    return await authenticate(
      reason: 'Authenticate to access Receipt Vault',
      biometricOnly: false, // Allow fallback to device credentials
      stickyAuth: true,
      sensitiveTransaction: false,
    );
  }

  // Authentication for sensitive operations (payments, data export, etc.)
  Future<BiometricAuthResult> authenticateForSensitiveOperation(String operationName) async {
    return await authenticate(
      reason: 'Authenticate to $operationName',
      biometricOnly: true, // Require biometrics for sensitive operations
      stickyAuth: true,
      sensitiveTransaction: true,
    );
  }

  // Check if biometric authentication is enabled by the user
  Future<bool> isBiometricEnabled() async {
    return LocalStorage.getSetting<bool>('biometric_enabled') ?? false;
  }

  // Enable biometric authentication
  Future<bool> enableBiometric() async {
    try {
      // Test authentication first
      final result = await authenticate(
        reason: 'Authenticate to enable biometric login',
        biometricOnly: true,
      );

      if (result.isSuccess) {
        await LocalStorage.saveSetting('biometric_enabled', true);
        await LocalStorage.saveSetting('biometric_setup_date', DateTime.now().toIso8601String());
        return true;
      }

      return false;
    } catch (e) {
      debugPrint('Error enabling biometric authentication: $e');
      return false;
    }
  }

  // Disable biometric authentication
  Future<void> disableBiometric() async {
    await LocalStorage.saveSetting('biometric_enabled', false);
    await LocalStorage.deleteSetting('biometric_setup_date');
    await LocalStorage.deleteSetting('last_biometric_auth');
  }

  // Check if re-authentication is required (based on time since last auth)
  Future<bool> isReAuthRequired({Duration timeout = const Duration(minutes: 5)}) async {
    final lastAuthString = LocalStorage.getSetting<String>('last_biometric_auth');
    if (lastAuthString == null) return true;

    try {
      final lastAuth = DateTime.parse(lastAuthString);
      final timeSinceAuth = DateTime.now().difference(lastAuth);
      return timeSinceAuth > timeout;
    } catch (e) {
      return true;
    }
  }

  // Get biometric authentication status for UI
  Future<BiometricStatus> getStatus() async {
    final isAvailable = await isBiometricAvailable();
    final isEnabled = await isBiometricEnabled();
    final primaryType = await getPrimaryBiometricType();
    final availableTypes = await getAvailableBiometrics();

    return BiometricStatus(
      isAvailable: isAvailable,
      isEnabled: isEnabled,
      primaryType: primaryType,
      availableTypes: availableTypes,
      setupDate: _getSetupDate(),
      lastAuthTime: _getLastAuthTime(),
    );
  }

  // Private helper methods
  Future<void> _updateLastAuthTime() async {
    await LocalStorage.saveSetting('last_biometric_auth', DateTime.now().toIso8601String());
  }

  DateTime? _getSetupDate() {
    final setupDateString = LocalStorage.getSetting<String>('biometric_setup_date');
    if (setupDateString != null) {
      try {
        return DateTime.parse(setupDateString);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  DateTime? _getLastAuthTime() {
    final lastAuthString = LocalStorage.getSetting<String>('last_biometric_auth');
    if (lastAuthString != null) {
      try {
        return DateTime.parse(lastAuthString);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  BiometricAuthResult _handlePlatformException(PlatformException e) {
    switch (e.code) {
      case 'NotAvailable':
        return BiometricAuthResult.notAvailable();
      case 'NotEnrolled':
        return BiometricAuthResult.notEnrolled();
      case 'LockedOut':
        return BiometricAuthResult.lockedOut();
      case 'PermanentlyLockedOut':
        return BiometricAuthResult.permanentlyLockedOut();
      case 'UserCancel':
        return BiometricAuthResult.userCancelled();
      case 'UserFallback':
        return BiometricAuthResult.userFallback();
      case 'BiometricOnlyNotSupported':
        return BiometricAuthResult.biometricOnlyNotSupported();
      case 'DeviceCredentialsRequired':
        return BiometricAuthResult.deviceCredentialsRequired();
      default:
        return BiometricAuthResult.failed('${e.message} (${e.code})');
    }
  }
}

// Result classes
class BiometricAuthResult {
  final bool isSuccess;
  final BiometricAuthError? error;
  final String? message;

  BiometricAuthResult._({
    required this.isSuccess,
    this.error,
    this.message,
  });

  factory BiometricAuthResult.success() => BiometricAuthResult._(isSuccess: true);
  
  factory BiometricAuthResult.failed(String message) => BiometricAuthResult._(
    isSuccess: false,
    error: BiometricAuthError.failed,
    message: message,
  );

  factory BiometricAuthResult.notAvailable() => BiometricAuthResult._(
    isSuccess: false,
    error: BiometricAuthError.notAvailable,
    message: 'Biometric authentication is not available on this device',
  );

  factory BiometricAuthResult.notEnabled() => BiometricAuthResult._(
    isSuccess: false,
    error: BiometricAuthError.notEnabled,
    message: 'Biometric authentication is not enabled',
  );

  factory BiometricAuthResult.notEnrolled() => BiometricAuthResult._(
    isSuccess: false,
    error: BiometricAuthError.notEnrolled,
    message: 'No biometric credentials are enrolled on this device',
  );

  factory BiometricAuthResult.lockedOut() => BiometricAuthResult._(
    isSuccess: false,
    error: BiometricAuthError.lockedOut,
    message: 'Biometric authentication is temporarily locked due to too many failed attempts',
  );

  factory BiometricAuthResult.permanentlyLockedOut() => BiometricAuthResult._(
    isSuccess: false,
    error: BiometricAuthError.permanentlyLockedOut,
    message: 'Biometric authentication is permanently locked. Please unlock your device first.',
  );

  factory BiometricAuthResult.userCancelled() => BiometricAuthResult._(
    isSuccess: false,
    error: BiometricAuthError.userCancelled,
    message: 'Authentication was cancelled by the user',
  );

  factory BiometricAuthResult.userFallback() => BiometricAuthResult._(
    isSuccess: false,
    error: BiometricAuthError.userFallback,
    message: 'User chose to use device credentials instead',
  );

  factory BiometricAuthResult.biometricOnlyNotSupported() => BiometricAuthResult._(
    isSuccess: false,
    error: BiometricAuthError.biometricOnlyNotSupported,
    message: 'Biometric-only authentication is not supported',
  );

  factory BiometricAuthResult.deviceCredentialsRequired() => BiometricAuthResult._(
    isSuccess: false,
    error: BiometricAuthError.deviceCredentialsRequired,
    message: 'Device credentials are required but not set up',
  );

  bool get canRetry => error != BiometricAuthError.notAvailable &&
                      error != BiometricAuthError.notEnrolled &&
                      error != BiometricAuthError.permanentlyLockedOut;

  bool get shouldShowSettings => error == BiometricAuthError.notEnrolled ||
                                error == BiometricAuthError.deviceCredentialsRequired;
}

enum BiometricAuthError {
  failed,
  notAvailable,
  notEnabled,
  notEnrolled,
  lockedOut,
  permanentlyLockedOut,
  userCancelled,
  userFallback,
  biometricOnlyNotSupported,
  deviceCredentialsRequired,
}

class BiometricStatus {
  final bool isAvailable;
  final bool isEnabled;
  final BiometricType? primaryType;
  final List<BiometricType> availableTypes;
  final DateTime? setupDate;
  final DateTime? lastAuthTime;

  BiometricStatus({
    required this.isAvailable,
    required this.isEnabled,
    this.primaryType,
    required this.availableTypes,
    this.setupDate,
    this.lastAuthTime,
  });

  bool get canBeEnabled => isAvailable && !isEnabled;
  bool get isSetup => isEnabled && setupDate != null;
  
  String get statusDescription {
    if (!isAvailable) return 'Not available on this device';
    if (!isEnabled) return 'Disabled';
    if (primaryType != null) {
      final service = BiometricService.instance;
      return '${service.getBiometricTypeName(primaryType!)} enabled';
    }
    return 'Enabled';
  }
}