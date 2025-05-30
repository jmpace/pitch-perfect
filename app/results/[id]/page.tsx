import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ResultPage({ params }: PageProps) {
  const { id } = await params;
  
  // In a real app, you would fetch data based on the ID
  // For now, we'll use mock data and show a 404 for invalid IDs
  const validIds = ["sample-1", "demo-pitch", "startup-deck"];
  
  if (!validIds.includes(id)) {
    notFound();
  }

  // Mock data for the specific result
  const result = {
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
              <span className="text-gray-900 dark:text-white">{result.fileName}</span>
            </div>
            
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Detailed Analysis
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-lg text-gray-600 dark:text-gray-300">
                  {result.fileName}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Analysis ID: {result.id} • {new Date(result.analysisDate).toLocaleDateString()}
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

          {/* Score Summary */}
          <Card className="mb-8">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                    Overall Score
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300">
                    {result.detailedAnalysis.summary}
                  </p>
                </div>
                <div className="flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white text-3xl font-bold">
                  {result.overallScore}
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
                {result.detailedAnalysis.keyInsights.map((insight, index) => (
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
                {result.detailedAnalysis.recommendations.map((rec, index) => (
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
            <Button size="lg" className="px-8">
              Download Full Report
            </Button>
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