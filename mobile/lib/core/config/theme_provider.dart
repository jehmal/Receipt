import 'package:flutter/material.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'app_theme.dart';

part 'theme_provider.g.dart';

enum AppThemeMode { light, dark, system }

@riverpod
class ThemeNotifier extends _$ThemeNotifier {
  static const String _themeKey = 'theme_mode';

  @override
  AppThemeMode build() {
    _loadTheme();
    return AppThemeMode.system;
  }

  Future<void> _loadTheme() async {
    final prefs = await SharedPreferences.getInstance();
    final themeString = prefs.getString(_themeKey) ?? 'system';
    final themeMode = AppThemeMode.values.firstWhere(
      (e) => e.name == themeString,
      orElse: () => AppThemeMode.system,
    );
    state = themeMode;
  }

  Future<void> setTheme(AppThemeMode themeMode) async {
    state = themeMode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeKey, themeMode.name);
  }

  String get currentThemeName {
    switch (state) {
      case AppThemeMode.light:
        return '☀️ Bright Mode';
      case AppThemeMode.dark:
        return '🌓 Dark Mode';
      case AppThemeMode.system:
        return '📱 System';
    }
  }

  bool isDarkMode(BuildContext context) {
    switch (state) {
      case AppThemeMode.light:
        return false;
      case AppThemeMode.dark:
        return true;
      case AppThemeMode.system:
        return MediaQuery.of(context).platformBrightness == Brightness.dark;
    }
  }
}

@riverpod
ThemeData lightTheme(LightThemeRef ref) => AppTheme.lightTheme;

@riverpod
ThemeData darkTheme(DarkThemeRef ref) => AppTheme.darkTheme;