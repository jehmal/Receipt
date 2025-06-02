# Claude Code SDK Troubleshooting Guide

## 🎯 Overview
Comprehensive troubleshooting guide for common issues encountered when using Claude Code SDK with the Receipt Vault project.

## 🔐 Authentication Issues

### Problem: "Authentication failed" or "Invalid API key"
**Symptoms:**
- `Error: Authentication failed` when running claude commands
- `Invalid API key format` messages
- Commands hanging without response

**Solutions:**
```bash
# 1. Verify API key format
echo $ANTHROPIC_API_KEY | head -c 20
# Should output: sk-ant-

# 2. Check API key validity
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.anthropic.com/v1/models

# 3. Reset authentication
unset ANTHROPIC_API_KEY
claude logout
claude login

# 4. Set API key explicitly
export ANTHROPIC_API_KEY="sk-ant-your-actual-key-here"

# 5. Verify in project directory
cd /path/to/receipt-vault
echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" > .env
```

### Problem: API key works in browser but not in CLI
**Symptoms:**
- Console.anthropic.com works fine
- CLI returns authentication errors

**Solutions:**
```bash
# 1. Check for special characters in key
echo "$ANTHROPIC_API_KEY" | od -c
# Look for extra newlines or spaces

# 2. Re-export without quotes
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# 3. Check shell environment
env | grep ANTHROPIC

# 4. Try different shell
bash -c "echo $ANTHROPIC_API_KEY"
zsh -c "echo $ANTHROPIC_API_KEY"
```

## 🛠️ Tool Permission Issues

### Problem: "Tool not allowed" errors
**Symptoms:**
- `Error: Tool 'Read' not allowed`
- `Permission denied for Bash commands`
- Tools work in interactive mode but not in scripts

**Solutions:**
```bash
# 1. Check current permissions
claude config get allowed-tools

# 2. Reset to safe defaults
claude config reset permissions

# 3. Add specific tools for receipt app
claude config set allowed-tools "Read,Write,Edit,MultiEdit,Glob,Grep,LS,TodoWrite,TodoRead,Bash(npm:*),Bash(flutter:*),Bash(git:*),Bash(docker:*)"

# 4. Use the provided configuration
cat claude-code-best-practices/configurations/allowed-tools-list.txt | claude config set allowed-tools

# 5. For scripts, specify tools explicitly
claude --allowed-tools "Read,Bash(npm:*)" -p "run backend tests"
```

### Problem: Bash commands not executing
**Symptoms:**
- `Bash tool not available`
- Commands hang indefinitely
- Permission errors for shell commands

**Solutions:**
```bash
# 1. Check bash permissions specifically
claude config get allowed-tools | grep -i bash

# 2. Add bash patterns incrementally
claude config add allowed-tools "Bash(ls:*)"
claude config add allowed-tools "Bash(npm:*)"
claude config add allowed-tools "Bash(git:*)"

# 3. Test with simple commands first
claude -p "Run 'ls' to list current directory files"

# 4. For Windows users, ensure proper bash access
where bash
# Should show path to bash executable

# 5. Use specific bash path if needed
claude --allowed-tools "Bash(/usr/bin/bash:*)" -p "test command"
```

## 🌐 Network and API Issues

### Problem: Slow response times or timeouts
**Symptoms:**
- Commands taking > 60 seconds
- Timeout errors
- Intermittent connection issues

**Solutions:**
```bash
# 1. Check network connectivity
ping api.anthropic.com
curl -I https://api.anthropic.com

# 2. Test with simpler model
claude config set model claude-haiku-3
claude -p "simple test"

# 3. Reduce context size
claude config set max-context-files 5
claude config set max-turns 3

# 4. Check for proxy issues
claude config get network-settings

# 5. Test in verbose mode
claude --verbose -p "test connectivity" 2>&1 | grep -E "(network|timeout|connection)"
```

### Problem: Rate limiting errors
**Symptoms:**
- `Rate limit exceeded` messages
- `Too many requests` errors
- Commands failing after working fine

**Solutions:**
```bash
# 1. Check current usage
claude config get rate-limits

# 2. Implement delays in scripts
sleep 2 && claude -p "command 1"
sleep 2 && claude -p "command 2"

# 3. Use batch processing
claude -p "Process multiple requests in one command instead of separate API calls"

# 4. Switch to more efficient model
claude config set model claude-haiku-3

# 5. Monitor usage
claude --verbose -p "test" 2>&1 | grep -i "rate\|limit\|quota"
```

