import 'package:flutter/material.dart';
import 'dart:io';

import '../../../shared/models/receipt.dart';

class ReceiptCard extends StatelessWidget {
  final Receipt receipt;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  const ReceiptCard({
    super.key,
    required this.receipt,
    required this.onTap,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              // Receipt thumbnail
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  width: 60,
                  height: 80,
                  child: receipt.imagePath != null && File(receipt.imagePath!).existsSync()
                      ? Image.file(
                          File(receipt.imagePath!),
                          fit: BoxFit.cover,
                        )
                      : Container(
                          color: Colors.grey[300],
                          child: const Icon(
                            Icons.receipt,
                            color: Colors.grey,
                          ),
                        ),
                ),
              ),
              
              const SizedBox(width: 16),
              
              // Receipt details
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      receipt.vendor ?? 'Unknown Vendor',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    if (receipt.amount != null)
                      Text(
                        '${receipt.currency ?? 'USD'} ${receipt.amount!.toStringAsFixed(2)}',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.green[600],
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    const SizedBox(height: 4),
                    Text(
                      _formatDate(receipt.date),
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[600],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        // Processing status
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: receipt.isProcessed
                                ? Colors.green[100]
                                : Colors.orange[100],
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            receipt.isProcessed ? 'Processed' : 'Processing',
                            style: TextStyle(
                              fontSize: 10,
                              color: receipt.isProcessed
                                  ? Colors.green[700]
                                  : Colors.orange[700],
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        
                        const SizedBox(width: 8),
                        
                        // Sync status
                        Icon(
                          receipt.isSynced
                              ? Icons.cloud_done
                              : Icons.cloud_upload,
                          size: 16,
                          color: receipt.isSynced
                              ? Colors.green[600]
                              : Colors.grey[400],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              
              // Action menu
              PopupMenuButton<String>(
                onSelected: (value) {
                  switch (value) {
                    case 'delete':
                      onDelete();
                      break;
                  }
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'delete',
                    child: Row(
                      children: [
                        Icon(Icons.delete, color: Colors.red),
                        SizedBox(width: 8),
                        Text('Delete'),
                      ],
                    ),
                  ),
                ],
                child: const Icon(Icons.more_vert),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime? date) {
    // Handle null date with fallback
    date ??= receipt.createdAt;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final receiptDate = DateTime(date.year, date.month, date.day);

    if (receiptDate == today) {
      return 'Today';
    } else if (receiptDate == yesterday) {
      return 'Yesterday';
    } else if (now.difference(date).inDays < 7) {
      final weekdays = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday'
      ];
      return weekdays[date.weekday - 1];
    } else {
      return '${date.day}/${date.month}/${date.year}';
    }
  }
}