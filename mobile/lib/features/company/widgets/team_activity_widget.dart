import 'package:flutter/material.dart';

class TeamActivityWidget extends StatelessWidget {
  final List<Map<String, dynamic>> activities;
  
  const TeamActivityWidget({
    super.key,
    required this.activities,
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
              'Team Activity',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: activities.length,
              itemBuilder: (context, index) {
                final activity = activities[index];
                return ListTile(
                  leading: CircleAvatar(
                    child: Text(activity['user']?[0]?.toUpperCase() ?? 'U'),
                  ),
                  title: Text(activity['action'] ?? 'Unknown action'),
                  subtitle: Text(activity['timestamp'] ?? ''),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}