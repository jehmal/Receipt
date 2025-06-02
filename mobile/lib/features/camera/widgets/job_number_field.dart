import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/local_storage.dart';

// Provider for recent job numbers
final recentJobNumbersProvider = FutureProvider<List<String>>((ref) async {
  // Get recent job numbers from local storage
  final recentJobs = LocalStorage.getSetting<List<String>>('recent_job_numbers') ?? [];
  return recentJobs.take(10).toList(); // Return last 10 job numbers
});

class JobNumberField extends ConsumerStatefulWidget {
  final TextEditingController controller;

  const JobNumberField({
    super.key,
    required this.controller,
  });

  @override
  ConsumerState<JobNumberField> createState() => _JobNumberFieldState();
}

class _JobNumberFieldState extends ConsumerState<JobNumberField> {
  final FocusNode _focusNode = FocusNode();
  bool _showSuggestions = false;
  List<String> _filteredSuggestions = [];

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_onFocusChange);
    widget.controller.addListener(_onTextChange);
  }

  @override
  void dispose() {
    _focusNode.removeListener(_onFocusChange);
    _focusNode.dispose();
    widget.controller.removeListener(_onTextChange);
    super.dispose();
  }

  void _onFocusChange() {
    setState(() {
      _showSuggestions = _focusNode.hasFocus;
    });
  }

  void _onTextChange() {
    final recentJobsAsync = ref.read(recentJobNumbersProvider);
    recentJobsAsync.whenData((recentJobs) {
      final query = widget.controller.text.toLowerCase();
      setState(() {
        _filteredSuggestions = recentJobs
            .where((job) => job.toLowerCase().contains(query))
            .toList();
      });
    });
  }

  void _selectJobNumber(String jobNumber) {
    widget.controller.text = jobNumber;
    _focusNode.unfocus();
  }

  Future<void> _saveJobNumber(String jobNumber) async {
    if (jobNumber.trim().isEmpty) return;
    
    final recentJobs = LocalStorage.getSetting<List<String>>('recent_job_numbers') ?? [];
    
    // Remove if already exists and add to front
    recentJobs.remove(jobNumber);
    recentJobs.insert(0, jobNumber);
    
    // Keep only last 10
    if (recentJobs.length > 10) {
      recentJobs.removeRange(10, recentJobs.length);
    }
    
    await LocalStorage.saveSetting('recent_job_numbers', recentJobs);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final recentJobsAsync = ref.watch(recentJobNumbersProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Text Field
        TextFormField(
          controller: widget.controller,
          focusNode: _focusNode,
          decoration: InputDecoration(
            hintText: 'Enter job number (e.g., JOB-2024-001)',
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            prefixIcon: Icon(
              Icons.work_outline,
              color: colorScheme.primary,
            ),
            suffixIcon: widget.controller.text.isNotEmpty
                ? IconButton(
                    onPressed: () {
                      widget.controller.clear();
                    },
                    icon: const Icon(Icons.clear),
                  )
                : null,
          ),
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (value) {
            if (value.trim().isNotEmpty) {
              _saveJobNumber(value.trim());
            }
          },
          onEditingComplete: () {
            if (widget.controller.text.trim().isNotEmpty) {
              _saveJobNumber(widget.controller.text.trim());
            }
          },
        ),

        // Recent Job Numbers Suggestions
        if (_showSuggestions && _filteredSuggestions.isNotEmpty) ...[
          const SizedBox(height: 8),
          Container(
            constraints: const BoxConstraints(maxHeight: 200),
            decoration: BoxDecoration(
              color: colorScheme.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: colorScheme.outline.withOpacity(0.3),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: _filteredSuggestions.length,
              itemBuilder: (context, index) {
                final jobNumber = _filteredSuggestions[index];
                return ListTile(
                  dense: true,
                  leading: Icon(
                    Icons.history,
                    size: 16,
                    color: colorScheme.onSurfaceVariant,
                  ),
                  title: Text(
                    jobNumber,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  onTap: () => _selectJobNumber(jobNumber),
                );
              },
            ),
          ),
        ],

        // Integration Hint (if no recent jobs)
        recentJobsAsync.when(
          data: (recentJobs) {
            if (recentJobs.isEmpty && !_focusNode.hasFocus) {
              return Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  children: [
                    Icon(
                      Icons.info_outline,
                      size: 16,
                      color: colorScheme.onSurfaceVariant.withOpacity(0.7),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        'Connect with Tradify for automatic job sync',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant.withOpacity(0.7),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }
            return const SizedBox.shrink();
          },
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
        ),
      ],
    );
  }
}