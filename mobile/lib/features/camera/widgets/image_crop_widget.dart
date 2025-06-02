import 'package:flutter/material.dart';
import 'dart:io';

class ImageCropWidget extends StatefulWidget {
  final String imagePath;
  final Function(Rect cropRect) onCropChanged;
  final VoidCallback? onCropCompleted;

  const ImageCropWidget({
    Key? key,
    required this.imagePath,
    required this.onCropChanged,
    this.onCropCompleted,
  }) : super(key: key);

  @override
  State<ImageCropWidget> createState() => _ImageCropWidgetState();
}

class _ImageCropWidgetState extends State<ImageCropWidget> {
  late Rect _cropRect;
  Size? _imageSize;
  bool _isDragging = false;
  late Offset _dragStart;

  @override
  void initState() {
    super.initState();
    _cropRect = const Rect.fromLTWH(50, 50, 200, 200);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey),
        borderRadius: BorderRadius.circular(8),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          children: [
            // Background image
            Image.file(
              File(widget.imagePath),
              fit: BoxFit.contain,
              width: double.infinity,
              height: double.infinity,
            ),
            
            // Crop overlay
            CustomPaint(
              painter: CropOverlayPainter(_cropRect),
              size: Size.infinite,
            ),
            
            // Crop handles
            ..._buildCropHandles(),
            
            // Action buttons
            Positioned(
              bottom: 16,
              right: 16,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  FloatingActionButton.small(
                    heroTag: "reset_crop",
                    onPressed: _resetCrop,
                    backgroundColor: Colors.white,
                    child: const Icon(Icons.refresh, color: Colors.blue),
                  ),
                  const SizedBox(width: 8),
                  FloatingActionButton.small(
                    heroTag: "apply_crop",
                    onPressed: _applyCrop,
                    backgroundColor: Colors.blue,
                    child: const Icon(Icons.check, color: Colors.white),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildCropHandles() {
    const handleSize = 20.0;
    const handleColor = Colors.blue;
    
    return [
      // Top-left handle
      Positioned(
        left: _cropRect.left - handleSize / 2,
        top: _cropRect.top - handleSize / 2,
        child: GestureDetector(
          onPanStart: (details) => _onHandlePanStart(details, HandlePosition.topLeft),
          onPanUpdate: (details) => _onHandlePanUpdate(details, HandlePosition.topLeft),
          child: Container(
            width: handleSize,
            height: handleSize,
            decoration: const BoxDecoration(
              color: handleColor,
              shape: BoxShape.circle,
            ),
          ),
        ),
      ),
      
      // Top-right handle
      Positioned(
        left: _cropRect.right - handleSize / 2,
        top: _cropRect.top - handleSize / 2,
        child: GestureDetector(
          onPanStart: (details) => _onHandlePanStart(details, HandlePosition.topRight),
          onPanUpdate: (details) => _onHandlePanUpdate(details, HandlePosition.topRight),
          child: Container(
            width: handleSize,
            height: handleSize,
            decoration: const BoxDecoration(
              color: handleColor,
              shape: BoxShape.circle,
            ),
          ),
        ),
      ),
      
      // Bottom-left handle
      Positioned(
        left: _cropRect.left - handleSize / 2,
        top: _cropRect.bottom - handleSize / 2,
        child: GestureDetector(
          onPanStart: (details) => _onHandlePanStart(details, HandlePosition.bottomLeft),
          onPanUpdate: (details) => _onHandlePanUpdate(details, HandlePosition.bottomLeft),
          child: Container(
            width: handleSize,
            height: handleSize,
            decoration: const BoxDecoration(
              color: handleColor,
              shape: BoxShape.circle,
            ),
          ),
        ),
      ),
      
      // Bottom-right handle
      Positioned(
        left: _cropRect.right - handleSize / 2,
        top: _cropRect.bottom - handleSize / 2,
        child: GestureDetector(
          onPanStart: (details) => _onHandlePanStart(details, HandlePosition.bottomRight),
          onPanUpdate: (details) => _onHandlePanUpdate(details, HandlePosition.bottomRight),
          child: Container(
            width: handleSize,
            height: handleSize,
            decoration: const BoxDecoration(
              color: handleColor,
              shape: BoxShape.circle,
            ),
          ),
        ),
      ),
    ];
  }

  void _onHandlePanStart(DragStartDetails details, HandlePosition position) {
    _isDragging = true;
    _dragStart = details.localPosition;
  }

  void _onHandlePanUpdate(DragUpdateDetails details, HandlePosition position) {
    if (!_isDragging) return;

    final delta = details.localPosition - _dragStart;
    Rect newCropRect = _cropRect;

    switch (position) {
      case HandlePosition.topLeft:
        newCropRect = Rect.fromLTRB(
          _cropRect.left + delta.dx,
          _cropRect.top + delta.dy,
          _cropRect.right,
          _cropRect.bottom,
        );
        break;
      case HandlePosition.topRight:
        newCropRect = Rect.fromLTRB(
          _cropRect.left,
          _cropRect.top + delta.dy,
          _cropRect.right + delta.dx,
          _cropRect.bottom,
        );
        break;
      case HandlePosition.bottomLeft:
        newCropRect = Rect.fromLTRB(
          _cropRect.left + delta.dx,
          _cropRect.top,
          _cropRect.right,
          _cropRect.bottom + delta.dy,
        );
        break;
      case HandlePosition.bottomRight:
        newCropRect = Rect.fromLTRB(
          _cropRect.left,
          _cropRect.top,
          _cropRect.right + delta.dx,
          _cropRect.bottom + delta.dy,
        );
        break;
    }

    // Validate crop rectangle
    if (newCropRect.width > 50 && newCropRect.height > 50) {
      setState(() {
        _cropRect = newCropRect;
      });
      widget.onCropChanged(_cropRect);
    }

    _dragStart = details.localPosition;
  }

  void _resetCrop() {
    setState(() {
      _cropRect = const Rect.fromLTWH(50, 50, 200, 200);
    });
    widget.onCropChanged(_cropRect);
  }

  void _applyCrop() {
    widget.onCropCompleted?.call();
  }
}

enum HandlePosition {
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
}

class CropOverlayPainter extends CustomPainter {
  final Rect cropRect;

  CropOverlayPainter(this.cropRect);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black54
      ..style = PaintingStyle.fill;

    // Draw dark overlay outside crop area
    canvas.drawPath(
      Path()
        ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
        ..addRect(cropRect)
        ..fillType = PathFillType.evenOdd,
      paint,
    );

    // Draw crop border
    final borderPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    canvas.drawRect(cropRect, borderPaint);

    // Draw grid lines
    final gridPaint = Paint()
      ..color = Colors.white70
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    // Vertical grid lines
    for (int i = 1; i < 3; i++) {
      final x = cropRect.left + (cropRect.width / 3) * i;
      canvas.drawLine(
        Offset(x, cropRect.top),
        Offset(x, cropRect.bottom),
        gridPaint,
      );
    }

    // Horizontal grid lines
    for (int i = 1; i < 3; i++) {
      final y = cropRect.top + (cropRect.height / 3) * i;
      canvas.drawLine(
        Offset(cropRect.left, y),
        Offset(cropRect.right, y),
        gridPaint,
      );
    }
  }

  @override
  bool shouldRepaint(CropOverlayPainter oldDelegate) {
    return oldDelegate.cropRect != cropRect;
  }
}