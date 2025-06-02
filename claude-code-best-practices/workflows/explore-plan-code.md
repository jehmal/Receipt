# Explore-Plan-Code-Commit Workflow

## 🎯 Overview
The recommended workflow for developing features with Claude Code, ensuring thorough understanding before implementation.

## 📋 Workflow Steps

### 1. 🔍 EXPLORE Phase
**Goal**: Understand the current codebase and requirements

#### Actions:
- [ ] Read relevant files to understand current implementation
- [ ] Use Grep/Glob to find related code patterns
- [ ] Check package.json/pubspec.yaml for dependencies
- [ ] Review existing tests and documentation
- [ ] Understand the data flow and architecture

#### Claude Prompts:
```
"First, let me explore the codebase to understand how [feature area] is currently implemented"

"Help me understand the current architecture for [specific component]"

"Search for existing patterns related to [functionality] in the codebase"
```

#### Example Commands:
```bash
# Find existing implementations
rg "auth" --type ts
glob "**/*user*.ts"
grep "database" --include="*.ts"

# Understand dependencies
Read backend/package.json
Read mobile/pubspec.yaml
```

### 2. 📝 PLAN Phase  
**Goal**: Create a detailed implementation plan

#### Actions:
- [ ] Use TodoWrite to create comprehensive task list
- [ ] Break down complex features into smaller tasks
- [ ] Identify dependencies and prerequisites
- [ ] Plan testing strategy
- [ ] Consider error handling and edge cases

#### Claude Prompts:
```
"Create a detailed implementation plan for [feature] using TodoWrite"

"Break down this complex feature into smaller, manageable tasks"

"What are the dependencies and prerequisites for implementing [feature]?"
```

#### Planning Template:
```markdown
## Feature: [Feature Name]

### Requirements:
- [ ] Requirement 1
- [ ] Requirement 2

### Implementation Tasks:
- [ ] Backend API changes
- [ ] Mobile UI components  
- [ ] Database migrations
- [ ] Testing implementation
- [ ] Documentation updates

### Dependencies:
- Depends on: [other features/APIs]
- Blocks: [features that depend on this]

### Testing Strategy:
- Unit tests for [components]
- Integration tests for [workflows]
- Manual testing scenarios
```

### 3. 💻 CODE Phase
**Goal**: Implement the solution incrementally

#### Actions:
- [ ] Start with backend/API changes
- [ ] Implement mobile components
- [ ] Add proper error handling
- [ ] Write tests as you go
- [ ] Update TodoWrite progress regularly

#### Claude Prompts:
```
"Let's start implementing [first task] from our plan"

"Implement proper error handling for [component]"

"Write tests for the [functionality] we just implemented"
```

#### Best Practices:
- Implement one todo item at a time
- Mark todos as in_progress → completed
- Test each component before moving to next
- Use MultiEdit for related file changes
- Follow existing code patterns

### 4. ✅ COMMIT Phase
**Goal**: Create meaningful commits and documentation

#### Actions:
- [ ] Run all tests and linting
- [ ] Create descriptive commit messages
- [ ] Update documentation if needed
- [ ] Create pull request with proper description
- [ ] Mark all todos as completed

#### Claude Prompts:
```
"Run the test suite and fix any failing tests"

"Create a commit for the implemented [feature] with proper commit message"

"Create a pull request description summarizing the changes"
```

#### Commit Message Format:
```
feat(scope): add [feature description]

- Implement [specific changes]
- Add tests for [functionality]
- Update documentation for [component]

🤖 Generated with Claude Code
```

## 🚀 Advanced Workflow Variations

### For Bug Fixes:
1. **Explore**: Reproduce the bug and understand root cause
2. **Plan**: Identify fix approach and test strategy  
3. **Code**: Implement minimal fix with tests
4. **Commit**: Create focused commit with bug reference

### For Refactoring:
1. **Explore**: Understand current implementation thoroughly
2. **Plan**: Design new structure and migration strategy
3. **Code**: Refactor incrementally with tests at each step
4. **Commit**: Multiple small commits showing progression

### For New Features:
1. **Explore**: Research similar implementations and patterns
2. **Plan**: Design API/interface first, then implementation
3. **Code**: Start with tests, then implement to pass tests
4. **Commit**: Separate commits for API, implementation, tests

## 🎯 Success Metrics

### Exploration Success:
- [ ] Can explain current implementation
- [ ] Identified all relevant files/components
- [ ] Understand data flow and dependencies
- [ ] Found existing patterns to follow

### Planning Success:
- [ ] Created comprehensive todo list
- [ ] Estimated effort accurately
- [ ] Identified all dependencies
- [ ] Clear testing strategy

### Coding Success:
- [ ] All tests pass
- [ ] Code follows project patterns
- [ ] Proper error handling implemented
- [ ] Documentation updated

### Commit Success:
- [ ] Clear, descriptive commit messages
- [ ] Logical commit boundaries
- [ ] All todos marked complete
- [ ] PR ready for review

## 🔧 Tools for Each Phase

### Explore Tools:
- `Read` - Read specific files
- `Grep` - Search for patterns
- `Glob` - Find files by pattern
- `LS` - Explore directory structure
- `Task` - Delegate complex searches

### Plan Tools:
- `TodoWrite` - Create task lists
- `TodoRead` - Review progress
- `Write` - Create planning documents

### Code Tools:
- `Edit` - Single file changes
- `MultiEdit` - Multiple file changes
- `Bash` - Run tests/builds
- `NotebookEdit` - For Jupyter notebooks

### Commit Tools:
- `Bash(git add:*)` - Stage changes
- `Bash(git commit:*)` - Create commits
- `Bash(gh:*)` - GitHub operations

---

*Follow this workflow for consistent, high-quality development with Claude Code*