/**
 * Recommendation Template Utilities
 * 
 * Utility functions, validation helpers, and default configurations
 * for the recommendation template framework.
 */

import { 
  TemplateData, 
  TemplateConfig, 
  TemplateTheme,
  TemplateAnalytics,
  DisplayContext,
  TemplateVariant,
  UserExperienceLevel 
} from './types';
import { 
  RecommendationType,
  RecommendationCategory 
} from '../recommendation-engine';

// Default theme configuration
export const DEFAULT_TEMPLATE_THEME: TemplateTheme = {
  name: 'default',
  colors: {
    critical: '#dc2626', // red-600
    high: '#ea580c',     // orange-600
    medium: '#ca8a04',   // yellow-600
    low: '#65a30d',      // lime-600
    success: '#16a34a',  // green-600
    warning: '#d97706',  // amber-600
    info: '#2563eb'      // blue-600
  },
  spacing: {
    compact: '0.5rem',
    normal: '1rem',
    relaxed: '1.5rem'
  },
  typography: {
    heading: 'font-semibold text-gray-900 dark:text-white',
    body: 'text-gray-700 dark:text-gray-300',
    caption: 'text-sm text-gray-500 dark:text-gray-400'
  },
  icons: {
    'critical_issue': '🚨',
    'high_impact_improvement': '⚡',
    'strength_to_leverage': '💪',
    'quick_win': '🎯',
    'comparative_insight': '📊',
    'advanced_optimization': '🔧'
  }
};

// Recommended configurations for different recommendation types
export const RECOMMENDATION_TYPE_CONFIGS: Record<RecommendationType, Partial<TemplateConfig>> = {
  'critical_issue': {
    showMetrics: true,
    showPrerequisites: true,
    enableInteractions: true,
    maxActionSteps: 10 // Show all steps for critical issues
  },
  'high_impact_improvement': {
    showMetrics: true,
    showPrerequisites: true,
    enableInteractions: true,
    maxActionSteps: 5
  },
  'strength_to_leverage': {
    showMetrics: true,
    showPrerequisites: false, // Strengths typically don't have prerequisites
    enableInteractions: true,
    maxActionSteps: 3
  },
  'quick_win': {
    showMetrics: false, // Focus on action, not metrics
    showPrerequisites: false,
    enableInteractions: true,
    maxActionSteps: 3
  },
  'comparative_insight': {
    showMetrics: true,
    showPrerequisites: false,
    enableInteractions: false, // Usually informational
    maxActionSteps: 5
  },
  'advanced_optimization': {
    showMetrics: true,
    showPrerequisites: true,
    enableInteractions: true,
    maxActionSteps: 7
  }
};

// Create template analytics object
export function createTemplateAnalytics(
  templateId: string,
  recommendationType: RecommendationType,
  variant: TemplateVariant,
  context: DisplayContext,
  interactions: {
    viewed: boolean;
    expanded?: boolean;
    actionsTaken?: number;
    timeSpent?: number;
  }
): TemplateAnalytics {
  return {
    templateId,
    recommendationType,
    variant,
    context,
    interactions,
    timestamp: new Date()
  };
}

// Validate template data
export function validateTemplateData(data: TemplateData): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check required fields
  if (!data.recommendation || !data.context) {
    return false;
  }

  // Validate recommendation structure
  const { recommendation } = data;
  if (!recommendation.id || !recommendation.title || !recommendation.description) {
    return false;
  }

  // Validate context structure
  const { context } = data;
  if (!context.sessionId) {
    return false;
  }

  // Validate arrays
  if (!Array.isArray(recommendation.actionableSteps)) {
    return false;
  }

  return true;
}

// Get template theme with fallback
export function getTemplateTheme(themeName?: string): TemplateTheme {
  // For now, always return default theme
  // In the future, this could load custom themes
  return DEFAULT_TEMPLATE_THEME;
}

// Estimate reading time for recommendation content
export function estimateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const words = text.split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

