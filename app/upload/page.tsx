"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { validateFileDetailed, type FileValidationResult } from "@/lib/validation";
import { AlertCircle, CheckCircle, AlertTriangle, Upload, X, Loader2 } from "lucide-react";
import { useSanitizedFile } from "@/lib/sanitization/client";
import PollingManager from '@/lib/polling-manager';

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error' | 'cancelled';

interface ProcessingStage {
  name: string;
  description: string;
  progress: number;
}

export default function UploadPage() {
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragCounter, setDragCounter] = useState(0);
  const [validationResult, setValidationResult] = useState<FileValidationResult | null>(null);
  
  // Progress tracking states
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<ProcessingStage | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);

  // Polling cleanup ref
  const pollingActive = useRef(false);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get singleton polling manager
  const pollingManager = PollingManager.getInstance();

  // Analysis options
  const [analysisOptions, setAnalysisOptions] = useState({
    contentAnalysis: true,
    structureFlow: true,
    persuasiveness: true,
    voiceAnalysis: false
  });

  // Sanitization hooks
  const { createSanitizedFile, isDangerousFilename } = useSanitizedFile();

  // Cleanup polling when component unmounts
  useEffect(() => {
    return () => {
      // Stop polling when component unmounts
      pollingActive.current = false;
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      // Stop all polling managed by this component
      pollingManager.stopAllPolling();
    };
  }, [pollingManager]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(dragCounter + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
      setDragOver(true);
    }
  };

  const handleDragOut = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(dragCounter - 1);
    if (dragCounter - 1 === 0) {
      setDragActive(false);
      setDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const validateAndSetFile = (selectedFile: File) => {
    // Check for dangerous filename content
    if (isDangerousFilename(selectedFile.name)) {
      setUploadError('File name contains potentially dangerous content and has been rejected for security reasons.');
      setFile(null);
      setValidationResult(null);
      return;
    }

    // Sanitize the filename
    const sanitizedFile = createSanitizedFile(selectedFile);
    
    // If filename was changed, show a warning
    if (sanitizedFile.name !== selectedFile.name) {
      console.warn(`Filename sanitized: "${selectedFile.name}" → "${sanitizedFile.name}"`);
      setUploadError(`Filename was sanitized for security: "${selectedFile.name}" → "${sanitizedFile.name}"`);
      // Clear the error after a delay so user can see the warning
      setTimeout(() => {
        if (uploadStatus === 'idle') {
          setUploadError(null);
        }
      }, 5000);
    }

    // Validate the sanitized file
    const validation = validateFileDetailed(sanitizedFile);
    setValidationResult(validation);
    
    if (validation.isValid) {
      setFile(sanitizedFile);
      // Reset upload state when new file is selected
      setUploadProgress(0);
      setUploadStatus('idle');
      // Don't clear upload error immediately if it's a filename sanitization warning
    } else {
      setFile(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setDragOver(false);
    setDragCounter(0);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      validateAndSetFile(selectedFile);
    }
  };

  const cancelUpload = () => {
    // Stop polling if active
    pollingActive.current = false;
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    // Stop all polling
    pollingManager.stopAllPolling();
    
    setUploadStatus('cancelled');
    setUploadError('Upload cancelled by user');
    setUploadProgress(0);
  };

  const clearFile = () => {
    // Stop polling if active
    pollingActive.current = false;
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    // Stop all polling
    pollingManager.stopAllPolling();
    
    setFile(null);
    setValidationResult(null);
    setUploadProgress(0);
    setUploadStatus('idle');
    setUploadError(null);
    // Reset file input
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Real video processing function
  const processVideo = async () => {
    if (!file || !validationResult?.isValid) return;

    setUploadStatus('uploading');
    setUploadError(null);
    setUploadProgress(0);

    try {
      // Additional client-side security check before upload
      if (isDangerousFilename(file.name)) {
        throw new Error('File contains dangerous content and cannot be uploaded');
      }

      // Use Vercel Blob client upload - this handles token exchange internally
      const { upload } = await import('@vercel/blob/client');
      
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        clientPayload: JSON.stringify({
          uploadId,
          metadata: {
            size: file.size,
            type: file.type,
            name: file.name
          }
        }),
        onUploadProgress: ({ loaded, total, percentage }) => {
          setUploadProgress(Math.round(percentage));
        }
      });

      setUploadProgress(100);

      // The callback will be triggered automatically by Vercel Blob
      // Wait a moment for the callback to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Start video processing
      setUploadStatus('processing');
      setUploadProgress(0);
      setProcessingStage({
        name: 'Starting Analysis',
        description: 'Initializing video processing pipeline...',
        progress: 0
      });

      const processResponse = await fetch('/api/video/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl: blob.url,
          uploadId,
          options: analysisOptions
        }),
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        throw new Error(errorData.message || 'Processing failed to start');
      }

      const processResult = await processResponse.json();
      setJobId(processResult.jobId);
      setEstimatedTimeRemaining(processResult.estimatedTime);

      // Step 4: Poll for processing status with rate limiting protection
      pollProcessingStatus(processResult.jobId, blob.url);

    } catch (error) {
      setUploadStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Processing failed. Please try again.';
      setUploadError(errorMessage);
      console.error("Video processing error:", error);
    }
  };

  // Poll for processing status with rate limiting protection
  const pollProcessingStatus = async (jobId: string, videoUrl: string) => {
    // Prevent multiple polling loops for the same job using singleton manager
    if (!pollingManager.startPolling(jobId)) {
      console.log(`[client-polling] Already polling job ${jobId} - skipping duplicate`);
      return;
    }
    
    // Generate unique poll session ID for debugging
    const pollSessionId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[client-polling] Starting new poll session ${pollSessionId} for job ${jobId}`);
    
    let pollInterval = 20000; // 20 seconds
    let consecutiveErrors = 0;
    const maxRetries = 5;
    
    // Set polling as active
    pollingActive.current = true;
    
    // Store initial job data in localStorage as backup
    const initialJobData = {
      id: jobId,
      videoUrl: videoUrl,
      status: 'processing',
      progress: 0,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      requestId: `upload_${Date.now()}`
    };
    
    localStorage.setItem(`job_${jobId}`, JSON.stringify(initialJobData));
    
    // Cleanup function to remove from registry
    const cleanup = () => {
      pollingActive.current = false;
      pollingManager.stopPolling(jobId);
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
    
    const poll = async () => {
      // Stop polling if component unmounted or polling was cancelled
      if (!pollingActive.current) {
        console.log('Polling stopped - component unmounted');
        cleanup();
        return;
      }
      
      try {
        // Use PollingManager to throttle requests and prevent duplicates
        if (!pollingManager.canMakeRequest(jobId)) {
          console.log(`[client-polling] Session ${pollSessionId} - Request throttled for job ${jobId}`);
          // Schedule next poll without making a request
          if (pollingActive.current) {
            pollingTimeoutRef.current = setTimeout(poll, pollInterval);
          }
          return;
        }
        
        console.log(`[client-polling] Session ${pollSessionId} - Making request for job ${jobId}`);
        
        // First try GET request (works if server has job data)
        let statusResponse = await fetch(`/api/video/status/${jobId}`);
        
        // Check again after async operation
        if (!pollingActive.current) return;
        
        // If GET fails with 404, try POST with local job data
        if (statusResponse.status === 404) {
          const localJobData = localStorage.getItem(`job_${jobId}`);
          if (localJobData) {
            statusResponse = await fetch(`/api/video/status/${jobId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                jobData: JSON.parse(localJobData)
              })
            });
          }
        }
        
        // Check again after async operation
        if (!pollingActive.current) return;
        
        // Handle rate limiting specifically
        if (statusResponse.status === 429) {
          consecutiveErrors++;
          
          // Much longer exponential backoff for rate limits: 60s, 2min, 5min, 10min
          const backoffDelay = Math.min(60000 * Math.pow(2, consecutiveErrors - 1), 600000);
          console.log(`Rate limited. Backing off for ${backoffDelay / 1000}s...`);
          
          // After 3 consecutive rate limit errors, stop polling and show manual option
          if (consecutiveErrors >= 3) {
            setUploadError('Processing status temporarily unavailable due to high server load. Your video is still processing in the background.');
            setUploadStatus('error');
            // Store jobId so user can manually check results
            if (jobId) {
              localStorage.setItem('pendingJobId', jobId);
            }
            cleanup(); // Stop polling and clean up registry
            return;
          }
          
          if (pollingActive.current) {
            pollingTimeoutRef.current = setTimeout(poll, backoffDelay);
          }
          return;
        }
        
        if (!statusResponse.ok) {
          throw new Error(`Failed to get processing status: ${statusResponse.status}`);
        }

        // Reset error count on successful response
        consecutiveErrors = 0;
        pollInterval = 20000; // Reset to normal interval

        const status = await statusResponse.json();
        
        // Log detailed response for debugging
        console.log(`[client-polling] Session ${pollSessionId} - Job ${jobId} response:`, {
          status: status.status,
          progress: status.progress,
          currentStage: status.currentStage,
          estimatedTimeRemaining: status.estimatedTimeRemaining,
          error: status.error
        });
        
        // Check again after async operation
        if (!pollingActive.current) return;
        
        // Update local job data with latest status
        const updatedJobData = {
          ...JSON.parse(localStorage.getItem(`job_${jobId}`) || '{}'),
          status: status.status,
          progress: status.progress,
          error: status.error,
          results: status.results
        };
        localStorage.setItem(`job_${jobId}`, JSON.stringify(updatedJobData));
        
        // Update progress and stage
        setUploadProgress(status.progress);
        setEstimatedTimeRemaining(status.estimatedTimeRemaining);
        
        // Update processing stage based on current stage
        const stageMap: Record<string, ProcessingStage> = {
          'queued': {
            name: 'Queued',
            description: 'Your video is in the processing queue...',
            progress: status.progress
          },
          'metadata_extraction': {
            name: 'Analyzing Video',
            description: 'Extracting video metadata and basic information...',
            progress: status.progress
          },
          'frame_extraction': {
            name: 'Processing Slides',
            description: 'Extracting and analyzing slide content...',
            progress: status.progress
          },
          'audio_extraction': {
            name: 'Transcribing Audio',
            description: 'Converting speech to text and analyzing delivery...',
            progress: status.progress
          },
          'finalizing': {
            name: 'Generating Insights',
            description: 'Creating recommendations and final analysis...',
            progress: status.progress
          },
          'completed': {
            name: 'Complete!',
            description: 'Analysis complete. Redirecting to results...',
            progress: 100
          }
        };

        if (status.currentStage && stageMap[status.currentStage]) {
          setProcessingStage(stageMap[status.currentStage]);
        }

        // Handle completion
        if (status.status === 'completed') {
          setUploadStatus('success');
          setUploadProgress(100);
          cleanup(); // Stop polling and clean up registry
          
          // Don't automatically redirect - let user click button instead
          // This prevents issues with navigation and gives user control
          console.log(`Analysis complete for job ${jobId}. Ready to view results.`);
          return; // Stop polling
        }

        // Handle failure
        if (status.status === 'failed') {
          setUploadStatus('error');
          setUploadError(status.error || 'Processing failed');
          cleanup(); // Stop polling and clean up registry
          return; // Stop polling
        }

        // Continue polling if still processing and component is mounted
        if (pollingActive.current) {
          pollingTimeoutRef.current = setTimeout(poll, pollInterval);
        }

      } catch (error) {
        console.error('Status polling error:', error);
        
        // Check if component still mounted before updating state
        if (!pollingActive.current) return;
        
        consecutiveErrors++;
        
        // If we've had too many consecutive errors, stop polling
        if (consecutiveErrors >= maxRetries) {
          setUploadError('Unable to check processing status. Please check results page or try again.');
          setUploadStatus('error');
          cleanup(); // Stop polling and clean up registry
          return;
        }
        
        // Exponential backoff for errors: 60s, 2min, 5min
        const backoffDelay = Math.min(60000 * Math.pow(2, consecutiveErrors - 1), 300000);
        console.log(`Polling error. Retrying in ${backoffDelay / 1000}s... (${consecutiveErrors}/${maxRetries})`);
        
        if (pollingActive.current) {
          pollingTimeoutRef.current = setTimeout(poll, backoffDelay);
        }
      }
    };

    // Start polling
    poll();

    // Clear polling after 10 minutes (fallback)
    const fallbackTimeout = setTimeout(() => {
      if (pollingActive.current && uploadStatus === 'processing') {
        setUploadError('Processing timeout. Please check results page or try again.');
        setUploadStatus('error');
        pollingActive.current = false;
      }
    }, 600000); // 10 minutes
    
    // Clean up fallback timeout when polling stops
    const originalPollingActive = pollingActive.current;
    const cleanupInterval = setInterval(() => {
      if (!pollingActive.current && originalPollingActive) {
        clearTimeout(fallbackTimeout);
        clearInterval(cleanupInterval);
      }
    }, 1000);
  };

  const handleAnalyze = async () => {
    if (file && validationResult?.isValid) {
      await processVideo();
    }
  };

  const isVideo = file && validationResult?.metadata && 
    ['video/mp4', 'video/quicktime', 'video/webm'].includes(validationResult.metadata.type);

  const isUploading = uploadStatus === 'uploading';
  const isProcessing = uploadStatus === 'processing';
  const showProgress = uploadStatus !== 'idle';

  // Format time remaining
  const formatTimeRemaining = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${Math.round(remainingSeconds)}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <Button asChild variant="ghost" className="mb-4">
              <Link href="/">
                ← Back to Home
              </Link>
            </Button>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Upload Your Pitch
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Upload your presentation file to get AI-powered analysis and feedback
            </p>
          </div>

          {/* Progress Section - Enhanced */}
          {showProgress && (
            <Card className="mb-8">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Status Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {uploadStatus === 'uploading' && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                      {uploadStatus === 'processing' && <Loader2 className="h-5 w-5 animate-spin text-orange-600" />}
                      {uploadStatus === 'success' && <CheckCircle className="h-5 w-5 text-green-600" />}
                      {uploadStatus === 'error' && <AlertCircle className="h-5 w-5 text-red-600" />}
                      
                      <span className="font-medium text-gray-900 dark:text-white">
                        {uploadStatus === 'uploading' && 'Uploading Video...'}
                        {uploadStatus === 'processing' && (processingStage?.name || 'Processing...')}
                        {uploadStatus === 'success' && 'Analysis Complete!'}
                        {uploadStatus === 'error' && 'Error'}
                      </span>
                    </div>
                    
                    {uploadStatus !== 'error' && uploadStatus !== 'success' && (
                      <Button 
                        onClick={cancelUpload} 
                        variant="ghost" 
                        size="sm"
                        className="text-gray-500 hover:text-red-600"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="h-3" />
                    <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>{uploadProgress}% complete</span>
                      {estimatedTimeRemaining && uploadStatus === 'processing' && (
                        <span>~{formatTimeRemaining(estimatedTimeRemaining)} remaining</span>
                      )}
                    </div>
                  </div>

                  {/* Processing Stage Description */}
                  {processingStage && uploadStatus === 'processing' && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        {processingStage.description}
                      </p>
                    </div>
                  )}

                  {/* Success Message */}
                  {uploadStatus === 'success' && (
                    <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        {jobId ? (
                          <>Analysis complete! Use the "View Analysis Results" button below to see your results.</>
                        ) : (
                          <>Upload successful! Processing analysis...</>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Validation Messages */}
          {validationResult && !validationResult.isValid && (
            <div className="mb-6 space-y-2">
              {validationResult.errors.map((error, index) => (
                <Alert key={index} variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {validationResult && validationResult.warnings.length > 0 && (
            <div className="mb-6 space-y-2">
              {validationResult.warnings.map((warning, index) => (
                <Alert key={index} variant="default">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{warning}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {validationResult && validationResult.isValid && file && (
            <Alert variant="default" className="mb-6 border-green-200 bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                File validation passed! Ready for upload.
              </AlertDescription>
            </Alert>
          )}

          {/* Enhanced Upload Area */}
          <Card className="mb-8">
            <CardContent className="p-8">
              <div
                className={`
                  relative border-2 border-dashed rounded-lg p-8 text-center 
                  transition-all duration-300 ease-in-out cursor-pointer
                  ${
                    dragActive && dragOver
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 scale-[1.02] shadow-lg ring-2 ring-blue-200 dark:ring-blue-800"
                      : dragActive
                      ? "border-blue-400 bg-blue-25 dark:bg-blue-900/20 scale-[1.01]"
                      : validationResult && !validationResult.isValid
                      ? "border-red-300 dark:border-red-600 hover:border-red-400 dark:hover:border-red-500"
                      : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                  }
                  ${file && validationResult?.isValid ? "border-green-400 bg-green-50 dark:bg-green-900/20" : ""}
                `}
                onDragEnter={handleDragIn}
                onDragLeave={handleDragOut}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                aria-label="File upload drop zone"
                aria-describedby="upload-instructions"
              >
                {/* Visual feedback overlay */}
                {dragActive && (
                  <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-400/10 rounded-lg animate-pulse" />
                )}
                
                {file && validationResult?.isValid ? (
                  <div className="space-y-4 relative z-10">
                    <div className="text-green-600 dark:text-green-400 text-xl animate-bounce">
                      ✓ File Ready
                    </div>
                    <div className="text-lg font-medium text-gray-900 dark:text-white">
                      {file.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                      <div>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                      <div className="text-xs text-gray-400">
                        {validationResult.metadata?.type}
                      </div>
                      {isVideo && (
                        <div className="text-blue-600 dark:text-blue-400 font-medium">
                          🎥 Video file - Voice analysis available
                        </div>
                      )}
                    </div>
                    <Button 
                      onClick={clearFile} 
                      variant="outline"
                      className="transition-all duration-200 hover:scale-105"
                    >
                      Choose Different File
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 relative z-10">
                    <div className={`text-4xl transition-all duration-300 ${
                      dragActive ? "scale-110 animate-bounce" : ""
                    }`}>
                      {dragActive ? "📁" : "📎"}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        {dragActive ? "Drop your file here!" : "Drop your file here"}
                      </h3>
                      <p 
                        className="text-gray-500 dark:text-gray-400 mb-4"
                        id="upload-instructions"
                      >
                        Supports video files (.mp4, .mov, .webm)
                        <br />
                        <span className="text-xs">Maximum file size: 100MB</span>
                      </p>
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                        onChange={handleFileChange}
                        aria-label="Select file for upload"
                      />
                      <label htmlFor="file-upload">
                        <Button 
                          variant="outline" 
                          className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                            dragActive ? "scale-105 shadow-md" : ""
                          }`}
                        >
                          Browse Files
                        </Button>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Analysis Options */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Analysis Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="content-analysis" 
                    checked={analysisOptions.contentAnalysis}
                    onCheckedChange={(checked) => 
                      setAnalysisOptions(prev => ({ ...prev, contentAnalysis: checked as boolean }))
                    }
                  />
                  <label 
                    htmlFor="content-analysis" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Content Analysis
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="structure-flow" 
                    checked={analysisOptions.structureFlow}
                    onCheckedChange={(checked) => 
                      setAnalysisOptions(prev => ({ ...prev, structureFlow: checked as boolean }))
                    }
                  />
                  <label 
                    htmlFor="structure-flow" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Structure & Flow
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="persuasiveness" 
                    checked={analysisOptions.persuasiveness}
                    onCheckedChange={(checked) => 
                      setAnalysisOptions(prev => ({ ...prev, persuasiveness: checked as boolean }))
                    }
                  />
                  <label 
                    htmlFor="persuasiveness" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Persuasiveness Score
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="voice-analysis" 
                    checked={analysisOptions.voiceAnalysis}
                    onCheckedChange={(checked) => 
                      setAnalysisOptions(prev => ({ ...prev, voiceAnalysis: checked as boolean }))
                    }
                  />
                  <label 
                    htmlFor="voice-analysis" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Voice Analysis (for video files)
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Display */}
          {uploadError && (
            <Alert variant="destructive" className="mb-8">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Main action button - Start Analysis or View Results */}
            {uploadStatus === 'success' && jobId ? (
              // Show View Results button when processing is complete
              <Button 
                onClick={() => router.push(`/results/${jobId}`)}
                className="flex-1"
                size="lg"
                variant="default"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                View Analysis Results
              </Button>
            ) : uploadStatus === 'error' && uploadError?.includes('temporarily unavailable') && jobId ? (
              // Show Check Results button when rate limiting stops polling
              <Button 
                onClick={() => router.push(`/results/${jobId}`)}
                className="flex-1"
                size="lg"
                variant="default"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Check Results
              </Button>
            ) : (
              // Show Start Analysis button when ready to upload
              <Button 
                onClick={handleAnalyze} 
                disabled={!file || !validationResult?.isValid || isUploading || isProcessing}
                className="flex-1"
                size="lg"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading... {uploadProgress}%
                  </>
                ) : isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {processingStage?.name || 'Processing...'}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Start Analysis
                  </>
                )}
              </Button>
            )}
            
            {/* Secondary action button */}
            {uploadStatus === 'success' && jobId ? (
              // Show Upload Another button when processing is complete
              <Button 
                onClick={clearFile}
                variant="outline" 
                className="flex-1" 
                size="lg"
              >
                Upload Another
              </Button>
            ) : uploadStatus === 'error' && uploadError?.includes('temporarily unavailable') ? (
              // Show Upload Another button when rate limiting stops polling
              <Button 
                onClick={clearFile}
                variant="outline" 
                className="flex-1" 
                size="lg"
              >
                Upload Another
              </Button>
            ) : (
              // Show View Sample Results when not processing
              <Button asChild variant="outline" className="flex-1" size="lg">
                <Link href="/results">
                  View Sample Results
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 