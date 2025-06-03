import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../shared/models/user.dart';
import 'auth_service.dart';
import '../network/api_exception.dart';
import '../storage/local_storage.dart';

part 'enhanced_auth_provider.g.dart';

enum UserContext { personal, company }

enum UserRole { 
  individual,
  companyAdmin,
  companyEmployee,
  systemAdmin;
  
  static UserRole fromString(String role) {
    switch (role) {
      case 'company_admin':
        return UserRole.companyAdmin;
      case 'company_employee':
        return UserRole.companyEmployee;
      case 'system_admin':
        return UserRole.systemAdmin;
      default:
        return UserRole.individual;
    }
  }
}

sealed class AuthState {
  const AuthState();
}

class AuthStateUnauthenticated extends AuthState {
  const AuthStateUnauthenticated();
}

class AuthStateLoading extends AuthState {
  const AuthStateLoading();
}

class AuthStateAuthenticated extends AuthState {
  final User user;
  final UserContext context;
  final bool canSwitchContext;
  
  const AuthStateAuthenticated({
    required this.user,
    required this.context,
    required this.canSwitchContext,
  });
  
  AuthStateAuthenticated copyWith({
    User? user,
    UserContext? context,
    bool? canSwitchContext,
  }) {
    return AuthStateAuthenticated(
      user: user ?? this.user,
      context: context ?? this.context,
      canSwitchContext: canSwitchContext ?? this.canSwitchContext,
    );
  }
}

class AuthStateError extends AuthState {
  final String message;
  final ApiException? error;
  
  const AuthStateError(this.message, {this.error});
}

@riverpod
class EnhancedAuth extends _$EnhancedAuth {
  final AuthService _authService = AuthService.instance;
  
  @override
  AuthState build() {
    _initializeAuthState();
    return const AuthStateUnauthenticated();
  }
  
  // Initialize authentication state from stored data
  Future<void> _initializeAuthState() async {
    if (_authService.isAuthenticated) {
      final user = _authService.currentUser;
      if (user != null) {
        final context = _determineUserContext(user);
        final canSwitch = _canSwitchContext(user);
        state = AuthStateAuthenticated(
          user: user,
          context: context,
          canSwitchContext: canSwitch,
        );
        return;
      }
    }
    
    state = const AuthStateUnauthenticated();
  }
  
  // Determine user context based on role and saved preference
  UserContext _determineUserContext(User user) {
    final savedContext = LocalStorage.getSetting<String>('user_context');
    if (savedContext != null) {
      return UserContext.values.firstWhere(
        (c) => c.name == savedContext,
        orElse: () => _getDefaultContext(user),
      );
    }
    
    return _getDefaultContext(user);
  }
  
  UserContext _getDefaultContext(User user) {
    if (user.companyId != null && user.role != 'individual') {
      return UserContext.company;
    }
    return UserContext.personal;
  }
  
  bool _canSwitchContext(User user) {
    return user.companyId != null && user.role != 'individual';
  }
  
  // Login with email and password
  Future<AuthResult> login({
    required String email,
    required String password,
  }) async {
    state = const AuthStateLoading();
    
    try {
      final result = await _authService.login(
        email: email,
        password: password,
      );
      
      if (result.success && result.user != null) {
        final context = _determineUserContext(result.user!);
        final canSwitch = _canSwitchContext(result.user!);
        state = AuthStateAuthenticated(
          user: result.user!,
          context: context,
          canSwitchContext: canSwitch,
        );
        return result;
      } else {
        state = AuthStateError(result.message, error: result.error);
        return result;
      }
    } on ApiException catch (e) {
      state = AuthStateError(e.message, error: e);
      return AuthResult.error(e);
    } catch (e) {
      final error = ApiException(
        message: 'Login failed: $e',
        statusCode: 0,
        type: ApiExceptionType.unknown,
      );
      state = AuthStateError(error.message, error: error);
      return AuthResult.error(error);
    }
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
    state = const AuthStateLoading();
    
    try {
      final result = await _authService.register(
        email: email,
        password: password,
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        companyName: companyName,
      );
      
      if (result.success && result.user != null) {
        final context = _determineUserContext(result.user!);
        final canSwitch = _canSwitchContext(result.user!);
        state = AuthStateAuthenticated(
          user: result.user!,
          context: context,
          canSwitchContext: canSwitch,
        );
        return result;
      } else {
        state = AuthStateError(result.message, error: result.error);
        return result;
      }
    } on ApiException catch (e) {
      state = AuthStateError(e.message, error: e);
      return AuthResult.error(e);
    } catch (e) {
      final error = ApiException(
        message: 'Registration failed: $e',
        statusCode: 0,
        type: ApiExceptionType.unknown,
      );
      state = AuthStateError(error.message, error: error);
      return AuthResult.error(error);
    }
  }
  
