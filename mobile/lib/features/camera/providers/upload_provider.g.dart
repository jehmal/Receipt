// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'upload_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$uploadNotifierHash() => r'f9eba89629cdcdaeae449b3d427f2c74e938add0';

/// See also [UploadNotifier].
@ProviderFor(UploadNotifier)
final uploadNotifierProvider =
    AutoDisposeNotifierProvider<UploadNotifier, UploadState>.internal(
  UploadNotifier.new,
  name: r'uploadNotifierProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$uploadNotifierHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef _$UploadNotifier = AutoDisposeNotifier<UploadState>;
String _$uploadHistoryNotifierHash() =>
    r'9b42805623c8a5fe04e0025678c61e3d022d2705';

/// See also [UploadHistoryNotifier].
@ProviderFor(UploadHistoryNotifier)
final uploadHistoryNotifierProvider = AutoDisposeNotifierProvider<
    UploadHistoryNotifier, List<UploadHistoryItem>>.internal(
  UploadHistoryNotifier.new,
  name: r'uploadHistoryNotifierProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$uploadHistoryNotifierHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef _$UploadHistoryNotifier = AutoDisposeNotifier<List<UploadHistoryItem>>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member
