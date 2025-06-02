import 'package:flutter/material.dart';
import '../../core/network/api_exception.dart';

class ErrorView extends StatelessWidget {
  final String? message;
  final ApiException? error;
  final VoidCallback? onRetry;
  final String? illustration;
  final bool showRetryButton;

  const ErrorView({
    super.key,
    this.message,
    this.error,
    this.onRetry,
    this.illustration,
    this.showRetryButton = true,
  });

  @override
  Widget build(BuildContext context) {
    final displayMessage = _getDisplayMessage();
    final errorIcon = _getErrorIcon();

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              errorIcon,
              size: 80,
              color: _getIconColor(),
            ),
            const SizedBox(height: 24),
            Text(
              _getTitle(),
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              displayMessage,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Colors.grey[600],
              ),
              textAlign: TextAlign.center,
            ),
            if (showRetryButton && onRetry != null) ...[
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Try Again'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 12,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _getDisplayMessage() {
    if (message != null) return message!;
    if (error != null) return error!.userFriendlyMessage;
    return 'Something went wrong. Please try again.';
  }

  String _getTitle() {
    if (error?.type == ApiExceptionType.noInternet) {
      return 'No Internet Connection';
    } else if (error?.type == ApiExceptionType.serverError) {
      return 'Server Error';
    } else if (error?.type == ApiExceptionType.unauthorized) {
      return 'Authentication Required';
    } else if (error?.type == ApiExceptionType.notFound) {
      return 'Not Found';
    }
    return 'Oops! Something went wrong';
  }

  IconData _getErrorIcon() {
    if (error?.type == ApiExceptionType.noInternet) {
      return Icons.wifi_off;
    } else if (error?.type == ApiExceptionType.serverError) {
      return Icons.dns;
    } else if (error?.type == ApiExceptionType.unauthorized) {
      return Icons.lock;
    } else if (error?.type == ApiExceptionType.notFound) {
      return Icons.search_off;
    } else if (error?.type == ApiExceptionType.timeout) {
      return Icons.access_time;
    }
    return Icons.error_outline;
  }

  Color _getIconColor() {
    if (error?.type == ApiExceptionType.noInternet) {
      return Colors.orange;
    } else if (error?.type == ApiExceptionType.serverError) {
      return Colors.red;
    } else if (error?.type == ApiExceptionType.unauthorized) {
      return Colors.amber;
    }
    return Colors.red;
  }
}

class NetworkErrorView extends StatelessWidget {
  final VoidCallback? onRetry;

  const NetworkErrorView({
    super.key,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return ErrorView(
      error: const ApiException(
        message: 'No internet connection',
        statusCode: 0,
        type: ApiExceptionType.noInternet,
      ),
      onRetry: onRetry,
    );
  }
}

class ServerErrorView extends StatelessWidget {
  final VoidCallback? onRetry;

  const ServerErrorView({
    super.key,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return ErrorView(
      error: const ApiException(
        message: 'Server error occurred',
        statusCode: 500,
        type: ApiExceptionType.serverError,
      ),
      onRetry: onRetry,
    );
  }
}

class NotFoundErrorView extends StatelessWidget {
  final String? itemName;

  const NotFoundErrorView({
    super.key,
    this.itemName,
  });

  @override
  Widget build(BuildContext context) {
    return ErrorView(
      error: ApiException(
        message: '${itemName ?? 'Item'} not found',
        statusCode: 404,
        type: ApiExceptionType.notFound,
      ),
      showRetryButton: false,
    );
  }
}