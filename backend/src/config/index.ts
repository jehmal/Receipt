import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

interface Config {
  server: {
    env: string;
    port: number;
    host: string;
    corsOrigin: string;
  };
  database: {
    url: string;
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  redis: {
    url: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  aws: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    s3Bucket: string;
  };
  googleCloud: {
    projectId: string;
    keyFile?: string;
  };
  elasticsearch: {
    url: string;
  };
  qdrant: {
    url: string;
  };
  email: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  rateLimit: {
    max: number;
    window: number;
  };
  upload: {
    maxFileSize: number;
    allowedMimeTypes: string[];
  };
  security: {
    bcryptRounds: number;
  };
  features: {
    enableOCR: boolean;
    enableSemanticSearch: boolean;
    enableEmailToVault: boolean;
  };
  logging: {
    level: string;
    enableMetrics: boolean;
  };
}

const config: Config = {
  server: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/receipt_vault',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'receipt_vault',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.NODE_ENV === 'production',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'receipt-vault-storage',
  },
  googleCloud: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
    ...(process.env.GOOGLE_CLOUD_KEY_FILE && { keyFile: process.env.GOOGLE_CLOUD_KEY_FILE }),
  },
  elasticsearch: {
    url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  },
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
  },
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    window: parseInt(process.env.RATE_LIMIT_WINDOW || '15', 10) * 60 * 1000,
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
    allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/heic,application/pdf').split(','),
  },
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  },
  features: {
    enableOCR: process.env.ENABLE_OCR === 'true',
    enableSemanticSearch: process.env.ENABLE_SEMANTIC_SEARCH === 'true',
    enableEmailToVault: process.env.ENABLE_EMAIL_TO_VAULT === 'true',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
  },
};

export default config;