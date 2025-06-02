import 'dart:io';

class AppConfig {
  // Environment-based configuration with fallbacks
  static String get baseUrl {
    // First check for explicitly set environment variable
    final envUrl = const String.fromEnvironment('API_BASE_URL');
    if (envUrl.isNotEmpty) return envUrl;
    
    // Platform-specific defaults for development
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:3000/api'; // Android emulator
    } else if (Platform.isIOS) {
      return 'http://localhost:3000/api'; // iOS simulator
    } else {
      return 'http://localhost:3000/api'; // Default for web/desktop
    }
  }

  static String get authBaseUrl {
    // First check for explicitly set environment variable
    final envUrl = const String.fromEnvironment('AUTH_BASE_URL');
    if (envUrl.isNotEmpty) return envUrl;
    
    // Platform-specific defaults for development
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:3000'; // Android emulator
    } else if (Platform.isIOS) {
      return 'http://localhost:3000'; // iOS simulator
    } else {
      return 'http://localhost:3000'; // Default for web/desktop
    }
  }

  // App configuration constants
  static const String appName = 'Receipt Vault Pro';
  static const String appVersion = '1.0.0';
  
  // API configuration
  static const int requestTimeoutSeconds = 30;
  static const int maxRetryAttempts = 3;
  
  // Local storage keys
  static const String userTokenKey = 'user_token';
  static const String userIdKey = 'user_id';
  static const String lastSyncKey = 'last_sync_timestamp';
  
  // Feature flags for production
  static const bool isDebugMode = bool.fromEnvironment('DEBUG', defaultValue: false);
  static const bool enableLogging = bool.fromEnvironment('ENABLE_LOGGING', defaultValue: true);
  static const bool enableCrashReporting = bool.fromEnvironment('ENABLE_CRASH_REPORTING', defaultValue: true);
  
  // Production URLs (will be used when environment variables are set)
  static const String productionApiUrl = String.fromEnvironment('PRODUCTION_API_URL', defaultValue: '');
  static const String productionAuthUrl = String.fromEnvironment('PRODUCTION_AUTH_URL', defaultValue: '');
  
  // Docker Environment Support
  static const String dockerAuthBaseUrl = 'http://10.0.2.2:3000'; // Android emulator
  static const String iosSimulatorAuthBaseUrl = 'http://localhost:3000'; // iOS simulator
  
  // Storage Configuration
  static const String receiptBoxName = 'receipts';
  static const String userBoxName = 'user';
  static const String settingsBoxName = 'settings';
  
  // OCR Configuration
  static const double ocrConfidenceThreshold = 0.8;
  static const int maxImageSize = 5 * 1024 * 1024; // 5MB
  
  // Camera Configuration
  static const double imageQuality = 0.8;
  static const int maxImageWidth = 1920;
  static const int maxImageHeight = 1080;
  
  // Security Configuration
  static const bool enableBiometrics = true;
  static const int sessionTimeoutMinutes = 30;
  
  // Feature Flags
  static const bool enableOfflineMode = true;
  static const bool enableEmailToVault = true;
  static const bool enableSemanticSearch = true;
}