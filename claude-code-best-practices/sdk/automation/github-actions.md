# Claude Code GitHub Actions Integration

## 🎯 Overview
Comprehensive guide to integrating Claude Code SDK with GitHub Actions for automated workflows in your Receipt Vault project.

## 🚀 Basic GitHub Actions Setup

### 1. Authentication in GitHub Actions
Create repository secrets:
```yaml
# .github/workflows/secrets required
ANTHROPIC_API_KEY: "sk-ant-your-key-here"
```

### 2. Basic Claude Code Action
```yaml
# .github/workflows/claude-integration.yml
name: Claude Code Integration

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  claude-review:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Claude Code
      run: |
        npm install -g claude-code
        echo "ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }}" >> $GITHUB_ENV
    
    - name: Claude Code Review
      run: |
        claude review --output-format json > review-results.json
        
    - name: Upload Review Results
      uses: actions/upload-artifact@v4
      with:
        name: claude-review
        path: review-results.json
```

## 🔧 Advanced Workflows for Receipt Vault

### 1. Comprehensive AI-Powered CI/CD
```yaml
# .github/workflows/ai-powered-ci.yml
name: AI-Powered CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

jobs:
  # Job 1: AI Code Analysis
  ai-analysis:
    runs-on: ubuntu-latest
    outputs:
      has-backend-changes: ${{ steps.changes.outputs.backend }}
      has-mobile-changes: ${{ steps.changes.outputs.mobile }}
      has-security-issues: ${{ steps.security.outputs.issues }}
    
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    
    - name: Setup Claude Code
      run: |
        npm install -g claude-code
        claude config set allowed-tools "Read,Grep,Glob,Bash(git:*)"
    
    - name: Detect Changes
      id: changes
      run: |
        backend_changes=$(claude -f json -p "Check if there are changes in backend/ directory in this commit" | jq -r '.result' | grep -c "true" || echo "0")
        mobile_changes=$(claude -f json -p "Check if there are changes in mobile/ directory in this commit" | jq -r '.result' | grep -c "true" || echo "0")
        
        echo "backend=$([[ $backend_changes -gt 0 ]] && echo true || echo false)" >> $GITHUB_OUTPUT
        echo "mobile=$([[ $mobile_changes -gt 0 ]] && echo true || echo false)" >> $GITHUB_OUTPUT
    
    - name: Security Analysis
      id: security
      run: |
        claude -f json -p "Perform security analysis of changed files focusing on authentication, file uploads, and data validation" > security-analysis.json
        
        security_issues=$(jq -r '.result' security-analysis.json | grep -c "SECURITY ISSUE" || echo "0")
        echo "issues=$security_issues" >> $GITHUB_OUTPUT
        
        if [[ $security_issues -gt 0 ]]; then
          echo "🚨 Security issues detected!" >> $GITHUB_STEP_SUMMARY
          jq -r '.result' security-analysis.json >> $GITHUB_STEP_SUMMARY
        fi
    
    - name: Upload Security Analysis
      uses: actions/upload-artifact@v4
      with:
        name: security-analysis
        path: security-analysis.json

  # Job 2: Backend Testing with AI
  backend-ai-testing:
    runs-on: ubuntu-latest
    needs: ai-analysis
    if: needs.ai-analysis.outputs.has-backend-changes == 'true'
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: receipt_vault_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: backend/package-lock.json
    
    - name: Setup Claude Code
      run: |
        npm install -g claude-code
        claude config set allowed-tools "Read,Write,Edit,Bash(npm:*),Bash(git:*)"
    
    - name: Install Dependencies
      run: |
        cd backend
        npm ci
    
    - name: AI-Generated Test Enhancement
      run: |
        claude -p "Analyze the backend changes and generate additional tests for edge cases and error scenarios" > ai-test-suggestions.md
        
        # Generate missing tests
        claude -f json -p "Generate missing tests for recently changed backend services" | jq -r '.result' > additional-tests.js
        
        # Add to test suite if valid
        if [[ -s additional-tests.js ]] && node -c additional-tests.js 2>/dev/null; then
          mv additional-tests.js backend/test/ai-generated-tests.js
        fi
    
    - name: Run Tests with Coverage
      run: |
        cd backend
        npm test -- --coverage --json --outputFile=test-results.json
    
    - name: AI Test Analysis
      run: |
        claude -f json -p "Analyze test results and coverage. Suggest improvements for better testing." \
          --input-file backend/test-results.json > test-analysis.json
    
    - name: Comment on PR with Test Results
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v7
      with:
        script: |
          const fs = require('fs');
          const analysis = JSON.parse(fs.readFileSync('test-analysis.json', 'utf8'));
          
          const comment = `## 🤖 AI Test Analysis
          
          ${analysis.result}
          
          ### Test Coverage
          - View detailed coverage report in artifacts
          - AI-generated test suggestions available
          `;
          
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: comment
          });

  # Job 3: Mobile Testing with AI
  mobile-ai-testing:
    runs-on: ubuntu-latest
    needs: ai-analysis
    if: needs.ai-analysis.outputs.has-mobile-changes == 'true'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Flutter
      uses: subosito/flutter-action@v2
      with:
        flutter-version: '3.16.0'
    
    - name: Setup Claude Code
      run: |
        npm install -g claude-code
        claude config set allowed-tools "Read,Write,Edit,Bash(flutter:*),Bash(git:*)"
    
    - name: Get Flutter Dependencies
      run: |
        cd mobile
        flutter pub get
    
    - name: AI Widget Test Generation
      run: |
        claude -p "Analyze mobile changes and generate widget tests for new or modified screens and widgets" > widget-test-suggestions.md
        
        # Generate tests for new widgets
        claude -f json -p "Generate comprehensive widget tests for recently changed Flutter components" | jq -r '.result' > mobile/test/ai_generated_widget_test.dart
    
    - name: Run Flutter Tests
      run: |
        cd mobile
        flutter test --coverage --reporter json > test-results.json
    
    - name: AI Mobile Test Analysis
      run: |
        claude -f json -p "Analyze Flutter test results and suggest improvements for mobile testing strategy" \
          --input-file mobile/test-results.json > mobile-test-analysis.json
    
    - name: Upload Mobile Test Results
      uses: actions/upload-artifact@v4
      with:
        name: mobile-test-analysis
        path: mobile-test-analysis.json

  # Job 4: AI Code Quality Review
  ai-code-review:
    runs-on: ubuntu-latest
    needs: [ai-analysis, backend-ai-testing, mobile-ai-testing]
    if: always() && (needs.backend-ai-testing.result != 'failure' && needs.mobile-ai-testing.result != 'failure')
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Claude Code
      run: |
        npm install -g claude-code
        claude config set allowed-tools "Read,Grep,Glob,Bash(git:*)"
    
    - name: Comprehensive Code Review
      run: |
        # Review changed files
        git diff --name-only origin/main...HEAD > changed-files.txt
        
        claude -f json -p "Perform comprehensive code review focusing on:
        1. Code quality and maintainability
        2. Performance optimizations
        3. Security best practices  
        4. Receipt app specific improvements
        5. Architecture and design patterns
        
        Files to review: $(cat changed-files.txt)" > comprehensive-review.json
    
    - name: Generate Improvement Suggestions
      run: |
        claude -f json -p "Based on the code review, generate specific, actionable improvement suggestions with code examples" > improvement-suggestions.json
    
    - name: Create Review Summary
      run: |
        claude -p "Create a markdown summary of the code review findings suitable for a GitHub PR comment" > review-summary.md
    
    - name: Comment Code Review on PR
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v7
      with:
        script: |
          const fs = require('fs');
          const summary = fs.readFileSync('review-summary.md', 'utf8');
          
          const comment = `## 🤖 AI Code Review Summary
          
          ${summary}
          
          <details>
          <summary>📊 Detailed Analysis</summary>
          
          Full review analysis available in workflow artifacts.
          </details>
          `;
          
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: comment
          });
    
    - name: Upload Review Artifacts
      uses: actions/upload-artifact@v4
      with:
        name: ai-code-review
        path: |
          comprehensive-review.json
          improvement-suggestions.json
          review-summary.md

  # Job 5: AI Documentation Updates
  ai-documentation:
    runs-on: ubuntu-latest
    needs: ai-code-review
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Setup Claude Code
      run: |
        npm install -g claude-code
        claude config set allowed-tools "Read,Write,Edit,Bash(git:*)"
    
    - name: Update API Documentation
      run: |
        claude -p "Update API documentation based on recent backend changes. Ensure all endpoints are documented with examples." > api-docs-update.md
        
        # Update README if needed
        claude -p "Check if README.md needs updates based on recent changes and update accordingly"
    
    - name: Generate Changelog Entry
      run: |
        # Get commits since last tag
        last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
        if [[ -n "$last_tag" ]]; then
          commits=$(git log ${last_tag}..HEAD --oneline)
        else
          commits=$(git log --oneline -10)
        fi
        
        claude -p "Generate a changelog entry for these commits: $commits" > changelog-entry.md
    
    - name: Commit Documentation Updates
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        
        if [[ -n "$(git status --porcelain)" ]]; then
          git add .
          git commit -m "docs: AI-generated documentation updates
          
          🤖 Generated with Claude Code
          
          Co-authored-by: Claude <noreply@anthropic.com>"
          git push
        fi

  # Job 6: Security Check with Failure Handling
  security-gate:
    runs-on: ubuntu-latest
    needs: ai-analysis
    if: needs.ai-analysis.outputs.has-security-issues != '0'
    
    steps:
    - name: Security Issues Detected
      run: |
        echo "🚨 Security issues detected in code analysis!"
        echo "Review the security analysis artifact for details."
        exit 1
```

