# Mobile App Testing Strategy - Receipt Vault Pro

## Testing Pyramid Overview

```
                    E2E Tests (10%)
                 ┌─────────────────┐
                 │  User Journeys  │
                 │  App Store      │
                 │  Deployment     │
                 └─────────────────┘
              
              Integration Tests (30%)
           ┌─────────────────────────┐
           │  API Integration        │
           │  Camera & OCR Flow      │ 
           │  Offline Sync          │
           │  Voice Recognition     │
           └─────────────────────────┘
        
           Unit Tests (60%)
      ┌─────────────────────────────────┐
      │  Providers & State Management   │
      │  Business Logic                 │
      │  Utility Functions             │
      │  Model Serialization           │
      └─────────────────────────────────┘
```

## 1. Unit Testing (Target: 80% Coverage)

### 1.1 Provider Testing
```dart
// test/providers/camera_provider_test.dart
void main() {
  group('CameraProvider', () {
    late CameraProvider provider;
    late MockApiClient mockApiClient;
    late MockLocalStorage mockStorage;

    setUp(() {
      mockApiClient = MockApiClient();
      mockStorage = MockLocalStorage();
      provider = CameraProvider(
        apiClient: mockApiClient,
        storage: mockStorage,
      );
    });

    testWidgets('should capture and process receipt successfully', (tester) async {
      // Test OCR processing workflow
      final mockImage = File('test_receipt.jpg');
      when(mockApiClient.uploadFile(any, any)).thenAnswer(
        (_) async => ApiResponse(statusCode: 201, data: mockReceiptData),
      );

      final result = await provider.processReceipt(mockImage);
      
      expect(result.isSuccess, true);
      expect(result.data.status, 'completed');
      verify(mockStorage.saveReceipt(any)).called(1);
    });

    test('should handle offline mode gracefully', () async {
      when(mockApiClient.uploadFile(any, any)).thenThrow(
        NetworkException('No internet connection'),
      );

      final result = await provider.processReceipt(mockImage);
      
      expect(result.isSuccess, true);
      expect(result.data.isSynced, false);
      verify(mockStorage.addToSyncQueue(any)).called(1);
    });
  });
}
```

### 1.2 Model & Serialization Testing
```dart
// test/models/receipt_test.dart
void main() {
  group('Receipt Model', () {
    test('should serialize to/from JSON correctly', () {
      final receipt = Receipt(
        id: 'test-id',
        userId: 'user-id',
        totalAmount: 67.50,
        vendorName: 'Shell',
        category: 'Fuel',
        tags: ['business', 'fuel'],
        createdAt: DateTime(2024, 1, 15),
        isSynced: true,
      );

      final json = receipt.toJson();
      final deserializedReceipt = Receipt.fromJson(json);

      expect(deserializedReceipt, equals(receipt));
      expect(deserializedReceipt.totalAmount, 67.50);
      expect(deserializedReceipt.tags, containsAll(['business', 'fuel']));
    });

    test('should handle null values gracefully', () {
      final json = {
        'id': 'test-id',
        'user_id': 'user-id',
        'status': 'uploaded',
        'created_at': '2024-01-15T10:30:00Z',
        'updated_at': '2024-01-15T10:30:00Z',
        // Missing optional fields
      };

      final receipt = Receipt.fromJson(json);
      
      expect(receipt.totalAmount, isNull);
      expect(receipt.vendorName, isNull);
      expect(receipt.tags, isEmpty);
    });
  });
}
```

### 1.3 Business Logic Testing
```dart
// test/services/offline_sync_test.dart
void main() {
  group('Offline Sync Service', () {
    test('should queue operations when offline', () async {
      final syncService = OfflineSyncService();
      final operation = SyncOperation(
        type: 'create_receipt',
        data: {'file_path': '/test/receipt.jpg'},
        localId: 'temp_123',
      );

      await syncService.queueOperation(operation);
      
      final queue = await syncService.getPendingOperations();
      expect(queue, contains(operation));
    });

    test('should process queue when online', () async {
      // Test sync queue processing
      when(mockConnectivity.checkConnectivity())
          .thenAnswer((_) async => ConnectivityResult.wifi);
      
      final processed = await syncService.processPendingOperations();
      
      expect(processed, greaterThan(0));
      verify(mockApiClient.post(any, data: anyNamed('data'))).called(1);
    });
  });
}
```

