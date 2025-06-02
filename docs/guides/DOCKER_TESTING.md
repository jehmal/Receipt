# Receipt Vault - Docker Environment Testing

## Complete testing guide for WorkOS authentication with Docker services

---

## 🐳 Quick Start with Docker

### Option 1: Using PowerShell Script (Recommended for Windows)
```powershell
# In the project root directory
.\start-dev.ps1
```

### Option 2: Manual Setup
```bash
# Start all Docker services
docker-compose up -d

# Wait for services to start (about 30 seconds)
# Start auth server
cd backend
node auth-server.js
```

---

## 🔍 Verify Your Setup

### 1. Check Docker Services
```bash
docker-compose ps
```

**Expected Output:**
```
NAME                      IMAGE                                                     STATUS
receipt_vault_db          postgres:15-alpine                                        Up
receipt_vault_es          docker.elastic.co/elasticsearch/elasticsearch:8.8.0      Up
receipt_vault_qdrant      qdrant/qdrant:latest                                      Up
receipt_vault_redis       redis:7-alpine                                            Up
receipt_vault_storage     minio/minio:latest                                        Up
```

### 2. Check Auth Server
Visit: http://localhost:3000

**Expected:** Beautiful WorkOS login page

### 3. Check API Health
```bash
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T...",
  "message": "Receipt Vault API with WorkOS Auth is running!",
  "auth": "WorkOS AuthKit"
}
```

---

## 📱 Mobile App Testing

### 1. Flutter Setup
```bash
cd mobile
flutter pub get
flutter doctor  # Check for issues
```

### 2. Run Mobile App
```bash
flutter run
```

### 3. Test Authentication Flow

#### On Mobile App:
1. **App should show login screen** ✅
2. **Tap "Sign in with WorkOS"** → Opens browser
3. **Complete authentication** in browser:
   - Register new account OR
   - Sign in with existing account
4. **Return to app**
5. **Tap "Check Authentication Status"**
6. **If successful** → Navigate to main app

#### Troubleshooting Mobile:

**Issue: "Connection refused"**
- Android Emulator: Uses `10.0.2.2:3000` (automatically configured)
- iOS Simulator: Uses `localhost:3000` (automatically configured)
- Real device: Update IP in `app_config.dart` to your computer's IP

**Issue: "Network error"**
```bash
# Test backend connectivity
curl http://localhost:3000/health

# For Android emulator, test:
# adb shell
# curl http://10.0.2.2:3000/health
```

---

## 🧪 Complete Test Scenarios

### Test 1: Docker Services Health Check
```bash
# PostgreSQL
curl -f http://localhost:5432 && echo "✅ PostgreSQL" || echo "❌ PostgreSQL"

# Redis  
redis-cli ping && echo "✅ Redis" || echo "❌ Redis"

# Elasticsearch
curl http://localhost:9200 && echo "✅ Elasticsearch"

# MinIO
curl http://localhost:9000 && echo "✅ MinIO"

# Qdrant
curl http://localhost:6333 && echo "✅ Qdrant"
```

### Test 2: WorkOS Authentication (Web)
1. Go to http://localhost:3000
2. Click "Sign In with WorkOS"
3. Create account:
   - Email: your-email@example.com
   - Password: SecurePassword123!
4. Should redirect to dashboard
5. Test API: http://localhost:3000/api/receipts
6. Should see receipts data

### Test 3: Mobile Authentication
1. Launch Flutter app
2. Should see login screen with:
   - Receipt Vault logo
   - Server status (green)
   - "Sign in with WorkOS" button
3. Tap login → Browser opens
4. Complete auth in browser
5. Return to app → Tap "Check Authentication Status"
6. Should navigate to main app

### Test 4: API Protection
```bash
# Should fail (unauthorized)
curl http://localhost:3000/api/receipts

# After web login, should work
curl http://localhost:3000/api/receipts

# Should return user info after login
curl http://localhost:3000/auth/me
```

### Test 5: Cross-Platform Session
1. Login via web browser
2. Open mobile app
3. Tap "Check Authentication Status"
4. Should be authenticated (shared session)

---

## 🐛 Common Issues & Solutions

### Backend Issues

#### Issue: "Cannot find module '@workos-inc/node'"
```bash
cd backend
npm install @workos-inc/node iron-session
```

