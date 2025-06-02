import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExportRecommendations from "@/components/export-recommendations";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface VideoProcessingResult {
  jobId: string;
  status: string;
  results: {
    frames: Array<{
      timestamp: number;
      url: string;
      size: number;
      width: number;
      height: number;
    }>;
    audio: {
      url: string;
      duration: number;
      format: string;
      size: number;
      sampleRate: number;
      channels: number;
    };
    videoMetadata: {
      duration: number;
      resolution: string;
      fps: number;
      codec: string;
      size: number;
      format: string;
    };
    processingStats: {
      processingTime: number;
      memoryUsed: number;
      framesExtracted: number;
      audioExtracted: boolean;
    };
  };
  completedAt: string;
}

async function fetchJobResults(jobId: string): Promise<VideoProcessingResult | null> {
  try {
    const response = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3003'}/api/video/result/${jobId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Job not found
      }
      throw new Error(`Failed to fetch job results: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching job results:', error);
    return null;
  }
}

export default async function ResultPage({ params }: PageProps) {
  const { id } = await params;
  
  // Try to fetch real video processing results
  const jobResult = await fetchJobResults(id);
  
  if (!jobResult) {
    // If no real job found, check if it's a demo ID
    const validDemoIds = ["sample-1", "demo-pitch", "startup-deck"];
    
    if (!validDemoIds.includes(id)) {
      notFound();
    }

    // Return demo content for valid demo IDs
    const demoResult = {
      id: id,
      fileName: `${id.replace(/-/g, ' ')}.pptx`,
      analysisDate: "2024-05-29",
      overallScore: 82,
      detailedAnalysis: {
        summary: "This pitch demonstrates strong foundational elements with clear room for enhancement in specific areas.",
        keyInsights: [
          "Strong opening that captures attention effectively",
          "Well-structured problem-solution framework",
          "Compelling market opportunity presentation",
          "Clear value proposition articulation"
        ],
        recommendations: [
          {
            category: "Content",
            priority: "High", 
            suggestion: "Include more specific market size data and competitor analysis"
          },
          {
            category: "Delivery",
            priority: "Medium",
            suggestion: "Add more pauses for emphasis and audience engagement"
          },
          {
            category: "Structure",
            priority: "Low",
            suggestion: "Consider reordering slides for better flow"
          }
        ]
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            {/* Navigation */}
            <div className="mb-8">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                <Link href="/" className="hover:text-blue-600">Home</Link>
                <span>→</span>
                <Link href="/results" className="hover:text-blue-600">Results</Link>
                <span>→</span>
                <span className="text-gray-900 dark:text-white">{demoResult.fileName}</span>
              </div>
              
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Demo Analysis
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-lg text-gray-600 dark:text-gray-300">
                    {demoResult.fileName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Demo ID: {demoResult.id} • {new Date(demoResult.analysisDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline">
                    <Link href="/results">
                      Back to Results
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href="/upload">
                      New Analysis
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Demo content continues with the existing structure... */}
            <Card className="mb-8">
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                      Overall Score
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300">
                      {demoResult.detailedAnalysis.summary}
                    </p>
                  </div>
                  <div className="flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white text-3xl font-bold">
                    {demoResult.overallScore}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Key Insights */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Key Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {demoResult.detailedAnalysis.keyInsights.map((insight, index) => (
                    <div key={index} className="flex items-start p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <span className="text-blue-600 dark:text-blue-400 mr-3 mt-0.5">💡</span>
                      <p className="text-gray-700 dark:text-gray-300">{insight}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Detailed Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {demoResult.detailedAnalysis.recommendations.map((rec, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-6 py-2">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {rec.category}
                        </h3>
                        <Badge 
                          variant={rec.priority === 'High' ? 'destructive' : rec.priority === 'Medium' ? 'default' : 'secondary'}
                        >
                          {rec.priority} Priority
                        </Badge>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300">{rec.suggestion}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <ExportRecommendations
                recommendations={[]}
                context={{
                  sessionId: demoResult.id,
                  overallAssessment: {
                    primaryStrengths: demoResult.detailedAnalysis.keyInsights,
                    primaryWeaknesses: demoResult.detailedAnalysis.recommendations.map(r => r.suggestion),
                    scorePercentile: demoResult.overallScore,
                    competitivePosition: 'Above Average'
                  }
                }}
                variant="button"
              />
              <Button variant="outline" size="lg" className="px-8">
                Share Results
              </Button>
              <Button asChild variant="outline" size="lg" className="px-8">
                <Link href="/upload">
                  Analyze New Pitch
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Display real video processing results
  const { results, completedAt } = jobResult;
  const processingDate = new Date(completedAt).toLocaleDateString();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Navigation */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
              <Link href="/" className="hover:text-blue-600">Home</Link>
              <span>→</span>
              <Link href="/results" className="hover:text-blue-600">Results</Link>
              <span>→</span>
              <span className="text-gray-900 dark:text-white">Video Processing Results</span>
            </div>
            
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Video Processing Results
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-lg text-gray-600 dark:text-gray-300">
                  Processing Job: {id}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Completed: {processingDate}
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href="/upload">
                    Process New Video
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Video Metadata */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Video Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Basic Info</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Duration:</span> {results.videoMetadata.duration.toFixed(2)} seconds</p>
                    <p><span className="font-medium">Resolution:</span> {results.videoMetadata.resolution}</p>
                    <p><span className="font-medium">FPS:</span> {results.videoMetadata.fps}</p>
                    <p><span className="font-medium">Codec:</span> {results.videoMetadata.codec}</p>
                    <p><span className="font-medium">Format:</span> {results.videoMetadata.format}</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Processing Stats</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Processing Time:</span> {(results.processingStats.processingTime / 1000).toFixed(2)} seconds</p>
                    <p><span className="font-medium">Memory Used:</span> {(results.processingStats.memoryUsed / 1024 / 1024).toFixed(2)} MB</p>
                    <p><span className="font-medium">Frames Extracted:</span> {results.processingStats.framesExtracted}</p>
                    <p><span className="font-medium">Audio Extracted:</span> {results.processingStats.audioExtracted ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Serverless Limitations Notice */}
          <Card className="mb-8 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
            <CardHeader>
              <CardTitle className="text-yellow-800 dark:text-yellow-200">Serverless Environment Notice</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-yellow-700 dark:text-yellow-300">
                This video was processed in a serverless environment with limited capabilities. 
                Only basic metadata extraction is currently supported. Frame extraction, audio extraction, 
                and quality analysis are not available in this environment.
              </p>
            </CardContent>
          </Card>

          {/* Audio Information (if available) */}
          {results.audio && results.audio.url && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Audio Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Duration:</span> {results.audio.duration.toFixed(2)} seconds</p>
                    <p><span className="font-medium">Format:</span> {results.audio.format}</p>
                    <p><span className="font-medium">Sample Rate:</span> {results.audio.sampleRate} Hz</p>
                    <p><span className="font-medium">Channels:</span> {results.audio.channels}</p>
                  </div>
                  {results.audio.url && (
                    <div>
                      <p className="font-medium mb-2">Audio File:</p>
                      <Button asChild variant="outline" size="sm">
                        <a href={results.audio.url} target="_blank" rel="noopener noreferrer">
                          Download Audio
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Extracted Frames (if available) */}
          {results.frames && results.frames.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Extracted Frames ({results.frames.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {results.frames.map((frame, index) => (
                    <div key={index} className="space-y-2">
                      <img 
                        src={frame.url} 
                        alt={`Frame at ${frame.timestamp}s`}
                        className="w-full h-auto rounded-lg shadow-sm"
                      />
                      <div className="text-xs text-center text-gray-500 dark:text-gray-400">
                        {frame.timestamp.toFixed(1)}s • {frame.width}×{frame.height}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild variant="outline" size="lg" className="px-8">
              <Link href="/upload">
                Process New Video
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 