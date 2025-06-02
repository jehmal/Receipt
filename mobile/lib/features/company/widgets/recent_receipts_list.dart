import 'package:flutter/material.dart';

class RecentReceiptsList extends StatelessWidget {
  final List<Map<String, dynamic>> receipts;
  
  const RecentReceiptsList({
    super.key,
    required this.receipts,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Recent Receipts',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: receipts.length,
              itemBuilder: (context, index) {
                final receipt = receipts[index];
                return ListTile(
                  leading: const Icon(Icons.receipt),
                  title: Text(receipt['vendor'] ?? 'Unknown Vendor'),
                  subtitle: Text(receipt['amount']?.toString() ?? '0.00'),
                  trailing: Text(receipt['date'] ?? ''),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}