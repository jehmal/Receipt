import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'biometric_service.dart';
import '../storage/local_storage.dart';

class AppLockService {
  final BiometricService _biometricService = BiometricService.instance;
  
  static AppLockService? _instance;
  
  // App state tracking
  bool _isLocked = true;
  DateTime? _lastActivity;
  Timer? _lockTimer;
  
  // Streams for UI updates
  final StreamController<bool> _lockStateController = StreamController<bool>.broadcast();
  final StreamController<AppLockEvent> _eventController = StreamController<AppLockEvent>.broadcast();

  AppLockService._internal();

  static AppLockService get instance {
    _instance ??= AppLockService._internal();
    return _instance!;
  }

  // Getters
  bool get isLocked => _isLocked;
  Stream<bool> get lockStateStream => _lockStateController.stream;
  Stream<AppLockEvent> get eventStream => _eventController.stream;

  // Initialize the service
  Future<void> initialize() async {
    await _loadSettings();
    _updateActivity();
    _startLockTimer();
    
    // Listen for app lifecycle changes
    SystemChannels.lifecycle.setMessageHandler(_handleAppLifecycleChange);
  }

  // Check if app lock is enabled
  Future<bool> isAppLockEnabled() async {
    return LocalStorage.getSetting<bool>('app_lock_enabled') ?? false;
  }

  // Enable app lock
  Future<bool> enableAppLock() async {
    try {
      // First check if biometric authentication is available and working
      final biometricStatus = await _biometricService.getStatus();
      
      if (!biometricStatus.isAvailable) {
        _emitEvent(AppLockEvent.error('Biometric authentication is not available on this device'));
        return false;
      }

      // Test biometric authentication
      final authResult = await _biometricService.authenticate(
        reason: 'Authenticate to enable app lock',
        biometricOnly: false, // Allow fallback to device credentials
      );

      if (!authResult.isSuccess) {
        _emitEvent(AppLockEvent.error(authResult.message ?? 'Authentication failed'));
        return false;
      }

      // Enable biometric authentication if not already enabled
      if (!biometricStatus.isEnabled) {
        final biometricEnabled = await _biometricService.enableBiometric();
        if (!biometricEnabled) {
          _emitEvent(AppLockEvent.error('Failed to enable biometric authentication'));
          return false;
        }
      }

      await LocalStorage.saveSetting('app_lock_enabled', true);
      await LocalStorage.saveSetting('app_lock_setup_date', DateTime.now().toIso8601String());
      
      _emitEvent(AppLockEvent.enabled());
      return true;
    } catch (e) {
      _emitEvent(AppLockEvent.error('Failed to enable app lock: $e'));
      return false;
    }
  }

  // Disable app lock
  Future<void> disableAppLock() async {
    try {
      await LocalStorage.saveSetting('app_lock_enabled', false);
      await LocalStorage.deleteSetting('app_lock_setup_date');
      
      _isLocked = false;
      _lockStateController.add(false);
      _emitEvent(AppLockEvent.disabled());
    } catch (e) {
      _emitEvent(AppLockEvent.error('Failed to disable app lock: $e'));
    }
  }

  // Unlock the app
  Future<AppLockResult> unlock() async {
    if (!await isAppLockEnabled()) {
      _isLocked = false;
      _lockStateController.add(false);
      return AppLockResult.success();
    }

    try {
      final authResult = await _biometricService.authenticateForAppAccess();
      
      if (authResult.isSuccess) {
        _isLocked = false;
        _updateActivity();
        _lockStateController.add(false);
        _emitEvent(AppLockEvent.unlocked());
        return AppLockResult.success();
      } else {
        _emitEvent(AppLockEvent.unlockFailed(authResult.message ?? 'Authentication failed'));
        return AppLockResult.failed(authResult.message ?? 'Authentication failed');
      }
    } catch (e) {
      final message = 'Unlock failed: $e';
      _emitEvent(AppLockEvent.error(message));
      return AppLockResult.failed(message);
    }
  }

  // Lock the app immediately
  void lockApp() {
    _isLocked = true;
    _lockStateController.add(true);
    _emitEvent(AppLockEvent.locked());
    _cancelLockTimer();
  }

  // Update activity (reset auto-lock timer)
  void updateActivity() {
    if (!_isLocked) {
      _updateActivity();
    }
  }

  // Get auto-lock timeout in minutes
  Future<int> getAutoLockTimeout() async {
    return LocalStorage.getSetting<int>('auto_lock_timeout') ?? 5; // Default 5 minutes
  }

