import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/local_storage.dart';
import '../models/warranty.dart';

part 'warranty_provider.g.dart';

@riverpod
class WarrantyNotifier extends _$WarrantyNotifier {
  @override
  Future<List<Warranty>> build() async {
    return loadWarranties();
  }

  Future<List<Warranty>> loadWarranties() async {
    try {
      // Load from local storage first for offline capability
      final localWarranties = await _loadLocalWarranties();
      
      // Try to sync with server
      try {
        final serverWarranties = await _loadServerWarranties();
        await _saveLocalWarranties(serverWarranties);
        return serverWarranties;
      } catch (e) {
        // If server fails, return local data
        return localWarranties;
      }
    } catch (e) {
      throw Exception('Failed to load warranties: $e');
    }
  }

  Future<void> addWarranty(Warranty warranty) async {
    final current = await future;
    final newList = [...current, warranty];
    
    // Update state immediately for responsive UI
    state = AsyncValue.data(newList);
    
    try {
      // Save locally
      await _saveLocalWarranties(newList);
      
      // Sync to server
      await _syncWarrantyToServer(warranty);
    } catch (e) {
      // Revert on failure
      state = AsyncValue.data(current);
      rethrow;
    }
  }

  Future<void> updateWarranty(Warranty warranty) async {
    final current = await future;
    final index = current.indexWhere((w) => w.id == warranty.id);
    
    if (index == -1) {
      throw Exception('Warranty not found');
    }
    
    final newList = [...current];
    newList[index] = warranty;
    
    // Update state immediately for responsive UI
    state = AsyncValue.data(newList);
    
    try {
      // Save locally
      await _saveLocalWarranties(newList);
      
      // Sync to server
      await _syncWarrantyToServer(warranty);
    } catch (e) {
      // Revert on failure
      state = AsyncValue.data(current);
      rethrow;
    }
  }

  Future<void> deleteWarranty(String warrantyId) async {
    final current = await future;
    final newList = current.where((w) => w.id != warrantyId).toList();
    
    // Update state immediately for responsive UI
    state = AsyncValue.data(newList);
    
    try {
      // Save locally
      await _saveLocalWarranties(newList);
      
      // Delete from server
      await _deleteWarrantyFromServer(warrantyId);
    } catch (e) {
      // Revert on failure
      state = AsyncValue.data(current);
      rethrow;
    }
  }

  Future<void> markForBlockchainStamp(String warrantyId) async {
    final current = await future;
    final newList = current.map((w) => 
        w.id == warrantyId ? w.copyWith(blockchainStamped: true) : w).toList();
    
    state = AsyncValue.data(newList);
    
    try {
      await _saveLocalWarranties(newList);
      // TODO: Implement blockchain stamping API call
      await _requestBlockchainStamp(warrantyId);
    } catch (e) {
      state = AsyncValue.data(current);
      rethrow;
    }
  }

  // Private methods
  Future<List<Warranty>> _loadLocalWarranties() async {
    try {
      final warrantyData = LocalStorage.getSetting<List>('warranties')?.cast<Map<String, dynamic>>() ?? <Map<String, dynamic>>[];
      return warrantyData.map((data) => Warranty.fromJson(data)).toList();
    } catch (e) {
      return [];
    }
  }

  Future<void> _saveLocalWarranties(List<Warranty> warranties) async {
    final warrantyData = warranties.map((w) => w.toJson()).toList();
    await LocalStorage.saveSetting('warranties', warrantyData);
  }

  Future<List<Warranty>> _loadServerWarranties() async {
    final apiClient = ApiClient.instance;
    final response = await apiClient.get('/warranties');
    
    if (response.statusCode == 200) {
      final List<dynamic> data = response.data['warranties'];
      return data.map((json) => Warranty.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load warranties from server');
    }
  }

  Future<void> _syncWarrantyToServer(Warranty warranty) async {
    final apiClient = ApiClient.instance;
    
    if (warranty.isNewRecord) {
      // Create new warranty
      await apiClient.post('/warranties', warranty.toJson());
    } else {
      // Update existing warranty
      await apiClient.put('/warranties/${warranty.id}', warranty.toJson());
    }
  }

  Future<void> _deleteWarrantyFromServer(String warrantyId) async {
    final apiClient = ApiClient.instance;
    await apiClient.delete('/warranties/$warrantyId');
  }

  Future<void> _requestBlockchainStamp(String warrantyId) async {
    final apiClient = ApiClient.instance;
    await apiClient.post('/warranties/$warrantyId/blockchain-stamp', {});
  }
}

// Additional providers for warranty statistics
@riverpod
Future<WarrantyStats> warrantyStats(WarrantyStatsRef ref) async {
  final warranties = await ref.watch(warrantyNotifierProvider.future);
  
  final now = DateTime.now();
  final thirtyDaysFromNow = now.add(const Duration(days: 30));
  
  final active = warranties.where((w) => !w.isExpired).length;
  final expired = warranties.where((w) => w.isExpired).length;
  final expiringSoon = warranties.where((w) => 
      !w.isExpired && w.expiryDate.isBefore(thirtyDaysFromNow)).length;
  
  final totalValue = warranties.fold<double>(
    0.0, 
    (sum, w) => sum + (w.purchasePrice ?? 0),
  );
  
  return WarrantyStats(
    total: warranties.length,
    active: active,
    expired: expired,
    expiringSoon: expiringSoon,
    totalValue: totalValue,
  );
}

@riverpod
Future<List<WarrantyCategory>> warrantyCategories(WarrantyCategoriesRef ref) async {
  final warranties = await ref.watch(warrantyNotifierProvider.future);
  
  final categoryMap = <String, int>{};
  for (final warranty in warranties) {
    categoryMap[warranty.category] = (categoryMap[warranty.category] ?? 0) + 1;
  }
  
  return categoryMap.entries
      .map((entry) => WarrantyCategory(
            name: entry.key,
            count: entry.value,
          ))
      .toList()
    ..sort((a, b) => b.count.compareTo(a.count));
}

// Helper classes
class WarrantyStats {
  final int total;
  final int active;
  final int expired;
  final int expiringSoon;
  final double totalValue;

  const WarrantyStats({
    required this.total,
    required this.active,
    required this.expired,
    required this.expiringSoon,
    required this.totalValue,
  });
}

class WarrantyCategory {
  final String name;
  final int count;

  const WarrantyCategory({
    required this.name,
    required this.count,
  });
}