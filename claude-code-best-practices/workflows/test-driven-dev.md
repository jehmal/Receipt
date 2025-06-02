# Test-Driven Development with Claude Code

## 🎯 Overview
Implement Test-Driven Development (TDD) using Claude Code for robust, reliable code development.

## 🔄 TDD Cycle: Red-Green-Refactor

### 1. 🔴 RED Phase - Write Failing Tests
**Goal**: Write tests that describe the desired behavior

#### Actions:
- [ ] Write test cases that fail initially
- [ ] Define expected behavior clearly
- [ ] Use TodoWrite to track test scenarios
- [ ] Ensure tests are comprehensive

#### Backend Testing (Jest + TypeScript):
```typescript
// Example: API endpoint test
describe('POST /api/receipts', () => {
  it('should create a new receipt with valid data', async () => {
    const receiptData = {
      title: 'Test Receipt',
      amount: 29.99,
      category: 'food',
      date: '2024-01-15'
    };

    const response = await request(app)
      .post('/api/receipts')
      .send(receiptData)
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      title: receiptData.title,
      amount: receiptData.amount
    });
  });

  it('should return 400 for invalid receipt data', async () => {
    const invalidData = { title: '' }; // Missing required fields

    await request(app)
      .post('/api/receipts')
      .send(invalidData)
      .expect(400);
  });
});
```

#### Mobile Testing (Flutter):
```dart
// Example: Widget test
void main() {
  group('ReceiptCard Widget', () {
    testWidgets('should display receipt information correctly', (tester) async {
      const receipt = Receipt(
        id: '123',
        title: 'Test Receipt',
        amount: 29.99,
        category: 'food',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ReceiptCard(receipt: receipt),
        ),
      );

      expect(find.text('Test Receipt'), findsOneWidget);
      expect(find.text('\$29.99'), findsOneWidget);
      expect(find.text('food'), findsOneWidget);
    });

    testWidgets('should handle tap events', (tester) async {
      bool tapped = false;
      const receipt = Receipt(id: '123', title: 'Test', amount: 10.0);

      await tester.pumpWidget(
        MaterialApp(
          home: ReceiptCard(
            receipt: receipt,
            onTap: () => tapped = true,
          ),
        ),
      );

      await tester.tap(find.byType(ReceiptCard));
      expect(tapped, isTrue);
    });
  });
}
```

#### Claude Prompts for RED Phase:
```
"Write comprehensive tests for [feature] that describe the expected behavior"

"Create failing tests for the [API endpoint/widget] we're about to implement"

"What edge cases should we test for [functionality]?"
```

### 2. 🟢 GREEN Phase - Make Tests Pass
**Goal**: Write minimal code to make tests pass

#### Actions:
- [ ] Implement just enough code to pass tests
- [ ] Don't optimize yet - focus on passing
- [ ] Run tests frequently
- [ ] Update TodoWrite progress

#### Implementation Strategy:
```typescript
// Start with minimal implementation
export class ReceiptService {
  async createReceipt(data: CreateReceiptData): Promise<Receipt> {
    // Minimal implementation to pass tests
    if (!data.title || !data.amount) {
      throw new ValidationError('Title and amount are required');
    }

    const receipt: Receipt = {
      id: generateId(),
      title: data.title,
      amount: data.amount,
      category: data.category || 'uncategorized',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.repository.save(receipt);
  }
}
```

#### Claude Prompts for GREEN Phase:
```
"Implement the minimal code needed to make these tests pass"

"Create the [service/component] that satisfies the test requirements"

"Run the tests and fix any remaining failures"
```

### 3. 🔵 REFACTOR Phase - Improve Code Quality
**Goal**: Optimize and clean up code while keeping tests green

#### Actions:
- [ ] Improve code structure and readability
- [ ] Extract reusable components
- [ ] Optimize performance if needed
- [ ] Ensure tests still pass after changes

