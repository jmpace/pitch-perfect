import { NextRequest, NextResponse } from 'next/server';
import { getSetupStatus, checkAuthentication } from '@/lib/openai-auth';

export async function GET(request: NextRequest) {
  try {
    // Get comprehensive setup status
    const setupStatus = getSetupStatus();
    const authStatus = await checkAuthentication();

    return NextResponse.json({
      success: true,
      setup: setupStatus,
      authentication: authStatus,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Setup status error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Error retrieving setup status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'validate-environment') {
      const setupStatus = getSetupStatus();
      
      return NextResponse.json({
        success: true,
        validation: setupStatus.environment,
        recommendations: setupStatus.nextSteps,
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'test-authentication') {
      const authStatus = await checkAuthentication();
      
      return NextResponse.json({
        success: authStatus.isAuthenticated,
        authentication: authStatus,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action',
        details: 'Supported actions: validate-environment, test-authentication',
      },
      { status: 400 }
    );

  } catch (error) {
    console.error('Setup action error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Error processing setup action',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 