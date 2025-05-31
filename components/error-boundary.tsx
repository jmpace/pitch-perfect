"use client";

import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw, Home, Bug } from 'lucide-react';
import { 
  processUIError, 
  type ErrorBoundaryState,
  ApplicationLayer 
} from '@/lib/errors/exception-handlers';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetOnRouteChange?: boolean;
}

interface ErrorFallbackProps {
  error: Error;
  errorId: string;
  resetError: () => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { 
      hasError: true,
      error 
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Process the UI error using our exception handling system
    const { processedError, errorId } = processUIError(error, errorInfo);
    
    this.setState({
      errorInfo: {
        componentStack: errorInfo.componentStack || ''
      },
      errorId: errorId || 'unknown'
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console for development
    console.error('[ErrorBoundary] Caught error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId,
      processedError: processedError.toJSON()
    });
  }

  resetError = () => {
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined,
      errorId: undefined 
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback component if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent 
            error={this.state.error!}
            errorId={this.state.errorId!}
            resetError={this.resetError}
          />
        );
      }

      // Default error UI
      return <DefaultErrorFallback 
        error={this.state.error!}
        errorId={this.state.errorId!}
        resetError={this.resetError}
      />;
    }

    return this.props.children;
  }
}

// Default Error Fallback Component
function DefaultErrorFallback({ error, errorId, resetError }: ErrorFallbackProps) {
  const handleRefresh = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const reportError = () => {
    // In a real app, this would send the error to your error reporting service
    console.log('Reporting error:', { errorId, error: error.message });
    alert(`Error reported with ID: ${errorId}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 text-red-500">
            <AlertCircle className="h-full w-full" />
          </div>
          <CardTitle className="text-xl text-red-600 dark:text-red-400">
            Something went wrong
          </CardTitle>
          <CardDescription>
            An unexpected error occurred while loading this page. 
            Our team has been notified and is working to fix this issue.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Error Details Alert */}
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {error.message}
              <br />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Error ID: {errorId}
              </span>
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button 
              onClick={resetError} 
              className="w-full"
              variant="default"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={handleRefresh} 
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Page
              </Button>
              
              <Button 
                onClick={handleGoHome} 
                variant="outline"
                className="w-full"
              >
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </div>
            
            <Button 
              onClick={reportError} 
              variant="ghost"
              className="w-full text-sm"
            >
              <Bug className="mr-2 h-4 w-4" />
              Report this issue
            </Button>
          </div>

          {/* Technical Details (Development) */}
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                Technical Details (Development Only)
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-32">
                {error.stack}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Hook for using Error Boundary programmatically
export function useErrorHandler() {
  return React.useCallback((error: Error, errorInfo?: any) => {
    // This can be used to manually trigger error processing
    const { processedError, errorId } = processUIError(error, errorInfo || {});
    
    console.error('[useErrorHandler] Manual error:', {
      error: error.message,
      errorId,
      processedError: processedError.toJSON()
    });
    
    // In a real implementation, you might want to:
    // - Show a toast notification
    // - Send to error reporting service
    // - Update global error state
    
    return { processedError, errorId };
  }, []);
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

export default ErrorBoundary; 