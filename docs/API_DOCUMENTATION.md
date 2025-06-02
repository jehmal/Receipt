# Receipt Vault Pro - API Documentation

## Overview
Receipt Vault Pro provides a comprehensive REST API for receipt management, OCR processing, and expense tracking. The API supports multiple versions for backward compatibility and includes advanced features like batch processing, voice memos, and intelligent categorization.

## Base URLs
- **Production**: `https://api.receiptvault.pro`
- **Staging**: `https://staging-api.receiptvault.pro`
- **Development**: `http://localhost:3000`

## API Versioning

### Supported Versions
- **v1**: Legacy version (deprecated)
- **v2**: Current version with enhanced features

### Version Specification
You can specify the API version using one of these methods:

1. **URL Path** (Recommended)
   ```
   GET /api/v2/receipts
   ```

2. **Accept Header**
   ```
   Accept: application/vnd.receiptvault.v2+json
   ```

3. **Custom Header**
   ```
   API-Version: v2
   ```

4. **Query Parameter**
   ```
   GET /api/receipts?version=v2
   ```

### Deprecation Policy
- **v1** is deprecated as of January 1, 2024
- **v1** will be sunset on June 1, 2024
- Deprecated versions include warning headers
- Migration guides are available at `/docs/migration/`

## Authentication

### WorkOS Integration
Receipt Vault Pro uses WorkOS for enterprise-grade authentication.

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "def502004...",
  "expires_in": 3600,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@company.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "user"
  }
}
```

### Authorization Header
Include the access token in all API requests:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## Core Endpoints

### Receipts API

#### Upload Receipt
Upload a receipt image or PDF for processing.

**v2 Endpoint:**
```http
POST /api/v2/receipts
Content-Type: multipart/form-data
Authorization: Bearer {token}

file: [receipt image/pdf]
category: "meals"
description: "Business lunch"
tags: ["client", "tax-deductible"]
metadata: {
  "project_id": "proj_123",
  "expense_type": "business",
  "payment_method": "card"
}
```

**Response:**
```json
{
  "data": {
    "receipt": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "user_123",
      "file_path": "/uploads/2024/01/receipt_abc123.jpg",
      "original_filename": "lunch_receipt.jpg",
      "file_size": 2048576,
      "mime_type": "image/jpeg",
      "status": "processing",
      "category": "meals",
      "description": "Business lunch",
      "tags": ["client", "tax-deductible"],
      "metadata": {
        "project_id": "proj_123",
        "expense_type": "business",
        "payment_method": "card"
      },
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  },
  "meta": {
    "api_version": "v2",
    "request_id": "req_abc123"
  }
}
```

#### Batch Upload (v2 only)
Upload multiple receipts in a single request.

```http
POST /api/v2/receipts/batch
Content-Type: multipart/form-data
Authorization: Bearer {token}

files: [file1.jpg, file2.pdf, file3.png]
batch_metadata: {
  "batch_name": "Q1 Expenses",
  "project_id": "proj_123",
  "auto_process": true
}
```

#### List Receipts
Retrieve receipts with filtering and pagination.

**v2 Endpoint:**
```http
GET /api/v2/receipts?page=1&limit=20&category=meals&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer {token}
```

**Advanced Filtering (v2):**
```http
GET /api/v2/receipts?filters[minAmount]=10.00&filters[maxAmount]=100.00&search[query]=lunch&search[fields]=description,vendor_name
```

**Response:**
```json
{
  "data": {
    "receipts": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "category": "meals",
        "description": "Business lunch",
        "vendor_name": "Restaurant ABC",
        "total_amount": 45.67,
        "receipt_date": "2024-01-15",
        "status": "completed",
        "ocr_confidence": 0.95,
        "tags": ["client", "tax-deductible"],
        "has_voice_memo": true,
        "created_at": "2024-01-15T10:30:00Z"
      }
    ]
  },
  "meta": {
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "per_page": 20,
      "total_count": 87
    },
    "api_version": "v2"
  }
}
```

#### Get Receipt Details
Retrieve detailed information about a specific receipt.

```http
GET /api/v2/receipts/{receipt_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "data": {
    "receipt": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "user_123",
      "file_path": "/uploads/2024/01/receipt_abc123.jpg",
      "file_url": "https://cdn.receiptvault.pro/receipts/receipt_abc123.jpg",
      "original_filename": "lunch_receipt.jpg",
      "category": "meals",
      "description": "Business lunch",
      "vendor_name": "Restaurant ABC",
      "total_amount": 45.67,
      "receipt_date": "2024-01-15",
      "status": "completed",
      "tags": ["client", "tax-deductible"],
      "ocr_data": {
        "text": "Restaurant ABC\n123 Main St\nLunch Special $45.67\nTax $3.65\nTotal $45.67",
        "confidence": 0.95,
        "line_items": [
          {
            "description": "Lunch Special",
            "quantity": 1,
            "unit_price": 42.02,
            "total_price": 42.02
          }
        ]
      },
      "voice_memo": {
        "transcript": "Lunch meeting with client about Q1 strategy",
        "audio_url": "https://cdn.receiptvault.pro/audio/memo_abc123.mp3",
        "duration_seconds": 45
      },
      "metadata": {
        "project_id": "proj_123",
        "expense_type": "business",
        "payment_method": "card",
        "location": {
          "latitude": 40.7128,
          "longitude": -74.0060,
          "address": "123 Main St, New York, NY"
        }
      },
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T11:15:00Z"
    }
  }
}
```

#### Update Receipt
Modify receipt information.

```http
PUT /api/v2/receipts/{receipt_id}
Content-Type: application/json
Authorization: Bearer {token}

