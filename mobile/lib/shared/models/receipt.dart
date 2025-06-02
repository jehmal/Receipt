import 'package:hive/hive.dart';

part 'receipt.g.dart';

@HiveType(typeId: 0)
class Receipt extends HiveObject {
  @HiveField(0)
  String id;

  @HiveField(1)
  String userId;

  @HiveField(2)
  String? companyId;

  @HiveField(3)
  String imagePath;

  @HiveField(4)
  String? ocrText;

  @HiveField(5)
  double? amount;

  @HiveField(6)
  String? currency;

  @HiveField(7)
  String? vendor;

  @HiveField(8)
  String? category;

  @HiveField(9)
  DateTime date;

  @HiveField(10)
  DateTime createdAt;

  @HiveField(11)
  DateTime updatedAt;

  @HiveField(12)
  String? description;

  @HiveField(13)
  List<String> tags;

  @HiveField(14)
  String fileHash;

  @HiveField(15)
  bool isProcessed;

  @HiveField(16)
  bool isSynced;

  @HiveField(17)
  String? syncError;

  Receipt({
    required this.id,
    required this.userId,
    this.companyId,
    required this.imagePath,
    this.ocrText,
    this.amount,
    this.currency = 'USD',
    this.vendor,
    this.category,
    required this.date,
    required this.createdAt,
    required this.updatedAt,
    this.description,
    this.tags = const [],
    required this.fileHash,
    this.isProcessed = false,
    this.isSynced = false,
    this.syncError,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'companyId': companyId,
      'imagePath': imagePath,
      'ocrText': ocrText,
      'amount': amount,
      'currency': currency,
      'vendor': vendor,
      'category': category,
      'date': date.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'description': description,
      'tags': tags,
      'fileHash': fileHash,
      'isProcessed': isProcessed,
      'isSynced': isSynced,
      'syncError': syncError,
    };
  }

  factory Receipt.fromJson(Map<String, dynamic> json) {
    return Receipt(
      id: json['id'],
      userId: json['userId'],
      companyId: json['companyId'],
      imagePath: json['imagePath'],
      ocrText: json['ocrText'],
      amount: json['amount']?.toDouble(),
      currency: json['currency'] ?? 'USD',
      vendor: json['vendor'],
      category: json['category'],
      date: DateTime.parse(json['date']),
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
      description: json['description'],
      tags: List<String>.from(json['tags'] ?? []),
      fileHash: json['fileHash'],
      isProcessed: json['isProcessed'] ?? false,
      isSynced: json['isSynced'] ?? false,
      syncError: json['syncError'],
    );
  }

  Receipt copyWith({
    String? id,
    String? userId,
    String? companyId,
    String? imagePath,
    String? ocrText,
    double? amount,
    String? currency,
    String? vendor,
    String? category,
    DateTime? date,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? description,
    List<String>? tags,
    String? fileHash,
    bool? isProcessed,
    bool? isSynced,
    String? syncError,
  }) {
    return Receipt(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      companyId: companyId ?? this.companyId,
      imagePath: imagePath ?? this.imagePath,
      ocrText: ocrText ?? this.ocrText,
      amount: amount ?? this.amount,
      currency: currency ?? this.currency,
      vendor: vendor ?? this.vendor,
      category: category ?? this.category,
      date: date ?? this.date,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      description: description ?? this.description,
      tags: tags ?? this.tags,
      fileHash: fileHash ?? this.fileHash,
      isProcessed: isProcessed ?? this.isProcessed,
      isSynced: isSynced ?? this.isSynced,
      syncError: syncError ?? this.syncError,
    );
  }
}