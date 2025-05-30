import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function ResultsPage() {
  // Mock data for demonstration
  const sampleResults = {
    overallScore: 82,
    analysisDate: "2024-05-29",
    fileName: "startup-pitch-deck.pptx",
    metrics: {
      contentClarity: 85,
      structure: 78,
      persuasiveness: 84,
      engagement: 80
    },
    strengths: [
      "Clear problem statement and solution",
      "Strong market opportunity presentation",
      "Compelling value proposition",
      "Good use of visual elements"
    ],
    improvements: [
      "Add more specific market size data",
      "Include customer testimonials",
      "Clarify revenue model details",
      "Strengthen call-to-action"
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Button asChild variant="ghost" className="mb-4">
              <Link href="/">
                ← Back to Home
              </Link>
            </Button>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Analysis Results
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-lg text-gray-600 dark:text-gray-300">
                  {sampleResults.fileName}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Analyzed on {new Date(sampleResults.analysisDate).toLocaleDateString()}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/upload">
                  Analyze Another Pitch
                </Link>
              </Button>
            </div>
          </div>

          {/* Overall Score */}
          <Card className="mb-8">
            <CardContent className="p-8">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  Overall Score
                </h2>
                <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white text-4xl font-bold mb-4">
                  {sampleResults.overallScore}
                </div>
                <p className="text-lg text-gray-600 dark:text-gray-300">
                  Great work! Your pitch shows strong potential.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Metrics Breakdown */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Detailed Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {Object.entries(sampleResults.metrics).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 dark:text-gray-300 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <Badge variant="secondary">
                        {value}/100
                      </Badge>
                    </div>
                    <Progress value={value} className="w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Strengths and Improvements */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Strengths */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {sampleResults.strengths.map((strength, index) => (
                    <li key={index} className="text-gray-600 dark:text-gray-300 flex items-start">
                      <span className="text-green-500 mr-2 mt-0.5">•</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Improvements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <span className="text-amber-500 mr-2">⚡</span>
                  Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {sampleResults.improvements.map((improvement, index) => (
                    <li key={index} className="text-gray-600 dark:text-gray-300 flex items-start">
                      <span className="text-amber-500 mr-2 mt-0.5">•</span>
                      {improvement}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="px-8">
              Download Report
            </Button>
            <Button asChild variant="outline" size="lg" className="px-8">
              <Link href="/upload">
                Upload New Pitch
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 