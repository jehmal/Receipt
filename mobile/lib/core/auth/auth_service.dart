import 'dart:convert';
import 'package:flutter/foundation.dart';

import '../network/api_client.dart';
import '../network/api_exception.dart';
import '../storage/local_storage.dart';
import '../network/device_info_service.dart';
import '../../shared/models/user.dart';

class AuthService {
  final ApiClient _apiClient = ApiClient.instance;
  static AuthService? _instance;

  AuthService._internal();

  static AuthService get instance {
    _instance ??= AuthService._internal();
    return _instance!;
  }

  // Check if user is authenticated
  bool get isAuthenticated {
    final token = LocalStorage.getSetting<String>('access_token');
    return token != null && token.isNotEmpty;
  }

  // Get current user
  User? get currentUser {
    final userData = LocalStorage.getSetting<String>('user_data');
    if (userData != null) {
      try {
        final userMap = json.decode(userData) as Map<String, dynamic>;
        return User.fromJson(userMap);
      } catch (e) {
        debugPrint('Error parsing user data: $e');
      }
    }
    return null;
  }

  // Get access token
  String? get accessToken {
    return LocalStorage.getSetting<String>('access_token');
  }

  // Register new user
  Future<AuthResult> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? phone,
    String? companyName,
  }) async {
    try {
      final deviceInfo = await DeviceInfoService.getDeviceInfo();
      
      final response = await _apiClient.post(
        '/auth/register',
        {
          'email': email,
          'password': password,
          'firstName': firstName,
          'lastName': lastName,
          if (phone != null) 'phone': phone,
          if (companyName != null) 'companyName': companyName,
          'deviceInfo': deviceInfo,
        },
      );

      if (response.statusCode == 201) {
        final data = response.data['data'];
        await _saveAuthData(data);
        
        return AuthResult(
          success: true,
          user: User.fromJson(data['user']),
          message: response.data['message'],
        );
      }

      throw ApiException(
        message: response.data['message'] ?? 'Registration failed',
        statusCode: response.statusCode ?? 400,
        type: ApiExceptionType.badRequest,
      );
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException(
        message: 'Registration failed: $e',
        statusCode: 0,
        type: ApiExceptionType.unknown,
      );
    }
  }

  // Login user
  Future<AuthResult> login({
    required String email,
    required String password,
  }) async {
    try {
      final deviceInfo = await DeviceInfoService.getDeviceInfo();
      
      final response = await _apiClient.post(
        '/auth/login',
        {
          'email': email,
          'password': password,
          'deviceInfo': deviceInfo,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data['data'];
        await _saveAuthData(data);
        
        return AuthResult(
          success: true,
          user: User.fromJson(data['user']),
          message: response.data['message'],
        );
      }

      throw ApiException(
        message: response.data['message'] ?? 'Login failed',
        statusCode: response.statusCode ?? 401,
        type: ApiExceptionType.unauthorized,
      );
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException(
        message: 'Login failed: $e',
        statusCode: 0,
        type: ApiExceptionType.unknown,
      );
    }
  }

  // Logout user
  Future<void> logout({bool allDevices = false}) async {
    try {
      await _apiClient.post(
        '/auth/logout',
        {'allDevices': allDevices},
      );
    } catch (e) {
      debugPrint('Logout API call failed: $e');
      // Continue with local logout even if API call fails
    }

    await _clearAuthData();
  }

  // Refresh token
  Future<bool> refreshToken() async {
    try {
      final refreshToken = LocalStorage.getSetting<String>('refresh_token');
      if (refreshToken == null || refreshToken.isEmpty) {
        return false;
      }

      final deviceInfo = await DeviceInfoService.getDeviceInfo();
      
      final response = await _apiClient.post(
        '/auth/refresh',
        {
          'refreshToken': refreshToken,
          'deviceInfo': deviceInfo,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data['data'];
        await LocalStorage.saveSetting('access_token', data['accessToken']);
        await LocalStorage.saveSetting('refresh_token', data['refreshToken']);
        await LocalStorage.saveSetting('expires_in', data['expiresIn']);
        return true;
      }
    } catch (e) {
      debugPrint('Token refresh failed: $e');
    }
    
    return false;
  }

  // Get current user from server
  Future<User?> getCurrentUser() async {
    try {
      final response = await _apiClient.get('/auth/me');
      
      if (response.statusCode == 200) {
        final userData = response.data['data']['user'];
        final user = User.fromJson(userData);
        
        // Update local storage
        await LocalStorage.saveSetting('user_data', json.encode(user.toJson()));
        
        return user;
      }
    } catch (e) {
      debugPrint('Failed to get current user: $e');
    }
    
    return null;
  }

  // Get user sessions
  Future<List<UserSession>> getUserSessions() async {
    try {
      final response = await _apiClient.get('/auth/sessions');
      
      if (response.statusCode == 200) {
        final sessionsData = response.data['data']['sessions'] as List;
        return sessionsData.map((s) => UserSession.fromJson(s)).toList();
      }
    } catch (e) {
      debugPrint('Failed to get user sessions: $e');
    }
    
    return [];
  }

  // Revoke specific session
  Future<bool> revokeSession(String sessionId) async {
    try {
      final response = await _apiClient.delete('/auth/sessions/$sessionId');
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Failed to revoke session: $e');
      return false;
    }
  }

  // Change password
  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      final response = await _apiClient.post(
        '/auth/change-password',
        {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
        },
      );
      
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Failed to change password: $e');
      return false;
    }
  }

  // Save authentication data to local storage
  Future<void> _saveAuthData(Map<String, dynamic> data) async {
    await LocalStorage.saveSetting('access_token', data['accessToken']);
    await LocalStorage.saveSetting('refresh_token', data['refreshToken']);
    await LocalStorage.saveSetting('expires_in', data['expiresIn']);
    await LocalStorage.saveSetting('device_id', data['deviceId']);
    await LocalStorage.saveSetting('user_data', json.encode(data['user']));
  }

  // Clear authentication data from local storage
  Future<void> _clearAuthData() async {
    await LocalStorage.saveSetting('access_token', null);
    await LocalStorage.saveSetting('refresh_token', null);
    await LocalStorage.saveSetting('expires_in', null);
    await LocalStorage.saveSetting('device_id', null);
    await LocalStorage.saveSetting('user_data', null);
  }
}

class AuthResult {
  final bool success;
  final User? user;
  final String message;
  final ApiException? error;

  AuthResult({
    required this.success,
    this.user,
    required this.message,
    this.error,
  });

  factory AuthResult.error(ApiException error) {
    return AuthResult(
      success: false,
      message: error.message,
      error: error,
    );
  }
}

class UserSession {
  final String id;
  final String deviceName;
  final String deviceType;
  final String ipAddress;
  final DateTime lastActivity;
  final bool isCurrent;

  UserSession({
    required this.id,
    required this.deviceName,
    required this.deviceType,
    required this.ipAddress,
    required this.lastActivity,
    required this.isCurrent,
  });

  factory UserSession.fromJson(Map<String, dynamic> json) {
    return UserSession(
      id: json['id'],
      deviceName: json['deviceName'] ?? 'Unknown Device',
      deviceType: json['deviceType'] ?? 'Unknown',
      ipAddress: json['ipAddress'] ?? 'Unknown',
      lastActivity: DateTime.parse(json['lastActivity']),
      isCurrent: json['isCurrent'] ?? false,
    );
  }
}