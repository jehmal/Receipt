// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'upload_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$uploadNotifierHash() => r'27666b956744aefd25d29f8708cf8a0605fda8f8';

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
    r'38708c8ed2fe07f95a7ca601e0910e4a24c3cd89';

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
