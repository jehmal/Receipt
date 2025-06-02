import { SpeechClient } from '@google-cloud/speech';
import { config } from '@/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface VoiceTranscriptionResult {
  success: boolean;
  text?: string;
  confidence?: number;
  language?: string;
  error?: string;
  duration?: number;
}

class VoiceService {
  private speechClient: SpeechClient;

  constructor() {
    // Initialize Google Speech client
    if (config.googleCloud.apiKey) {
      this.speechClient = new SpeechClient({
        apiKey: config.googleCloud.apiKey,
      });
    } else if (config.googleCloud.serviceAccountPath) {
      this.speechClient = new SpeechClient({
        keyFilename: config.googleCloud.serviceAccountPath,
      });
    } else {
      console.warn('No Google Cloud credentials configured. Voice service will not work.');
    }
  }

  async transcribeAudio(audioBuffer: Buffer, filename: string): Promise<VoiceTranscriptionResult> {
    try {
      if (!this.speechClient) {
        throw new Error('Google Speech client not initialized');
      }

      // Detect audio format from filename
      const audioFormat = this.detectAudioFormat(filename);
      if (!audioFormat) {
        throw new Error('Unsupported audio format');
      }

      // Save audio temporarily if needed for conversion
      const tempFilePath = await this.saveTemporaryAudio(audioBuffer, filename);

      try {
        // Configure speech recognition
        const config = {
          encoding: audioFormat.encoding,
          sampleRateHertz: audioFormat.sampleRate,
          languageCode: 'en-US',
          alternativeLanguageCodes: ['en-AU', 'en-GB', 'en-CA'],
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: false,
          model: 'latest_short', // Optimized for short audio clips
          useEnhanced: true,
        };

        const audio = {
          content: audioBuffer.toString('base64'),
        };

        const request = {
          config: config,
          audio: audio,
        };

        // Perform speech recognition
        const [response] = await this.speechClient.recognize(request);
        
        if (!response.results || response.results.length === 0) {
          return {
            success: false,
            error: 'No speech detected in audio'
          };
        }

        // Get the best transcription result
        const result = response.results[0];
        const alternative = result.alternatives?.[0];

        if (!alternative || !alternative.transcript) {
          return {
            success: false,
            error: 'No transcription available'
          };
        }

        return {
          success: true,
          text: alternative.transcript.trim(),
          confidence: alternative.confidence || 0.5,
          language: 'en-US',
          duration: this.calculateAudioDuration(audioBuffer, audioFormat)
        };

      } finally {
        // Clean up temporary file
        this.cleanupTemporaryFile(tempFilePath);
      }

    } catch (error: any) {
      console.error('Voice transcription failed:', error);
      return {
        success: false,
        error: error.message || 'Voice transcription failed'
      };
    }
  }

  private detectAudioFormat(filename: string): { encoding: any; sampleRate: number } | null {
    const extension = path.extname(filename).toLowerCase();
    
    switch (extension) {
      case '.wav':
        return {
          encoding: 'LINEAR16' as any,
          sampleRate: 16000
        };
      case '.flac':
        return {
          encoding: 'FLAC' as any,
          sampleRate: 16000
        };
      case '.mp3':
        return {
          encoding: 'MP3' as any,
          sampleRate: 16000
        };
      case '.m4a':
      case '.aac':
        return {
          encoding: 'MP3' as any, // Google Speech API treats M4A/AAC similar to MP3
          sampleRate: 16000
        };
      case '.webm':
        return {
          encoding: 'WEBM_OPUS' as any,
          sampleRate: 16000
        };
      default:
        return null;
    }
  }

  private async saveTemporaryAudio(audioBuffer: Buffer, filename: string): Promise<string> {
    const tempDir = '/tmp';
    const tempFilename = `voice_${randomUUID()}_${filename}`;
    const tempFilePath = path.join(tempDir, tempFilename);

    try {
      await fs.promises.writeFile(tempFilePath, audioBuffer);
      return tempFilePath;
    } catch (error) {
      console.error('Failed to save temporary audio file:', error);
      throw error;
    }
  }

  private cleanupTemporaryFile(filePath: string): void {
    if (filePath) {
      fs.promises.unlink(filePath).catch(error => {
        console.error('Failed to cleanup temporary file:', error);
      });
    }
  }

