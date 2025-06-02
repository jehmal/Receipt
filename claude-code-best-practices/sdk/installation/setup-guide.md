# Claude Code SDK Setup Guide

## 🚀 Quick Setup for Receipt Vault Project

### Prerequisites Checklist
- [ ] Node.js 18+ installed
- [ ] Flutter 3.16+ installed  
- [ ] Git configured
- [ ] Docker and Docker Compose available
- [ ] Anthropic API account

## 📦 Installation Methods

### Method 1: NPM Global Install (Recommended)
```bash
# Install globally
npm install -g claude-code

# Verify installation
claude --version
```

### Method 2: Direct Download
```bash
# macOS/Linux
curl -sSL https://claude.ai/install.sh | sh

# Windows (PowerShell)
iwr -useb https://claude.ai/install.ps1 | iex
```

### Method 3: Package Managers
```bash
# macOS (Homebrew)
brew install claude-code

# Windows (Chocolatey)
choco install claude-code

# Linux (Snap)
sudo snap install claude-code
```

## 🔐 Authentication Setup

### 1. Get API Key
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create new API key for Claude Code
3. Copy the key (starts with `sk-ant-`)

### 2. Configure Authentication
```bash
# Method 1: Environment variable (recommended)
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Method 2: Claude config command
claude config set api-key "sk-ant-your-key-here"

# Method 3: .env file in project root
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> .env
```

### 3. Verify Authentication
```bash
claude -p "Hello, test authentication"
# Should respond with Claude's greeting
```

## 🏗️ Project-Specific Configuration

### 1. Initialize Claude for Receipt Vault
```bash
# Navigate to your project
cd /path/to/receipt-vault

# Initialize Claude with project context
claude init --name "Receipt Vault" --type full-stack

# This creates .claude/ directory with project settings
```

### 2. Configure Tool Permissions
```bash
# Use your pre-configured allowed tools list
claude config set allowed-tools "$(cat claude-code-best-practices/configurations/allowed-tools-list.txt)"

# Or manually configure key tools
claude config set allowed-tools "Read,Write,Edit,MultiEdit,Glob,Grep,LS,Bash(npm:*),Bash(flutter:*),Bash(docker:*),Bash(git:*)"
```

### 3. Set Project Context
```bash
# Configure project structure understanding
claude config set project-structure '{
  "backend": "backend/",
  "mobile": "mobile/", 
  "database": "database/",
  "docs": "docs/",
  "scripts": "scripts/"
}'

# Set tech stack information
claude config set tech-stack '{
  "backend": ["nodejs", "typescript", "fastify"],
  "mobile": ["flutter", "dart", "riverpod"],
  "database": ["postgresql", "redis"],
  "infrastructure": ["docker", "minio", "elasticsearch"]
}'
```

## ⚙️ Advanced Configuration

### 1. Custom Settings File
Create `.claude/config.json`:
```json
{
  "project_name": "Receipt Vault",
  "model": "claude-sonnet-4",
  "max_turns": 10,
  "auto_save": true,
  "preferred_tools": [
    "Read", "Write", "Edit", "MultiEdit", 
    "Bash(npm:*)", "Bash(flutter:*)", "Bash(git:*)"
  ],
  "project_patterns": {
    "backend_service_pattern": "backend/src/services/*.ts",
    "mobile_screen_pattern": "mobile/lib/features/*/screens/*.dart",
    "test_pattern": "**/*.test.{ts,dart}"
  },
  "code_style": {
    "typescript": {
      "semicolons": true,
      "quotes": "single",
      "trailing_comma": "es5"
    },
    "dart": {
      "line_length": 80,
      "prefer_const": true
    }
  }
}
```

### 2. Environment-Specific Configs
```bash
# Development environment
claude config set environment development
claude config set auto-tests true
claude config set verbose-logging true

# Production environment (for deployment scripts)
claude config set environment production
claude config set safety-checks strict
claude config set auto-backup true
```

### 3. Team Configuration
```bash
# Set team preferences (shared via git)
claude config set team-settings '{
  "code_review_required": true,
  "test_coverage_minimum": 80,
  "documentation_required": true,
  "commit_message_format": "conventional"
}'
```

## 🔧 Integration with Development Tools

### 1. IDE Integration
```bash
# VS Code settings (.vscode/settings.json)
{
  "claude.enabled": true,
  "claude.autoComplete": true,
  "claude.inlineEdits": true
}

# Install VS Code extension
code --install-extension anthropic.claude-code
```

### 2. Terminal Integration
```bash
# Bash/Zsh aliases (.bashrc/.zshrc)
alias c="claude"
alias cr="claude review"
alias ct="claude test"
alias cd="claude docs"

# Enhanced prompt with Claude context
export PS1='[\u@\h \W$(claude --status)]$ '
```

