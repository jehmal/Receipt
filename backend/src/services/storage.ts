import { Client as MinioClient } from 'minio';
import { createHash } from 'crypto';
import sharp from 'sharp';
import FileType from 'file-type';
import path from 'path';
import { randomUUID } from 'crypto';
import config from '../config/index';

export interface UploadResult {
  filePath: string;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  thumbnailPath?: string;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  mimeType?: string;
  fileSize?: number;
}

class StorageService {
  private minioClient: MinioClient;
  private bucketName: string;

  constructor() {
    this.bucketName = config.aws.s3Bucket || 'receipts';
    
    // Initialize MinIO client
    this.minioClient = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
    });

    this.ensureBucketExists();
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      const bucketExists = await this.minioClient.bucketExists(this.bucketName);
      if (!bucketExists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        console.log(`Created bucket: ${this.bucketName}`);
      }
    } catch (error) {
      console.error('Error ensuring bucket exists:', error);
    }
  }

  async validateFile(buffer: Buffer, originalFilename: string): Promise<FileValidationResult> {
    try {
      // Check file size
      if (buffer.length > config.upload.maxFileSize) {
        return {
          isValid: false,
          error: `File size exceeds maximum limit of ${config.upload.maxFileSize} bytes`
        };
      }

      // Detect file type from buffer
      const fileType = await FileType.fromBuffer(buffer);
      if (!fileType) {
        return {
          isValid: false,
          error: 'Unable to determine file type'
        };
      }

      // Check if mime type is allowed
      if (!config.upload.allowedMimeTypes.includes(fileType.mime)) {
        return {
          isValid: false,
          error: `File type ${fileType.mime} is not allowed`
        };
      }

      // Additional validation for images
      if (fileType.mime.startsWith('image/')) {
        try {
          const metadata = await sharp(buffer).metadata();
          if (!metadata.width || !metadata.height) {
            return {
              isValid: false,
              error: 'Invalid image file'
            };
          }

          // Check image dimensions (reasonable limits)
          if (metadata.width > 8000 || metadata.height > 8000) {
            return {
              isValid: false,
              error: 'Image dimensions too large'
            };
          }
        } catch (error) {
          return {
            isValid: false,
            error: 'Invalid image format'
          };
        }
      }

      return {
        isValid: true,
        mimeType: fileType.mime,
        fileSize: buffer.length
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'File validation failed'
      };
    }
  }

  generateFileHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  generateFilePath(userId: string, filename: string, fileHash: string): string {
    const extension = path.extname(filename).toLowerCase();
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Use hash for filename to avoid conflicts and ensure uniqueness
    const safeFilename = `${fileHash}${extension}`;
    
    return `users/${userId}/${year}/${month}/${safeFilename}`;
  }

  async uploadFile(
    buffer: Buffer, 
    userId: string, 
    originalFilename: string
  ): Promise<UploadResult> {
    // Validate file
    const validation = await this.validateFile(buffer, originalFilename);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Generate file hash for deduplication
    const fileHash = this.generateFileHash(buffer);
    
    // Generate storage path
    const filePath = this.generateFilePath(userId, originalFilename, fileHash);

    try {
      // Check if file already exists (deduplication)
      try {
        await this.minioClient.statObject(this.bucketName, filePath);
        // File already exists, return existing path
        return {
          filePath,
          fileHash,
          fileSize: buffer.length,
          mimeType: validation.mimeType!
        };
      } catch (error) {
        // File doesn't exist, proceed with upload
      }

      // Upload file to MinIO
      await this.minioClient.putObject(
        this.bucketName,
        filePath,
        buffer,
        buffer.length,
        {
          'Content-Type': validation.mimeType!,
          'x-amz-meta-original-filename': originalFilename,
          'x-amz-meta-user-id': userId,
          'x-amz-meta-file-hash': fileHash,
        }
      );

      const result: UploadResult = {
        filePath,
        fileHash,
        fileSize: buffer.length,
        mimeType: validation.mimeType!
      };

      // Generate thumbnail for images
      if (validation.mimeType!.startsWith('image/')) {
        try {
          const thumbnailPath = await this.generateThumbnail(buffer, filePath);
          result.thumbnailPath = thumbnailPath;
        } catch (error) {
          console.warn('Failed to generate thumbnail:', error);
          // Don't fail upload if thumbnail generation fails
        }
      }

      return result;
    } catch (error) {
      console.error('File upload failed:', error);
      throw new Error('Failed to upload file to storage');
    }
  }

  async generateThumbnail(buffer: Buffer, originalPath: string): Promise<string> {
    const thumbnailBuffer = await sharp(buffer)
      .resize(300, 300, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbnailPath = originalPath.replace(/\.[^.]+$/, '_thumb.jpg');

    await this.minioClient.putObject(
      this.bucketName,
      thumbnailPath,
      thumbnailBuffer,
      thumbnailBuffer.length,
      {
        'Content-Type': 'image/jpeg',
        'x-amz-meta-thumbnail': 'true',
      }
    );

    return thumbnailPath;
  }

  async getFile(filePath: string): Promise<Buffer> {
    try {
      const stream = await this.minioClient.getObject(this.bucketName, filePath);
      const chunks: Buffer[] = [];
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to retrieve file: ${filePath}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucketName, filePath);
      
      // Also try to delete thumbnail if it exists
      const thumbnailPath = filePath.replace(/\.[^.]+$/, '_thumb.jpg');
      try {
        await this.minioClient.removeObject(this.bucketName, thumbnailPath);
      } catch (error) {
        // Thumbnail might not exist, ignore error
      }
    } catch (error) {
      throw new Error(`Failed to delete file: ${filePath}`);
    }
  }

  async generateSignedUrl(filePath: string, expirySeconds: number = 3600): Promise<string> {
    try {
      return await this.minioClient.presignedGetObject(
        this.bucketName,
        filePath,
        expirySeconds
      );
    } catch (error) {
      throw new Error(`Failed to generate signed URL for: ${filePath}`);
    }
  }

  async getFileInfo(filePath: string) {
    try {
      const stat = await this.minioClient.statObject(this.bucketName, filePath);
      return {
        size: stat.size,
        lastModified: stat.lastModified,
        etag: stat.etag,
        metaData: stat.metaData
      };
    } catch (error) {
      throw new Error(`Failed to get file info: ${filePath}`);
    }
  }

  sanitizeFilename(filename: string): string {
    // Remove dangerous characters and normalize
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 100); // Limit length
  }
}

export const storageService = new StorageService();