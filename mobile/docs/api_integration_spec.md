# API Integration Specification for Receipt Vault Pro Mobile

## Core Receipt Management Endpoints

### 1. Receipt Upload & OCR
```
POST /api/v1/receipts/upload
Content-Type: multipart/form-data

Body:
- file: Image file (jpg, png, pdf)
- category?: string
- description?: string
- tags?: string[] 
- job_number?: string
- context: 'personal' | 'company'

Response:
{
  "success": true,
  "data": {
    "receipt": {
      "id": "uuid",
      "user_id": "uuid",
      "status": "processing" | "completed" | "failed",
      "image_url": "string",
      "ocr_data": {
        "vendor_name": "string",
        "total_amount": number,
        "currency": "string",
        "date": "ISO date",
        "confidence": number,
        "raw_text": "string"
      },
      "category": "string",
      "tags": ["string"],
      "job_number": "string",
      "description": "string",
      "created_at": "ISO date",
      "updated_at": "ISO date"
    }
  }
}
```

### 2. Receipt Listing with Filters
```
GET /api/v1/receipts?page=1&limit=20&context=personal&category=fuel&search=shell

Response:
{
  "success": true,
  "data": {
    "receipts": [Receipt[]],
    "pagination": {
      "current_page": 1,
      "total_pages": 10,
      "total_count": 200,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

### 3. Voice Memo Processing
```
POST /api/v1/receipts/{id}/voice-memo
Content-Type: multipart/form-data

Body:
- audio: Audio file (wav, mp3, m4a)
- receipt_id: string

Response:
{
  "success": true,
  "data": {
    "transcription": "string",
    "confidence": number,
    "language": "en-US"
  }
}
```

## Context & User Management

### 4. User Context Toggle
```
PUT /api/v1/user/context
{
  "context": "personal" | "company"
}

Response:
{
  "success": true,
  "data": {
    "current_context": "company",
    "user": {
      "id": "uuid",
      "email": "string",
      "company_id": "uuid",
      "role": "owner" | "employee" | "accountant"
    }
  }
}
```

### 5. Company Management
```
GET /api/v1/company/members
POST /api/v1/company/invite
DELETE /api/v1/company/members/{user_id}

# Company Settings
GET /api/v1/company/settings
PUT /api/v1/company/settings
```

## Smart Features

### 6. Receipt Search & Semantic Search
```
GET /api/v1/receipts/search?q=coffee+meeting&semantic=true
POST /api/v1/receipts/semantic-search
{
  "query": "tools for construction job",
  "limit": 20,
  "filters": {
    "date_range": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    },
    "categories": ["tools", "parts"],
    "amount_range": {
      "min": 0,
      "max": 1000
    }
  }
}
```

### 7. Smart Categorization
```
POST /api/v1/receipts/suggest-category
{
  "vendor_name": "Shell",
  "ocr_text": "UNLEADED FUEL",
  "amount": 67.50
}

Response:
{
  "suggested_category": "Fuel",
  "confidence": 0.95,
  "suggested_tags": ["business", "vehicle"]
}
```

### 8. Export & Analytics
```
GET /api/v1/receipts/export?format=csv&date_range=2024-01-01,2024-12-31
GET /api/v1/analytics/spending?period=month&context=company
```

## Integration APIs

### 9. Job Management Integration (Tradify)
```
GET /api/v1/integrations/tradify/jobs
POST /api/v1/integrations/tradify/sync

# Link receipt to job
PUT /api/v1/receipts/{id}/job
{
  "job_number": "JOB-2024-001",
  "job_system": "tradify"
}
```

### 10. Accounting Integration (Xero)
```
POST /api/v1/integrations/xero/sync-receipts
GET /api/v1/integrations/xero/accounts
```

## Offline & Sync

### 11. Sync Queue Management
```
POST /api/v1/sync/queue
{
  "operations": [
    {
      "type": "create_receipt",
      "data": { ... },
      "local_id": "temp_123",
      "timestamp": "ISO date"
    }
  ]
}

GET /api/v1/sync/status
```

## Warranty Tracking

### 12. Warranty Management
```
POST /api/v1/warranties
{
  "receipt_id": "uuid",
  "item_name": "Makita Drill",
  "purchase_date": "2024-01-15",
  "warranty_period": 24, // months
  "warranty_type": "manufacturer",
  "expiry_date": "2026-01-15"
}

GET /api/v1/warranties/expiring?days=30
```

## Authentication & Security

### 13. Authentication Flow
```
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout

# Headers for all authenticated requests:
Authorization: Bearer <jwt_token>
X-User-Context: personal|company
```

## Error Handling Standards

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid file format",
    "details": {
      "field": "file",
      "allowed_formats": ["jpg", "png", "pdf"]
    }
  }
}
```

## Real-time Features

### 14. WebSocket Events
```
# Connect to: wss://api.receiptvault.pro/ws
# Events:
- receipt_processed: OCR completed
- sync_status: Offline sync status
- warranty_expiring: Warranty alerts
```

## Rate Limiting & Quotas

```
# Headers in responses:
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200

# OCR Limits (per user per month):
- Personal: 500 receipts
- Business: 5000 receipts
- Enterprise: Unlimited
```

## Required Mobile Permissions

```dart
// permissions.dart
- Camera access (required)
- Microphone access (for voice memos)
- File storage access (for offline storage)
- Network access (for sync)
- Location access (optional, for venue detection)
```

## Caching Strategy

```dart
// Local cache priorities:
1. Recent receipts (last 30 days) - Always cached
2. User preferences & settings - Always cached
3. OCR results - Cache for 7 days
4. Search results - Cache for 1 hour
5. Filter options - Cache for 24 hours
```

## Performance Requirements

- Upload time: <30 seconds for 5MB image
- OCR processing: <5 seconds for standard receipt
- Search response: <2 seconds
- Offline mode: Full functionality for 30 days
- Sync efficiency: Delta updates only

This specification ensures our mobile app can deliver the fast, offline-first experience that field workers need while maintaining data integrity and providing advanced business features.