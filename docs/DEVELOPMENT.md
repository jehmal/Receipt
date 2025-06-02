# Forever Receipt Vault - Development Guide

## Overview

Forever Receipt Vault is a comprehensive receipt storage and management application with mobile-first design, enterprise-grade security, and multi-tenant architecture.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Flutter App   │    │   Backend API   │    │   PostgreSQL    │
│  (Mobile/Web)   │────│  (Node.js/TS)   │────│   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ├── Redis (Cache/Sessions)
                              ├── Elasticsearch (Search)
                              ├── Qdrant (Vector DB)
                              └── MinIO/S3 (File Storage)
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Flutter SDK 3.x (for mobile development)
- PostgreSQL client tools

### Setup

1. **Clone and setup environment:**
   ```bash
   git clone <repository-url>
   cd receipt-vault
   ./scripts/dev-setup.sh
   ```

2. **Configure environment:**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your settings
   ```

3. **Start development:**
   ```bash
   # Terminal 1: Start infrastructure
   docker-compose up -d
   
   # Terminal 2: Start backend
   cd backend && npm run dev
   
   # Terminal 3: Start mobile app
   cd mobile && flutter run
   ```

## Project Structure

```
receipt-vault/
├── mobile/                 # Flutter mobile application
│   ├── lib/
│   │   ├── core/          # Core configuration and utilities
│   │   ├── features/      # Feature-based modules
│   │   └── shared/        # Shared widgets and models
│   └── pubspec.yaml
├── backend/                # Node.js/TypeScript API
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── services/      # Business logic services
│   │   ├── middleware/    # Custom middleware
│   │   ├── config/        # Configuration management
│   │   └── utils/         # Utility functions
│   └── package.json
├── database/               # Database schemas and migrations
│   ├── schema.sql         # Complete database schema
│   ├── seed.sql          # Development seed data
│   └── init.sh           # Database initialization script
├── docs/                   # Project documentation
├── scripts/               # Development and deployment scripts
└── docker-compose.yml     # Local development infrastructure
```

## Development Workflow

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Run tests
npm test

# Type checking
npm run build

# Linting
npm run lint
npm run lint:fix
```

### Mobile Development

```bash
cd mobile

# Install dependencies
flutter pub get

# Generate code (if using code generation)
flutter packages pub run build_runner build

# Run on device/emulator
flutter run

# Run tests
flutter test

# Build for production
flutter build apk    # Android
flutter build ios    # iOS
```

### Database Management

```bash
# Initialize database
cd database && ./init.sh

# Reset database (WARNING: deletes all data)
./scripts/reset-db.sh

# Manual database access
psql postgresql://postgres:postgres@localhost:5432/receipt_vault
```

## API Documentation

### Authentication

All API endpoints (except auth) require JWT token in Authorization header:
```
Authorization: Bearer <jwt-token>
```

### Core Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

#### Receipts
- `GET /api/receipts` - List user receipts
- `POST /api/receipts` - Upload new receipt
- `GET /api/receipts/:id` - Get receipt details
- `PUT /api/receipts/:id` - Update receipt
- `DELETE /api/receipts/:id` - Delete receipt
- `POST /api/receipts/export` - Export receipts

#### Search
- `GET /api/search/receipts` - Search receipts
- `POST /api/search/semantic` - Semantic search
- `POST /api/search/visual` - Visual similarity search

#### Companies (Multi-tenant)
- `GET /api/companies` - Get company details
- `GET /api/companies/users` - List company users
- `POST /api/companies/users/invite` - Invite user
- `GET /api/companies/receipts` - Company receipts

### Error Responses

All errors follow this format:
```json
{
  "error": "Error Type",
  "message": "Human readable message",
  "statusCode": 400,
  "details": {} // Optional additional details
}
```

## Mobile App Architecture

### State Management
- **Riverpod** for reactive state management
- **Hive** for local storage and offline support
- **SQLite** for structured local data

### Key Features
- Camera integration with ML-powered receipt detection
- Offline-first architecture with background sync
- Biometric authentication support
- Material Design 3 with custom receipt-focused components

### Code Organization
```
lib/
├── core/
│   ├── auth/          # Authentication logic
│   ├── config/        # App configuration
│   ├── network/       # API client and networking
│   └── storage/       # Local storage management
├── features/
│   ├── camera/        # Receipt capture functionality
│   ├── receipts/      # Receipt management
│   ├── search/        # Search and filtering
│   └── profile/       # User profile management
└── shared/
    ├── models/        # Data models
    ├── widgets/       # Reusable UI components
    └── utils/         # Utility functions
```

## Security Considerations

### Backend Security
- JWT tokens with secure rotation
- Rate limiting on all endpoints
- Input validation using Joi schemas
- SQL injection protection with parameterized queries
- File upload restrictions and scanning
- CORS configuration for frontend domains

### Mobile Security
- Biometric authentication integration
- Certificate pinning for API calls
- Local data encryption using Hive encryption
- Secure token storage in device keychain
- Network security with HTTPS enforcement

### Data Protection
- End-to-end encryption for sensitive data
- GDPR and CCPA compliance features
- Audit logging for all data access
- Automatic data retention policies
- Secure file deletion with overwriting

## Testing Strategy

### Backend Testing
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Mobile Testing
```bash
# Unit tests
flutter test

# Widget tests
flutter test test/widget_test.dart

# Integration tests
flutter test integration_test/
```

## Deployment

### Backend Deployment
- Docker containers with multi-stage builds
- Environment-specific configuration
- Health checks and monitoring
- Auto-scaling configuration
- Database migration management

### Mobile Deployment
- CI/CD pipeline with automated testing
- Code signing for iOS/Android
- App store submission automation
- Feature flagging for gradual rollouts
- Crash reporting and analytics

## Monitoring and Observability

### Logging
- Structured JSON logging with Winston
- Log aggregation with ELK stack
- Error tracking with Sentry
- Performance monitoring with DataDog

### Metrics
- API response times and error rates
- Database performance metrics
- Mobile app crash rates and performance
- Business metrics (user engagement, upload success rates)

## Contributing

1. Create feature branch from `main`
2. Follow code style guidelines (ESLint for backend, flutter_lints for mobile)
3. Add tests for new functionality
4. Update documentation as needed
5. Create pull request with detailed description

### Code Style

#### Backend (TypeScript)
- Use Prettier for formatting
- Follow ESLint configuration
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

#### Mobile (Dart/Flutter)
- Follow Flutter style guide
- Use meaningful widget names
- Document complex widgets
- Use const constructors where possible

## Troubleshooting

### Common Issues

**Database connection errors:**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres
```

**Flutter build errors:**
```bash
# Clean and rebuild
flutter clean && flutter pub get
flutter packages pub run build_runner clean
flutter packages pub run build_runner build --delete-conflicting-outputs
```

**Backend dependency issues:**
```bash
# Clear npm cache
rm -rf node_modules package-lock.json
npm install
```

### Getting Help

- Check existing GitHub issues
- Review error logs in `backend/logs/`
- Use Flutter doctor for mobile issues: `flutter doctor`
- Join our development Discord server (link in README)

## License

Proprietary - All rights reserved. See LICENSE file for details.