  // Logout
  Future<void> logout({bool allDevices = false}) async {
    state = const AuthStateLoading();
    
    try {
      await _authService.logout(allDevices: allDevices);
    } catch (e) {
      // Continue with logout even if API call fails
    }
    
    state = const AuthStateUnauthenticated();
  }
  
  // Refresh token
  Future<void> refreshToken() async {
    try {
      final refreshed = await _authService.refreshToken();
      if (refreshed) {
        final user = _authService.currentUser;
        if (user != null) {
          final context = _determineUserContext(user);
          final canSwitch = _canSwitchContext(user);
          state = AuthStateAuthenticated(
            user: user,
            context: context,
            canSwitchContext: canSwitch,
          );
          return;
        }
      }
      
      state = const AuthStateUnauthenticated();
    } catch (e) {
      state = const AuthStateUnauthenticated();
    }
  }
  
  // Get current user from server and update state
  Future<void> syncUser() async {
    try {
      final user = await _authService.getCurrentUser();
      if (user != null) {
        final currentState = state;
        if (currentState is AuthStateAuthenticated) {
          final context = currentState.context;
          final canSwitch = _canSwitchContext(user);
          state = AuthStateAuthenticated(
            user: user,
            context: context,
            canSwitchContext: canSwitch,
          );
        }
      }
    } catch (e) {
      // Handle sync error if needed
    }
  }
  
  // Switch between personal and company context
  Future<void> switchContext(UserContext newContext) async {
    final currentState = state;
    if (currentState is AuthStateAuthenticated && currentState.canSwitchContext) {
      // Save preference
      await LocalStorage.saveSetting('user_context', newContext.name);
      
      // Update state
      state = currentState.copyWith(context: newContext);
    }
  }
  
  // Check if user has permission for company features
  bool hasCompanyPermission(String permission) {
    final currentState = state;
    if (currentState is! AuthStateAuthenticated) return false;
    
    if (currentState.context != UserContext.company) return false;
    
    final userRole = UserRole.fromString(currentState.user.role);
    
    switch (permission) {
      case 'view_company_receipts':
        return userRole == UserRole.companyAdmin || 
               userRole == UserRole.companyEmployee;
      case 'invite_accountant':
        return userRole == UserRole.companyAdmin;
      case 'export_reports':
        return userRole == UserRole.companyAdmin;
      case 'manage_employees':
        return userRole == UserRole.companyAdmin;
      case 'view_all_company_data':
        return userRole == UserRole.companyAdmin;
      default:
        return false;
    }
  }
  
  // Get context display name
  String getContextDisplayName(UserContext context) {
    switch (context) {
      case UserContext.personal:
        return '👤 Personal';
      case UserContext.company:
        return '🏢 Company';
    }
  }
  
  // Clear any error state
  void clearError() {
    final currentState = state;
    if (currentState is AuthStateError) {
      state = const AuthStateUnauthenticated();
    }
  }
}

// Helper providers
@riverpod
User? currentUser(CurrentUserRef ref) {
  final authState = ref.watch(enhancedAuthProvider);
  return authState is AuthStateAuthenticated ? authState.user : null;
}

@riverpod
bool isAuthenticated(IsAuthenticatedRef ref) {
  final authState = ref.watch(enhancedAuthProvider);
  return authState is AuthStateAuthenticated;
}

@riverpod
UserContext? userContext(UserContextRef ref) {
  final authState = ref.watch(enhancedAuthProvider);
  return authState is AuthStateAuthenticated ? authState.context : null;
}

@riverpod
bool canSwitchContext(CanSwitchContextRef ref) {
  final authState = ref.watch(enhancedAuthProvider);
  return authState is AuthStateAuthenticated ? authState.canSwitchContext : false;
}

@riverpod
bool isInCompanyMode(IsInCompanyModeRef ref) {
  final context = ref.watch(userContextProvider);
  return context == UserContext.company;
}

@riverpod
bool isInPersonalMode(IsInPersonalModeRef ref) {
  final context = ref.watch(userContextProvider);
  return context == UserContext.personal;
}

@riverpod
UserRole? userRole(UserRoleRef ref) {
  final user = ref.watch(currentUserProvider);
  return user != null ? UserRole.fromString(user.role) : null;
}

@riverpod
bool isCompanyAdmin(IsCompanyAdminRef ref) {
  final role = ref.watch(userRoleProvider);
  return role == UserRole.companyAdmin;
}

@riverpod
bool isCompanyEmployee(IsCompanyEmployeeRef ref) {
  final role = ref.watch(userRoleProvider);
  return role == UserRole.companyEmployee;
}