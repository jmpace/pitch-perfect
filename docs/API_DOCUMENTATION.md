# File Storage API Documentation

## Overview

The Pitch Perfect file storage system provides endpoints for uploading video files, tracking file metadata, managing cleanup operations, and monitoring system status. All endpoints use JSON for response formatting and include comprehensive error handling.

## Base URL

- **Development**: `http://localhost:3001`
- **Production**: `https://your-domain.com`

## Authentication

Currently, the API endpoints are publicly accessible. Authentication may be added in future versions.

## Common Response Format

All API responses follow this structure:

```json
{
  "success": boolean,
  "requestId": "string",
  "timestamp": "ISO 8601 datetime",
  // Success responses include additional data
  // Error responses include error details
}
```

## File Upload Endpoints

### POST /api/upload

Upload a video file to cloud storage.

**Content-Type**: `multipart/form-data`

**Request Body**:
- `file` (File, required): Video file to upload

**Supported File Types**:
- `video/mp4`
- `video/mov` 
- `video/webm`
- `video/quicktime`

**File Size Limits**:
- Minimum: 1 KB
- Maximum: 100 MB

**Success Response (200)**:
```json
{
  "success": true,
  "requestId": "req_1234567890",
  "timestamp": "2025-05-29T22:00:00.000Z",
  "url": "https://blob.vercel-storage.com/abc123.mp4",
  "downloadUrl": "https://blob.vercel-storage.com/abc123.mp4?download=1",
  "filename": "my-video.mp4",
  "size": 5242880,
  "fileId": "file_abc123",
  "uploadedAt": "2025-05-29T22:00:00.000Z"
}
```

**Error Responses**:

**400 Bad Request** - File validation failed:
```json
{
  "success": false,
  "requestId": "req_1234567890",
  "timestamp": "2025-05-29T22:00:00.000Z",
  "error": "File type 'application/pdf' not supported. Allowed types: video/mp4, video/mov, video/webm, video/quicktime",
  "code": "INVALID_FILE_TYPE",
  "details": {
    "receivedType": "application/pdf",
    "allowedTypes": ["video/mp4", "video/mov", "video/webm", "video/quicktime"]
  }
}
```

**413 Payload Too Large** - File size exceeded:
```json
{
  "success": false,
  "requestId": "req_1234567890", 
  "timestamp": "2025-05-29T22:00:00.000Z",
  "error": "File size 200 MB exceeds limit of 100 MB",
  "code": "FILE_SIZE_ERROR",
  "details": {
    "actualSize": 209715200,
    "maxSize": 104857600
  }
}
```

**500 Internal Server Error** - Upload failed:
```json
{
  "success": false,
  "requestId": "req_1234567890",
  "timestamp": "2025-05-29T22:00:00.000Z",
  "error": "Upload failed: Storage service unavailable",
  "code": "UPLOAD_ERROR"
}
```

### GET /api/upload/progress

Get upload progress for active uploads (WebSocket endpoint for real-time updates).

**WebSocket Connection**: `ws://localhost:3001/api/upload/progress?fileId=file_abc123`

**Progress Message Format**:
```json
{
  "fileId": "file_abc123",
  "filename": "my-video.mp4",
  "progress": 75.5,
  "uploadedBytes": 3932160,
  "totalBytes": 5242880,
  "status": "uploading",
  "timestamp": "2025-05-29T22:00:00.000Z"
}
```

**Status Values**:
- `uploading`: File is currently being uploaded
- `completed`: Upload finished successfully
- `failed`: Upload encountered an error
- `cancelled`: Upload was cancelled by user

## Cleanup Management Endpoints

### POST /api/cleanup

Trigger manual cleanup of expired files.

