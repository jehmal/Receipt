# MCP Server Integration with Claude Code

## 🎯 Overview
Your MCP servers are now configured and ready to use with Claude Code, providing extended capabilities for file management, database operations, design creation, and automation.

## ✅ Configured MCP Servers

### 1. Filesystem Server
**Purpose**: File and directory operations across your development environment
```json
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", 
    "/mnt/c/Users/jehma/Desktop",
    "/mnt/c/Users/jehma/Downloads", 
    "/mnt/c/Users/jehma/Desktop/AI/EmbeddingMarket/embedding-marketplace",
    "/mnt/c/Users/jehma/Desktop/AI/Pianobase"
  ]
}
```

**Capabilities:**
- Read/write files across your project directories
- Directory listing and navigation
- File search and pattern matching
- Cross-project file operations

### 2. Supabase Server
**Purpose**: Database operations and backend services
```json
{
  "command": "cmd",
  "args": ["/c", "npx", "-y", "@supabase/mcp-server-supabase@latest", 
    "--access-token", "sbp_c45e4f1f7d81f1cc874adb677f916018f8e32a61"]
}
```

**Capabilities:**
- Database queries and operations
- Real-time data synchronization
- Authentication management
- Storage operations

### 3. Context7 Server
**Purpose**: AI-powered context understanding and memory
```json
{
  "command": "npx",
  "args": ["-y", "@upstash/context7-mcp@latest"]
}
```

**Capabilities:**
- Enhanced context retention
- Intelligent memory management
- Cross-session context sharing
- Advanced reasoning capabilities

### 4. Canva Server
**Purpose**: Design and visual content creation
```json
{
  "command": "npx", 
  "args": ["-y", "@canva/cli@latest", "mcp"]
}
```

**Capabilities:**
- Create design templates
- Generate marketing materials
- UI mockup creation
- Brand asset management

### 5. Playwright Server
**Purpose**: Browser automation and testing
```json
{
  "command": "npx",
  "args": ["@playwright/mcp@0.0.20"]
}
```

**Capabilities:**
- Automated browser testing
- Web scraping and data extraction
- UI interaction simulation
- Performance testing

## 🚀 Usage Examples for Receipt Vault

### 1. Cross-Project File Operations
```bash
# Analyze files across multiple projects
claude -p "Compare the authentication patterns between the Receipt app and EmbeddingMarket projects using the filesystem MCP server"

# Copy common utilities
claude -p "Using filesystem MCP, copy useful utility functions from EmbeddingMarket to the Receipt project"

# Project structure analysis
claude -p "Analyze and compare the directory structures of all my AI projects"
```

### 2. Database Operations with Supabase
```bash
# Database schema analysis
claude -p "Use Supabase MCP to analyze our database schema and suggest optimizations for receipt storage"

# Data migration assistance
claude -p "Help migrate receipt data using Supabase MCP server with proper error handling"

# Real-time features
claude -p "Implement real-time receipt synchronization using Supabase MCP capabilities"
```

### 3. Enhanced Context with Context7
```bash
# Long-term project memory
claude -p "Remember the key architectural decisions we made for the Receipt app using Context7"

# Cross-session development
claude -p "Recall our previous discussion about receipt OCR optimization and continue improving it"

# Project knowledge retention
claude -p "Use Context7 to maintain context about our coding patterns and team preferences"
```

### 4. Design Creation with Canva
```bash
# UI mockup generation
claude -p "Create mobile app mockups for the receipt list screen using Canva MCP"

# Marketing materials
claude -p "Generate app store screenshots and promotional materials for Receipt Vault using Canva"

# Design system assets
claude -p "Create consistent design assets for the Receipt app brand using Canva MCP"
```

### 5. Automated Testing with Playwright
```bash
# E2E test automation
claude -p "Create Playwright tests for the receipt upload workflow using the MCP server"

# Performance testing
claude -p "Use Playwright MCP to test receipt app performance across different browsers"

# UI regression testing
claude -p "Set up automated visual regression tests for the mobile app using Playwright"
```

## 🔧 Advanced MCP Integration Workflows

### 1. Full-Stack Development Workflow
```bash
# Combined MCP workflow
claude -p "Using all available MCP servers:
1. Analyze Receipt app structure (filesystem)
2. Check database performance (Supabase) 
3. Create UI mockups for new features (Canva)
4. Set up automated tests (Playwright)
5. Maintain project context (Context7)"
```

