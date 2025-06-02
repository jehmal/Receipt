import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

import '../../shared/models/receipt.dart';
import '../../shared/models/user.dart';

class DatabaseHelper {
  static const String _databaseName = 'receipt_vault.db';
  static const int _databaseVersion = 1;

  // Table names
  static const String _receiptsTable = 'receipts';
  static const String _syncQueueTable = 'sync_queue';
  static const String _usersTable = 'users';
  static const String _settingsTable = 'settings';

  static Database? _database;
  static DatabaseHelper? _instance;

  DatabaseHelper._internal();

  static DatabaseHelper get instance {
    _instance ??= DatabaseHelper._internal();
    return _instance!;
  }

  Future<Database> get database async {
    _database ??= await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final documentsDirectory = await getApplicationDocumentsDirectory();
    final path = join(documentsDirectory.path, _databaseName);

    return await openDatabase(
      path,
      version: _databaseVersion,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
      onConfigure: _onConfigure,
    );
  }

  Future<void> _onConfigure(Database db) async {
    await db.execute('PRAGMA foreign_keys = ON');
  }

  Future<void> _onCreate(Database db, int version) async {
    await _createTables(db);
    await _createIndexes(db);
  }

  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < newVersion) {
      // Handle database migrations here
      // For now, we'll just recreate tables
      await _dropTables(db);
      await _createTables(db);
      await _createIndexes(db);
    }
  }

  Future<void> _createTables(Database db) async {
    // Receipts table
    await db.execute('''
      CREATE TABLE $_receiptsTable (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        company_id TEXT,
        original_filename TEXT,
        file_path TEXT,
        local_file_path TEXT,
        file_size INTEGER,
        file_hash TEXT,
        mime_type TEXT,
        status TEXT NOT NULL DEFAULT 'uploaded',
        vendor_name TEXT,
        total_amount REAL,
        currency TEXT DEFAULT 'USD',
        receipt_date INTEGER,
        category TEXT,
        description TEXT,
        tags TEXT,
        thumbnail_path TEXT,
        ocr_text TEXT,
        ocr_confidence REAL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_synced INTEGER NOT NULL DEFAULT 0,
        sync_error TEXT
      )
    ''');

    // Sync queue table for offline operations
    await db.execute('''
      CREATE TABLE $_syncQueueTable (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        retry_count INTEGER DEFAULT 0,
        last_retry_at INTEGER,
        error_message TEXT
      )
    ''');

    // Users table for caching user data
    await db.execute('''
      CREATE TABLE $_usersTable (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        role TEXT NOT NULL,
        company_id TEXT,
        phone TEXT,
        last_login_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    ''');

    // Settings table for app preferences
    await db.execute('''
      CREATE TABLE $_settingsTable (
        key TEXT PRIMARY KEY,
        value TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    ''');
  }

  Future<void> _createIndexes(Database db) async {
    // Receipts indexes
    await db.execute('CREATE INDEX idx_receipts_user_id ON $_receiptsTable(user_id)');
    await db.execute('CREATE INDEX idx_receipts_created_at ON $_receiptsTable(created_at)');
    await db.execute('CREATE INDEX idx_receipts_receipt_date ON $_receiptsTable(receipt_date)');
    await db.execute('CREATE INDEX idx_receipts_vendor_name ON $_receiptsTable(vendor_name)');
    await db.execute('CREATE INDEX idx_receipts_category ON $_receiptsTable(category)');
    await db.execute('CREATE INDEX idx_receipts_status ON $_receiptsTable(status)');
    await db.execute('CREATE INDEX idx_receipts_is_synced ON $_receiptsTable(is_synced)');

    // Sync queue indexes
    await db.execute('CREATE INDEX idx_sync_queue_created_at ON $_syncQueueTable(created_at)');
    await db.execute('CREATE INDEX idx_sync_queue_entity_type ON $_syncQueueTable(entity_type)');
    await db.execute('CREATE INDEX idx_sync_queue_retry_count ON $_syncQueueTable(retry_count)');
  }

  Future<void> _dropTables(Database db) async {
    await db.execute('DROP TABLE IF EXISTS $_receiptsTable');
    await db.execute('DROP TABLE IF EXISTS $_syncQueueTable');
    await db.execute('DROP TABLE IF EXISTS $_usersTable');
    await db.execute('DROP TABLE IF EXISTS $_settingsTable');
  }

  // Receipt CRUD operations
  Future<int> insertReceipt(Receipt receipt) async {
    final db = await database;
    final data = _receiptToMap(receipt);
    return await db.insert(_receiptsTable, data, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<Receipt>> getAllReceipts({
    String? userId,
    int? limit,
    int? offset,
    String? orderBy,
    bool? descending,
  }) async {
    final db = await database;
    
    String query = 'SELECT * FROM $_receiptsTable';
    List<dynamic> args = [];

    if (userId != null) {
      query += ' WHERE user_id = ?';
      args.add(userId);
    }

    if (orderBy != null) {
      query += ' ORDER BY $orderBy';
      if (descending == true) {
        query += ' DESC';
      }
    } else {
      query += ' ORDER BY created_at DESC';
    }

    if (limit != null) {
      query += ' LIMIT $limit';
      if (offset != null) {
        query += ' OFFSET $offset';
      }
    }

    final List<Map<String, dynamic>> maps = await db.rawQuery(query, args);
    return maps.map((map) => _mapToReceipt(map)).toList();
  }

  Future<Receipt?> getReceiptById(String id) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      _receiptsTable,
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );

    if (maps.isNotEmpty) {
      return _mapToReceipt(maps.first);
    }
    return null;
  }

  Future<int> updateReceipt(Receipt receipt) async {
    final db = await database;
    final data = _receiptToMap(receipt);
    return await db.update(
      _receiptsTable,
      data,
      where: 'id = ?',
      whereArgs: [receipt.id],
    );
  }

  Future<int> deleteReceipt(String id) async {
    final db = await database;
    return await db.delete(
      _receiptsTable,
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<List<Receipt>> searchReceipts({
    String? query,
    String? category,
    DateTime? startDate,
    DateTime? endDate,
    String? vendorName,
    double? minAmount,
    double? maxAmount,
    List<String>? tags,
    String? userId,
  }) async {
    final db = await database;
    
    String sql = 'SELECT * FROM $_receiptsTable WHERE 1=1';
    List<dynamic> args = [];

    if (userId != null) {
      sql += ' AND user_id = ?';
      args.add(userId);
    }

    if (query != null && query.isNotEmpty) {
      sql += ' AND (vendor_name LIKE ? OR description LIKE ? OR ocr_text LIKE ?)';
      final searchQuery = '%$query%';
      args.addAll([searchQuery, searchQuery, searchQuery]);
    }

    if (category != null) {
      sql += ' AND category = ?';
      args.add(category);
    }

    if (vendorName != null) {
      sql += ' AND vendor_name = ?';
      args.add(vendorName);
    }

    if (startDate != null) {
      sql += ' AND receipt_date >= ?';
      args.add(startDate.millisecondsSinceEpoch);
    }

    if (endDate != null) {
      sql += ' AND receipt_date <= ?';
      args.add(endDate.millisecondsSinceEpoch);
    }

    if (minAmount != null) {
      sql += ' AND total_amount >= ?';
      args.add(minAmount);
    }

    if (maxAmount != null) {
      sql += ' AND total_amount <= ?';
      args.add(maxAmount);
    }

    if (tags != null && tags.isNotEmpty) {
      for (final tag in tags) {
        sql += ' AND tags LIKE ?';
        args.add('%$tag%');
      }
    }

    sql += ' ORDER BY created_at DESC';

    final List<Map<String, dynamic>> maps = await db.rawQuery(sql, args);
    return maps.map((map) => _mapToReceipt(map)).toList();
  }

  // Sync queue operations
  Future<int> addToSyncQueue({
    required String action,
    required String entityType,
    String? entityId,
    required Map<String, dynamic> payload,
  }) async {
    final db = await database;
    final now = DateTime.now().millisecondsSinceEpoch;
    
    return await db.insert(_syncQueueTable, {
      'action': action,
      'entity_type': entityType,
      'entity_id': entityId,
      'payload': jsonEncode(payload),
      'created_at': now,
      'retry_count': 0,
    });
  }

  Future<List<Map<String, dynamic>>> getPendingSyncItems({int limit = 10}) async {
    final db = await database;
    return await db.query(
      _syncQueueTable,
      orderBy: 'created_at ASC',
      limit: limit,
    );
  }

  Future<int> updateSyncItem(int id, {
    int? retryCount,
    String? errorMessage,
  }) async {
    final db = await database;
    final data = <String, dynamic>{
      'updated_at': DateTime.now().millisecondsSinceEpoch,
    };

    if (retryCount != null) {
      data['retry_count'] = retryCount;
      data['last_retry_at'] = DateTime.now().millisecondsSinceEpoch;
    }

    if (errorMessage != null) {
      data['error_message'] = errorMessage;
    }

    return await db.update(
      _syncQueueTable,
      data,
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<int> removeSyncItem(int id) async {
    final db = await database;
    return await db.delete(
      _syncQueueTable,
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // User operations
  Future<int> insertUser(User user) async {
    final db = await database;
    final data = _userToMap(user);
    return await db.insert(_usersTable, data, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<User?> getUserById(String id) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      _usersTable,
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );

    if (maps.isNotEmpty) {
      return _mapToUser(maps.first);
    }
    return null;
  }

  // Settings operations
  Future<int> setSetting(String key, String value) async {
    final db = await database;
    final now = DateTime.now().millisecondsSinceEpoch;
    
    return await db.insert(
      _settingsTable,
      {
        'key': key,
        'value': value,
        'created_at': now,
        'updated_at': now,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<String?> getSetting(String key) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      _settingsTable,
      columns: ['value'],
      where: 'key = ?',
      whereArgs: [key],
      limit: 1,
    );

    if (maps.isNotEmpty) {
      return maps.first['value'] as String?;
    }
    return null;
  }

  Future<int> deleteSetting(String key) async {
    final db = await database;
    return await db.delete(
      _settingsTable,
      where: 'key = ?',
      whereArgs: [key],
    );
  }

  // Database maintenance
  Future<void> clearAllData() async {
    final db = await database;
    await db.transaction((txn) async {
      await txn.delete(_receiptsTable);
      await txn.delete(_syncQueueTable);
      await txn.delete(_usersTable);
      await txn.delete(_settingsTable);
    });
  }

  Future<void> vacuum() async {
    final db = await database;
    await db.execute('VACUUM');
  }

  Future<int> getDatabaseSize() async {
    final documentsDirectory = await getApplicationDocumentsDirectory();
    final path = join(documentsDirectory.path, _databaseName);
    final file = File(path);
    
    if (await file.exists()) {
      return await file.length();
    }
    return 0;
  }

  // Helper methods for data conversion
  Map<String, dynamic> _receiptToMap(Receipt receipt) {
    return {
      'id': receipt.id,
      'user_id': receipt.userId,
      'company_id': receipt.companyId,
      'original_filename': receipt.originalFilename,
      'file_path': receipt.filePath,
      'local_file_path': receipt.localImagePath,
      'file_size': receipt.fileSize,
      'file_hash': receipt.fileHash,
      'mime_type': receipt.mimeType,
      'status': receipt.status,
      'vendor_name': receipt.vendorName,
      'total_amount': receipt.totalAmount,
      'currency': receipt.currency,
      'receipt_date': receipt.receiptDate?.millisecondsSinceEpoch,
      'category': receipt.category,
      'description': receipt.description,
      'tags': receipt.tags.join(','),
      'thumbnail_path': receipt.thumbnailPath,
      'ocr_text': receipt.ocrText,
      'ocr_confidence': receipt.ocrConfidence,
      'created_at': receipt.createdAt.millisecondsSinceEpoch,
      'updated_at': receipt.updatedAt.millisecondsSinceEpoch,
      'is_synced': receipt.isSynced ? 1 : 0,
      'sync_error': receipt.syncError,
    };
  }

  Receipt _mapToReceipt(Map<String, dynamic> map) {
    return Receipt(
      id: map['id'],
      userId: map['user_id'],
      companyId: map['company_id'],
      originalFilename: map['original_filename'],
      filePath: map['file_path'],
      fileSize: map['file_size'],
      fileHash: map['file_hash'],
      mimeType: map['mime_type'],
      status: map['status'] ?? 'uploaded',
      vendorName: map['vendor_name'],
      totalAmount: map['total_amount']?.toDouble(),
      currency: map['currency'] ?? 'USD',
      receiptDate: map['receipt_date'] != null
          ? DateTime.fromMillisecondsSinceEpoch(map['receipt_date'])
          : null,
      category: map['category'],
      description: map['description'],
      tags: map['tags'] != null
          ? (map['tags'] as String).split(',').where((t) => t.isNotEmpty).toList()
          : [],
      thumbnailPath: map['thumbnail_path'],
      ocrText: map['ocr_text'],
      ocrConfidence: map['ocr_confidence']?.toDouble(),
      createdAt: DateTime.fromMillisecondsSinceEpoch(map['created_at']),
      updatedAt: DateTime.fromMillisecondsSinceEpoch(map['updated_at']),
      localImagePath: map['local_file_path'],
      isSynced: map['is_synced'] == 1,
      syncError: map['sync_error'],
    );
  }

  Map<String, dynamic> _userToMap(User user) {
    return {
      'id': user.id,
      'email': user.email,
      'first_name': user.firstName,
      'last_name': user.lastName,
      'role': user.role,
      'company_id': user.companyId,
      'phone': user.phone,
      'last_login_at': user.lastLoginAt?.millisecondsSinceEpoch,
      'created_at': user.createdAt.millisecondsSinceEpoch,
      'updated_at': user.updatedAt.millisecondsSinceEpoch,
    };
  }

  User _mapToUser(Map<String, dynamic> map) {
    return User(
      id: map['id'],
      email: map['email'],
      firstName: map['first_name'],
      lastName: map['last_name'],
      role: map['role'],
      companyId: map['company_id'],
      phone: map['phone'],
      lastLoginAt: map['last_login_at'] != null
          ? DateTime.fromMillisecondsSinceEpoch(map['last_login_at'])
          : null,
      createdAt: DateTime.fromMillisecondsSinceEpoch(map['created_at']),
      updatedAt: DateTime.fromMillisecondsSinceEpoch(map['updated_at']),
    );
  }

  Future<void> close() async {
    final db = await database;
    await db.close();
  }
}