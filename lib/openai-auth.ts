import { openai, OPENAI_CONFIG, validateApiKey } from './openai-config';

// Authentication status interface
export interface AuthStatus {
  isAuthenticated: boolean;
  hasValidKey: boolean;
  error?: string;
  models?: string[];
  timestamp: string;
}

// Environment validation
export function validateEnvironment(): {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    issues.push('OPENAI_API_KEY environment variable is not set');
    recommendations.push('Add OPENAI_API_KEY to your .env.local file');
  } else if (!validateApiKey(apiKey)) {
    issues.push('OPENAI_API_KEY has invalid format');
    recommendations.push('Ensure API key starts with "sk-" and is properly formatted');
  }

  // Check Node.js environment
  if (typeof process === 'undefined') {
    issues.push('Running in browser environment - API key access not available');
    recommendations.push('OpenAI API calls should be made from server-side code only');
  }

  return {
    isValid: issues.length === 0,
    issues,
    recommendations,
  };
}

// Safe authentication check (won't throw errors)
export async function checkAuthentication(): Promise<AuthStatus> {
  const timestamp = new Date().toISOString();

  try {
    // Validate environment first
    const envValidation = validateEnvironment();
    if (!envValidation.isValid) {
      return {
        isAuthenticated: false,
        hasValidKey: false,
        error: `Environment issues: ${envValidation.issues.join(', ')}`,
        timestamp,
      };
    }

    // Test the API connection
    const response = await openai.models.list();
    const modelIds = response.data.map(model => model.id);

    return {
      isAuthenticated: true,
      hasValidKey: true,
      models: modelIds.slice(0, 10), // Return first 10 models
      timestamp,
    };

  } catch (error) {
    let errorMessage = 'Unknown authentication error';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Provide more specific error messages
      if (errorMessage.includes('401')) {
        errorMessage = 'Invalid API key - please check your OPENAI_API_KEY';
      } else if (errorMessage.includes('429')) {
        errorMessage = 'Rate limit exceeded - please wait before retrying';
      } else if (errorMessage.includes('500')) {
        errorMessage = 'OpenAI service temporarily unavailable';
      } else if (errorMessage.includes('network')) {
        errorMessage = 'Network error - please check your internet connection';
      }
    }

    return {
      isAuthenticated: false,
      hasValidKey: false,
      error: errorMessage,
      timestamp,
    };
  }
}

// Get authenticated client (throws error if not authenticated)
export async function getAuthenticatedClient() {
  const authStatus = await checkAuthentication();
  
  if (!authStatus.isAuthenticated) {
    throw new Error(`OpenAI authentication failed: ${authStatus.error}`);
  }
  
  return openai;
}

// Setup instructions for developers
export const SETUP_INSTRUCTIONS = {
  title: 'OpenAI API Setup Instructions',
  steps: [
    '1. Create an OpenAI account at https://platform.openai.com/',
    '2. Generate an API key in the API Keys section',
    '3. Create a .env.local file in your project root',
    '4. Add the line: OPENAI_API_KEY=your-api-key-here',
    '5. Restart your development server',
    '6. Test the connection using the /api/openai/test endpoint',
  ],
  notes: [
    '• Keep your API key secure and never commit it to version control',
    '• API keys should start with "sk-" for OpenAI',
    '• Monitor your usage on the OpenAI dashboard to avoid unexpected costs',
    '• Consider setting up billing alerts and usage limits',
  ],
  troubleshooting: {
    'Invalid API key': 'Ensure the key starts with "sk-" and is copied correctly',
    'Network errors': 'Check internet connection and firewall settings', 
    'Rate limits': 'Wait before retrying or upgrade your OpenAI plan',
    'Environment issues': 'Ensure .env.local file is in project root and server is restarted',
  },
};

// Development helper function
export function getSetupStatus() {
  const env = validateEnvironment();
  return {
    environment: env,
    instructions: SETUP_INSTRUCTIONS,
    nextSteps: env.isValid 
      ? ['Test authentication with /api/openai/test endpoint']
      : env.recommendations,
  };
} 