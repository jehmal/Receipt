import 'dart:io';

class AppConfig {
  // Environment-based configuration with fallbacks
  static String get apiBaseUrl {
    return baseUrl;
  }
  
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
  static const String version = '1.0.0';
  
  // UI/UX Configuration for enhanced experience
  static const bool enableAnimations = true;
  static const bool enableHapticFeedback = true;
  static const double largeCaptureButtonSize = 120.0;
  
  // Business Logic Configuration
  static const List<String> receiptCategories = [
    'Fuel',
    'Tools',
    'Parts',
    'Parking',
    'Warranty',
    'Office Supplies',
    'Travel',
    'Meals'
  ];
  
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

  // Environment
  static const bool isProduction = bool.fromEnvironment('dart.vm.product');
  static const bool isDevelopment = !isProduction;
  
  // Feature flags
  static const bool enableWorkOSAuth = true;
  static const bool enableAnalytics = false;
  
  // File upload limits
  static const int maxFileSize = 50 * 1024 * 1024; // 50MB
  static const List<String> allowedFileTypes = [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'application/pdf'
  ];
  
  // Cache settings
  static const Duration cacheTimeout = Duration(hours: 24);
  static const int maxCacheItems = 1000;
  
  // UI settings - Enhanced for Receipt Vault Pro
  static const Duration animationDuration = Duration(milliseconds: 300);
  static const Duration heroAnimationDuration = Duration(milliseconds: 500);
  static const double borderRadius = 8.0;
  static const double spacing = 16.0;
  
  // Voice memo configuration
  static const int maxVoiceMemoSeconds = 60;
  static const bool enableVoiceTranscription = true;
  
  // Company mode settings
  static const bool enableCompanyMode = true;
  static const bool enableMultiTenant = true;
  
  // Export settings
  static const List<String> exportFormats = ['PDF', 'CSV', 'Excel'];
  
  // Warranty tracking
  static const bool enableWarrantyTracking = true;
  static const int warrantyExpiryNotificationDays = 30;
  
  // Offline sync configuration
  static const Duration syncRetryDelay = Duration(seconds: 30);
  static const int maxSyncRetries = 5;
  
  // Theme configuration
  static const String defaultTheme = 'system'; // 'light', 'dark', 'system'
}