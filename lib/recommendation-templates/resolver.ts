/**
 * Template Resolver System
 * 
 * Determines which template to use for a given recommendation based on
 * content, context, user preferences, and display requirements.
 */

import React from 'react';
import { 
  TemplateData, 
  TemplateConfig, 
  TemplateVariant,
  DisplayContext,
  TemplateRenderResult,
  TemplateResolver,
  TemplateRegistry,
  UserExperienceLevel 
} from './types';
import { 
  RecommendationType,
  RecommendationPriority 
} from '../recommendation-engine';
import { PrioritizedRecommendation } from '../recommendation-prioritization';
import {
  SummaryTemplate,
  DetailedTemplate,
  CompactTemplate,
  ExportTemplate,
  TimelineTemplate
} from './components';

// Default template configuration factory
export function createDefaultConfig(
  variant: TemplateVariant,
  context: DisplayContext,
  userLevel?: UserExperienceLevel
): TemplateConfig {
  const baseConfig: TemplateConfig = {
    variant,
    context,
    userLevel: userLevel || 'intermediate',
    showMetrics: true,
    showTimeline: false,
    showPrerequisites: true,
    maxActionSteps: 5,
    enableInteractions: true,
    theme: 'auto'
  };

  // Context-specific adjustments
  switch (context) {
    case 'mobile':
      return {
        ...baseConfig,
        variant: variant === 'detailed' ? 'summary' : variant,
        maxActionSteps: 3,
        showMetrics: false,
        showPrerequisites: false
      };

    case 'print':
    case 'email':
      return {
        ...baseConfig,
        variant: 'export',
        enableInteractions: false,
        showTimeline: false,
        theme: 'light'
      };

    case 'embedded':
      return {
        ...baseConfig,
        variant: variant === 'detailed' ? 'compact' : variant,
        showMetrics: false,
        enableInteractions: false
      };

    case 'dashboard':
      return {
        ...baseConfig,
        variant: variant === 'detailed' ? 'summary' : variant,
        maxActionSteps: 3,
        showTimeline: true
      };

    default:
      return baseConfig;
  }
}

// User experience level adjustments
export function adjustConfigForUserLevel(
  config: TemplateConfig,
  userLevel: UserExperienceLevel
): TemplateConfig {
  switch (userLevel) {
    case 'beginner':
      return {
        ...config,
        showMetrics: true,
        showPrerequisites: true,
        maxActionSteps: 3, // Reduce cognitive load
        showTimeline: false // Less complexity for beginners
      };

    case 'advanced':
      return {
        ...config,
        showMetrics: true,
        showPrerequisites: true,
        maxActionSteps: 10, // Show all details
        showTimeline: true
      };

    case 'intermediate':
    default:
      return config; // Use defaults
  }
}

// Base template resolver implementation
export class BaseTemplateResolver implements TemplateResolver {
  private supportedVariants: TemplateVariant[] = [
    'summary', 'detailed', 'compact', 'export', 'timeline'
  ];
  
  private supportedContexts: DisplayContext[] = [
    'dashboard', 'results', 'modal', 'print', 'email', 'mobile', 'embedded'
  ];

  resolve(data: TemplateData, config: TemplateConfig): TemplateRenderResult {
    const startTime = performance.now();
    
    // Validate inputs
    if (!this.validateConfig(config)) {
      throw new Error(`Invalid template configuration for ${data.recommendation.type}`);
    }

    // Adjust config based on user level
    const adjustedConfig = adjustConfigForUserLevel(config, config.userLevel || 'intermediate');

    // Select appropriate template component
    const TemplateComponent = this.selectTemplateComponent(adjustedConfig.variant);
    
    // Generate accessibility metadata
    const accessibility = this.generateAccessibilityMetadata(data, adjustedConfig);
    
    // Generate interaction metadata
    const interactions = this.generateInteractionMetadata(data, adjustedConfig);

    // Render the component
    const content = React.createElement(TemplateComponent, {
      data,
      config: adjustedConfig
    });

    const renderTime = performance.now() - startTime;

    return {
      content,
      metadata: {
        templateId: `${data.recommendation.type}_${adjustedConfig.variant}_${adjustedConfig.context}`,
        variant: adjustedConfig.variant,
        renderTime,
        accessibility,
        interactions
      }
    };
  }

  getSupportedVariants(): TemplateVariant[] {
    return [...this.supportedVariants];
  }

  getSupportedContexts(): DisplayContext[] {
    return [...this.supportedContexts];
  }

  validateConfig(config: TemplateConfig): boolean {
    return (
      this.supportedVariants.includes(config.variant) &&
      this.supportedContexts.includes(config.context) &&
      (config.maxActionSteps === undefined || config.maxActionSteps > 0)
    );
  }

  private selectTemplateComponent(variant: TemplateVariant) {
    switch (variant) {
      case 'summary':
        return SummaryTemplate;
      case 'detailed':
        return DetailedTemplate;
      case 'compact':
        return CompactTemplate;
      case 'export':
        return ExportTemplate;
      case 'timeline':
        return TimelineTemplate;
      case 'contextual':
        // Contextual falls back to summary
        return SummaryTemplate;
      default:
        return SummaryTemplate;
    }
  }

  private generateAccessibilityMetadata(data: TemplateData, config: TemplateConfig) {
    const { recommendation } = data;
    const priorityLevel = recommendation.priority === 'critical' ? 'urgent' : recommendation.priority;
    
    return {
      ariaLabel: `${recommendation.type.replace('_', ' ')} recommendation: ${recommendation.title}. ${priorityLevel} priority.`,
      role: 'article',
      headingLevel: config.context === 'dashboard' ? 3 : 2
    };
  }

