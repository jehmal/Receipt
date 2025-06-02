import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/app_config.dart';
import '../storage/local_storage.dart';

class WorkOSAuthService {
  // Use the centralized auth base URL configuration
  static String get authBaseUrl => AppConfig.authBaseUrl;
  
  static WorkOSAuthService? _instance;
  
  WorkOSAuthService._internal();
  
  static WorkOSAuthService get instance {
    _instance ??= WorkOSAuthService._internal();
    return _instance!;
  }
  
  // Check if user is authenticated by calling the backend
  Future<bool> isAuthenticated() async {
    try {
      final response = await http.get(
        Uri.parse('$authBaseUrl/auth/me'),
        headers: {'Content-Type': 'application/json'},
      );
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        await _saveUserData(data);
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Auth check failed: $e');
      return false;
    }
  }
  
  // Get current user data from local storage
  Map<String, dynamic>? get currentUser {
    final userData = LocalStorage.getSetting<String>('workos_user_data');
    if (userData != null && userData.isNotEmpty) {
      try {
        return json.decode(userData) as Map<String, dynamic>;
      } catch (e) {
        debugPrint('Error parsing user data: $e');
      }
    }
    return null;
  }
  
  // Launch WorkOS login in browser
  Future<bool> login() async {
    try {
      final loginUrl = Uri.parse('$authBaseUrl/auth/login');
      
      if (await canLaunchUrl(loginUrl)) {
        await launchUrl(
          loginUrl,
          mode: LaunchMode.externalApplication,
        );
        return true;
      } else {
        debugPrint('Could not launch login URL');
        return false;
      }
    } catch (e) {
      debugPrint('Login failed: $e');
      return false;
    }
  }
  
  // Logout user
  Future<bool> logout() async {
    try {
      final response = await http.post(
        Uri.parse('$authBaseUrl/auth/logout'),
        headers: {'Content-Type': 'application/json'},
      );
      
      await _clearUserData();
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Logout failed: $e');
      await _clearUserData(); // Clear local data even if API call fails
      return false;
    }
  }
  
  // Get receipts for authenticated user
  Future<Map<String, dynamic>?> getReceipts() async {
    try {
      final response = await http.get(
        Uri.parse('$authBaseUrl/api/receipts'),
        headers: {'Content-Type': 'application/json'},
      );
      
      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else if (response.statusCode == 401) {
        await _clearUserData();
      }
      return null;
    } catch (e) {
      debugPrint('Failed to get receipts: $e');
      return null;
    }
  }
  
  // Get analytics for authenticated user
  Future<Map<String, dynamic>?> getAnalytics() async {
    try {
      final response = await http.get(
        Uri.parse('$authBaseUrl/api/analytics'),
        headers: {'Content-Type': 'application/json'},
      );
      
      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else if (response.statusCode == 401) {
        await _clearUserData();
      }
      return null;
    } catch (e) {
      debugPrint('Failed to get analytics: $e');
      return null;
    }
  }
  
  // Create new receipt
  Future<Map<String, dynamic>?> createReceipt({
    required String vendorName,
    required double totalAmount,
    required String category,
    String? receiptDate,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$authBaseUrl/api/receipts'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'vendorName': vendorName,
          'totalAmount': totalAmount,
          'category': category,
          'receiptDate': receiptDate ?? DateTime.now().toIso8601String().split('T')[0],
        }),
      );
      
      if (response.statusCode == 201) {
        return json.decode(response.body);
      } else if (response.statusCode == 401) {
        await _clearUserData();
      }
      return null;
    } catch (e) {
      debugPrint('Failed to create receipt: $e');
      return null;
    }
  }
  
  // Check API health
  Future<Map<String, dynamic>?> checkHealth() async {
    try {
      final response = await http.get(
        Uri.parse('$authBaseUrl/health'),
        headers: {'Content-Type': 'application/json'},
      );
      
      if (response.statusCode == 200) {
        return json.decode(response.body);
      }
      return null;
    } catch (e) {
      debugPrint('Health check failed: $e');
      return null;
    }
  }
  
  // Save user data to local storage
  Future<void> _saveUserData(Map<String, dynamic> data) async {
    await LocalStorage.saveSetting('workos_user_data', json.encode(data));
    await LocalStorage.saveSetting('workos_authenticated', true);
  }
  
  // Clear user data from local storage
  Future<void> _clearUserData() async {
    await LocalStorage.saveSetting('workos_user_data', null);
    await LocalStorage.saveSetting('workos_authenticated', false);
  }
  
  // Get authentication status from local storage
  bool get isAuthenticatedLocally {
    return LocalStorage.getSetting<bool>('workos_authenticated') ?? false;
  }
}