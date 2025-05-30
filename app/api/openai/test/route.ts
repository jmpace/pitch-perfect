import { NextRequest, NextResponse } from 'next/server';
import { testOpenAIConnection, validateApiKey } from '@/lib/openai-config';
import { createSanitizedHandler, SANITIZATION_CONFIGS, type SanitizedRequestData } from '@/lib/sanitization/middleware';
import { sanitize } from '@/lib/sanitization';
import { enforceRateLimit } from '@/lib/rate-limiter';
import { generateRequestId } from '@/lib/errors/handlers';

async function handleGet(request: NextRequest, sanitizedData: SanitizedRequestData) {
  const requestId = generateRequestId();
  
  try {
    // Apply rate limiting for AI processing
    enforceRateLimit(request, 'AI_PROCESSING', requestId);
    
    // Check if API key is configured
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'OpenAI API key not configured',
          details: 'Please set OPENAI_API_KEY environment variable',
        },
        { status: 500 }
      );
    }

    // Validate API key format
    if (!validateApiKey(apiKey)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API key format',
          details: 'OpenAI API keys should start with "sk-" and be longer than 20 characters',
        },
        { status: 500 }
      );
    }

    // Test the connection
    const connectionTest = await testOpenAIConnection();

    if (connectionTest.success) {
      return NextResponse.json({
        success: true,
        message: 'OpenAI API connection successful',
        availableModels: connectionTest.models,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to connect to OpenAI API',
          details: connectionTest.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('OpenAI API test error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during OpenAI API test',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function handlePost(request: NextRequest, sanitizedData: SanitizedRequestData) {
  const requestId = generateRequestId();
  
  try {
    // Apply rate limiting for AI processing
    enforceRateLimit(request, 'AI_PROCESSING', requestId);
    
    // Use sanitized body data if available, otherwise parse manually
    let body: {
      apiKey?: string;
    };

    if (sanitizedData.body) {
      body = sanitizedData.body;
    } else {
      try {
        const rawBody = await request.json();
        body = sanitize.object(rawBody);
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid JSON in request body',
            details: 'Please provide valid JSON',
          },
          { status: 400 }
        );
      }
    }

    // Sanitize the API key input
    const testApiKey = body.apiKey ? sanitize.textInput(body.apiKey) : undefined;

    if (!testApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'No API key provided',
          details: 'Please provide an API key in the request body',
        },
        { status: 400 }
      );
    }

    // Check for dangerous content in the API key
    if (sanitize.isDangerous(testApiKey)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API key content',
          details: 'API key contains invalid characters or patterns',
        },
        { status: 400 }
      );
    }

    // Validate the provided API key format
    if (!validateApiKey(testApiKey)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API key format',
          details: 'OpenAI API keys should start with "sk-" and be longer than 20 characters',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API key format is valid',
      keyFormat: 'Valid OpenAI API key format',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('API key validation error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Error validating API key',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Export sanitized handlers using STANDARD configuration
export const GET = createSanitizedHandler(handleGet, SANITIZATION_CONFIGS.STANDARD);
export const POST = createSanitizedHandler(handlePost, SANITIZATION_CONFIGS.STANDARD); 