# Input Sanitization and Validation System

This document describes the comprehensive input sanitization and validation system implemented in the Pitch Perfect application.

## Overview

The application implements a multi-layered security approach to input sanitization:

1. **Client-Side Sanitization** - First line of defense at the UI level
2. **Server-Side Middleware** - Comprehensive API request sanitization
3. **Context-Specific Validation** - Tailored sanitization for different data types

## Architecture

### Server-Side Components

#### Core Sanitization Library (`lib/sanitization/index.ts`)

The main sanitization library provides:

- **DOMPurify Integration**: HTML/XSS sanitization with configurable security levels
- **Validator.js Integration**: String validation and sanitization utilities
- **Multi-Context Support**: Different sanitization modes for various input types
- **Advanced Security Features**: Dangerous content detection and recursive object sanitization

```typescript
import { sanitize } from '@/lib/sanitization';

// Basic text input sanitization
const cleaned = sanitize.textInput(userInput);

// HTML content with basic formatting allowed
const content = sanitize.contentInput(htmlInput);

// Secure filename handling
const filename = sanitize.filename(originalFilename);

// URL validation and sanitization
const url = sanitize.url(userUrl);
```

#### API Middleware (`lib/sanitization/middleware.ts`)

Comprehensive request sanitization middleware:

- **Request Body Sanitization**: JSON, FormData, and plain text support
- **Query Parameter Cleaning**: Automatic parameter sanitization
- **Header Sanitization**: Security-focused header cleaning
- **Dangerous Content Blocking**: Automatic threat detection and blocking

```typescript
import { createSanitizedHandler, SANITIZATION_CONFIGS } from '@/lib/sanitization/middleware';

// Apply standard sanitization to an API route
export const POST = createSanitizedHandler(handleRequest, SANITIZATION_CONFIGS.STANDARD);

// Custom sanitization configuration
export const POST = createSanitizedHandler(handleRequest, {
  sanitizeQuery: true,
  sanitizeBody: true,
  blockDangerous: true,
  maxBodySize: 10 * 1024 * 1024, // 10MB
});
```

### Client-Side Components

#### Client Sanitization Library (`lib/sanitization/client.ts`)

React-focused sanitization utilities:

- **React Hooks**: `useSanitizedInput()` and `useSanitizedFile()`
- **Component Wrappers**: Ready-to-use sanitized input components
- **Real-Time Validation**: Immediate feedback on dangerous content
- **File Security**: Comprehensive filename sanitization

```typescript
import { useSanitizedFile } from '@/lib/sanitization/client';

function UploadComponent() {
  const { createSanitizedFile, isDangerousFilename } = useSanitizedFile();
  
  const handleFile = (file: File) => {
    if (isDangerousFilename(file.name)) {
      // Handle dangerous filename
      return;
    }
    
    const sanitizedFile = createSanitizedFile(file);
    // Proceed with sanitized file
  };
}
```

## Security Features

### XSS Prevention

- **DOMPurify Integration**: Industry-standard HTML sanitization
- **Configurable Security Levels**: STRICT, BASIC, and PERMISSIVE modes
- **Script Tag Removal**: Automatic removal of dangerous script elements
- **Event Handler Blocking**: Prevention of inline event handlers

### Injection Attack Prevention

- **SQL Injection**: Parameterized queries through ORM usage
- **Script Injection**: Removal of executable script content
- **Path Traversal**: Filename sanitization preventing directory traversal
- **Control Character Removal**: Elimination of null bytes and control characters

### File Security

- **Filename Sanitization**: Comprehensive filename cleaning
- **Extension Validation**: Dangerous file extension detection
- **Size Limitations**: Configurable upload size limits
- **Content-Type Validation**: MIME type verification

## Configuration Options

### Sanitization Modes

#### Server-Side Modes

```typescript
export const SANITIZATION_CONFIG = {
  STRICT: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  },
  BASIC: {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: [],
  },
  PERMISSIVE: {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'a', 'ul', 'ol', 'li', 'blockquote'],
    ALLOWED_ATTR: ['href', 'title'],
  }
};
```

#### Middleware Configurations

```typescript
export const SANITIZATION_CONFIGS = {
  STRICT: {
    blockDangerous: true,
    maxBodySize: 1024 * 1024, // 1MB
  },
  STANDARD: {
    blockDangerous: true,
    maxBodySize: 10 * 1024 * 1024, // 10MB
  },
  UPLOAD: {
    sanitizeBody: false, // Don't sanitize file content
    maxBodySize: 100 * 1024 * 1024, // 100MB
  },
};
```

## Usage Examples

### API Route Protection

```typescript
// app/api/example/route.ts
import { createSanitizedHandler, SANITIZATION_CONFIGS } from '@/lib/sanitization/middleware';

async function handleRequest(request: NextRequest, sanitizedData: SanitizedRequestData) {
  // sanitizedData.query - sanitized query parameters
  // sanitizedData.body - sanitized request body
  // sanitizedData.headers - sanitized headers
  
  return NextResponse.json({ success: true });
}

export const POST = createSanitizedHandler(handleRequest, SANITIZATION_CONFIGS.STANDARD);
```

