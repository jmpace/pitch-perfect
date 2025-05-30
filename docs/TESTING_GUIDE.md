# Testing Guide

## Overview

This guide covers the testing strategy, implementation, and best practices for the Pitch Perfect file storage system. The testing framework is built using Jest with TypeScript support.

## Test Structure

```
__tests__/
├── lib/
│   ├── validation.test.ts       # ✅ File validation tests (19 tests)
│   └── blob-manager.test.ts     # 🔄 BlobManager unit tests (in progress)
├── api/
│   └── [future integration tests]
├── integration/
│   └── [future end-to-end tests]
└── utils/
    └── [testing utilities]
```

## Current Test Coverage

### ✅ Validation Tests (Complete - 19 tests)

**Location**: `__tests__/lib/validation.test.ts`

**Coverage Areas**:
- **File Type Validation**: Tests for all supported video formats (`video/mp4`, `video/mov`, `video/webm`, `video/quicktime`)
- **File Size Validation**: Boundary testing for 1KB minimum and 100MB maximum limits
- **Error Scenarios**: Invalid file types, oversized/undersized files, missing files
- **Edge Cases**: Uppercase extensions, special characters, multiple dots in filenames
- **Error Context**: Proper error property names and request ID tracking

**Key Test Examples**:
```typescript
// File type validation
test('should validate a valid video file', () => {
  const validFile = createMockFile('test.mp4', 5 * 1024, 'video/mp4');
  expect(() => validateFile(validFile, 'req-123')).not.toThrow();
});

// File size boundaries
test('should validate boundary file sizes', () => {
  const minFile = createMockFile('min.mp4', 1024, 'video/mp4'); // exactly 1KB
  const maxFile = createMockFile('max.mp4', 100 * 1024 * 1024, 'video/mp4'); // exactly 100MB
  const overMaxFile = createMockFile('over.mp4', 100 * 1024 * 1024 + 1, 'video/mp4'); // over limit
  
  expect(() => validateFile(minFile, 'req-123')).not.toThrow();
  expect(() => validateFile(maxFile, 'req-123')).not.toThrow();
  expect(() => validateFile(overMaxFile, 'req-123')).toThrow(FileSizeError);
});

// Error context validation
test('should include request ID in error contexts', () => {
  const invalidFile = createMockFile('test.txt', 5 * 1024, 'text/plain');
  try {
    validateFile(invalidFile, 'req-123');
  } catch (error: any) {
    expect(error.requestId).toBe('req-123');
    expect(error.details.receivedType).toBe('text/plain');
  }
});
```

### 🔄 BlobManager Tests (In Progress)

**Location**: `__tests__/lib/blob-manager.test.ts`

**Current Status**: Basic structure tests implemented
**Challenges**: ES modules compatibility with Vercel Blob SDK

**Test Strategy**:
- **Method Existence**: Verify all static methods exist
- **Error Handling**: Test missing token scenarios  
- **Request ID Generation**: Verify unique ID generation

## Testing Configuration

### Jest Configuration (`jest.config.js`)

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-node',
  collectCoverageFrom: [
    'lib/**/*.{js,jsx,ts,tsx}',
    'app/api/**/*.{js,jsx,ts,tsx}',
    '!lib/**/*.d.ts',
  ],
  testMatch: [
    '<rootDir>/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(nanoid|@vercel/blob)/)'
  ],
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
}

module.exports = createJestConfig(customJestConfig)
```

### Test Setup (`jest.setup.js`)

```javascript
import { TextEncoder, TextDecoder } from 'util';

// Global utilities
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock environment variables
process.env.BLOB_READ_WRITE_TOKEN = 'test-token-12345';
process.env.NODE_ENV = 'test';

// Mock fetch for API testing
global.fetch = jest.fn();

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
```

## Running Tests

### Command Reference

```bash
# Run all tests
npm test

# Run specific test file
npm test validation.test.ts

# Run tests in watch mode (development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests for CI/CD
npm run test:ci
```

### Test Scripts (`package.json`)

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --watchAll=false"
  }
}
```

## Testing Best Practices

### 1. Test File Organization

```typescript
// Test file structure
describe('ComponentName', () => {
  // Setup and teardown
  beforeEach(() => {
    // Reset state
  });

  describe('method name', () => {
    test('should handle success case', () => {
      // Test implementation
    });

    test('should handle error case', () => {
      // Test implementation
    });
  });
});
```

### 2. Mock File Creation

```typescript
// Helper function for creating mock files
function createMockFile(name: string, size: number, type: string): File {
  const file = new File([''], name, { type });
  
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false
  });
  
  return file;
}
```

### 3. Error Testing Patterns

