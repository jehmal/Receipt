// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'warranty.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

Warranty _$WarrantyFromJson(Map<String, dynamic> json) {
  return _Warranty.fromJson(json);
}

/// @nodoc
mixin _$Warranty {
  String get id => throw _privateConstructorUsedError;
  String get itemName => throw _privateConstructorUsedError;
  String get category => throw _privateConstructorUsedError;
  DateTime get purchaseDate => throw _privateConstructorUsedError;
  DateTime get expiryDate => throw _privateConstructorUsedError;
  String? get brand => throw _privateConstructorUsedError;
  String? get model => throw _privateConstructorUsedError;
  String? get serialNumber => throw _privateConstructorUsedError;
  double? get purchasePrice => throw _privateConstructorUsedError;
  String? get store => throw _privateConstructorUsedError;
  String? get receiptPath => throw _privateConstructorUsedError;
  String? get warrantyDocumentPath => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  bool get blockchainStamped => throw _privateConstructorUsedError;
  String? get blockchainHash => throw _privateConstructorUsedError;
  bool get isNewRecord => throw _privateConstructorUsedError;
  DateTime? get createdAt => throw _privateConstructorUsedError;
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $WarrantyCopyWith<Warranty> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WarrantyCopyWith<$Res> {
  factory $WarrantyCopyWith(Warranty value, $Res Function(Warranty) then) =
      _$WarrantyCopyWithImpl<$Res, Warranty>;
  @useResult
  $Res call(
      {String id,
      String itemName,
      String category,
      DateTime purchaseDate,
      DateTime expiryDate,
      String? brand,
      String? model,
      String? serialNumber,
      double? purchasePrice,
      String? store,
      String? receiptPath,
      String? warrantyDocumentPath,
      String? notes,
      bool blockchainStamped,
      String? blockchainHash,
      bool isNewRecord,
      DateTime? createdAt,
      DateTime? updatedAt});
}

/// @nodoc
class _$WarrantyCopyWithImpl<$Res, $Val extends Warranty>
    implements $WarrantyCopyWith<$Res> {
  _$WarrantyCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? itemName = null,
    Object? category = null,
    Object? purchaseDate = null,
    Object? expiryDate = null,
    Object? brand = freezed,
    Object? model = freezed,
    Object? serialNumber = freezed,
    Object? purchasePrice = freezed,
    Object? store = freezed,
    Object? receiptPath = freezed,
    Object? warrantyDocumentPath = freezed,
    Object? notes = freezed,
    Object? blockchainStamped = null,
    Object? blockchainHash = freezed,
    Object? isNewRecord = null,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      itemName: null == itemName
          ? _value.itemName
          : itemName // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as String,
      purchaseDate: null == purchaseDate
          ? _value.purchaseDate
          : purchaseDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      expiryDate: null == expiryDate
          ? _value.expiryDate
          : expiryDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      brand: freezed == brand
          ? _value.brand
          : brand // ignore: cast_nullable_to_non_nullable
              as String?,
      model: freezed == model
          ? _value.model
          : model // ignore: cast_nullable_to_non_nullable
              as String?,
      serialNumber: freezed == serialNumber
          ? _value.serialNumber
          : serialNumber // ignore: cast_nullable_to_non_nullable
              as String?,
      purchasePrice: freezed == purchasePrice
          ? _value.purchasePrice
          : purchasePrice // ignore: cast_nullable_to_non_nullable
              as double?,
      store: freezed == store
          ? _value.store
          : store // ignore: cast_nullable_to_non_nullable
              as String?,
      receiptPath: freezed == receiptPath
          ? _value.receiptPath
          : receiptPath // ignore: cast_nullable_to_non_nullable
              as String?,
      warrantyDocumentPath: freezed == warrantyDocumentPath
          ? _value.warrantyDocumentPath
          : warrantyDocumentPath // ignore: cast_nullable_to_non_nullable
              as String?,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      blockchainStamped: null == blockchainStamped
          ? _value.blockchainStamped
          : blockchainStamped // ignore: cast_nullable_to_non_nullable
              as bool,
      blockchainHash: freezed == blockchainHash
          ? _value.blockchainHash
          : blockchainHash // ignore: cast_nullable_to_non_nullable
              as String?,
      isNewRecord: null == isNewRecord
          ? _value.isNewRecord
          : isNewRecord // ignore: cast_nullable_to_non_nullable
              as bool,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$WarrantyImplCopyWith<$Res>
    implements $WarrantyCopyWith<$Res> {
  factory _$$WarrantyImplCopyWith(
          _$WarrantyImpl value, $Res Function(_$WarrantyImpl) then) =
      __$$WarrantyImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String itemName,
      String category,
      DateTime purchaseDate,
      DateTime expiryDate,
      String? brand,
      String? model,
      String? serialNumber,
      double? purchasePrice,
      String? store,
      String? receiptPath,
      String? warrantyDocumentPath,
      String? notes,
      bool blockchainStamped,
      String? blockchainHash,
      bool isNewRecord,
      DateTime? createdAt,
      DateTime? updatedAt});
}

