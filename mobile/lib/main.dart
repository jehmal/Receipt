import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'core/config/app_config.dart';
import 'core/storage/local_storage.dart';
import 'core/auth/workos_auth_service.dart';
import 'shared/widgets/app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Hive.initFlutter();
  await LocalStorage.init();
  
  runApp(
    const ProviderScope(
      child: ReceiptVaultApp(),
    ),
  );
}