## 🤖 Specialized Receipt Vault Workflows

### 1. Receipt Processing Pipeline Testing
```yaml
# .github/workflows/receipt-processing-test.yml
name: Receipt Processing AI Testing

on:
  push:
    paths:
      - 'backend/src/services/ocr*'
      - 'backend/src/services/receipt*'
      - 'mobile/lib/features/camera/**'

jobs:
  test-receipt-pipeline:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Environment
      run: |
        npm install -g claude-code
        # Setup test receipt images
        mkdir -p test-receipts
        # Download sample receipts for testing
    
    - name: AI-Enhanced OCR Testing
      run: |
        claude -p "Generate comprehensive tests for receipt OCR processing including:
        1. Various receipt formats and qualities
        2. Error handling for corrupted images
        3. Performance testing with large images
        4. Accuracy validation against known receipts" > ocr-test-suite.js
    
    - name: Mobile Camera Integration Test
      run: |
        claude -p "Create integration tests for mobile camera to backend upload flow:
        1. Image capture simulation
        2. Upload with various network conditions
        3. Error handling and retry logic
        4. Progress reporting accuracy" > camera-integration-tests.dart
```

### 2. Performance Monitoring Workflow
```yaml
# .github/workflows/performance-monitoring.yml
name: AI Performance Monitoring

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  performance-analysis:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Claude Code
      run: |
        npm install -g claude-code
        claude config set allowed-tools "Read,Bash(*)"
    
    - name: Analyze Performance Trends
      run: |
        # Simulate performance data collection
        claude -p "Analyze recent performance metrics and identify:
        1. Performance degradation trends
        2. Resource usage optimization opportunities
        3. Bottlenecks in receipt processing pipeline
        4. Recommendations for performance improvements" > performance-report.md
    
    - name: Create Performance Issues
      run: |
        claude -p "If performance issues are identified, create GitHub issue templates with:
        1. Detailed problem description
        2. Steps to reproduce
        3. Performance impact assessment
        4. Suggested optimization approaches" > performance-issues.json
```