  // Set auto-lock timeout
  Future<void> setAutoLockTimeout(int minutes) async {
    await LocalStorage.saveSetting('auto_lock_timeout', minutes);
    _startLockTimer(); // Restart timer with new timeout
  }

  // Check if immediate lock is enabled (lock when app goes to background)
  Future<bool> isImmediateLockEnabled() async {
    return LocalStorage.getSetting<bool>('immediate_lock_enabled') ?? true;
  }

  // Set immediate lock setting
  Future<void> setImmediateLock(bool enabled) async {
    await LocalStorage.saveSetting('immediate_lock_enabled', enabled);
  }

  // Get app lock setup date
  DateTime? getSetupDate() {
    final setupDateString = LocalStorage.getSetting<String>('app_lock_setup_date');
    if (setupDateString != null) {
      try {
        return DateTime.parse(setupDateString);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  // Private methods
  Future<void> _loadSettings() async {
    if (await isAppLockEnabled()) {
      _isLocked = true;
    } else {
      _isLocked = false;
    }
    _lockStateController.add(_isLocked);
  }

  void _updateActivity() {
    _lastActivity = DateTime.now();
    _startLockTimer();
  }

  void _startLockTimer() {
    _cancelLockTimer();
    
    if (_isLocked || !isAppLockEnabled()) return;

    getAutoLockTimeout().then((timeoutMinutes) {
      _lockTimer = Timer(Duration(minutes: timeoutMinutes), () {
        if (!_isLocked) {
          lockApp();
          _emitEvent(AppLockEvent.autoLocked());
        }
      });
    });
  }

  void _cancelLockTimer() {
    _lockTimer?.cancel();
    _lockTimer = null;
  }

  Future<String?> _handleAppLifecycleChange(String? message) async {
    if (message == null) return null;

    switch (message) {
      case 'AppLifecycleState.paused':
      case 'AppLifecycleState.inactive':
        if (await isImmediateLockEnabled() && await isAppLockEnabled()) {
          lockApp();
        }
        break;
      case 'AppLifecycleState.resumed':
        if (await isAppLockEnabled() && !_isLocked) {
          // Check if enough time has passed for auto-lock
          if (_lastActivity != null) {
            final timeSinceActivity = DateTime.now().difference(_lastActivity!);
            final timeoutMinutes = await getAutoLockTimeout();
            
            if (timeSinceActivity.inMinutes >= timeoutMinutes) {
              lockApp();
            }
          }
        }
        break;
    }

    return null;
  }

  void _emitEvent(AppLockEvent event) {
    _eventController.add(event);
    debugPrint('AppLockService: ${event.toString()}');
  }

  void dispose() {
    _cancelLockTimer();
    _lockStateController.close();
    _eventController.close();
  }
}

// Result classes
class AppLockResult {
  final bool isSuccess;
  final String? message;

  AppLockResult._({required this.isSuccess, this.message});

  factory AppLockResult.success() => AppLockResult._(isSuccess: true);
  factory AppLockResult.failed(String message) => AppLockResult._(isSuccess: false, message: message);
}

// Events
abstract class AppLockEvent {
  const AppLockEvent();

  factory AppLockEvent.enabled() = AppLockEnabledEvent;
  factory AppLockEvent.disabled() = AppLockDisabledEvent;
  factory AppLockEvent.locked() = AppLockLockedEvent;
  factory AppLockEvent.unlocked() = AppLockUnlockedEvent;
  factory AppLockEvent.autoLocked() = AppLockAutoLockedEvent;
  factory AppLockEvent.unlockFailed(String message) = AppLockUnlockFailedEvent;
  factory AppLockEvent.error(String message) = AppLockErrorEvent;
}

class AppLockEnabledEvent extends AppLockEvent {
  @override
  String toString() => 'AppLockEnabled';
}

class AppLockDisabledEvent extends AppLockEvent {
  @override
  String toString() => 'AppLockDisabled';
}

class AppLockLockedEvent extends AppLockEvent {
  @override
  String toString() => 'AppLockLocked';
}

class AppLockUnlockedEvent extends AppLockEvent {
  @override
  String toString() => 'AppLockUnlocked';
}

class AppLockAutoLockedEvent extends AppLockEvent {
  @override
  String toString() => 'AppLockAutoLocked';
}

class AppLockUnlockFailedEvent extends AppLockEvent {
  final String message;
  const AppLockUnlockFailedEvent(this.message);
  
  @override
  String toString() => 'AppLockUnlockFailed: $message';
}

class AppLockErrorEvent extends AppLockEvent {
  final String message;
  const AppLockErrorEvent(this.message);
  
  @override
  String toString() => 'AppLockError: $message';
}