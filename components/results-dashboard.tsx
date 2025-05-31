'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface FrameworkScore {
  id: string;
  name: string;
  score: number;
  category: string;
  description: string;
  feedback: string;
  recommendations: string[];
}

interface DashboardData {
  overallScore: number;
  analysisDate: string;
  fileName: string;
  frameworkScores: FrameworkScore[];
}

interface ResultsDashboardProps {
  data: DashboardData;
}

// Centralized color-coding system configuration
const SCORE_THRESHOLDS = {
  EXCELLENT: 85,
  GOOD: 70,
  FAIR: 55,
  POOR: 0
} as const;

const COLOR_SCHEME = {
  excellent: {
    text: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    solid: "bg-green-500",
    gradient: "bg-gradient-to-br from-green-400 to-green-600",
    ring: "ring-green-200",
    icon: "🎯",
    label: "Excellent"
  },
  good: {
    text: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    solid: "bg-blue-500",
    gradient: "bg-gradient-to-br from-blue-400 to-blue-600",
    ring: "ring-blue-200",
    icon: "👍",
    label: "Good"
  },
  fair: {
    text: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    solid: "bg-yellow-500",
    gradient: "bg-gradient-to-br from-yellow-400 to-yellow-600",
    ring: "ring-yellow-200",
    icon: "⚠️",
    label: "Fair"
  },
  poor: {
    text: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    solid: "bg-red-500",
    gradient: "bg-gradient-to-br from-red-400 to-red-600",
    ring: "ring-red-200",
    icon: "🔧",
    label: "Needs Work"
  }
} as const;

// Enhanced helper functions using centralized color scheme
function getScoreLevel(score: number): keyof typeof COLOR_SCHEME {
  if (score >= SCORE_THRESHOLDS.EXCELLENT) return "excellent";
  if (score >= SCORE_THRESHOLDS.GOOD) return "good";
  if (score >= SCORE_THRESHOLDS.FAIR) return "fair";
  return "poor";
}

function getScoreColor(score: number): string {
  const level = getScoreLevel(score);
  const colors = COLOR_SCHEME[level];
  return `${colors.text} ${colors.bg} ${colors.border}`;
}

function getScoreGradient(score: number): string {
  const level = getScoreLevel(score);
  return COLOR_SCHEME[level].gradient;
}

function getScoreSolid(score: number): string {
  const level = getScoreLevel(score);
  return COLOR_SCHEME[level].solid;
}

function getScoreIcon(score: number): string {
  const level = getScoreLevel(score);
  return `${COLOR_SCHEME[level].icon} ${COLOR_SCHEME[level].label}`;
}

// Helper function to get progress bar color
function getProgressColor(score: number): string {
  return getScoreSolid(score);
}

// Helper function to get score badge variant
function getScoreBadgeVariant(score: number): "default" | "secondary" | "destructive" | "outline" {
  const level = getScoreLevel(score);
  switch (level) {
    case "excellent": return "default";
    case "good": return "secondary";
    case "fair": return "outline";
    case "poor": return "destructive";
  }
}

