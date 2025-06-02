import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../storage/local_storage.dart';
import '../network/api_client.dart';

// Auth state model
class AuthState {
  final bool isAuthenticated;
  final String? token;
  final User? user;
  final bool isLoading;
  final String? error;

  const AuthState({
    this.isAuthenticated = false,
    this.token,
    this.user,
    this.isLoading = false,
    this.error,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    String? token,
    User? user,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      token: token ?? this.token,
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
    );
  }
}

// User model
class User {
  final String id;
  final String email;
  final String? name;
  final String? avatar;
  final String userType;
  final String? companyId;
  final Map<String, dynamic>? metadata;

  User({
    required this.id,
    required this.email,
    this.name,
    this.avatar,
    required this.userType,
    this.companyId,
    this.metadata,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      email: json['email'],
      name: json['name'],
      avatar: json['avatar'],
      userType: json['user_type'] ?? 'individual',
      companyId: json['company_id'],
      metadata: json['metadata'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'avatar': avatar,
      'user_type': userType,
      'company_id': companyId,
      'metadata': metadata,
    };
  }
}

// Auth service class
class AuthService extends StateNotifier<AuthState> {
  AuthService() : super(const AuthState()) {
    _loadStoredAuth();
  }

  static const _secureStorage = FlutterSecureStorage();
  final _apiClient = ApiClient();

  // Load stored authentication
  Future<void> _loadStoredAuth() async {
    state = state.copyWith(isLoading: true);
    
    try {
      final token = await _secureStorage.read(key: 'auth_token');
      final userJson = await LocalStorage.getString('user_data');
      
      if (token != null && userJson != null) {
        final userData = User.fromJson(
          Map<String, dynamic>.from(
            LocalStorage.decodeJson(userJson),
          ),
        );
        
        // Verify token is still valid
        final isValid = await _verifyToken(token);
        if (isValid) {
          state = state.copyWith(
            isAuthenticated: true,
            token: token,
            user: userData,
            isLoading: false,
          );
          return;
        }
      }
      
      // Clear invalid data
      await _clearAuthData();
      state = state.copyWith(isLoading: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to load authentication: $e',
      );
    }
  }

  // Login with email and password
  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    
    try {
      final response = await _apiClient.post('/auth/login', {
        'email': email,
        'password': password,
      });
      
      if (response.statusCode == 200) {
        final data = response.data;
        final token = data['token'];
        final user = User.fromJson(data['user']);
        
        // Store authentication data
        await _secureStorage.write(key: 'auth_token', value: token);
        await LocalStorage.setString('user_data', LocalStorage.encodeJson(user.toJson()));
        
        state = state.copyWith(
          isAuthenticated: true,
          token: token,
          user: user,
          isLoading: false,
        );
        
        return true;
      } else {
        state = state.copyWith(
          isLoading: false,
          error: response.data['message'] ?? 'Login failed',
        );
        return false;
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Login error: $e',
      );
      return false;
    }
  }

  // Register new user
  Future<bool> register(String email, String password, String? name) async {
    state = state.copyWith(isLoading: true, error: null);
    
    try {
      final response = await _apiClient.post('/auth/register', {
        'email': email,
        'password': password,
        'name': name,
      });
      
      if (response.statusCode == 201) {
        final data = response.data;
        final token = data['token'];
        final user = User.fromJson(data['user']);
        
        // Store authentication data
        await _secureStorage.write(key: 'auth_token', value: token);
        await LocalStorage.setString('user_data', LocalStorage.encodeJson(user.toJson()));
        
        state = state.copyWith(
          isAuthenticated: true,
          token: token,
          user: user,
          isLoading: false,
        );
        
        return true;
      } else {
        state = state.copyWith(
          isLoading: false,
          error: response.data['message'] ?? 'Registration failed',
        );
        return false;
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Registration error: $e',
      );
      return false;
    }
  }

  // Logout
  Future<void> logout() async {
    state = state.copyWith(isLoading: true);
    
    try {
      // Call logout endpoint if token exists
      if (state.token != null) {
        await _apiClient.post('/auth/logout', {});
      }
    } catch (e) {
      // Continue with logout even if API call fails
      print('Logout API error: $e');
    }
    
    // Clear local auth data
    await _clearAuthData();
    
    state = const AuthState();
  }

  // Reset password
  Future<bool> resetPassword(String email) async {
    state = state.copyWith(isLoading: true, error: null);
    
    try {
      final response = await _apiClient.post('/auth/reset-password', {
        'email': email,
      });
      
      if (response.statusCode == 200) {
        state = state.copyWith(isLoading: false);
        return true;
      } else {
        state = state.copyWith(
          isLoading: false,
          error: response.data['message'] ?? 'Password reset failed',
        );
        return false;
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Password reset error: $e',
      );
      return false;
    }
  }

  // Verify if token is still valid
  Future<bool> _verifyToken(String token) async {
    try {
      final response = await _apiClient.get(
        '/auth/verify',
        headers: {'Authorization': 'Bearer $token'},
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  // Clear authentication data
  Future<void> _clearAuthData() async {
    await _secureStorage.delete(key: 'auth_token');
    await LocalStorage.remove('user_data');
  }

  // Clear error
  void clearError() {
    state = state.copyWith(error: null);
  }

  // Update user profile
  Future<bool> updateProfile(Map<String, dynamic> updates) async {
    if (!state.isAuthenticated || state.user == null) return false;
    
    state = state.copyWith(isLoading: true, error: null);
    
    try {
      final response = await _apiClient.put('/auth/profile', updates);
      
      if (response.statusCode == 200) {
        final updatedUser = User.fromJson(response.data['user']);
        await LocalStorage.setString('user_data', LocalStorage.encodeJson(updatedUser.toJson()));
        
        state = state.copyWith(
          user: updatedUser,
          isLoading: false,
        );
        
        return true;
      } else {
        state = state.copyWith(
          isLoading: false,
          error: response.data['message'] ?? 'Profile update failed',
        );
        return false;
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Profile update error: $e',
      );
      return false;
    }
  }
}

// Provider instances
final authProvider = StateNotifierProvider<AuthService, AuthState>(
  (ref) => AuthService(),
);

// Helper providers
final currentUserProvider = Provider<User?>((ref) {
  return ref.watch(authProvider).user;
});

final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(authProvider).isAuthenticated;
});

final authTokenProvider = Provider<String?>((ref) {
  return ref.watch(authProvider).token;
});