#### Issue: "WORKOS_API_KEY is required"
1. Check `.env` file exists in `backend/` directory
2. Verify your WorkOS credentials:
   ```env
   WORKOS_API_KEY=sk_test_your_actual_key
   WORKOS_CLIENT_ID=client_your_actual_id
   ```

#### Issue: "Port 3000 already in use"
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID)
taskkill /PID 1234 /F

# Or change port in .env
PORT=3001
```

### Docker Issues

#### Issue: "Docker is not running"
1. Start Docker Desktop
2. Wait for it to fully start
3. Run `docker info` to verify

#### Issue: "Port conflicts"
```bash
# Check what's using the ports
netstat -ano | findstr :5432
netstat -ano | findstr :6379

# Stop conflicting services or change ports in docker-compose.yml
```

#### Issue: "Services not starting"
```bash
# Check Docker logs
docker-compose logs postgres
docker-compose logs redis

# Restart services
docker-compose down
docker-compose up -d
```

### Mobile Issues

#### Issue: "Network error on Android"
Update `mobile/lib/core/config/app_config.dart`:
```dart
// For Android emulator (already configured)
static const String dockerAuthBaseUrl = 'http://10.0.2.2:3000';

// For real Android device, use your computer's IP
static const String realDeviceAuthBaseUrl = 'http://192.168.1.100:3000';
```

#### Issue: "Flutter build errors"
```bash
cd mobile
flutter clean
flutter pub get
flutter pub deps  # Check dependencies
```

---

## 🔧 Development Workflow

### Daily Development
1. **Start services:**
   ```bash
   .\start-dev.ps1  # or docker-compose up -d
   ```

2. **Start mobile app:**
   ```bash
   cd mobile
   flutter run
   ```

3. **Make changes** to mobile app or backend

4. **Test authentication** after changes

5. **Stop services when done:**
   ```bash
   docker-compose down
   ```

### Environment Variables Summary
Your `.env` file should have:
```env
# WorkOS (REQUIRED - get from WorkOS dashboard)
WORKOS_API_KEY=sk_test_your_actual_key_here
WORKOS_CLIENT_ID=client_your_actual_id_here
WORKOS_COOKIE_PASSWORD=your-32-character-secret-for-cookies-abcd1234

# Application
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Docker Services (automatically configured)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/receipt_vault
REDIS_URL=redis://localhost:6379
# ... other services
```

---

## 🚀 Advanced Testing

### Load Testing
```bash
# Test multiple concurrent requests
for i in {1..10}; do
  curl http://localhost:3000/health &
done
wait
```

### Performance Monitoring
```bash
# Check Docker resource usage
docker stats

# Check auth server memory usage
ps aux | grep node
```

### Database Testing
```bash
# Connect to PostgreSQL
docker exec -it receipt_vault_db psql -U postgres -d receipt_vault

# Check tables
\dt

# Connect to Redis
docker exec -it receipt_vault_redis redis-cli
ping
```

---

## ✅ Success Checklist

Mark each item when working:

### Docker Environment
- [ ] Docker Desktop running
- [ ] All 5 services started (postgres, redis, elasticsearch, qdrant, minio)
- [ ] No port conflicts
- [ ] Services accessible on expected ports

### Backend Auth Server
- [ ] Auth server starts without errors
- [ ] http://localhost:3000 shows login page
- [ ] /health endpoint returns success
- [ ] WorkOS credentials configured correctly

### Mobile App
- [ ] Flutter app builds and runs
- [ ] Login screen displays correctly
- [ ] Server status shows green
- [ ] Can open WorkOS login in browser

### Authentication Flow
- [ ] Can register/login via web
- [ ] Can register/login via mobile
- [ ] Protected endpoints require authentication
- [ ] Sessions persist across browser restarts
- [ ] Logout works correctly

### Cross-Platform Testing
- [ ] Same user can authenticate on web and mobile
- [ ] API calls work from both platforms
- [ ] Session management works consistently

---

## 🆘 Getting Help

### Debug Commands
```bash
# Check all services
docker-compose ps
docker-compose logs

# Check specific service
docker-compose logs postgres
docker-compose logs redis

# Check auth server
curl -v http://localhost:3000/health

# Check mobile app logs
flutter logs
```

### Reset Everything
```bash
# Nuclear option - reset all services
docker-compose down -v  # Removes volumes too
docker-compose up -d

# Reset mobile app
cd mobile
flutter clean
flutter pub get
```

---

**🎉 You're all set!** Your Receipt Vault app now has enterprise-grade authentication running in a containerized environment!