## 2. Widget Testing (UI Components)

### 2.1 Critical UI Flows
```dart
// test/widgets/large_capture_button_test.dart
void main() {
  group('LargeCaptureButton', () {
    testWidgets('should trigger camera when tapped', (tester) async {
      bool cameraCalled = false;
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: LargeCaptureButton(
              onPressed: () => cameraCalled = true,
            ),
          ),
        ),
      );

      await tester.tap(find.byType(LargeCaptureButton));
      await tester.pump();

      expect(cameraCalled, true);
    });

    testWidgets('should show correct text and icon', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: LargeCaptureButton(onPressed: () {}),
          ),
        ),
      );

      expect(find.text('CAPTURE RECEIPT'), findsOneWidget);
      expect(find.byIcon(Icons.camera_alt), findsOneWidget);
    });
  });
}

// test/widgets/context_toggle_test.dart
void main() {
  testWidgets('ContextToggle should switch between personal and company', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(body: ContextToggle()),
        ),
      ),
    );

    // Initially should be personal
    expect(find.text('Personal'), findsOneWidget);
    
    // Tap company toggle
    await tester.tap(find.text('Company'));
    await tester.pump();

    // Should update to company mode
    final container = ProviderScope.containerOf(
      tester.element(find.byType(ContextToggle)),
    );
    expect(
      container.read(receiptContextProvider),
      ReceiptContext.company,
    );
  });
}
```

### 2.2 Voice Input Testing
```dart
// test/widgets/voice_memo_widget_test.dart
void main() {
  group('VoiceMemoWidget', () {
    testWidgets('should show microphone when speech available', (tester) async {
      final mockSpeech = MockSpeechToText();
      when(mockSpeech.initialize()).thenAnswer((_) async => true);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: VoiceMemoWidget(
              onVoiceMemo: (memo) {},
              textController: TextEditingController(),
            ),
          ),
        ),
      );

      expect(find.byIcon(Icons.mic_none), findsOneWidget);
      expect(find.text('Tap to record voice memo'), findsOneWidget);
    });

    testWidgets('should handle speech recognition error gracefully', (tester) async {
      final mockSpeech = MockSpeechToText();
      when(mockSpeech.initialize()).thenAnswer((_) async => false);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: VoiceMemoWidget(
              onVoiceMemo: (memo) {},
              textController: TextEditingController(),
            ),
          ),
        ),
      );

      expect(find.text('Voice recording unavailable'), findsOneWidget);
    });
  });
}
```

## 3. Integration Testing

### 3.1 Camera Flow Integration
```dart
// integration_test/camera_flow_test.dart
void main() {
  group('Camera to Receipt Processing Flow', () {
    testWidgets('complete receipt capture and save flow', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      // Navigate to camera
      await tester.tap(find.byIcon(Icons.camera_alt));
      await tester.pumpAndSettle();

      // Simulate camera capture
      await tester.tap(find.byIcon(Icons.camera));
      await tester.pumpAndSettle();

      // Should navigate to processing screen
      expect(find.text('Process Receipt'), findsOneWidget);

      // Select category
      await tester.tap(find.text('Select category'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Fuel'));
      await tester.pumpAndSettle();

      // Add memo
      await tester.enterText(
        find.byType(TextFormField).last,
        'Fuel for job site visit',
      );

      // Save receipt
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();

      // Should return to home with success message
      expect(find.text('Receipt saved successfully!'), findsOneWidget);
    });
  });
}
```

### 3.2 Offline Mode Integration
```dart
// integration_test/offline_mode_test.dart
void main() {
  group('Offline Mode Integration', () {
    testWidgets('should work offline and sync when online', (tester) async {
      // Simulate offline mode
      await mockNetworkConnectivity(ConnectivityResult.none);
      
      app.main();
      await tester.pumpAndSettle();

      // Capture receipt offline
      await _captureReceiptFlow(tester);
      
      // Should save locally
      expect(find.byIcon(Icons.sync_disabled), findsOneWidget);

      // Go back online
      await mockNetworkConnectivity(ConnectivityResult.wifi);
      
      // Should auto-sync
      await tester.pump(Duration(seconds: 2));
      expect(find.byIcon(Icons.sync), findsOneWidget);
    });
  });
}
```