```typescript
// Testing error scenarios
test('should throw specific error type', () => {
  expect(() => {
    functionThatShouldThrow();
  }).toThrow(SpecificErrorType);
});

// Testing error details
test('should include error context', () => {
  try {
    functionThatShouldThrow();
    fail('Should have thrown an error');
  } catch (error: any) {
    expect(error.requestId).toBeDefined();
    expect(error.details).toMatchObject({
      expectedProperty: 'expectedValue'
    });
  }
});
```

### 4. Async Testing

```typescript
// Testing async functions
test('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toMatchObject({
    success: true
  });
});

// Testing async errors
test('should handle async errors', async () => {
  await expect(asyncFunctionThatFails())
    .rejects
    .toThrow('Expected error message');
});
```

## Known Testing Challenges

### 1. ES Modules Compatibility

**Issue**: Vercel Blob SDK and nanoid use ES modules, causing Jest parsing errors.

**Current Solution**: 
- Updated `transformIgnorePatterns` in Jest config
- Added ES module support with `extensionsToTreatAsEsm`

**Future Improvement**: 
- Consider switching to Vitest for better ES module support
- Implement proper SDK mocking

### 2. Next.js App Router Testing

**Issue**: Testing App Router API endpoints requires complex setup.

**Current Approach**: 
- Focus on unit testing individual components
- Use simplified integration tests

**Future Enhancement**: 
- Implement proper Next.js API testing utilities
- Add end-to-end testing with Playwright or Cypress

### 3. Complex Type Mocking

**Issue**: Vercel Blob SDK has complex TypeScript interfaces.

**Current Solution**: 
- Simplified mocking approach
- Focus on behavior testing rather than implementation details

## Test Coverage Goals

### Current Coverage
- **Validation**: 100% (19/19 tests passing)
- **Error Handling**: Partial coverage through validation tests
- **BlobManager**: Basic structure tests only
- **API Endpoints**: Not yet implemented
- **Integration**: Not yet implemented

### Target Coverage
- **Unit Tests**: 90% statement coverage
- **Integration Tests**: Core workflows covered
- **End-to-End Tests**: Critical user paths
- **Error Scenarios**: All error types and edge cases

## Future Testing Roadmap

### Phase 1: Complete Unit Testing
- [ ] Finish BlobManager testing with proper mocking
- [ ] Add FileTracker unit tests
- [ ] Add CleanupService unit tests
- [ ] Add error handler unit tests

### Phase 2: Integration Testing
- [ ] API endpoint testing with supertest or similar
- [ ] Complete workflow testing (upload → track → cleanup)
- [ ] Error scenario integration testing

### Phase 3: End-to-End Testing
- [ ] Browser-based testing with Playwright
- [ ] File upload workflows
- [ ] Error handling in UI
- [ ] Performance testing

### Phase 4: Advanced Testing
- [ ] Load testing for concurrent uploads
- [ ] Stress testing for cleanup operations
- [ ] Security testing for file validation
- [ ] Cross-browser compatibility testing

## Continuous Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm run test:ci
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

### Quality Gates

Recommended thresholds for CI/CD:
- **Statement Coverage**: > 80%
- **Branch Coverage**: > 75%
- **Function Coverage**: > 85%
- **Line Coverage**: > 80%

## Debugging Tests

### Common Debug Commands

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test with debug info
npm test -- --testNamePattern="specific test name"

# Debug Jest configuration
npm test -- --showConfig

# Run tests with Node.js debugging
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Debugging Tips

1. **Use `console.log`** strategically in tests for debugging
2. **Check mock setup** - ensure mocks are configured correctly
3. **Verify file paths** - ensure test files can find imports
4. **Check environment variables** - ensure test env is set up correctly

## Contributing Test Guidelines

### Before Writing Tests

1. **Understand the component** you're testing
2. **Identify edge cases** and error scenarios
3. **Plan test structure** using describe/test blocks
4. **Write tests first** (TDD) when possible

### Test Requirements

1. **Descriptive test names** that explain what's being tested
2. **Single responsibility** - one assertion per test when possible
3. **Proper cleanup** - reset state between tests
4. **Error testing** - test both success and failure paths
5. **Documentation** - comment complex test scenarios

### Code Review Checklist

- [ ] Tests cover both success and error scenarios
- [ ] Test names clearly describe the behavior being tested
- [ ] Mocks are properly configured and reset
- [ ] No hardcoded values that should be configurable
- [ ] Tests are independent and can run in any order
- [ ] Performance considerations for long-running tests

## Resources

- **Jest Documentation**: [jestjs.io](https://jestjs.io/)
- **Testing Library**: [testing-library.com](https://testing-library.com/)
- **Next.js Testing**: [nextjs.org/docs/testing](https://nextjs.org/docs/testing)
- **TypeScript Testing**: [typescript-eslint.io/docs/](https://typescript-eslint.io/docs/)

## Support

For testing-related questions:
1. Check this guide first
2. Review existing test implementations
3. Check Jest/Next.js documentation
4. Create an issue with test failures and error messages 