/// @nodoc
class __$$WarrantyImplCopyWithImpl<$Res>
    extends _$WarrantyCopyWithImpl<$Res, _$WarrantyImpl>
    implements _$$WarrantyImplCopyWith<$Res> {
  __$$WarrantyImplCopyWithImpl(
      _$WarrantyImpl _value, $Res Function(_$WarrantyImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? itemName = null,
    Object? category = null,
    Object? purchaseDate = null,
    Object? expiryDate = null,
    Object? brand = freezed,
    Object? model = freezed,
    Object? serialNumber = freezed,
    Object? purchasePrice = freezed,
    Object? store = freezed,
    Object? receiptPath = freezed,
    Object? warrantyDocumentPath = freezed,
    Object? notes = freezed,
    Object? blockchainStamped = null,
    Object? blockchainHash = freezed,
    Object? isNewRecord = null,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
  }) {
    return _then(_$WarrantyImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      itemName: null == itemName
          ? _value.itemName
          : itemName // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as String,
      purchaseDate: null == purchaseDate
          ? _value.purchaseDate
          : purchaseDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      expiryDate: null == expiryDate
          ? _value.expiryDate
          : expiryDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      brand: freezed == brand
          ? _value.brand
          : brand // ignore: cast_nullable_to_non_nullable
              as String?,
      model: freezed == model
          ? _value.model
          : model // ignore: cast_nullable_to_non_nullable
              as String?,
      serialNumber: freezed == serialNumber
          ? _value.serialNumber
          : serialNumber // ignore: cast_nullable_to_non_nullable
              as String?,
      purchasePrice: freezed == purchasePrice
          ? _value.purchasePrice
          : purchasePrice // ignore: cast_nullable_to_non_nullable
              as double?,
      store: freezed == store
          ? _value.store
          : store // ignore: cast_nullable_to_non_nullable
              as String?,
      receiptPath: freezed == receiptPath
          ? _value.receiptPath
          : receiptPath // ignore: cast_nullable_to_non_nullable
              as String?,
      warrantyDocumentPath: freezed == warrantyDocumentPath
          ? _value.warrantyDocumentPath
          : warrantyDocumentPath // ignore: cast_nullable_to_non_nullable
              as String?,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      blockchainStamped: null == blockchainStamped
          ? _value.blockchainStamped
          : blockchainStamped // ignore: cast_nullable_to_non_nullable
              as bool,
      blockchainHash: freezed == blockchainHash
          ? _value.blockchainHash
          : blockchainHash // ignore: cast_nullable_to_non_nullable
              as String?,
      isNewRecord: null == isNewRecord
          ? _value.isNewRecord
          : isNewRecord // ignore: cast_nullable_to_non_nullable
              as bool,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$WarrantyImpl extends _Warranty {
  const _$WarrantyImpl(
      {required this.id,
      required this.itemName,
      required this.category,
      required this.purchaseDate,
      required this.expiryDate,
      this.brand,
      this.model,
      this.serialNumber,
      this.purchasePrice,
      this.store,
      this.receiptPath,
      this.warrantyDocumentPath,
      this.notes,
      this.blockchainStamped = false,
      this.blockchainHash,
      this.isNewRecord = false,
      this.createdAt,
      this.updatedAt})
      : super._();

  factory _$WarrantyImpl.fromJson(Map<String, dynamic> json) =>
      _$$WarrantyImplFromJson(json);

  @override
  final String id;
  @override
  final String itemName;
  @override
  final String category;
  @override
  final DateTime purchaseDate;
  @override
  final DateTime expiryDate;
  @override
  final String? brand;
  @override
  final String? model;
  @override
  final String? serialNumber;
  @override
  final double? purchasePrice;
  @override
  final String? store;
  @override
  final String? receiptPath;
  @override
  final String? warrantyDocumentPath;
  @override
  final String? notes;
  @override
  @JsonKey()
  final bool blockchainStamped;
  @override
  final String? blockchainHash;
  @override
  @JsonKey()
  final bool isNewRecord;
  @override
  final DateTime? createdAt;
  @override
  final DateTime? updatedAt;

  @override
  String toString() {
    return 'Warranty(id: $id, itemName: $itemName, category: $category, purchaseDate: $purchaseDate, expiryDate: $expiryDate, brand: $brand, model: $model, serialNumber: $serialNumber, purchasePrice: $purchasePrice, store: $store, receiptPath: $receiptPath, warrantyDocumentPath: $warrantyDocumentPath, notes: $notes, blockchainStamped: $blockchainStamped, blockchainHash: $blockchainHash, isNewRecord: $isNewRecord, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WarrantyImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.itemName, itemName) ||
                other.itemName == itemName) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.purchaseDate, purchaseDate) ||
                other.purchaseDate == purchaseDate) &&
            (identical(other.expiryDate, expiryDate) ||
                other.expiryDate == expiryDate) &&
            (identical(other.brand, brand) || other.brand == brand) &&
            (identical(other.model, model) || other.model == model) &&
            (identical(other.serialNumber, serialNumber) ||
                other.serialNumber == serialNumber) &&
            (identical(other.purchasePrice, purchasePrice) ||
                other.purchasePrice == purchasePrice) &&
            (identical(other.store, store) || other.store == store) &&
            (identical(other.receiptPath, receiptPath) ||
                other.receiptPath == receiptPath) &&
            (identical(other.warrantyDocumentPath, warrantyDocumentPath) ||
                other.warrantyDocumentPath == warrantyDocumentPath) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            (identical(other.blockchainStamped, blockchainStamped) ||
                other.blockchainStamped == blockchainStamped) &&
            (identical(other.blockchainHash, blockchainHash) ||
                other.blockchainHash == blockchainHash) &&
            (identical(other.isNewRecord, isNewRecord) ||
                other.isNewRecord == isNewRecord) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      itemName,
      category,
      purchaseDate,
      expiryDate,
      brand,
      model,
      serialNumber,
      purchasePrice,
      store,
      receiptPath,
      warrantyDocumentPath,
      notes,
      blockchainStamped,
      blockchainHash,
      isNewRecord,
      createdAt,
      updatedAt);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$WarrantyImplCopyWith<_$WarrantyImpl> get copyWith =>
      __$$WarrantyImplCopyWithImpl<_$WarrantyImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WarrantyImplToJson(
      this,
    );
  }
}

