# Receipt Vault Pro - Production Monitoring Setup

## 🔍 Error Tracking & Crash Reporting

### Recommended Services
1. **Firebase Crashlytics** (Free, comprehensive)
   ```yaml
   # Add to pubspec.yaml
   firebase_core: ^2.24.2
   firebase_crashlytics: ^3.4.9
   firebase_analytics: ^10.7.4
   ```

2. **Sentry** (Alternative)
   ```yaml
   sentry_flutter: ^7.13.2
   ```

### Implementation
```dart
// main.dart
void main() async {
  await Firebase.initializeApp();
  
  // Production crash reporting
  if (kReleaseMode) {
    FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
    PlatformDispatcher.instance.onError = (error, stack) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
      return true;
    };
  }
  
  runApp(const ReceiptVaultApp());
}
```

## 📈 Performance Monitoring

### Key Metrics to Track
- App startup time
- API response times
- OCR processing duration
- Image upload speeds
- Battery usage
- Memory consumption

### Implementation
```dart
// core/monitoring/performance_service.dart
class PerformanceService {
  static void trackAPICall(String endpoint, Duration duration) {
    FirebasePerformance.instance
        .newTrace('api_$endpoint')
        .setMetric('duration_ms', duration.inMilliseconds)
        .stop();
  }
  
  static void trackOCRProcessing(Duration duration, bool success) {
    FirebasePerformance.instance
        .newTrace('ocr_processing')
        .setMetric('duration_ms', duration.inMilliseconds)
        .putAttribute('success', success.toString())
        .stop();
  }
}
```

## 🗂️ Logging Strategy

### Log Levels
```dart
enum LogLevel {
  debug,   // Development only
  info,    // General information
  warning, // Non-critical issues
  error,   // Errors that don't crash app
  fatal,   // Critical errors
}

class Logger {
  static void debug(String message, [Object? error, StackTrace? stackTrace]) {
    if (kDebugMode) print('[DEBUG] $message');
  }
  
  static void error(String message, [Object? error, StackTrace? stackTrace]) {
    print('[ERROR] $message');
    if (kReleaseMode && error != null) {
      FirebaseCrashlytics.instance.recordError(error, stackTrace, fatal: false);
    }
  }
}
```

## 🎯 Custom Events Tracking

### Business Metrics
```dart
class AnalyticsService {
  static void trackReceiptScanned({required String category, required double amount}) {
    FirebaseAnalytics.instance.logEvent(
      name: 'receipt_scanned',
      parameters: {
        'category': category,
        'amount': amount,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      },
    );
  }
  
  static void trackExportGenerated({required String format, required int receiptCount}) {
    FirebaseAnalytics.instance.logEvent(
      name: 'export_generated',
      parameters: {
        'format': format,
        'receipt_count': receiptCount,
      },
    );
  }
}
```

## 🚨 Alerting Rules

### Critical Alerts
- Crash rate > 1%
- API error rate > 5%
- OCR failure rate > 10%
- Upload failure rate > 5%

### Warning Alerts
- App startup time > 3 seconds
- Memory usage > 200MB
- Battery drain excessive

## 📊 Dashboard KPIs

### User Experience
- Monthly Active Users (MAU)
- Daily Active Users (DAU)
- Session duration
- Retention rates (Day 1, 7, 30)

### Feature Usage
- Receipts scanned per user
- Voice memos recorded
- Exports generated
- Offline sync frequency

### Technical Health
- Crash-free session rate
- API success rate
- OCR accuracy rate
- Sync success rate

## 🔐 Privacy Compliance

### Data Collection Notice
```dart
// Show on first app launch
class PrivacyNoticeDialog {
  static void show(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Privacy & Analytics'),
        content: Text(
          'Receipt Vault collects anonymous usage data to improve the app. '
          'No personal receipt data is shared with third parties.'
        ),
        actions: [
          TextButton(
            onPressed: () => _optOut(),
            child: Text('Opt Out'),
          ),
          TextButton(
            onPressed: () => _optIn(),
            child: Text('Accept'),
          ),
        ],
      ),
    );
  }
}
```