# Effective Prompts for Claude Code

## 🎯 Overview
Examples of well-structured prompts that get the best results from Claude Code development.

## 🚀 Feature Development Prompts

### ✅ Good: Specific with Context
```
"I need to implement user authentication for the receipt app. The backend uses Fastify with JWT tokens, and the mobile app uses Flutter with Riverpod. Please:

1. First explore the existing auth implementation in backend/src/services/auth.ts
2. Create a plan for adding password reset functionality
3. Implement the backend API endpoints for password reset
4. Add the mobile UI components for password reset flow
5. Write tests for both backend and mobile components

The reset flow should use email tokens that expire in 1 hour."
```

### ❌ Bad: Vague and Unclear  
```
"Add password reset to the app"
```

## 🔍 Exploration Prompts

### ✅ Good: Directed Research
```
"Please explore how file uploads are currently handled in this receipt app:

1. Search for existing upload logic in the backend (controllers, services, routes)
2. Check what file storage solution is being used (AWS S3, MinIO, local storage)
3. Look at the mobile camera implementation and how it sends files
4. Identify any image processing or OCR integration
5. Summarize the current upload flow and any potential improvements"
```

### ❌ Bad: Too Broad
```
"Look at the file upload stuff"
```

## 🐛 Bug Fix Prompts

### ✅ Good: Detailed Problem Description
```
"There's a bug where receipts aren't being saved to the database properly. Here's what I know:

**Symptoms:**
- POST /api/receipts returns 201 status
- Response includes a receipt ID
- But GET /api/receipts shows empty list
- No errors in the logs

**Environment:**
- Backend running in development mode
- PostgreSQL database via Docker
- Using the mobile app camera feature

Please:
1. Check the receipt creation service in backend/src/services/receipts.ts
2. Verify the database connection and transactions
3. Check if there are any validation errors being swallowed
4. Test the fix with the existing test suite"
```

### ❌ Bad: Insufficient Detail
```
"Receipts aren't saving, fix it"
```

## 📝 Code Review Prompts

### ✅ Good: Specific Review Criteria
```
"Please review this new receipt OCR service I implemented:

**Focus Areas:**
1. Error handling - are all edge cases covered?
2. Performance - is the Google Vision API being used efficiently?
3. Security - are we properly sanitizing the extracted text?
4. Testing - are there adequate unit and integration tests?
5. Code style - does it follow our TypeScript conventions?

**Files to Review:**
- backend/src/services/ocr.ts
- backend/src/controllers/receipts.ts
- backend/test/services/ocr.test.ts

Please provide specific feedback and suggest improvements."
```

### ❌ Bad: Generic Request
```
"Review my code"
```

## 🧪 Testing Prompts

### ✅ Good: Comprehensive Test Strategy
```
"I need comprehensive tests for the receipt search functionality:

**Components to Test:**
- Backend: SearchService class and /api/search endpoint
- Mobile: SearchProvider and SearchScreen widget
- Integration: End-to-end search flow

**Test Scenarios:**
1. Text search in receipt content
2. Date range filtering  
3. Category filtering
4. Amount range filtering
5. Combined filters
6. Empty results handling
7. Invalid search parameters
8. Performance with large datasets

Please write tests using Jest for backend and flutter_test for mobile, following our existing test patterns."
```

### ❌ Bad: Minimal Context
```
"Write some tests for search"
```

## 🏗️ Architecture Design Prompts

### ✅ Good: Clear Requirements and Constraints
```
"I need to design a notification system for the receipt app with these requirements:

**Requirements:**
- Push notifications for expense alerts
- Email notifications for monthly summaries
- In-app notifications for system updates
- User preferences for notification types

**Constraints:**
- Must work with existing Fastify backend
- Mobile app uses Flutter with Riverpod
- Should be scalable for 10k+ users
- Must support both iOS and Android push notifications

**Please:**
1. Propose an architecture that fits our current stack
2. Identify required dependencies and services
3. Design the database schema for notifications
4. Plan the implementation phases
5. Consider error handling and offline scenarios"
```

### ❌ Bad: Open-ended
```
"Design a notification system"
```

## 🔧 Refactoring Prompts

### ✅ Good: Clear Goals and Scope
```
"The receipt processing service has grown complex and needs refactoring:

**Current Issues:**
- Single 300-line file with multiple responsibilities
- OCR, validation, storage, and categorization all mixed together
- Hard to test individual components
- Difficult to add new receipt processing features

**Refactoring Goals:**
- Separate concerns into focused classes
- Improve testability
- Make it easier to add new processing steps
- Maintain backward compatibility with existing API

**Please:**
1. Analyze the current backend/src/services/receipts.ts
2. Propose a new architecture with separated concerns
3. Create a migration plan that won't break existing functionality
4. Implement the refactoring incrementally with tests"
```

### ❌ Bad: Vague Intent
```
"This code is messy, clean it up"
```

## 📱 Mobile Development Prompts

