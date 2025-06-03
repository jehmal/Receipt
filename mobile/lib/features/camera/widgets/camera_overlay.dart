import 'package:flutter/material.dart';
import '../../../core/config/app_theme.dart';

class CameraOverlay extends StatefulWidget {
  const CameraOverlay({super.key});

  @override
  State<CameraOverlay> createState() => _CameraOverlayState();
}

class _CameraOverlayState extends State<CameraOverlay>
    with TickerProviderStateMixin {
  late AnimationController _scanlineController;
  late Animation<double> _scanlineAnimation;
  late AnimationController _cornerController;
  late Animation<double> _cornerAnimation;

  @override
  void initState() {
    super.initState();
    
    _scanlineController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    );
    
    _cornerController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );
    
    _scanlineAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _scanlineController,
      curve: Curves.easeInOut,
    ));
    
    _cornerAnimation = Tween<double>(
      begin: 0.8,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _cornerController,
      curve: Curves.easeInOut,
    ));
    
    _scanlineController.repeat(reverse: true);
    _cornerController.repeat(reverse: true);
  }

  @override
  void dispose() {
    _scanlineController.dispose();
    _cornerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;
    final overlayWidth = screenSize.width * 0.8;
    final overlayHeight = overlayWidth * 0.7; // Receipt aspect ratio
    return Center(
      child: SizedBox(
        width: overlayWidth,
        height: overlayHeight,
        child: AnimatedBuilder(
          animation: Listenable.merge([_scanlineAnimation, _cornerAnimation]),
          builder: (context, child) {
            return Stack(
              children: [
                // Main frame
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: Colors.white.withOpacity(0.8),
                      width: 2,
                    ),
                    borderRadius: BorderRadius.circular(AppTheme.radiusM),
                  ),
                ),
                
                // Animated corners
                _buildAnimatedCorner(
                  alignment: Alignment.topLeft,
                  angle: 0,
                ),
                _buildAnimatedCorner(
                  alignment: Alignment.topRight,
                  angle: 1.5708, // 90 degrees
                ),
                _buildAnimatedCorner(
                  alignment: Alignment.bottomLeft,
                  angle: -1.5708, // -90 degrees
                ),
                _buildAnimatedCorner(
                  alignment: Alignment.bottomRight,
                  angle: 3.14159, // 180 degrees
                ),
                
                // Scanning line effect
                Positioned(
                  top: overlayHeight * _scanlineAnimation.value * 0.8,
                  left: 0,
                  right: 0,
                  child: Container(
                    height: 2,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.transparent,
                          AppTheme.success.withOpacity(0.8),
                          Colors.transparent,
                        ],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.success.withOpacity(0.5),
                          blurRadius: 4,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                  ),
                ),
                
                // Center instruction
                Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppTheme.spacingM,
                      vertical: AppTheme.spacingS,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.6),
                      borderRadius: BorderRadius.circular(AppTheme.radiusL),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.crop_free,
                          color: Colors.white,
                          size: 32,
                        ),
                        const SizedBox(height: AppTheme.spacingS),
                        Text(
                          'Align receipt within frame',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w500,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        Text(
                          'Auto-crop will detect edges',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.white.withOpacity(0.8),
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
  
  Widget _buildAnimatedCorner({
    required Alignment alignment,
    required double angle,
  }) {
    return Positioned.fill(
      child: Align(
        alignment: alignment,
        child: Transform.rotate(
          angle: angle,
          child: Transform.scale(
            scale: _cornerAnimation.value,
            child: Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(
                    color: AppTheme.success,
                    width: 3,
                  ),
                  left: BorderSide(
                    color: AppTheme.success,
                    width: 3,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}