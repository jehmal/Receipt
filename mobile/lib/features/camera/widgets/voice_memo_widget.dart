import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

class VoiceMemoWidget extends StatefulWidget {
  final Function(String) onVoiceMemo;
  final TextEditingController textController;

  const VoiceMemoWidget({
    super.key,
    required this.onVoiceMemo,
    required this.textController,
  });

  @override
  State<VoiceMemoWidget> createState() => _VoiceMemoWidgetState();
}

class _VoiceMemoWidgetState extends State<VoiceMemoWidget>
    with SingleTickerProviderStateMixin {
  late stt.SpeechToText _speech;
  late AnimationController _animationController;
  late Animation<double> _scaleAnimation;
  
  bool _isListening = false;
  bool _speechAvailable = false;
  String _lastWords = '';
  double _confidence = 1.0;

  @override
  void initState() {
    super.initState();
    _speech = stt.SpeechToText();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 1.2,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeInOut,
    ));
    _initSpeech();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  void _initSpeech() async {
    _speechAvailable = await _speech.initialize(
      onStatus: (val) {
        if (val == 'done' || val == 'notListening') {
          setState(() {
            _isListening = false;
          });
          _animationController.stop();
        }
      },
      onError: (val) {
        setState(() {
          _isListening = false;
        });
        _animationController.stop();
        _showError('Speech recognition error: ${val.errorMsg}');
      },
    );
    setState(() {});
  }

  void _listen() async {
    if (!_speechAvailable) {
      _showError('Speech recognition not available');
      return;
    }

    if (!_isListening) {
      bool available = await _speech.initialize();
      if (available) {
        setState(() {
          _isListening = true;
          _lastWords = '';
        });
        
        HapticFeedback.lightImpact();
        _animationController.repeat(reverse: true);
        
        _speech.listen(
          onResult: (val) {
            setState(() {
              _lastWords = val.recognizedWords;
              _confidence = val.confidence;
            });
            
            if (val.finalResult) {
              widget.textController.text = _lastWords;
              widget.onVoiceMemo(_lastWords);
              setState(() {
                _isListening = false;
              });
              _animationController.stop();
            }
          },
          listenFor: const Duration(seconds: 30),
          pauseFor: const Duration(seconds: 3),
          partialResults: true,
          localeId: "en_US",
          onSoundLevelChange: (level) {
            // Could use this for visual feedback
          },
        );
      }
    } else {
      _stopListening();
    }
  }

  void _stopListening() {
    if (_isListening) {
      _speech.stop();
      setState(() {
        _isListening = false;
      });
      _animationController.stop();
      
      if (_lastWords.isNotEmpty) {
        widget.textController.text = _lastWords;
        widget.onVoiceMemo(_lastWords);
      }
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Theme.of(context).colorScheme.error,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Voice Recording Button
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: _isListening 
                ? colorScheme.primary
                : colorScheme.outline.withOpacity(0.3),
              width: _isListening ? 2 : 1,
            ),
            color: _isListening 
              ? colorScheme.primaryContainer.withOpacity(0.1)
              : colorScheme.surfaceVariant.withOpacity(0.3),
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: _speechAvailable ? _listen : null,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    // Microphone Icon
                    AnimatedBuilder(
                      animation: _scaleAnimation,
                      builder: (context, child) {
                        return Transform.scale(
                          scale: _isListening ? _scaleAnimation.value : 1.0,
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: _isListening 
                                ? colorScheme.primary
                                : colorScheme.primary.withOpacity(0.1),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              _isListening ? Icons.mic : Icons.mic_none,
                              color: _isListening 
                                ? colorScheme.onPrimary
                                : colorScheme.primary,
                              size: 28,
                            ),
                          ),
                        );
                      },
                    ),
                    
                    const SizedBox(height: 12),
                    
                    // Status Text
                    Text(
                      _isListening 
                        ? 'Listening... Tap to stop'
                        : _speechAvailable 
                          ? 'Tap to record voice memo'
                          : 'Voice recording unavailable',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: _isListening 
                          ? colorScheme.primary
                          : colorScheme.onSurfaceVariant,
                        fontWeight: _isListening ? FontWeight.w600 : FontWeight.normal,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    
                    // Live transcription
                    if (_isListening && _lastWords.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: colorScheme.primaryContainer.withOpacity(0.3),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _lastWords,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: colorScheme.onPrimaryContainer,
                            fontStyle: FontStyle.italic,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
        
        const SizedBox(height: 12),
        
        // Text Input (Alternative)
        TextFormField(
          controller: widget.textController,
          decoration: InputDecoration(
            hintText: 'Or type your memo here...',
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            prefixIcon: const Icon(Icons.edit_note),
          ),
          maxLines: 3,
          textInputAction: TextInputAction.done,
          onChanged: (value) {
            widget.onVoiceMemo(value);
          },
        ),
        
        // Helper Text
        const SizedBox(height: 8),
        Text(
          'Add context like job details, purpose, or any notes',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: colorScheme.onSurfaceVariant.withOpacity(0.7),
          ),
        ),
      ],
    );
  }
}