import 'package:flutter/material.dart';

class ExportOptionsSheet extends StatelessWidget {
  final VoidCallback? onExportCsv;
  final VoidCallback? onExportPdf;
  final VoidCallback? onExportXlsx;
  
  const ExportOptionsSheet({
    super.key,
    this.onExportCsv,
    this.onExportPdf,
    this.onExportXlsx,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Export Options',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 20),
          ListTile(
            leading: const Icon(Icons.table_chart),
            title: const Text('Export as CSV'),
            onTap: onExportCsv,
          ),
          ListTile(
            leading: const Icon(Icons.picture_as_pdf),
            title: const Text('Export as PDF'),
            onTap: onExportPdf,
          ),
          ListTile(
            leading: const Icon(Icons.grid_on),
            title: const Text('Export as Excel'),
            onTap: onExportXlsx,
          ),
        ],
      ),
    );
  }
}