# Custom Slash Commands for Claude Code

## 🎯 Overview
Recommended slash commands and custom shortcuts to streamline development workflow with Claude Code.

## 🚀 Built-in Slash Commands

### Essential Commands:
- `/help` - Show available commands and usage
- `/clear` - Clear conversation context (maintain focus)
- `/think` - Enable detailed reasoning for complex problems
- `/model` - Switch between Claude models
- `/allowed-tools` - Configure tool permissions

### Memory Management:
- `/memory` - View current memory and context
- `/forget [topic]` - Remove specific information from memory
- `/remember [info]` - Add important information to memory

## 🔧 Workflow Shortcuts

### Development Workflow Commands:
```
/explore [component]
- Explore codebase to understand [component] implementation
- Search related files and patterns
- Analyze architecture and dependencies
- Provide summary of current state

/plan [feature]
- Create comprehensive implementation plan using TodoWrite
- Break down complex features into manageable tasks
- Identify dependencies and prerequisites
- Estimate effort and timeline

/implement [task]
- Follow explore-plan-code workflow
- Implement with proper testing
- Follow existing code patterns
- Update documentation

/test [component]
- Write comprehensive tests for [component]
- Include unit, integration, and E2E tests
- Follow TDD best practices
- Ensure proper test coverage

/review [files]
- Code review focusing on quality and best practices
- Check for security issues and performance problems
- Suggest improvements and optimizations
- Verify adherence to coding standards

/deploy [service]
- Prepare [service] for deployment
- Run all tests and quality checks
- Create deployment artifacts
- Generate deployment documentation
```

### Project-Specific Commands:
```
/backend-dev
- Start backend development environment
- Run: npm run dev, docker-compose up -d
- Check service health and connections
- Display relevant logs

/mobile-dev  
- Start mobile development environment
- Run: flutter run on connected device
- Watch for file changes and hot reload
- Display build status and errors

/full-stack-test
- Run complete test suite for both backend and mobile
- Backend: npm test, npm run lint
- Mobile: flutter test, flutter analyze
- Report test coverage and results

/db-reset
- Reset development database to clean state
- Run: npm run db:migrate, npm run db:seed
- Verify database connectivity
- Load sample data for development

/commit-ready
- Check if code is ready for commit
- Run all tests and linting
- Verify no uncommitted dependencies
- Suggest commit message following conventions
```

## 🎨 UI/UX Development Commands:
```
/visual-compare [target-image]
- Compare current UI implementation to target design
- Identify specific visual differences
- Prioritize improvements needed
- Generate implementation tasks

/ui-iterate [component]
- Follow visual iteration workflow
- Take screenshot of current state
- Compare with design target
- Implement refinements step by step

/responsive-test [component]
- Test [component] across different screen sizes
- Verify mobile, tablet, and desktop layouts
- Check accessibility and usability
- Report issues and suggestions

/design-system-check
- Verify component follows design system
- Check colors, typography, spacing, and patterns
- Ensure consistency with existing components
- Suggest improvements for better cohesion
```

## 🐛 Debugging and Troubleshooting Commands:
```
/debug [issue]
- Systematic debugging approach for [issue]
- Gather relevant logs and error information
- Analyze potential root causes
- Propose and test solutions

/performance-check [component]
- Analyze performance of [component]
- Check for memory leaks and bottlenecks
- Suggest optimizations
- Benchmark before and after improvements

/security-audit [area]
- Security audit of [area] (auth, API, data handling)
- Check for common vulnerabilities
- Verify input validation and sanitization
- Suggest security improvements

/error-trace [error]
- Trace error through the system
- Identify root cause and impact
- Suggest fixes and prevention measures
- Update error handling if needed
```

## 📚 Documentation and Learning Commands:
```
/explain [concept]
- Explain [concept] in context of our project
- Show examples from our codebase
- Compare with alternatives and best practices
- Suggest further learning resources

/document [feature]
- Generate documentation for [feature]
- Include API docs, user guides, and technical details
- Create examples and usage scenarios
- Update existing documentation

/architecture-overview
- Provide high-level architecture overview
- Explain component relationships and data flow
- Identify key design decisions and trade-offs
- Suggest potential improvements

/onboarding-guide
- Create step-by-step onboarding guide for new developers
- Include environment setup and first contribution
- Explain project structure and conventions
- Provide learning path and resources
```

## 🔍 Search and Analysis Commands:
```
/find-pattern [pattern]
- Search for [pattern] across the codebase
- Show usage examples and context
- Identify potential issues or improvements
- Suggest refactoring opportunities

/dependency-check
- Analyze project dependencies
- Check for security vulnerabilities
- Identify outdated packages
- Suggest updates and alternatives

/code-quality [area]
- Analyze code quality in [area]
- Check complexity, maintainability, and test coverage
- Identify technical debt
- Suggest refactoring priorities

/api-consistency
- Check API consistency across endpoints
- Verify naming conventions and patterns
- Identify inconsistencies and suggest improvements
- Generate API documentation
```

## 🔄 Custom Workflow Aliases:

### Quick Development Cycles:
```
/quick-feature [name]
= /explore + /plan + /implement + /test + /commit-ready

/bug-fix [issue]  
= /debug + /implement + /test + /review + /commit-ready

/ui-polish [component]
= /visual-compare + /ui-iterate + /responsive-test + /commit-ready

/refactor [component]
= /explore + /plan + /implement + /test + /review + /commit-ready
```

### Environment Management:
```
/dev-setup
= /backend-dev + /mobile-dev + /db-reset + check all services

/clean-restart
= Stop all services + /clear + /dev-setup + verify environment

/deploy-prep [env]
= /full-stack-test + /security-audit + /performance-check + /document
```

## 📖 Usage Examples:

### Starting a New Feature:
```
User: /explore user authentication
Claude: [Analyzes current auth implementation, identifies patterns]

User: /plan add password reset functionality  
Claude: [Creates detailed TodoWrite plan with tasks and dependencies]

User: /implement password reset backend API
Claude: [Implements API following existing patterns with tests]

User: /visual-compare password-reset-mockup.png
Claude: [Compares implementation to design, suggests improvements]

User: /commit-ready
Claude: [Runs tests, suggests commit message, ready for PR]
```

### Debugging a Problem:
```
User: /debug mobile app crashing on receipt upload
Claude: [Systematic debugging, analyzes logs, identifies root cause]

User: /performance-check image processing service
Claude: [Analyzes performance, suggests optimizations]

User: /security-audit file upload handling
Claude: [Reviews security, suggests improvements]
```

### Code Review:
```
User: /review backend/src/services/receipts.ts
Claude: [Comprehensive code review with specific suggestions]

User: /code-quality mobile/lib/features/camera/
Claude: [Analyzes code quality, suggests refactoring]

User: /api-consistency
Claude: [Reviews all APIs for consistency, suggests improvements]
```

## 💡 Pro Tips:

### Combining Commands:
- Chain commands with `+` for complex workflows
- Use `/clear` between major context switches
- Save common command combinations as aliases

### Context Management:
- Use `/remember` for important project decisions
- Use `/forget` to remove outdated information
- Use `/memory` to check current context before complex tasks

### Efficiency Tricks:
- Create project-specific command shortcuts
- Use `/think` for complex architectural decisions
- Combine with file uploads for visual comparisons

---

*Custom slash commands transform Claude Code into a powerful, personalized development assistant*