### 2. Cross-Project Learning
```bash
# Learn from other projects
claude -p "Use filesystem MCP to analyze patterns from EmbeddingMarket that could improve the Receipt app architecture"

# Code reuse optimization
claude -p "Identify reusable components across all my AI projects using filesystem MCP"
```

### 3. Automated Quality Assurance
```bash
# Comprehensive testing pipeline
claude -p "Create a complete QA pipeline using:
- Filesystem MCP for code analysis
- Playwright MCP for automated testing
- Supabase MCP for database testing
- Context7 for maintaining test context"
```

## 📊 MCP Server Management

### Check Server Status
```bash
# List all configured servers
claude mcp list

# Get details about specific server
claude mcp get filesystem
claude mcp get supabase
```

### Test Server Connectivity
```bash
# Test each server individually
claude -p "Test filesystem MCP by listing Desktop files"
claude -p "Test Supabase MCP connection status"
claude -p "Test Canva MCP server capabilities"
claude -p "Test Playwright MCP server functionality"
claude -p "Test Context7 MCP memory features"
```

### Update Servers
```bash
# Remove and re-add if needed
claude mcp remove filesystem
claude mcp add-json filesystem '{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/updated/path"]}'
```

## 🛠️ Troubleshooting MCP Issues

### Common Problems and Solutions

#### 1. Permission Denied Errors
```bash
# Grant permissions when prompted
# MCP servers require explicit permission approval for security

# Check current permissions
claude config get mcp-permissions
```

#### 2. Server Connection Issues
```bash
# Verify NPX packages are accessible
npx -y @modelcontextprotocol/server-filesystem --help

# Check network connectivity for cloud-based MCPs
curl -I https://api.supabase.com
```

#### 3. Path Issues (Windows/WSL)
```bash
# Ensure paths are correctly formatted for your environment
# Windows: C:\\Users\\jehma\\Desktop
# WSL: /mnt/c/Users/jehma/Desktop
```

#### 4. Authentication Issues
```bash
# Verify Supabase token is valid
# Check Context7 configuration
# Ensure Canva CLI is properly authenticated
```

## 🎯 Best Practices for MCP Usage

### 1. Security Considerations
- Review and approve MCP permissions carefully
- Keep access tokens secure and rotated
- Limit MCP server access to necessary directories only
- Monitor MCP server logs for suspicious activity

### 2. Performance Optimization
- Use specific MCP servers for specific tasks
- Avoid unnecessary cross-server operations
- Cache frequently accessed data when possible
- Monitor resource usage of MCP servers

### 3. Development Workflow Integration
```bash
# Morning development setup with MCP
claude -p "Start development session using all MCP servers:
1. Check project status (filesystem)
2. Verify database health (Supabase)
3. Load previous context (Context7)
4. Prepare testing environment (Playwright)"

# End-of-day workflow
claude -p "End development session:
1. Save current context (Context7)
2. Backup important files (filesystem)
3. Update database if needed (Supabase)
4. Generate daily report (Canva)"
```

## 🚀 Power User Tips

### 1. MCP Server Chaining
```bash
# Chain operations across multiple MCP servers
claude -p "Create a complete feature using:
- Design mockup (Canva) → 
- Implementation (filesystem) → 
- Database changes (Supabase) → 
- Automated tests (Playwright) → 
- Document decisions (Context7)"
```

### 2. Context-Aware Development
```bash
# Leverage Context7 for intelligent development
claude -p "Based on our previous Context7 memories about Receipt app architecture, suggest the best approach for implementing receipt categorization"
```

### 3. Cross-Platform File Management
```bash
# Manage files across different environments
claude -p "Using filesystem MCP, synchronize configuration files between Receipt app and EmbeddingMarket projects"
```

---

**Your MCP servers are now fully integrated with Claude Code, providing unprecedented development capabilities for the Receipt Vault project and beyond!** 🚀

## Quick Test Commands

Try these to verify everything is working:

```bash
# Test filesystem
claude -p "List the contents of my Desktop using filesystem MCP"

# Test combined operations
claude -p "Using filesystem MCP, show me the structure of the Receipt app, then suggest database optimizations using Supabase MCP"
```