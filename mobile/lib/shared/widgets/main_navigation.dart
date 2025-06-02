import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import '../../core/auth/auth_provider.dart';

class MainNavigation extends ConsumerWidget {
  final Widget child;

  const MainNavigation({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final currentLocation = GoRouter.of(context).routerDelegate.currentConfiguration.uri.toString();

    // Determine which tab is currently active
    int currentIndex = _getCurrentIndex(currentLocation);

    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: currentIndex,
        onTap: (index) => _onTabTapped(context, index, user?.userType),
        items: [
          const BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            activeIcon: Icon(Icons.home),
            label: 'Home',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.camera_alt_outlined),
            activeIcon: Icon(Icons.camera_alt),
            label: 'Camera',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.receipt_outlined),
            activeIcon: Icon(Icons.receipt),
            label: 'Receipts',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.search_outlined),
            activeIcon: Icon(Icons.search),
            label: 'Search',
          ),
          if (user?.userType == 'company_admin' || user?.userType == 'company_employee')
            BottomNavigationBarItem(
              icon: Icon(MdiIcons.officeBuilding),
              activeIcon: Icon(MdiIcons.officeBuildingMarker),
              label: 'Company',
            ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            activeIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }

  int _getCurrentIndex(String location) {
    if (location.startsWith('/home')) return 0;
    if (location.startsWith('/camera')) return 1;
    if (location.startsWith('/receipts')) return 2;
    if (location.startsWith('/search')) return 3;
    if (location.startsWith('/company')) return 4;
    if (location.startsWith('/profile')) return 5;
    return 0;
  }

  void _onTabTapped(BuildContext context, int index, String? userType) {
    switch (index) {
      case 0:
        context.go('/home');
        break;
      case 1:
        context.go('/camera');
        break;
      case 2:
        context.go('/receipts');
        break;
      case 3:
        context.go('/search');
        break;
      case 4:
        if (userType == 'company_admin' || userType == 'company_employee') {
          context.go('/company');
        } else {
          context.go('/profile');
        }
        break;
      case 5:
        context.go('/profile');
        break;
    }
  }
}