### 3.3 Context Switching Integration
```dart
// integration_test/context_switching_test.dart
void main() {
  testWidgets('should filter receipts by context', (tester) async {
    app.main();
    await tester.pumpAndSettle();

    // Switch to company mode
    await tester.tap(find.text('Company'));
    await tester.pumpAndSettle();

    // Navigate to receipts
    await tester.tap(find.text('Receipts'));
    await tester.pumpAndSettle();

    // Should show only company receipts
    expect(find.text('Company Receipts'), findsOneWidget);
    
    // Switch back to personal
    await tester.tap(find.text('Personal'));
    await tester.pumpAndSettle();

    // Should show personal receipts
    expect(find.text('Personal Receipts'), findsOneWidget);
  });
}
```

## 4. End-to-End Testing

### 4.1 Critical User Journeys
```dart
// integration_test/user_journeys_test.dart
void main() {
  group('Critical User Journeys', () {
    testWidgets('Tradie daily workflow', (tester) async {
      // 1. Login
      await _loginFlow(tester);

      // 2. Set company context
      await _switchToCompanyMode(tester);

      // 3. Capture fuel receipt
      await _captureReceiptWithJobNumber(tester, 'JOB-2024-001');

      // 4. Capture tools receipt
      await _captureReceiptWithCategory(tester, 'Tools');

      // 5. Review daily receipts
      await _reviewReceiptsForToday(tester);

      // 6. Export for accounting
      await _exportReceiptsAsCSV(tester);
    });

    testWidgets('Business owner monthly review', (tester) async {
      // 1. Login as business owner
      await _loginAsBusinessOwner(tester);

      // 2. View analytics dashboard
      await _viewAnalyticsDashboard(tester);

      // 3. Review team receipts
      await _reviewTeamReceipts(tester);

      // 4. Approve/reject receipts
      await _approveRejectFlow(tester);

      // 5. Invite accountant
      await _inviteAccountant(tester);
    });
  });
}
```

## 5. Performance Testing

### 5.1 Load Testing
```dart
// test/performance/load_test.dart
void main() {
  group('Performance Tests', () {
    test('should handle 1000 receipts without memory leaks', () async {
      final provider = ReceiptsProvider();
      final stopwatch = Stopwatch()..start();

      // Load 1000 receipts
      for (int i = 0; i < 1000; i++) {
        await provider.addReceipt(createMockReceipt());
      }

      stopwatch.stop();
      
      expect(stopwatch.elapsedMilliseconds, lessThan(5000)); // <5 seconds
      
      // Check memory usage
      final memoryUsage = await getMemoryUsage();
      expect(memoryUsage, lessThan(100 * 1024 * 1024)); // <100MB
    });

    test('should upload large images efficiently', () async {
      final largeImage = await createLargeTestImage(5 * 1024 * 1024); // 5MB
      final stopwatch = Stopwatch()..start();

      final result = await provider.uploadReceipt(largeImage);

      stopwatch.stop();
      expect(stopwatch.elapsedSeconds, lessThan(30)); // <30 seconds
      expect(result.isSuccess, true);
    });
  });
}
```

## 6. Device & Platform Testing

### 6.1 Device Matrix
```yaml
# .github/workflows/device_testing.yml
strategy:
  matrix:
    include:
      - device: "iPhone 15 Pro"
        os: "iOS 17"
        screen: "6.1 inch"
      - device: "iPhone SE"
        os: "iOS 16"
        screen: "4.7 inch"
      - device: "Samsung Galaxy S24"
        os: "Android 14"
        screen: "6.2 inch"
      - device: "Google Pixel 6a"
        os: "Android 13"
        screen: "6.1 inch"
      - device: "OnePlus Nord"
        os: "Android 12"
        screen: "6.44 inch"
```

