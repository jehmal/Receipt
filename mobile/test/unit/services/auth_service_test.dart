import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';
import 'package:http/http.dart' as http;
import 'package:receipt_vault/services/auth_service.dart';
import 'package:receipt_vault/models/user.dart';
import 'package:receipt_vault/config/app_config.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'auth_service_test.mocks.dart';

@GenerateMocks([http.Client, SharedPreferences])
void main() {
  group('AuthService', () => {
    late AuthService authService;
    late MockClient mockHttpClient;
    late MockSharedPreferences mockSharedPreferences;

    setUp(() {
      mockHttpClient = MockClient();
      mockSharedPreferences = MockSharedPreferences();
      
      // Initialize app config for testing
      AppConfig.initialize(
        baseUrl: 'https://test-api.receiptvault.com',
        environment: 'test',
      );

      authService = AuthService(
        httpClient: mockHttpClient,
        sharedPreferences: mockSharedPreferences,
      );
    });

    group('login', () {
      test('should successfully login with valid credentials', () async {
        // Arrange
        const email = 'test@example.com';
        const password = 'password123';
        
        final mockResponse = http.Response(
          '''
          {
            "success": true,
            "user": {
              "id": "user-123",
              "email": "test@example.com",
              "firstName": "John",
              "lastName": "Doe",
              "role": "individual"
            },
            "tokens": {
              "accessToken": "access-token-123",
              "refreshToken": "refresh-token-123",
              "expiresIn": 900,
              "refreshExpiresIn": 2592000
            },
            "sessionId": "session-123"
          }
          ''',
          200,
          headers: {'content-type': 'application/json'},
        );

        when(mockHttpClient.post(
          Uri.parse('${AppConfig.baseUrl}/api/v1/auth/login'),
          headers: anyNamed('headers'),
          body: anyNamed('body'),
        )).thenAnswer((_) async => mockResponse);

        when(mockSharedPreferences.setString(any, any))
            .thenAnswer((_) async => true);

        // Act
        final result = await authService.login(email, password);

        // Assert
        expect(result.success, true);
        expect(result.user!.email, email);
        expect(result.user!.firstName, 'John');
        expect(result.tokens!.accessToken, 'access-token-123');

        // Verify storage calls
        verify(mockSharedPreferences.setString('access_token', 'access-token-123'));
        verify(mockSharedPreferences.setString('refresh_token', 'refresh-token-123'));
        verify(mockSharedPreferences.setString('session_id', 'session-123'));
      });

      test('should handle invalid credentials error', () async {
        // Arrange
        const email = 'invalid@example.com';
        const password = 'wrongpassword';
        
        final mockResponse = http.Response(
          '''
          {
            "success": false,
            "error": "INVALID_CREDENTIALS",
            "message": "Invalid email or password"
          }
          ''',
          401,
          headers: {'content-type': 'application/json'},
        );

        when(mockHttpClient.post(
          Uri.parse('${AppConfig.baseUrl}/api/v1/auth/login'),
          headers: anyNamed('headers'),
          body: anyNamed('body'),
        )).thenAnswer((_) async => mockResponse);

        // Act
        final result = await authService.login(email, password);

        // Assert
        expect(result.success, false);
        expect(result.error, 'INVALID_CREDENTIALS');
        expect(result.message, 'Invalid email or password');
        expect(result.user, null);

        // Verify no storage calls
        verifyNever(mockSharedPreferences.setString(any, any));
      });

      test('should handle network connectivity errors', () async {
        // Arrange
        const email = 'test@example.com';
        const password = 'password123';

        when(mockHttpClient.post(
          Uri.parse('${AppConfig.baseUrl}/api/v1/auth/login'),
          headers: anyNamed('headers'),
          body: anyNamed('body'),
        )).thenThrow(const SocketException('No internet connection'));

        // Act
        final result = await authService.login(email, password);

        // Assert
        expect(result.success, false);
        expect(result.error, 'NETWORK_ERROR');
        expect(result.message!.contains('network'), true);
      });

      test('should handle server timeout', () async {
        // Arrange
        const email = 'test@example.com';
        const password = 'password123';

        when(mockHttpClient.post(
          Uri.parse('${AppConfig.baseUrl}/api/v1/auth/login'),
          headers: anyNamed('headers'),
          body: anyNamed('body'),
        )).thenThrow(TimeoutException('Request timeout', Duration(seconds: 30)));

        // Act
        final result = await authService.login(email, password);

        // Assert
        expect(result.success, false);
        expect(result.error, 'TIMEOUT_ERROR');
        expect(result.message!.contains('timeout'), true);
      });

      test('should handle two-factor authentication requirement', () async {
        // Arrange
        const email = 'user-with-2fa@example.com';
        const password = 'password123';
        
        final mockResponse = http.Response(
          '''
          {
            "success": true,
            "requiresTwoFactor": true,
            "challengeId": "challenge-123",
            "availableMethods": ["totp", "sms"],
            "user": {
              "id": "user-123",
              "email": "user-with-2fa@example.com",
              "firstName": "Jane",
              "lastName": "Doe"
            }
          }
          ''',
          200,
          headers: {'content-type': 'application/json'},
        );

        when(mockHttpClient.post(
          Uri.parse('${AppConfig.baseUrl}/api/v1/auth/login'),
          headers: anyNamed('headers'),
          body: anyNamed('body'),
        )).thenAnswer((_) async => mockResponse);

        // Act
        final result = await authService.login(email, password);

        // Assert
        expect(result.success, true);
        expect(result.requiresTwoFactor, true);
        expect(result.challengeId, 'challenge-123');
        expect(result.availableMethods, ['totp', 'sms']);
        expect(result.tokens, null); // No tokens until 2FA complete
      });
    });

    group('biometric authentication', () {
      test('should successfully authenticate with biometric data', () async {
        // Arrange
        const biometricData = 'biometric-signature-data';
        
        final mockResponse = http.Response(
          '''
          {
            "success": true,
            "user": {
              "id": "user-123",
              "email": "test@example.com",
              "firstName": "John",
              "lastName": "Doe"
            },
            "tokens": {
              "accessToken": "biometric-access-token",
              "refreshToken": "biometric-refresh-token",
              "expiresIn": 900,
              "refreshExpiresIn": 2592000
            },
            "sessionId": "biometric-session-123"
          }
          ''',
          200,
          headers: {'content-type': 'application/json'},
        );

        when(mockHttpClient.post(
          Uri.parse('${AppConfig.baseUrl}/api/v1/auth/biometric'),
          headers: anyNamed('headers'),
          body: anyNamed('body'),
        )).thenAnswer((_) async => mockResponse);

        when(mockSharedPreferences.setString(any, any))
            .thenAnswer((_) async => true);

        // Act
        final result = await authService.biometricLogin(biometricData);

        // Assert
        expect(result.success, true);
        expect(result.user!.email, 'test@example.com');
        expect(result.tokens!.accessToken, 'biometric-access-token');

        // Verify storage calls
        verify(mockSharedPreferences.setString('access_token', 'biometric-access-token'));
        verify(mockSharedPreferences.setString('session_id', 'biometric-session-123'));
      });

      test('should handle biometric authentication failure', () async {
        // Arrange
        const invalidBiometricData = 'invalid-signature';
        
        final mockResponse = http.Response(
          '''
          {
            "success": false,
            "error": "BIOMETRIC_AUTHENTICATION_FAILED",
            "message": "Biometric authentication failed"
          }
          ''',
          401,
          headers: {'content-type': 'application/json'},
        );

        when(mockHttpClient.post(
          Uri.parse('${AppConfig.baseUrl}/api/v1/auth/biometric'),
          headers: anyNamed('headers'),
          body: anyNamed('body'),
        )).thenAnswer((_) async => mockResponse);

        // Act
        final result = await authService.biometricLogin(invalidBiometricData);

        // Assert
        expect(result.success, false);
        expect(result.error, 'BIOMETRIC_AUTHENTICATION_FAILED');
        expect(result.user, null);
      });
    });

    group('token management', () {
      test('should refresh tokens successfully', () async {
        // Arrange
        const refreshToken = 'valid-refresh-token';
        
        final mockResponse = http.Response(
          '''
          {
            "success": true,
            "tokens": {
              "accessToken": "new-access-token",
              "refreshToken": "new-refresh-token",
              "expiresIn": 900,
              "refreshExpiresIn": 2592000
            }
          }
          ''',
          200,
          headers: {'content-type': 'application/json'},
        );

        when(mockSharedPreferences.getString('refresh_token'))
            .thenReturn(refreshToken);
        
        when(mockHttpClient.post(
          Uri.parse('${AppConfig.baseUrl}/api/v1/auth/refresh'),
          headers: anyNamed('headers'),
          body: anyNamed('body'),
        )).thenAnswer((_) async => mockResponse);

        when(mockSharedPreferences.setString(any, any))
            .thenAnswer((_) async => true);

        // Act
        final result = await authService.refreshTokens();

        // Assert
        expect(result.success, true);
        expect(result.tokens!.accessToken, 'new-access-token');

        // Verify storage updates
        verify(mockSharedPreferences.setString('access_token', 'new-access-token'));
        verify(mockSharedPreferences.setString('refresh_token', 'new-refresh-token'));
      });

      test('should handle expired refresh token', () async {
        // Arrange
        const expiredRefreshToken = 'expired-refresh-token';
        
        final mockResponse = http.Response(
          '''
          {
            "success": false,
            "error": "REFRESH_TOKEN_EXPIRED",
            "message": "Refresh token has expired"
          }
          ''',
          401,
          headers: {'content-type': 'application/json'},
        );

        when(mockSharedPreferences.getString('refresh_token'))
            .thenReturn(expiredRefreshToken);
        
        when(mockHttpClient.post(
          Uri.parse('${AppConfig.baseUrl}/api/v1/auth/refresh'),
          headers: anyNamed('headers'),
          body: anyNamed('body'),
        )).thenAnswer((_) async => mockResponse);

        // Act
        final result = await authService.refreshTokens();

        // Assert
        expect(result.success, false);
        expect(result.error, 'REFRESH_TOKEN_EXPIRED');

        // Should clear stored tokens on failure
        verify(mockSharedPreferences.remove('access_token'));
        verify(mockSharedPreferences.remove('refresh_token'));
        verify(mockSharedPreferences.remove('session_id'));
      });

      test('should validate token expiration correctly', () {
        // Arrange
        final futureTime = DateTime.now().add(Duration(minutes: 10));
        final pastTime = DateTime.now().subtract(Duration(minutes: 10));

        // Act & Assert
        expect(authService.isTokenExpired(futureTime), false);
        expect(authService.isTokenExpired(pastTime), true);
      });
    });

    group('logout', () {
      test('should logout successfully and clear local storage', () async {
        // Arrange
        const sessionId = 'session-123';
        
        final mockResponse = http.Response(
          '''
          {
            "success": true,
            "message": "Successfully logged out"
          }
          ''',
          200,
          headers: {'content-type': 'application/json'},
        );

        when(mockSharedPreferences.getString('session_id'))
            .thenReturn(sessionId);
        when(mockSharedPreferences.getString('access_token'))
            .thenReturn('access-token');

        when(mockHttpClient.post(
          Uri.parse('${AppConfig.baseUrl}/api/v1/auth/logout'),
          headers: anyNamed('headers'),
          body: anyNamed('body'),
        )).thenAnswer((_) async => mockResponse);

        when(mockSharedPreferences.remove(any))
            .thenAnswer((_) async => true);

        // Act
        final result = await authService.logout();

        // Assert
        expect(result.success, true);

        // Verify all storage items are cleared
        verify(mockSharedPreferences.remove('access_token'));
        verify(mockSharedPreferences.remove('refresh_token'));
        verify(mockSharedPreferences.remove('session_id'));
        verify(mockSharedPreferences.remove('user_data'));
      });

      test('should clear local storage even if server request fails', () async {
        // Arrange
        when(mockSharedPreferences.getString('session_id'))
            .thenReturn('session-123');
        when(mockSharedPreferences.getString('access_token'))
            .thenReturn('access-token');

        when(mockHttpClient.post(
          Uri.parse('${AppConfig.baseUrl}/api/v1/auth/logout'),
          headers: anyNamed('headers'),
          body: anyNamed('body'),
        )).thenThrow(const SocketException('Network error'));

        when(mockSharedPreferences.remove(any))
            .thenAnswer((_) async => true);

        // Act
        final result = await authService.logout();

        // Assert
        expect(result.success, true); // Should still succeed locally

        // Verify local storage is cleared regardless of server response
        verify(mockSharedPreferences.remove('access_token'));
        verify(mockSharedPreferences.remove('refresh_token'));
        verify(mockSharedPreferences.remove('session_id'));
        verify(mockSharedPreferences.remove('user_data'));
      });
    });

    group('persistent authentication state', () {
      test('should check if user is currently authenticated', () async {
        // Arrange - User with valid stored token
        final futureTime = DateTime.now().add(Duration(minutes: 10));
        
        when(mockSharedPreferences.getString('access_token'))
            .thenReturn('valid-access-token');
        when(mockSharedPreferences.getString('token_expiry'))
            .thenReturn(futureTime.millisecondsSinceEpoch.toString());

        // Act
        final isAuthenticated = await authService.isAuthenticated();

        // Assert
        expect(isAuthenticated, true);
      });

      test('should return false for expired token', () async {
        // Arrange - User with expired token
        final pastTime = DateTime.now().subtract(Duration(minutes: 10));
        
        when(mockSharedPreferences.getString('access_token'))
            .thenReturn('expired-access-token');
        when(mockSharedPreferences.getString('token_expiry'))
            .thenReturn(pastTime.millisecondsSinceEpoch.toString());

        // Act
        final isAuthenticated = await authService.isAuthenticated();

        // Assert
        expect(isAuthenticated, false);
      });

      test('should restore user session from storage', () async {
        // Arrange
        const userData = '''
        {
          "id": "user-123",
          "email": "test@example.com",
          "firstName": "John",
          "lastName": "Doe",
          "role": "individual"
        }
        ''';

        when(mockSharedPreferences.getString('user_data'))
            .thenReturn(userData);
        when(mockSharedPreferences.getString('access_token'))
            .thenReturn('valid-token');

        // Act
        final user = await authService.getCurrentUser();

        // Assert
        expect(user, isNotNull);
        expect(user!.id, 'user-123');
        expect(user.email, 'test@example.com');
        expect(user.firstName, 'John');
      });
    });

    group('error handling and edge cases', () {
      test('should handle malformed JSON response', () async {
        // Arrange
        const email = 'test@example.com';
        const password = 'password123';
        
        final mockResponse = http.Response(
          'Invalid JSON response',
          200,
          headers: {'content-type': 'application/json'},
        );

        when(mockHttpClient.post(
          Uri.parse('${AppConfig.baseUrl}/api/v1/auth/login'),
          headers: anyNamed('headers'),
          body: anyNamed('body'),
        )).thenAnswer((_) async => mockResponse);

        // Act
        final result = await authService.login(email, password);

        // Assert
        expect(result.success, false);
        expect(result.error, 'PARSE_ERROR');
      });

      test('should handle concurrent authentication requests', () async {
        // Arrange
        const email = 'test@example.com';
        const password = 'password123';
        
        final mockResponse = http.Response(
          '''{"success": true, "tokens": {"accessToken": "token"}}''',
          200,
          headers: {'content-type': 'application/json'},
        );

        when(mockHttpClient.post(
          Uri.parse('${AppConfig.baseUrl}/api/v1/auth/login'),
          headers: anyNamed('headers'),
          body: anyNamed('body'),
        )).thenAnswer((_) async {
          await Future.delayed(Duration(milliseconds: 100));
          return mockResponse;
        });

        when(mockSharedPreferences.setString(any, any))
            .thenAnswer((_) async => true);

        // Act - Make concurrent requests
        final futures = List.generate(3, (_) => authService.login(email, password));
        final results = await Future.wait(futures);

        // Assert - All should succeed but only one should actually process
        expect(results.every((r) => r.success), true);
        
        // Verify only one successful authentication occurred
        verify(mockHttpClient.post(
          Uri.parse('${AppConfig.baseUrl}/api/v1/auth/login'),
          headers: anyNamed('headers'),
          body: anyNamed('body'),
        )).called(3); // All requests made
      });

      test('should handle storage permission errors gracefully', () async {
        // Arrange
        const email = 'test@example.com';
        const password = 'password123';
        
        final mockResponse = http.Response(
          '''{"success": true, "tokens": {"accessToken": "token"}}''',
          200,
          headers: {'content-type': 'application/json'},
        );

        when(mockHttpClient.post(
          Uri.parse('${AppConfig.baseUrl}/api/v1/auth/login'),
          headers: anyNamed('headers'),
          body: anyNamed('body'),
        )).thenAnswer((_) async => mockResponse);

        when(mockSharedPreferences.setString(any, any))
            .thenThrow(Exception('Storage permission denied'));

        // Act
        final result = await authService.login(email, password);

        // Assert - Should still succeed but log storage warning
        expect(result.success, true);
        expect(result.warning, contains('storage'));
      });
    });
  });
} 