  private generateInteractionMetadata(data: TemplateData, config: TemplateConfig) {
    return {
      expandable: config.variant === 'summary' && config.enableInteractions,
      actionable: config.enableInteractions && data.recommendation.actionableSteps.length > 0,
      schedulable: config.showTimeline && config.enableInteractions
    };
  }
}

// Specialized resolvers for different recommendation types
export class CriticalIssueResolver extends BaseTemplateResolver {
  resolve(data: TemplateData, config: TemplateConfig): TemplateRenderResult {
    // Force certain settings for critical issues
    const criticalConfig: TemplateConfig = {
      ...config,
      showMetrics: true,
      showPrerequisites: true,
      // Always show all action steps for critical issues
      maxActionSteps: data.recommendation.actionableSteps.length
    };

    return super.resolve(data, criticalConfig);
  }
}

export class QuickWinResolver extends BaseTemplateResolver {
  resolve(data: TemplateData, config: TemplateConfig): TemplateRenderResult {
    // Optimize for quick wins - focus on immediate action
    const quickWinConfig: TemplateConfig = {
      ...config,
      maxActionSteps: 3, // Keep it simple
      showPrerequisites: false, // Quick wins shouldn't have many prerequisites
      enableInteractions: true // Encourage immediate action
    };

    return super.resolve(data, quickWinConfig);
  }
}

export class StrengthLeverageResolver extends BaseTemplateResolver {
  resolve(data: TemplateData, config: TemplateConfig): TemplateRenderResult {
    // Focus on positive reinforcement and building on strengths
    const strengthConfig: TemplateConfig = {
      ...config,
      showMetrics: true, // Show confidence scores
      showPrerequisites: false // Strengths usually don't require prerequisites
    };

    return super.resolve(data, strengthConfig);
  }
}

// Template registry implementation
export class RecommendationTemplateRegistry implements TemplateRegistry {
  private resolvers: Map<RecommendationType, TemplateResolver> = new Map();

  constructor() {
    // Register default resolvers
    this.register('critical_issue', new CriticalIssueResolver());
    this.register('quick_win', new QuickWinResolver());
    this.register('strength_to_leverage', new StrengthLeverageResolver());
    
    // Use base resolver for other types
    const baseResolver = new BaseTemplateResolver();
    this.register('high_impact_improvement', baseResolver);
    this.register('comparative_insight', baseResolver);
    this.register('advanced_optimization', baseResolver);
  }

  register(type: RecommendationType, resolver: TemplateResolver): void {
    this.resolvers.set(type, resolver);
  }

  unregister(type: RecommendationType): void {
    this.resolvers.delete(type);
  }

  getResolver(type: RecommendationType): TemplateResolver | null {
    return this.resolvers.get(type) || null;
  }

  listRegistered(): RecommendationType[] {
    return Array.from(this.resolvers.keys());
  }
}

// Main template rendering function
export function renderRecommendationTemplate(
  recommendation: PrioritizedRecommendation,
  config: TemplateConfig,
  context: {
    sessionId: string;
    overallAssessment?: any;
    totalRecommendations?: number;
    userProfile?: {
      experienceLevel: UserExperienceLevel;
      focusAreas?: string[];
    };
  }
): TemplateRenderResult {
  const registry = new RecommendationTemplateRegistry();
  const resolver = registry.getResolver(recommendation.type);
  
  if (!resolver) {
    throw new Error(`No template resolver found for recommendation type: ${recommendation.type}`);
  }

  const templateData: TemplateData = {
    recommendation,
    metadata: {
      estimatedReadTime: Math.ceil(recommendation.description.length / 200), // ~200 chars per minute reading
      lastUpdated: new Date()
    },
    context
  };

  return resolver.resolve(templateData, config);
}

// Batch rendering utility for multiple recommendations
export function renderRecommendationList(
  recommendations: PrioritizedRecommendation[],
  config: TemplateConfig,
  context: {
    sessionId: string;
    overallAssessment?: any;
    totalRecommendations?: number;
    userProfile?: {
      experienceLevel: UserExperienceLevel;
      focusAreas?: string[];
    };
  }
): TemplateRenderResult[] {
  return recommendations.map((recommendation, index) => {
    const itemConfig = {
      ...config,
      // Add index for potential grouping/ordering
    };

    const itemContext = {
      ...context,
      totalRecommendations: recommendations.length
    };

    const templateData: TemplateData = {
      recommendation,
      metadata: {
        displayIndex: index,
        estimatedReadTime: Math.ceil(recommendation.description.length / 200),
        lastUpdated: new Date()
      },
      context: itemContext
    };

    const registry = new RecommendationTemplateRegistry();
    const resolver = registry.getResolver(recommendation.type) || new BaseTemplateResolver();
    
    return resolver.resolve(templateData, itemConfig);
  });
}

// Smart template selection based on context and content
export function selectOptimalTemplate(
  recommendation: PrioritizedRecommendation,
  context: DisplayContext,
  userLevel?: UserExperienceLevel
): TemplateConfig {
  let variant: TemplateVariant = 'summary';

  // Context-based variant selection
  switch (context) {
    case 'dashboard':
      variant = 'summary';
      break;
    case 'results':
      variant = recommendation.priority === 'critical' ? 'detailed' : 'summary';
      break;
    case 'modal':
      variant = 'detailed';
      break;
    case 'mobile':
    case 'embedded':
      variant = 'compact';
      break;
    case 'print':
    case 'email':
      variant = 'export';
      break;
  }

  // Recommendation type adjustments
  if (recommendation.type === 'critical_issue') {
    variant = context === 'mobile' ? 'compact' : 'detailed';
  }

  if (recommendation.type === 'quick_win' && context === 'dashboard') {
    variant = 'timeline';
  }

  return createDefaultConfig(variant, context, userLevel);
} 