export default function ResultsDashboard({ data }: ResultsDashboardProps) {
  // State for collapsible sections
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedFrameworks, setExpandedFrameworks] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Helper functions for collapsible state
  const toggleCategoryExpansion = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleFrameworkExpansion = (frameworkId: string) => {
    const newExpanded = new Set(expandedFrameworks);
    if (newExpanded.has(frameworkId)) {
      newExpanded.delete(frameworkId);
    } else {
      newExpanded.add(frameworkId);
    }
    setExpandedFrameworks(newExpanded);
  };

  // Group framework scores by category
  const groupedScores = data.frameworkScores.reduce((acc, score) => {
    if (!acc[score.category]) {
      acc[score.category] = [];
    }
    acc[score.category].push(score);
    return acc;
  }, {} as Record<string, FrameworkScore[]>);

  const categories = Object.keys(groupedScores);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <Button asChild variant="ghost" className="mb-4">
              <Link href="/">
                ← Back to Home
              </Link>
            </Button>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Pitch Analysis Dashboard
            </h1>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300">
                  {data.fileName}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Analyzed on {new Date(data.analysisDate).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/upload">
                    Analyze Another Pitch
                  </Link>
                </Button>
                <Button variant="default" className="w-full sm:w-auto">
                  Download Report
                </Button>
              </div>
            </div>
          </div>

          {/* Overall Score Card */}
          <Card className="mb-6 sm:mb-8">
            <CardContent className="p-4 sm:p-6 lg:p-8">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="text-center lg:text-left w-full lg:w-auto">
                  <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white mb-2">
                    Overall Score
                  </h2>
                  <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-md mx-auto lg:mx-0">
                    Your pitch demonstrates strong potential with clear areas for improvement.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center lg:justify-start gap-2">
                    <Badge variant="outline" className={COLOR_SCHEME.excellent.text}>
                      {data.frameworkScores.filter(f => f.score >= SCORE_THRESHOLDS.EXCELLENT).length} {COLOR_SCHEME.excellent.label}
                    </Badge>
                    <Badge variant="outline" className={COLOR_SCHEME.good.text}>
                      {data.frameworkScores.filter(f => f.score >= SCORE_THRESHOLDS.GOOD && f.score < SCORE_THRESHOLDS.EXCELLENT).length} {COLOR_SCHEME.good.label}
                    </Badge>
                    <Badge variant="outline" className={COLOR_SCHEME.fair.text}>
                      {data.frameworkScores.filter(f => f.score >= SCORE_THRESHOLDS.FAIR && f.score < SCORE_THRESHOLDS.GOOD).length} {COLOR_SCHEME.fair.label}
                    </Badge>
                    <Badge variant="outline" className={COLOR_SCHEME.poor.text}>
                      {data.frameworkScores.filter(f => f.score < SCORE_THRESHOLDS.FAIR).length} {COLOR_SCHEME.poor.label}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4 flex-shrink-0">
                  <div className={`flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full text-white text-2xl sm:text-3xl lg:text-4xl font-bold shadow-lg ${getScoreGradient(data.overallScore)}`}>
                    {data.overallScore}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {COLOR_SCHEME[getScoreLevel(data.overallScore)].label}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Collapsible Category Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {categories.map((category) => {
              const categoryScores = groupedScores[category];
              const avgScore = Math.round(categoryScores.reduce((sum, score) => sum + score.score, 0) / categoryScores.length);
              const isExpanded = expandedCategories.has(category);
              
              return (
                <Card key={category} className={`transition-all hover:shadow-lg border-2 ${getScoreColor(avgScore)} ${isExpanded ? 'col-span-1 sm:col-span-2' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base sm:text-lg font-semibold line-clamp-2">{category}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCategoryExpansion(category)}
                        className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {categoryScores.length} metrics
                      </span>
                      <Badge variant={getScoreBadgeVariant(avgScore)} className="text-xs">
                        {avgScore}/100
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <Progress value={avgScore} className="w-full h-2" />
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Min: {Math.min(...categoryScores.map(s => s.score))}</span>
                        <span>Max: {Math.max(...categoryScores.map(s => s.score))}</span>
                      </div>
                    </div>
                    
                    {/* Collapsible detailed breakdown */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-1 duration-200">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                          Framework Breakdown
                        </h4>
                        <div className="space-y-3">
                          {categoryScores.map((framework) => (
                            <div key={framework.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {framework.name}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Progress value={framework.score} className="flex-1 h-2" />
                                  <Badge variant={getScoreBadgeVariant(framework.score)} className="text-xs">
                                    {framework.score}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Color Legend */}
          <Card className="mb-6 sm:mb-8 bg-gray-50 dark:bg-gray-800/50">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                  Performance Scale
                </h3>
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 sm:gap-4">
                  {Object.entries(COLOR_SCHEME).map(([level, colors]) => (
                    <div key={level} className="flex items-center gap-1 sm:gap-2">
                      <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${colors.solid}`} />
                      <span className={`text-xs sm:text-sm font-medium ${colors.text}`}>
                        {colors.icon} {colors.label}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                        ({level === 'excellent' ? '85+' : 
                          level === 'good' ? '70-84' : 
                          level === 'fair' ? '55-69' : '<55'})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Framework Scores - Tabs and Grid Layout */}
          <div className="space-y-6 sm:space-y-8">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
                <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
                <TabsTrigger value="detailed" className="text-xs sm:text-sm">Detailed</TabsTrigger>
                <TabsTrigger value="recommendations" className="text-xs sm:text-sm">Tips</TabsTrigger>
                <TabsTrigger value="export" className="text-xs sm:text-sm">Export</TabsTrigger>
              </TabsList>

              {/* Enhanced Overview Tab with Collapsible Framework Cards */}
              <TabsContent value="overview" className="space-y-6">
                {/* Collapsible Filters Section */}
                <Card className="bg-gray-50 dark:bg-gray-800/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Framework Overview</h3>
                        <Badge variant="outline" className="text-xs">
                          {data.frameworkScores.length} total
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                        className="h-8 px-3 text-xs"
                      >
                        {showFilters ? 'Hide' : 'Show'} Filters
                        {showFilters ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </div>
                    
                    {/* Collapsible Filter Controls */}
                    {showFilters && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-1 duration-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {categories.map((category) => {
                            const categoryScores = groupedScores[category];
                            const avgScore = Math.round(categoryScores.reduce((sum, score) => sum + score.score, 0) / categoryScores.length);
                            return (
                              <div key={category} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded-lg">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{category}</span>
                                <Badge variant={getScoreBadgeVariant(avgScore)} className="text-xs">
                                  {avgScore}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
                  {data.frameworkScores.map((framework) => {
                    const isExpanded = expandedFrameworks.has(framework.id);
                    return (
                      <Card key={framework.id} className={`transition-all hover:shadow-lg border-2 ${getScoreColor(framework.score)} ${isExpanded ? 'col-span-1 sm:col-span-2' : 'hover:scale-105'}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className={`w-3 h-3 rounded-full ${getScoreSolid(framework.score)} flex-shrink-0`} />
                              <CardTitle className="text-sm sm:text-base lg:text-lg font-semibold truncate" title={framework.name}>
                                {framework.name}
                              </CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={getScoreBadgeVariant(framework.score)} className="text-xs flex-shrink-0">
                                {framework.score}/100
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleFrameworkExpansion(framework.id)}
                                className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            {framework.category}
                          </p>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-3">
                            <div className="relative">
                              <Progress 
                                value={framework.score} 
                                className="w-full h-3"
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-medium text-white drop-shadow-sm">
                                  {framework.score}%
                                </span>
                              </div>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                              {framework.description}
                            </p>
                            <div className="flex items-center justify-between text-xs">
                              <span className={`font-medium ${COLOR_SCHEME[getScoreLevel(framework.score)].text}`}>
                                {getScoreIcon(framework.score)}
                              </span>
                              <span className="text-gray-400">
                                {framework.recommendations.length} tips
                              </span>
                            </div>

                            {/* Collapsible detailed content */}
                            {isExpanded && (
                              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-1 duration-200 space-y-4">
                                {/* Feedback Section */}
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                    Feedback
                                  </h4>
                                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                    {framework.feedback}
                                  </p>
                                </div>

                                {/* Recommendations Section */}
                                {framework.recommendations.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                      Recommendations ({framework.recommendations.length})
                                    </h4>
                                    <ul className="space-y-2">
                                      {framework.recommendations.map((rec, index) => (
                                        <li key={index} className="flex items-start gap-2">
                                          <span className="text-blue-500 mt-1 flex-shrink-0">•</span>
                                          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                            {rec}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Quick Actions */}
                                <div className="flex gap-2 pt-2">
                                  <Button variant="outline" size="sm" className="text-xs h-7">
                                    Focus Area
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-xs h-7">
                                    View Details
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              {/* Detailed View Tab */}
              <TabsContent value="detailed" className="space-y-6">
                <Accordion type="multiple" className="w-full space-y-4">
                  {categories.map((category) => (
                    <AccordionItem key={category} value={category} className="border rounded-lg px-4 sm:px-6">
                      <AccordionTrigger className="text-lg sm:text-xl font-semibold">
                        <div className="flex items-center gap-3">
                          <span className="text-left">{category}</span>
                          <Badge variant="outline" className="text-xs">
                            {groupedScores[category].length} metrics
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                          {groupedScores[category].map((framework) => (
                            <Card key={framework.id} className={`border-2 ${getScoreColor(framework.score)}`}>
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-base sm:text-lg font-semibold">{framework.name}</CardTitle>
                                  <Badge variant={getScoreBadgeVariant(framework.score)} className="text-xs">
                                    {framework.score}/100
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0 space-y-4">
                                <div className="relative">
                                  <Progress value={framework.score} className="w-full h-3" />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xs font-medium text-white drop-shadow-sm">
                                      {framework.score}%
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Description</h4>
                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{framework.description}</p>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Feedback</h4>
                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{framework.feedback}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </TabsContent>

              {/* Recommendations Tab */}
              <TabsContent value="recommendations" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {data.frameworkScores
                    .filter(framework => framework.recommendations.length > 0)
                    .map((framework) => (
                      <Card key={framework.id} className={`border-2 ${getScoreColor(framework.score)}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base sm:text-lg font-semibold">{framework.name}</CardTitle>
                            <Badge variant={getScoreBadgeVariant(framework.score)} className="text-xs">
                              {framework.score}/100
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            {framework.category}
                          </p>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-3">
                            <div className="relative">
                              <Progress value={framework.score} className="w-full h-2" />
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                Recommendations ({framework.recommendations.length})
                              </h4>
                              <ul className="space-y-2">
                                {framework.recommendations.map((rec, index) => (
                                  <li key={index} className="flex items-start gap-2">
                                    <span className="text-blue-500 mt-1 flex-shrink-0">•</span>
                                    <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{rec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </TabsContent>

              {/* Export Tab */}
              <TabsContent value="export" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg sm:text-xl">Export Options</CardTitle>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Download your analysis results in various formats
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button className="w-full justify-start" variant="outline">
                        📄 Download PDF Report
                      </Button>
                      <Button className="w-full justify-start" variant="outline">
                        📊 Export to Excel
                      </Button>
                      <Button className="w-full justify-start" variant="outline">
                        📋 Copy Summary to Clipboard
                      </Button>
                      <Button className="w-full justify-start" variant="outline">
                        🔗 Share Analysis Link
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg sm:text-xl">Analysis Summary</CardTitle>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Key insights from your pitch analysis
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Overall Score:</span>
                          <Badge variant="secondary" className="text-sm">
                            {data.overallScore}/100
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Total Frameworks:</span>
                          <Badge variant="outline" className="text-sm">
                            {data.frameworkScores.length}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Top Category:</span>
                          <Badge variant="outline" className="text-sm">
                            {categories.reduce((best, category) => {
                              const avgScore = Math.round(groupedScores[category].reduce((sum, score) => sum + score.score, 0) / groupedScores[category].length);
                              const bestAvg = Math.round(groupedScores[best].reduce((sum, score) => sum + score.score, 0) / groupedScores[best].length);
                              return avgScore > bestAvg ? category : best;
                            })}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Areas for Improvement:</span>
                          <Badge variant="outline" className="text-sm">
                            {data.frameworkScores.filter(f => f.score < SCORE_THRESHOLDS.GOOD).length}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
} 