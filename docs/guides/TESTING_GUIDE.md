# Receipt Vault - WorkOS Testing Guide

## Quick start guide for testing the WorkOS authentication integration

---

## 🚀 Quick Start (5 minutes)

### 1. Start the Backend
```bash
cd backend
node auth-server.js
```

**Expected Output:**
```
🚀 Receipt Vault API with WorkOS Authentication RUNNING!
📡 http://localhost:3000
```

### 2. Start the Mobile App
```bash
cd mobile
flutter run
```

### 3. Test Web Interface
1. Open http://localhost:3000
2. Click "Sign In with WorkOS"
3. Create account or sign in
4. Should redirect to dashboard

### 4. Test Mobile Flow
1. App should show login screen
2. Tap "Sign in with WorkOS" → opens browser
3. Complete authentication in browser
4. Return to app, tap "Check Authentication Status"
5. Should navigate to main app if authenticated

---

## 🔍 Detailed Testing Steps

### Backend API Testing

#### 1. Health Check
```bash
curl http://localhost:3000/health
```
**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "message": "Receipt Vault API with WorkOS Auth is running!",
  "auth": "WorkOS AuthKit"
}
```

#### 2. Demo Endpoint
```bash
curl http://localhost:3000/api/demo
```
**Expected Response:**
```json
{
  "message": "Welcome to Receipt Vault API with WorkOS Authentication!",
  "features": [...],
  "authMethods": [...],
  "status": "Production Ready with WorkOS"
}
```

#### 3. Protected Endpoint (should fail without auth)
```bash
curl http://localhost:3000/api/receipts
```
**Expected Response:**
```json
{
  "error": "Unauthorized"
}
```

### Authentication Flow Testing

#### Web Authentication
1. **Navigate to login:**
   ```
   http://localhost:3000/auth/login
   ```
   Should redirect to WorkOS login page

2. **Complete authentication:**
   - Enter email/password or use OAuth
   - Should redirect back to http://localhost:3000/dashboard

3. **Test authenticated endpoint:**
   After login, visit http://localhost:3000/api/receipts
   Should return receipts data

4. **Test user info:**
   ```
   http://localhost:3000/auth/me
   ```
   Should return user data

5. **Test logout:**
   POST to http://localhost:3000/auth/logout
   Should clear session

#### Mobile Authentication
1. **App Launch:**
   - Should show login screen if not authenticated
   - Should show main app if already authenticated

2. **Login Process:**
   - Tap "Sign in with WorkOS"
   - Browser should open with WorkOS login
   - Complete authentication in browser
   - Return to app

3. **Check Authentication:**
   - Tap "Check Authentication Status"
   - If successful, should navigate to main app
   - If failed, should show error message

4. **App Navigation:**
   - Should access protected screens when authenticated
   - Should redirect to login when not authenticated

---

## 🐛 Common Issues and Solutions

### Issue: Backend Won't Start
**Error:** `WORKOS_API_KEY is undefined`

**Solution:**
1. Check `.env` file exists in `backend/` directory
2. Verify WorkOS credentials are set:
   ```env
   WORKOS_API_KEY=sk_test_your_key_here
   WORKOS_CLIENT_ID=client_your_id_here
   ```
3. Restart server

### Issue: Redirect URI Mismatch
**Error:** `Invalid redirect URI`

**Solution:**
1. Add `http://localhost:3000/auth/callback` to WorkOS dashboard
2. Ensure exact match (no trailing slash)
3. Check WorkOS project settings

### Issue: Mobile App Can't Connect
**Error:** Network error or connection refused

**Solution:**
1. Ensure backend is running on port 3000
2. Check IP address in mobile service:
   - iOS Simulator: `localhost:3000` ✅
   - Android Emulator: `10.0.2.2:3000` (might be needed)
3. Test with curl first to ensure backend is accessible

### Issue: Session Errors
**Error:** `Failed to unseal session data`

