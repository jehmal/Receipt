import 'dart:convert';
import 'dart:typed_data';
import 'dart:math';
import 'package:crypto/crypto.dart';

class EncryptionService {
  // Default key for basic encryption - in production, use proper key management
  static const String _defaultKey = 'receipt_vault_default_key_2024';

  /// Encrypt data using basic XOR encryption
  static String encrypt(String data, {String? key}) {
    final keyToUse = key ?? _defaultKey;
    final bytes = utf8.encode(data);
    final keyBytes = utf8.encode(keyToUse);
    
    // Simple XOR encryption
    final encrypted = <int>[];
    for (int i = 0; i < bytes.length; i++) {
      encrypted.add(bytes[i] ^ keyBytes[i % keyBytes.length]);
    }
    
    return base64.encode(encrypted);
  }

  /// Decrypt data using basic XOR decoding
  static String decrypt(String encryptedData, {String? key}) {
    final keyToUse = key ?? _defaultKey;
    final encrypted = base64.decode(encryptedData);
    final keyBytes = utf8.encode(keyToUse);
    
    // Simple XOR decryption
    final decrypted = <int>[];
    for (int i = 0; i < encrypted.length; i++) {
      decrypted.add(encrypted[i] ^ keyBytes[i % keyBytes.length]);
    }
    
    return utf8.decode(decrypted);
  }

  /// Generate a hash of the input data
  static String hash(String data) {
    final bytes = utf8.encode(data);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  /// Encrypt bytes data
  static Uint8List encryptBytes(Uint8List data, {String? key}) {
    final keyToUse = key ?? _defaultKey;
    final keyBytes = utf8.encode(keyToUse);
    
    // Simple XOR encryption for bytes
    final encrypted = Uint8List(data.length);
    for (int i = 0; i < data.length; i++) {
      encrypted[i] = data[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return encrypted;
  }

  /// Decrypt bytes data
  static Uint8List decryptBytes(Uint8List encryptedData, {String? key}) {
    final keyToUse = key ?? _defaultKey;
    final keyBytes = utf8.encode(keyToUse);
    
    // Simple XOR decryption for bytes
    final decrypted = Uint8List(encryptedData.length);
    for (int i = 0; i < encryptedData.length; i++) {
      decrypted[i] = encryptedData[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return decrypted;
  }

  /// Check if encryption key is valid
  static bool isValidKey(String key) {
    return key.isNotEmpty && key.length >= 8;
  }

  /// Generate a random key
  static String generateKey() {
    final random = Random.secure();
    final bytes = List<int>.generate(32, (i) => random.nextInt(256));
    return base64.encode(bytes);
  }

  /// Hash password with salt
  static String hashPassword(String password, [String? salt]) {
    final saltToUse = salt ?? generateSalt();
    final combined = password + saltToUse;
    final bytes = utf8.encode(combined);
    final digest = sha256.convert(bytes);
    return '${digest.toString()}:$saltToUse';
  }

  /// Generate a random salt
  static String generateSalt() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (i) => random.nextInt(256));
    return base64.encode(bytes);
  }

  /// Verify password against hash
  static bool verifyPassword(String password, String hashedPassword) {
    try {
      final parts = hashedPassword.split(':');
      if (parts.length != 2) return false;
      
      final hash = parts[0];
      final salt = parts[1];
      
      final newHash = hashPassword(password, salt);
      return newHash == hashedPassword;
    } catch (e) {
      return false;
    }
  }
}