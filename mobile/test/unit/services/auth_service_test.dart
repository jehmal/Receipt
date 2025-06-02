import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:receipt_vault/core/auth/auth_service.dart';
import 'package:receipt_vault/shared/models/user.dart';
import 'package:receipt_vault/core/config/app_config.dart';

void main() {
  group('AuthService', () {
    late AuthService authService;

    setUp(() {
      // Initialize shared preferences for testing
      SharedPreferences.setMockInitialValues({});
      
      // Get singleton instance
      authService = AuthService.instance;
    });

    group('Authentication State', () {
      test('should return false for isAuthenticated when no token exists', () {
        // Initially no token should be stored
        expect(authService.isAuthenticated, false);
      });

      test('should return null for currentUser when no user data exists', () {
        // Initially no user data should be stored
        expect(authService.currentUser, null);
      });

      test('should return null for accessToken when no token exists', () {
        // Initially no access token should be stored
        expect(authService.accessToken, null);
      });
    });

    group('Singleton Pattern', () {
      test('should return same instance when accessing singleton', () {
        final instance1 = AuthService.instance;
        final instance2 = AuthService.instance;
        
        expect(identical(instance1, instance2), true);
      });
    });

    // Note: More comprehensive tests would require mocking the API client
    // and testing actual login/logout functionality, but this requires
    // more complex setup that's beyond the scope of basic compilation fixes
  });
}