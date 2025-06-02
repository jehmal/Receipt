import { fileTypeFromBuffer } from 'file-type';
import config from '@/config';

export interface ValidationOptions {
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  requireImageDimensions?: boolean;
  maxImageWidth?: number;
  maxImageHeight?: number;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  fileInfo?: {
    mimeType: string;
    fileSize: number;
    extension: string;
  };
}

export class FileValidator {
  private static readonly DANGEROUS_EXTENSIONS = [
    '.exe', '.scr', '.bat', '.cmd', '.com', '.pif', '.vbs', '.js', '.jar',
    '.sh', '.app', '.deb', '.pkg', '.dmg', '.zip', '.rar', '.7z'
  ];

  private static readonly MAGIC_BYTES_CHECKS = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/gif': [0x47, 0x49, 0x46],
    'application/pdf': [0x25, 0x50, 0x44, 0x46],
  };

  static async validateFile(
    buffer: Buffer, 
    filename: string, 
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const warnings: string[] = [];
    
    // Use config defaults if not provided
    const maxFileSize = options.maxFileSize || config.upload.maxFileSize;
    const allowedMimeTypes = options.allowedMimeTypes || config.upload.allowedMimeTypes;

    try {
      // 1. File size validation
      if (buffer.length > maxFileSize) {
        return {
          isValid: false,
          error: `File size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds maximum limit of ${(maxFileSize / 1024 / 1024).toFixed(2)}MB`
        };
      }

      // 2. Empty file check
      if (buffer.length === 0) {
        return {
          isValid: false,
          error: 'File is empty'
        };
      }

      // 3. Filename validation
      const filenameLower = filename.toLowerCase();
      const hasDangerousExtension = this.DANGEROUS_EXTENSIONS.some(ext => 
        filenameLower.endsWith(ext)
      );
      
      if (hasDangerousExtension) {
        return {
          isValid: false,
          error: 'File type not allowed for security reasons'
        };
      }

      // 4. Detect actual file type from buffer
      const fileType = await fileTypeFromBuffer(buffer);
      if (!fileType) {
        return {
          isValid: false,
          error: 'Unable to determine file type from content'
        };
      }

      // 5. MIME type validation
      if (!allowedMimeTypes.includes(fileType.mime)) {
        return {
          isValid: false,
          error: `File type '${fileType.mime}' is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`
        };
      }

      // 6. Magic bytes validation for critical file types
      if (this.MAGIC_BYTES_CHECKS[fileType.mime as keyof typeof this.MAGIC_BYTES_CHECKS]) {
        const expectedBytes = this.MAGIC_BYTES_CHECKS[fileType.mime as keyof typeof this.MAGIC_BYTES_CHECKS];
        const actualBytes = Array.from(buffer.slice(0, expectedBytes.length));
        
        if (!this.arrayEquals(actualBytes, expectedBytes)) {
          return {
            isValid: false,
            error: 'File content does not match expected format'
          };
        }
      }

      // 7. Extension vs MIME type consistency check
      const expectedExtension = `.${fileType.ext}`;
      if (!filename.toLowerCase().endsWith(expectedExtension)) {
        warnings.push(`File extension does not match content type. Expected: ${expectedExtension}`);
      }

      // 8. Malware pattern detection (basic)
      const suspiciousPatterns = this.checkForSuspiciousPatterns(buffer);
      if (suspiciousPatterns.length > 0) {
        return {
          isValid: false,
          error: 'File contains potentially malicious content'
        };
      }

      // 9. Additional checks for images
      if (fileType.mime.startsWith('image/')) {
        const imageValidation = await this.validateImage(buffer, options);
        if (!imageValidation.isValid) {
          return imageValidation;
        }
        if (imageValidation.warnings) {
          warnings.push(...imageValidation.warnings);
        }
      }

      // 10. PDF specific validation
      if (fileType.mime === 'application/pdf') {
        const pdfValidation = this.validatePDF(buffer);
        if (!pdfValidation.isValid) {
          return pdfValidation;
        }
        if (pdfValidation.warnings) {
          warnings.push(...pdfValidation.warnings);
        }
      }

      return {
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined,
        fileInfo: {
          mimeType: fileType.mime,
          fileSize: buffer.length,
          extension: fileType.ext
        }
      };

    } catch (error) {
      return {
        isValid: false,
        error: `File validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private static async validateImage(
    buffer: Buffer, 
    options: ValidationOptions
  ): Promise<ValidationResult> {
    try {
      // Try to load image with sharp to validate it's a real image
      const sharp = require('sharp');
      const metadata = await sharp(buffer).metadata();

      if (!metadata.width || !metadata.height) {
        return {
          isValid: false,
          error: 'Invalid image: unable to read dimensions'
        };
      }

      const warnings: string[] = [];

      // Check image dimensions
      const maxWidth = options.maxImageWidth || 8000;
      const maxHeight = options.maxImageHeight || 8000;

      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        return {
          isValid: false,
          error: `Image dimensions ${metadata.width}x${metadata.height} exceed maximum allowed ${maxWidth}x${maxHeight}`
        };
      }

      // Check for very small images (might be tracking pixels)
      if (metadata.width < 10 || metadata.height < 10) {
        warnings.push('Image is very small and might not be a valid receipt');
      }

      // Check for suspicious aspect ratios
      const aspectRatio = metadata.width / metadata.height;
      if (aspectRatio > 20 || aspectRatio < 0.05) {
        warnings.push('Unusual image aspect ratio detected');
      }

      return {
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid image format or corrupted file'
      };
    }
  }

  private static validatePDF(buffer: Buffer): ValidationResult {
    const warnings: string[] = [];

    // Check PDF header
    const pdfHeader = buffer.slice(0, 8).toString('ascii');
    if (!pdfHeader.startsWith('%PDF-')) {
      return {
        isValid: false,
        error: 'Invalid PDF: missing PDF header'
      };
    }

    // Check for PDF trailer
    const trailerCheck = buffer.slice(-20).toString('ascii');
    if (!trailerCheck.includes('%%EOF')) {
      warnings.push('PDF file may be incomplete or corrupted');
    }

    // Basic size sanity check
    if (buffer.length < 100) {
      return {
        isValid: false,
        error: 'PDF file is too small to be valid'
      };
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private static checkForSuspiciousPatterns(buffer: Buffer): string[] {
    const suspicious: string[] = [];
    const content = buffer.toString('ascii', 0, Math.min(buffer.length, 1000));

    // Check for script-like content in non-script files
    const scriptPatterns = [
      /javascript:/i,
      /<script/i,
      /eval\s*\(/i,
      /document\.write/i,
      /window\.location/i
    ];

    for (const pattern of scriptPatterns) {
      if (pattern.test(content)) {
        suspicious.push('Contains script-like content');
        break;
      }
    }

    // Check for executable signatures
    const executableSignatures = [
      Buffer.from([0x4D, 0x5A]), // PE executable
      Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF
      Buffer.from([0xFE, 0xED, 0xFA, 0xCE]), // Mach-O
    ];

    for (const signature of executableSignatures) {
      if (buffer.indexOf(signature) === 0) {
        suspicious.push('Contains executable signature');
        break;
      }
    }

    return suspicious;
  }

  private static arrayEquals(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((val, index) => val === b[index]);
  }

  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')  // Remove dangerous characters
      .replace(/\s+/g, '_')          // Replace spaces with underscores
      .replace(/_{2,}/g, '_')        // Replace multiple underscores with single
      .replace(/^_+|_+$/g, '')       // Remove leading/trailing underscores
      .substring(0, 100);            // Limit length
  }

  static isAllowedMimeType(mimeType: string, allowedTypes?: string[]): boolean {
    const allowed = allowedTypes || config.upload.allowedMimeTypes;
    return allowed.includes(mimeType);
  }

  static getMaxFileSize(): number {
    return config.upload.maxFileSize;
  }
}

export { FileValidator as fileValidator };