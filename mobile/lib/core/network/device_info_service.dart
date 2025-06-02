import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:crypto/crypto.dart';
import 'dart:convert';

class DeviceInfoService {
  static final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();
  static Map<String, dynamic>? _cachedDeviceInfo;

  static Future<Map<String, dynamic>> getDeviceInfo() async {
    if (_cachedDeviceInfo != null) {
      return _cachedDeviceInfo!;
    }

    try {
      Map<String, dynamic> deviceData = {};

      if (Platform.isAndroid) {
        final androidInfo = await _deviceInfo.androidInfo;
        deviceData = {
          'name': '${androidInfo.brand} ${androidInfo.model}',
          'type': 'Android',
          'fingerprint': _generateFingerprint({
            'brand': androidInfo.brand,
            'model': androidInfo.model,
            'device': androidInfo.device,
            'androidId': androidInfo.id,
          }),
          'platform': 'android',
          'version': androidInfo.version.release,
          'manufacturer': androidInfo.manufacturer,
          'model': androidInfo.model,
          'isPhysicalDevice': androidInfo.isPhysicalDevice,
        };
      } else if (Platform.isIOS) {
        final iosInfo = await _deviceInfo.iosInfo;
        deviceData = {
          'name': iosInfo.name,
          'type': 'iOS',
          'fingerprint': _generateFingerprint({
            'name': iosInfo.name,
            'model': iosInfo.model,
            'identifierForVendor': iosInfo.identifierForVendor,
          }),
          'platform': 'ios',
          'version': iosInfo.systemVersion,
          'model': iosInfo.model,
          'isPhysicalDevice': iosInfo.isPhysicalDevice,
        };
      }

      _cachedDeviceInfo = deviceData;
      return deviceData;
    } catch (e) {
      // Fallback device info
      return {
        'name': 'Unknown Device',
        'type': Platform.operatingSystem,
        'fingerprint': _generateFingerprint({'platform': Platform.operatingSystem}),
        'platform': Platform.operatingSystem.toLowerCase(),
        'version': 'Unknown',
        'isPhysicalDevice': true,
      };
    }
  }

  static String _generateFingerprint(Map<String, dynamic> data) {
    final jsonString = json.encode(data);
    final bytes = utf8.encode(jsonString);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  static void clearCache() {
    _cachedDeviceInfo = null;
  }
}