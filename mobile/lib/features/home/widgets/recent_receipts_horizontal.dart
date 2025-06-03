import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_theme.dart';
import '../../../shared/models/receipt.dart';
import '../../receipts/providers/receipts_provider.dart';
import '../../receipts/widgets/receipt_thumbnail.dart';

class RecentReceiptsHorizontal extends ConsumerWidget {
  const RecentReceiptsHorizontal({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final receiptsAsync = ref.watch(receiptsProvider);
    
    return receiptsAsync.when(
      data: (receipts) {
        if (receipts.isEmpty) {
          return _buildEmptyState(context);
        }
        
        // Take only the 5 most recent receipts
        final recentReceipts = receipts.take(5).toList();
        
        return SizedBox(
          height: 120,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingS),
            itemCount: recentReceipts.length,
            separatorBuilder: (context, index) => const SizedBox(width: AppTheme.spacingM),
            itemBuilder: (context, index) {
              final receipt = recentReceipts[index];
              return _buildReceiptCard(context, receipt, index);
            },
          ),
        );
      },
      loading: () => _buildLoadingState(),
      error: (error, stack) => _buildErrorState(context, error),
    );
  }

  Widget _buildReceiptCard(BuildContext context, Receipt receipt, int index) {
    return Hero(
      tag: 'receipt_${receipt.id}',
      child: AnimatedContainer(
        duration: Duration(milliseconds: 300 + (index * 100)),
        curve: AppTheme.defaultCurve,
        width: 100,
        child: Card(
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusL),
          ),
          child: InkWell(
            onTap: () {
              AppTheme.lightHaptic();
              _navigateToReceiptDetail(context, receipt);
            },
            borderRadius: BorderRadius.circular(AppTheme.radiusL),
            child: Padding(
              padding: const EdgeInsets.all(AppTheme.spacingS),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Receipt thumbnail or icon
                  Expanded(
                    child: Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surfaceVariant,
                        borderRadius: BorderRadius.circular(AppTheme.radiusM),
                      ),
                      child: receipt.imagePath != null
                          ? ReceiptThumbnail(
                              receipt: receipt,
                              onTap: () => _navigateToReceiptDetail(context, receipt),
                            )
                          : Icon(
                              Icons.receipt_outlined,
                              size: 32,
                              color: Theme.of(context).colorScheme.onSurfaceVariant,
                            ),
                    ),
                  ),
                  
                  const SizedBox(height: AppTheme.spacingS),
                  
                  // Vendor name
                  Text(
                    receipt.vendorName ?? 'Unknown',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  
                  // Amount
                  if (receipt.totalAmount != null) ...[
                    Text(
                      '\$${receipt.totalAmount!.toStringAsFixed(2)}',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: AppTheme.success,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                  
                  // Sync indicator
                  if (!receipt.isSynced) ...[
                    const SizedBox(height: 2),
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: AppTheme.syncIndicatorColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Container(
      height: 120,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.3),
        borderRadius: BorderRadius.circular(AppTheme.radiusL),
        border: Border.all(
          color: Theme.of(context).colorScheme.outline.withOpacity(0.2),
          style: BorderStyle.solid,
        ),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.receipt_long_outlined,
              size: 32,
              color: Theme.of(context).colorScheme.onSurfaceVariant.withOpacity(0.6),
            ),
            const SizedBox(height: AppTheme.spacingS),
            Text(
              'No receipts yet',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant.withOpacity(0.8),
              ),
            ),
            Text(
              'Tap capture to get started',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant.withOpacity(0.6),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingState() {
    return SizedBox(
      height: 120,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingS),
        itemCount: 5,
        separatorBuilder: (context, index) => const SizedBox(width: AppTheme.spacingM),
        itemBuilder: (context, index) {
          return Container(
            width: 100,
            decoration: BoxDecoration(
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(AppTheme.radiusL),
            ),
            child: const Center(
              child: CircularProgressIndicator.adaptive(),
            ),
          );
        },
      ),
    );
  }

  Widget _buildErrorState(BuildContext context, Object error) {
    return Container(
      height: 120,
      decoration: BoxDecoration(
        color: AppTheme.error.withOpacity(0.1),
        borderRadius: BorderRadius.circular(AppTheme.radiusL),
        border: Border.all(
          color: AppTheme.error.withOpacity(0.3),
        ),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 32,
              color: AppTheme.error,
            ),
            const SizedBox(height: AppTheme.spacingS),
            Text(
              'Failed to load receipts',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppTheme.error,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _navigateToReceiptDetail(BuildContext context, Receipt receipt) {
    // TODO: Navigate to receipt detail page
    // This would typically use go_router or Navigator
    Navigator.of(context).pushNamed(
      '/receipt-detail',
      arguments: receipt.id,
    );
  }
}