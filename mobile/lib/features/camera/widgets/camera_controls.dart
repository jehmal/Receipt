import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_theme.dart';

class CameraControls extends ConsumerWidget {
  final VoidCallback? onCapture;
  final VoidCallback? onFlipCamera;
  final VoidCallback? onFlashToggle;
  final VoidCallback? onGalleryTap;
  final bool isFlashOn;
  final bool isLoading;

  const CameraControls({
    super.key,
    this.onCapture,
    this.onFlipCamera,
    this.onFlashToggle,
    this.onGalleryTap,
    this.isFlashOn = false,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.transparent,
            Colors.black.withOpacity(0.7),
          ],
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          // Gallery button
          _buildControlButton(
            icon: Icons.photo_library,
            onTap: onGalleryTap,
            isEnabled: !isLoading,
          ),
          
          // Capture button
          GestureDetector(
            onTap: isLoading ? null : onCapture,
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isLoading 
                    ? Colors.grey 
                    : theme.colorScheme.primary,
                border: Border.all(
                  color: Colors.white,
                  width: 4,
                ),
              ),
              child: isLoading
                  ? const CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 3,
                    )
                  : Icon(
                      Icons.camera_alt,
                      color: Colors.white,
                      size: 32,
                    ),
            ),
          ),
          
          // Camera controls column
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Flash toggle
              _buildControlButton(
                icon: isFlashOn ? Icons.flash_on : Icons.flash_off,
                onTap: onFlashToggle,
                isEnabled: !isLoading,
                isActive: isFlashOn,
              ),
              const SizedBox(height: 16),
              // Flip camera
              _buildControlButton(
                icon: Icons.flip_camera_ios,
                onTap: onFlipCamera,
                isEnabled: !isLoading,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildControlButton({
    required IconData icon,
    VoidCallback? onTap,
    bool isEnabled = true,
    bool isActive = false,
  }) {
    return GestureDetector(
      onTap: isEnabled ? onTap : null,
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isActive 
              ? Colors.white.withOpacity(0.3)
              : Colors.black.withOpacity(0.3),
          border: Border.all(
            color: isActive ? Colors.white : Colors.white.withOpacity(0.5),
            width: 2,
          ),
        ),
        child: Icon(
          icon,
          color: isEnabled 
              ? Colors.white 
              : Colors.white.withOpacity(0.5),
          size: 24,
        ),
      ),
    );
  }
}