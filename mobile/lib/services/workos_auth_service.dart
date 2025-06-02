import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/foundation.dart';

class WorkOSUser {
  final String id;
  final String email;
  final String? firstName;
  final String? lastName;
  final bool emailVerified;
  final String? profilePictureUrl;

  WorkOSUser({
    required this.id,
    required this.email,
    this.firstName,
    this.lastName,
    required this.emailVerified,
    this.profilePictureUrl,
  });

  factory WorkOSUser.fromJson(Map<String, dynamic> json) {
    return WorkOSUser(
      id: json['id'],
      email: json['email'],
      firstName: json['firstName'],
      lastName: json['lastName'],
      emailVerified: json['emailVerified'] ?? false,
      profilePictureUrl: json['profilePictureUrl'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'firstName': firstName,
      'lastName': lastName,
      'emailVerified': emailVerified,
      'profilePictureUrl': profilePictureUrl,
    };
  }
}

class WorkOSAuthService {
  static const String _userKey = 'workos_user';
  static const String _tokenKey = 'workos_token';
  
  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );
  
  final Dio _dio;
  final String baseUrl;

  WorkOSAuthService({
    required this.baseUrl,
    Dio? dio,
  }) : _dio = dio ?? Dio() {
    _dio.options.baseUrl = baseUrl;
    _dio.options.connectTimeout = const Duration(seconds: 30);
    _dio.options.receiveTimeout = const Duration(seconds: 30);
    
    // Add interceptor to automatically include session cookie
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        // The session cookie will be handled by the browser/webview
        // For API calls, we can add any additional headers here
        options.headers['Content-Type'] = 'application/json';
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // Clear stored user data on authentication error
          await clearUserData();
        }
        handler.next(error);
      },
    ));
  }

  /// Check if user is currently authenticated
  Future<bool> isAuthenticated() async {
    try {
      final user = await getCurrentUser();
      return user != null;
    } catch (e) {
      return false;
    }
  }

  /// Get current user from secure storage
  Future<WorkOSUser?> getCurrentUser() async {
    try {
      final userJson = await _storage.read(key: _userKey);
      if (userJson != null) {
        return WorkOSUser.fromJson(json.decode(userJson));
      }
      return null;
    } catch (e) {
      debugPrint('Error getting current user: $e');
      return null;
    }
  }

  /// Save user data to secure storage
  Future<void> saveUserData(WorkOSUser user, {String? token}) async {
    try {
      await _storage.write(key: _userKey, value: json.encode(user.toJson()));
      if (token != null) {
        await _storage.write(key: _tokenKey, value: token);
      }
    } catch (e) {
      debugPrint('Error saving user data: $e');
      throw Exception('Failed to save user data');
    }
  }

  /// Clear all stored user data
  Future<void> clearUserData() async {
    try {
      await _storage.delete(key: _userKey);
      await _storage.delete(key: _tokenKey);
    } catch (e) {
      debugPrint('Error clearing user data: $e');
    }
  }

  /// Get the WorkOS login URL for webview
  String getLoginUrl() {
    return '$baseUrl/auth/login';
  }

  /// Handle callback after successful authentication
  /// This should be called after the webview redirects to /dashboard
  Future<WorkOSUser?> handleAuthSuccess() async {
    try {
      // Make an authenticated request to get user info
      final response = await _dio.get('/auth/me');
      
      if (response.statusCode == 200) {
        final userData = response.data['user'];
        final user = WorkOSUser.fromJson(userData);
        
        // Save user data locally
        await saveUserData(user);
        
        return user;
      }
      return null;
    } catch (e) {
      debugPrint('Error handling auth success: $e');
      return null;
    }
  }

  /// Logout user
  Future<bool> logout() async {
    try {
      // Call logout endpoint
      await _dio.post('/auth/logout');
      
      // Clear local data
      await clearUserData();
      
      return true;
    } catch (e) {
      debugPrint('Error during logout: $e');
      // Clear local data even if API call fails
      await clearUserData();
      return false;
    }
  }

  /// Get user receipts (authenticated request)
  Future<Map<String, dynamic>?> getUserReceipts() async {
    try {
      final response = await _dio.get('/api/receipts');
      return response.data;
    } catch (e) {
      debugPrint('Error getting receipts: $e');
      return null;
    }
  }

  /// Get user analytics (authenticated request)
  Future<Map<String, dynamic>?> getUserAnalytics() async {
    try {
      final response = await _dio.get('/api/analytics');
      return response.data;
    } catch (e) {
      debugPrint('Error getting analytics: $e');
      return null;
    }
  }

  /// Create new receipt (authenticated request)
  Future<Map<String, dynamic>?> createReceipt({
    required String vendorName,
    required double totalAmount,
    required String category,
    String? receiptDate,
  }) async {
    try {
      final response = await _dio.post('/api/receipts', data: {
        'vendorName': vendorName,
        'totalAmount': totalAmount,
        'category': category,
        'receiptDate': receiptDate,
      });
      
      if (response.statusCode == 201) {
        return response.data;
      }
      return null;
    } catch (e) {
      debugPrint('Error creating receipt: $e');
      return null;
    }
  }

  /// Test API connection
  Future<bool> testConnection() async {
    try {
      final response = await _dio.get('/health');
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Connection test failed: $e');
      return false;
    }
  }
} 