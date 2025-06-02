# Receipt App Specific Claude Code Workflows

## 🎯 Overview
Real-world workflows and examples specifically designed for Receipt Vault development using Claude Code SDK.

## 🚀 Daily Development Workflows

### 1. Morning Development Setup
```bash
#!/bin/bash
# morning-setup.sh - Daily development initialization

echo "🌅 Starting Receipt Vault development session..."

# Start development environment
claude -p "Start the complete development environment for receipt vault app:
1. Start Docker services (PostgreSQL, Redis, MinIO, Elasticsearch)
2. Start backend development server
3. Start mobile development with hot reload
4. Check all services are healthy
5. Run a quick smoke test" > setup-log.txt

# Display status
cat setup-log.txt
echo "✅ Development environment ready!"
```

### 2. Feature Development Workflow
```bash
#!/bin/bash
# feature-workflow.sh [feature-name]

FEATURE_NAME=$1
if [[ -z "$FEATURE_NAME" ]]; then
    echo "Usage: ./feature-workflow.sh <feature-name>"
    exit 1
fi

echo "🚀 Starting feature development: $FEATURE_NAME"

# Step 1: Explore existing implementation
claude -p "Explore the receipt app codebase to understand how to implement: $FEATURE_NAME
1. Analyze existing similar features
2. Identify required changes in backend (Node.js/Fastify)
3. Identify required changes in mobile (Flutter/Riverpod)
4. Check database schema requirements
5. Identify potential integration points" > "feature-analysis-$FEATURE_NAME.md"

# Step 2: Create implementation plan
claude --continue "Create a detailed implementation plan with specific tasks:
1. Backend API endpoints needed
2. Database migrations required
3. Mobile UI components to create
4. State management changes
5. Testing strategy
6. Documentation updates" > "feature-plan-$FEATURE_NAME.md"

# Step 3: Implement backend first
claude --continue "Let's start implementing the backend components:
1. Create necessary API routes
2. Implement service layer logic
3. Add proper validation and error handling
4. Include comprehensive logging" > "backend-implementation-$FEATURE_NAME.md"

echo "📋 Feature planning complete. Check the generated files for next steps."
```

### 3. Bug Investigation Workflow
```bash
#!/bin/bash
# bug-investigation.sh [bug-description]

BUG_DESC="$1"
if [[ -z "$BUG_DESC" ]]; then
    echo "Usage: ./bug-investigation.sh 'bug description'"
    exit 1
fi

echo "🐛 Investigating bug: $BUG_DESC"

# Gather system information
claude -p "Help me investigate this bug in the receipt app: '$BUG_DESC'

Please analyze:
1. Recent code changes that might be related
2. Common causes for this type of issue in receipt processing apps
3. Debugging strategy with specific steps
4. Log files to check and what to look for
5. Test cases to reproduce the issue

Also suggest a systematic approach to isolate the root cause." > "bug-investigation-$(date +%Y%m%d-%H%M).md"

echo "📊 Bug investigation report generated. Check the markdown file for analysis."
```

## 🔧 Backend Development Workflows

### 1. API Endpoint Generation
```bash
# Quick API endpoint creation
create_api_endpoint() {
    local endpoint_name=$1
    local description=$2
    
    claude -f json -p "Create a complete Fastify API endpoint for receipt app:
    
    Endpoint: $endpoint_name
    Description: $description
    
    Include:
    1. Route definition with proper HTTP method
    2. Request validation using Joi schema
    3. Service layer implementation
    4. Error handling with appropriate HTTP status codes
    5. OpenAPI/Swagger documentation
    6. Unit tests with Jest
    7. Integration tests
    
    Follow the existing patterns in the receipt app codebase." | jq -r '.result' > "endpoint-$endpoint_name.ts"
    
    echo "✅ Generated endpoint: endpoint-$endpoint_name.ts"
}

# Usage examples
create_api_endpoint "receipt-categories" "CRUD operations for managing receipt categories"
create_api_endpoint "receipt-search" "Advanced search functionality for receipts with filters"
```

