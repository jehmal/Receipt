import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class SearchBarWidget extends StatefulWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final Function(String) onChanged;
  final Function(String) onSubmitted;
  final Function(String) onSemanticSearch;

  const SearchBarWidget({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.onChanged,
    required this.onSubmitted,
    required this.onSemanticSearch,
  });

  @override
  State<SearchBarWidget> createState() => _SearchBarWidgetState();
}

class _SearchBarWidgetState extends State<SearchBarWidget> {
  bool _isSemanticMode = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.5),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: widget.focusNode.hasFocus 
              ? Theme.of(context).colorScheme.primary
              : Colors.transparent,
          width: 2,
        ),
      ),
      child: Row(
        children: [
          // Search icon
          Padding(
            padding: const EdgeInsets.only(left: 16, right: 8),
            child: Icon(
              _isSemanticMode ? MdiIcons.brain : Icons.search,
              color: _isSemanticMode 
                  ? Theme.of(context).colorScheme.primary
                  : Theme.of(context).colorScheme.onSurfaceVariant,
              size: 20,
            ),
          ),

          // Text field
          Expanded(
            child: TextField(
              controller: widget.controller,
              focusNode: widget.focusNode,
              decoration: InputDecoration(
                hintText: _isSemanticMode 
                    ? 'Search with AI (e.g., "coffee from last week")'
                    : 'Search receipts...',
                border: InputBorder.none,
                hintStyle: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontSize: 14,
                ),
              ),
              style: const TextStyle(fontSize: 14),
              textInputAction: TextInputAction.search,
              onChanged: widget.onChanged,
              onSubmitted: (query) {
                if (_isSemanticMode) {
                  widget.onSemanticSearch(query);
                } else {
                  widget.onSubmitted(query);
                }
              },
            ),
          ),

          // AI/Regular toggle
          Container(
            margin: const EdgeInsets.only(right: 4),
            child: IconButton(
              onPressed: () {
                setState(() {
                  _isSemanticMode = !_isSemanticMode;
                });
                
                // Show tooltip or snackbar explaining the mode
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      _isSemanticMode 
                          ? 'AI search enabled - ask in natural language'
                          : 'Regular search enabled - use keywords',
                    ),
                    duration: const Duration(seconds: 2),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
              icon: Icon(
                _isSemanticMode ? MdiIcons.brain : MdiIcons.magnify,
                size: 18,
              ),
              tooltip: _isSemanticMode ? 'Switch to keyword search' : 'Switch to AI search',
              style: IconButton.styleFrom(
                backgroundColor: _isSemanticMode 
                    ? Theme.of(context).colorScheme.primaryContainer
                    : null,
                foregroundColor: _isSemanticMode 
                    ? Theme.of(context).colorScheme.primary
                    : Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ),

          // Clear button
          if (widget.controller.text.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(right: 8),
              child: IconButton(
                onPressed: () {
                  widget.controller.clear();
                  widget.onChanged('');
                },
                icon: const Icon(Icons.clear, size: 18),
                style: IconButton.styleFrom(
                  foregroundColor: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class SearchSuggestionChip extends StatelessWidget {
  final String suggestion;
  final VoidCallback onTap;
  final bool isSelected;

  const SearchSuggestionChip({
    super.key,
    required this.suggestion,
    required this.onTap,
    this.isSelected = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      child: ActionChip(
        label: Text(suggestion),
        onPressed: onTap,
        backgroundColor: isSelected 
            ? Theme.of(context).colorScheme.primaryContainer
            : null,
        side: isSelected 
            ? BorderSide(color: Theme.of(context).colorScheme.primary)
            : null,
      ),
    );
  }
}

class RecentSearchItem extends StatelessWidget {
  final String query;
  final DateTime timestamp;
  final VoidCallback onTap;
  final VoidCallback onRemove;

  const RecentSearchItem({
    super.key,
    required this.query,
    required this.timestamp,
    required this.onTap,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: const Icon(Icons.history),
      title: Text(query),
      subtitle: Text(_formatTimestamp(timestamp)),
      trailing: IconButton(
        onPressed: onRemove,
        icon: const Icon(Icons.close),
        iconSize: 16,
      ),
      onTap: onTap,
    );
  }

  String _formatTimestamp(DateTime timestamp) {
    final now = DateTime.now();
    final difference = now.difference(timestamp);

    if (difference.inDays > 0) {
      return '${difference.inDays}d ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }
}