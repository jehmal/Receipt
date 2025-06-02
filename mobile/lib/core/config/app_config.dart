class AppConfig {
  static const String appName = 'Receipt Vault';
  static const String version = '1.0.0';
  
  // API Configuration
  static const String baseUrl = 'http://localhost:3000/api';
  static const int timeoutDuration = 30000;
  
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