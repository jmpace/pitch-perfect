import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function Home() {
  // Sample framework data for preview
  const frameworkCategories = [
    {
      category: "Speech Mechanics",
      weight: "30%",
      color: "from-blue-500 to-blue-600",
      points: [
        "Pace and Rhythm",
        "Volume and Projection",
        "Clarity and Articulation",
        "Filler Words and Pauses",
        "Vocal Confidence"
      ]
    },
    {
      category: "Content Quality", 
      weight: "40%",
      color: "from-green-500 to-green-600",
      points: [
        "Problem Definition Clarity",
        "Solution Explanation",
        "Market Size Validation",
        "Traction Demonstration",
        "Financial Projections"
      ]
    },
    {
      category: "Visual Presentation",
      weight: "20%", 
      color: "from-purple-500 to-purple-600",
      points: [
        "Slide Design Effectiveness",
        "Data Visualization Quality",
        "Timing and Flow"
      ]
    },
    {
      category: "Overall Effectiveness",
      weight: "10%",
      color: "from-orange-500 to-orange-600", 
      points: [
        "Persuasion and Storytelling",
        "Confidence and Credibility"
      ]
    }
  ];

  const sampleScores = {
    overall: 82,
    categories: {
      speech: 78,
      content: 85,
      visual: 80,
      effectiveness: 84
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Pitch Perfect
            </h1>
            <p className="text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Transform your presentations with AI-powered analysis using our comprehensive{" "}
              <span className="font-semibold text-blue-600 dark:text-blue-400">15-point framework</span>.
              Get instant, actionable feedback to make every pitch count.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button asChild size="lg" className="text-lg px-8 py-4">
                <Link href="/upload">
                  Analyze Your Pitch Now
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 py-4">
                <Link href="/results">
                  View Sample Analysis
                </Link>
              </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">15</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Evaluation Points</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">4</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Core Categories</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">AI</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Powered Analysis</div>
              </div>
            </div>
          </div>

          {/* 15-Point Framework Section */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                The 15-Point Framework
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Our research-backed framework evaluates every aspect of your presentation,
                from speech delivery to content structure, providing comprehensive insights
                that traditional feedback can&apos;t match.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {frameworkCategories.map((category, index) => (
                <Card key={index} className="relative overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{category.category}</CardTitle>
                      <Badge variant="secondary" className="text-sm">
                        {category.weight}
                      </Badge>
                    </div>
                    <div className={`h-1 w-full bg-gradient-to-r ${category.color} rounded-full`} />
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {category.points.map((point, pointIndex) => (
                        <li key={pointIndex} className="flex items-center text-gray-600 dark:text-gray-300">
                          <span className="w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-semibold mr-3">
                            {category === frameworkCategories[0] ? pointIndex + 1 :
                             category === frameworkCategories[1] ? pointIndex + 6 :
                             category === frameworkCategories[2] ? pointIndex + 11 :
                             pointIndex + 14}
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Sample Results Preview */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                See What You'll Get
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Our AI analyzes your pitch video and provides detailed scores and actionable recommendations across all framework categories.
              </p>
            </div>

            <Card className="max-w-4xl mx-auto">
              <CardHeader>
                <CardTitle className="text-center">Sample Analysis Results</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Overall Score Display */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white text-2xl font-bold mb-4">
                    {sampleScores.overall}
                  </div>
                  <p className="text-lg text-gray-600 dark:text-gray-300">
                    Overall Pitch Score
                  </p>
                </div>

                {/* Category Breakdown */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 dark:text-gray-300">Speech Mechanics</span>
                        <Badge variant="secondary">{sampleScores.categories.speech}/100</Badge>
                      </div>
                      <Progress value={sampleScores.categories.speech} className="w-full" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 dark:text-gray-300">Content Quality</span>
                        <Badge variant="secondary">{sampleScores.categories.content}/100</Badge>
                      </div>
                      <Progress value={sampleScores.categories.content} className="w-full" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 dark:text-gray-300">Visual Presentation</span>
                        <Badge variant="secondary">{sampleScores.categories.visual}/100</Badge>
                      </div>
                      <Progress value={sampleScores.categories.visual} className="w-full" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 dark:text-gray-300">Overall Effectiveness</span>
                        <Badge variant="secondary">{sampleScores.categories.effectiveness}/100</Badge>
                      </div>
                      <Progress value={sampleScores.categories.effectiveness} className="w-full" />
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <Button asChild variant="outline">
                    <Link href="/results">
                      View Full Sample Report
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Key Benefits */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Why Choose Pitch Perfect?
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Get professional-grade feedback in minutes, not days.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <Card className="text-center">
                <CardHeader>
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <CardTitle>Comprehensive Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-300">
                    Our 15-point framework covers every aspect of your presentation - from speech delivery to visual design and content structure.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="text-center">
                <CardHeader>
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">⚡</span>
                  </div>
                  <CardTitle>Instant Feedback</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-300">
                    Upload your video and receive detailed analysis in minutes. No more waiting weeks for coaching sessions or peer review.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="text-center">
                <CardHeader>
                  <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📊</span>
                  </div>
                  <CardTitle>Actionable Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-300">
                    Receive specific, measurable recommendations that you can implement immediately to improve your pitch performance.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Final CTA */}
          <div className="text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-white">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Perfect Your Pitch?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Join hundreds of founders who&apos;ve improved their presentations with our AI-powered analysis.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-3">
                <Link href="/upload">
                  Get Started Now
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="text-lg px-8 py-3 text-white border-white hover:bg-white/10">
                <Link href="/results">
                  View Sample Results
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 