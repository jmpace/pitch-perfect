# Testing Strategy

This document outlines the comprehensive testing approach for the Pitch Perfect application.

## 🎯 Post-Task Verification

**MANDATORY**: Run `npm run verify-task` before marking any task complete.

```bash
npm run verify-task
```

This command runs critical E2E tests that verify:
- ✅ React hydration works correctly
- ✅ User interactions respond properly  
- ✅ Tab functionality and state management
- ✅ JavaScript loads without errors
- ✅ Core user journeys work end-to-end

### When Verification Passes ✅
- Task can be marked complete
- Core functionality is confirmed working
- User experience is verified

### When Verification Fails ❌
- **DO NOT** mark task complete
- Fix issues before proceeding
- Test manually in browser to confirm problems

## 🧪 Testing Levels

### 1. E2E Tests (Critical)
**Purpose**: Verify real user experience in actual browser

```bash
# Run all E2E tests
npm run test:e2e

# Run with visual browser (debugging)
npm run test:e2e:headed

# Run specific test suites
npm run test:post-task  # Critical verification
npm run test:smoke      # Quick smoke tests
```

**When to use**: 
- Post-task verification (mandatory)
- Testing user interactions
- Verifying React hydration
- Browser compatibility checks

### 2. Unit Tests (Maintenance)
**Purpose**: Test isolated component logic

```bash
# Run unit tests
npm test

# Watch mode for development
npm run test:watch

# Fix failing unit tests
npm run test:fix
```

**When to use**:
- Testing pure functions
- Component logic verification
- Regression prevention
- Code coverage

### 3. Manual Testing
**Purpose**: Final verification of user experience

**When to use**:
- Complex user workflows
- Visual design verification
- Performance testing
- Edge case exploration

## 🔄 Testing Workflow

### During Development
1. Write unit tests for new components/functions
2. Test manually in browser during development
3. Run `npm run test:watch` for immediate feedback

### Before Task Completion
1. **MANDATORY**: Run `npm run verify-task`
2. If passes → Task can be marked complete
3. If fails → Fix issues, then re-run verification

### Maintenance
1. Run `npm run test:fix` to update broken unit tests
2. Run `npm run test:all` for comprehensive testing
3. Address unit test failures as separate maintenance tasks

## 🏗️ Test Architecture

### E2E Test Structure
```
__tests__/e2e/
├── core-functionality.e2e.test.js    # Critical user journeys
└── [feature].e2e.test.js            # Feature-specific tests
```

### Unit Test Structure  
```
__tests__/
├── components/                       # Component tests
├── lib/                             # Utility function tests
└── pages/                           # Page-level tests
```

## 📝 Writing Tests

### E2E Test Guidelines
- Focus on **user journeys** not implementation details
- Verify **React hydration** and **JavaScript loading**
- Test **real browser interactions** (clicks, form submission)
- Check for **console errors** and **hydration warnings**

### Unit Test Guidelines
- Test **component logic** and **pure functions**
- Use **React Testing Library** for component tests
- **Mock external dependencies**
- Focus on **behavior over implementation**

## 🚨 Common Issues

### Hydration Failures
**Symptoms**: Tabs don't work, buttons unresponsive, no React DevTools
**Solution**: Check for theme hydration mismatches, missing `suppressHydrationWarning`

### Test vs Reality Mismatch  
**Symptoms**: Tests pass but functionality broken in browser
**Solution**: Always run E2E verification, trust user feedback over unit tests

### Missing Event Listeners
**Symptoms**: Elements render but don't respond to clicks
**Solution**: Verify React properly hydrates, check for JavaScript errors

## 🎯 Key Principles

1. **User experience over test coverage**
2. **E2E verification is mandatory for task completion**
3. **Trust user feedback over test results**
4. **Fix critical functionality before marking tasks complete**
5. **Separate unit test maintenance from feature delivery**

## 📊 Test Commands Reference

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run verify-task` | **Critical post-task verification** | **Before every task completion** |
| `npm run test:e2e` | All E2E tests | Full verification |
| `npm run test:post-task` | Critical user journeys only | Quick verification |
| `npm test` | Unit tests | Development feedback |
| `npm run test:fix` | Fix broken unit tests | Maintenance |
| `npm run test:all` | Everything | Comprehensive testing |

## 🔧 Configuration

- **Playwright Config**: `playwright.config.js`
- **Jest Config**: `jest.config.js`  
- **Test Setup**: `jest.setup.js`
- **Verification Script**: `scripts/post-task-verification.js` 