### ✅ Good: Platform-Specific Details
```
"I need to implement a receipt camera screen with these Flutter-specific requirements:

**Features:**
- Custom camera overlay with receipt frame guides
- Real-time edge detection for receipt boundaries
- Auto-capture when receipt is properly framed
- Manual capture button as fallback
- Image cropping after capture
- Retry/retake functionality

**Technical Requirements:**
- Use camera plugin for device camera access
- Integrate with existing image processing pipeline
- Follow our Riverpod state management patterns
- Support both iOS and Android
- Handle camera permissions properly
- Work in both portrait and landscape modes

**Please:**
1. Check existing camera implementation in mobile/lib/features/camera/
2. Enhance the CameraScreen widget with the new features
3. Update the CameraProvider for state management
4. Write widget tests for the new functionality"
```

### ❌ Bad: Generic Request
```
"Make the camera better"
```

## 🎨 UI/UX Prompts

### ✅ Good: Visual Specifications
```
"I need to implement a receipt list screen with specific design requirements:

**Visual Design:**
- Card-based layout with receipt thumbnails
- Swipe actions: archive (left), delete (right)
- Pull-to-refresh functionality
- Infinite scroll/pagination
- Search bar at the top
- Filter chips below search (category, date, amount)
- Empty state with illustration and call-to-action

**Interaction Design:**
- Tap card to view receipt details
- Long press for multi-select mode
- Smooth animations for state changes
- Loading states for async operations

**Technical Requirements:**
- Use Flutter ListView.builder for performance
- Implement with existing ReceiptsProvider
- Follow our app theme and color scheme
- Support accessibility features
- Handle offline scenarios gracefully

Please implement this step by step, starting with the basic layout and adding interactions."
```

### ❌ Bad: No Visual Context
```
"Make a list screen for receipts"
```

## 🔍 Debugging Prompts

### ✅ Good: Systematic Investigation
```
"The mobile app is crashing when uploading large receipt images. Help me debug this:

**Crash Details:**
- Happens only with images > 5MB
- Occurs during the upload process
- Stack trace points to image processing code
- More frequent on older Android devices

**Investigation Plan:**
1. Check memory usage during image processing
2. Verify image compression settings
3. Test timeout configurations for API calls
4. Check error handling in upload provider
5. Test with various image sizes and formats

**Files to Examine:**
- mobile/lib/features/camera/providers/upload_provider.dart
- backend/src/controllers/receipts.ts (upload handling)
- mobile/lib/core/network/ (HTTP client configuration)

Please systematically work through this and propose solutions."
```

### ❌ Bad: Panic Mode
```
"App is crashing fix it now!"
```

## 📊 Performance Optimization Prompts

### ✅ Good: Measurable Goals
```
"The receipt search is too slow and needs optimization:

**Current Performance:**
- Search takes 3-5 seconds for 1000+ receipts
- UI freezes during search
- Memory usage spikes significantly

**Performance Goals:**
- Search response under 500ms
- Smooth UI during search
- Stable memory usage

**Investigation Areas:**
1. Database query optimization (check indexes)
2. Elasticsearch integration efficiency
3. Mobile search result rendering
4. Caching strategies for frequent searches

**Please:**
1. Profile the current search performance
2. Identify bottlenecks in both backend and mobile
3. Implement optimizations incrementally
4. Add performance monitoring/metrics
5. Verify improvements with benchmarks"
```

### ❌ Bad: Vague Complaint
```
"Everything is slow, make it faster"
```

## 🎯 Prompt Structure Template

### Effective Prompt Formula:
```
[CONTEXT] + [SPECIFIC TASK] + [REQUIREMENTS] + [CONSTRAINTS] + [SUCCESS CRITERIA]
```

### Example Using Template:
```
**Context:** Working on receipt management app with Node.js backend and Flutter mobile

**Task:** Implement real-time receipt processing status updates

**Requirements:** 
- WebSocket connection for live updates
- Progress indicators (uploading, processing, OCR, categorizing, complete)
- Error state handling with retry options

**Constraints:**
- Must work with existing Fastify backend
- Follow current Riverpod patterns in mobile app
- Support multiple concurrent uploads

**Success Criteria:**
- User sees real-time progress for each receipt
- Graceful handling of connection drops
- All existing functionality remains working
```

## 💡 Tips for Better Prompts

### Do:
- ✅ Provide specific context about your codebase
- ✅ Break complex requests into numbered steps
- ✅ Mention relevant files and technologies
- ✅ Include error messages or symptoms when debugging
- ✅ Specify testing requirements
- ✅ Ask for explanations of the approach

### Don't:
- ❌ Use vague terms like "better" or "fix"
- ❌ Assume Claude knows your specific setup
- ❌ Skip context about existing implementation
- ❌ Request everything at once without priorities
- ❌ Forget to mention testing needs
- ❌ Use urgent language that skips planning

---

*Well-crafted prompts lead to better code and faster development*