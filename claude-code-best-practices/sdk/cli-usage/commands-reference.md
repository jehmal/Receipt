# Claude Code CLI Commands Reference

## 🎯 Overview
Complete reference for all Claude Code CLI commands, flags, and options with practical examples for Receipt Vault development.

## 📋 Core Commands

### Basic Usage
```bash
# Interactive mode (REPL)
claude

# One-shot query
claude -p "query"
claude --print "query"

# Continue previous conversation
claude --continue "additional context"

# Resume specific session
claude --resume session-id
```

### Configuration Commands
```bash
# Configure settings
claude config [subcommand]

# Update Claude Code
claude update

# Model Context Protocol
claude mcp [subcommand]

# Login/logout
claude login
claude logout
```

## 🔧 Command Flags and Options

### Essential Flags
| Flag | Short | Description | Example |
|------|-------|-------------|---------|
| `--print` | `-p` | One-shot mode, print and exit | `claude -p "create API endpoint"` |
| `--continue` | `-c` | Continue last conversation | `claude -c "add error handling"` |
| `--output-format` | `-f` | Output format (text/json/stream-json) | `claude -f json -p "generate code"` |
| `--verbose` | `-v` | Detailed logging | `claude -v -p "debug issue"` |
| `--model` | `-m` | Select AI model | `claude -m claude-haiku-3` |
| `--max-turns` | | Limit agentic turns | `claude --max-turns 5` |

### Tool Control Flags
| Flag | Description | Example |
|------|-------------|---------|
| `--allowed-tools` | Specify allowed tools | `claude --allowed-tools "Read,Write,Edit"` |
| `--disallowed-tools` | Specify disallowed tools | `claude --disallowed-tools "Bash(rm:*)"` |
| `--no-tools` | Disable all tools | `claude --no-tools -p "explain concept"` |

### Session Management
| Flag | Description | Example |
|------|-------------|---------|
| `--resume` | Resume specific session | `claude --resume abc123` |
| `--session-id` | Set custom session ID | `claude --session-id feature-dev` |
| `--no-memory` | Disable memory/context | `claude --no-memory` |

## 🎮 Interactive Slash Commands

### Essential Slash Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `/help` | Show help and available commands | `/help` |
| `/clear` | Clear conversation history | `/clear` |
| `/config` | Modify configuration | `/config set model claude-sonnet-4` |
| `/cost` | Show token usage and costs | `/cost` |
| `/memory` | Edit memory files | `/memory edit project-notes` |

### Development Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `/review` | Request code review | `/review backend/src/services/` |
| `/bug` | Report issues to Anthropic | `/bug "error with file uploads"` |
| `/vim` | Enter Vim editing mode | `/vim` |
| `/init` | Initialize project | `/init receipt-app` |

### Model and Session Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `/model` | Change AI model | `/model claude-haiku-3` |
| `/login` | Authenticate | `/login` |
| `/logout` | Sign out | `/logout` |

## 🚀 Practical Examples for Receipt Vault

### Backend Development
```bash
# API Development
claude -p "Create a Fastify route for uploading receipt images with file validation"

# Service Implementation
claude -p "Implement a receipt OCR service using Google Vision API with error handling"

# Database Operations
claude -p "Create a PostgreSQL migration to add receipt categories table"

# Testing
claude -p "Generate Jest tests for the receipt processing service with mocks"
```

### Mobile Development
```bash
# Widget Creation
claude -p "Create a Flutter widget for displaying receipt cards with Riverpod state management"

# Camera Integration
claude -p "Implement camera screen with custom overlay for receipt capture"

# State Management
claude -p "Create Riverpod providers for receipt list with pagination and filtering"

# Navigation
claude -p "Set up navigation routes for receipt app with proper parameter passing"
```

### DevOps and Infrastructure
```bash
# Docker Optimization
claude -p "Optimize the Docker configuration for the receipt app backend"

# Database Management
claude -p "Create database backup and restore scripts for PostgreSQL"

# CI/CD Enhancement
claude -p "Improve GitHub Actions workflow for testing and deployment"

# Monitoring Setup
claude -p "Set up logging and monitoring for the receipt processing pipeline"
```

### Code Quality and Maintenance
```bash
# Code Review
claude review backend/src/services/ --focus security,performance

# Refactoring
claude -p "Refactor the receipt service to use dependency injection pattern"

# Documentation
claude -p "Generate API documentation for all receipt-related endpoints"

# Performance Analysis
claude -p "Analyze the receipt upload performance and suggest optimizations"
```

## 📊 Output Formats

### Text Output (Default)
```bash
claude -p "Create a simple function"
# Returns: formatted text response
```

### JSON Output (Programmatic)
```bash
claude -f json -p "Create a function"
# Returns: structured JSON with metadata
{
  "result": "function code here...",
  "metadata": {
    "model": "claude-sonnet-4",
    "tokens": 150,
    "cost_usd": 0.003,
    "duration_ms": 1200
  }
}
```

