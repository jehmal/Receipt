import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class ExpenseSummaryCard extends StatelessWidget {
  final String title;
  final double amount;
  final double? trend;
  final IconData icon;
  final Color color;

  const ExpenseSummaryCard({
    super.key,
    required this.title,
    required this.amount,
    this.trend,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat.currency(symbol: '\$');
    
    return Card(
      elevation: 2,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              color.withOpacity(0.1),
              color.withOpacity(0.05),
            ],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header with icon and trend
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      icon,
                      color: color,
                      size: 20,
                    ),
                  ),
                  const Spacer(),
                  if (trend != null) _buildTrendIndicator(),
                ],
              ),
              
              const SizedBox(height: 16),
              
              // Amount
              Text(
                currencyFormatter.format(amount),
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
              
              const SizedBox(height: 4),
              
              // Title
              Text(
                title,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              
              // Trend text
              if (trend != null) ...[
                const SizedBox(height: 8),
                _buildTrendText(),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTrendIndicator() {
    final isPositive = trend! > 0;
    final trendColor = isPositive ? Colors.green : Colors.red;
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: trendColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isPositive ? Icons.trending_up : Icons.trending_down,
            color: trendColor,
            size: 16,
          ),
          const SizedBox(width: 4),
          Text(
            '${trend!.abs().toStringAsFixed(1)}%',
            style: TextStyle(
              color: trendColor,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTrendText() {
    final isPositive = trend! > 0;
    final trendColor = isPositive ? Colors.green : Colors.red;
    final trendText = isPositive ? 'increase' : 'decrease';
    
    return Text(
      '${trend!.abs().toStringAsFixed(1)}% $trendText from last period',
      style: TextStyle(
        color: trendColor,
        fontSize: 12,
        fontWeight: FontWeight.w500,
      ),
    );
  }
}

class CompactExpenseSummaryCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color? color;
  final double? trend;
  final VoidCallback? onTap;

  const CompactExpenseSummaryCard({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    this.color,
    this.trend,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cardColor = color ?? Theme.of(context).colorScheme.primary;
    
    return Card(
      elevation: 1,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    icon,
                    color: cardColor,
                    size: 20,
                  ),
                  const Spacer(),
                  if (trend != null)
                    Icon(
                      trend! > 0 ? Icons.trending_up : Icons.trending_down,
                      color: trend! > 0 ? Colors.green : Colors.red,
                      size: 16,
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                value,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                title,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AnimatedExpenseSummaryCard extends StatefulWidget {
  final String title;
  final double amount;
  final double? previousAmount;
  final IconData icon;
  final Color color;
  final Duration animationDuration;

  const AnimatedExpenseSummaryCard({
    super.key,
    required this.title,
    required this.amount,
    this.previousAmount,
    required this.icon,
    required this.color,
    this.animationDuration = const Duration(milliseconds: 1500),
  });

  @override
  State<AnimatedExpenseSummaryCard> createState() => _AnimatedExpenseSummaryCardState();
}

class _AnimatedExpenseSummaryCardState extends State<AnimatedExpenseSummaryCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: widget.animationDuration,
      vsync: this,
    );
    
    _animation = Tween<double>(
      begin: widget.previousAmount ?? 0,
      end: widget.amount,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ));
    
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        final trend = widget.previousAmount != null
            ? ((widget.amount - widget.previousAmount!) / widget.previousAmount!) * 100
            : null;
            
        return ExpenseSummaryCard(
          title: widget.title,
          amount: _animation.value,
          trend: trend,
          icon: widget.icon,
          color: widget.color,
        );
      },
    );
  }
}