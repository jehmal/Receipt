// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'enhanced_auth_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$currentUserHash() => r'c9d5a8b520333f7929c2bf29289584e19b2e903c';

/// See also [currentUser].
@ProviderFor(currentUser)
final currentUserProvider = AutoDisposeProvider<User?>.internal(
  currentUser,
  name: r'currentUserProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$currentUserHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef CurrentUserRef = AutoDisposeProviderRef<User?>;
String _$isAuthenticatedHash() => r'61270e9a87325f48862bb943154bc33e2cbb48d4';

/// See also [isAuthenticated].
@ProviderFor(isAuthenticated)
final isAuthenticatedProvider = AutoDisposeProvider<bool>.internal(
  isAuthenticated,
  name: r'isAuthenticatedProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$isAuthenticatedHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef IsAuthenticatedRef = AutoDisposeProviderRef<bool>;
String _$userContextHash() => r'15794c809ca7e0e615cbb38f335c840df1dc0979';

/// See also [userContext].
@ProviderFor(userContext)
final userContextProvider = AutoDisposeProvider<UserContext?>.internal(
  userContext,
  name: r'userContextProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$userContextHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef UserContextRef = AutoDisposeProviderRef<UserContext?>;
String _$canSwitchContextHash() => r'6c34655ef0ca09303c0ab61e9d965b36326f372d';

/// See also [canSwitchContext].
@ProviderFor(canSwitchContext)
final canSwitchContextProvider = AutoDisposeProvider<bool>.internal(
  canSwitchContext,
  name: r'canSwitchContextProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$canSwitchContextHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef CanSwitchContextRef = AutoDisposeProviderRef<bool>;
String _$isInCompanyModeHash() => r'e0d36971d77a8cbc614eafdc137654991bb48b97';

/// See also [isInCompanyMode].
@ProviderFor(isInCompanyMode)
final isInCompanyModeProvider = AutoDisposeProvider<bool>.internal(
  isInCompanyMode,
  name: r'isInCompanyModeProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$isInCompanyModeHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef IsInCompanyModeRef = AutoDisposeProviderRef<bool>;
String _$isInPersonalModeHash() => r'52c1d1dfb4ea0d4b30dd7374fd0e4b3cd0e62d4b';

/// See also [isInPersonalMode].
@ProviderFor(isInPersonalMode)
final isInPersonalModeProvider = AutoDisposeProvider<bool>.internal(
  isInPersonalMode,
  name: r'isInPersonalModeProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$isInPersonalModeHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef IsInPersonalModeRef = AutoDisposeProviderRef<bool>;
String _$userRoleHash() => r'c079053ac601a90cc3e08281de545f0a1de781a6';

/// See also [userRole].
@ProviderFor(userRole)
final userRoleProvider = AutoDisposeProvider<UserRole?>.internal(
  userRole,
  name: r'userRoleProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$userRoleHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef UserRoleRef = AutoDisposeProviderRef<UserRole?>;
String _$isCompanyAdminHash() => r'322d8347ae0adbf6bb0289612cb15749a127f014';

/// See also [isCompanyAdmin].
@ProviderFor(isCompanyAdmin)
final isCompanyAdminProvider = AutoDisposeProvider<bool>.internal(
  isCompanyAdmin,
  name: r'isCompanyAdminProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$isCompanyAdminHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef IsCompanyAdminRef = AutoDisposeProviderRef<bool>;
String _$isCompanyEmployeeHash() => r'e6dffa6566b20b9ab3e6c59b2f35503d3c572e86';

/// See also [isCompanyEmployee].
@ProviderFor(isCompanyEmployee)
final isCompanyEmployeeProvider = AutoDisposeProvider<bool>.internal(
  isCompanyEmployee,
  name: r'isCompanyEmployeeProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$isCompanyEmployeeHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef IsCompanyEmployeeRef = AutoDisposeProviderRef<bool>;
String _$enhancedAuthHash() => r'149097fa4e6bc2a9d537f17a9b0a0508d7e2a208';

/// See also [EnhancedAuth].
@ProviderFor(EnhancedAuth)
final enhancedAuthProvider =
    AutoDisposeNotifierProvider<EnhancedAuth, AuthState>.internal(
  EnhancedAuth.new,
  name: r'enhancedAuthProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$enhancedAuthHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef _$EnhancedAuth = AutoDisposeNotifier<AuthState>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member