## 🚀 Performance Issues

### Problem: High memory usage
**Symptoms:**
- System running out of memory
- Claude commands becoming slow over time
- Other applications affected

**Solutions:**
```bash
# 1. Clear conversation history
claude /clear

# 2. Limit context size
claude config set max-context-files 10
claude config set conversation-limit 20

# 3. Use one-shot mode more often
claude -p "query" # Instead of interactive mode

# 4. Monitor memory usage
claude --verbose -p "test" 2>&1 | grep -i memory

# 5. Restart Claude if needed
pkill claude
claude --version # Restart
```

### Problem: File operations are slow
**Symptoms:**
- Reading files takes a long time
- Large projects cause timeouts
- Memory errors with big codebases

**Solutions:**
```bash
# 1. Exclude unnecessary files
claude config set ignore-patterns "node_modules/**,dist/**,build/**,.git/**,coverage/**"

# 2. Focus on specific directories
claude --focus-path "backend/src/" -p "analyze only backend code"

# 3. Use file patterns efficiently
claude -p "Analyze only TypeScript files in services directory" # Instead of entire codebase

# 4. Break down large operations
claude -p "Analyze backend authentication logic only"
claude -p "Now analyze mobile authentication components"

# 5. Clear cache periodically
rm -rf ~/.claude/cache/*
```

## 📱 Receipt Vault Specific Issues

### Problem: Backend service analysis fails
**Symptoms:**
- Can't analyze Node.js/TypeScript code
- Module resolution errors
- Package.json not found errors

**Solutions:**
```bash
# 1. Ensure you're in the project root
cd /path/to/receipt-vault
pwd
ls -la # Should see backend/, mobile/, docker-compose.yml

# 2. Check backend structure
claude -p "List the contents of backend/src/ directory to understand the project structure"

# 3. Set project context explicitly
claude config set project-root "$(pwd)"
claude config set backend-path "backend/"

# 4. Verify Node.js project setup
cd backend
npm list --depth=0
npm run --silent

# 5. Use relative paths consistently
claude -p "Analyze ./backend/src/services/ directory structure"
```

### Problem: Flutter/Mobile analysis issues
**Symptoms:**
- Can't understand Flutter project structure
- Pubspec.yaml parsing errors
- Dart code analysis failures

**Solutions:**
```bash
# 1. Verify Flutter project
cd mobile
flutter doctor
flutter pub get

# 2. Check pubspec.yaml validity
flutter pub deps

# 3. Set mobile project context
claude config set mobile-path "mobile/"
claude config set flutter-version "3.16.0"

# 4. Analyze incrementally
claude -p "First, show me the mobile/lib/ directory structure"
claude --continue "Now analyze the main.dart file"
claude --continue "Explain the features/ directory organization"

# 5. Use Flutter-specific commands
claude -p "Run 'flutter analyze' to check the mobile code for issues"
```

### Problem: Database connection context missing
**Symptoms:**
- Can't understand database schema
- Migration suggestions are incorrect
- SQL queries don't match actual structure

**Solutions:**
```bash
# 1. Provide database context explicitly
claude -p "Here's the database schema from database/schema.sql. Please analyze the receipt-related tables and their relationships."

# 2. Check database connectivity
docker-compose ps # Ensure PostgreSQL is running
psql -h localhost -U postgres -d receipt_vault -c "\dt" # List tables

# 3. Set database context
claude config set database-type "postgresql"
claude config set schema-path "database/schema.sql"

# 4. Use specific database commands
claude -p "Connect to the receipt_vault database and show me the tables structure"

# 5. Provide sample data context
claude -p "Here's the database seed data to understand the data format: $(cat database/seed.sql | head -50)"
```

## 🔧 Configuration Issues

### Problem: Settings not persisting
**Symptoms:**
- Need to reconfigure tools every session
- Model preferences reset
- Project context lost

