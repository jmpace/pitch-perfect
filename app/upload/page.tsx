"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { validateFileDetailed, type FileValidationResult } from "@/lib/validation";
import { AlertCircle, CheckCircle, AlertTriangle, Upload, X, Loader2 } from "lucide-react";
import { useSanitizedFile } from "@/lib/sanitization/client";

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error' | 'cancelled';

export default function UploadPage() {
  const [dragActive, setDragActive] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragCounter, setDragCounter] = useState(0);
  const [validationResult, setValidationResult] = useState<FileValidationResult | null>(null);
  
  // Progress tracking states
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Sanitization hooks
  const { createSanitizedFile, isDangerousFilename } = useSanitizedFile();

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

  const clearFile = () => {
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

  const cancelUpload = () => {
    setUploadStatus('cancelled');
    setUploadError('Upload cancelled by user');
    setUploadProgress(0);
  };

  // Simulate upload progress (replace with real upload logic later)
  const simulateUpload = async () => {
    setUploadStatus('uploading');
    setUploadError(null);
    setUploadProgress(0);

    try {
      // Additional client-side security check before upload
      if (file && isDangerousFilename(file.name)) {
        throw new Error('File contains dangerous content and cannot be uploaded');
      }

      // Simulate upload progress
      for (let i = 0; i <= 100; i += 2) {
        if (uploadStatus === 'cancelled') {
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
        setUploadProgress(i);
      }
      
      setUploadStatus('success');
      console.log("Upload completed successfully for file:", file?.name);
    } catch (error) {
      setUploadStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Upload failed. Please try again.';
      setUploadError(errorMessage);
      console.error("Upload error:", error);
    }
  };

  const handleAnalyze = async () => {
    if (file && validationResult?.isValid) {
      await simulateUpload();
    }
  };

  const isVideo = file && validationResult?.metadata && 
    ['video/mp4', 'video/quicktime', 'video/webm'].includes(validationResult.metadata.type);

  const isUploading = uploadStatus === 'uploading';
  const showProgress = uploadStatus !== 'idle';

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

          {/* Upload Progress */}
          {showProgress && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {uploadStatus === 'uploading' && 'Uploading...'}
                      {uploadStatus === 'success' && 'Upload Complete!'}
                      {uploadStatus === 'error' && 'Upload Failed'}
                      {uploadStatus === 'cancelled' && 'Upload Cancelled'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {uploadProgress}%
                    </span>
                  </div>
                  
                  <Progress value={uploadProgress} className="w-full" />
                  
                  {/* Upload Controls */}
                  <div className="flex justify-end space-x-2">
                    {isUploading && (
                      <Button
                        onClick={cancelUpload}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    )}
                    
                    {uploadStatus === 'success' && (
                      <Button
                        onClick={clearFile}
                        variant="outline"
                        size="sm"
                      >
                        Upload Another
                      </Button>
                    )}
                    
                    {uploadStatus === 'error' && (
                      <Button
                        onClick={handleAnalyze}
                        variant="outline"
                        size="sm"
                      >
                        Retry Upload
                      </Button>
                    )}
                  </div>
                  
                  {uploadError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{uploadError}</AlertDescription>
                    </Alert>
                  )}
                  
                  {uploadStatus === 'success' && file && (
                    <Alert variant="default" className="border-green-200 bg-green-50 dark:bg-green-900/20">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        {file.name} uploaded successfully! Processing analysis...
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
                  <Checkbox id="content-analysis" defaultChecked />
                  <label 
                    htmlFor="content-analysis" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Content Analysis
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="structure-flow" defaultChecked />
                  <label 
                    htmlFor="structure-flow" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Structure & Flow
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="persuasiveness" defaultChecked />
                  <label 
                    htmlFor="persuasiveness" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Persuasiveness Score
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="voice-analysis" />
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

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              onClick={handleAnalyze} 
              disabled={!file || !validationResult?.isValid || isUploading}
              className="flex-1"
              size="lg"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading... {uploadProgress}%
                </>
              ) : uploadStatus === 'success' ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Upload Complete
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Start Analysis
                </>
              )}
            </Button>
            <Button asChild variant="outline" className="flex-1" size="lg">
              <Link href="/results">
                View Sample Results
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 