### Streaming JSON Output
```bash
claude -f stream-json -p "Create complex feature"
# Returns: streaming JSON for real-time processing
```

## 🔄 Workflow Examples

### Feature Development Workflow
```bash
# 1. Explore existing implementation
claude -p "Analyze the current receipt upload implementation"

# 2. Plan the feature
claude --continue "Create a plan for adding receipt categorization"

# 3. Implement backend
claude --continue "Implement the categorization service"

# 4. Implement mobile
claude --continue "Create the mobile UI for category selection"

# 5. Add tests
claude --continue "Generate comprehensive tests"

# 6. Review and commit
claude review . --auto-fix
claude -p "Generate commit message for this feature"
```

### Bug Fix Workflow
```bash
# 1. Reproduce the issue
claude -p "Help me debug why receipt uploads are failing intermittently"

# 2. Analyze root cause
claude --continue "Analyze the logs and identify the root cause"

# 3. Implement fix
claude --continue "Implement a fix for this issue"

# 4. Add regression tests
claude --continue "Add tests to prevent this bug from recurring"
```

### Code Review Workflow
```bash
# Review specific files
claude review backend/src/controllers/receipts.ts

# Review entire feature
claude review --path "backend/src/services/receipt*" --focus security

# Interactive review session
claude
> /review mobile/lib/features/camera/
> Focus on performance and error handling
> Suggest improvements for better user experience
```

## 🔧 Advanced Usage Patterns

### Chaining Commands
```bash
# Sequential operations
claude -p "Create service" && claude --continue "add tests" && claude --continue "add docs"

# Conditional execution
claude -p "run tests" && echo "Tests passed" || echo "Tests failed"
```

### Scripted Usage
```bash
#!/bin/bash
# ai-dev-helper.sh

# Function to generate code with Claude
generate_code() {
    local description="$1"
    local output_file="$2"
    
    claude -f json -p "$description" | jq -r '.result' > "$output_file"
    echo "Generated code saved to $output_file"
}

# Usage
generate_code "Create receipt validation service" "receipt-validator.ts"
```

### Environment-Specific Usage
```bash
# Development environment
export CLAUDE_MODEL="claude-sonnet-4"
export CLAUDE_VERBOSE="true"

# Production scripts (faster model)
export CLAUDE_MODEL="claude-haiku-3"
export CLAUDE_MAX_TURNS="3"
```

### Parallel Processing
```bash
# Background tasks
claude -p "Generate backend tests" &
claude -p "Generate mobile tests" &
claude -p "Update documentation" &
wait
echo "All tasks completed"
```

## 🎯 Receipt Vault Specific Commands

### Daily Development Commands
```bash
# Start development session
alias start-dev="claude -p 'Start receipt app development session'"

# Quick code review
alias quick-review="claude review --changed-files --focus bugs,security"

# Generate tests for changes
alias test-gen="claude -p 'Generate tests for recently changed files'"

# Update docs
alias doc-update="claude -p 'Update documentation for recent changes'"
```

### Project Shortcuts
```bash
# Backend shortcuts
alias be-service="claude -p 'Create new backend service with standard patterns'"
alias be-route="claude -p 'Create new Fastify route with validation'"
alias be-test="claude -p 'Generate backend tests with proper mocking'"

# Mobile shortcuts  
alias mb-screen="claude -p 'Create new Flutter screen with Riverpod integration'"
alias mb-widget="claude -p 'Create reusable Flutter widget following our design system'"
alias mb-provider="claude -p 'Create Riverpod provider with proper error handling'"

# Infrastructure shortcuts
alias infra-docker="claude -p 'Optimize Docker configuration for receipt app'"
alias infra-db="claude -p 'Create database migration for new feature'"
```

### Quality Assurance Commands
```bash
# Comprehensive review
claude review . \
  --focus security,performance,maintainability \
  --exclude node_modules,build,dist \
  --output-format github

# Security audit
claude -p "Perform security audit of receipt app focusing on file uploads and authentication"

# Performance analysis
claude -p "Analyze receipt app performance and suggest optimizations"
```

## 📈 Measuring Usage and Performance

### Token Usage Tracking
```bash
# Check current usage
claude /cost

# Track usage over time
claude -f json -p "simple query" | jq '.metadata.cost_usd'
```

### Performance Monitoring
```bash
# Time command execution
time claude -p "complex analysis task"

# Monitor with verbose output
claude --verbose -p "task" 2>&1 | grep -E "(time|memory|tokens)"
```

### Session Management
```bash
# List active sessions
claude config get sessions

# Clean up old sessions
claude config cleanup-sessions --older-than 7d
```

---

*Master these CLI commands to unlock the full potential of Claude Code for your Receipt Vault development workflow.*