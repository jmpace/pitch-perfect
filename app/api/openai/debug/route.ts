import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    return NextResponse.json({
      hasApiKey: !!apiKey,
      keyExists: apiKey !== undefined,
      keyLength: apiKey ? apiKey.length : 0,
      startsWithSk: apiKey ? apiKey.startsWith('sk-') : false,
      firstChars: apiKey ? apiKey.substring(0, 3) : 'none',
      lastChars: apiKey ? apiKey.substring(apiKey.length - 3) : 'none',
      envKeys: Object.keys(process.env).filter(key => key.includes('OPENAI')),
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Debug error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 