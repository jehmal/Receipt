import 'package:freezed_annotation/freezed_annotation.dart';

part 'warranty.freezed.dart';
part 'warranty.g.dart';

@freezed
class Warranty with _$Warranty {
  const factory Warranty({
    required String id,
    required String itemName,
    required String category,
    required DateTime purchaseDate,
    required DateTime expiryDate,
    String? brand,
    String? model,
    String? serialNumber,
    double? purchasePrice,
    String? store,
    String? receiptPath,
    String? warrantyDocumentPath,
    String? notes,
    @Default(false) bool blockchainStamped,
    String? blockchainHash,
    @Default(false) bool isNewRecord,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) = _Warranty;

  factory Warranty.fromJson(Map<String, dynamic> json) => _$WarrantyFromJson(json);

  // Custom methods
  const Warranty._();

  bool get isExpired => DateTime.now().isAfter(expiryDate);
  
  bool get isExpiringSoon {
    final thirtyDaysFromNow = DateTime.now().add(const Duration(days: 30));
    return !isExpired && expiryDate.isBefore(thirtyDaysFromNow);
  }
  
  int get daysUntilExpiry {
    final now = DateTime.now();
    if (isExpired) return 0;
    return expiryDate.difference(now).inDays;
  }
  
  String get warrantyStatus {
    if (isExpired) return 'Expired';
    if (isExpiringSoon) return 'Expiring Soon';
    return 'Active';
  }
  
  Duration get warrantyPeriod => expiryDate.difference(purchaseDate);
  
  int get warrantyYears => warrantyPeriod.inDays ~/ 365;
  
  // Create a new warranty with default values
  factory Warranty.create({
    required String itemName,
    required String category,
    required DateTime purchaseDate,
    required DateTime expiryDate,
    String? brand,
    String? model,
    String? serialNumber,
    double? purchasePrice,
    String? store,
    String? receiptPath,
    String? warrantyDocumentPath,
    String? notes,
  }) {
    return Warranty(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      itemName: itemName,
      category: category,
      purchaseDate: purchaseDate,
      expiryDate: expiryDate,
      brand: brand,
      model: model,
      serialNumber: serialNumber,
      purchasePrice: purchasePrice,
      store: store,
      receiptPath: receiptPath,
      warrantyDocumentPath: warrantyDocumentPath,
      notes: notes,
      isNewRecord: true,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
  }
}

// Common warranty categories for tradespeople
class WarrantyCategories {
  static const List<String> categories = [
    'Power Tools',
    'Hand Tools',
    'Equipment',
    'Safety Gear',
    'Vehicles',
    'Electronics',
    'Appliances',
    'Hardware',
    'Software',
    'Other',
  ];
  
  static const Map<String, List<String>> subcategories = {
    'Power Tools': [
      'Drills',
      'Saws',
      'Sanders',
      'Grinders',
      'Nail Guns',
      'Impact Drivers',
      'Rotary Tools',
    ],
    'Hand Tools': [
      'Wrenches',
      'Screwdrivers',
      'Hammers',
      'Pliers',
      'Measuring Tools',
      'Cutting Tools',
    ],
    'Equipment': [
      'Generators',
      'Compressors',
      'Welders',
      'Ladders',
      'Scaffolding',
      'Lifting Equipment',
    ],
    'Safety Gear': [
      'Hard Hats',
      'Safety Glasses',
      'Gloves',
      'Boots',
      'Harnesses',
      'Respirators',
    ],
    'Vehicles': [
      'Trucks',
      'Trailers',
      'Forklifts',
      'Excavators',
      'Other Machinery',
    ],
    'Electronics': [
      'Tablets',
      'Phones',
      'Computers',
      'Cameras',
      'GPS Devices',
      'Radios',
    ],
  };
}

// Warranty notification settings
@freezed
class WarrantyNotificationSettings with _$WarrantyNotificationSettings {
  const factory WarrantyNotificationSettings({
    @Default(true) bool enabled,
    @Default(30) int daysBeforeExpiry,
    @Default(true) bool emailNotifications,
    @Default(true) bool pushNotifications,
    @Default(false) bool smsNotifications,
    String? emailAddress,
    String? phoneNumber,
  }) = _WarrantyNotificationSettings;

  factory WarrantyNotificationSettings.fromJson(Map<String, dynamic> json) =>
      _$WarrantyNotificationSettingsFromJson(json);
}

// Warranty search/filter helpers
class WarrantyFilters {
  static List<Warranty> filterByStatus(List<Warranty> warranties, String status) {
    switch (status.toLowerCase()) {
      case 'active':
        return warranties.where((w) => !w.isExpired).toList();
      case 'expired':
        return warranties.where((w) => w.isExpired).toList();
      case 'expiring_soon':
        return warranties.where((w) => w.isExpiringSoon).toList();
      default:
        return warranties;
    }
  }
  
  static List<Warranty> filterByCategory(List<Warranty> warranties, String category) {
    return warranties.where((w) => w.category == category).toList();
  }
  
  static List<Warranty> searchByText(List<Warranty> warranties, String query) {
    final lowerQuery = query.toLowerCase();
    return warranties.where((w) =>
        w.itemName.toLowerCase().contains(lowerQuery) ||
        w.category.toLowerCase().contains(lowerQuery) ||
        (w.brand?.toLowerCase().contains(lowerQuery) ?? false) ||
        (w.model?.toLowerCase().contains(lowerQuery) ?? false) ||
        (w.serialNumber?.toLowerCase().contains(lowerQuery) ?? false)
    ).toList();
  }
  
  static List<Warranty> sortByExpiryDate(List<Warranty> warranties, {bool ascending = true}) {
    final sorted = [...warranties];
    sorted.sort((a, b) {
      final comparison = a.expiryDate.compareTo(b.expiryDate);
      return ascending ? comparison : -comparison;
    });
    return sorted;
  }
  
  static List<Warranty> sortByPurchaseDate(List<Warranty> warranties, {bool ascending = false}) {
    final sorted = [...warranties];
    sorted.sort((a, b) {
      final comparison = a.purchaseDate.compareTo(b.purchaseDate);
      return ascending ? comparison : -comparison;
    });
    return sorted;
  }
  
  static List<Warranty> sortByValue(List<Warranty> warranties, {bool ascending = false}) {
    final sorted = [...warranties];
    sorted.sort((a, b) {
      final aPrice = a.purchasePrice ?? 0;
      final bPrice = b.purchasePrice ?? 0;
      final comparison = aPrice.compareTo(bPrice);
      return ascending ? comparison : -comparison;
    });
    return sorted;
  }
}