import 'package:hive/hive.dart';
import 'package:json_annotation/json_annotation.dart';

part 'receipt.g.dart';

@JsonSerializable()
@HiveType(typeId: 0)
class Receipt extends HiveObject {
  @JsonKey(name: 'id')
  @HiveField(0)
  String id;

  @JsonKey(name: 'userId')
  @HiveField(1)
  String userId;

  @JsonKey(name: 'companyId')
  @HiveField(2)
  String? companyId;

  @JsonKey(name: 'originalFilename')
  @HiveField(3)
  String? originalFilename;

  @JsonKey(name: 'filePath')
  @HiveField(4)
  String? filePath;

  @JsonKey(name: 'fileSize')
  @HiveField(5)
  int? fileSize;

  @JsonKey(name: 'fileHash')
  @HiveField(6)
  String? fileHash;

  @JsonKey(name: 'mimeType')
  @HiveField(7)
  String? mimeType;

  @JsonKey(name: 'status')
  @HiveField(8)
  String status; // 'uploaded', 'processing', 'processed', 'failed'

  @JsonKey(name: 'vendorName')
  @HiveField(9)
  String? vendorName;

  @JsonKey(name: 'totalAmount')
  @HiveField(10)
  double? totalAmount;

  @JsonKey(name: 'currency')
  @HiveField(11)
  String? currency;

  @JsonKey(name: 'receiptDate')
  @HiveField(12)
  DateTime? receiptDate;

  @JsonKey(name: 'category')
  @HiveField(13)
  String? category;

  @JsonKey(name: 'description')
  @HiveField(14)
  String? description;

  @JsonKey(name: 'tags')
  @HiveField(15)
  List<String> tags;

  @JsonKey(name: 'thumbnailPath')
  @HiveField(16)
  String? thumbnailPath;

  @JsonKey(name: 'ocrText')
  @HiveField(17)
  String? ocrText;

  @JsonKey(name: 'ocrConfidence')
  @HiveField(18)
  double? ocrConfidence;

  @JsonKey(name: 'createdAt')
  @HiveField(19)
  DateTime createdAt;

  @JsonKey(name: 'updatedAt')
  @HiveField(20)
  DateTime updatedAt;

  // Local-only fields for mobile app
  @JsonKey(includeFromJson: false, includeToJson: false)
  @HiveField(21)
  String? localImagePath;

  @JsonKey(includeFromJson: false, includeToJson: false)
  @HiveField(22)
  bool isSynced;

  @JsonKey(includeFromJson: false, includeToJson: false)
  @HiveField(23)
  String? syncError;

  Receipt({
    required this.id,
    required this.userId,
    this.companyId,
    this.originalFilename,
    this.filePath,
    this.fileSize,
    this.fileHash,
    this.mimeType,
    this.status = 'uploaded',
    this.vendorName,
    this.totalAmount,
    this.currency = 'USD',
    this.receiptDate,
    this.category,
    this.description,
    this.tags = const [],
    this.thumbnailPath,
    this.ocrText,
    this.ocrConfidence,
    required this.createdAt,
    required this.updatedAt,
    this.localImagePath,
    this.isSynced = false,
    this.syncError,
  });

  // Computed properties for backward compatibility
  String? get vendor => vendorName;
  double? get amount => totalAmount;
  DateTime? get date => receiptDate;
  String? get imagePath => localImagePath ?? filePath;
  bool get isProcessed => status == 'processed';

  factory Receipt.fromJson(Map<String, dynamic> json) => _$ReceiptFromJson(json);
  Map<String, dynamic> toJson() => _$ReceiptToJson(this);

  Receipt copyWith({
    String? id,
    String? userId,
    String? companyId,
    String? originalFilename,
    String? filePath,
    int? fileSize,
    String? fileHash,
    String? mimeType,
    String? status,
    String? vendorName,
    double? totalAmount,
    String? currency,
    DateTime? receiptDate,
    String? category,
    String? description,
    List<String>? tags,
    String? thumbnailPath,
    String? ocrText,
    double? ocrConfidence,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? localImagePath,
    bool? isSynced,
    String? syncError,
  }) {
    return Receipt(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      companyId: companyId ?? this.companyId,
      originalFilename: originalFilename ?? this.originalFilename,
      filePath: filePath ?? this.filePath,
      fileSize: fileSize ?? this.fileSize,
      fileHash: fileHash ?? this.fileHash,
      mimeType: mimeType ?? this.mimeType,
      status: status ?? this.status,
      vendorName: vendorName ?? this.vendorName,
      totalAmount: totalAmount ?? this.totalAmount,
      currency: currency ?? this.currency,
      receiptDate: receiptDate ?? this.receiptDate,
      category: category ?? this.category,
      description: description ?? this.description,
      tags: tags ?? this.tags,
      thumbnailPath: thumbnailPath ?? this.thumbnailPath,
      ocrText: ocrText ?? this.ocrText,
      ocrConfidence: ocrConfidence ?? this.ocrConfidence,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      localImagePath: localImagePath ?? this.localImagePath,
      isSynced: isSynced ?? this.isSynced,
      syncError: syncError ?? this.syncError,
    );
  }
}