# Exception Handling Guide

This guide explains how to use the comprehensive exception handling system implemented across different application layers.

## Overview

The exception handling system provides:
- **Standardized error processing** across all application layers
- **Automatic error categorization and severity assessment**
- **User-friendly message generation**
- **Comprehensive error logging and monitoring**
- **Layer-specific context tracking**

## Architecture

### Application Layers
- **UI Layer**: React Error Boundaries and component error handling
- **API Layer**: Next.js route handlers with standardized responses
- **Business Logic Layer**: Service classes and domain operations
- **Data Access Layer**: Database and storage operations
- **External Service Layer**: Third-party API calls and integrations
- **Middleware Layer**: Authentication, validation, and request processing

## Usage Patterns

### 1. API Layer Exception Handling

#### Using the Wrapper Function
```typescript
// app/api/example/route.ts
import { withApiExceptionHandling } from '@/lib/errors/exception-handlers';
import { ValidationError } from '@/lib/errors/types';

async function handleGetExample(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  if (!id) {
    throw new ValidationError(
      'ID parameter is required',
      { field: 'id' }
    );
  }
  
  // Your business logic here...
  return NextResponse.json({ success: true, data: result });
}

// Export wrapped handler
export const GET = withApiExceptionHandling(handleGetExample);
```

#### Using the Decorator (TypeScript experimental)
```typescript
import { apiExceptionHandler } from '@/lib/errors/exception-handlers';

class ExampleAPIHandler {
  @apiExceptionHandler
  async GET(request: NextRequest): Promise<NextResponse> {
    // Your logic here...
  }
}
```

### 2. Business Logic Layer Exception Handling

#### Using Class Decorator
```typescript
import { BusinessLogicExceptionHandling } from '@/lib/errors/exception-handlers';
import { ValidationError, ProcessingError } from '@/lib/errors/types';

@BusinessLogicExceptionHandling
export class UserService {
  async createUser(userData: UserData): Promise<User> {
    // Validation errors will be automatically caught and processed
    if (!userData.email) {
      throw new ValidationError('Email is required', { field: 'email' });
    }
    
    // Business logic here...
    return user;
  }
}
```

#### Using Function Wrapper
```typescript
import { withBusinessLogicExceptionHandling } from '@/lib/errors/exception-handlers';

export async function processUserData(userData: UserData, requestId?: string) {
  const context = {
    requestId,
    component: 'UserService',
    operation: 'processUserData',
    metadata: { userId: userData.id }
  };

  return withBusinessLogicExceptionHandling(
    async () => {
      // Your business logic here...
      return result;
    },
    context
  )();
}
```

### 3. Data Access Layer Exception Handling

```typescript
import { withDataAccessExceptionHandling } from '@/lib/errors/exception-handlers';

export class UserRepository {
  async saveUser(user: User, requestId?: string): Promise<User> {
    const context = {
      requestId,
      component: 'UserRepository',
      operation: 'saveUser',
      metadata: { userId: user.id }
    };

    return withDataAccessExceptionHandling(
      async () => {
        // Database operations here...
        const result = await db.user.create({ data: user });
        return result;
      },
      context
    )();
  }
}
```

### 4. External Service Layer Exception Handling

```typescript
import { withExternalServiceExceptionHandling } from '@/lib/errors/exception-handlers';
import { ProcessingError } from '@/lib/errors/types';

export class OpenAIService {
  async generateCompletion(prompt: string, requestId?: string): Promise<string> {
    const context = {
      requestId,
      operation: 'generateCompletion',
      metadata: { promptLength: prompt.length }
    };

    return withExternalServiceExceptionHandling(
      async () => {
        const response = await fetch('https://api.openai.com/v1/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ model: 'gpt-3.5-turbo', prompt })
        });

        if (!response.ok) {
          throw new ProcessingError(
            'OpenAI API request failed',
            { 
              statusCode: response.status,
              statusText: response.statusText 
            }
          );
        }

        const data = await response.json();
        return data.choices[0].text;
      },
      'OpenAI',
      context
    )();
  }
}
```

### 5. UI Layer Exception Handling

#### Error Boundary Setup
```typescript
// app/layout.tsx
import ErrorBoundary from '@/components/error-boundary';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

#### Component-Specific Error Boundaries
```typescript
import { withErrorBoundary } from '@/components/error-boundary';

const RiskyComponent = () => {
  // Component that might throw errors
  return <div>Content</div>;
};

// Wrap with error boundary
export default withErrorBoundary(RiskyComponent, {
  fallback: CustomErrorFallback,
  onError: (error, errorInfo) => {
    console.log('Component error:', error);
  }
});
```

#### Using Error Handler Hook
```typescript
import { useErrorHandler } from '@/components/error-boundary';

