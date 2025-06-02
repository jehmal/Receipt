enum ApiExceptionType {
  timeout,
  noInternet,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  payloadTooLarge,
  tooManyRequests,
  serverError,
  cancel,
  unknown,
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  final ApiExceptionType type;
  final dynamic details;

  const ApiException({
    required this.message,
    required this.statusCode,
    required this.type,
    this.details,
  });

  @override
  String toString() {
    return 'ApiException: $message (Status: $statusCode, Type: $type)';
  }

  bool get isNetworkError => type == ApiExceptionType.noInternet || type == ApiExceptionType.timeout;
  bool get isServerError => type == ApiExceptionType.serverError;
  bool get isClientError => [
    ApiExceptionType.badRequest,
    ApiExceptionType.unauthorized,
    ApiExceptionType.forbidden,
    ApiExceptionType.notFound,
  ].contains(type);

  String get userFriendlyMessage {
    switch (type) {
      case ApiExceptionType.noInternet:
        return 'No internet connection. Please check your network settings.';
      case ApiExceptionType.timeout:
        return 'Connection timeout. Please try again.';
      case ApiExceptionType.unauthorized:
        return 'Session expired. Please login again.';
      case ApiExceptionType.forbidden:
        return 'You don\'t have permission to perform this action.';
      case ApiExceptionType.notFound:
        return 'The requested resource was not found.';
      case ApiExceptionType.payloadTooLarge:
        return 'File is too large. Please select a smaller file.';
      case ApiExceptionType.tooManyRequests:
        return 'Too many requests. Please wait and try again.';
      case ApiExceptionType.serverError:
        return 'Server error. Please try again later.';
      case ApiExceptionType.cancel:
        return 'Request was cancelled.';
      default:
        return message;
    }
  }
}