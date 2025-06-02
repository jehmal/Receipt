import 'fastify';

declare module 'fastify' {
  // Extend FastifySchema to support additional documentation properties
  interface FastifySchema {
    tags?: string[];
    description?: string;
    summary?: string;
    consumes?: string[];
    produces?: string[];
  }
  // Multipart file interface for uploads  
  interface MultipartFile {
    file: Buffer;
    filename: string;
    mimetype: string;
    fieldname: string;
    toBuffer(): Promise<Buffer>;
    fields?: { [key: string]: { value: any } };
  }

  // Extend FastifyRequest to add custom properties
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      companyId: string;
      role: string;
      status: string;
      permissions?: string[];
      sub?: string;
    };
    cookies?: {
      sessionId?: string;
      [key: string]: string | undefined;
    };
    session?: {
      id?: string;
    };
    
    // File upload support
    file(): Promise<MultipartFile>;
    files(): Promise<MultipartFile[]>;
    
    // Multipart support
    isMultipart(): boolean;
    parts(): AsyncIterableIterator<MultipartFile>;
    saveRequestFiles(): Promise<MultipartFile[]>;
    tmpUploads(): MultipartFile[];
    formData?(): Promise<FormData>;
    
    // Clean request files methods for file cleanup
    cleanRequestFiles?(): void;
    savedRequestFiles?: MultipartFile[];
    
    // JWT methods (from @fastify/jwt)
    jwtVerify?(): Promise<any>;
    jwtDecode?(token?: string): any;
    
    // API versioning
    apiVersion?: string;
  }

  // Extend FastifyReply
  interface FastifyReply {
    // Fix CSP nonce type to match actual fastify-helmet
    cspNonce?: { script: string; style: string; } | string;
    
    // File serving
    sendFile?(filename: string): FastifyReply;
    download?(path: string, filename?: string): FastifyReply;
    
    // JWT methods (from @fastify/jwt)
    jwtSign?(payload: any): Promise<string>;
  }

  // Extend FastifyInstance for auth and db decorations
  interface FastifyInstance {
    // Auth decorations
    authenticate?: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    adminOnly?: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    companyAdmin?: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    
    // Database connection (for existing code compatibility)
    db?: {
      query(sql: string, params?: any[]): Promise<{ rows: any[] }>;
    };

    // File upload support
    file?(): Promise<MultipartFile>;
  }
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT: string;
      DATABASE_URL: string;
      JWT_SECRET: string;
      REDIS_URL: string;
      APP_VERSION?: string;
      [key: string]: string | undefined;
    }
  }
} 