export function MyComponent() {
  const handleError = useErrorHandler();
  
  const riskyOperation = async () => {
    try {
      // Risky operation
      await someAsyncOperation();
    } catch (error) {
      // Process error and get structured information
      const { processedError, errorId } = handleError(error as Error);
      
      // Show user-friendly error message
      toast.error(`Operation failed (${errorId})`);
    }
  };
  
  return <button onClick={riskyOperation}>Do Something Risky</button>;
}
```

### 6. Middleware Exception Handling

```typescript
import { withMiddlewareExceptionHandling } from '@/lib/errors/exception-handlers';

export async function authMiddleware(request: NextRequest): Promise<NextResponse> {
  const context = {
    operation: 'authenticate',
    metadata: {
      path: request.nextUrl.pathname,
      method: request.method
    }
  };

  return withMiddlewareExceptionHandling(
    async () => {
      const token = request.headers.get('authorization');
      
      if (!token) {
        throw new ValidationError('Authorization token required');
      }
      
      // Verify token logic...
      return NextResponse.next();
    },
    'AuthMiddleware',
    context
  )();
}
```

## Error Types

Use the appropriate error types for different scenarios:

```typescript
import { 
  ValidationError,
  ProcessingError,
  ConfigurationError,
  BlobAccessError 
} from '@/lib/errors/types';

// Input validation errors
throw new ValidationError('Invalid email format', { field: 'email' });

// Processing/business logic errors
throw new ProcessingError('Failed to process video', { jobId: '123' });

// Configuration/environment errors
throw new ConfigurationError('Missing API key', { key: 'OPENAI_API_KEY' });

// Storage/blob errors
throw new BlobAccessError('Failed to access file', { fileName: 'video.mp4' });
```

## Best Practices

### 1. Layer Separation
- Keep business logic errors separate from infrastructure concerns
- Use appropriate error types for each layer
- Maintain consistent error context across layers

### 2. Error Context
- Always provide relevant context in error details
- Include request IDs for tracking across layers
- Add metadata that helps with debugging

### 3. User Experience
- Throw specific errors with helpful messages
- Use the error categorization system for user-friendly messages
- Provide actionable recovery suggestions

### 4. Monitoring and Logging
- All errors are automatically logged with layer context
- Use request IDs to trace errors across layers
- Monitor error patterns and frequencies

## Integration with Existing Systems

### Error Categorization
The exception handling system integrates with the existing error categorization (subtask 10.1):
- Automatic error categorization based on error type and context
- Severity assessment based on status codes and categories
- Recovery strategy generation

### Message Templates
User-friendly messages are generated using the message template system (subtask 10.2):
- Context-aware message generation
- Multi-language support (when configured)
- Consistent tone and formatting

## Migration Guide

### Existing API Routes
1. Extract your current handler logic into a separate function
2. Wrap the exported handler with `withApiExceptionHandling`
3. Replace manual error responses with thrown error objects
4. Update error handling to use standardized error types

### Existing Services
1. Add the `@BusinessLogicExceptionHandling` decorator to service classes
2. Replace try-catch blocks with specific error throws
3. Use appropriate error types for different scenarios
4. Add context information to error details

### Existing Components
1. Wrap components with `ErrorBoundary` or `withErrorBoundary`
2. Use `useErrorHandler` hook for manual error processing
3. Replace alert/console.error with structured error handling

## Testing

### Unit Tests
```typescript
import { processException } from '@/lib/errors/exception-handlers';
import { ValidationError } from '@/lib/errors/types';

describe('Exception Handling', () => {
  it('should process validation errors correctly', () => {
    const error = new ValidationError('Test error', { field: 'test' });
    const context = {
      layer: ApplicationLayer.API,
      requestId: 'test-123',
      operation: 'testOperation'
    };
    
    const processed = processException(error, context);
    
    expect(processed.details.layer).toBe('api');
    expect(processed.details.operation).toBe('testOperation');
  });
});
```

### Integration Tests
```typescript
import { withApiExceptionHandling } from '@/lib/errors/exception-handlers';

describe('API Exception Handling', () => {
  it('should handle validation errors in API routes', async () => {
    const handler = withApiExceptionHandling(async (request) => {
      throw new ValidationError('Test validation error');
    });
    
    const request = new NextRequest('http://localhost/test');
    const response = await handler(request);
    
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

## Performance Considerations

- Exception handling adds minimal overhead to normal operations
- Error processing is optimized for production environments
- Logging can be configured based on environment (development vs production)
- Error categorization caching reduces repeated processing

## Security

- Sensitive information is automatically filtered from error details
- Stack traces are only included in development environments
- Request context is sanitized before logging
- Error IDs allow tracking without exposing internal details

## Troubleshooting

### Common Issues

1. **Missing Error Context**: Ensure you're providing adequate context when calling exception handlers
2. **Incorrect Error Types**: Use specific error types rather than generic Error objects
3. **Missing Request IDs**: Pass request IDs through the call chain for better tracing
4. **Circular Dependencies**: Avoid importing exception handlers in error type definitions

### Debug Mode
Set `NODE_ENV=development` to enable:
- Detailed error logging
- Stack trace inclusion
- Additional debugging information
- Verbose error context 