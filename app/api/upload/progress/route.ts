import { NextRequest } from 'next/server';
import { UploadProgressTracker } from '@/lib/upload-progress';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');

  if (!uploadId) {
    return new Response('Upload ID required', { status: 400 });
  }

  // Set up Server-Sent Events
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        const progress = UploadProgressTracker.getProgress(uploadId);
        
        if (!progress) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            error: 'Upload not found'
          })}\n\n`));
          controller.close();
          clearInterval(interval);
          return;
        }

        const progressData = {
          uploadId,
          bytesUploaded: progress.bytesUploaded,
          totalBytes: progress.totalBytes,
          percentage: progress.totalBytes > 0 ? Math.round((progress.bytesUploaded / progress.totalBytes) * 100) : 0,
          status: progress.status,
          error: progress.error
        };

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData)}\n\n`));

        // Clean up completed or failed uploads
        if (progress.status === 'completed' || progress.status === 'failed') {
          setTimeout(() => {
            UploadProgressTracker.deleteProgress(uploadId);
          }, 5000); // Keep for 5 seconds after completion
          
          controller.close();
          clearInterval(interval);
        }
      }, 100); // Update every 100ms

      // Clean up on client disconnect
      request.signal?.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
} 