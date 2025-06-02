@echo off
echo 🚀 Starting Flutter Web Development Server
echo ==========================================

REM Check if Flutter is installed
flutter doctor --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Flutter is not installed or not in PATH
    echo 📥 Please install Flutter: https://flutter.dev/docs/get-started/install
    pause
    exit /b 1
)

echo 📋 Flutter Doctor Check:
flutter doctor

REM Navigate to mobile directory
cd mobile

echo 📦 Getting Flutter dependencies...
flutter pub get

echo 🔨 Running code generation...
flutter packages pub run build_runner build --delete-conflicting-outputs

echo 🌐 Starting Flutter Web Server on http://localhost:8080...
echo 📱 Your app will open automatically in your browser
echo 🔧 Make sure your backend is running on http://localhost:3000
echo.
echo 🛑 Press Ctrl+C to stop the server
echo.

REM Start Flutter web server
flutter run -d chrome --web-port 8080