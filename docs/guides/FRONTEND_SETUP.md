# 📱 Receipt Vault Pro - Frontend Setup Guide

## 🚀 Quick Start Options

### Option 1: Docker (Full Stack) - Recommended
```bash
# Windows
start-fullstack.bat

# Linux/Mac
./start-fullstack.sh
```
This will start:
- Flutter Web App on http://localhost:8080
- Backend API on http://localhost:3000
- PostgreSQL Database
- Redis Cache

### Option 2: Flutter Development Server (Backend must be running separately)
```bash
# Windows
start-flutter-dev.bat

# Linux/Mac
./start-flutter-dev.sh
```
This starts only the Flutter web app on http://localhost:8080

## 📋 Prerequisites

### For Docker Setup:
- Docker Desktop installed and running
- Backend .env file configured (see SETUP_SECRETS.md)

### For Flutter Development:
- Flutter SDK 3.16+ installed
- Chrome browser
- Backend running on http://localhost:3000

## 🔧 Manual Setup (Advanced)

### 1. Install Flutter
```bash
# Download Flutter SDK from https://flutter.dev/docs/get-started/install
# Add to PATH and verify:
flutter doctor
```

### 2. Setup Mobile App
```bash
cd mobile
flutter pub get
flutter packages pub run build_runner build --delete-conflicting-outputs
```

### 3. Configure API Endpoints
Edit `mobile/lib/core/config/app_config.dart` if needed:
```dart
static String get baseUrl {
  return 'http://localhost:3000/api'; // Your backend URL
}
```

### 4. Run Flutter Web
```bash
flutter run -d chrome --web-port 8080
```

## 🌐 Available URLs

- **Frontend App**: http://localhost:8080
- **Backend API**: http://localhost:3000
- **API Docs**: http://localhost:3000/documentation (if enabled)

## 📱 Features Available

### ✅ Implemented Features:
- WorkOS Authentication
- Receipt Upload & Processing
- OCR with Google Vision API
- Advanced Search
- Analytics Dashboard
- Offline Sync
- Company Management

### 🚧 UI Features:
- Material Design 3 interface
- Responsive web layout
- Real-time sync indicators
- Progressive Web App (PWA) support

## 🛠️ Development Commands

```bash
# Get dependencies
flutter pub get

# Run code generation
flutter packages pub run build_runner build

# Build for web (production)
flutter build web --release

# Run tests
flutter test

# Check code quality
flutter analyze
```

## 🐳 Docker Configuration

The Docker setup includes:
- **Multi-stage build** for optimized production image
- **Nginx** for serving Flutter web app
- **Health checks** for reliability
- **API proxy** configuration for backend calls

## 🔍 Troubleshooting

### Flutter Web Not Loading
1. Check Flutter installation: `flutter doctor`
2. Clear build cache: `flutter clean && flutter pub get`
3. Try building: `flutter build web`

### API Connection Issues
1. Verify backend is running on http://localhost:3000
2. Check CORS configuration in backend
3. Verify WorkOS credentials are set

### Docker Issues
1. Ensure Docker Desktop is running
2. Check port conflicts (8080, 3000, 5432, 6379)
3. View logs: `docker-compose -f docker-compose.frontend.yml logs`

### Build Errors
```bash
# Clean and rebuild
flutter clean
flutter pub get
flutter packages pub run build_runner build --delete-conflicting-outputs
```

## 📊 Performance Tips

1. **Development**: Use `flutter run -d chrome` for hot reload
2. **Production**: Use `flutter build web --release` for optimized build
3. **Debugging**: Use Chrome DevTools for web debugging

## 🔐 Security Notes

- API calls are proxied through the frontend for CORS
- WorkOS handles authentication securely
- Local storage is encrypted for sensitive data
- PWA includes offline capabilities

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review logs with `docker-compose logs`
3. Ensure all prerequisites are installed
4. Verify backend is running and configured

## 🎯 Next Steps

1. **Start the app** using one of the methods above
2. **Login** with WorkOS authentication
3. **Upload receipts** and test OCR processing
4. **Explore features** like search and analytics
5. **Test offline sync** capabilities

Happy coding! 🎉