  private calculateAudioDuration(audioBuffer: Buffer, format: { encoding: any; sampleRate: number }): number {
    // Rough estimation based on file size and format
    // This is not precise but gives a reasonable estimate for billing/logging
    
    const bytesPerSecond = {
      'LINEAR16': format.sampleRate * 2, // 16-bit = 2 bytes per sample
      'FLAC': format.sampleRate * 1.5,   // FLAC compression ~25% reduction
      'MP3': format.sampleRate * 0.125,  // MP3 at 128kbps
      'WEBM_OPUS': format.sampleRate * 0.1 // Opus is very efficient
    };

    const estimatedBytesPerSec = bytesPerSecond[format.encoding] || bytesPerSecond['LINEAR16'];
    return Math.round(audioBuffer.length / estimatedBytesPerSec);
  }

  // Enhanced transcription with context-aware processing for receipt memos
  async transcribeReceiptMemo(audioBuffer: Buffer, filename: string, context?: {
    vendorName?: string;
    category?: string;
    amount?: number;
  }): Promise<VoiceTranscriptionResult> {
    try {
      // First, get basic transcription
      const result = await this.transcribeAudio(audioBuffer, filename);
      
      if (!result.success || !result.text) {
        return result;
      }

      // Post-process transcription for receipt context
      const enhancedText = this.enhanceReceiptTranscription(result.text, context);

      return {
        ...result,
        text: enhancedText
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Context-aware transcription failed'
      };
    }
  }

  private enhanceReceiptTranscription(text: string, context?: {
    vendorName?: string;
    category?: string;
    amount?: number;
  }): string {
    let enhanced = text;

    // Fix common OCR/speech recognition errors in receipt context
    const receiptCorrections: { [key: string]: string } = {
      // Job-related terms
      'job site': 'job site',
      'jobsite': 'job site',
      'job number': 'job number',
      'job no': 'job number',
      
      // Business expense terms
      'business expense': 'business expense',
      'tax deductible': 'tax deductible',
      'reimbursable': 'reimbursable',
      'client work': 'client work',
      'customer work': 'customer work',
      
      // Vendor name corrections (if context provided)
      'shell': 'Shell',
      'bp': 'BP',
      'bunnings': 'Bunnings',
      'home depot': 'Home Depot',
      
      // Common tools/parts
      'drill bit': 'drill bit',
      'screws': 'screws',
      'bolts': 'bolts',
      'lumber': 'lumber',
      'materials': 'materials',
      'supplies': 'supplies',
      
      // Fuel-related
      'gas station': 'gas station',
      'fuel': 'fuel',
      'diesel': 'diesel',
      'unleaded': 'unleaded',
      
      // Time references
      'this morning': 'this morning',
      'yesterday': 'yesterday',
      'today': 'today',
      'lunch time': 'lunch time',
      'on site': 'on site'
    };

    // Apply corrections
    for (const [wrong, correct] of Object.entries(receiptCorrections)) {
      const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
      enhanced = enhanced.replace(regex, correct);
    }

    // Add context-specific enhancements
    if (context?.vendorName) {
      enhanced = enhanced.replace(/\bvendor\b/gi, context.vendorName);
    }

    if (context?.category === 'Fuel' && !enhanced.toLowerCase().includes('fuel')) {
      enhanced = `Fuel purchase. ${enhanced}`;
    }

    if (context?.category === 'Tools' && !enhanced.toLowerCase().includes('tool')) {
      enhanced = `Tool purchase. ${enhanced}`;
    }

    return enhanced.trim();
  }

  // Method to handle real-time streaming transcription (for future enhancement)
  async streamTranscription(audioStream: NodeJS.ReadableStream): Promise<AsyncGenerator<VoiceTranscriptionResult>> {
    // TODO: Implement streaming transcription for real-time voice input
    // This would be useful for live voice memo recording in the mobile app
    throw new Error('Streaming transcription not yet implemented');
  }

  // Method to validate audio quality before transcription
  validateAudioQuality(audioBuffer: Buffer, filename: string): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check file size (too small = likely no content, too large = processing issues)
    const fileSizeKB = audioBuffer.length / 1024;
    
    if (fileSizeKB < 1) {
      issues.push('Audio file is very small (< 1KB)');
      recommendations.push('Record for at least 1-2 seconds');
    }
    
    if (fileSizeKB > 10240) { // 10MB
      issues.push('Audio file is very large (> 10MB)');
      recommendations.push('Consider recording shorter clips or using compression');
    }

    // Check format support
    const format = this.detectAudioFormat(filename);
    if (!format) {
      issues.push('Unsupported audio format');
      recommendations.push('Use supported formats: WAV, MP3, M4A, FLAC, WebM');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }
}

export const voiceService = new VoiceService();