### 2. Database Migration Workflow
```bash
# database-migration.sh [migration-name]

MIGRATION_NAME=$1
if [[ -z "$MIGRATION_NAME" ]]; then
    echo "Usage: ./database-migration.sh <migration-name>"
    exit 1
fi

echo "📊 Creating database migration: $MIGRATION_NAME"

# Generate migration
claude -p "Create a PostgreSQL database migration for the receipt app:

Migration: $MIGRATION_NAME

Requirements:
1. Create both up and down migration scripts
2. Include proper indexes for performance
3. Add foreign key constraints where appropriate
4. Include data validation constraints
5. Consider the existing schema structure
6. Add comments explaining the changes
7. Include sample data insertion if needed

Make sure the migration is reversible and follows PostgreSQL best practices." > "migration-$MIGRATION_NAME.sql"

# Generate TypeScript types
claude --continue "Now generate corresponding TypeScript types and interfaces for the new database schema changes. Include:
1. Interface definitions
2. Type guards for validation
3. Database query types
4. API request/response types" > "types-$MIGRATION_NAME.ts"

echo "✅ Generated migration files for: $MIGRATION_NAME"
```

### 3. Service Layer Enhancement
```bash
# enhance-service.sh [service-name]

SERVICE_NAME=$1
if [[ -z "$SERVICE_NAME" ]]; then
    echo "Usage: ./enhance-service.sh <service-name>"
    exit 1
fi

echo "⚡ Enhancing service: $SERVICE_NAME"

# Analyze current service
claude -p "Analyze the $SERVICE_NAME service in the receipt app and suggest improvements:

1. Review current implementation
2. Identify performance bottlenecks
3. Suggest error handling improvements
4. Recommend additional validation
5. Propose caching strategies
6. Suggest monitoring and logging enhancements
7. Identify potential security issues
8. Recommend testing improvements

Provide specific code examples for each improvement." > "service-analysis-$SERVICE_NAME.md"

# Generate enhanced version
claude --continue "Now implement the enhanced version of the $SERVICE_NAME service with all the suggested improvements. Include:
1. Improved error handling
2. Better performance optimizations
3. Enhanced logging and monitoring
4. Comprehensive input validation
5. Proper caching implementation
6. Security improvements" > "enhanced-$SERVICE_NAME.ts"

echo "📈 Service enhancement complete for: $SERVICE_NAME"
```

## 📱 Mobile Development Workflows

### 1. Flutter Screen Generation
```bash
# create-flutter-screen.sh [screen-name] [description]

SCREEN_NAME=$1
DESCRIPTION=$2

if [[ -z "$SCREEN_NAME" || -z "$DESCRIPTION" ]]; then
    echo "Usage: ./create-flutter-screen.sh <screen-name> <description>"
    exit 1
fi

echo "📱 Creating Flutter screen: $SCREEN_NAME"

# Generate complete screen implementation
claude -p "Create a complete Flutter screen for the receipt app:

Screen: $SCREEN_NAME
Description: $DESCRIPTION

Requirements:
1. Follow the existing app structure in mobile/lib/features/
2. Use Riverpod for state management
3. Implement proper error handling and loading states
4. Follow the app's design system and theme
5. Include accessibility features
6. Add proper navigation integration
7. Include comprehensive widget tests
8. Use appropriate animations for better UX

Generate the following files:
1. Screen widget
2. Riverpod provider
3. Model classes if needed
4. Widget tests
5. Navigation integration code" > "flutter-screen-$SCREEN_NAME.md"

# Create individual files based on the generated content
claude --continue "Extract the screen widget code and save it as a proper Dart file" > "mobile/lib/features/$SCREEN_NAME/${SCREEN_NAME}_screen.dart"

claude --continue "Extract the Riverpod provider code" > "mobile/lib/features/$SCREEN_NAME/providers/${SCREEN_NAME}_provider.dart"

claude --continue "Extract the widget tests" > "mobile/test/features/$SCREEN_NAME/${SCREEN_NAME}_screen_test.dart"

echo "✅ Flutter screen generated: $SCREEN_NAME"
```

