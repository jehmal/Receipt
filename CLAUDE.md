# Receipt Vault - Claude Code Development Guide

## 🏗️ Project Architecture

This is a receipt management system with:
- **Backend**: Node.js/TypeScript with Fastify framework
- **Mobile**: Flutter/Dart with Riverpod state management  
- **Database**: PostgreSQL with Redis caching
- **Storage**: MinIO for file storage
- **Search**: Elasticsearch for receipt search
- **Vector DB**: Qdrant for ML/AI features

## 🛠️ Development Commands

### Backend Commands
```bash
# Development
npm run dev              # Start development server with hot reload
npm run build           # Build TypeScript to JavaScript
npm run start           # Start production server
npm test               # Run Jest tests
npm run test:watch     # Run tests in watch mode
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint issues
npm run format         # Format code with Prettier

# Database
npm run db:migrate     # Run database migrations
npm run db:seed        # Seed database with test data
```

### Mobile Commands
```bash
# Development
flutter run                                    # Run on device/emulator
flutter test                                  # Run all tests
flutter analyze                              # Static analysis
flutter build apk                            # Build Android APK
flutter build ios                            # Build iOS app
flutter packages pub run build_runner build  # Generate code
flutter packages pub get                     # Get dependencies
flutter clean                               # Clean build files
```

### Infrastructure Commands
```bash
# Docker
docker-compose up -d           # Start all services
docker-compose down           # Stop all services
docker-compose logs [service] # View service logs
docker ps                     # List running containers

# Database Access
psql -h localhost -U postgres -d receipt_vault  # Connect to PostgreSQL
redis-cli -h localhost -p 6379                  # Connect to Redis
```

## 🎯 Code Style Guidelines

### Backend (TypeScript)
- Use ESLint + Prettier configuration
- Follow Fastify plugin patterns
- Use Joi for validation
- Implement proper error handling with custom error classes
- Use dependency injection patterns
- Write comprehensive JSDoc comments

### Mobile (Flutter/Dart)
- Follow official Dart style guide
- Use Riverpod for state management with code generation
- Implement proper error boundaries
- Use feature-based folder structure
- Write widget tests for UI components
- Use repository pattern for data access

### Database
- Use snake_case for table/column names
- Always include created_at and updated_at timestamps
- Use UUIDs for primary keys
- Index foreign keys and search columns
- Write migration scripts with proper rollback

## 📁 Repository Structure

```
backend/
├── src/
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── middleware/      # Custom middleware
│   ├── routes/         # Route definitions
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   └── config/         # Configuration files
├── uploads/            # File upload storage
└── dist/              # Compiled JavaScript

mobile/
├── lib/
│   ├── core/           # Core functionality (auth, config, storage)
│   ├── features/       # Feature modules (camera, receipts, etc.)
│   ├── shared/         # Shared components and models
│   └── main.dart       # App entry point
└── assets/            # Images, fonts, icons

database/
├── schema.sql         # Database schema
├── seed.sql          # Sample data
└── init/             # Initialization scripts
```

## 🔧 Development Environment Setup

### Prerequisites
- Node.js 18+
- Flutter 3.16+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### Environment Variables
Copy `.env.example` to `.env` in backend/ and configure:
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/receipt_vault
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret-here
GOOGLE_CLOUD_API_KEY=your-google-vision-api-key
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
```

### First Time Setup
```bash
# 1. Install backend dependencies
cd backend && npm install

# 2. Install mobile dependencies  
cd mobile && flutter pub get

# 3. Start infrastructure
docker-compose up -d

# 4. Run migrations
cd backend && npm run db:migrate

# 5. Seed database
npm run db:seed

# 6. Start development servers
npm run dev  # In backend/
flutter run  # In mobile/
```

## 🧪 Testing Guidelines

### Backend Testing
- Unit tests for services and utilities
- Integration tests for API endpoints
- Use Jest with supertest for API testing
- Mock external dependencies (Google Vision, AWS, etc.)
- Aim for 80%+ code coverage

### Mobile Testing
- Widget tests for UI components
- Unit tests for providers and models
- Integration tests for user flows
- Use flutter_test and mockito
- Test on both iOS and Android

### Database Testing
- Use test database for integration tests
- Clean database between test runs
- Test migrations both up and down
- Validate constraints and indexes

## 🚀 Deployment Guidelines

### Backend Deployment
- Build: `npm run build`
- Environment: Production environment variables
- Process manager: PM2 or similar
- Reverse proxy: Nginx
- SSL: Let's Encrypt or AWS Certificate Manager

### Mobile Deployment
- Android: `flutter build apk --release`
- iOS: `flutter build ios --release`
- Code signing: Configure in Xcode/Android Studio
- Store submission: Follow platform guidelines

## 🐛 Common Issues & Solutions

### Backend Issues
- **Port conflicts**: Change PORT in .env
- **Database connection**: Check DATABASE_URL and ensure PostgreSQL is running
- **Redis connection**: Verify Redis is running on port 6379
- **File uploads**: Check upload directory permissions

### Mobile Issues
- **Build failures**: Run `flutter clean` then `flutter pub get`
- **Code generation**: Run `flutter packages pub run build_runner build --delete-conflicting-outputs`
- **Platform issues**: Check platform-specific configurations in android/ and ios/

### Infrastructure Issues
- **Docker issues**: Run `docker-compose down -v` then `docker-compose up -d`
- **Port conflicts**: Modify ports in docker-compose.yml
- **Storage issues**: Check volume mounts and permissions

## 📚 Additional Resources

- [Fastify Documentation](https://fastify.dev/)
- [Flutter Documentation](https://flutter.dev/docs)
- [Riverpod Documentation](https://riverpod.dev/)
- [PostgreSQL Documentation](https://postgresql.org/docs/)
- [Redis Documentation](https://redis.io/docs/)

## 🎯 Development Workflow with Claude

1. **Explore**: Read relevant files to understand current implementation
2. **Plan**: Create detailed implementation plan using TodoWrite
3. **Code**: Implement features incrementally with proper testing
4. **Commit**: Create meaningful commits with proper messages
5. **Review**: Use GitHub Actions for automated testing and review

---
*Keep this file updated as the project evolves*