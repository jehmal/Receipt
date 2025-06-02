#!/bin/bash

echo "🚀 Starting Flutter Web Development Server"
echo "=========================================="

# Check if Flutter is installed
if ! command -v flutter &> /dev/null; then
    echo "❌ Flutter is not installed or not in PATH"
    echo "📥 Please install Flutter: https://flutter.dev/docs/get-started/install"
    exit 1
fi

echo "📋 Flutter Doctor Check:"
flutter doctor

# Navigate to mobile directory
cd mobile

echo "📦 Getting Flutter dependencies..."
flutter pub get

echo "🔨 Running code generation..."
flutter packages pub run build_runner build --delete-conflicting-outputs

echo "🌐 Starting Flutter Web Server on http://localhost:8080..."
echo "📱 Your app will open automatically in your browser"
echo "🔧 Make sure your backend is running on http://localhost:3000"
echo ""
echo "🛑 Press Ctrl+C to stop the server"
echo ""

# Start Flutter web server
flutter run -d chrome --web-port 8080