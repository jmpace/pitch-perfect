# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
```bash
npm run dev              # Start development server (port 3000)
npm run build            # Production build
npm run lint             # ESLint validation
```

### Testing
```bash
npm run test             # Run Jest unit tests
npm run test:watch       # Jest in watch mode for development
npm run test:coverage    # Generate coverage reports
npm run test:e2e         # Playwright end-to-end tests
npm run test:all         # Run complete test suite
```

### Security & Monitoring
```bash
npm run security:monitor # Run security monitoring scripts
npm run cors:test        # Test CORS configuration
```

## Architecture Overview

**Pitch Perfect** is a Next.js 15 application that analyzes pitch presentation videos using AI. The architecture centers around a serverless video processing pipeline with GPT-4 Vision integration.

### Core Processing Flow
1. **Video Upload** → Vercel Blob storage with validation
2. **Frame Extraction** → FFmpeg processing for slide analysis
3. **AI Analysis** → GPT-4 Vision API for content evaluation
4. **Recommendation Engine** → Prioritized feedback generation
5. **Results Dashboard** → Interactive timeline with actionable insights

### Key Architectural Components

**Video Processing Pipeline** (`/lib/video-processor.ts`)
- Serverless-compatible with in-memory job tracking
- FFmpeg integration for frame extraction and audio separation
- Real-time progress tracking via polling endpoints

**Vision Analysis Service** (`/lib/vision-analysis.ts`)
- GPT-4V integration with batch processing
- Multiple analysis categories: content, flow, visual quality, engagement
- Built-in rate limiting and cost tracking

**Error Handling System** (`/lib/errors/`)
- Comprehensive error categorization with request ID tracking
- Structured error responses for debugging
- Fallback strategies for external service failures

**API Structure**
- `POST /api/video/process` - Initiate video processing
- `GET /api/video/status/[jobId]` - Polling for job progress
- `GET /api/video/result/[jobId]` - Retrieve analysis results

### Testing Strategy

**Unit Tests (Jest)** - Focus on `lib/` utilities, API logic, and component behavior
**E2E Tests (Playwright)** - Cross-browser testing on port 3001 for user journeys

Current test coverage prioritizes validation system (19 tests) and error handling. Video processing and recommendation engine tests are actively being developed.

### Technology Stack

- **Next.js 15** with App Router and TypeScript
- **ShadCN UI** + Tailwind CSS for design system
- **OpenAI 5.0.1** for GPT-4 Vision API integration
- **Replicate** for serverless video processing (frame extraction, audio extraction)
- **Vercel Blob** for serverless file storage
- **Playwright** for E2E testing across browsers

### Development Patterns

- **Error-first design** with comprehensive exception handling
- **Type-safe APIs** throughout the application
- **Serverless optimization** for Vercel deployment
- **Progressive enhancement** with fallback strategies
- **Rate limiting** for external API calls to manage costs
- **Service abstraction** - ReplicateVideoProcessor handles actual video processing, with fallbacks for development

### File Upload Constraints
- **Video files**: MP4, MOV, AVI, maximum 100MB
- **Security**: File validation, input sanitization with DOMPurify
- **Storage**: Automatic cleanup scheduling for temporary files

When working on video processing features, always test with the development server's real-time progress tracking and ensure proper error handling for external API failures.