**Solutions:**
```bash
# 1. Check config file location
claude config get config-path

# 2. Verify write permissions
ls -la ~/.claude/
chmod 755 ~/.claude/
chmod 644 ~/.claude/config.json

# 3. Export and reimport configuration
claude config export > claude-backup.json
claude config import claude-backup.json

# 4. Set configuration globally
claude config set --global model claude-sonnet-4
claude config set --global allowed-tools "$(cat claude-code-best-practices/configurations/allowed-tools-list.txt)"

# 5. Use project-specific config
cd /path/to/receipt-vault
claude config set --local project-name "Receipt Vault"
```

### Problem: Model switching doesn't work
**Symptoms:**
- Model changes don't take effect
- Still using wrong model
- Model-specific features not working

**Solutions:**
```bash
# 1. Check available models
claude config get available-models

# 2. Set model explicitly for each command
claude --model claude-sonnet-4 -p "test with sonnet"
claude --model claude-haiku-3 -p "test with haiku"

# 3. Clear model cache
claude config unset model
claude config set model claude-sonnet-4

# 4. Verify model in use
claude --verbose -p "what model are you using?" 2>&1 | grep -i model

# 5. Use model-specific configurations
claude config set model-preferences '{
  "development": "claude-sonnet-4",
  "testing": "claude-haiku-3",
  "production": "claude-sonnet-4"
}'
```

## 🐛 Common Development Workflow Issues

### Problem: Code generation produces invalid code
**Symptoms:**
- Generated TypeScript doesn't compile
- Flutter code has syntax errors
- Missing imports or dependencies

**Solutions:**
```bash
# 1. Provide better context
claude -p "Generate code following the exact patterns used in backend/src/services/auth.ts"

# 2. Specify requirements explicitly
claude -p "Create a TypeScript service that:
1. Uses the same import patterns as existing services
2. Follows the error handling pattern from receipt.service.ts
3. Includes proper type definitions
4. Compiles without errors"

# 3. Validate generated code immediately
claude -p "Generate the service, then validate it compiles correctly"

# 4. Use incremental generation
claude -p "First show me just the interface definition"
claude --continue "Now implement the service class"
claude --continue "Add comprehensive error handling"

# 5. Review and fix iteratively
claude review generated-code.ts --fix-errors
```

### Problem: Tests fail after AI generation
**Symptoms:**
- Generated tests don't run
- Mock setup is incorrect
- Test environment issues

**Solutions:**
```bash
# 1. Provide test context
claude -p "Generate tests following the exact pattern from backend/test/services/auth.test.ts"

# 2. Include test setup requirements
claude -p "Create tests that work with our Jest configuration and include:
1. Proper mock setup for database
2. Test data that matches our schema
3. Cleanup after each test
4. Integration with our test utilities"

# 3. Run tests immediately after generation
claude -p "Generate the tests, then run them to verify they work"

# 4. Fix test issues incrementally
cd backend
npm test -- --testNamePattern="NewFeature" --verbose

# 5. Update test configuration if needed
claude -p "Review our Jest configuration and suggest improvements for the new tests"
```

## 📊 Debugging and Diagnostics

### Diagnostic Commands
```bash
# System diagnostics
claude --version
claude config get all
node --version
npm --version
flutter --version
docker --version

# Project diagnostics
cd /path/to/receipt-vault
ls -la
cat package.json | head -20
cat mobile/pubspec.yaml | head -20
docker-compose ps

# Network diagnostics
ping api.anthropic.com
curl -I https://api.anthropic.com
nslookup api.anthropic.com

# Performance diagnostics
time claude -p "simple test"
top -p $(pgrep claude)
df -h # Check disk space
```

### Creating Support Tickets
```bash
# Gather information for support
claude --verbose --debug -p "test command" > debug-output.txt 2>&1

# Include system information
uname -a >> debug-output.txt
claude config get all >> debug-output.txt
echo "Node: $(node --version)" >> debug-output.txt
echo "Flutter: $(flutter --version | head -1)" >> debug-output.txt

# Submit with context
echo "Issue description: [describe problem]
Environment: [development/production]
Project: Receipt Vault
Error: [specific error message]
Steps to reproduce: [numbered steps]
Expected behavior: [what should happen]
Actual behavior: [what actually happens]" > issue-report.txt
```

---

*This troubleshooting guide addresses the most common issues you'll encounter when integrating Claude Code SDK with your Receipt Vault development workflow. Keep this reference handy for quick problem resolution.*