# Video Processing Engine Architecture

## Overview
The Video Processing Engine is designed to integrate seamlessly with the existing Pitch Perfect application infrastructure, leveraging the current file storage, error handling, and progress tracking systems.

## System Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   File Upload   │───▶│  Video Processor │───▶│   Results API   │
│   (/api/upload) │    │   (/api/video)   │    │ (/api/results)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Vercel Blob    │    │  Processing      │    │   Metadata      │
│   Storage       │    │   Queue          │    │   Database      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Data Flow

### 1. Video Ingestion Flow
```
User Upload ──┬──▶ File Validation ──▶ Blob Storage ──▶ Processing Queue
              │
              └──▶ Progress Tracking ──▶ Status Updates
```

### 2. Processing Pipeline Flow
```
Queued Job ──▶ FFmpeg Setup ──┬──▶ Frame Extraction ──▶ Frame Storage
                               │
                               └──▶ Audio Separation ──▶ Audio Storage
                               │
                               └──▶ Metadata Gen ──▶ Job Complete
```

### 3. Storage Structure
```
blob-storage/
├── videos/
│   └── {videoId}/
│       ├── original.mp4           # Source video
│       ├── frames/                # Extracted frames
│       │   ├── frame_00010s.jpg   # Frame at 10 seconds
│       │   ├── frame_00020s.jpg   # Frame at 20 seconds
│       │   └── ...
│       ├── audio/
│       │   └── audio.mp3          # Separated audio
│       └── metadata.json          # Processing metadata
```

## Component Specifications

### Video Processing Service
**Location:** `lib/video-processor.ts`
**Purpose:** Core service for managing video processing jobs

```typescript
interface VideoProcessingJob {
  id: string;
  videoUrl: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  results?: ProcessingResults;
}

interface ProcessingResults {
  frames: FrameMetadata[];
  audio: AudioMetadata;
  videoMetadata: VideoMetadata;
  processingStats: ProcessingStats;
}
```

### Frame Extraction Service
**Location:** `lib/frame-extractor.ts`
**Purpose:** Extract frames at specified intervals using FFmpeg

```typescript
interface FrameExtractionConfig {
  interval: number;        // seconds between frames
  quality: number;         // 1-31 (lower = better quality)
  resolution: {           // output resolution
    width: number;
    height: number;
  };
  format: 'jpg' | 'png';
}
```

### Audio Separation Service
**Location:** `lib/audio-separator.ts`
**Purpose:** Extract and process audio from video files

```typescript
interface AudioExtractionConfig {
  format: 'mp3' | 'wav';
  quality: number;         // bitrate for mp3, sample rate for wav
  channels: 1 | 2;        // mono or stereo
  normalize: boolean;      // audio normalization
}
```

## API Endpoints

### POST /api/video/process
Start video processing for an uploaded file.

**Request:**
```json
{
  "videoUrl": "https://blob.vercel-storage.com/...",
  "options": {
    "frameInterval": 10,
    "audioFormat": "mp3",
    "extractAudio": true
  }
}
```

**Response:**
```json
{
  "jobId": "job_12345",
  "status": "queued",
  "estimatedTime": 600,
  "message": "Video processing started"
}
```

### GET /api/video/status/{jobId}
Get current processing status and progress.

**Response:**
```json
{
  "jobId": "job_12345",
  "status": "processing",
  "progress": 45,
  "currentStage": "frame_extraction",
  "framesProcessed": 12,
  "totalFrames": 30,
  "audioProgress": 0,
  "estimatedTimeRemaining": 320
}
```

### GET /api/video/result/{jobId}
Get complete processing results.

**Response:**
```json
{
  "jobId": "job_12345",
  "status": "completed",
  "results": {
    "frames": [
      {
        "timestamp": 10,
        "url": "https://blob.vercel-storage.com/.../frame_00010s.jpg",
        "size": 245760
      }
    ],
    "audio": {
      "url": "https://blob.vercel-storage.com/.../audio.mp3",
      "duration": 300,
      "format": "mp3",
      "size": 4800000
    },
    "metadata": {
      "duration": 300,
      "resolution": "1920x1080",
      "fps": 30,
      "codec": "h264"
    }
  }
}
```

## Performance Specifications

### Processing Targets
- **Processing Ratio:** 2:1 (10 minutes to process 5-minute video)
- **Memory Usage:** Maximum 500MB per processing job
- **Concurrent Jobs:** Maximum 3 simultaneous processes
- **Timeout:** 15 minutes absolute maximum per job

### Frame Extraction Specifications
- **Interval:** 10 seconds (configurable)
- **Quality:** JPEG quality 85
- **Resolution:** 1280x720 (standardized for consistent analysis)
- **Format:** JPEG for optimal file size

### Audio Extraction Specifications
- **Format:** MP3 (default), WAV (high quality option)
- **Quality:** 128kbps for MP3, 44.1kHz 16-bit for WAV
- **Channels:** Stereo preserved, mono option available

## Error Handling Strategy

### Error Categories
1. **Input Validation Errors**
   - Unsupported format
   - File corruption
   - Size limitations

2. **Processing Errors**
   - FFmpeg failures
   - Memory limitations
   - Timeout exceeded

3. **Storage Errors**
   - Blob upload failures
   - Insufficient storage
   - Network issues

### Retry Logic
- **Transient Failures:** Up to 3 retries with exponential backoff
- **Memory Errors:** Reduce quality settings and retry once
- **Timeout Errors:** No retry, mark as failed

### Fallback Strategies
- **Partial Processing:** Save completed frames/audio even if job fails
- **Quality Degradation:** Reduce settings if resource constraints hit
- **Manual Recovery:** Admin tools to resume failed jobs

## Integration Points

### Existing System Integration
1. **File Storage:** Leverage existing BlobManager for all storage operations
2. **Progress Tracking:** Extend UploadProgressTracker pattern for processing progress
3. **Error Handling:** Use existing error types and request ID system
4. **Cleanup:** Integrate with CleanupScheduler for processed assets
5. **File Tracking:** Extend FileTracker to include processing job metadata

### Dependencies
- **FFmpeg:** Core video processing engine
- **Existing APIs:** Upload, blob management, error handling
- **Storage:** Vercel Blob for all file storage

## Security Considerations

### File Security
- Validate video format and content before processing
- Sanitize file names and paths
- Implement file size and duration limits

### API Security
- Rate limiting on processing endpoints
- Job ownership validation
- Secure blob URL generation

### Resource Protection
- Memory usage monitoring
- CPU usage limits
- Process isolation

## Monitoring and Logging

### Metrics to Track
- Processing times by video duration
- Success/failure rates
- Resource usage patterns
- Storage consumption

### Logging Strategy
- Use existing request ID system
- Log processing stages and timing
- Error context and recovery attempts
- Performance metrics

## Future Enhancements

### Scalability Options
- Background job processing with Redis
- Multiple worker processes
- Distributed processing

### Quality Improvements
- Scene detection for intelligent frame extraction
- Audio enhancement and noise reduction
- Video preview generation

### Analysis Integration
- Direct integration with OpenAI APIs
- Real-time analysis during processing
- Automated quality assessment 