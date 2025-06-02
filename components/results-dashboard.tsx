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
    text: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/20",
    border: "border-green-200 dark:border-green-800",
    solid: "bg-green-500",
    gradient: "bg-gradient-to-br from-green-400 to-green-600",
    ring: "ring-green-200 dark:ring-green-800",
    icon: "🎯",
    label: "Excellent"
  },
  good: {
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-800",
    solid: "bg-blue-500",
    gradient: "bg-gradient-to-br from-blue-400 to-blue-600",
    ring: "ring-blue-200 dark:ring-blue-800",
    icon: "👍",
    label: "Good"
  },
  fair: {
    text: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950/20",
    border: "border-yellow-200 dark:border-yellow-800",
    solid: "bg-yellow-500",
    gradient: "bg-gradient-to-br from-yellow-400 to-yellow-600",
    ring: "ring-yellow-200 dark:ring-yellow-800",
    icon: "⚠️",
    label: "Fair"
  },
  poor: {
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-800",
    solid: "bg-red-500",
    gradient: "bg-gradient-to-br from-red-400 to-red-600",
    ring: "ring-red-200 dark:ring-red-800",
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
  // Add state for active tab
  const [activeTab, setActiveTab] = useState("overview");

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
      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Button asChild variant="ghost" className="mb-4 hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors">
              <Link href="/">
                ← Back to Home
              </Link>
            </Button>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
              Pitch Analysis Dashboard
            </h1>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-1">
                <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 font-medium">
                  {data.fileName}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Analyzed on {new Date(data.analysisDate).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild variant="outline" className="w-full sm:w-auto hover:bg-white dark:hover:bg-gray-800 transition-colors">
                  <Link href="/upload">
                    Analyze Another Pitch
                  </Link>
                </Button>
                <Button variant="default" className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-shadow">
                  Download Report
                </Button>
              </div>
            </div>
          </div>

          {/* Overall Score Card */}
          <Card className="mb-8 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6 lg:p-8">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                <div className="text-center lg:text-left w-full lg:w-auto">
                  <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white mb-3">
                    Overall Score
                  </h2>
                  <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-md mx-auto lg:mx-0 leading-relaxed">
                    Your pitch demonstrates strong potential with clear areas for improvement.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center lg:justify-start gap-3">
                    <Badge variant="outline" className={`${COLOR_SCHEME.excellent.text} transition-colors`}>
                      {data.frameworkScores.filter(f => f.score >= SCORE_THRESHOLDS.EXCELLENT).length} {COLOR_SCHEME.excellent.label}
                    </Badge>
                    <Badge variant="outline" className={`${COLOR_SCHEME.good.text} transition-colors`}>
                      {data.frameworkScores.filter(f => f.score >= SCORE_THRESHOLDS.GOOD && f.score < SCORE_THRESHOLDS.EXCELLENT).length} {COLOR_SCHEME.good.label}
                    </Badge>
                    <Badge variant="outline" className={`${COLOR_SCHEME.fair.text} transition-colors`}>
                      {data.frameworkScores.filter(f => f.score >= SCORE_THRESHOLDS.FAIR && f.score < SCORE_THRESHOLDS.GOOD).length} {COLOR_SCHEME.fair.label}
                    </Badge>
                    <Badge variant="outline" className={`${COLOR_SCHEME.poor.text} transition-colors`}>
                      {data.frameworkScores.filter(f => f.score < SCORE_THRESHOLDS.FAIR).length} {COLOR_SCHEME.poor.label}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4 flex-shrink-0">
                  <div className={`flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 lg:w-36 lg:h-36 rounded-full text-white text-3xl sm:text-4xl lg:text-5xl font-bold shadow-xl hover:shadow-2xl transition-shadow ${getScoreGradient(data.overallScore)}`}>
                    {data.overallScore}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                      {COLOR_SCHEME[getScoreLevel(data.overallScore)].label}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Collapsible Category Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {categories.map((category) => {
              const categoryScores = groupedScores[category];
              const avgScore = Math.round(categoryScores.reduce((sum, score) => sum + score.score, 0) / categoryScores.length);
              const isExpanded = expandedCategories.has(category);
              
              return (
                <Card key={category} className={`transition-all duration-300 hover:shadow-lg border-2 ${getScoreColor(avgScore)} ${isExpanded ? 'col-span-1 sm:col-span-2 shadow-lg' : 'hover:scale-105'}`}>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base sm:text-lg font-semibold line-clamp-2 leading-tight">{category}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCategoryExpansion(category)}
                        className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-full"
                        aria-label={isExpanded ? `Collapse ${category}` : `Expand ${category}`}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {categoryScores.length} metrics
                      </span>
                      <Badge variant={getScoreBadgeVariant(avgScore)} className="text-xs font-medium">
                        {avgScore}/100
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <Progress value={avgScore} className="w-full h-3" />
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Min: {Math.min(...categoryScores.map(s => s.score))}</span>
                        <span>Max: {Math.max(...categoryScores.map(s => s.score))}</span>
                      </div>
                    </div>
                    
                    {/* Collapsible detailed breakdown */}
                    {isExpanded && (
                      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-2 duration-300">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                          Framework Breakdown
                        </h4>
                        <div className="space-y-3">
                          {categoryScores.map((framework) => (
                            <div key={framework.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {framework.name}
                                </p>
                                <div className="flex items-center gap-3 mt-2">
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
          <Card className="mb-8 bg-gray-50 dark:bg-gray-800/50 shadow-md">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                  Performance Scale
                </h3>
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-4 sm:gap-6">
                  {Object.entries(COLOR_SCHEME).map(([level, colors]) => (
                    <div key={level} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${colors.solid} shadow-sm`} />
                      <span className={`text-sm font-medium ${colors.text}`}>
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
          <div className="space-y-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto p-1 bg-white dark:bg-gray-800 shadow-md">
                <TabsTrigger value="overview" className="text-sm font-medium data-[state=active]:bg-blue-500 data-[state=active]:text-white transition-all">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="detailed" className="text-sm font-medium data-[state=active]:bg-blue-500 data-[state=active]:text-white transition-all">
                  Detailed
                </TabsTrigger>
                <TabsTrigger value="recommendations" className="text-sm font-medium data-[state=active]:bg-blue-500 data-[state=active]:text-white transition-all">
                  Tips
                </TabsTrigger>
                <TabsTrigger value="export" className="text-sm font-medium data-[state=active]:bg-blue-500 data-[state=active]:text-white transition-all">
                  Export
                </TabsTrigger>
              </TabsList>

              {/* Enhanced Overview Tab with Collapsible Framework Cards */}
              <TabsContent value="overview" className="space-y-6">
                {/* Collapsible Filters Section */}
                <Card className="bg-gray-50 dark:bg-gray-800/50 shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Framework Overview</h3>
                        <Badge variant="outline" className="text-xs">
                          {data.frameworkScores.length} total
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                        className="h-8 px-3 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label={showFilters ? 'Hide filters' : 'Show filters'}
                      >
                        {showFilters ? 'Hide' : 'Show'} Filters
                        {showFilters ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </div>
                    
                    {/* Collapsible Filter Controls */}
                    {showFilters && (
                      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {categories.map((category) => {
                            const categoryScores = groupedScores[category];
                            const avgScore = Math.round(categoryScores.reduce((sum, score) => sum + score.score, 0) / categoryScores.length);
                            return (
                              <div key={category} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                  {data.frameworkScores.map((framework) => {
                    const isExpanded = expandedFrameworks.has(framework.id);
                    return (
                      <Card key={framework.id} className={`transition-all duration-300 hover:shadow-lg border-2 ${getScoreColor(framework.score)} ${isExpanded ? 'col-span-1 sm:col-span-2 shadow-lg' : 'hover:scale-105'}`}>
                        <CardHeader className="pb-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className={`w-3 h-3 rounded-full ${getScoreSolid(framework.score)} flex-shrink-0 shadow-sm`} />
                              <CardTitle className="text-sm sm:text-base lg:text-lg font-semibold truncate leading-tight" title={framework.name}>
                                {framework.name}
                              </CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={getScoreBadgeVariant(framework.score)} className="text-xs flex-shrink-0 font-medium">
                                {framework.score}/100
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleFrameworkExpansion(framework.id)}
                                className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-full"
                                aria-label={isExpanded ? `Collapse ${framework.name}` : `Expand ${framework.name}`}
                              >
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                            {framework.category}
                          </p>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-4">
                            <div className="relative">
                              <Progress 
                                value={framework.score} 
                                className="w-full h-3"
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-semibold text-white drop-shadow-lg">
                                  {framework.score}%
                                </span>
                              </div>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
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
                              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-2 duration-300 space-y-6">
                                {/* Feedback Section */}
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                    Feedback
                                  </h4>
                                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                    {framework.feedback}
                                  </p>
                                </div>

                                {/* Recommendations Section */}
                                {framework.recommendations.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
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
                                <div className="flex gap-3 pt-2">
                                  <Button variant="outline" size="sm" className="text-xs h-8 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                    Focus Area
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-xs h-8 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
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
                    <AccordionItem key={category} value={category} className="border rounded-lg px-6 shadow-md hover:shadow-lg transition-shadow bg-white dark:bg-gray-800">
                      <AccordionTrigger className="text-lg sm:text-xl font-semibold hover:no-underline">
                        <div className="flex items-center gap-4">
                          <span className="text-left">{category}</span>
                          <Badge variant="outline" className="text-xs font-medium">
                            {groupedScores[category].length} metrics
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {groupedScores[category].map((framework) => (
                            <Card key={framework.id} className={`border-2 ${getScoreColor(framework.score)} shadow-md hover:shadow-lg transition-shadow`}>
                              <CardHeader className="pb-4">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-base sm:text-lg font-semibold leading-tight">{framework.name}</CardTitle>
                                  <Badge variant={getScoreBadgeVariant(framework.score)} className="text-xs font-medium">
                                    {framework.score}/100
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0 space-y-5">
                                <div className="relative">
                                  <Progress value={framework.score} className="w-full h-3" />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xs font-semibold text-white drop-shadow-lg">
                                      {framework.score}%
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Description</h4>
                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{framework.description}</p>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Feedback</h4>
                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{framework.feedback}</p>
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {data.frameworkScores
                    .filter(framework => framework.recommendations.length > 0)
                    .map((framework) => (
                      <Card key={framework.id} className={`border-2 ${getScoreColor(framework.score)} shadow-md hover:shadow-lg transition-shadow`}>
                        <CardHeader className="pb-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base sm:text-lg font-semibold leading-tight">{framework.name}</CardTitle>
                            <Badge variant={getScoreBadgeVariant(framework.score)} className="text-xs font-medium">
                              {framework.score}/100
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                            {framework.category}
                          </p>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-4">
                            <div className="relative">
                              <Progress value={framework.score} className="w-full h-2" />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                Recommendations ({framework.recommendations.length})
                              </h4>
                              <ul className="space-y-3">
                                {framework.recommendations.map((rec, index) => (
                                  <li key={index} className="flex items-start gap-3">
                                    <span className="text-blue-500 mt-1 flex-shrink-0 font-semibold">•</span>
                                    <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{rec}</span>
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card className="shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg sm:text-xl font-semibold">Export Options</CardTitle>
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        Download your analysis results in various formats
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button className="w-full justify-start h-12 text-sm font-medium shadow-sm hover:shadow-md transition-shadow" variant="outline">
                        📄 Download PDF Report
                      </Button>
                      <Button className="w-full justify-start h-12 text-sm font-medium shadow-sm hover:shadow-md transition-shadow" variant="outline">
                        📊 Export to Excel
                      </Button>
                      <Button className="w-full justify-start h-12 text-sm font-medium shadow-sm hover:shadow-md transition-shadow" variant="outline">
                        📋 Copy Summary to Clipboard
                      </Button>
                      <Button className="w-full justify-start h-12 text-sm font-medium shadow-sm hover:shadow-md transition-shadow" variant="outline">
                        🔗 Share Analysis Link
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg sm:text-xl font-semibold">Analysis Summary</CardTitle>
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        Key insights from your pitch analysis
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">Overall Score:</span>
                          <Badge variant="secondary" className="text-sm font-medium">
                            {data.overallScore}/100
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">Total Frameworks:</span>
                          <Badge variant="outline" className="text-sm font-medium">
                            {data.frameworkScores.length}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">Top Category:</span>
                          <Badge variant="outline" className="text-sm font-medium">
                            {categories.reduce((best, category) => {
                              const avgScore = Math.round(groupedScores[category].reduce((sum, score) => sum + score.score, 0) / groupedScores[category].length);
                              const bestAvg = Math.round(groupedScores[best].reduce((sum, score) => sum + score.score, 0) / groupedScores[best].length);
                              return avgScore > bestAvg ? category : best;
                            })}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">Areas for Improvement:</span>
                          <Badge variant="outline" className="text-sm font-medium">
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