#### Refactoring Examples:
```typescript
// Before refactoring (minimal implementation)
async createReceipt(data: CreateReceiptData): Promise<Receipt> {
  if (!data.title || !data.amount) {
    throw new ValidationError('Title and amount are required');
  }
  // ... rest of implementation
}

// After refactoring (improved validation)
async createReceipt(data: CreateReceiptData): Promise<Receipt> {
  await this.validateReceiptData(data);
  const receipt = this.buildReceiptEntity(data);
  return await this.repository.save(receipt);
}

private async validateReceiptData(data: CreateReceiptData): Promise<void> {
  const schema = Joi.object({
    title: Joi.string().required().min(1).max(255),
    amount: Joi.number().required().positive(),
    category: Joi.string().valid('food', 'transport', 'office', 'other'),
    date: Joi.date().iso()
  });

  const { error } = schema.validate(data);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }
}
```

#### Claude Prompts for REFACTOR Phase:
```
"Refactor this code to improve readability while keeping tests green"

"Extract reusable components from this implementation"

"Optimize this code for better performance"
```

## 🛠️ TDD Workflow Commands

### Backend TDD Commands:
```bash
# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- receipts.test.ts

# Run tests with coverage
npm test -- --coverage

# Lint and format
npm run lint:fix
npm run format
```

### Mobile TDD Commands:
```bash
# Run all tests
flutter test

# Run specific test file
flutter test test/widgets/receipt_card_test.dart

# Run tests in watch mode (with entr)
ls test/**/*.dart | entr flutter test

# Generate code coverage
flutter test --coverage
```

## 📋 TDD Checklist Template

### Before Starting:
- [ ] Understand requirements clearly
- [ ] Set up test environment
- [ ] Create TodoWrite list for test scenarios
- [ ] Identify test data needs

### For Each Feature:
- [ ] **RED**: Write failing test that describes behavior
- [ ] **RED**: Confirm test actually fails
- [ ] **GREEN**: Write minimal code to pass test
- [ ] **GREEN**: Confirm test passes
- [ ] **GREEN**: Run all tests to ensure no regressions
- [ ] **REFACTOR**: Improve code quality
- [ ] **REFACTOR**: Ensure tests still pass
- [ ] Mark todo item complete

### Integration Testing:
- [ ] Test API endpoints end-to-end
- [ ] Test mobile user flows
- [ ] Test error scenarios
- [ ] Test edge cases and boundary conditions

## 🎯 TDD Best Practices with Claude

### Test Naming:
```typescript
// Good test names describe behavior
describe('Receipt Creation Service', () => {
  it('should create receipt with valid data')
  it('should reject receipt with negative amount')
  it('should auto-categorize based on merchant name')
  it('should handle duplicate receipt detection')
})
```

### Test Organization:
```
tests/
├── unit/
│   ├── services/
│   ├── controllers/
│   └── utils/
├── integration/
│   ├── api/
│   └── database/
└── fixtures/
    ├── receipts.json
    └── users.json
```

### Mock Strategy:
```typescript
// Mock external dependencies
jest.mock('@google-cloud/vision', () => ({
  ImageAnnotatorClient: jest.fn().mockImplementation(() => ({
    textDetection: jest.fn().mockResolvedValue([{
      fullTextAnnotation: { text: 'Receipt text...' }
    }])
  }))
}));
```

## 🚀 Advanced TDD Techniques

### Property-Based Testing:
```typescript
import fc from 'fast-check';

it('should handle any valid receipt amount', () => {
  fc.assert(fc.property(fc.double(0.01, 10000), (amount) => {
    const receipt = createReceipt({ amount });
    expect(receipt.amount).toBe(amount);
  }));
});
```

### Mutation Testing:
```bash
# Install mutation testing
npm install --save-dev stryker-cli @stryker-mutator/core

# Run mutation tests
npx stryker run
```

### Contract Testing:
```typescript
// API contract tests
describe('Receipt API Contract', () => {
  it('should match OpenAPI specification', async () => {
    const response = await request(app)
      .get('/api/receipts/123')
      .expect(200);
    
    expect(response.body).toMatchSchema(receiptSchema);
  });
});
```

## 📊 TDD Metrics & Goals

### Code Coverage Targets:
- **Unit Tests**: 90%+ coverage
- **Integration Tests**: 80%+ critical paths
- **End-to-End Tests**: 100% happy paths

### Test Performance:
- **Unit Tests**: < 100ms each
- **Integration Tests**: < 5s each
- **Full Test Suite**: < 30s

### Quality Metrics:
- All tests must pass before commit
- No skipped tests in main branch
- Test-to-code ratio: 1:1 or higher

---

*TDD with Claude Code ensures robust, reliable software development*