import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:receipt_vault/shared/models/receipt.dart';

void main() {
  group('Receipt Processing Integration Tests', () {
    late Receipt mockReceiptData;

    setUp(() {
      SharedPreferences.setMockInitialValues({});
      mockReceiptData = Receipt(
        id: 'test-receipt-1',
        userId: 'test-user-1',
        totalAmount: 123.45,
        vendorName: 'Test Vendor',
        receiptDate: DateTime.parse('2024-01-15'),
        status: 'processed',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
    });

    test('should create receipt with required fields', () {
      expect(mockReceiptData.id, 'test-receipt-1');
      expect(mockReceiptData.userId, 'test-user-1');
      expect(mockReceiptData.status, 'processed');
      expect(mockReceiptData.vendorName, 'Test Vendor');
      expect(mockReceiptData.totalAmount, 123.45);
    });

    test('should handle receipt date correctly', () {
      expect(mockReceiptData.receiptDate, isA<DateTime>());
      expect(mockReceiptData.receiptDate!.year, 2024);
      expect(mockReceiptData.receiptDate!.month, 1);
      expect(mockReceiptData.receiptDate!.day, 15);
    });

    test('should create receipt with timestamps', () {
      expect(mockReceiptData.createdAt, isA<DateTime>());
      expect(mockReceiptData.updatedAt, isA<DateTime>());
    });

    test('should handle optional fields correctly', () {
      final minimalReceipt = Receipt(
        id: 'minimal-receipt',
        userId: 'user-123',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      expect(minimalReceipt.id, 'minimal-receipt');
      expect(minimalReceipt.userId, 'user-123');
      expect(minimalReceipt.status, 'uploaded'); // default value
      expect(minimalReceipt.currency, 'USD'); // default value
      expect(minimalReceipt.tags, isEmpty); // default empty list
      expect(minimalReceipt.isSynced, false); // default false
    });

    test('should handle copyWith method', () {
      final updatedReceipt = mockReceiptData.copyWith(
        status: 'completed',
        totalAmount: 200.00,
      );

      expect(updatedReceipt.id, mockReceiptData.id);
      expect(updatedReceipt.userId, mockReceiptData.userId);
      expect(updatedReceipt.status, 'completed');
      expect(updatedReceipt.totalAmount, 200.00);
      expect(updatedReceipt.vendorName, mockReceiptData.vendorName);
    });

    test('should handle computed properties', () {
      expect(mockReceiptData.vendor, mockReceiptData.vendorName);
      expect(mockReceiptData.amount, mockReceiptData.totalAmount);
      expect(mockReceiptData.date, mockReceiptData.receiptDate);
      expect(mockReceiptData.isProcessed, true);
    });
  });
}