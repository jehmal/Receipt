import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'core/config/app_theme.dart';
import 'core/config/theme_provider.dart' as theme_provider;
import 'core/auth/enhanced_auth_provider.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/home/screens/enhanced_home_screen.dart';
import 'features/camera/screens/enhanced_camera_screen.dart';
import 'features/company/screens/company_dashboard_screen.dart';
import 'features/warranty/screens/warranty_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Hive.initFlutter();
  
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  
  runApp(
    const ProviderScope(
      child: ReceiptVaultApp(),
    ),
  );
}

class ReceiptVaultApp extends ConsumerWidget {
  const ReceiptVaultApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appThemeMode = ref.watch(theme_provider.themeNotifierProvider);
    final authState = ref.watch(enhancedAuthProvider);
    
    return MaterialApp(
      title: 'Receipt Vault Pro',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: _getThemeMode(appThemeMode),
      home: _getInitialScreen(authState),
      routes: {
        '/login': (context) => const LoginScreen(),
        '/home': (context) => const EnhancedHomeScreen(),
        '/camera': (context) => const EnhancedCameraScreen(),
        '/company': (context) => const CompanyDashboardScreen(),
        '/warranty': (context) => const WarrantyScreen(),
      },
    );
  }
  
  ThemeMode _getThemeMode(theme_provider.AppThemeMode mode) {
    switch (mode) {
      case theme_provider.AppThemeMode.light:
        return ThemeMode.light;
      case theme_provider.AppThemeMode.dark:
        return ThemeMode.dark;
      case theme_provider.AppThemeMode.system:
        return ThemeMode.system;
    }
  }
  
  Widget _getInitialScreen(AuthState authState) {
    if (authState is AuthStateAuthenticated) {
      return const EnhancedHomeScreen();
    }
    return const LoginScreen();
  }
}