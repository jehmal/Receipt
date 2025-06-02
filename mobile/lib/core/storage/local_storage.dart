import 'package:hive_flutter/hive_flutter.dart';
import '../../shared/models/receipt.dart';
import '../config/app_config.dart';

class LocalStorage {
  static Box<Receipt>? _receiptBox;
  static Box? _userBox;
  static Box? _settingsBox;

  static Future<void> init() async {
    // Register adapters
    Hive.registerAdapter(ReceiptAdapter());
    
    // Open boxes
    _receiptBox = await Hive.openBox<Receipt>(AppConfig.receiptBoxName);
    _userBox = await Hive.openBox(AppConfig.userBoxName);
    _settingsBox = await Hive.openBox(AppConfig.settingsBoxName);
  }

  // Receipt operations
  static Box<Receipt> get receipts => _receiptBox!;
  
  static Future<void> saveReceipt(Receipt receipt) async {
    await _receiptBox!.put(receipt.id, receipt);
  }
  
  static Receipt? getReceipt(String id) {
    return _receiptBox!.get(id);
  }
  
  static List<Receipt> getAllReceipts() {
    return _receiptBox!.values.toList();
  }
  
  static Future<void> deleteReceipt(String id) async {
    await _receiptBox!.delete(id);
  }

  // User operations
  static Box get user => _userBox!;
  
  static Future<void> saveUserData(String key, dynamic value) async {
    await _userBox!.put(key, value);
  }
  
  static T? getUserData<T>(String key) {
    return _userBox!.get(key);
  }

  // Settings operations
  static Box get settings => _settingsBox!;
  
  static Future<void> saveSetting(String key, dynamic value) async {
    await _settingsBox!.put(key, value);
  }
  
  static T? getSetting<T>(String key) {
    return _settingsBox!.get(key);
  }

  // Delete a specific setting
  static Future<void> deleteSetting(String key) async {
    await _settingsBox!.delete(key);
  }

  // Clear all data
  static Future<void> clearAll() async {
    await _receiptBox!.clear();
    await _userBox!.clear();
    await _settingsBox!.clear();
  }

  // String storage methods for compatibility
  static Future<void> setString(String key, String value) async {
    await _settingsBox!.put(key, value);
  }

  static String? getString(String key) {
    return _settingsBox!.get(key) as String?;
  }

  // JSON encoding/decoding methods
  static Future<void> encodeJson(String key, Map<String, dynamic> data) async {
    await _settingsBox!.put(key, data);
  }

  static Map<String, dynamic>? decodeJson(String key) {
    final data = _settingsBox!.get(key);
    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }
    return null;
  }

  // Remove method
  static Future<void> remove(String key) async {
    await _settingsBox!.delete(key);
  }
}