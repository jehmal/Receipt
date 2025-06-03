import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/enhanced_auth_provider.dart';
import '../../../core/config/app_config.dart';
import '../../../core/config/app_theme.dart';
import '../../../core/config/theme_provider.dart';
import '../widgets/enhanced_large_capture_button.dart';
import '../widgets/recent_receipts_horizontal.dart';
import '../widgets/context_toggle_header.dart';
import '../widgets/theme_selector_dropdown.dart';

class EnhancedHomeScreen extends ConsumerStatefulWidget {
  const EnhancedHomeScreen({super.key});

  @override
  ConsumerState<EnhancedHomeScreen> createState() => _EnhancedHomeScreenState();
}

class _EnhancedHomeScreenState extends ConsumerState<EnhancedHomeScreen> 
    with TickerProviderStateMixin {
  late AnimationController _fadeController;
  late AnimationController _slideController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    
    _fadeController = AnimationController(
      duration: AppTheme.normalAnimation,
      vsync: this,
    );
    
    _slideController = AnimationController(
      duration: const Duration(milliseconds: 400),
      vsync: this,
    );
    
    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _fadeController,
      curve: AppTheme.defaultCurve,
    ));
    
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _slideController,
      curve: AppTheme.fastCurve,
    ));
    
    // Start animations
    _fadeController.forward();
    _slideController.forward();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _slideController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(enhancedAuthProvider);
    final userContext = ref.watch(userContextProvider);
    final canSwitchContext = ref.watch(canSwitchContextProvider);
    final currentUser = ref.watch(currentUserProvider);
    
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: SlideTransition(
            position: _slideAnimation,
            child: CustomScrollView(
              slivers: [
                // Custom app bar with context toggle and theme selector
                SliverAppBar(
                  floating: true,
                  pinned: false,
                  snap: true,
                  elevation: 0,
                  backgroundColor: Colors.transparent,
                  flexibleSpace: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppTheme.spacingM,
                      vertical: AppTheme.spacingS,
                    ),
                    child: Row(
                      children: [
                        // Context toggle (Personal/Company)
                        if (canSwitchContext) ...[
                          Expanded(
                            child: ContextToggleHeader(
                              currentContext: userContext ?? UserContext.personal,
                              onContextChanged: (context) => _handleContextSwitch(context),
                            ),
                          ),
                          const SizedBox(width: AppTheme.spacingM),
                        ] else ...[
                          Expanded(
                            child: _buildWelcomeText(currentUser?.firstName ?? 'User'),
                          ),
                        ],
                        
                        // Theme selector dropdown
                        const ThemeSelectorDropdown(),
                      ],
                    ),
                  ),
                ),
                
                // Main content
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(AppTheme.spacingM),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: AppTheme.spacingXL),
                        
                        // Large capture button - centerpiece of the app
                        Center(
                          child: Hero(
                            tag: 'capture_button',
                            child: EnhancedLargeCaptureButton(
                              onTap: _handleCapture,
                            ),
                          ),
                        ),
                        
                        const SizedBox(height: AppTheme.spacingXXL),
                        
                        // Recent receipts section
                        _buildRecentReceiptsSection(),
                        
                        const SizedBox(height: AppTheme.spacingXL),
                        
                        // Quick actions
                        _buildQuickActions(),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildWelcomeText(String firstName) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Welcome back,',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: Theme.of(context).hintColor,
          ),
        ),
        Text(
          firstName,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _buildRecentReceiptsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Recent Receipts',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            TextButton(
              onPressed: () => _navigateToReceipts(),
              child: const Text('See All'),
            ),
          ],
        ),
        const SizedBox(height: AppTheme.spacingM),
        const RecentReceiptsHorizontal(),
      ],
    );
  }

  Widget _buildQuickActions() {
    final isCompanyMode = ref.watch(isInCompanyModeProvider);
    final hasExportPermission = ref.watch(enhancedAuthProvider.notifier)
        .hasCompanyPermission('export_reports');
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Quick Actions',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: AppTheme.spacingM),
        
        Wrap(
          spacing: AppTheme.spacingM,
          runSpacing: AppTheme.spacingM,
          children: [
            _buildQuickActionCard(
              icon: Icons.search,
              title: 'Search',
              subtitle: 'Find receipts',
              onTap: () => _navigateToSearch(),
            ),
            
            _buildQuickActionCard(
              icon: Icons.analytics_outlined,
              title: 'Analytics',
              subtitle: 'View insights',
              onTap: () => _navigateToAnalytics(),
            ),
            
            if (isCompanyMode) ...[
              _buildQuickActionCard(
                icon: Icons.people_outline,
                title: 'Team',
                subtitle: 'Company receipts',
                onTap: () => _navigateToCompanyDashboard(),
              ),
              
              if (hasExportPermission)
                _buildQuickActionCard(
                  icon: Icons.file_download_outlined,
                  title: 'Export',
                  subtitle: 'Monthly reports',
                  onTap: () => _showExportDialog(),
                ),
            ],
            
            _buildQuickActionCard(
              icon: Icons.verified_user_outlined,
              title: 'Warranty',
              subtitle: 'Tool tracking',
              onTap: () => _navigateToWarranty(),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildQuickActionCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return SizedBox(
      width: (MediaQuery.of(context).size.width - (AppTheme.spacingM * 3)) / 2,
      child: Card(
        child: InkWell(
          onTap: () {
            AppTheme.lightHaptic();
            onTap();
          },
          borderRadius: BorderRadius.circular(AppTheme.radiusL),
          child: Padding(
            padding: const EdgeInsets.all(AppTheme.spacingM),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  icon,
                  size: 32,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(height: AppTheme.spacingS),
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).hintColor,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // Event handlers
  void _handleCapture() {
    AppTheme.mediumHaptic();
    context.push('/camera');
  }

  void _handleContextSwitch(UserContext newContext) {
    AppTheme.selectionHaptic();
    ref.read(enhancedAuthProvider.notifier).switchContext(newContext);
  }

  void _navigateToReceipts() {
    AppTheme.lightHaptic();
    context.push('/receipts');
  }

  void _navigateToSearch() {
    AppTheme.lightHaptic();
    context.push('/search');
  }

  void _navigateToAnalytics() {
    AppTheme.lightHaptic();
    context.push('/analytics');
  }

  void _navigateToCompanyDashboard() {
    AppTheme.lightHaptic();
    context.push('/company');
  }

  void _navigateToWarranty() {
    AppTheme.lightHaptic();
    context.push('/warranty');
  }

  void _showExportDialog() {
    AppTheme.lightHaptic();
    showDialog(
      context: context,
      builder: (context) => const ExportDialog(),
    );
  }
}

// Export dialog for monthly reports
class ExportDialog extends StatelessWidget {
  const ExportDialog({super.key});

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Export Monthly Report'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.picture_as_pdf),
            title: const Text('PDF Report'),
            subtitle: const Text('Detailed expense breakdown'),
            onTap: () => _exportPDF(context),
          ),
          ListTile(
            leading: const Icon(Icons.table_chart),
            title: const Text('CSV Export'),
            subtitle: const Text('Raw data for analysis'),
            onTap: () => _exportCSV(context),
          ),
          ListTile(
            leading: const Icon(Icons.integration_instructions),
            title: const Text('Xero Integration'),
            subtitle: const Text('Send to accounting software'),
            onTap: () => _exportToXero(context),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
      ],
    );
  }

  void _exportPDF(BuildContext context) {
    Navigator.of(context).pop();
    // TODO: Implement PDF export
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('PDF export coming soon')),
    );
  }

  void _exportCSV(BuildContext context) {
    Navigator.of(context).pop();
    // TODO: Implement CSV export
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('CSV export coming soon')),
    );
  }

  void _exportToXero(BuildContext context) {
    Navigator.of(context).pop();
    // TODO: Implement Xero integration
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Xero integration coming soon')),
    );
  }
}