**Solution:**
1. Generate new `WORKOS_COOKIE_PASSWORD` (32 characters)
2. Clear browser cookies
3. Restart backend server

---

## 📋 Test Scenarios

### Scenario 1: New User Registration
1. Navigate to login page
2. Choose "Create account"
3. Enter email/password
4. Verify email if required
5. Should redirect to dashboard
6. Check user data in /auth/me

### Scenario 2: Existing User Login
1. Navigate to login page
2. Enter existing credentials
3. Should redirect to dashboard
4. Verify session persistence

### Scenario 3: OAuth Login (Google)
1. Navigate to login page
2. Choose "Continue with Google"
3. Complete Google OAuth flow
4. Should redirect to dashboard
5. Check user data includes Google info

### Scenario 4: Mobile App Flow
1. Launch app (should show login)
2. Tap WorkOS login button
3. Complete auth in browser
4. Return to app
5. Check auth status
6. Navigate to main app
7. Test logout
8. Should return to login screen

### Scenario 5: Session Management
1. Login via web
2. Check /auth/me endpoint
3. Restart browser
4. Check if still logged in
5. Test logout
6. Verify session cleared

---

## 🔧 Debug Mode Testing

### Enable Debug Logging
Add to `.env`:
```env
DEBUG=true
LOG_LEVEL=debug
```

### Check Server Logs
Monitor console output for:
- Authentication attempts
- Session creation/destruction
- API call logs
- Error messages

### Check Mobile App Logs
Look for debug prints in Flutter console:
- Auth service calls
- API responses
- Navigation events
- Error messages

---

## 📊 Performance Testing

### Load Testing
```bash
# Test health endpoint
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/health

# Test multiple concurrent requests
for i in {1..10}; do
  curl http://localhost:3000/health &
done
wait
```

### Response Time Testing
Expected response times:
- Health check: < 50ms
- Login redirect: < 100ms
- Protected endpoints: < 200ms
- User info: < 100ms

---

## ✅ Test Checklist

### Backend Tests
- [ ] Server starts without errors
- [ ] Health endpoint responds
- [ ] Demo endpoint responds
- [ ] Protected endpoints reject unauthorized requests
- [ ] Login redirects to WorkOS
- [ ] Callback handles authentication
- [ ] User info endpoint works after auth
- [ ] Logout clears session

### Mobile Tests
- [ ] App builds and runs
- [ ] Login screen displays
- [ ] WorkOS login button opens browser
- [ ] Auth check works after browser login
- [ ] Main app screens load when authenticated
- [ ] Logout returns to login screen
- [ ] App handles network errors gracefully

### Integration Tests
- [ ] Web and mobile can authenticate to same backend
- [ ] Sessions work across browser tabs
- [ ] API calls work from both web and mobile
- [ ] Logout works from both interfaces

### Security Tests
- [ ] Unauthorized API calls are rejected
- [ ] Sessions expire appropriately
- [ ] Sensitive data not logged
- [ ] HTTPS ready for production

---

## 🎯 Production Testing

Before deploying to production:

1. **Update environment variables** for production
2. **Test with production WorkOS project**
3. **Verify HTTPS/SSL configuration**
4. **Test with real domain names**
5. **Performance test with expected load**
6. **Security audit authentication flow**

---

## 📞 Need Help?

If tests are failing:

1. **Check the logs** - both backend console and mobile app console
2. **Verify configuration** - especially WorkOS credentials and redirect URIs
3. **Test step by step** - start with backend health check, then build up
4. **Compare with working examples** - check the web dashboard flow first
5. **Review the setup guide** - ensure all steps were completed

**Common Commands for Debugging:**
```bash
# Check if backend is running
curl http://localhost:3000/health

# Check WorkOS configuration
echo $WORKOS_API_KEY  # Should not be empty

# Test mobile app build
cd mobile && flutter doctor

# Check mobile dependencies
flutter pub deps
```

---

**Happy Testing! 🚀**