{
  "category": "travel",
  "description": "Updated description",
  "tags": ["business", "updated"],
  "notes": "Additional notes about this expense"
}
```

#### Delete Receipt
Remove a receipt from the system.

```http
DELETE /api/v2/receipts/{receipt_id}
Authorization: Bearer {token}
```

### Voice Memos API (v2 only)

#### Add Voice Memo
Attach a voice memo to an existing receipt.

```http
POST /api/v2/receipts/{receipt_id}/voice-memo
Content-Type: multipart/form-data
Authorization: Bearer {token}

audio: [audio file]
transcript: "Manual transcript (optional)"
```

#### Get Voice Memo
Retrieve voice memo details.

```http
GET /api/v2/receipts/{receipt_id}/voice-memo
Authorization: Bearer {token}
```

### Export API

#### Export Receipts
Generate exports in various formats.

```http
POST /api/v2/exports
Content-Type: application/json
Authorization: Bearer {token}

{
  "format": "pdf", // pdf, csv, excel
  "filters": {
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "categories": ["meals", "travel"],
    "project_id": "proj_123"
  },
  "options": {
    "include_images": true,
    "group_by": "category",
    "summary": true
  }
}
```

**Response:**
```json
{
  "data": {
    "export": {
      "id": "export_abc123",
      "status": "processing",
      "format": "pdf",
      "estimated_completion": "2024-01-15T10:35:00Z"
    }
  }
}
```

#### Check Export Status
Monitor export progress.

```http
GET /api/v2/exports/{export_id}
Authorization: Bearer {token}
```

#### Download Export
Download completed export.

```http
GET /api/v2/exports/{export_id}/download
Authorization: Bearer {token}
```

### Analytics API (v2)

#### Expense Summary
Get spending analytics.

```http
GET /api/v2/analytics/summary?period=month&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer {token}
```

**Response:**
```json
{
  "data": {
    "summary": {
      "total_amount": 1250.75,
      "receipt_count": 24,
      "average_amount": 52.11,
      "by_category": {
        "meals": { "amount": 450.25, "count": 8 },
        "travel": { "amount": 800.50, "count": 16 }
      },
      "by_month": [
        { "month": "2024-01", "amount": 1250.75, "count": 24 }
      ]
    }
  }
}
```

## Error Handling

### Error Response Format

**v1 (Legacy):**
```json
{
  "success": false,
  "errorCode": 400,
  "errorMessage": "Invalid request data",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**v2 (Current):**
```json
{
  "error": "ValidationError",
  "message": "Request validation failed",
  "statusCode": 400,
  "timestamp": "2024-01-15T10:30:00Z",
  "apiVersion": "v2",
  "requestId": "req_abc123",
  "details": {
    "field": "category",
    "constraint": "Must be one of: meals, travel, office, other"
  },
  "documentation": "/docs/errors/400"
}
```

### Common Error Codes

| Code | Error | Description |
|------|-------|-------------|
| 400 | Bad Request | Invalid request format or parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 413 | Payload Too Large | File upload exceeds size limit |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

## Rate Limiting

### Limits by Version
- **v1**: 100 requests per minute
- **v2**: 1000 requests per minute

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248600
Retry-After: 60
```

## Webhooks

### Event Types
- `receipt.uploaded`
- `receipt.processed`
- `receipt.failed`
- `export.completed`
- `user.created`

### Webhook Payload Example
```json
{
  "event": "receipt.processed",
  "data": {
    "receipt_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "user_123",
    "status": "completed",
    "ocr_confidence": 0.95,
    "total_amount": 45.67
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "webhook_id": "webhook_abc123"
}
```

## SDKs and Libraries

### Official SDKs
- **JavaScript/TypeScript**: `npm install @receiptvault/sdk`
- **Python**: `pip install receiptvault-sdk`
- **PHP**: `composer require receiptvault/sdk`

### SDK Example (JavaScript)
```javascript
import { ReceiptVault } from '@receiptvault/sdk';

const client = new ReceiptVault({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.receiptvault.pro',
  version: 'v2'
});

// Upload receipt
const receipt = await client.receipts.upload({
  file: fileBuffer,
  category: 'meals',
  description: 'Business lunch'
});

// Get receipts
const receipts = await client.receipts.list({
  page: 1,
  limit: 20,
  category: 'meals'
});
```

## Testing

### Test Environment
Use the staging environment for testing:
- **Base URL**: `https://staging-api.receiptvault.pro`
- **Test API Key**: Available in your dashboard

### Postman Collection
Import our Postman collection for easy testing:
```
https://api.receiptvault.pro/docs/postman-collection.json
```

### Sample cURL Commands
```bash
# Upload receipt
curl -X POST https://api.receiptvault.pro/api/v2/receipts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@receipt.jpg" \
  -F "category=meals" \
  -F "description=Business lunch"

# List receipts
curl -X GET "https://api.receiptvault.pro/api/v2/receipts?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Support

### Documentation
- **Migration Guides**: `/docs/migration/`
- **Error Reference**: `/docs/errors/`
- **Changelog**: `/docs/changelog`

### Support Channels
- **Email**: api-support@receiptvault.pro
- **Slack**: #api-support
- **GitHub Issues**: https://github.com/receiptvault/api-issues

### SLA
- **Response Time**: < 2 hours for critical issues
- **Uptime**: 99.9% guaranteed
- **Maintenance Windows**: Saturdays 2-4 AM UTC