### 3. Dependency Security Workflow
```yaml
# .github/workflows/dependency-security.yml
name: AI Dependency Security Analysis

on:
  schedule:
    - cron: '0 6 * * 1'  # Weekly on Monday at 6 AM
  pull_request:
    paths:
      - 'backend/package*.json'
      - 'mobile/pubspec.yaml'

jobs:
  ai-security-audit:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Claude Code
      run: |
        npm install -g claude-code
        claude config set allowed-tools "Read,Bash(npm:*),Bash(flutter:*)"
    
    - name: Backend Security Audit
      run: |
        cd backend
        npm audit --json > audit-results.json
        
        claude -f json -p "Analyze npm audit results and prioritize security issues for receipt management app. Focus on file upload and authentication related vulnerabilities." \
          --input-file audit-results.json > security-priorities.json
    
    - name: Mobile Security Audit
      run: |
        cd mobile
        flutter pub deps --json > deps.json
        
        claude -f json -p "Analyze Flutter dependencies for security issues, particularly those related to camera, file handling, and network communication." \
          --input-file deps.json > mobile-security-analysis.json
    
    - name: Generate Security Report
      run: |
        claude -p "Create a comprehensive security report combining backend and mobile analysis with actionable recommendations" > security-report.md
    
    - name: Create Security Issues
      if: github.event_name == 'schedule'
      uses: actions/github-script@v7
      with:
        script: |
          const fs = require('fs');
          const report = fs.readFileSync('security-report.md', 'utf8');
          
          // Create issue if critical vulnerabilities found
          if (report.includes('CRITICAL') || report.includes('HIGH')) {
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🚨 Security Vulnerabilities Detected',
              body: `${report}\n\n🤖 Generated by AI Security Analysis`,
              labels: ['security', 'priority-high']
            });
          }
```