**Request Body**:
```json
{
  "dryRun": boolean,  // Optional: true to preview cleanup without deleting
  "olderThan": number // Optional: hours, defaults to 24
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "requestId": "req_1234567890",
  "timestamp": "2025-05-29T22:00:00.000Z",
  "totalRequested": 15,
  "successful": 12,
  "failed": 3,
  "dryRun": false,
  "results": [
    {
      "success": true,
      "blobUrl": "https://blob.vercel-storage.com/abc123.mp4",
      "deletedAt": "2025-05-29T22:00:00.000Z"
    },
    {
      "success": false,
      "blobUrl": "https://blob.vercel-storage.com/def456.mp4", 
      "error": "Blob not found"
    }
  ],
  "errors": ["Some files could not be deleted"],
  "duration": 1250
}
```

### GET /api/cleanup/status

Get current cleanup service status and recent activity.

**Success Response (200)**:
```json
{
  "success": true,
  "requestId": "req_1234567890",
  "timestamp": "2025-05-29T22:00:00.000Z",
  "status": "idle",
  "lastCleanup": "2025-05-29T21:00:00.000Z",
  "nextScheduledCleanup": "2025-05-29T23:00:00.000Z",
  "totalFiles": 42,
  "expiredFiles": 3,
  "isCleanupRunning": false,
  "recentActivity": [
    {
      "timestamp": "2025-05-29T21:00:00.000Z",
      "action": "cleanup_completed",
      "filesDeleted": 5,
      "duration": 850
    }
  ]
}
```

## File Management Endpoints

### GET /api/files

List tracked files with filtering and pagination.

**Query Parameters**:
- `status` (string): Filter by file status (`active`, `expired`, `all`)
- `limit` (number): Maximum files to return (default: 50, max: 1000)
- `offset` (number): Number of files to skip (default: 0)
- `sessionId` (string): Filter by session ID

**Success Response (200)**:
```json
{
  "success": true,
  "requestId": "req_1234567890",
  "timestamp": "2025-05-29T22:00:00.000Z",
  "files": [
    {
      "fileId": "file_abc123",
      "filename": "my-video.mp4",
      "url": "https://blob.vercel-storage.com/abc123.mp4",
      "size": 5242880,
      "uploadedAt": "2025-05-29T21:30:00.000Z",
      "expiresAt": "2025-05-30T21:30:00.000Z",
      "status": "active",
      "sessionId": "session_xyz789"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

### DELETE /api/files/:fileId

Delete a specific file and its metadata.

**Path Parameters**:
- `fileId` (string, required): The file ID to delete

**Success Response (200)**:
```json
{
  "success": true,
  "requestId": "req_1234567890",
  "timestamp": "2025-05-29T22:00:00.000Z",
  "fileId": "file_abc123",
  "deletedAt": "2025-05-29T22:00:00.000Z"
}
```

**Error Response (404)**:
```json
{
  "success": false,
  "requestId": "req_1234567890",
  "timestamp": "2025-05-29T22:00:00.000Z",
  "error": "File not found",
  "code": "FILE_NOT_FOUND",
  "details": {
    "fileId": "file_abc123"
  }
}
```

## System Status Endpoints

### GET /api/status

Get overall system health and statistics.

**Success Response (200)**:
```json
{
  "success": true,
  "requestId": "req_1234567890",
  "timestamp": "2025-05-29T22:00:00.000Z",
  "status": "healthy",
  "uptime": 86400,
  "version": "0.1.0",
  "storage": {
    "totalBlobs": 42,
    "totalSize": 220200960,
    "trackedFiles": 38,
    "orphanedBlobs": 4,
    "storageQuotaUsed": "15.2%"
  },
  "performance": {
    "averageUploadTime": 1250,
    "averageCleanupTime": 850,
    "successRate": 98.5
  },
  "config": {
    "maxFileSize": 104857600,
    "minFileSize": 1024,
    "supportedTypes": ["video/mp4", "video/mov", "video/webm", "video/quicktime"],
    "cleanupInterval": 3600,
    "fileRetentionHours": 24
  }
}
```

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_FILE_TYPE` | 400 | Unsupported file type |
| `FILE_SIZE_ERROR` | 400/413 | File size out of allowed range |
| `MISSING_PARAMETER` | 400 | Required parameter missing |
| `VALIDATION_ERROR` | 400 | General validation failure |
| `UPLOAD_ERROR` | 500 | File upload failed |
| `STORAGE_ERROR` | 500 | Storage service error |
| `NETWORK_ERROR` | 503 | Network connectivity issue |
| `TIMEOUT_ERROR` | 408 | Operation timed out |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `FILE_NOT_FOUND` | 404 | Requested file not found |
| `BLOB_ACCESS_ERROR` | 401 | Storage access denied |
| `CONFIGURATION_ERROR` | 500 | System configuration error |

