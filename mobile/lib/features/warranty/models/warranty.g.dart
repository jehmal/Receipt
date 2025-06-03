// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'warranty.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WarrantyImpl _$$WarrantyImplFromJson(Map<String, dynamic> json) =>
    _$WarrantyImpl(
      id: json['id'] as String,
      itemName: json['itemName'] as String,
      category: json['category'] as String,
      purchaseDate: DateTime.parse(json['purchaseDate'] as String),
      expiryDate: DateTime.parse(json['expiryDate'] as String),
      brand: json['brand'] as String?,
      model: json['model'] as String?,
      serialNumber: json['serialNumber'] as String?,
      purchasePrice: (json['purchasePrice'] as num?)?.toDouble(),
      store: json['store'] as String?,
      receiptPath: json['receiptPath'] as String?,
      warrantyDocumentPath: json['warrantyDocumentPath'] as String?,
      notes: json['notes'] as String?,
      blockchainStamped: json['blockchainStamped'] as bool? ?? false,
      blockchainHash: json['blockchainHash'] as String?,
      isNewRecord: json['isNewRecord'] as bool? ?? false,
      createdAt: json['createdAt'] == null
          ? null
          : DateTime.parse(json['createdAt'] as String),
      updatedAt: json['updatedAt'] == null
          ? null
          : DateTime.parse(json['updatedAt'] as String),
    );

Map<String, dynamic> _$$WarrantyImplToJson(_$WarrantyImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'itemName': instance.itemName,
      'category': instance.category,
      'purchaseDate': instance.purchaseDate.toIso8601String(),
      'expiryDate': instance.expiryDate.toIso8601String(),
      'brand': instance.brand,
      'model': instance.model,
      'serialNumber': instance.serialNumber,
      'purchasePrice': instance.purchasePrice,
      'store': instance.store,
      'receiptPath': instance.receiptPath,
      'warrantyDocumentPath': instance.warrantyDocumentPath,
      'notes': instance.notes,
      'blockchainStamped': instance.blockchainStamped,
      'blockchainHash': instance.blockchainHash,
      'isNewRecord': instance.isNewRecord,
      'createdAt': instance.createdAt?.toIso8601String(),
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };

_$WarrantyNotificationSettingsImpl _$$WarrantyNotificationSettingsImplFromJson(
        Map<String, dynamic> json) =>
    _$WarrantyNotificationSettingsImpl(
      enabled: json['enabled'] as bool? ?? true,
      daysBeforeExpiry: (json['daysBeforeExpiry'] as num?)?.toInt() ?? 30,
      emailNotifications: json['emailNotifications'] as bool? ?? true,
      pushNotifications: json['pushNotifications'] as bool? ?? true,
      smsNotifications: json['smsNotifications'] as bool? ?? false,
      emailAddress: json['emailAddress'] as String?,
      phoneNumber: json['phoneNumber'] as String?,
    );

Map<String, dynamic> _$$WarrantyNotificationSettingsImplToJson(
        _$WarrantyNotificationSettingsImpl instance) =>
    <String, dynamic>{
      'enabled': instance.enabled,
      'daysBeforeExpiry': instance.daysBeforeExpiry,
      'emailNotifications': instance.emailNotifications,
      'pushNotifications': instance.pushNotifications,
      'smsNotifications': instance.smsNotifications,
      'emailAddress': instance.emailAddress,
      'phoneNumber': instance.phoneNumber,
    };
