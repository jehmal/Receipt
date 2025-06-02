// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'receipt.dart';

// **************************************************************************
// TypeAdapterGenerator
// **************************************************************************

class ReceiptAdapter extends TypeAdapter<Receipt> {
  @override
  final int typeId = 0;

  @override
  Receipt read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return Receipt(
      id: fields[0] as String,
      userId: fields[1] as String,
      companyId: fields[2] as String?,
      originalFilename: fields[3] as String?,
      filePath: fields[4] as String?,
      fileSize: fields[5] as int?,
      fileHash: fields[6] as String?,
      mimeType: fields[7] as String?,
      status: fields[8] as String,
      vendorName: fields[9] as String?,
      totalAmount: fields[10] as double?,
      currency: fields[11] as String?,
      receiptDate: fields[12] as DateTime?,
      category: fields[13] as String?,
      description: fields[14] as String?,
      tags: (fields[15] as List).cast<String>(),
      thumbnailPath: fields[16] as String?,
      ocrText: fields[17] as String?,
      ocrConfidence: fields[18] as double?,
      createdAt: fields[19] as DateTime,
      updatedAt: fields[20] as DateTime,
      localImagePath: fields[21] as String?,
      isSynced: fields[22] as bool,
      syncError: fields[23] as String?,
    );
  }

  @override
  void write(BinaryWriter writer, Receipt obj) {
    writer
      ..writeByte(24)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.userId)
      ..writeByte(2)
      ..write(obj.companyId)
      ..writeByte(3)
      ..write(obj.originalFilename)
      ..writeByte(4)
      ..write(obj.filePath)
      ..writeByte(5)
      ..write(obj.fileSize)
      ..writeByte(6)
      ..write(obj.fileHash)
      ..writeByte(7)
      ..write(obj.mimeType)
      ..writeByte(8)
      ..write(obj.status)
      ..writeByte(9)
      ..write(obj.vendorName)
      ..writeByte(10)
      ..write(obj.totalAmount)
      ..writeByte(11)
      ..write(obj.currency)
      ..writeByte(12)
      ..write(obj.receiptDate)
      ..writeByte(13)
      ..write(obj.category)
      ..writeByte(14)
      ..write(obj.description)
      ..writeByte(15)
      ..write(obj.tags)
      ..writeByte(16)
      ..write(obj.thumbnailPath)
      ..writeByte(17)
      ..write(obj.ocrText)
      ..writeByte(18)
      ..write(obj.ocrConfidence)
      ..writeByte(19)
      ..write(obj.createdAt)
      ..writeByte(20)
      ..write(obj.updatedAt)
      ..writeByte(21)
      ..write(obj.localImagePath)
      ..writeByte(22)
      ..write(obj.isSynced)
      ..writeByte(23)
      ..write(obj.syncError);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ReceiptAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Receipt _$ReceiptFromJson(Map<String, dynamic> json) => Receipt(
      id: json['id'] as String,
      userId: json['userId'] as String,
      companyId: json['companyId'] as String?,
      originalFilename: json['originalFilename'] as String?,
      filePath: json['filePath'] as String?,
      fileSize: (json['fileSize'] as num?)?.toInt(),
      fileHash: json['fileHash'] as String?,
      mimeType: json['mimeType'] as String?,
      status: json['status'] as String? ?? 'uploaded',
      vendorName: json['vendorName'] as String?,
      totalAmount: (json['totalAmount'] as num?)?.toDouble(),
      currency: json['currency'] as String? ?? 'USD',
      receiptDate: json['receiptDate'] == null
          ? null
          : DateTime.parse(json['receiptDate'] as String),
      category: json['category'] as String?,
      description: json['description'] as String?,
      tags:
          (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList() ??
              const [],
      thumbnailPath: json['thumbnailPath'] as String?,
      ocrText: json['ocrText'] as String?,
      ocrConfidence: (json['ocrConfidence'] as num?)?.toDouble(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );

Map<String, dynamic> _$ReceiptToJson(Receipt instance) => <String, dynamic>{
      'id': instance.id,
      'userId': instance.userId,
      'companyId': instance.companyId,
      'originalFilename': instance.originalFilename,
      'filePath': instance.filePath,
      'fileSize': instance.fileSize,
      'fileHash': instance.fileHash,
      'mimeType': instance.mimeType,
      'status': instance.status,
      'vendorName': instance.vendorName,
      'totalAmount': instance.totalAmount,
      'currency': instance.currency,
      'receiptDate': instance.receiptDate?.toIso8601String(),
      'category': instance.category,
      'description': instance.description,
      'tags': instance.tags,
      'thumbnailPath': instance.thumbnailPath,
      'ocrText': instance.ocrText,
      'ocrConfidence': instance.ocrConfidence,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
    };