### 2. Widget Component Creation
```bash
# create-widget.sh [widget-name] [purpose]

WIDGET_NAME=$1
PURPOSE=$2

if [[ -z "$WIDGET_NAME" || -z "$PURPOSE" ]]; then
    echo "Usage: ./create-widget.sh <widget-name> <purpose>"
    exit 1
fi

echo "🎨 Creating Flutter widget: $WIDGET_NAME"

claude -p "Create a reusable Flutter widget for the receipt app:

Widget: $WIDGET_NAME
Purpose: $PURPOSE

Requirements:
1. Reusable and configurable
2. Follows app design system
3. Responsive design for different screen sizes
4. Proper accessibility implementation
5. Includes comprehensive documentation
6. Widget tests with different scenarios
7. Handles error states gracefully
8. Optimized for performance

Include:
1. Widget implementation
2. Configuration properties
3. Usage examples
4. Widget tests
5. Documentation" > "widget-$WIDGET_NAME.dart"

echo "🎨 Widget created: $WIDGET_NAME"
```

### 3. State Management Enhancement
```bash
# enhance-provider.sh [provider-name]

PROVIDER_NAME=$1
if [[ -z "$PROVIDER_NAME" ]]; then
    echo "Usage: ./enhance-provider.sh <provider-name>"
    exit 1
fi

echo "🔄 Enhancing Riverpod provider: $PROVIDER_NAME"

claude -p "Analyze and enhance the $PROVIDER_NAME Riverpod provider in the receipt app:

Current provider analysis:
1. Review current implementation
2. Identify state management issues
3. Check for proper error handling
4. Verify loading state management
5. Check for memory leaks
6. Assess performance implications

Enhancements to implement:
1. Improved error handling with specific error types
2. Better loading state management
3. Caching strategies for better performance
4. Proper disposal of resources
5. Enhanced state persistence if needed
6. Better testing capabilities

Provide the enhanced provider code with explanations." > "enhanced-provider-$PROVIDER_NAME.dart"

echo "🔄 Provider enhancement complete: $PROVIDER_NAME"
```

## 🧪 Testing Workflows

### 1. Comprehensive Test Generation
```bash
# generate-tests.sh [component-type] [component-name]

COMPONENT_TYPE=$1  # backend, mobile, integration
COMPONENT_NAME=$2

if [[ -z "$COMPONENT_TYPE" || -z "$COMPONENT_NAME" ]]; then
    echo "Usage: ./generate-tests.sh <backend|mobile|integration> <component-name>"
    exit 1
fi

echo "🧪 Generating tests for $COMPONENT_TYPE: $COMPONENT_NAME"

case $COMPONENT_TYPE in
    "backend")
        claude -p "Generate comprehensive Jest tests for the backend component: $COMPONENT_NAME

        Include:
        1. Unit tests for all public methods
        2. Integration tests for API endpoints
        3. Error handling test cases
        4. Performance tests for critical paths
        5. Security tests for authentication/authorization
        6. Mock implementations for external dependencies
        7. Database interaction tests
        8. File upload/processing tests (for receipt features)

        Follow the existing test patterns in the receipt app." > "backend-tests-$COMPONENT_NAME.js"
        ;;
    
    "mobile")
        claude -p "Generate comprehensive Flutter tests for: $COMPONENT_NAME

        Include:
        1. Widget tests for UI components
        2. Unit tests for business logic
        3. Provider tests for state management
        4. Integration tests for user flows
        5. Golden tests for visual regression
        6. Performance tests for heavy operations
        7. Accessibility tests
        8. Mock implementations for API calls

        Use the testing patterns established in the receipt app." > "mobile-tests-$COMPONENT_NAME.dart"
        ;;
    
    "integration")
        claude -p "Generate end-to-end integration tests for: $COMPONENT_NAME

        Include:
        1. Complete user journey tests
        2. API integration tests
        3. Database consistency tests
        4. File processing pipeline tests
        5. Error recovery tests
        6. Performance under load tests
        7. Security integration tests
        8. Cross-platform compatibility tests

        Cover the full receipt processing workflow." > "integration-tests-$COMPONENT_NAME.spec.js"
        ;;
esac

echo "✅ Tests generated for $COMPONENT_TYPE: $COMPONENT_NAME"
```

### 2. Test Coverage Analysis
```bash
# test-coverage-analysis.sh

echo "📊 Analyzing test coverage for receipt app..."

# Backend coverage
cd backend
npm test -- --coverage --json --outputFile=coverage-report.json

# Mobile coverage
cd ../mobile
flutter test --coverage

# AI analysis of coverage
claude -p "Analyze the test coverage reports for the receipt app:

Backend coverage: $(cat backend/coverage-report.json)
Mobile coverage: Available in mobile/coverage/lcov.info

Provide analysis on:
1. Current coverage percentages
2. Areas with low coverage that need attention
3. Critical paths that must be tested
4. Test quality assessment
5. Recommendations for improving coverage
6. Specific test cases that should be added
7. Performance impact of additional tests

Focus on receipt processing, file uploads, and authentication flows." > "coverage-analysis-$(date +%Y%m%d).md"

echo "📊 Coverage analysis complete. Check the markdown file for detailed report."
```

