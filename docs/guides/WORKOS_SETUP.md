# WorkOS Authentication Setup Guide

## Complete integration guide for Receipt Vault with WorkOS authentication

---

## 🎯 Overview

This guide will walk you through setting up WorkOS authentication for your Receipt Vault application. WorkOS provides enterprise-grade authentication with support for SSO, multi-factor authentication, and more.

## 📋 Prerequisites

- Node.js 18+ installed
- Flutter 3.10+ installed
- WorkOS account (free tier available)
- Code editor (VS Code recommended)

---

## 🔧 Step 1: WorkOS Dashboard Setup

### 1.1 Create WorkOS Account
1. Go to [WorkOS Dashboard](https://dashboard.workos.com/)
2. Sign up for a free account
3. Verify your email address

### 1.2 Create a Project
1. In the WorkOS dashboard, click "Create Project"
2. Enter project name: "Receipt Vault"
3. Choose your environment: "Development"

### 1.3 Configure Authentication
1. Navigate to "Authentication" → "AuthKit"
2. Enable AuthKit for your project
3. Configure authentication methods:
   - ✅ **Email + Password** (required)
   - ✅ **Google OAuth** (recommended)
   - ✅ **Magic Link** (optional)
   - ✅ **Microsoft OAuth** (optional)

### 1.4 Set Redirect URIs
In AuthKit settings, add these redirect URIs:
```
http://localhost:3000/auth/callback
https://yourdomain.com/auth/callback  (for production)
```

### 1.5 Get API Credentials
1. Go to "API Keys" section
2. Copy your **API Key** (starts with `sk_test_`)
3. Copy your **Client ID** (starts with `client_`)

---

## 🔑 Step 2: Backend Environment Configuration

### 2.1 Update Backend .env File
Navigate to `backend/.env` and update with your WorkOS credentials:

```env
# WorkOS Configuration - REQUIRED
WORKOS_API_KEY=sk_test_YOUR_ACTUAL_API_KEY_HERE
WORKOS_CLIENT_ID=client_YOUR_ACTUAL_CLIENT_ID_HERE
WORKOS_COOKIE_PASSWORD=a-very-secure-32-character-secret-key

# Application Configuration
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Other existing configuration...
```

### 2.2 Generate Secure Cookie Password
Generate a secure 32-character string for `WORKOS_COOKIE_PASSWORD`:
```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# Option 2: Using OpenSSL
openssl rand -hex 16

# Option 3: Manual (use any 32-character string)
# Example: myapp2024secure128bitcookiekey
```

### 2.3 Verify Dependencies
Check that `backend/package.json` includes:
```json
{
  "dependencies": {
    "@workos-inc/node": "^7.0.0",
    "iron-session": "^8.0.1",
    "fastify": "^4.24.3",
    "@fastify/cors": "^8.4.0",
    "@fastify/cookie": "^9.2.0",
    "@fastify/formbody": "^7.4.0",
    "@fastify/static": "^6.12.0",
    "dotenv": "^16.3.1"
  }
}
```

---

## 📱 Step 3: Mobile App Configuration

### 3.1 Install Dependencies
In the `mobile/` directory, run:
```bash
flutter pub get
```

This will install the required dependencies including:
- `http: ^1.1.0` (for API calls)
- `url_launcher: ^6.1.11` (for opening login URL)

### 3.2 Update API Configuration
In `mobile/lib/core/config/app_config.dart`, verify the base URL:
```dart
class AppConfig {
  // API Configuration
  static const String baseUrl = 'http://localhost:3000/api';
  static const String authBaseUrl = 'http://localhost:3000';
  // ... rest of configuration
}
```

---

## 🚀 Step 4: Running the Application

### 4.1 Start the Backend Auth Server
```bash
cd backend
npm install  # if not already done
node auth-server.js
```

You should see:
```
🚀 Receipt Vault API with WorkOS Authentication RUNNING!
📡 http://localhost:3000

🔐 Authentication Endpoints:
   GET  /auth/login - WorkOS login
   GET  /auth/callback - Auth callback
   POST /auth/logout - Logout
   GET  /auth/me - Current user

📊 Protected API Endpoints:
   GET  /api/receipts - User receipts
   POST /api/receipts - Create receipt
   GET  /api/analytics - User analytics
```

### 4.2 Start the Mobile App
```bash
cd mobile
flutter run
```

### 4.3 Test Web Interface (Optional)
Open http://localhost:3000 in your browser to test the web interface.

---

## 🔄 Step 5: Testing the Authentication Flow

### 5.1 Mobile App Testing
1. **Launch the app** - You should see the login screen
2. **Tap "Sign in with WorkOS"** - This opens your browser
3. **Complete authentication** in the browser:
   - Create account or sign in
   - Complete any required verification
4. **Return to app** and tap "Check Authentication Status"
5. **If authenticated**, you'll be redirected to the main app

### 5.2 Web Testing
1. Go to http://localhost:3000
2. Click "Sign In with WorkOS"
3. Complete authentication
4. You should be redirected to the dashboard
5. Test protected endpoints

### 5.3 API Testing
Test protected endpoints with curl:
```bash
# This should fail (no authentication)
curl http://localhost:3000/api/receipts

# After logging in via web, test with browser session
# Or use the /auth/me endpoint to verify
curl http://localhost:3000/auth/me
```

---

## 🛠️ Step 6: Troubleshooting

### Common Issues and Solutions

#### Issue: "Authentication Failed"
**Cause**: Incorrect WorkOS credentials
**Solution**: 
1. Verify API key and Client ID in `.env`
2. Check WorkOS dashboard for correct values
3. Ensure no extra spaces or quotes

#### Issue: "Redirect URI Mismatch"
**Cause**: Redirect URI not configured in WorkOS
**Solution**:
1. Add `http://localhost:3000/auth/callback` to WorkOS AuthKit settings
2. Ensure exact match (no trailing slashes)

#### Issue: "Cookie/Session Errors"
**Cause**: Invalid cookie password or session configuration
**Solution**:
1. Generate new 32-character `WORKOS_COOKIE_PASSWORD`
2. Restart the backend server
3. Clear browser cookies

#### Issue: "CORS Errors"
**Cause**: Frontend trying to access backend from different origin
**Solution**: Already configured in `auth-server.js` with:
```javascript
fastify.register(require('@fastify/cors'), {
  origin: true,
  credentials: true
});
```

#### Issue: "Mobile App Can't Connect"
**Cause**: Network configuration or URL issues
**Solution**:
1. Ensure backend is running on localhost:3000
2. For Android emulator, may need to use `10.0.2.2:3000`
3. For iOS simulator, `localhost:3000` should work
4. Check mobile device/emulator network connectivity

---

## 🔒 Step 7: Production Setup

### 7.1 Environment Variables for Production
```env
# Production WorkOS Configuration
WORKOS_API_KEY=sk_live_YOUR_PRODUCTION_API_KEY
WORKOS_CLIENT_ID=client_YOUR_PRODUCTION_CLIENT_ID
WORKOS_COOKIE_PASSWORD=your-secure-production-cookie-password

# Production Configuration
NODE_ENV=production
PORT=3000
APP_URL=https://your-domain.com

# Production Database
DATABASE_URL=postgresql://user:password@your-db-host:5432/receipt_vault
```

### 7.2 Mobile App Production Configuration
Update `mobile/lib/core/auth/workos_auth_service.dart`:
```dart
class WorkOSAuthService {
  static const String authBaseUrl = 'https://your-api-domain.com';
  // ... rest of the service
}
```

### 7.3 WorkOS Production Setup
1. Create production project in WorkOS dashboard
2. Configure production redirect URIs
3. Update authentication methods as needed
4. Get production API credentials

---

## 📊 Step 8: Features and Capabilities

### Current Authentication Features
- ✅ **WorkOS AuthKit Integration**
- ✅ **Email + Password Authentication**
- ✅ **Google OAuth Support**
- ✅ **Magic Link Authentication**
- ✅ **Secure Session Management**
- ✅ **Multi-device Login**
- ✅ **Enterprise SSO Ready**
- ✅ **Mobile + Web Support**

### API Endpoints Available
- `GET /auth/login` - Initiate WorkOS login
- `GET /auth/callback` - Handle authentication callback
- `POST /auth/logout` - Sign out user
- `GET /auth/me` - Get current user info
- `GET /api/receipts` - Get user receipts (protected)
- `POST /api/receipts` - Create receipt (protected)
- `GET /api/analytics` - Get user analytics (protected)

### Mobile App Features
- ✅ **Authentication Check on Startup**
- ✅ **Login Screen with WorkOS Integration**
- ✅ **Browser-based Authentication Flow**
- ✅ **Automatic Session Management**
- ✅ **Protected Route Handling**
- ✅ **Real-time API Integration**

---

## 🎯 Next Steps

### Immediate Tasks
1. **Test the complete flow** end-to-end
2. **Customize the login experience** (branding, colors)
3. **Add user profile management**
4. **Implement organization/company support**

### Future Enhancements
1. **Add biometric authentication** to mobile app
2. **Implement offline support** with sync
3. **Add enterprise SSO** for corporate customers
4. **Enhance security** with device management
5. **Add audit logging** for compliance

### Integration with Existing Backend
Once WorkOS authentication is working, you can integrate it with your existing Receipt Vault backend:
1. **Replace mock auth** in existing services
2. **Connect to PostgreSQL database**
3. **Enable file upload functionality**
4. **Add OCR processing**
5. **Implement real receipt management**

---

## 🆘 Support and Resources

### WorkOS Resources
- [WorkOS Documentation](https://workos.com/docs)
- [AuthKit Setup Guide](https://workos.com/docs/authkit)
- [Node.js SDK](https://workos.com/docs/sdks/node)

### Flutter Resources
- [Flutter HTTP Package](https://pub.dev/packages/http)
- [URL Launcher Package](https://pub.dev/packages/url_launcher)
- [Riverpod State Management](https://riverpod.dev/)

### Need Help?
- Check the [Issues](https://github.com/workos/workos-node/issues) on WorkOS GitHub
- Review [Flutter Documentation](https://flutter.dev/docs)
- Check authentication flows in browser developer tools

---

## ✅ Verification Checklist

Mark each item as completed:

### WorkOS Setup
- [ ] WorkOS account created
- [ ] Project configured
- [ ] AuthKit enabled
- [ ] Redirect URIs added
- [ ] API credentials copied

### Backend Setup
- [ ] .env file updated with WorkOS credentials
- [ ] Cookie password generated
- [ ] Dependencies installed
- [ ] Auth server starts without errors

### Mobile Setup
- [ ] Dependencies installed (`flutter pub get`)
- [ ] App builds without errors
- [ ] Login screen displays correctly

### Testing
- [ ] Web login flow works
- [ ] Mobile login flow works
- [ ] Protected API endpoints work
- [ ] Logout works correctly
- [ ] Session persistence works

### Production Ready
- [ ] Production WorkOS project created
- [ ] Production environment variables set
- [ ] Mobile app configured for production
- [ ] SSL/HTTPS configured
- [ ] Domain configured in WorkOS

---

**🎉 Congratulations!** Your Receipt Vault application now has enterprise-grade authentication powered by WorkOS!