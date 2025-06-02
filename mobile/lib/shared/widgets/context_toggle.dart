import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum ReceiptContext { personal, company }

final receiptContextProvider = StateProvider<ReceiptContext>((ref) => ReceiptContext.personal);

class ContextToggle extends ConsumerWidget {
  const ContextToggle({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentContext = ref.watch(receiptContextProvider);
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.3),
      ),
      child: Row(
        children: [
          Expanded(
            child: _ToggleButton(
              label: 'Personal',
              icon: Icons.person,
              isSelected: currentContext == ReceiptContext.personal,
              onTap: () => ref.read(receiptContextProvider.notifier).state = ReceiptContext.personal,
            ),
          ),
          Expanded(
            child: _ToggleButton(
              label: 'Company',
              icon: Icons.business,
              isSelected: currentContext == ReceiptContext.company,
              onTap: () => ref.read(receiptContextProvider.notifier).state = ReceiptContext.company,
            ),
          ),
        ],
      ),
    );
  }
}

class _ToggleButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  const _ToggleButton({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.all(4),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: isSelected 
            ? Theme.of(context).colorScheme.primary
            : Colors.transparent,
          boxShadow: isSelected 
            ? [BoxShadow(
                color: Theme.of(context).colorScheme.primary.withOpacity(0.3),
                blurRadius: 8,
                offset: const Offset(0, 2),
              )]
            : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              color: isSelected 
                ? Theme.of(context).colorScheme.onPrimary
                : Theme.of(context).colorScheme.onSurfaceVariant,
              size: 18,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: isSelected 
                  ? Theme.of(context).colorScheme.onPrimary
                  : Theme.of(context).colorScheme.onSurfaceVariant,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}