// Generate template ID
export function generateTemplateId(
  recommendationType: RecommendationType,
  variant: TemplateVariant,
  context: DisplayContext
): string {
  return `${recommendationType}_${variant}_${context}`;
}

// Get optimal action step count based on context and user level
export function getOptimalActionStepCount(
  context: DisplayContext,
  userLevel: UserExperienceLevel,
  totalSteps: number
): number {
  let baseCount = 5;

  // Adjust by context
  switch (context) {
    case 'mobile':
    case 'embedded':
      baseCount = 3;
      break;
    case 'dashboard':
      baseCount = 4;
      break;
    case 'results':
    case 'modal':
      baseCount = 6;
      break;
    case 'print':
    case 'email':
      baseCount = totalSteps; // Show all for exports
      break;
  }

  // Adjust by user level
  switch (userLevel) {
    case 'beginner':
      baseCount = Math.min(baseCount, 3); // Reduce cognitive load
      break;
    case 'advanced':
      baseCount = Math.max(baseCount, totalSteps); // Show everything
      break;
    case 'intermediate':
      // Use base count as-is
      break;
  }

  return Math.min(baseCount, totalSteps);
}

// Check if template should show metrics based on context and type
export function shouldShowMetrics(
  recommendationType: RecommendationType,
  context: DisplayContext,
  userLevel: UserExperienceLevel
): boolean {
  // Never show metrics in very constrained spaces
  if (context === 'embedded' || context === 'mobile') {
    return false;
  }

  // Always show for critical issues
  if (recommendationType === 'critical_issue') {
    return true;
  }

  // Quick wins focus on action, not metrics
  if (recommendationType === 'quick_win') {
    return false;
  }

  // Beginners might find metrics overwhelming in some contexts
  if (userLevel === 'beginner' && context === 'dashboard') {
    return false;
  }

  // Default to showing metrics
  return true;
}

// Check if template should show prerequisites
export function shouldShowPrerequisites(
  recommendationType: RecommendationType,
  context: DisplayContext,
  userLevel: UserExperienceLevel
): boolean {
  // Never show in constrained spaces
  if (context === 'embedded' || context === 'mobile') {
    return false;
  }

  // Quick wins and strengths typically don't have prerequisites
  if (recommendationType === 'quick_win' || recommendationType === 'strength_to_leverage') {
    return false;
  }

  // Always show for critical issues and high impact improvements
  if (recommendationType === 'critical_issue' || recommendationType === 'high_impact_improvement') {
    return true;
  }

  // Show for intermediate and advanced users
  return userLevel !== 'beginner';
}

// Get priority color class
export function getPriorityColorClass(priority: string): string {
  switch (priority) {
    case 'critical':
      return 'text-red-600 dark:text-red-400';
    case 'high':
      return 'text-orange-600 dark:text-orange-400';
    case 'medium':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'low':
      return 'text-green-600 dark:text-green-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

// Get category color class for border
export function getCategoryBorderClass(category: RecommendationCategory): string {
  switch (category) {
    case 'speech':
      return 'border-l-blue-500';
    case 'content':
      return 'border-l-green-500';
    case 'visual':
      return 'border-l-purple-500';
    case 'overall':
      return 'border-l-orange-500';
    case 'cross_category':
      return 'border-l-gray-500';
    default:
      return 'border-l-blue-500';
  }
}

// Format time duration for display
export function formatTimeEstimate(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}min`;
  } else if (hours < 24) {
    return `${hours}h`;
  } else {
    const days = Math.round(hours / 24);
    return `${days}d`;
  }
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

// Get accessibility label for recommendation
export function getAccessibilityLabel(
  recommendationType: RecommendationType,
  title: string,
  priority: string
): string {
  const typeLabel = recommendationType.replace('_', ' ');
  const priorityLabel = priority === 'critical' ? 'urgent' : priority;
  return `${typeLabel} recommendation: ${title}. ${priorityLabel} priority.`;
} 