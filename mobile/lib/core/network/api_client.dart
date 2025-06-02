import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';

class ApiClient {
  static ApiClient? _instance;
  late Dio _dio;
  
  static const _secureStorage = FlutterSecureStorage();

  factory ApiClient() {
    _instance ??= ApiClient._internal();
    return _instance!;
  }

  ApiClient._internal() {
    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    _setupInterceptors();
  }

  void _setupInterceptors() {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _secureStorage.read(key: 'auth_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        if (error.response?.statusCode == 401) {
          _handleUnauthorized();
        }
        handler.next(error);
      },
    ));
  }

  void _handleUnauthorized() async {
    await _secureStorage.delete(key: 'auth_token');
  }

  Future<Response> get(String path, {Map<String, dynamic>? queryParameters, Map<String, dynamic>? headers}) async {
    try {
      return await _dio.get(path, queryParameters: queryParameters, options: Options(headers: headers));
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<Response> post(String path, dynamic data, {Map<String, dynamic>? queryParameters, Map<String, dynamic>? headers}) async {
    try {
      return await _dio.post(path, data: data, queryParameters: queryParameters, options: Options(headers: headers));
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<Response> put(String path, dynamic data, {Map<String, dynamic>? queryParameters, Map<String, dynamic>? headers}) async {
    try {
      return await _dio.put(path, data: data, queryParameters: queryParameters, options: Options(headers: headers));
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<Response> delete(String path, {Map<String, dynamic>? queryParameters, Map<String, dynamic>? headers}) async {
    try {
      return await _dio.delete(path, queryParameters: queryParameters, options: Options(headers: headers));
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<Response> uploadFile(String path, String filePath, {String fileKey = 'file', Map<String, dynamic>? data, ProgressCallback? onSendProgress}) async {
    try {
      final formData = FormData.fromMap({
        fileKey: await MultipartFile.fromFile(filePath),
        ...?data,
      });
      return await _dio.post(path, data: formData, onSendProgress: onSendProgress);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  ApiException _handleDioError(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
        return ApiException('Connection timeout', 'TIMEOUT');
      case DioExceptionType.sendTimeout:
        return ApiException('Request timeout', 'TIMEOUT');
      case DioExceptionType.receiveTimeout:
        return ApiException('Response timeout', 'TIMEOUT');
      case DioExceptionType.badResponse:
        final statusCode = e.response?.statusCode;
        final message = e.response?.data?['message'] ?? 'Unknown error';
        return ApiException(message, 'HTTP_$statusCode');
      case DioExceptionType.cancel:
        return ApiException('Request cancelled', 'CANCELLED');
      case DioExceptionType.connectionError:
        return ApiException('No internet connection', 'NO_INTERNET');
      default:
        return ApiException('Something went wrong', 'UNKNOWN');
    }
  }
}

class ApiException implements Exception {
  final String message;
  final String code;
  ApiException(this.message, this.code);
  @override
  String toString() => 'ApiException: $message (Code: $code)';
}