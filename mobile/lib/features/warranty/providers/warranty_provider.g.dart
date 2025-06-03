// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'warranty_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$warrantyStatsHash() => r'430cf062602f8cba0cad168b6f718637a287aee5';

/// See also [warrantyStats].
@ProviderFor(warrantyStats)
final warrantyStatsProvider = AutoDisposeFutureProvider<WarrantyStats>.internal(
  warrantyStats,
  name: r'warrantyStatsProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$warrantyStatsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef WarrantyStatsRef = AutoDisposeFutureProviderRef<WarrantyStats>;
String _$warrantyCategoriesHash() =>
    r'84648f3a5376dee1b11c1d5e42f38b0fd5b1a6cc';

/// See also [warrantyCategories].
@ProviderFor(warrantyCategories)
final warrantyCategoriesProvider =
    AutoDisposeFutureProvider<List<WarrantyCategory>>.internal(
  warrantyCategories,
  name: r'warrantyCategoriesProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$warrantyCategoriesHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef WarrantyCategoriesRef
    = AutoDisposeFutureProviderRef<List<WarrantyCategory>>;
String _$warrantyNotifierHash() => r'11b010f8f5f0d5dce2c0ff46836ffe52adfb3677';

/// See also [WarrantyNotifier].
@ProviderFor(WarrantyNotifier)
final warrantyNotifierProvider =
    AutoDisposeAsyncNotifierProvider<WarrantyNotifier, List<Warranty>>.internal(
  WarrantyNotifier.new,
  name: r'warrantyNotifierProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$warrantyNotifierHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef _$WarrantyNotifier = AutoDisposeAsyncNotifier<List<Warranty>>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member
