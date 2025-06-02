import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../services/workos_auth_service.dart';
import '../../core/config/app_config.dart';

class WorkOSLoginScreen extends StatefulWidget {
  const WorkOSLoginScreen({super.key});

  @override
  State<WorkOSLoginScreen> createState() => _WorkOSLoginScreenState();
}

class _WorkOSLoginScreenState extends State<WorkOSLoginScreen> {
  late final WebViewController _controller;
  late final WorkOSAuthService _authService;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _initializeAuth();
  }

  void _initializeAuth() {
    _authService = WorkOSAuthService(baseUrl: AppConfig.apiBaseUrl);
    
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            setState(() {
              _isLoading = true;
              _error = null;
            });
          },
          onPageFinished: (String url) {
            setState(() {
              _isLoading = false;
            });
            
            // Check if user successfully authenticated
            if (url.contains('/dashboard')) {
              _handleAuthSuccess();
            }
          },
          onWebResourceError: (WebResourceError error) {
            setState(() {
              _error = 'Failed to load authentication page';
              _isLoading = false;
            });
          },
          onNavigationRequest: (NavigationRequest request) {
            // Allow all navigation for WorkOS authentication flow
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(_authService.getLoginUrl()));
  }

  Future<void> _handleAuthSuccess() async {
    try {
      final user = await _authService.handleAuthSuccess();
      if (user != null && mounted) {
        // Navigate to main app
        Navigator.of(context).pushReplacementNamed('/dashboard');
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Authentication failed: ${e.toString()}';
        });
      }
    }
  }

  void _retry() {
    setState(() {
      _error = null;
      _isLoading = true;
    });
    _controller.loadRequest(Uri.parse(_authService.getLoginUrl()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Sign In',
          style: TextStyle(
            color: Colors.black87,
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
      ),
      body: Column(
        children: [
          // Progress indicator
          if (_isLoading)
            Container(
              height: 4,
              child: const LinearProgressIndicator(
                backgroundColor: Colors.grey,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.blue),
              ),
            ),
          
          // Error message
          if (_error != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              color: Colors.red.shade50,
              child: Row(
                children: [
                  Icon(Icons.error_outline, color: Colors.red.shade700),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _error!,
                      style: TextStyle(
                        color: Colors.red.shade700,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: _retry,
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          
          // WebView
          Expanded(
            child: _error != null
                ? _buildErrorState()
                : WebViewWidget(controller: _controller),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.wifi_off,
              size: 64,
              color: Colors.grey.shade400,
            ),
            const SizedBox(height: 24),
            Text(
              'Connection Error',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w600,
                color: Colors.grey.shade700,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Unable to connect to authentication service. Please check your internet connection and try again.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Colors.grey.shade600,
              ),
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              onPressed: _retry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try Again'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
} 