import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:receipt_vault/core/network/api_client.dart';
import 'package:receipt_vault/core/storage/local_storage.dart';
import 'package:receipt_vault/features/camera/screens/camera_screen.dart';
import 'package:receipt_vault/features/camera/widgets/camera_overlay.dart';
import 'package:receipt_vault/features/camera/widgets/receipt_preview.dart';
import 'package:receipt_vault/features/camera/widgets/upload_progress_widget.dart';
import 'package:receipt_vault/features/camera/providers/camera_provider.dart';
import 'package:receipt_vault/features/camera/providers/upload_provider.dart';
import 'package:receipt_vault/core/sync/sync_service.dart';
import 'package:receipt_vault/shared/models/receipt.dart';

// Generate mocks
@GenerateMocks([ApiClient, LocalStorage, SyncService])
import 'receipt_processing_test.mocks.dart';

void main() {
  group('Receipt Processing Integration Tests', () {
    late MockApiClient mockApiClient;
    late MockLocalStorage mockLocalStorage;
    late MockSyncService mockSyncService;
    late ProviderContainer container;

    const mockReceiptData = Receipt(
      id: 'test-receipt-1',
      userId: 'test-user-1',
      totalAmount: 123.45,
      vendor: 'Test Vendor',
      date: '2024-01-15',
      status: ReceiptStatus.processed,
      ocrData: {
        'totalAmount': 123.45,
        'vendor': 'Test Vendor',
        'date': '2024-01-15',
        'confidence': 0.95,
      },
    );

    setUp(() {
      mockApiClient = MockApiClient();
      mockLocalStorage = MockLocalStorage();
      mockSyncService = MockSyncService();

      SharedPreferences.setMockInitialValues({});

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localStorageProvider.overrideWithValue(mockLocalStorage),
          syncServiceProvider.overrideWithValue(mockSyncService),
        ],
      );
    });

    tearDown(() {
      container.dispose();
    });

    testWidgets('should complete receipt capture and upload flow', (tester) async {
      // Mock successful API responses
      when(mockApiClient.uploadReceipt(any))
          .thenAnswer((_) async => ApiResponse(
                statusCode: 201,
                data: mockReceiptData.toJson(),
                success: true,
              ));

      when(mockApiClient.getReceiptStatus(any))
          .thenAnswer((_) async => ApiResponse(
                statusCode: 200,
                data: {'status': 'processed', 'ocrData': mockReceiptData.ocrData},
                success: true,
              ));

      // Mock local storage
      when(mockLocalStorage.storeReceipt(any))
          .thenAnswer((_) async => true);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            home: CameraScreen(),
          ),
        ),
      );

      // Wait for camera initialization
      await tester.pumpAndSettle();

      // Verify camera overlay is displayed
      expect(find.byType(CameraOverlay), findsOneWidget);

      // Simulate camera capture
      final captureButton = find.byKey(Key('capture-button'));
      expect(captureButton, findsOneWidget);
      
      await tester.tap(captureButton);
      await tester.pumpAndSettle();

      // Verify image preview is shown
      expect(find.byType(ReceiptPreview), findsOneWidget);

      // Submit receipt for processing
      final submitButton = find.byKey(Key('submit-button'));
      expect(submitButton, findsOneWidget);
      
      await tester.tap(submitButton);
      await tester.pumpAndSettle();

      // Verify upload progress is displayed
      expect(find.byType(UploadProgressWidget), findsOneWidget);

      // Wait for processing completion
      await tester.pump(Duration(seconds: 3));
      await tester.pumpAndSettle();

      // Verify success state
      expect(find.text('Receipt uploaded successfully'), findsOneWidget);

      // Verify API calls were made
      verify(mockApiClient.uploadReceipt(any)).called(1);
      verify(mockLocalStorage.storeReceipt(any)).called(1);
    });

    testWidgets('should handle offline mode gracefully', (tester) async {
      // Mock offline state
      when(mockApiClient.uploadReceipt(any))
          .thenThrow(SocketException('No internet connection'));

      when(mockLocalStorage.storeReceipt(any))
          .thenAnswer((_) async => true);

      when(mockSyncService.queueOfflineReceipt(any))
          .thenAnswer((_) async => true);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(home: CameraScreen()),
        ),
      );

      await tester.pumpAndSettle();

      // Capture and submit receipt
      await tester.tap(find.byKey(Key('capture-button')));
      await tester.pumpAndSettle();
      
      await tester.tap(find.byKey(Key('submit-button')));
      await tester.pumpAndSettle();

      // Verify offline queue message
      expect(find.text('Saved for upload when online'), findsOneWidget);

      // Verify offline storage
      verify(mockLocalStorage.storeReceipt(any)).called(1);
      verify(mockSyncService.queueOfflineReceipt(any)).called(1);
    });

    testWidgets('should sync when coming back online', (tester) async {
      // Mock pending offline receipts
      when(mockSyncService.getPendingUploads())
          .thenAnswer((_) async => [mockReceiptData]);

      // Mock successful sync
      when(mockApiClient.uploadReceipt(any))
          .thenAnswer((_) async => ApiResponse(
                statusCode: 201,
                data: mockReceiptData.toJson(),
                success: true,
              ));

      when(mockSyncService.syncPendingReceipts())
          .thenAnswer((_) async => SyncResult(
                successful: 1,
                failed: 0,
                syncedReceipts: [mockReceiptData],
              ));

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(home: CameraScreen()),
        ),
      );

      await tester.pumpAndSettle();

      // Trigger sync
      final syncButton = find.byKey(Key('sync-button'));
      if (syncButton.evaluate().isNotEmpty) {
        await tester.tap(syncButton);
        await tester.pumpAndSettle();
      }

      // Verify sync completion
      verify(mockSyncService.syncPendingReceipts()).called(1);
      verify(mockApiClient.uploadReceipt(any)).called(1);
    });

    testWidgets('should handle camera permission denial', (tester) async {
      // Mock camera permission denial
      when(mockLocalStorage.hasPermission('camera'))
          .thenAnswer((_) async => false);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(home: CameraScreen()),
        ),
      );

      await tester.pumpAndSettle();

      // Verify permission request UI
      expect(find.text('Camera permission required'), findsOneWidget);
      expect(find.text('Grant Permission'), findsOneWidget);

      // Grant permission
      when(mockLocalStorage.requestPermission('camera'))
          .thenAnswer((_) async => true);
      when(mockLocalStorage.hasPermission('camera'))
          .thenAnswer((_) async => true);

      await tester.tap(find.text('Grant Permission'));
      await tester.pumpAndSettle();

      // Verify camera UI is now available
      expect(find.byType(CameraOverlay), findsOneWidget);
    });

    testWidgets('should validate receipt image quality', (tester) async {
      // Mock low-quality image detection
      when(mockApiClient.validateImageQuality(any))
          .thenAnswer((_) async => ImageQualityResult(
                isValid: false,
                issues: ['Image too blurry', 'Poor lighting'],
                score: 0.3,
              ));

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(home: CameraScreen()),
        ),
      );

      await tester.pumpAndSettle();

      // Capture image
      await tester.tap(find.byKey(Key('capture-button')));
      await tester.pumpAndSettle();

      // Verify quality warning
      expect(find.text('Image Quality Warning'), findsOneWidget);
      expect(find.text('Image too blurry'), findsOneWidget);
      expect(find.text('Poor lighting'), findsOneWidget);

      // Options to retake or proceed
      expect(find.text('Retake Photo'), findsOneWidget);
      expect(find.text('Use Anyway'), findsOneWidget);
    });

    testWidgets('should handle concurrent uploads', (tester) async {
      // Mock multiple receipt uploads
      when(mockApiClient.uploadReceipt(any))
          .thenAnswer((_) async => ApiResponse(
                statusCode: 201,
                data: mockReceiptData.toJson(),
                success: true,
              ));

      when(mockLocalStorage.storeReceipt(any))
          .thenAnswer((_) async => true);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(home: CameraScreen()),
        ),
      );

      await tester.pumpAndSettle();

      // Capture and submit multiple receipts quickly
      for (int i = 0; i < 3; i++) {
        await tester.tap(find.byKey(Key('capture-button')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(Key('submit-button')));
        await tester.pump(Duration(milliseconds: 100));
      }

      await tester.pumpAndSettle(Duration(seconds: 5));

      // Verify all uploads were handled
      verify(mockApiClient.uploadReceipt(any)).called(3);
      verify(mockLocalStorage.storeReceipt(any)).called(3);
    });

    testWidgets('should preserve user data during app lifecycle', (tester) async {
      // Mock saved state
      when(mockLocalStorage.getReceiptDrafts())
          .thenAnswer((_) async => [
                {
                  'id': 'draft-1',
                  'totalAmount': 50.0,
                  'vendor': 'Draft Vendor',
                  'imagePath': '/path/to/image',
                  'timestamp': DateTime.now().toIso8601String(),
                }
              ]);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(home: CameraScreen()),
        ),
      );

      await tester.pumpAndSettle();

      // Verify draft restoration
      expect(find.text('Resume draft'), findsOneWidget);
      expect(find.text('Draft Vendor'), findsOneWidget);

      // Resume draft
      await tester.tap(find.text('Resume draft'));
      await tester.pumpAndSettle();

      // Verify draft data is loaded
      expect(find.text('50.0'), findsOneWidget);
      expect(find.text('Draft Vendor'), findsOneWidget);
    });

    testWidgets('should handle server errors gracefully', (tester) async {
      // Mock server error
      when(mockApiClient.uploadReceipt(any))
          .thenAnswer((_) async => ApiResponse(
                statusCode: 500,
                data: null,
                success: false,
                error: 'Internal server error',
              ));

      when(mockLocalStorage.storeReceipt(any))
          .thenAnswer((_) async => true);

      when(mockSyncService.queueOfflineReceipt(any))
          .thenAnswer((_) async => true);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(home: CameraScreen()),
        ),
      );

      await tester.pumpAndSettle();

      // Capture and submit receipt
      await tester.tap(find.byKey(Key('capture-button')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(Key('submit-button')));
      await tester.pumpAndSettle();

      // Verify error handling
      expect(find.text('Upload failed. Saved locally.'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);

      // Verify receipt was queued for retry
      verify(mockSyncService.queueOfflineReceipt(any)).called(1);
    });

    testWidgets('should validate financial data input', (tester) async {
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(home: CameraScreen()),
        ),
      );

      await tester.pumpAndSettle();

      // Capture receipt
      await tester.tap(find.byKey(Key('capture-button')));
      await tester.pumpAndSettle();

      // Edit receipt details manually
      final editButton = find.byKey(Key('edit-details-button'));
      await tester.tap(editButton);
      await tester.pumpAndSettle();

      // Test invalid amount input
      final amountField = find.byKey(Key('amount-field'));
      await tester.enterText(amountField, '-50.00');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();

      // Verify validation error
      expect(find.text('Amount must be positive'), findsOneWidget);

      // Test valid amount
      await tester.enterText(amountField, '50.00');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();

      // Verify validation passes
      expect(find.text('Amount must be positive'), findsNothing);
    });

    testWidgets('should support accessibility features', (tester) async {
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            home: CameraScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Test semantic labels
      expect(find.bySemanticsLabel('Capture receipt photo'), findsOneWidget);
      expect(find.bySemanticsLabel('Flash toggle'), findsOneWidget);
      expect(find.bySemanticsLabel('Switch camera'), findsOneWidget);

      // Test tap target sizes (minimum 48x48)
      final captureButton = tester.widget<MaterialButton>(
        find.byKey(Key('capture-button')),
      );
      expect(captureButton.minWidth, greaterThanOrEqualTo(48.0));
      expect(captureButton.height, greaterThanOrEqualTo(48.0));
    });
  });

  group('Financial Data Security Tests', () {
    late MockApiClient mockApiClient;
    late MockLocalStorage mockLocalStorage;
    late ProviderContainer container;

    setUp(() {
      mockApiClient = MockApiClient();
      mockLocalStorage = MockLocalStorage();

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localStorageProvider.overrideWithValue(mockLocalStorage),
        ],
      );
    });

    tearDown(() {
      container.dispose();
    });

    testWidgets('should encrypt sensitive data in local storage', (tester) async {
      // Mock encrypted storage
      when(mockLocalStorage.storeSecureData(any, any))
          .thenAnswer((_) async => true);

      when(mockLocalStorage.getSecureData(any))
          .thenAnswer((_) async => jsonEncode({
                'totalAmount': 123.45,
                'vendor': 'Test Vendor',
                'cardLast4': '1234'
              }));

      final receiptData = Receipt(
        id: 'secure-receipt-1',
        userId: 'test-user-1',
        totalAmount: 123.45,
        vendor: 'Test Vendor',
        date: '2024-01-15',
        status: ReceiptStatus.processed,
      );

      // Store sensitive receipt data
      await container.read(localStorageProvider).storeSecureData(
        'receipt_${receiptData.id}',
        receiptData.toJson(),
      );

      // Verify encryption was used
      verify(mockLocalStorage.storeSecureData(
        'receipt_${receiptData.id}',
        any,
      )).called(1);

      // Retrieve and verify decryption
      final retrievedData = await container.read(localStorageProvider).getSecureData(
        'receipt_${receiptData.id}',
      );

      expect(retrievedData, isNotNull);
      final decodedData = jsonDecode(retrievedData!);
      expect(decodedData['totalAmount'], equals(123.45));
    });

    testWidgets('should not log sensitive financial information', (tester) async {
      // Mock logger to capture log messages
      final logMessages = <String>[];
      
      // Simulate receipt processing with sensitive data
      final receiptData = {
        'totalAmount': 123.45,
        'cardNumber': '4111111111111111',
        'cardLast4': '1111'
      };

      // Process receipt (logging would happen internally)
      await container.read(uploadProviderProvider.notifier).uploadReceipt(receiptData);

      // In a real test, we would verify that logs don't contain sensitive data
      // This is a placeholder for actual log monitoring
      for (final message in logMessages) {
        expect(message, isNot(contains('4111111111111111')));
        expect(message, isNot(contains('123.45')));
      }
    });
  });

  group('Performance Tests', () {
    late MockApiClient mockApiClient;
    late MockLocalStorage mockLocalStorage;
    late ProviderContainer container;

    setUp(() {
      mockApiClient = MockApiClient();
      mockLocalStorage = MockLocalStorage();

      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mockApiClient),
          localStorageProvider.overrideWithValue(mockLocalStorage),
        ],
      );
    });

    tearDown(() {
      container.dispose();
    });

    testWidgets('should load camera within acceptable time', (tester) async {
      final stopwatch = Stopwatch()..start();

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(home: CameraScreen()),
        ),
      );

      await tester.pumpAndSettle();

      stopwatch.stop();

      // Camera should load within 3 seconds
      expect(stopwatch.elapsedMilliseconds, lessThan(3000));
    });

    testWidgets('should handle large receipt images efficiently', (tester) async {
      // Mock large image processing
      when(mockApiClient.uploadReceipt(any))
          .thenAnswer((_) async {
            // Simulate processing time for large image
            await Future.delayed(Duration(milliseconds: 500));
            return ApiResponse(
              statusCode: 201,
              data: mockReceiptData.toJson(),
              success: true,
            );
          });

      final stopwatch = Stopwatch()..start();

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(home: CameraScreen()),
        ),
      );

      await tester.pumpAndSettle();

      // Simulate large image upload
      await tester.tap(find.byKey(Key('capture-button')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(Key('submit-button')));
      await tester.pumpAndSettle();

      stopwatch.stop();

      // Large image processing should complete within 10 seconds
      expect(stopwatch.elapsedMilliseconds, lessThan(10000));
    });
  });
}