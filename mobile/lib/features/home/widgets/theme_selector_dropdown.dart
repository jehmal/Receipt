import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/theme_provider.dart';
import '../../../core/config/app_theme.dart';

class ThemeSelectorDropdown extends ConsumerWidget {
  const ThemeSelectorDropdown({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeNotifier = ref.watch(themeNotifierProvider.notifier);
    final currentTheme = ref.watch(themeNotifierProvider);
    final theme = Theme.of(context);

    return PopupMenuButton<AppThemeMode>(
      initialValue: currentTheme,
      onSelected: (AppThemeMode value) {
        AppTheme.selectionHaptic();
        themeNotifier.setTheme(value);
      },
      offset: const Offset(0, 50),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppTheme.radiusL),
      ),
      elevation: 8,
      child: Container(
        padding: const EdgeInsets.all(AppTheme.spacingS),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceVariant,
          borderRadius: BorderRadius.circular(AppTheme.radiusM),
          border: Border.all(
            color: theme.colorScheme.outline.withOpacity(0.2),
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _getThemeIcon(currentTheme),
              size: 20,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: AppTheme.spacingXS),
            Icon(
              Icons.keyboard_arrow_down_rounded,
              size: 16,
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ],
        ),
      ),
      itemBuilder: (BuildContext context) => [
        _buildThemeMenuItem(
          context: context,
          themeMode: AppThemeMode.light,
          icon: Icons.light_mode_outlined,
          label: '☀️ Bright Mode',
          isSelected: currentTheme == AppThemeMode.light,
        ),
        _buildThemeMenuItem(
          context: context,
          themeMode: AppThemeMode.dark,
          icon: Icons.dark_mode_outlined,
          label: '🌓 Dark Mode',
          isSelected: currentTheme == AppThemeMode.dark,
        ),
        _buildThemeMenuItem(
          context: context,
          themeMode: AppThemeMode.system,
          icon: Icons.brightness_auto_outlined,
          label: '📱 System',
          isSelected: currentTheme == AppThemeMode.system,
        ),
      ],
    );
  }

  PopupMenuItem<AppThemeMode> _buildThemeMenuItem({
    required BuildContext context,
    required AppThemeMode themeMode,
    required IconData icon,
    required String label,
    required bool isSelected,
  }) {
    final theme = Theme.of(context);
    
    return PopupMenuItem<AppThemeMode>(
      value: themeMode,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacingS,
          vertical: AppTheme.spacingXS,
        ),
        decoration: BoxDecoration(
          color: isSelected 
              ? theme.colorScheme.primaryContainer.withOpacity(0.5)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(AppTheme.radiusS),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 20,
              color: isSelected 
                  ? theme.colorScheme.primary
                  : theme.colorScheme.onSurface,
            ),
            const SizedBox(width: AppTheme.spacingM),
            Expanded(
              child: Text(
                label,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: isSelected 
                      ? theme.colorScheme.primary
                      : theme.colorScheme.onSurface,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                ),
              ),
            ),
            if (isSelected) ...[
              const SizedBox(width: AppTheme.spacingS),
              Icon(
                Icons.check_rounded,
                size: 18,
                color: theme.colorScheme.primary,
              ),
            ],
          ],
        ),
      ),
    );
  }

  IconData _getThemeIcon(AppThemeMode themeMode) {
    switch (themeMode) {
      case AppThemeMode.light:
        return Icons.light_mode_outlined;
      case AppThemeMode.dark:
        return Icons.dark_mode_outlined;
      case AppThemeMode.system:
        return Icons.brightness_auto_outlined;
    }
  }
}