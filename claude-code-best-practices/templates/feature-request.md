# Feature Request Template

## 📋 Feature Overview

**Feature Name:** [Brief descriptive name]

**Priority:** [High/Medium/Low]

**Estimated Effort:** [Small/Medium/Large]

**Target Release:** [Version or date]

## 🎯 Problem Statement

**Current Situation:**
[Describe what users currently experience]

**Pain Points:**
- [ ] Issue 1
- [ ] Issue 2  
- [ ] Issue 3

**User Impact:**
[Who is affected and how]

## 🚀 Proposed Solution

**High-Level Description:**
[What we want to build and why]

**Key Functionality:**
- [ ] Feature component 1
- [ ] Feature component 2
- [ ] Feature component 3

**User Flow:**
1. User does X
2. System responds with Y
3. User sees Z
4. Process completes

## 🏗️ Technical Requirements

### Backend Changes
- [ ] New API endpoints:
  - `GET /api/[endpoint]` - [description]
  - `POST /api/[endpoint]` - [description]
- [ ] Database changes:
  - [ ] New tables: [table_name]
  - [ ] Schema modifications: [existing_table]
- [ ] New services/modules:
  - [ ] [ServiceName] - [purpose]
- [ ] External integrations:
  - [ ] [Service] - [why needed]

### Mobile Changes  
- [ ] New screens:
  - [ ] [ScreenName] - [purpose]
- [ ] Widget modifications:
  - [ ] [WidgetName] - [changes needed]
- [ ] State management:
  - [ ] New providers: [ProviderName]
  - [ ] Updated providers: [ExistingProvider]
- [ ] Navigation changes:
  - [ ] [RouteChanges]

### Infrastructure Changes
- [ ] Environment variables: [NEW_VAR]
- [ ] Dependencies: [package@version]
- [ ] Configuration updates: [config_file]
- [ ] Docker changes: [service modifications]

## 🎨 User Interface Design

**Wireframes/Mockups:**
[Attach images or link to design files]

**Design Requirements:**
- [ ] Follow existing design system
- [ ] Responsive layout
- [ ] Accessibility compliance
- [ ] Dark mode support
- [ ] Loading states
- [ ] Error states
- [ ] Empty states

**Interaction Design:**
- [ ] Gestures: [swipe, tap, long-press]
- [ ] Animations: [list of animations]
- [ ] Feedback: [visual/haptic/audio]

## 🧪 Testing Requirements

### Test Scenarios
- [ ] **Happy Path:** [main user flow works correctly]
- [ ] **Error Handling:** [what happens when things go wrong]
- [ ] **Edge Cases:** [boundary conditions, unusual inputs]
- [ ] **Performance:** [load testing, large datasets]
- [ ] **Security:** [authentication, authorization, data validation]

### Test Types Needed
- [ ] **Unit Tests:** [services, utilities, pure functions]
- [ ] **Widget Tests:** [UI components, user interactions]
- [ ] **Integration Tests:** [API endpoints, database operations]
- [ ] **E2E Tests:** [complete user workflows]

### Test Data Requirements
- [ ] Mock data: [type and quantity]
- [ ] Test accounts: [user roles needed]
- [ ] Test environments: [staging, dev requirements]

## 📊 Success Metrics

**Functional Metrics:**
- [ ] Feature completion rate: [X% users complete flow]
- [ ] Error rate: [< X% failures]
- [ ] Performance: [response time < Xms]

**User Experience Metrics:**
- [ ] User adoption: [X% of users try feature]
- [ ] User retention: [X% continue using]
- [ ] User satisfaction: [rating/feedback score]

**Technical Metrics:**
- [ ] Code coverage: [X% for new code]
- [ ] Performance impact: [no degradation]
- [ ] Bug rate: [< X bugs per week]

## 🔄 Implementation Plan

### Phase 1: Foundation (Week 1)
- [ ] Database schema design and migration
- [ ] Core backend services
- [ ] Basic API endpoints
- [ ] Unit tests for business logic

### Phase 2: Integration (Week 2)  
- [ ] Mobile state management setup
- [ ] API integration in mobile
- [ ] Basic UI implementation
- [ ] Integration tests

### Phase 3: Polish (Week 3)
- [ ] UI/UX refinements
- [ ] Error handling and edge cases
- [ ] Performance optimization
- [ ] E2E testing

### Phase 4: Launch (Week 4)
- [ ] Final testing and bug fixes
- [ ] Documentation updates
- [ ] Deployment preparation
- [ ] Feature flag setup

## 📚 Documentation Requirements

- [ ] **API Documentation:** [endpoint descriptions, examples]
- [ ] **User Guide:** [how to use the feature]
- [ ] **Technical Documentation:** [architecture decisions]
- [ ] **Troubleshooting Guide:** [common issues and solutions]

## 🚨 Risks and Considerations

**Technical Risks:**
- [ ] [Risk 1]: [mitigation strategy]
- [ ] [Risk 2]: [mitigation strategy]

**Product Risks:**
- [ ] [Risk 1]: [mitigation strategy]
- [ ] [Risk 2]: [mitigation strategy]

**Dependencies:**
- [ ] [External service/team]: [what we need]
- [ ] [Infrastructure]: [requirements]

## 🔍 Acceptance Criteria

**Must Have:**
- [ ] [Critical requirement 1]
- [ ] [Critical requirement 2]
- [ ] [Critical requirement 3]

**Should Have:**
- [ ] [Important but not critical 1]
- [ ] [Important but not critical 2]

**Nice to Have:**
- [ ] [Enhancement 1]
- [ ] [Enhancement 2]

## 📝 Claude Code Prompts

### Exploration Phase:
```
"Please explore the current [related area] implementation to understand how to best integrate [feature name]. Look at:
1. Existing [relevant services/components]
2. Current [data models/API patterns]  
3. Similar features we've already built
4. Potential integration points"
```

### Implementation Phase:
```
"Let's implement [feature name] following our established patterns:
1. Start with backend API design and database changes
2. Implement core business logic with tests
3. Build mobile UI components with state management
4. Add comprehensive error handling
5. Write integration and E2E tests"
```

### Testing Phase:
```
"Create comprehensive tests for [feature name]:
1. Unit tests for all business logic
2. Widget tests for mobile components  
3. API integration tests
4. E2E test for the complete user flow
5. Performance and edge case testing"
```

---

**Template Usage:**
1. Copy this template for each new feature
2. Fill in all sections before starting development
3. Use the Claude prompts to guide implementation
4. Update progress as development proceeds
5. Review completion against acceptance criteria