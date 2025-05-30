import { NextRequest, NextResponse } from 'next/server';
import { 
  generateRequestId,
  createSuccessResponse,
  createErrorResponse,
  normalizeError
} from '@/lib/errors/handlers';

// GET /api/health/serverless - Serverless function health and configuration check
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    // Basic runtime information
    const runtime = {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      uptime: process.uptime()
    };

    // Environment checks
    const environment = {
      vercel: {
        isVercel: !!process.env.VERCEL,
        env: process.env.VERCEL_ENV || 'development',
        region: process.env.VERCEL_REGION || 'unknown',
        url: process.env.VERCEL_URL,
        branch: process.env.VERCEL_GIT_COMMIT_REF
      },
      nextjs: {
        version: process.env.npm_package_dependencies_next || 'unknown',
        buildId: process.env.NEXT_BUILD_ID || 'development'
      }
    };

    // Critical environment variables check
    const envChecks = {
      openai: {
        configured: !!process.env.OPENAI_API_KEY,
        valid: process.env.OPENAI_API_KEY?.startsWith('sk-') || false
      },
      blob: {
        configured: !!process.env.BLOB_READ_WRITE_TOKEN,
        valid: process.env.BLOB_READ_WRITE_TOKEN?.startsWith('vercel_blob_rw_') || false
      }
    };

    // Function configuration from vercel.json (static info)
    const functionConfig = {
      '/api/upload': { maxDuration: 60, memory: 512 },
      '/api/whisper': { maxDuration: 180, memory: 1024 },
      '/api/openai': { maxDuration: 60, memory: 512 },
      '/api/video/enhanced': { maxDuration: 300, memory: 3008 },
      '/api/video': { maxDuration: 300, memory: 1024 },
      '/api/storage': { maxDuration: 30, memory: 256 },
      '/api/health': { maxDuration: 10, memory: 128 },
      '/api/cleanup': { maxDuration: 120, memory: 512 }
    };

    // Performance metrics
    const performance = {
      coldStart: !global.__serverless_initialized,
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    // Mark as initialized for cold start detection
    global.__serverless_initialized = true;

    // Overall health status
    const isHealthy = 
      envChecks.openai.configured && 
      envChecks.blob.configured && 
      runtime.memory.heapUsed < 400; // Under 400MB heap usage

    const healthData = {
      status: isHealthy ? 'healthy' : 'degraded',
      runtime,
      environment,
      envChecks,
      functionConfig,
      performance,
      checks: {
        memory: runtime.memory.heapUsed < 400 ? 'ok' : 'warning',
        environment: (envChecks.openai.configured && envChecks.blob.configured) ? 'ok' : 'error',
        platform: environment.vercel.isVercel ? 'vercel' : 'local'
      }
    };

    return createSuccessResponse(healthData, requestId);

  } catch (error) {
    const healthError = normalizeError(error, requestId);
    
    return createErrorResponse(healthError);
  }
}

// Extend global type for cold start detection
declare global {
  var __serverless_initialized: boolean | undefined;
} 