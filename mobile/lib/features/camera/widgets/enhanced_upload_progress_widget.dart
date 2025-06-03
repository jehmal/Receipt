import 'package:flutter/material.dart';
import '../../../core/config/app_theme.dart';

class EnhancedUploadProgressWidget extends StatefulWidget {
  final double progress;
  final String status;
  final String? errorMessage;
  final VoidCallback? onRetry;
  final VoidCallback? onCancel;

  const EnhancedUploadProgressWidget({
    super.key,
    required this.progress,
    required this.status,
    this.errorMessage,
    this.onRetry,
    this.onCancel,
  });

  @override
  State<EnhancedUploadProgressWidget> createState() => _EnhancedUploadProgressWidgetState();
}

class _EnhancedUploadProgressWidgetState extends State<EnhancedUploadProgressWidget>
    with TickerProviderStateMixin {
  late AnimationController _progressController;
  late AnimationController _pulseController;
  late Animation<double> _progressAnimation;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    
    _progressController = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );
    
    _pulseController = AnimationController(
      duration: const Duration(seconds: 1),
      vsync: this,
    );
    
    _progressAnimation = Tween<double>(
      begin: 0.0,
      end: widget.progress,
    ).animate(CurvedAnimation(
      parent: _progressController,
      curve: AppTheme.defaultCurve,
    ));
    
    _pulseAnimation = Tween<double>(
      begin: 0.8,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _pulseController,
      curve: Curves.easeInOut,
    ));
    
    _progressController.animateTo(widget.progress);
    
    if (widget.status == 'Uploading...') {
      _pulseController.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(EnhancedUploadProgressWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    
    if (oldWidget.progress != widget.progress) {
      _progressController.animateTo(widget.progress);
    }
    
    if (oldWidget.status != widget.status) {
      if (widget.status == 'Uploading...') {
        _pulseController.repeat(reverse: true);
      } else {
        _pulseController.stop();
        _pulseController.reset();
      }
    }
  }

  @override
  void dispose() {
    _progressController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isError = widget.errorMessage != null;
    final isComplete = widget.progress >= 1.0 && widget.status == 'Success';
    
    return AnimatedBuilder(
      animation: Listenable.merge([_progressAnimation, _pulseAnimation]),
      builder: (context, child) {
        return Container(
          padding: const EdgeInsets.all(AppTheme.spacingM),
          decoration: BoxDecoration(
            color: isError 
                ? AppTheme.error.withOpacity(0.1)
                : isComplete
                    ? AppTheme.success.withOpacity(0.1)
                    : theme.colorScheme.surfaceVariant,
            borderRadius: BorderRadius.circular(AppTheme.radiusL),
            border: Border.all(
              color: isError 
                  ? AppTheme.error.withOpacity(0.3)
                  : isComplete
                      ? AppTheme.success.withOpacity(0.3)
                      : theme.colorScheme.outline.withOpacity(0.2),
            ),
          ),
          child: Column(
            children: [
              // Header with status and actions
              Row(
                children: [
                  // Status icon
                  _buildStatusIcon(),
                  const SizedBox(width: AppTheme.spacingM),
                  
                  // Status text
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.status,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: isError 
                                ? AppTheme.error
                                : isComplete
                                    ? AppTheme.success
                                    : null,
                          ),
                        ),
                        if (widget.errorMessage != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            widget.errorMessage!,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: AppTheme.error,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  
                  // Action buttons
                  if (isError && widget.onRetry != null) ...[
                    IconButton(
                      onPressed: widget.onRetry,
                      icon: const Icon(Icons.refresh),
                      color: AppTheme.error,
                      tooltip: 'Retry upload',
                    ),
                  ],
                  
                  if (widget.onCancel != null && !isComplete) ...[
                    IconButton(
                      onPressed: widget.onCancel,
                      icon: const Icon(Icons.close),
                      color: theme.colorScheme.onSurfaceVariant,
                      tooltip: 'Cancel upload',
                    ),
                  ],
                ],
              ),
              
              const SizedBox(height: AppTheme.spacingM),
              
              // Progress bar
              if (!isComplete) ...[
                Stack(
                  children: [
                    // Background track
                    Container(
                      height: 6,
                      decoration: BoxDecoration(
                        color: theme.colorScheme.outline.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                    
                    // Progress fill
                    FractionallySizedBox(
                      widthFactor: _progressAnimation.value,
                      child: Container(
                        height: 6,
                        decoration: BoxDecoration(
                          color: isError 
                              ? AppTheme.error
                              : AppTheme.uploadProgressColor,
                          borderRadius: BorderRadius.circular(3),
                          boxShadow: [
                            BoxShadow(
                              color: (isError 
                                  ? AppTheme.error
                                  : AppTheme.uploadProgressColor).withOpacity(0.3),
                              blurRadius: 4,
                              spreadRadius: 1,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: AppTheme.spacingS),
                
                // Progress percentage
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${(_progressAnimation.value * 100).toInt()}%',
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: isError 
                            ? AppTheme.error
                            : theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    if (widget.status == 'Uploading...') ...[
                      Transform.scale(
                        scale: _pulseAnimation.value,
                        child: Icon(
                          Icons.cloud_upload_outlined,
                          size: 16,
                          color: AppTheme.uploadProgressColor,
                        ),
                      ),
                    ],
                  ],
                ),
              ] else ...[
                // Success animation
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.check_circle,
                      color: AppTheme.success,
                      size: 24,
                    ),
                    const SizedBox(width: AppTheme.spacingS),
                    Text(
                      'Receipt uploaded successfully!',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppTheme.success,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatusIcon() {
    final theme = Theme.of(context);
    final isError = widget.errorMessage != null;
    final isComplete = widget.progress >= 1.0 && widget.status == 'Success';
    final isUploading = widget.status == 'Uploading...';

    if (isError) {
      return Icon(
        Icons.error_outline,
        color: AppTheme.error,
        size: 24,
      );
    }

    if (isComplete) {
      return Icon(
        Icons.check_circle_outline,
        color: AppTheme.success,
        size: 24,
      );
    }

    if (isUploading) {
      return Transform.scale(
        scale: _pulseAnimation.value,
        child: SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            value: _progressAnimation.value,
            backgroundColor: theme.colorScheme.outline.withOpacity(0.2),
            valueColor: AlwaysStoppedAnimation<Color>(
              AppTheme.uploadProgressColor,
            ),
          ),
        ),
      );
    }

    return Icon(
      Icons.cloud_upload_outlined,
      color: theme.colorScheme.onSurfaceVariant,
      size: 24,
    );
  }
}