## Usage Examples

### Upload a File (JavaScript)

```javascript
async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Upload successful:', result.url);
      return result;
    } else {
      console.error('Upload failed:', result.error);
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Network error:', error);
    throw error;
  }
}
```

### Monitor Upload Progress

```javascript
function monitorUploadProgress(fileId) {
  const ws = new WebSocket(`ws://localhost:3001/api/upload/progress?fileId=${fileId}`);
  
  ws.onmessage = (event) => {
    const progress = JSON.parse(event.data);
    console.log(`Upload progress: ${progress.progress}%`);
    
    if (progress.status === 'completed') {
      console.log('Upload completed!');
      ws.close();
    } else if (progress.status === 'failed') {
      console.error('Upload failed');
      ws.close();
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}
```

### Trigger Cleanup

```javascript
async function triggerCleanup(dryRun = false) {
  try {
    const response = await fetch('/api/cleanup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dryRun: dryRun,
        olderThan: 24 // hours
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log(`Cleanup completed: ${result.successful}/${result.totalRequested} files processed`);
      return result;
    } else {
      console.error('Cleanup failed:', result.error);
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Cleanup request failed:', error);
    throw error;
  }
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Upload endpoints**: 10 requests per minute per IP
- **Cleanup endpoints**: 5 requests per minute per IP  
- **Status endpoints**: 60 requests per minute per IP

When rate limits are exceeded, you'll receive a `429 Too Many Requests` response:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

## Best Practices

1. **File Validation**: Always validate files client-side before upload
2. **Error Handling**: Implement comprehensive error handling for all scenarios
3. **Progress Monitoring**: Use WebSocket connections for real-time upload progress
4. **Cleanup Management**: Monitor cleanup status regularly in production
5. **Rate Limiting**: Implement exponential backoff for retry logic
6. **Security**: Validate file content, not just extensions
7. **Performance**: Use appropriate file size limits for your use case

## Support

For issues or questions regarding the API, please refer to the troubleshooting guide or create an issue in the project repository.

---

# OpenAI API Integration Documentation

## Overview

The Pitch Perfect application integrates with OpenAI's GPT-4V (Vision) model to provide AI-powered presentation analysis capabilities. The integration includes comprehensive features for authentication, rate limiting, cost monitoring, and batch processing.

## Base URL

- **Development**: `http://localhost:3002`
- **Production**: `https://your-domain.com`

## Authentication Setup

### Environment Configuration

The OpenAI integration requires proper environment setup:

**Required Environment Variables:**
```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**Optional Environment Variables:**
```bash
OPENAI_MAX_RETRIES=3
OPENAI_TIMEOUT=60000
```

### Authentication Validation

The system validates authentication before processing requests:

```typescript
// Authentication check response
{
  "isAuthenticated": boolean,
  "hasValidKey": boolean,
  "error"?: string,
  "models"?: string[],
  "timestamp": string
}
```

## Vision Analysis API

### POST /api/openai/vision

Analyze presentation frames using GPT-4V for visual content extraction and insights.

**Content-Type**: `application/json`

#### Single Frame Analysis

**Request Body:**
```json
{
  "type": "single",
  "frameUrl": "https://example.com/frame.jpg",
  "timestamp": 1234567890,
  "analysisType": "slide_content",
  "context": {
    "previousFrames": ["https://example.com/frame1.jpg"],
    "presentationTitle": "Q4 Business Review",
    "targetAudience": "executives",
    "analysisGoals": ["extract key metrics", "identify action items"]
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "requestId": "req_vision_123456",
  "timestamp": "2025-05-30T02:52:22.021Z",
  "type": "single",
  "result": {
    "analysis": {
      "slideContent": {
        "title": "Q4 Revenue Performance",
        "bulletPoints": ["Revenue: $2.4M (+15%)", "New customers: 142"],
        "visualElements": ["bar chart", "company logo"]
      },
      "confidence": 0.95,
      "processingTime": 2340
    },
    "metadata": {
      "model": "gpt-4o",
      "tokensUsed": 856,
      "cost": 0.0428
    }
  },
  "processingTime": 2340
}
```

#### Batch Frame Analysis

**Request Body:**
```json
{
  "type": "batch",
  "frames": [
    {
      "frameUrl": "https://example.com/frame1.jpg",
      "timestamp": 1000
    },
    {
      "frameUrl": "https://example.com/frame2.jpg", 
      "timestamp": 2000
    }
  ],
  "analysisType": "presentation_flow",
  "batchSize": 5,
  "context": {
    "presentationTitle": "Product Launch",
    "targetAudience": "investors"
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "requestId": "req_batch_789012",
  "timestamp": "2025-05-30T02:52:22.021Z",
  "type": "batch",
  "result": {
    "results": [
      {
        "frameUrl": "https://example.com/frame1.jpg",
        "timestamp": 1000,
        "analysis": { /* analysis data */ },
        "processingTime": 1800
      }
    ],
    "summary": {
      "totalFrames": 2,
      "successfulAnalyses": 2,
      "failedAnalyses": 0,
      "totalProcessingTime": 3600,
      "averageProcessingTime": 1800
    },
    "processingTime": 3600
  }
}
```

### GET /api/openai/vision

Get information about available analysis types and configuration.

**Success Response (200):**
```json
{
  "success": true,
  "requestId": "req_config_345678",
  "timestamp": "2025-05-30T02:52:22.021Z",
  "analysisTypes": {
    "slide_content": "Extract text content, bullet points, and visual elements from slides",
    "presentation_flow": "Analyze slide type, narrative flow, and transition quality", 
    "visual_quality": "Assess design consistency, color scheme, typography, and professionalism",
    "engagement_cues": "Identify visual hierarchy, call-to-action elements, and memorability factors",
    "comprehensive": "Complete analysis covering all aspects of the slide"
  },
  "limits": {
    "maxBatchSize": 10,
    "maxImageSize": "20MB",
    "supportedFormats": ["JPEG", "PNG", "GIF", "WebP"],
    "rateLimit": "Follows OpenAI API rate limits"
  },
  "config": {
    "model": "gpt-4o",
    "maxTokens": 1000,
    "temperature": 0.1
  }
}
```

## Rate Limiting API

### GET /api/openai/rate-limit

Get current rate limiting status and configuration.

**Success Response (200):**
```json
{
  "success": true,
  "requestId": "req_ratelimit_456789",
  "timestamp": "2025-05-30T02:52:22.021Z",
  "status": "active",
  "endpoints": {
    "gpt-4o": {
      "requestsPerMinute": 500,
      "requestsUsed": 45,
      "tokensPerMinute": 30000,
      "tokensUsed": 8500,
      "resetTime": "2025-05-30T02:53:00.000Z"
    }
  },
  "queue": {
    "totalSize": 3,
    "byEndpoint": {
      "vision": 2,
      "chat": 1
    },
    "avgWaitTime": 1500,
    "oldestRequest": "2025-05-30T02:52:20.000Z"
  },
  "summary": {
    "totalActiveRequests": 45,
    "totalActiveTokens": 8500,
    "totalQueuedRequests": 3,
    "avgQueueWaitTime": 2
  },
  "configuration": {
    "rateLimiterActive": true,
    "queueingEnabled": true,
    "retryEnabled": true,
    "maxRetries": 3,
    "maxWaitTime": 30000
  }
}
```

### POST /api/openai/rate-limit

Update rate limiting configuration.

**Request Body:**
```json
{
  "action": "update_limits",
  "limits": {
    "gpt-4o": {
      "requestsPerMinute": 600,
      "tokensPerMinute": 35000
    }
  }
}
```

## Cost Monitoring API

### GET /api/openai/cost-monitoring

Get comprehensive cost tracking and analytics.

**Query Parameters:**
- `period` (optional): `1h`, `24h`, `7d`, `30d` (default: `24h`)
- `detailed` (optional): `true` | `false` (default: `false`)

**Success Response (200):**
```json
{
  "success": true,
  "requestId": "req_cost_567890",
  "timestamp": "2025-05-30T02:52:22.021Z",
  "overview": {
    "timeRange": "last24Hours",
    "startDate": "2025-05-29T02:52:22.021Z",
    "endDate": "2025-05-30T02:52:22.021Z",
    "totalCost": 12.45,
    "totalRequests": 156,
    "totalTokens": 245680,
    "successRate": 98.7,
    "averageCostPerRequest": 0.08,
    "averageTokensPerRequest": 1575
  },
  "costs": {
    "total": 12.45,
    "breakdown": {
      "byModel": [
        {
          "model": "gpt-4o",
          "cost": 11.20,
          "percentage": 90.0
        },
        {
          "model": "gpt-4o-mini",
          "cost": 1.25,
          "percentage": 10.0
        }
      ],
      "byEndpoint": [
        {
          "endpoint": "/api/openai/vision",
          "cost": 10.80,
          "percentage": 86.7
        },
        {
          "endpoint": "/api/openai/chat",
          "cost": 1.65,
          "percentage": 13.3
        }
      ]
    },
    "trends": {
      "direction": "up",
      "changePercentage": 15.3,
      "averageDailyCost": 11.80,
      "peakDay": {
        "date": "2025-05-29",
        "cost": 15.20
      }
    }
  },
  "usage": {
    "recent": {
      "last24Hours": {
        "cost": 12.45,
        "requests": 156,
        "tokens": 245680
      },
      "last7Days": {
        "cost": 78.90,
        "requests": 1024,
        "tokens": 1546300
      }
    }
  }
}
```

### POST /api/openai/cost-monitoring

Set cost alerts and budgets.

**Request Body:**
```json
{
  "action": "set_budget",
  "budget": {
    "daily": 50.00,
    "monthly": 1000.00,
    "alertThresholds": [0.8, 0.9, 0.95]
  }
}
```

## Setup and Testing APIs

### GET /api/openai/setup

Check OpenAI integration setup and configuration.

**Success Response (200):**
```json
{
  "success": true,
  "requestId": "req_setup_678901",
  "timestamp": "2025-05-30T02:52:22.021Z",
  "setup": {
    "apiKeyConfigured": true,
    "apiKeyValid": true,
    "modelsAvailable": ["gpt-4o", "gpt-4o-mini"],
    "rateLimiterActive": true,
    "costTrackerActive": true
  },
  "recommendations": [
    "Consider enabling batch processing for multiple frames",
    "Set up cost alerts for budget management"
  ]
}
```

### POST /api/openai/test

Test OpenAI integration with a simple request.

**Request Body:**
```json
{
  "testType": "basic" | "vision" | "rate_limit",
  "includeDetails": boolean
}
```

## Error Handling

All OpenAI API endpoints follow consistent error handling patterns:

### Authentication Errors (401)
```json
{
  "success": false,
  "requestId": "req_error_123456",
  "timestamp": "2025-05-30T02:52:22.021Z",
  "error": "OpenAI authentication failed",
  "code": "AUTH_FAILED",
  "details": {
    "reason": "Invalid API key format",
    "suggestion": "Ensure API key starts with 'sk-' and is properly formatted"
  }
}
```

### Rate Limit Errors (429)
```json
{
  "success": false,
  "requestId": "req_error_234567",
  "timestamp": "2025-05-30T02:52:22.021Z",
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "retryAfter": 30,
    "currentUsage": {
      "requests": 500,
      "tokens": 30000
    },
    "limits": {
      "requestsPerMinute": 500,
      "tokensPerMinute": 30000
    }
  }
}
```

### Validation Errors (400)
```json
{
  "success": false,
  "requestId": "req_error_345678",
  "timestamp": "2025-05-30T02:52:22.021Z",
  "error": "Invalid request body",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "analysisType",
    "message": "Must be one of: slide_content, presentation_flow, visual_quality, engagement_cues, comprehensive"
  }
}
```

## Usage Examples

### Basic Frame Analysis

```typescript
// Analyze a single presentation slide
const response = await fetch('/api/openai/vision', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    type: 'single',
    frameUrl: 'https://example.com/slide.jpg',
    timestamp: Date.now(),
    analysisType: 'slide_content',
    context: {
      presentationTitle: 'Q4 Review',
      targetAudience: 'executives'
    }
  })
});

