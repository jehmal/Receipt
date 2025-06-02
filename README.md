# Forever Receipt Vault

A mobile-first receipt storage and management application with enterprise-grade security and compliance features.

## Project Structure

```
├── mobile/          # Flutter mobile application
├── backend/         # Node.js/TypeScript API server
├── database/        # Database schemas and migrations
├── docs/           # Project documentation
└── scripts/        # Build and deployment scripts
```

## Features

- 📱 Mobile-first Flutter app with camera integration
- 🔍 OCR-powered receipt processing and categorization
- 🔒 End-to-end encryption and compliance-grade security
- 👥 Multi-tenant support for companies and teams
- 📊 Advanced search and analytics
- 📧 Email-to-vault functionality
- 📤 Export capabilities for tax filing

## Quick Start

### Prerequisites
- Flutter SDK 3.x
- Node.js 18+
- PostgreSQL 14+
- Docker (optional)

### Development Setup

1. Clone the repository
2. Set up the backend: `cd backend && npm install`
3. Set up the mobile app: `cd mobile && flutter pub get`
4. Initialize the database: `cd database && ./init.sh`
5. Start the development servers

## Architecture

- **Frontend**: Flutter with Riverpod state management
- **Backend**: Node.js/TypeScript with Fastify
- **Database**: PostgreSQL with Redis caching
- **Storage**: AWS S3 with CDN
- **Search**: Elasticsearch + Qdrant vector DB
- **OCR**: Google Cloud Vision API

## Security & Compliance

- AES-256 encryption
- Zero-knowledge architecture
- Multi-jurisdiction tax compliance (ATO, IRS, GDPR)
- Immutable audit trails
- Blockchain anchoring for data integrity

## License

Proprietary - All rights reserved