### 6.2 Platform-Specific Tests
```dart
// test/platform/ios_specific_test.dart
void main() {
  group('iOS Specific Features', () {
    testWidgets('should use Face ID when available', (tester) async {
      if (Platform.isIOS) {
        await mockBiometricCapability(BiometricType.face);
        
        // Test Face ID authentication flow
        await _testBiometricAuth(tester, BiometricType.face);
      }
    });
  });
}

// test/platform/android_specific_test.dart
void main() {
  group('Android Specific Features', () {
    testWidgets('should handle permission requests correctly', (tester) async {
      if (Platform.isAndroid) {
        await mockPermissionStatus(Permission.camera, PermissionStatus.denied);
        
        // Test permission request flow
        await _testCameraPermissionFlow(tester);
      }
    });
  });
}
```

## 7. Accessibility Testing

```dart
// test/accessibility/a11y_test.dart
void main() {
  group('Accessibility Tests', () {
    testWidgets('should pass semantic labeling tests', (tester) async {
      await tester.pumpWidget(app);
      
      // Test semantic labels
      expect(tester, meetsGuideline(textContrastGuideline));
      expect(tester, meetsGuideline(SemanticsGuideline.minimumTapTargetGuideline));
      expect(tester, meetsGuideline(androidTapTargetGuideline));
      expect(tester, meetsGuideline(iOSTapTargetGuideline));
    });

    testWidgets('should support screen readers', (tester) async {
      await tester.pumpWidget(app);
      
      // Enable screen reader
      SemanticsBinding.instance.ensureSemantics();
      
      // Test navigation with TalkBack/VoiceOver
      await _testScreenReaderNavigation(tester);
    });
  });
}
```

## 8. Security Testing

```dart
// test/security/security_test.dart
void main() {
  group('Security Tests', () {
    test('should encrypt sensitive data in local storage', () async {
      const sensitiveData = 'user_auth_token';
      await LocalStorage.saveSetting('auth_token', sensitiveData);
      
      // Check that raw storage is encrypted
      final rawStorage = await getRawStorage();
      expect(rawStorage['auth_token'], isNot(contains(sensitiveData)));
    });

    test('should not log sensitive information', () async {
      final logger = TestLogger();
      
      await provider.authenticateUser('password123');
      
      final logs = logger.getAllLogs();
      expect(logs.any((log) => log.contains('password123')), false);
    });
  });
}
```

## 9. Test Data Management

```dart
// test/fixtures/test_data.dart
class TestDataManager {
  static Receipt createMockReceipt({
    String? id,
    double? amount,
    String? vendor,
    String? category,
  }) {
    return Receipt(
      id: id ?? uuid.v4(),
      userId: 'test-user-id',
      totalAmount: amount ?? 67.50,
      vendorName: vendor ?? 'Shell',
      category: category ?? 'Fuel',
      tags: ['business'],
      createdAt: DateTime.now(),
      isSynced: true,
    );
  }

  static List<Receipt> createReceiptList(int count) {
    return List.generate(count, (index) => createMockReceipt(
      id: 'receipt-$index',
      amount: (index + 1) * 10.0,
    ));
  }

  static File createMockImageFile() {
    // Create test image file
    return File('test/fixtures/test_receipt.jpg');
  }
}
```

## 10. CI/CD Integration

```yaml
# .github/workflows/mobile_testing.yml
name: Mobile App Testing
on: [push, pull_request]

jobs:
  unit_tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: subosito/flutter-action@v2
      - run: flutter test --coverage
      - run: flutter test --machine > test_results.json
      
  integration_tests:
    runs-on: macos-latest
    strategy:
      matrix:
        device: [iPhone-15, iPad-Air]
    steps:
      - uses: actions/checkout@v3
      - uses: subosito/flutter-action@v2
      - run: flutter drive --target=integration_test/app_test.dart

  e2e_tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: subosito/flutter-action@v2
      - run: flutter test integration_test/
```

This comprehensive testing strategy ensures our mobile app delivers the reliable, fast experience that field workers and business owners need while maintaining high code quality and user satisfaction.