const result = await response.json();
```

### Batch Processing

```typescript
// Analyze multiple frames at once
const frames = [
  { frameUrl: 'https://example.com/slide1.jpg', timestamp: 1000 },
  { frameUrl: 'https://example.com/slide2.jpg', timestamp: 2000 },
  { frameUrl: 'https://example.com/slide3.jpg', timestamp: 3000 }
];

const response = await fetch('/api/openai/vision', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    type: 'batch',
    frames,
    analysisType: 'comprehensive',
    batchSize: 5
  })
});

const result = await response.json();
```

### Cost Monitoring

```typescript
// Get current usage and costs
const costResponse = await fetch('/api/openai/cost-monitoring?period=24h&detailed=true');
const costData = await costResponse.json();

console.log(`Daily cost: $${costData.overview.totalCost}`);
console.log(`Success rate: ${costData.overview.successRate}%`);
```

### Rate Limit Monitoring

```typescript
// Check current rate limit status
const rateLimitResponse = await fetch('/api/openai/rate-limit');
const rateLimitData = await rateLimitResponse.json();

if (rateLimitData.summary.totalQueuedRequests > 0) {
  console.log(`Queued requests: ${rateLimitData.summary.totalQueuedRequests}`);
  console.log(`Estimated wait: ${rateLimitData.summary.avgQueueWaitTime}s`);
}
```

## Configuration Best Practices

### 1. Environment Setup
- Store API keys securely in environment variables
- Use different keys for development and production
- Monitor API key usage and rotate regularly

### 2. Rate Limiting
- Enable rate limiting to avoid hitting OpenAI limits
- Configure appropriate queue sizes for your use case
- Implement exponential backoff for retries

### 3. Cost Management
- Set up daily and monthly budgets
- Configure cost alerts at 80%, 90%, and 95% thresholds
- Monitor token usage patterns to optimize requests

### 4. Error Handling
- Always check response status before processing
- Implement appropriate retry logic for transient errors
- Log errors with request IDs for debugging

### 5. Performance Optimization
- Use batch processing for multiple frames when possible
- Cache analysis results when appropriate
- Optimize image sizes before sending to the API

## Troubleshooting

### Common Issues

**Issue: Authentication Failed**
- Verify `OPENAI_API_KEY` is set correctly
- Ensure API key format starts with `sk-`
- Check API key permissions and usage limits

**Issue: Rate Limit Exceeded**
- Check current usage with `/api/openai/rate-limit`
- Implement exponential backoff
- Consider upgrading OpenAI tier limits

**Issue: High Costs**
- Monitor usage with `/api/openai/cost-monitoring`
- Optimize analysis types (use specific types vs comprehensive)
- Implement cost alerts and budgets

**Issue: Slow Response Times**
- Check queue status in rate limit API
- Optimize image sizes and formats
- Consider batch processing for multiple frames

### Debug Information

Use the debug endpoint for troubleshooting:

```typescript
const debugResponse = await fetch('/api/openai/debug');
const debugInfo = await debugResponse.json();
```

## Security Considerations

1. **API Key Protection**: Never expose OpenAI API keys in client-side code
2. **Input Validation**: Always validate image URLs and request parameters
3. **Rate Limiting**: Implement server-side rate limiting to prevent abuse
4. **Cost Controls**: Set up budget alerts and automatic shutoffs
5. **Error Handling**: Don't expose sensitive error details to clients

For additional support or questions about the OpenAI API integration, please refer to the troubleshooting guide above or create an issue in the project repository. 