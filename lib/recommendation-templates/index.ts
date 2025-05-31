/**
 * Recommendation Template Framework
 * 
 * Main entry point for the template system that provides reusable,
 * configurable templates for displaying recommendations with different
 * variants, priorities, and contexts.
 */

// Core types and interfaces
export type {
  TemplateData,
  TemplateConfig,
  TemplateVariant,
  DisplayContext,
  TemplateRenderResult,
  TemplateResolver,
  TemplateRegistry,
  TemplateTheme,
  TemplateAnalytics,
  TemplateExporter,
  TemplateValidator,
  UserExperienceLevel
} from './types';

// Template components
export {
  SummaryTemplate,
  DetailedTemplate,
  CompactTemplate,
  ExportTemplate,
  TimelineTemplate
} from './components';

// Template resolvers and utilities
export {
  BaseTemplateResolver,
  CriticalIssueResolver,
  QuickWinResolver,
  StrengthLeverageResolver,
  RecommendationTemplateRegistry,
  createDefaultConfig,
  adjustConfigForUserLevel,
  renderRecommendationTemplate,
  renderRecommendationList,
  selectOptimalTemplate
} from './resolver';

// Utility functions and constants
export {
  createTemplateAnalytics,
  validateTemplateData,
  getTemplateTheme,
  DEFAULT_TEMPLATE_THEME,
  RECOMMENDATION_TYPE_CONFIGS
} from './utils';

// Re-export prioritization types for convenience
export type { PrioritizedRecommendation } from '../recommendation-prioritization';
export type { 
  Recommendation, 
  RecommendationType, 
  RecommendationCategory,
  RecommendationPriority 
} from '../recommendation-engine'; 