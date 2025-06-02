# 🚀 Receipt Vault Demo Setup

Welcome! Here's how to run the complete Receipt Vault demo with both web interface and mobile app.

## 📋 Prerequisites

1. **Docker Desktop** - Running and accessible
2. **Node.js** - For the backend API  
3. **Flutter** - For the mobile app (optional)

## 🎯 Quick Start

### Option 1: Automated Setup (Recommended)
```bash
# Double-click this file:
start-demo.bat
```

This will:
- ✅ Start all Docker services (PostgreSQL, Redis, etc.)
- ✅ Launch the backend API server
- ✅ Open the web demo interface
- ✅ Show instructions for mobile app

### Option 2: Manual Setup

#### Step 1: Start Infrastructure
```bash
docker-compose up -d
```

#### Step 2: Start Backend API
```bash
cd backend
node demo-server.js
```

#### Step 3: Test Web Interface
Open `backend/demo-web.html` in your browser or go to:
- 🌐 **Web Demo**: `file:///path/to/backend/demo-web.html`
- 📡 **API Directly**: `http://localhost:3000`

#### Step 4: Mobile App (Optional)
```bash
cd mobile
flutter pub get
flutter run
```

## 🎮 What You Can Demo

### 🌐 Web Interface
- **Health Check**: Test API connectivity
- **Demo Info**: View app features and status  
- **Receipts**: Browse mock receipt data
- **Analytics**: See spending analytics

### 📱 Mobile App Features
- **Receipt Camera**: Take photos of receipts
- **Receipt List**: Browse and manage receipts
- **Categories**: Organize by spending category
- **Search**: Find receipts quickly
- **Analytics**: View spending insights

## 🔌 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Server health check |
| `GET /api/demo` | Demo information |
| `GET /api/receipts` | List all receipts |
| `GET /api/analytics` | Spending analytics |

## 🗄️ Infrastructure Services

- **PostgreSQL** (port 5432) - Main database
- **Redis** (port 6379) - Caching & sessions
- **Elasticsearch** (port 9200) - Search engine
- **MinIO** (port 9000) - File storage
- **Qdrant** (port 6333) - Vector database

## 🛠️ Current Demo Status

### ✅ What's Working
- Backend API with mock data
- Database schema loaded
- All infrastructure services running
- Web demo interface
- Flutter app configured and ready

### 🚧 What's Simulated
- OCR processing (mock responses)
- User authentication (demo mode)
- Receipt image upload (mock data)
- Email-to-vault feature (disabled)

### 🎯 Next Development Steps
1. Implement real OCR processing
2. Add user authentication system
3. Build receipt upload functionality
4. Connect mobile app to real API
5. Add advanced search features

## 🐛 Troubleshooting

### Backend Won't Start
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill existing processes
taskkill /f /im node.exe
```

### Docker Issues
```bash
# Restart Docker services
docker-compose down
docker-compose up -d
```

### Mobile App Issues
```bash
cd mobile
flutter clean
flutter pub get
flutter run
```

## 📞 Demo Walkthrough

1. **Start with Web Demo**: Open the HTML file, test all endpoints
2. **Check Database**: Verify receipts are loading from PostgreSQL
3. **Try Mobile App**: See the Flutter interface (if Flutter installed)
4. **Explore Features**: Navigate through receipts, analytics, etc.
5. **Test Connectivity**: Verify mobile app connects to local API

---

**🎉 Enjoy exploring your Receipt Vault demo!** 

This shows the full potential of your receipt management system with a beautiful Flutter mobile app and robust backend infrastructure. 