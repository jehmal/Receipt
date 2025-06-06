import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image/image.dart' as img;

import '../providers/image_processing_provider.dart';
import '../widgets/image_crop_widget.dart';
import '../widgets/image_enhance_controls.dart';

class ImageEditorScreen extends ConsumerStatefulWidget {
  final String imagePath;
  final VoidCallback onCancel;
  final Function(String) onSave;

  const ImageEditorScreen({
    super.key,
    required this.imagePath,
    required this.onCancel,
    required this.onSave,
  });

  @override
  ConsumerState<ImageEditorScreen> createState() => _ImageEditorScreenState();
}

class _ImageEditorScreenState extends ConsumerState<ImageEditorScreen>
    with TickerProviderStateMixin {
  late TabController _tabController;
  String? _processedImagePath;
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _processedImagePath = widget.imagePath;
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _cropImage() async {
    setState(() => _isProcessing = true);
    
    try {
      final croppedFile = await ImageCropper().cropImage(
        sourcePath: _processedImagePath!,
        uiSettings: [
          AndroidUiSettings(
            toolbarTitle: 'Crop Receipt',
            toolbarColor: Theme.of(context).primaryColor,
            toolbarWidgetColor: Colors.white,
            initAspectRatio: CropAspectRatioPreset.original,
            lockAspectRatio: false,
          ),
          IOSUiSettings(
            title: 'Crop Receipt',
          ),
        ],
      );

      if (croppedFile != null) {
        setState(() {
          _processedImagePath = croppedFile.path;
        });
      }
    } catch (e) {
      _showErrorSnackBar('Failed to crop image: $e');
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  Future<void> _enhanceImage() async {
    setState(() => _isProcessing = true);
    
    try {
      await ref
          .read(imageProcessingProvider.notifier)
          .enhanceImage(_processedImagePath!);
      
      final state = ref.read(imageProcessingProvider);
      if (state is ImageProcessingCompletedState) {
        setState(() {
          _processedImagePath = state.processedPath;
        });
      }
    } catch (e) {
      _showErrorSnackBar('Failed to enhance image: $e');
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  Future<void> _applyFilter(ImageFilter filter) async {
    setState(() => _isProcessing = true);
    
    try {
      // Apply basic filters based on the filter type
      ImageProcessingOptions? options;
      
      switch (filter) {
        case ImageFilter.autoEnhance:
          options = ImageProcessingOptions(
            brightness: 0.1,
            contrast: 0.2,
            autoEnhance: true,
          );
          break;
        case ImageFilter.sharpen:
          options = ImageProcessingOptions(contrast: 0.3);
          break;
        case ImageFilter.brighten:
          options = ImageProcessingOptions(brightness: 0.3);
          break;
        case ImageFilter.contrast:
          options = ImageProcessingOptions(contrast: 0.4);
          break;
        case ImageFilter.grayscale:
          options = ImageProcessingOptions(saturation: -1.0);
          break;
        case ImageFilter.original:
          // Reset to original
          setState(() {
            _processedImagePath = widget.imagePath;
          });
          return;
      }
      
      if (options != null) {
        await ref.read(imageProcessingProvider.notifier).processImage(
          _processedImagePath!,
          options: options,
        );
        
        final state = ref.read(imageProcessingProvider);
        if (state is ImageProcessingCompletedState) {
          setState(() {
            _processedImagePath = state.processedPath;
          });
        }
      }
    } catch (e) {
      _showErrorSnackBar('Failed to apply filter: $e');
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Theme.of(context).colorScheme.error,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text(
          'Edit Receipt',
          style: TextStyle(color: Colors.white),
        ),
        leading: IconButton(
          onPressed: widget.onCancel,
          icon: const Icon(Icons.close, color: Colors.white),
        ),
        actions: [
          TextButton(
            onPressed: _isProcessing 
                ? null 
                : () => widget.onSave(_processedImagePath!),
            child: Text(
              'Save',
              style: TextStyle(
                color: _isProcessing 
                    ? Colors.grey 
                    : Theme.of(context).primaryColor,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Theme.of(context).primaryColor,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.grey,
          tabs: const [
            Tab(text: 'Crop'),
            Tab(text: 'Enhance'),
            Tab(text: 'Filters'),
          ],
        ),
      ),
      body: Column(
        children: [
          // Image preview
          Expanded(
            flex: 3,
            child: Container(
              width: double.infinity,
              margin: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey[800]!),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: _processedImagePath != null
                    ? Stack(
                        children: [
                          Image.file(
                            File(_processedImagePath!),
                            fit: BoxFit.contain,
                            width: double.infinity,
                            height: double.infinity,
                          ),
                          if (_isProcessing)
                            Container(
                              color: Colors.black54,
                              child: const Center(
                                child: CircularProgressIndicator(),
                              ),
                            ),
                        ],
                      )
                    : const Center(
                        child: CircularProgressIndicator(),
                      ),
              ),
            ),
          ),
          
          // Controls
          Expanded(
            flex: 1,
            child: TabBarView(
              controller: _tabController,
              children: [
                // Crop controls
                _buildCropControls(),
                
                // Enhancement controls
                _buildEnhanceControls(),
                
                // Filter controls
                _buildFilterControls(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCropControls() {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          const Text(
            'Crop your receipt to remove unwanted areas',
            style: TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: _isProcessing ? null : _cropImage,
            icon: const Icon(Icons.crop),
            label: const Text('Crop Image'),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEnhanceControls() {
    return ImageEnhanceControls(
      options: ImageEnhanceOptions.defaults(),
      onOptionsChanged: (options) {
        // Apply the enhancement options to the image
        _applyEnhanceOptions(options);
      },
      onAutoEnhance: _enhanceImage,
      onReset: () {
        // Reset to original image
        setState(() {
          _processedImagePath = widget.imagePath;
        });
      },
    );
  }

  Future<void> _applyEnhanceOptions(ImageEnhanceOptions options) async {
    setState(() => _isProcessing = true);
    
    try {
      // Apply the enhancement options using the image processing provider
      await ref.read(imageProcessingProvider.notifier).processImage(
        _processedImagePath!,
        options: ImageProcessingOptions(
          brightness: options.brightness,
          contrast: options.contrast,
          saturation: options.saturation,
        ),
      );
      
      final state = ref.read(imageProcessingProvider);
      if (state is ImageProcessingCompletedState) {
        setState(() {
          _processedImagePath = state.processedPath;
        });
      }
    } catch (e) {
      _showErrorSnackBar('Failed to apply enhancements: $e');
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  Widget _buildFilterControls() {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Apply filters to improve readability',
            style: TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: GridView.count(
              crossAxisCount: 3,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              children: [
                _buildFilterButton('Auto Enhance', ImageFilter.autoEnhance),
                _buildFilterButton('Sharpen', ImageFilter.sharpen),
                _buildFilterButton('Brighten', ImageFilter.brighten),
                _buildFilterButton('Contrast', ImageFilter.contrast),
                _buildFilterButton('Grayscale', ImageFilter.grayscale),
                _buildFilterButton('Original', ImageFilter.original),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterButton(String label, ImageFilter filter) {
    return ElevatedButton(
      onPressed: _isProcessing ? null : () => _applyFilter(filter),
      style: ElevatedButton.styleFrom(
        padding: const EdgeInsets.all(8),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 12),
      ),
    );
  }
}

enum ImageFilter {
  original,
  autoEnhance,
  sharpen,
  brighten,
  contrast,
  grayscale,
}