import 'package:flutter/material.dart';

class EmptyState extends StatelessWidget {
  final String title;
  final String message;
  final IconData icon;
  final Widget? action;
  final Color? iconColor;

  const EmptyState({
    super.key,
    required this.title,
    required this.message,
    required this.icon,
    this.action,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 80,
              color: iconColor ?? Colors.grey[400],
            ),
            const SizedBox(height: 24),
            Text(
              title,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w600,
                color: Colors.grey[700],
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Colors.grey[600],
              ),
              textAlign: TextAlign.center,
            ),
            if (action != null) ...[
              const SizedBox(height: 32),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

class NoReceiptsEmptyState extends StatelessWidget {
  final VoidCallback? onAddReceipt;

  const NoReceiptsEmptyState({
    super.key,
    this.onAddReceipt,
  });

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      icon: Icons.receipt_long_outlined,
      title: 'No receipts yet',
      message: 'Tap the camera tab to capture your first receipt and start organizing your expenses.',
      action: onAddReceipt != null
          ? ElevatedButton.icon(
              onPressed: onAddReceipt,
              icon: const Icon(Icons.camera_alt),
              label: const Text('Add Receipt'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 12,
                ),
              ),
            )
          : null,
    );
  }
}

class NoSearchResultsEmptyState extends StatelessWidget {
  final String searchQuery;
  final VoidCallback? onClearSearch;

  const NoSearchResultsEmptyState({
    super.key,
    required this.searchQuery,
    this.onClearSearch,
  });

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      icon: Icons.search_off,
      title: 'No results found',
      message: 'No receipts match "$searchQuery". Try adjusting your search terms.',
      action: onClearSearch != null
          ? TextButton.icon(
              onPressed: onClearSearch,
              icon: const Icon(Icons.clear),
              label: const Text('Clear Search'),
            )
          : null,
    );
  }
}

class NoInternetEmptyState extends StatelessWidget {
  final VoidCallback? onRetry;

  const NoInternetEmptyState({
    super.key,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      icon: Icons.wifi_off,
      iconColor: Colors.orange,
      title: 'No Internet Connection',
      message: 'Please check your connection and try again. Your data will sync when connected.',
      action: onRetry != null
          ? ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try Again'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 12,
                ),
              ),
            )
          : null,
    );
  }
}

class OfflineModeEmptyState extends StatelessWidget {
  const OfflineModeEmptyState({super.key});

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      icon: Icons.cloud_off,
      iconColor: Colors.blue,
      title: 'Offline Mode',
      message: 'You\'re viewing cached receipts. Connect to the internet to sync your latest data.',
    );
  }
}

class MaintenanceEmptyState extends StatelessWidget {
  const MaintenanceEmptyState({super.key});

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      icon: Icons.build,
      iconColor: Colors.amber,
      title: 'Under Maintenance',
      message: 'We\'re making some improvements. Please check back in a few minutes.',
    );
  }
}