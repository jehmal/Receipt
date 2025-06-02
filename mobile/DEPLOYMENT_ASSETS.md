# Receipt Vault Pro - App Store Deployment Assets

## 📱 App Icons Required

### iOS (App Store)
- 1024×1024 (App Store)
- 180×180 (iPhone)
- 120×120 (iPhone retina)
- 87×87 (iPhone settings)
- 58×58 (iPhone spotlight)
- 40×40 (iPhone spotlight)
- 29×29 (iPhone settings)

### Android (Play Store)
- 512×512 (Play Store feature graphic)
- 192×192 (xxxhdpi)
- 144×144 (xxhdpi)
- 96×96 (xhdpi)
- 72×72 (hdpi)
- 48×48 (mdpi)

## 🎨 Visual Assets

### Splash Screens
- iOS: LaunchScreen.storyboard
- Android: drawable/splash_screen.xml

### Feature Graphics
- 1024×500 (Play Store feature graphic)
- Screenshots (phone + tablet)

## 📝 Store Metadata

### App Store Connect (iOS)
```
Title: Receipt Vault Pro
Subtitle: Smart Receipt Management
Description: Transform receipt management with AI-powered OCR, smart categorization, and seamless expense tracking. Perfect for businesses and individuals.

Keywords: receipt, expense, OCR, business, tax, scanning, management, AI

Category: Business/Productivity
```

### Google Play Console (Android)
```
Short Description: AI-powered receipt management with OCR and smart categorization
Full Description: [Same as iOS but longer format allowed]

Category: Business
Content Rating: Everyone
```

## 🔑 Feature Highlights
- AI-powered OCR for instant receipt digitization
- Smart expense categorization
- Voice memo attachments
- Offline-first architecture
- Export to PDF/CSV
- Enterprise-grade authentication
- Real-time sync across devices

## 📊 Privacy & Permissions

### iOS Info.plist
```xml
<key>NSCameraUsageDescription</key>
<string>Take photos of receipts for expense tracking</string>
<key>NSMicrophoneUsageDescription</key>
<string>Record voice memos for receipt notes</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Select receipt images from photo library</string>
```

### Android Permissions
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.INTERNET" />
```

## 🚀 Release Notes Template
```
Version 1.0.0
• Initial release of Receipt Vault Pro
• AI-powered receipt scanning with OCR
• Smart expense categorization
• Voice memo support
• Offline-first design
• Export capabilities
• Enterprise authentication
```