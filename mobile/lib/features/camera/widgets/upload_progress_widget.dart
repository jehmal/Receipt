import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
    if (state is UploadUploadingState) {
      return Column(
        children: [
          SizedBox(
            width: 80,
            height: 80,
            child: Stack(
              children: [
                CircularProgressIndicator(
                  value: state.progress,
                  strokeWidth: 6,
                  backgroundColor: Theme.of(context).colorScheme.outline.withOpacity(0.2),
                ),
                Center(
                  child: Text(
                    '${(state.progress * 100).toInt()}%',
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
            value: state.progress,
            backgroundColor: Theme.of(context).colorScheme.outline.withOpacity(0.2),
          ),
        ],
      );
    } else if (state is UploadSuccessState) {
      return Container(
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
      );
    } else if (state is UploadErrorState) {
      return Container(
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
      );
    } else {
      return const SizedBox(
        width: 80,
        height: 80,
        child: Icon(Icons.upload_file, size: 48),
      );
    }
  }

  Widget _buildStatusText(BuildContext context, UploadState state) {
    String title;
    String subtitle;

    if (state is UploadUploadingState) {
      title = 'Uploading Receipt';
      subtitle = 'Processing your receipt image...';
    } else if (state is UploadSuccessState) {
      title = 'Upload Complete!';
      subtitle = 'Your receipt has been saved successfully.';
    } else if (state is UploadErrorState) {
      title = 'Upload Failed';
      subtitle = state.message;
    } else {
      title = 'Ready to Upload';
      subtitle = 'Tap upload to save your receipt.';
    }

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
    if (state is UploadUploadingState) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          OutlinedButton(
            onPressed: onCancel,
            child: const Text('Cancel'),
          ),
        ],
      );
    } else if (state is UploadSuccessState) {
      return Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: () {
                ref.read(uploadProvider.notifier).reset();
              },
              child: const Text('Upload Another'),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: ElevatedButton(
              onPressed: onComplete,
              child: const Text('View Receipt'),
            ),
          ),
        ],
      );
    } else if (state is UploadErrorState) {
      return Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: () {
                ref.read(uploadProvider.notifier).reset();
              },
              child: const Text('Try Again'),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: ElevatedButton(
              onPressed: onCancel,
              child: const Text('Cancel'),
            ),
          ),
        ],
      );
    } else {
      return SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: () {
            // This should be handled by parent widget
          },
          icon: const Icon(Icons.cloud_upload),
          label: const Text('Start Upload'),
        ),
      );
    }
  }
}

class UploadProgressDialog extends StatelessWidget {
  final VoidCallback? onComplete;
  final VoidCallback? onCancel;

  const UploadProgressDialog({
    super.key,
    this.onComplete,
    this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: UploadProgressWidget(
        onComplete: onComplete,
        onCancel: onCancel,
      ),
    );
  }
}

class UploadProgressBottomSheet extends StatelessWidget {
  final VoidCallback? onComplete;
  final VoidCallback? onCancel;

  const UploadProgressBottomSheet({
    super.key,
    this.onComplete,
    this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: UploadProgressWidget(
        onComplete: onComplete,
        onCancel: onCancel,
      ),
    );
  }

  static void show(
    BuildContext context, {
    VoidCallback? onComplete,
    VoidCallback? onCancel,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => UploadProgressBottomSheet(
        onComplete: onComplete,
        onCancel: onCancel,
      ),
    );
  }
}