### 3. Git Integration
```bash
# Git hooks (.git/hooks/pre-commit)
#!/bin/bash
claude review --strict --exit-on-issues

# Git aliases (.gitconfig)
[alias]
    ai-review = !claude review --output-format=github
    ai-commit = !claude commit --generate-message
    ai-docs = !claude docs --update-changed
```

## 📊 Verification and Testing

### 1. Basic Functionality Test
```bash
# Test file operations
claude -p "Create a simple test file with hello world"

# Test project understanding
claude -p "Explain the structure of this receipt management app"

# Test tool permissions
claude -p "Run npm test in the backend directory"
```

### 2. Project-Specific Tests
```bash
# Test backend integration
claude -p "Analyze the receipt service and suggest improvements"

# Test mobile integration  
claude -p "Review the Flutter camera implementation"

# Test database operations
claude -p "Check if the database schema is properly indexed"
```

### 3. Performance Verification
```bash
# Measure response times
time claude -p "Generate a simple REST endpoint"

# Check memory usage
claude --verbose -p "Complex analysis task" 2>&1 | grep memory

# Verify API limits
claude config get rate-limits
```

## 🛠️ Customization for Receipt Vault

### 1. Project-Specific Shortcuts
```bash
# Add to .bashrc/.zshrc
alias receipt-dev="claude 'Start development environment for receipt app'"
alias receipt-test="claude 'Run full test suite for receipt app'"
alias receipt-deploy="claude 'Deploy receipt app to staging'"
alias receipt-review="claude review backend/ mobile/ --focus security,performance"
```

### 2. Custom System Prompts
Create `.claude/system-prompts.json`:
```json
{
  "receipt_expert": "You are an expert in receipt management systems. Focus on OCR accuracy, data extraction, mobile UX, and secure file handling.",
  "backend_expert": "You are a Node.js/TypeScript expert specializing in Fastify, PostgreSQL, and API security.",
  "mobile_expert": "You are a Flutter expert specializing in camera integration, state management with Riverpod, and cross-platform development."
}
```

### 3. Workflow Templates
Create `.claude/workflows/`:
```bash
# new-feature.yaml
name: "New Feature Development"
steps:
  - explore: "Understand existing implementation"
  - plan: "Create detailed implementation plan"  
  - implement: "Code the feature with tests"
  - review: "Quality and security review"
  - document: "Update documentation"

# bug-fix.yaml
name: "Bug Fix Workflow"
steps:
  - reproduce: "Reproduce the bug"
  - analyze: "Root cause analysis"
  - fix: "Implement minimal fix"
  - test: "Verify fix and add regression tests"
  - commit: "Create focused commit"
```

## 🔍 Troubleshooting Setup Issues

### Common Problems and Solutions

#### 1. Authentication Issues
```bash
# Check API key format
echo $ANTHROPIC_API_KEY | head -c 20
# Should start with "sk-ant-"

# Verify API access
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" https://api.anthropic.com/v1/models

# Reset authentication
claude logout && claude login
```

#### 2. Permission Issues
```bash
# Check current permissions
claude config get allowed-tools

# Reset to default safe permissions
claude config reset permissions

# Gradually add needed permissions
claude config add allowed-tools "Read,Write,Edit"
```

#### 3. Performance Issues
```bash
# Check system resources
claude --debug -p "Simple test"

# Reduce context size
claude config set max-context-files 10

# Use more efficient models
claude config set model claude-haiku-3
```

#### 4. Network Issues
```bash
# Test connectivity
curl -I https://api.anthropic.com

# Configure proxy if needed
claude config set proxy "http://proxy.company.com:8080"

# Check firewall settings
claude config get network-settings
```

## ✅ Setup Verification Checklist

### Basic Setup
- [ ] Claude Code installed and accessible via `claude` command
- [ ] Authentication configured with valid API key
- [ ] Basic "hello world" test works
- [ ] Tool permissions configured

### Project Integration  
- [ ] Project initialized with `.claude/` directory
- [ ] Tech stack configuration matches your project
- [ ] File patterns configured for backend and mobile
- [ ] Git integration working

### Advanced Features
- [ ] Custom shortcuts and aliases configured
- [ ] IDE integration installed and working
- [ ] Team settings configured (if applicable)
- [ ] Workflow templates created

### Performance and Security
- [ ] Response times acceptable (< 30 seconds for complex tasks)
- [ ] API rate limits understood and configured
- [ ] Security settings appropriate for your environment
- [ ] Backup and recovery procedures understood

---

*With Claude Code properly configured, you're ready to accelerate your Receipt Vault development with AI-powered assistance.*