// Receipt Vault Pro - API Versioning Middleware
// Handles API version negotiation and deprecation warnings

import { FastifyRequest, FastifyReply } from 'fastify';
import { IncomingMessage } from 'http';

// Supported API versions
export const SUPPORTED_VERSIONS = ['v1', 'v2'] as const;
export const DEFAULT_VERSION = 'v1';
export const LATEST_VERSION = 'v2';

// Version deprecation information
export const VERSION_DEPRECATION = {
  v1: {
    deprecated: true,
    deprecatedAt: '2024-01-01',
    sunsetAt: '2024-06-01',
    replacementVersion: 'v2',
    message: 'API v1 is deprecated. Please migrate to v2. See migration guide at /docs/migration/v1-to-v2'
  }
} as const;

export type ApiVersion = typeof SUPPORTED_VERSIONS[number];

// Extend FastifyRequest to include version
declare module 'fastify' {
  interface FastifyRequest {
    // apiVersion declaration moved to @types/fastify.d.ts to avoid conflicts
  }
}

/**
 * Extract API version from request
 */
export function extractApiVersion(request: FastifyRequest): ApiVersion {
  // Method 1: URL path versioning (preferred)
  const pathMatch = request.url.match(/^\/api\/(v\d+)\//);
  if (pathMatch && SUPPORTED_VERSIONS.includes(pathMatch[1] as ApiVersion)) {
    return pathMatch[1] as ApiVersion;
  }

  // Method 2: Accept header versioning
  const acceptHeader = request.headers.accept;
  if (acceptHeader) {
    const versionMatch = acceptHeader.match(/application\/vnd\.receiptvault\.(v\d+)\+json/);
    if (versionMatch && SUPPORTED_VERSIONS.includes(versionMatch[1] as ApiVersion)) {
      return versionMatch[1] as ApiVersion;
    }
  }

  // Method 3: Custom header versioning
  const versionHeader = request.headers['api-version'] as string;
  if (versionHeader && SUPPORTED_VERSIONS.includes(versionHeader as ApiVersion)) {
    return versionHeader as ApiVersion;
  }

  // Method 4: Query parameter (least preferred)
  const queryVersion = request.query as { version?: string };
  if (queryVersion.version && SUPPORTED_VERSIONS.includes(queryVersion.version as ApiVersion)) {
    return queryVersion.version as ApiVersion;
  }

  // Default to v1 for backward compatibility
  return DEFAULT_VERSION;
}

/**
 * API versioning middleware
 */
export async function apiVersioningMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Extract and set API version
  request.apiVersion = extractApiVersion(request);

  // Add version to response headers
  reply.header('API-Version', request.apiVersion);
  reply.header('API-Supported-Versions', SUPPORTED_VERSIONS.join(', '));
  reply.header('API-Latest-Version', LATEST_VERSION);

  // Check for deprecation warnings
  const deprecationInfo = VERSION_DEPRECATION[request.apiVersion as keyof typeof VERSION_DEPRECATION];
  if (deprecationInfo) {
    reply.header('Deprecation', `date="${deprecationInfo.deprecatedAt}"`);
    reply.header('Sunset', deprecationInfo.sunsetAt);
    reply.header('Link', `</docs/migration/${request.apiVersion}-to-${deprecationInfo.replacementVersion}>; rel="successor-version"`);
    reply.header('Warning', `299 - "${deprecationInfo.message}"`);
  }

  // Add CORS headers with version-specific handling
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, API-Version, Accept');
  reply.header('Access-Control-Expose-Headers', 'API-Version, API-Supported-Versions, API-Latest-Version, Deprecation, Sunset, Warning');

  // Log version usage for analytics
  request.log.info({
    apiVersion: request.apiVersion,
    userAgent: request.headers['user-agent'],
    endpoint: request.url,
    method: request.method
  }, 'API version usage');
}

/**
 * Version-specific route decorator
 */