## 🔄 DevOps and Deployment Workflows

### 1. Automated Deployment Preparation
```bash
# prepare-deployment.sh [environment]

ENVIRONMENT=$1
if [[ -z "$ENVIRONMENT" ]]; then
    echo "Usage: ./prepare-deployment.sh <staging|production>"
    exit 1
fi

echo "🚀 Preparing deployment for: $ENVIRONMENT"

claude -p "Prepare the receipt app for deployment to $ENVIRONMENT:

Pre-deployment checklist:
1. Run all tests (backend and mobile)
2. Check code quality and linting
3. Verify environment configuration
4. Test database migrations
5. Check security configurations
6. Verify API documentation is up to date
7. Test build processes
8. Validate performance benchmarks
9. Check monitoring and logging setup
10. Verify backup procedures

Generate:
1. Deployment checklist
2. Environment-specific configuration
3. Rollback procedures
4. Health check scripts
5. Post-deployment verification steps" > "deployment-prep-$ENVIRONMENT-$(date +%Y%m%d).md"

echo "📋 Deployment preparation complete for: $ENVIRONMENT"
```

### 2. Performance Monitoring Setup
```bash
# setup-monitoring.sh

echo "📈 Setting up performance monitoring for receipt app..."

claude -p "Set up comprehensive performance monitoring for the receipt app:

Backend monitoring:
1. API response time tracking
2. Database query performance
3. Memory usage monitoring
4. Error rate tracking
5. File processing performance
6. Authentication performance

Mobile monitoring:
1. App startup time
2. Screen rendering performance
3. Memory usage tracking
4. Network request performance
5. Camera operation performance
6. Crash reporting

Infrastructure monitoring:
1. Docker container health
2. Database performance metrics
3. Redis cache performance
4. File storage metrics
5. Network performance

Provide:
1. Monitoring configuration files
2. Alert thresholds
3. Dashboard specifications
4. Performance baseline metrics
5. Troubleshooting runbooks" > "monitoring-setup-$(date +%Y%m%d).md"

echo "📈 Monitoring setup guide generated."
```

## 💡 Productivity Shortcuts

### 1. Daily Shortcuts
```bash
# Add to .bashrc/.zshrc

# Quick development commands
alias receipt-status="claude -p 'Check the overall health and status of the receipt app development environment'"
alias receipt-test-all="claude -p 'Run comprehensive tests for both backend and mobile with coverage reports'"
alias receipt-review="claude review --focus security,performance,maintainability"
alias receipt-docs="claude -p 'Update all documentation for recent changes in the receipt app'"

# Quick problem solving
alias receipt-debug="claude -p 'Help me debug the current issue in the receipt app'"
alias receipt-optimize="claude -p 'Analyze and suggest performance optimizations for the receipt app'"
alias receipt-security="claude -p 'Perform security audit of the receipt app'"

# Development workflow shortcuts
alias start-receipt-dev="./scripts/morning-setup.sh"
alias new-feature="./scripts/feature-workflow.sh"
alias fix-bug="./scripts/bug-investigation.sh"
```

### 2. Project Aliases
```bash
# Project-specific shortcuts
alias be-new-service="claude -p 'Create a new backend service following receipt app patterns'"
alias be-new-route="claude -p 'Create a new API route with validation and tests'"
alias mb-new-screen="./scripts/create-flutter-screen.sh"
alias mb-new-widget="./scripts/create-widget.sh"

# Quality assurance shortcuts
alias qa-backend="claude review backend/ --strict"
alias qa-mobile="claude review mobile/ --strict"
alias qa-security="claude -p 'Security audit focusing on receipt app vulnerabilities'"
alias qa-performance="claude -p 'Performance analysis and optimization recommendations'"
```

---

*These workflows transform Claude Code SDK into a powerful development partner specifically optimized for Receipt Vault development, dramatically accelerating your productivity while maintaining high code quality.*