abstract class _Warranty extends Warranty {
  const factory _Warranty(
      {required final String id,
      required final String itemName,
      required final String category,
      required final DateTime purchaseDate,
      required final DateTime expiryDate,
      final String? brand,
      final String? model,
      final String? serialNumber,
      final double? purchasePrice,
      final String? store,
      final String? receiptPath,
      final String? warrantyDocumentPath,
      final String? notes,
      final bool blockchainStamped,
      final String? blockchainHash,
      final bool isNewRecord,
      final DateTime? createdAt,
      final DateTime? updatedAt}) = _$WarrantyImpl;
  const _Warranty._() : super._();

  factory _Warranty.fromJson(Map<String, dynamic> json) =
      _$WarrantyImpl.fromJson;

  @override
  String get id;
  @override
  String get itemName;
  @override
  String get category;
  @override
  DateTime get purchaseDate;
  @override
  DateTime get expiryDate;
  @override
  String? get brand;
  @override
  String? get model;
  @override
  String? get serialNumber;
  @override
  double? get purchasePrice;
  @override
  String? get store;
  @override
  String? get receiptPath;
  @override
  String? get warrantyDocumentPath;
  @override
  String? get notes;
  @override
  bool get blockchainStamped;
  @override
  String? get blockchainHash;
  @override
  bool get isNewRecord;
  @override
  DateTime? get createdAt;
  @override
  DateTime? get updatedAt;
  @override
  @JsonKey(ignore: true)
  _$$WarrantyImplCopyWith<_$WarrantyImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

WarrantyNotificationSettings _$WarrantyNotificationSettingsFromJson(
    Map<String, dynamic> json) {
  return _WarrantyNotificationSettings.fromJson(json);
}

/// @nodoc
mixin _$WarrantyNotificationSettings {
  bool get enabled => throw _privateConstructorUsedError;
  int get daysBeforeExpiry => throw _privateConstructorUsedError;
  bool get emailNotifications => throw _privateConstructorUsedError;
  bool get pushNotifications => throw _privateConstructorUsedError;
  bool get smsNotifications => throw _privateConstructorUsedError;
  String? get emailAddress => throw _privateConstructorUsedError;
  String? get phoneNumber => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $WarrantyNotificationSettingsCopyWith<WarrantyNotificationSettings>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WarrantyNotificationSettingsCopyWith<$Res> {
  factory $WarrantyNotificationSettingsCopyWith(
          WarrantyNotificationSettings value,
          $Res Function(WarrantyNotificationSettings) then) =
      _$WarrantyNotificationSettingsCopyWithImpl<$Res,
          WarrantyNotificationSettings>;
  @useResult
  $Res call(
      {bool enabled,
      int daysBeforeExpiry,
      bool emailNotifications,
      bool pushNotifications,
      bool smsNotifications,
      String? emailAddress,
      String? phoneNumber});
}

/// @nodoc
class _$WarrantyNotificationSettingsCopyWithImpl<$Res,
        $Val extends WarrantyNotificationSettings>
    implements $WarrantyNotificationSettingsCopyWith<$Res> {
  _$WarrantyNotificationSettingsCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? enabled = null,
    Object? daysBeforeExpiry = null,
    Object? emailNotifications = null,
    Object? pushNotifications = null,
    Object? smsNotifications = null,
    Object? emailAddress = freezed,
    Object? phoneNumber = freezed,
  }) {
    return _then(_value.copyWith(
      enabled: null == enabled
          ? _value.enabled
          : enabled // ignore: cast_nullable_to_non_nullable
              as bool,
      daysBeforeExpiry: null == daysBeforeExpiry
          ? _value.daysBeforeExpiry
          : daysBeforeExpiry // ignore: cast_nullable_to_non_nullable
              as int,
      emailNotifications: null == emailNotifications
          ? _value.emailNotifications
          : emailNotifications // ignore: cast_nullable_to_non_nullable
              as bool,
      pushNotifications: null == pushNotifications
          ? _value.pushNotifications
          : pushNotifications // ignore: cast_nullable_to_non_nullable
              as bool,
      smsNotifications: null == smsNotifications
          ? _value.smsNotifications
          : smsNotifications // ignore: cast_nullable_to_non_nullable
              as bool,
      emailAddress: freezed == emailAddress
          ? _value.emailAddress
          : emailAddress // ignore: cast_nullable_to_non_nullable
              as String?,
      phoneNumber: freezed == phoneNumber
          ? _value.phoneNumber
          : phoneNumber // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$WarrantyNotificationSettingsImplCopyWith<$Res>
    implements $WarrantyNotificationSettingsCopyWith<$Res> {
  factory _$$WarrantyNotificationSettingsImplCopyWith(
          _$WarrantyNotificationSettingsImpl value,
          $Res Function(_$WarrantyNotificationSettingsImpl) then) =
      __$$WarrantyNotificationSettingsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {bool enabled,
      int daysBeforeExpiry,
      bool emailNotifications,
      bool pushNotifications,
      bool smsNotifications,
      String? emailAddress,
      String? phoneNumber});
}

/// @nodoc
class __$$WarrantyNotificationSettingsImplCopyWithImpl<$Res>
    extends _$WarrantyNotificationSettingsCopyWithImpl<$Res,
        _$WarrantyNotificationSettingsImpl>
    implements _$$WarrantyNotificationSettingsImplCopyWith<$Res> {
  __$$WarrantyNotificationSettingsImplCopyWithImpl(
      _$WarrantyNotificationSettingsImpl _value,
      $Res Function(_$WarrantyNotificationSettingsImpl) _then)
      : super(_value, _then);

  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? enabled = null,
    Object? daysBeforeExpiry = null,
    Object? emailNotifications = null,
    Object? pushNotifications = null,
    Object? smsNotifications = null,
    Object? emailAddress = freezed,
    Object? phoneNumber = freezed,
  }) {
    return _then(_$WarrantyNotificationSettingsImpl(
      enabled: null == enabled
          ? _value.enabled
          : enabled // ignore: cast_nullable_to_non_nullable
              as bool,
      daysBeforeExpiry: null == daysBeforeExpiry
          ? _value.daysBeforeExpiry
          : daysBeforeExpiry // ignore: cast_nullable_to_non_nullable
              as int,
      emailNotifications: null == emailNotifications
          ? _value.emailNotifications
          : emailNotifications // ignore: cast_nullable_to_non_nullable
              as bool,
      pushNotifications: null == pushNotifications
          ? _value.pushNotifications
          : pushNotifications // ignore: cast_nullable_to_non_nullable
              as bool,
      smsNotifications: null == smsNotifications
          ? _value.smsNotifications
          : smsNotifications // ignore: cast_nullable_to_non_nullable
              as bool,
      emailAddress: freezed == emailAddress
          ? _value.emailAddress
          : emailAddress // ignore: cast_nullable_to_non_nullable
              as String?,
      phoneNumber: freezed == phoneNumber
          ? _value.phoneNumber
          : phoneNumber // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$WarrantyNotificationSettingsImpl
    implements _WarrantyNotificationSettings {
  const _$WarrantyNotificationSettingsImpl(
      {this.enabled = true,
      this.daysBeforeExpiry = 30,
      this.emailNotifications = true,
      this.pushNotifications = true,
      this.smsNotifications = false,
      this.emailAddress,
      this.phoneNumber});

  factory _$WarrantyNotificationSettingsImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$WarrantyNotificationSettingsImplFromJson(json);

  @override
  @JsonKey()
  final bool enabled;
  @override
  @JsonKey()
  final int daysBeforeExpiry;
  @override
  @JsonKey()
  final bool emailNotifications;
  @override
  @JsonKey()
  final bool pushNotifications;
  @override
  @JsonKey()
  final bool smsNotifications;
  @override
  final String? emailAddress;
  @override
  final String? phoneNumber;

  @override
  String toString() {
    return 'WarrantyNotificationSettings(enabled: $enabled, daysBeforeExpiry: $daysBeforeExpiry, emailNotifications: $emailNotifications, pushNotifications: $pushNotifications, smsNotifications: $smsNotifications, emailAddress: $emailAddress, phoneNumber: $phoneNumber)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WarrantyNotificationSettingsImpl &&
            (identical(other.enabled, enabled) || other.enabled == enabled) &&
            (identical(other.daysBeforeExpiry, daysBeforeExpiry) ||
                other.daysBeforeExpiry == daysBeforeExpiry) &&
            (identical(other.emailNotifications, emailNotifications) ||
                other.emailNotifications == emailNotifications) &&
            (identical(other.pushNotifications, pushNotifications) ||
                other.pushNotifications == pushNotifications) &&
            (identical(other.smsNotifications, smsNotifications) ||
                other.smsNotifications == smsNotifications) &&
            (identical(other.emailAddress, emailAddress) ||
                other.emailAddress == emailAddress) &&
            (identical(other.phoneNumber, phoneNumber) ||
                other.phoneNumber == phoneNumber));
  }

  @JsonKey(ignore: true)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      enabled,
      daysBeforeExpiry,
      emailNotifications,
      pushNotifications,
      smsNotifications,
      emailAddress,
      phoneNumber);

  @JsonKey(ignore: true)
  @override
  @pragma('vm:prefer-inline')
  _$$WarrantyNotificationSettingsImplCopyWith<
          _$WarrantyNotificationSettingsImpl>
      get copyWith => __$$WarrantyNotificationSettingsImplCopyWithImpl<
          _$WarrantyNotificationSettingsImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WarrantyNotificationSettingsImplToJson(
      this,
    );
  }
}

abstract class _WarrantyNotificationSettings
    implements WarrantyNotificationSettings {
  const factory _WarrantyNotificationSettings(
      {final bool enabled,
      final int daysBeforeExpiry,
      final bool emailNotifications,
      final bool pushNotifications,
      final bool smsNotifications,
      final String? emailAddress,
      final String? phoneNumber}) = _$WarrantyNotificationSettingsImpl;

  factory _WarrantyNotificationSettings.fromJson(Map<String, dynamic> json) =
      _$WarrantyNotificationSettingsImpl.fromJson;

  @override
  bool get enabled;
  @override
  int get daysBeforeExpiry;
  @override
  bool get emailNotifications;
  @override
  bool get pushNotifications;
  @override
  bool get smsNotifications;
  @override
  String? get emailAddress;
  @override
  String? get phoneNumber;
  @override
  @JsonKey(ignore: true)
  _$$WarrantyNotificationSettingsImplCopyWith<
          _$WarrantyNotificationSettingsImpl>
      get copyWith => throw _privateConstructorUsedError;
}