export function withVersion(version: ApiVersion) {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;
    descriptor.value = async function(request: FastifyRequest, reply: FastifyReply) {
      if (request.apiVersion !== version) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Endpoint not available in API version ${request.apiVersion}`,
          availableVersions: SUPPORTED_VERSIONS,
          requestedVersion: request.apiVersion
        });
      }
      return method.call(this, request, reply);
    };
    return descriptor;
  };
}

/**
 * Version compatibility checker
 */
export function isVersionCompatible(requestedVersion: string, minimumVersion: ApiVersion): boolean {
  const versionNumber = (version: string) => parseInt(version.replace('v', ''));
  return versionNumber(requestedVersion) >= versionNumber(minimumVersion);
}

/**
 * Response transformer for version-specific data
 */
export function transformResponseForVersion<T>(data: T, version: ApiVersion): T {
  switch (version) {
    case 'v1':
      return transformForV1(data);
    case 'v2':
      return transformForV2(data);
    default:
      return data;
  }
}

/**
 * Transform data for API v1 (legacy format)
 */
function transformForV1<T>(data: T): T {
  if (typeof data === 'object' && data !== null) {
    // Convert snake_case to camelCase for v1 compatibility
    return Object.entries(data).reduce((acc, [key, value]) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      return { ...acc, [camelKey]: value };
    }, {} as T);
  }
  return data;
}

/**
 * Transform data for API v2 (modern format)
 */
function transformForV2<T>(data: T): T {
  if (typeof data === 'object' && data !== null) {
    // Keep snake_case for v2
    return data;
  }
  return data;
}

/**
 * Migration helper for breaking changes
 */
export class ApiMigrationHelper {
  /**
   * Handle field renames between versions
   */
  static migrateFields<T extends Record<string, any>>(
    data: T,
    fieldMappings: Record<string, string>,
    version: ApiVersion
  ): T {
    if (version === 'v1') {
      const migrated: any = { ...data };
      Object.entries(fieldMappings).forEach(([oldField, newField]) => {
        if (data[newField] !== undefined) {
          migrated[oldField] = data[newField];
          delete migrated[newField];
        }
      });
      return migrated as T;
    }
    return data;
  }

  /**
   * Handle deprecated fields
   */
  static handleDeprecatedFields<T extends Record<string, any>>(
    data: T,
    deprecatedFields: string[],
    version: ApiVersion
  ): T {
    if (version === 'v1') {
      // Keep deprecated fields in v1 for backward compatibility
      return data;
    }
    
    // Remove deprecated fields in newer versions
    const cleaned = { ...data };
    deprecatedFields.forEach(field => {
      delete cleaned[field];
    });
    return cleaned;
  }
}

/**
 * Error response formatter with version-specific format
 */
export function formatErrorResponse(
  error: Error,
  version: ApiVersion,
  statusCode: number = 500
): Record<string, any> {
  const baseError = {
    error: error.name || 'Internal Server Error',
    message: error.message,
    statusCode,
    timestamp: new Date().toISOString(),
    apiVersion: version
  };

  switch (version) {
    case 'v1':
      // Legacy error format
      return {
        success: false,
        errorCode: statusCode,
        errorMessage: error.message,
        timestamp: baseError.timestamp
      };
    
    case 'v2':
      // Modern error format with more details
      return {
        ...baseError,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        requestId: undefined, // Will be set by request context
        documentation: `/docs/errors/${statusCode}`
      };
    
    default:
      return baseError;
  }
}

/**
 * Content negotiation helper
 */
export function negotiateContentType(request: FastifyRequest): string {
  const acceptHeader = request.headers.accept || 'application/json';
  
  // Support version-specific content types
  if (acceptHeader.includes('application/vnd.receiptvault')) {
    return acceptHeader;
  }
  
  // Default to JSON
  return 'application/json';
}

/**
 * Rate limiting by version
 */
export function getVersionSpecificRateLimit(version: ApiVersion): { max: number; timeWindow: string } {
  switch (version) {
    case 'v1':
      // More restrictive limits for deprecated version
      return { max: 100, timeWindow: '1 minute' };
    case 'v2':
      // Higher limits for current version
      return { max: 1000, timeWindow: '1 minute' };
    default:
      return { max: 100, timeWindow: '1 minute' };
  }
}

/**
 * Feature flag checker for version-specific features
 */
export function isFeatureAvailable(feature: string, version: ApiVersion): boolean {
  const featureMatrix: Record<string, ApiVersion[]> = {
    'advanced-ocr': ['v2'],
    'batch-upload': ['v2'],
    'voice-memos': ['v2'],
    'basic-upload': ['v1', 'v2'],
    'receipt-list': ['v1', 'v2'],
    'user-auth': ['v1', 'v2']
  };

  return featureMatrix[feature]?.includes(version) ?? false;
}