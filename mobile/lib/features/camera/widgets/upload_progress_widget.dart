import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import '../providers/upload_provider.dart';

class UploadProgressWidget extends ConsumerWidget {
  final VoidCallback? onComplete;
  final VoidCallback? onCancel;

  const UploadProgressWidget({
    super.key,
    this.onComplete,
    this.onCancel,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uploadState = ref.watch(uploadProvider);

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Progress indicator
          _buildProgressIndicator(context, uploadState),
          
          const SizedBox(height: 16),
          
          // Status text
          _buildStatusText(context, uploadState),
          
          const SizedBox(height: 24),
          
          // Action buttons
          _buildActionButtons(context, ref, uploadState),
        ],
      ),
    );
  }

  Widget _buildProgressIndicator(BuildContext context, UploadState state) {
    return switch (state) {
      _UploadingState(progress: final progress) => Column(
          children: [
            SizedBox(
              width: 80,
              height: 80,
              child: Stack(
                children: [
                  CircularProgressIndicator(
                    value: progress,
                    strokeWidth: 6,
                    backgroundColor: Theme.of(context).colorScheme.outline.withOpacity(0.2),
                  ),
                  Center(
                    child: Text(
                      '${(progress * 100).toInt()}%',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            LinearProgressIndicator(
              value: progress,
              backgroundColor: Theme.of(context).colorScheme.outline.withOpacity(0.2),
            ),
          ],
        ),
      _SuccessState() => Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primaryContainer,
            shape: BoxShape.circle,
          ),
          child: Icon(
            Icons.check_circle,
            size: 48,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
      _ErrorState() => Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.errorContainer,
            shape: BoxShape.circle,
          ),
          child: Icon(
            Icons.error,
            size: 48,
            color: Theme.of(context).colorScheme.error,
          ),
        ),
      _ => const SizedBox(
          width: 80,
          height: 80,
          child: Icon(Icons.upload_file, size: 48),
        ),
    };
  }

  Widget _buildStatusText(BuildContext context, UploadState state) {
    final (title, subtitle) = switch (state) {
      _UploadingState() => (
          'Uploading Receipt',
          'Processing your receipt image...',
        ),
      _SuccessState() => (
          'Upload Complete!',
          'Your receipt has been saved successfully.',
        ),
      _ErrorState(message: final message) => (
          'Upload Failed',
          message,
        ),
      _ => (
          'Ready to Upload',
          'Tap upload to save your receipt.',
        ),
    };

    return Column(
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          subtitle,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildActionButtons(BuildContext context, WidgetRef ref, UploadState state) {
    return switch (state) {
      _UploadingState() => Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: onCancel,
                child: const Text('Cancel'),
              ),
            ),
          ],
        ),
      _SuccessState() => Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: onComplete,
                icon: const Icon(Icons.done),
                label: const Text('Done'),
              ),
            ),
          ],
        ),
      _ErrorState() => Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: onCancel,
                child: const Text('Cancel'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton.icon(
                onPressed: () {
                  // Retry upload - this would need the original image path
                  ref.read(uploadProvider.notifier).reset();
                },
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ),
          ],
        ),
      _ => const SizedBox.shrink(),
    };
  }
}

class UploadProgressDialog extends ConsumerWidget {
  const UploadProgressDialog({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uploadState = ref.watch(uploadProvider);

    return Dialog(
      backgroundColor: Colors.transparent,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 400),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                UploadProgressWidget(
                  onComplete: () => Navigator.of(context).pop(true),
                  onCancel: () => Navigator.of(context).pop(false),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class UploadStatusCard extends StatelessWidget {
  final UploadHistoryItem item;
  final VoidCallback? onRetry;
  final VoidCallback? onRemove;

  const UploadStatusCard({
    super.key,
    required this.item,
    this.onRetry,
    this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _buildStatusIcon(context),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.filename,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(
                        _formatTimestamp(item.timestamp),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                _buildActionButton(context),
              ],
            ),
            
            if (item.status == UploadStatus.uploading) ...[
              const SizedBox(height: 12),
              LinearProgressIndicator(
                value: item.progress,
                backgroundColor: Theme.of(context).colorScheme.outline.withOpacity(0.2),
              ),
            ],
            
            if (item.errorMessage != null) ...[
              const SizedBox(height: 8),
              Text(
                item.errorMessage!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.error,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusIcon(BuildContext context) {
    return switch (item.status) {
      UploadStatus.uploading => CircularProgressIndicator(
          value: item.progress,
          strokeWidth: 3,
        ),
      UploadStatus.completed => Icon(
          Icons.check_circle,
          color: Theme.of(context).colorScheme.primary,
        ),
      UploadStatus.failed => Icon(
          Icons.error,
          color: Theme.of(context).colorScheme.error,
        ),
      UploadStatus.cancelled => Icon(
          Icons.cancel,
          color: Theme.of(context).colorScheme.outline,
        ),
    };
  }

  Widget _buildActionButton(BuildContext context) {
    return switch (item.status) {
      UploadStatus.failed => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              tooltip: 'Retry',
            ),
            IconButton(
              onPressed: onRemove,
              icon: const Icon(Icons.delete_outline),
              tooltip: 'Remove',
            ),
          ],
        ),
      UploadStatus.completed => IconButton(
          onPressed: onRemove,
          icon: const Icon(Icons.delete_outline),
          tooltip: 'Remove',
        ),
      _ => const SizedBox.shrink(),
    };
  }

  String _formatTimestamp(DateTime timestamp) {
    final now = DateTime.now();
    final difference = now.difference(timestamp);

    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inHours < 1) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inDays < 1) {
      return '${difference.inHours}h ago';
    } else {
      return '${difference.inDays}d ago';
    }
  }
}