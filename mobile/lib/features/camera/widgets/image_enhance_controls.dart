import 'package:flutter/material.dart';

class ImageEnhanceControls extends StatefulWidget {
  final ImageEnhanceOptions options;
  final Function(ImageEnhanceOptions) onOptionsChanged;
  final VoidCallback? onAutoEnhance;
  final VoidCallback? onReset;

  const ImageEnhanceControls({
    Key? key,
    required this.options,
    required this.onOptionsChanged,
    this.onAutoEnhance,
    this.onReset,
  }) : super(key: key);

  @override
  State<ImageEnhanceControls> createState() => _ImageEnhanceControlsState();
}

class _ImageEnhanceControlsState extends State<ImageEnhanceControls> {
  late ImageEnhanceOptions _options;

  @override
  void initState() {
    super.initState();
    _options = widget.options;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header with auto enhance and reset buttons
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Enhance Image',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              Row(
                children: [
                  TextButton.icon(
                    onPressed: widget.onAutoEnhance,
                    icon: const Icon(Icons.auto_fix_high),
                    label: const Text('Auto'),
                  ),
                  TextButton.icon(
                    onPressed: _resetToDefaults,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Reset'),
                  ),
                ],
              ),
            ],
          ),
          
          const SizedBox(height: 16),
          
          // Brightness control
          _buildSliderControl(
            label: 'Brightness',
            value: _options.brightness,
            min: -1.0,
            max: 1.0,
            onChanged: (value) {
              _updateOptions(_options.copyWith(brightness: value));
            },
            icon: Icons.brightness_6,
          ),
          
          // Contrast control
          _buildSliderControl(
            label: 'Contrast',
            value: _options.contrast,
            min: -1.0,
            max: 1.0,
            onChanged: (value) {
              _updateOptions(_options.copyWith(contrast: value));
            },
            icon: Icons.contrast,
          ),
          
          // Saturation control
          _buildSliderControl(
            label: 'Saturation',
            value: _options.saturation,
            min: -1.0,
            max: 1.0,
            onChanged: (value) {
              _updateOptions(_options.copyWith(saturation: value));
            },
            icon: Icons.palette,
          ),
          
          // Exposure control
          _buildSliderControl(
            label: 'Exposure',
            value: _options.exposure,
            min: -2.0,
            max: 2.0,
            onChanged: (value) {
              _updateOptions(_options.copyWith(exposure: value));
            },
            icon: Icons.exposure,
          ),
          
          // Highlights control
          _buildSliderControl(
            label: 'Highlights',
            value: _options.highlights,
            min: -1.0,
            max: 1.0,
            onChanged: (value) {
              _updateOptions(_options.copyWith(highlights: value));
            },
            icon: Icons.highlight,
          ),
          
          // Shadows control
          _buildSliderControl(
            label: 'Shadows',
            value: _options.shadows,
            min: -1.0,
            max: 1.0,
            onChanged: (value) {
              _updateOptions(_options.copyWith(shadows: value));
            },
            icon: Icons.dark_mode,
          ),
          
          const SizedBox(height: 16),
          
          // Quick preset buttons
          Wrap(
            spacing: 8,
            children: [
              _buildPresetButton('Vivid', _getVividPreset()),
              _buildPresetButton('Natural', _getNaturalPreset()),
              _buildPresetButton('Dramatic', _getDramaticPreset()),
              _buildPresetButton('Document', _getDocumentPreset()),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSliderControl({
    required String label,
    required double value,
    required double min,
    required double max,
    required ValueChanged<double> onChanged,
    required IconData icon,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: Colors.grey[600]),
              const SizedBox(width: 8),
              Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                ),
              ),
              const Spacer(),
              Text(
                value.toStringAsFixed(2),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.grey[600],
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: Colors.blue,
              inactiveTrackColor: Colors.grey[300],
              thumbColor: Colors.blue,
              overlayColor: Colors.blue.withOpacity(0.2),
              trackHeight: 2,
            ),
            child: Slider(
              value: value,
              min: min,
              max: max,
              divisions: 100,
              onChanged: onChanged,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPresetButton(String label, ImageEnhanceOptions preset) {
    final isSelected = _options == preset;
    
    return InkWell(
      onTap: () => _updateOptions(preset),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? Colors.blue : Colors.grey[200],
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.grey[700],
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ),
    );
  }

  void _updateOptions(ImageEnhanceOptions newOptions) {
    setState(() {
      _options = newOptions;
    });
    widget.onOptionsChanged(newOptions);
  }

  void _resetToDefaults() {
    _updateOptions(ImageEnhanceOptions.defaults());
    widget.onReset?.call();
  }

  ImageEnhanceOptions _getVividPreset() {
    return ImageEnhanceOptions.defaults().copyWith(
      saturation: 0.3,
      contrast: 0.2,
      brightness: 0.1,
    );
  }

  ImageEnhanceOptions _getNaturalPreset() {
    return ImageEnhanceOptions.defaults();
  }

  ImageEnhanceOptions _getDramaticPreset() {
    return ImageEnhanceOptions.defaults().copyWith(
      contrast: 0.4,
      highlights: -0.3,
      shadows: 0.2,
      saturation: 0.2,
    );
  }

  ImageEnhanceOptions _getDocumentPreset() {
    return ImageEnhanceOptions.defaults().copyWith(
      contrast: 0.6,
      brightness: 0.2,
      saturation: -0.5,
      exposure: 0.3,
    );
  }
}

class ImageEnhanceOptions {
  final double brightness;
  final double contrast;
  final double saturation;
  final double exposure;
  final double highlights;
  final double shadows;

  const ImageEnhanceOptions({
    this.brightness = 0.0,
    this.contrast = 0.0,
    this.saturation = 0.0,
    this.exposure = 0.0,
    this.highlights = 0.0,
    this.shadows = 0.0,
  });

  factory ImageEnhanceOptions.defaults() {
    return const ImageEnhanceOptions();
  }

  ImageEnhanceOptions copyWith({
    double? brightness,
    double? contrast,
    double? saturation,
    double? exposure,
    double? highlights,
    double? shadows,
  }) {
    return ImageEnhanceOptions(
      brightness: brightness ?? this.brightness,
      contrast: contrast ?? this.contrast,
      saturation: saturation ?? this.saturation,
      exposure: exposure ?? this.exposure,
      highlights: highlights ?? this.highlights,
      shadows: shadows ?? this.shadows,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    
    return other is ImageEnhanceOptions &&
        other.brightness == brightness &&
        other.contrast == contrast &&
        other.saturation == saturation &&
        other.exposure == exposure &&
        other.highlights == highlights &&
        other.shadows == shadows;
  }

  @override
  int get hashCode {
    return brightness.hashCode ^
        contrast.hashCode ^
        saturation.hashCode ^
        exposure.hashCode ^
        highlights.hashCode ^
        shadows.hashCode;
  }

  Map<String, dynamic> toJson() {
    return {
      'brightness': brightness,
      'contrast': contrast,
      'saturation': saturation,
      'exposure': exposure,
      'highlights': highlights,
      'shadows': shadows,
    };
  }

  factory ImageEnhanceOptions.fromJson(Map<String, dynamic> json) {
    return ImageEnhanceOptions(
      brightness: (json['brightness'] ?? 0.0).toDouble(),
      contrast: (json['contrast'] ?? 0.0).toDouble(),
      saturation: (json['saturation'] ?? 0.0).toDouble(),
      exposure: (json['exposure'] ?? 0.0).toDouble(),
      highlights: (json['highlights'] ?? 0.0).toDouble(),
      shadows: (json['shadows'] ?? 0.0).toDouble(),
    );
  }
}