import 'package:flutter/material.dart';
import '../../../core/auth/enhanced_auth_provider.dart';
import '../../../core/config/app_theme.dart';

class ContextToggleHeader extends StatefulWidget {
  final UserContext currentContext;
  final ValueChanged<UserContext> onContextChanged;

  const ContextToggleHeader({
    super.key,
    required this.currentContext,
    required this.onContextChanged,
  });

  @override
  State<ContextToggleHeader> createState() => _ContextToggleHeaderState();
}

class _ContextToggleHeaderState extends State<ContextToggleHeader>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: AppTheme.normalAnimation,
      vsync: this,
    );
    _animation = CurvedAnimation(
      parent: _controller,
      curve: AppTheme.defaultCurve,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleToggle() {
    AppTheme.selectionHaptic();
    
    final newContext = widget.currentContext == UserContext.personal
        ? UserContext.company
        : UserContext.personal;
    
    widget.onContextChanged(newContext);
    
    // Animate toggle
    _controller.forward().then((_) {
      _controller.reverse();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isPersonal = widget.currentContext == UserContext.personal;
    
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Transform.scale(
          scale: 1.0 + (_animation.value * 0.05),
          child: Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceVariant,
              borderRadius: BorderRadius.circular(AppTheme.radiusL),
              border: Border.all(
                color: theme.colorScheme.outline.withOpacity(0.2),
                width: 1,
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _buildToggleOption(
                    context: context,
                    icon: Icons.person_outline,
                    label: 'Personal',
                    isSelected: isPersonal,
                    color: AppTheme.personalModeColor,
                    onTap: () {
                      if (!isPersonal) _handleToggle();
                    },
                  ),
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: _buildToggleOption(
                    context: context,
                    icon: Icons.business_outlined,
                    label: 'Company',
                    isSelected: !isPersonal,
                    color: AppTheme.companyModeColor,
                    onTap: () {
                      if (isPersonal) _handleToggle();
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildToggleOption({
    required BuildContext context,
    required IconData icon,
    required String label,
    required bool isSelected,
    required Color color,
    required VoidCallback onTap,
  }) {
    final theme = Theme.of(context);
    
    return AnimatedContainer(
      duration: AppTheme.fastAnimation,
      curve: AppTheme.fastCurve,
      decoration: BoxDecoration(
        color: isSelected ? color : Colors.transparent,
        borderRadius: BorderRadius.circular(AppTheme.radiusM),
        boxShadow: isSelected
            ? [
                BoxShadow(
                  color: color.withOpacity(0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppTheme.radiusM),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingM,
              vertical: AppTheme.spacingS,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  icon,
                  size: 18,
                  color: isSelected
                      ? Colors.white
                      : theme.colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: AppTheme.spacingS),
                Text(
                  label,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: isSelected
                        ? Colors.white
                        : theme.colorScheme.onSurfaceVariant,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}