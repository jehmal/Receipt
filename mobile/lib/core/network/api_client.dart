import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

import '../config/app_config.dart';
import '../storage/local_storage.dart';
import 'api_exception.dart';
import 'device_info_service.dart';

class ApiClient {
  late final Dio _dio;
  static ApiClient? _instance;
  
  ApiClient._internal() {
    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.baseUrl,
      connectTimeout: const Duration(milliseconds: 30000),
      receiveTimeout: const Duration(milliseconds: 30000),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    _setupInterceptors();
  }

  static ApiClient get instance {
    _instance ??= ApiClient._internal();
    return _instance!;
  }

  void _setupInterceptors() {
    // Auth interceptor
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Add auth token if available
          final token = LocalStorage.getSetting<String>('access_token');
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }

          // Add device info for specific endpoints
          if (_needsDeviceInfo(options.path)) {
            final deviceInfo = await DeviceInfoService.getDeviceInfo();
            if (options.data is Map) {
              options.data = {
                ...options.data,
                'deviceInfo': deviceInfo,
              };
            }
          }

          handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401) {
            // Token expired, try to refresh
            final refreshResult = await _tryRefreshToken();
            if (refreshResult) {
              // Retry original request
              final token = LocalStorage.getSetting<String>('access_token');
              error.requestOptions.headers['Authorization'] = 'Bearer $token';
              
              try {
                final response = await _dio.fetch(error.requestOptions);
                handler.resolve(response);
                return;
              } catch (e) {
                // If retry fails, proceed with logout
              }
            }
            
            // Refresh failed, logout user
            await _handleLogout();
          }
          
          handler.next(error);
        },
      ),
    );

    // Connectivity interceptor
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final connectivityResult = await Connectivity().checkConnectivity();
          if (connectivityResult == ConnectivityResult.none) {
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.connectionError,
                message: 'No internet connection',
              ),
            );
            return;
          }
          handler.next(options);
        },
      ),
    );

    // Error handling interceptor
    _dio.interceptors.add(
      InterceptorsWrapper(
        onError: (error, handler) {
          final apiException = _handleDioError(error);
          handler.reject(
            DioException(
              requestOptions: error.requestOptions,
              response: error.response,
              type: error.type,
              error: apiException,
              message: apiException.message,
            ),
          );
        },
      ),
    );

    // Logging interceptor (debug only)
    if (kDebugMode) {
      _dio.interceptors.add(
        LogInterceptor(
          requestBody: true,
          responseBody: true,
          requestHeader: true,
          responseHeader: false,
          error: true,
          logPrint: (obj) {
            debugPrint('API: $obj');
          },
        ),
      );
    }
  }

  bool _needsDeviceInfo(String path) {
    const deviceInfoPaths = ['/auth/register', '/auth/login', '/auth/refresh'];
    return deviceInfoPaths.any((p) => path.contains(p));
  }

  Future<bool> _tryRefreshToken() async {
    try {
      final refreshToken = LocalStorage.getSetting<String>('refresh_token');
      if (refreshToken == null || refreshToken.isEmpty) {
        return false;
      }

      final deviceInfo = await DeviceInfoService.getDeviceInfo();
      
      final response = await _dio.post(
        '/auth/refresh',
        data: {
          'refreshToken': refreshToken,
          'deviceInfo': deviceInfo,
        },
        options: Options(
          headers: {'Authorization': null}, // Don't include old token
        ),
      );

      if (response.statusCode == 200) {
        final data = response.data['data'];
        await LocalStorage.saveSetting('access_token', data['accessToken']);
        await LocalStorage.saveSetting('refresh_token', data['refreshToken']);
        await LocalStorage.saveSetting('expires_in', data['expiresIn']);
        return true;
      }
    } catch (e) {
      debugPrint('Token refresh failed: $e');
    }
    return false;
  }

  Future<void> _handleLogout() async {
    // Clear stored tokens
    await LocalStorage.saveSetting('access_token', null);
    await LocalStorage.saveSetting('refresh_token', null);
    await LocalStorage.saveSetting('user_data', null);
    
    // TODO: Navigate to login screen
    // This would typically be handled by a navigation service
    debugPrint('User logged out due to authentication failure');
  }

  ApiException _handleDioError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiException(
          message: 'Connection timeout. Please check your internet connection.',
          statusCode: 408,
          type: ApiExceptionType.timeout,
        );
      
      case DioExceptionType.connectionError:
        return ApiException(
          message: 'No internet connection. Please check your network settings.',
          statusCode: 0,
          type: ApiExceptionType.noInternet,
        );
      
      case DioExceptionType.badResponse:
        final response = error.response;
        final statusCode = response?.statusCode ?? 500;
        String message = 'An error occurred';
        
        if (response?.data is Map) {
          final data = response!.data as Map<String, dynamic>;
          message = data['message'] ?? data['error'] ?? message;
        }
        
        return ApiException(
          message: message,
          statusCode: statusCode,
          type: _getExceptionTypeFromStatusCode(statusCode),
        );
      
      case DioExceptionType.cancel:
        return ApiException(
          message: 'Request was cancelled',
          statusCode: 0,
          type: ApiExceptionType.cancel,
        );
      
      default:
        return ApiException(
          message: error.message ?? 'An unexpected error occurred',
          statusCode: 0,
          type: ApiExceptionType.unknown,
        );
    }
  }

  ApiExceptionType _getExceptionTypeFromStatusCode(int statusCode) {
    switch (statusCode) {
      case 400:
        return ApiExceptionType.badRequest;
      case 401:
        return ApiExceptionType.unauthorized;
      case 403:
        return ApiExceptionType.forbidden;
      case 404:
        return ApiExceptionType.notFound;
      case 413:
        return ApiExceptionType.payloadTooLarge;
      case 429:
        return ApiExceptionType.tooManyRequests;
      case 500:
      case 502:
      case 503:
      case 504:
        return ApiExceptionType.serverError;
      default:
        return ApiExceptionType.unknown;
    }
  }

  // Public API methods
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return await _dio.get<T>(
      path,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return await _dio.post<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return await _dio.put<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return await _dio.delete<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response<T>> upload<T>(
    String path, {
    required FormData formData,
    ProgressCallback? onSendProgress,
    Options? options,
  }) async {
    return await _dio.post<T>(
      path,
      data: formData,
      options: options,
      onSendProgress: onSendProgress,
    );
  }

  // Multipart file upload
  Future<Response<T>> uploadFile<T>(
    String path, {
    required File file,
    required String fieldName,
    Map<String, dynamic>? fields,
    ProgressCallback? onSendProgress,
    Options? options,
  }) async {
    final formData = FormData();
    
    // Add file
    formData.files.add(
      MapEntry(
        fieldName,
        await MultipartFile.fromFile(
          file.path,
          filename: file.path.split('/').last,
        ),
      ),
    );
    
    // Add additional fields
    if (fields != null) {
      for (final entry in fields.entries) {
        formData.fields.add(MapEntry(entry.key, entry.value.toString()));
      }
    }
    
    return await upload<T>(
      path,
      formData: formData,
      onSendProgress: onSendProgress,
      options: options,
    );
  }

  // Cancel all requests
  void cancelRequests([String? reason]) {
    _dio.close(force: true);
  }
}