### Form Input Sanitization

```typescript
import { useSanitizedInput } from '@/lib/sanitization/client';

function FormComponent() {
  const { handleChange, isDangerous } = useSanitizedInput();
  
  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const sanitizedValue = handleChange(event);
    
    if (isDangerous(event.target.value)) {
      // Show warning to user
    }
    
    // Use sanitizedValue
  };
  
  return <input onChange={onInputChange} />;
}
```

### File Upload Security

```typescript
import { useSanitizedFile } from '@/lib/sanitization/client';

function FileUpload() {
  const { createSanitizedFile, isDangerousFilename } = useSanitizedFile();
  
  const handleFileSelect = (file: File) => {
    if (isDangerousFilename(file.name)) {
      alert('File name contains dangerous content');
      return;
    }
    
    const sanitizedFile = createSanitizedFile(file);
    // Upload sanitizedFile
  };
}
```

## Security Patterns

### Dangerous Content Detection

The system automatically detects and blocks:

- Script tags (`<script>`, `</script>`)
- JavaScript URIs (`javascript:`, `vbscript:`)
- Event handlers (`onclick`, `onload`, etc.)
- HTML entities for obfuscation (`&#x...;`)
- SQL injection patterns
- Path traversal attempts (`../`, `..\\`)
- Null bytes and control characters

### Error Handling

```typescript
try {
  const sanitized = sanitize.textInput(userInput);
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
    console.error('Validation failed:', error.message);
  }
}
```

## Testing

### Unit Testing

```typescript
import { sanitize } from '@/lib/sanitization';

describe('Input Sanitization', () => {
  test('removes script tags', () => {
    const input = '<script>alert("xss")</script>Hello';
    const result = sanitize.textInput(input);
    expect(result).toBe('Hello');
  });
  
  test('sanitizes filenames', () => {
    const input = '../../../etc/passwd';
    const result = sanitize.filename(input);
    expect(result).toBe('___etc_passwd');
  });
});
```

### Integration Testing

```typescript
import { createSanitizedHandler } from '@/lib/sanitization/middleware';

describe('API Sanitization', () => {
  test('blocks dangerous content', async () => {
    const request = new NextRequest('/api/test', {
      method: 'POST',
      body: JSON.stringify({ content: '<script>alert("xss")</script>' })
    });
    
    const response = await handler(request);
    expect(response.status).toBe(400);
  });
});
```

## Best Practices

1. **Always sanitize at the entry point** - Apply sanitization as early as possible
2. **Use appropriate sanitization levels** - Match the security level to the content type
3. **Validate file uploads** - Always check file types, sizes, and names
4. **Log security events** - Track sanitization events for monitoring
5. **Regular updates** - Keep sanitization libraries updated
6. **Test thoroughly** - Include security testing in your test suite

## Monitoring and Logging

The system logs security events for monitoring:

```typescript
// Dangerous content detection is logged
console.warn('Dangerous content detected and blocked:', content.substring(0, 50) + '...');

// Filename sanitization is logged
console.warn(`Filename sanitized: "${original}" → "${sanitized}"`);
```

## Migration Guide

### Existing API Routes

To add sanitization to existing API routes:

1. Import the sanitization middleware
2. Wrap your handler with `createSanitizedHandler`
3. Access sanitized data through the `sanitizedData` parameter

```typescript
// Before
export async function POST(request: NextRequest) {
  const body = await request.json();
  // handle request
}

// After
import { createSanitizedHandler, SANITIZATION_CONFIGS } from '@/lib/sanitization/middleware';

async function handlePost(request: NextRequest, sanitizedData: SanitizedRequestData) {
  const body = sanitizedData.body; // Already sanitized
  // handle request
}

export const POST = createSanitizedHandler(handlePost, SANITIZATION_CONFIGS.STANDARD);
```

### Client Components

To add sanitization to form inputs:

1. Import the appropriate hook or component
2. Replace standard event handlers with sanitized versions
3. Add dangerous content detection feedback

```typescript
// Before
const [value, setValue] = useState('');
const handleChange = (e) => setValue(e.target.value);

// After
import { useSanitizedInput } from '@/lib/sanitization/client';

const { handleChange, isDangerous } = useSanitizedInput();
const onInputChange = (e) => {
  if (isDangerous(e.target.value)) {
    showWarning('Input contains dangerous content');
  }
  const sanitized = handleChange(e);
  setValue(sanitized);
};
```

## Troubleshooting

### Common Issues

1. **Content being over-sanitized**: Adjust sanitization mode to be less strict
2. **Performance issues**: Check sanitization overhead and optimize configurations
3. **False positives**: Review dangerous content patterns and adjust as needed

### Debug Mode

Enable detailed logging for debugging:

```typescript
// Set to true for verbose sanitization logging
const DEBUG_SANITIZATION = process.env.NODE_ENV === 'development';
```

## Conclusion

This sanitization system provides comprehensive protection against common security vulnerabilities while maintaining usability and performance. Regular review and updates ensure continued protection against emerging threats. 