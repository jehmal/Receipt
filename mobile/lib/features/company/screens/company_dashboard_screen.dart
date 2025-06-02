import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import '../providers/company_analytics_provider.dart';
import '../widgets/expense_summary_card.dart';
import '../widgets/category_breakdown_chart.dart';
import '../widgets/recent_receipts_list.dart';
import '../widgets/team_activity_widget.dart';
import '../widgets/export_options_sheet.dart';

class CompanyDashboardScreen extends ConsumerStatefulWidget {
  const CompanyDashboardScreen({super.key});

  @override
  ConsumerState<CompanyDashboardScreen> createState() => _CompanyDashboardScreenState();
}

class _CompanyDashboardScreenState extends ConsumerState<CompanyDashboardScreen>
    with TickerProviderStateMixin {
  late TabController _tabController;
  DateRange _selectedPeriod = DateRange.thisMonth;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    
    // Load initial data
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(companyAnalyticsNotifierProvider.notifier).loadAnalytics(_selectedPeriod);
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final analyticsState = ref.watch(companyAnalyticsNotifierProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: CustomScrollView(
        slivers: [
          // App Bar with period selector
          SliverAppBar.large(
            title: const Text('Company Dashboard'),
            backgroundColor: Theme.of(context).colorScheme.surface,
            actions: [
              // Period selector
              PopupMenuButton<DateRange>(
                icon: const Icon(Icons.date_range),
                onSelected: (period) {
                  setState(() {
                    _selectedPeriod = period;
                  });
                  ref.read(companyAnalyticsNotifierProvider.notifier).loadAnalytics(period);
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: DateRange.thisWeek,
                    child: Text('This Week'),
                  ),
                  const PopupMenuItem(
                    value: DateRange.thisMonth,
                    child: Text('This Month'),
                  ),
                  const PopupMenuItem(
                    value: DateRange.lastMonth,
                    child: Text('Last Month'),
                  ),
                  const PopupMenuItem(
                    value: DateRange.thisQuarter,
                    child: Text('This Quarter'),
                  ),
                  const PopupMenuItem(
                    value: DateRange.thisYear,
                    child: Text('This Year'),
                  ),
                ],
              ),
              
              // Export options
              IconButton(
                onPressed: () => _showExportOptions(context),
                icon: const Icon(Icons.download),
              ),
            ],
            bottom: TabBar(
              controller: _tabController,
              tabs: const [
                Tab(text: 'Overview', icon: Icon(Icons.dashboard)),
                Tab(text: 'Analytics', icon: Icon(Icons.analytics)),
                Tab(text: 'Team', icon: Icon(Icons.group)),
              ],
            ),
          ),

          // Tab content
          SliverFillRemaining(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildOverviewTab(analyticsState),
                _buildAnalyticsTab(analyticsState),
                _buildTeamTab(analyticsState),
              ],
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          // Navigate to receipt capture
          Navigator.of(context).pushNamed('/camera');
        },
        icon: const Icon(Icons.add),
        label: const Text('Add Receipt'),
      ),
    );
  }

  Widget _buildOverviewTab(CompanyAnalyticsState state) {
    return switch (state) {
      CompanyAnalyticsLoading() => const Center(
          child: CircularProgressIndicator(),
        ),
      CompanyAnalyticsError(message: final message) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.error_outline,
                size: 64,
                color: Theme.of(context).colorScheme.error,
              ),
              const SizedBox(height: 16),
              Text(
                'Failed to load analytics',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text(message),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () {
                  ref.read(companyAnalyticsNotifierProvider.notifier).loadAnalytics(_selectedPeriod);
                },
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      CompanyAnalyticsLoaded(analytics: final analytics) => RefreshIndicator(
          onRefresh: () async {
            await ref.read(companyAnalyticsNotifierProvider.notifier).loadAnalytics(_selectedPeriod);
          },
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Summary cards row
                Row(
                  children: [
                    Expanded(
                      child: ExpenseSummaryCard(
                        title: 'Total Expenses',
                        amount: analytics.totalExpenses,
                        trend: analytics.expenseTrend,
                        icon: Icons.receipt_long,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ExpenseSummaryCard(
                        title: 'Avg per Receipt',
                        amount: analytics.averageReceiptAmount,
                        trend: analytics.averageTrend,
                        icon: Icons.trending_up,
                        color: Theme.of(context).colorScheme.secondary,
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: 12),
                
                // Additional summary cards
                Row(
                  children: [
                    Expanded(
                      child: _buildStatCard(
                        'Receipts',
                        analytics.totalReceipts.toString(),
                        Icons.receipt,
                        analytics.receiptsTrend,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildStatCard(
                        'Pending',
                        analytics.pendingApprovals.toString(),
                        Icons.pending_actions,
                        null,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 24),

                // Category breakdown chart
                Text(
                  'Expenses by Category',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                CategoryBreakdownChart(
                  data: analytics.categoryBreakdown ?? {},
                ),

                const SizedBox(height: 24),

                // Recent receipts
                Text(
                  'Recent Receipts',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                RecentReceiptsList(
                  receipts: (analytics.recentReceipts as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [],
                ),
              ],
            ),
          ),
        ),
    };
  }

  Widget _buildAnalyticsTab(CompanyAnalyticsState state) {
    return switch (state) {
      CompanyAnalyticsLoaded(analytics: final analytics) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Monthly trend chart
              Text(
                'Monthly Trends',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              _buildTrendChart(analytics.monthlyTrends),

              const SizedBox(height: 24),

              // Top categories
              Text(
                'Top Categories',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              _buildTopCategoriesList(analytics.categoryBreakdown),

              const SizedBox(height: 24),

              // Top vendors
              Text(
                'Top Vendors',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              _buildTopVendorsList(analytics.topVendors),
            ],
          ),
        ),
      _ => const Center(child: Text('Select Overview tab to load data')),
    };
  }

  Widget _buildTeamTab(CompanyAnalyticsState state) {
    return switch (state) {
      CompanyAnalyticsLoaded(analytics: final analytics) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Team stats
              Text(
                'Team Overview',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _buildStatCard(
                      'Team Members',
                      analytics.teamMemberCount.toString(),
                      Icons.group,
                      null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildStatCard(
                      'Active Users',
                      analytics.activeUsers.toString(),
                      Icons.person_outline,
                      null,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Team activity
              Text(
                'Recent Activity',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              TeamActivityWidget(
                activities: (analytics.teamActivity as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [],
              ),

              const SizedBox(height: 24),

              // Top spenders
              Text(
                'Top Spenders',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              _buildTopSpendersList(analytics.topSpenders),
            ],
          ),
        ),
      _ => const Center(child: Text('Select Overview tab to load data')),
    };
  }

  Widget _buildStatCard(String title, String value, IconData icon, double? trend) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 20),
                const Spacer(),
                if (trend != null)
                  Icon(
                    trend > 0 ? Icons.trending_up : Icons.trending_down,
                    size: 16,
                    color: trend > 0 ? Colors.green : Colors.red,
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              title,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTrendChart(List<ExpenseTrend> trends) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: SizedBox(
          height: 200,
          child: Center(
            child: Text(
              'Trend Chart\n(Chart library integration needed)',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTopCategoriesList(Map<String, double> categories) {
    final sortedCategories = categories.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return Card(
      child: Column(
        children: sortedCategories.take(5).map((entry) {
          return ListTile(
            leading: CircleAvatar(
              backgroundColor: Theme.of(context).colorScheme.primaryContainer,
              child: Text(
                entry.key[0].toUpperCase(),
                style: TextStyle(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            title: Text(entry.key),
            trailing: Text(
              '\$${entry.value.toStringAsFixed(2)}',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildTopVendorsList(List<VendorExpense> vendors) {
    return Card(
      child: Column(
        children: vendors.take(5).map((vendor) {
          return ListTile(
            leading: CircleAvatar(
              backgroundColor: Theme.of(context).colorScheme.secondaryContainer,
              child: Text(
                vendor.name[0].toUpperCase(),
                style: TextStyle(
                  color: Theme.of(context).colorScheme.secondary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            title: Text(vendor.name),
            subtitle: Text('${vendor.receiptCount} receipts'),
            trailing: Text(
              '\$${vendor.totalAmount.toStringAsFixed(2)}',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildTopSpendersList(List<UserExpense> spenders) {
    return Card(
      child: Column(
        children: spenders.take(5).map((spender) {
          return ListTile(
            leading: CircleAvatar(
              backgroundImage: spender.avatarUrl != null 
                  ? NetworkImage(spender.avatarUrl!)
                  : null,
              child: spender.avatarUrl == null 
                  ? Text(spender.name[0].toUpperCase())
                  : null,
            ),
            title: Text(spender.name),
            subtitle: Text('${spender.receiptCount} receipts'),
            trailing: Text(
              '\$${spender.totalAmount.toStringAsFixed(2)}',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  void _showExportOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => const ExportOptionsSheet(),
    );
  }

  void _exportData(ExportFormat format, DateRange period) {
    // Handle export logic
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Exporting data as ${format.name}...'),
        action: SnackBarAction(
          label: 'View',
          onPressed: () {
            // Open exported file
          },
        ),
      ),
    );
  }
}