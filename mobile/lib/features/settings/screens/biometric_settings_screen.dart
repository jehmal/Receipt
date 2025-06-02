import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:settings_ui/settings_ui.dart';
import 'package:local_auth/local_auth.dart';

import '../providers/biometric_provider.dart';
import '../../../core/auth/biometric_service.dart';

class BiometricSettingsScreen extends ConsumerStatefulWidget {
  const BiometricSettingsScreen({super.key});

  @override
  ConsumerState<BiometricSettingsScreen> createState() => _BiometricSettingsScreenState();
}

class _BiometricSettingsScreenState extends ConsumerState<BiometricSettingsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(biometricProvider.notifier).loadStatus();
    });
  }

  @override
  Widget build(BuildContext context) {
    final biometricState = ref.watch(biometricProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Biometric Security'),
        elevation: 0,
      ),
      body: biometricState.when(
        data: (status) => _buildSettings(status),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: Colors.red),
              const SizedBox(height: 16),
              Text('Error loading biometric settings'),
              const SizedBox(height: 8),
              Text(error.toString(), textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  ref.read(biometricProvider.notifier).loadStatus();
                },
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSettings(BiometricStatus status) {
    return SettingsList(
      sections: [
        SettingsSection(
          title: const Text('Biometric Authentication'),
          tiles: [
            SettingsTile.switchTile(
              initialValue: status.isEnabled,
              onToggle: status.isAvailable ? _onBiometricToggle : null,
              title: Text(_getBiometricTitle(status)),
              description: Text(status.statusDescription),
              leading: Icon(_getBiometricIcon(status.primaryType)),
              enabled: status.isAvailable,
            ),
          ],
        ),
        
        if (status.isAvailable) ...[
          SettingsSection(
            title: const Text('Available Methods'),
            tiles: status.availableTypes.map((type) {
              final service = BiometricService.instance;
              return SettingsTile(
                title: Text(service.getBiometricTypeName(type)),
                leading: Icon(_getBiometricIcon(type)),
                trailing: status.primaryType == type
                    ? const Icon(Icons.check, color: Colors.green)
                    : null,
              );
            }).toList(),
          ),
        ],

        if (status.isEnabled) ...[
          SettingsSection(
            title: const Text('Actions'),
            tiles: [
              SettingsTile(
                title: const Text('Test Authentication'),
                description: const Text('Test your biometric authentication'),
                leading: const Icon(Icons.fingerprint),
                onPressed: _testAuthentication,
              ),
            ],
          ),

          SettingsSection(
            title: const Text('Information'),
            tiles: [
              if (status.setupDate != null)
                SettingsTile(
                  title: const Text('Setup Date'),
                  value: Text(_formatDateTime(status.setupDate!)),
                  leading: const Icon(Icons.date_range),
                ),
              if (status.lastAuthTime != null)
                SettingsTile(
                  title: const Text('Last Used'),
                  value: Text(_formatDateTime(status.lastAuthTime!)),
                  leading: const Icon(Icons.access_time),
                ),
            ],
          ),
        ],

        SettingsSection(
          title: const Text('Security Information'),
          tiles: [
            SettingsTile(
              title: const Text('About Biometric Security'),
              description: const Text('Learn how biometric authentication protects your data'),
              leading: const Icon(Icons.info_outline),
              onPressed: _showSecurityInfo,
            ),
          ],
        ),
      ],
    );
  }

  String _getBiometricTitle(BiometricStatus status) {
    if (!status.isAvailable) {
      return 'Biometric Authentication (Not Available)';
    }
    
    if (status.primaryType != null) {
      final service = BiometricService.instance;
      return service.getBiometricTypeName(status.primaryType!);
    }
    
    return 'Biometric Authentication';
  }

  IconData _getBiometricIcon(BiometricType? type) {
    if (type == null) return Icons.fingerprint;
    
    switch (type) {
      case BiometricType.face:
        return Icons.face;
      case BiometricType.fingerprint:
        return Icons.fingerprint;
      case BiometricType.iris:
        return Icons.visibility;
      default:
        return Icons.security;
    }
  }

  String _formatDateTime(DateTime dateTime) {
    return '${dateTime.day}/${dateTime.month}/${dateTime.year} ${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}';
  }

  Future<void> _onBiometricToggle(bool value) async {
    if (value) {
      // Enable biometric authentication
      final success = await ref.read(biometricProvider.notifier).enableBiometric();
      
      if (!success) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Failed to enable biometric authentication'),
              backgroundColor: Colors.red,
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Biometric authentication enabled successfully'),
              backgroundColor: Colors.green,
            ),
          );
        }
      }
    } else {
      // Show confirmation dialog before disabling
      final confirmed = await _showDisableConfirmation();
      if (confirmed) {
        await ref.read(biometricProvider.notifier).disableBiometric();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Biometric authentication disabled'),
            ),
          );
        }
      }
    }
  }

  Future<bool> _showDisableConfirmation() async {
    return await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Disable Biometric Authentication'),
        content: const Text(
          'Are you sure you want to disable biometric authentication? '
          'You will need to enter your password to access the app.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Disable'),
          ),
        ],
      ),
    ) ?? false;
  }

  void _testAuthentication(BuildContext context) async {
    try {
      final result = await ref.read(biometricProvider.notifier).testAuthentication();
      
      if (mounted) {
        final message = result.isSuccess
            ? 'Authentication successful!'
            : result.message ?? 'Authentication failed';
        
        final color = result.isSuccess ? Colors.green : Colors.red;
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: color,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Test failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _showSecurityInfo(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Biometric Security'),
        content: const SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'How it works:',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 8),
              Text(
                '• Your biometric data is stored securely on your device\n'
                '• Receipt Vault never has access to your biometric information\n'
                '• Authentication happens locally on your device\n'
                '• Your data remains encrypted and protected',
              ),
              SizedBox(height: 16),
              Text(
                'Security benefits:',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 8),
              Text(
                '• Faster and more convenient access\n'
                '• Harder for others to access your receipts\n'
                '• No passwords to remember or enter\n'
                '• Protection against shoulder surfing',
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Got it'),
          ),
        ],
      ),
    );
  }
}