## 📊 AI Metrics and Reporting

### 1. Development Velocity Tracking
```yaml
# .github/workflows/ai-metrics.yml
name: AI Development Metrics

on:
  push:
    branches: [ main ]

jobs:
  track-metrics:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    
    - name: Setup Claude Code
      run: |
        npm install -g claude-code
        claude config set allowed-tools "Read,Bash(git:*)"
    
    - name: Analyze Development Velocity
      run: |
        # Get recent development activity
        git log --since="1 week ago" --pretty=format:"%h %s" > recent-commits.txt
        git diff --stat HEAD~7..HEAD > change-stats.txt
        
        claude -p "Analyze development velocity metrics:
        1. Commits: $(cat recent-commits.txt)
        2. Changes: $(cat change-stats.txt)
        
        Provide insights on:
        - Development velocity trends
        - Code quality indicators
        - Team productivity patterns
        - Recommendations for improvement" > velocity-analysis.md
    
    - name: Track AI Assistance Usage
      run: |
        # Count AI-generated commits
        ai_commits=$(git log --since="1 week ago" --grep="Claude Code" --oneline | wc -l)
        total_commits=$(git log --since="1 week ago" --oneline | wc -l)
        
        claude -p "Calculate AI assistance metrics:
        - AI-assisted commits: $ai_commits
        - Total commits: $total_commits
        - AI assistance ratio: $(echo "scale=2; $ai_commits/$total_commits*100" | bc)%
        
        Analyze the impact of AI assistance on development productivity." > ai-usage-metrics.md
```

## 🔧 Workflow Optimization Tips

### 1. Efficient Claude Code Usage in CI
```yaml
# Optimize for speed and cost
- name: Fast AI Analysis
  run: |
    # Use faster model for simple tasks
    claude config set model claude-haiku-3
    
    # Limit context for performance
    claude config set max-context-files 10
    
    # Cache Claude config
    claude config export > .claude-cache.json
```

### 2. Error Handling and Retries
```yaml
- name: AI Analysis with Retry
  run: |
    for i in {1..3}; do
      if claude -p "analyze code"; then
        break
      else
        echo "Attempt $i failed, retrying..."
        sleep 10
      fi
    done
```

### 3. Parallel AI Processing
```yaml
- name: Parallel AI Tasks
  run: |
    claude -p "backend analysis" > backend-analysis.md &
    claude -p "mobile analysis" > mobile-analysis.md &
    claude -p "security analysis" > security-analysis.md &
    wait
```

---

*GitHub Actions with Claude Code SDK enables automated, intelligent development workflows that continuously improve your Receipt Vault project quality and velocity.*