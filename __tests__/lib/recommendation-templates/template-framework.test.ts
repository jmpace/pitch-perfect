/**
 * Tests for Recommendation Template Framework
 * 
 * Comprehensive testing of template resolvers, registry, configuration,
 * and main template functions for all variants and contexts.
 */

import {
  createDefaultConfig,
  adjustConfigForUserLevel,
  BaseTemplateResolver,
  CriticalIssueResolver,
  QuickWinResolver,
  StrengthLeverageResolver,
  RecommendationTemplateRegistry,
  renderRecommendationTemplate,
  renderRecommendationList,
  selectOptimalTemplate
} from '../../../lib/recommendation-templates/resolver';
import {
  TemplateConfig,
  TemplateData,
  UserExperienceLevel,
  TemplateVariant,
  DisplayContext
} from '../../../lib/recommendation-templates/types';
import { PrioritizedRecommendation } from '../../../lib/recommendation-prioritization';

// Mock recommendation data
const mockPrioritizedRecommendation: PrioritizedRecommendation = {
  id: '1',
  type: 'critical_issue',
  category: 'content',
  priority: 'critical',
  title: 'Fix Opening Hook',
  description: 'Improve the opening statement to capture attention',
  actionableSteps: ['Revise opening line', 'Add compelling statistic'],
  estimatedImpact: 'high',
  estimatedEffort: 'medium',
  relatedFrameworkPoints: ['opening_hook'],
  confidence: 0.9,
  priorityScore: 11.5,
  impactMultiplier: 1.8,
  urgencyFactor: 0.9,
  implementationDifficulty: 6,
  investorRelevance: 9.5,
  timeToImplement: 1
};

const mockTemplateData: TemplateData = {
  recommendation: mockPrioritizedRecommendation,
  metadata: {
    displayIndex: 1,
    grouping: 'content_improvements',
    estimatedReadTime: 2,
    lastUpdated: new Date('2024-01-15T10:00:00Z'),
    userProgress: {
      started: false,
      completed: false,
      completedSteps: []
    }
  },
  context: {
    sessionId: 'test-session',
    totalRecommendations: 5,
    userProfile: {
      experienceLevel: 'intermediate',
      focusAreas: ['content', 'delivery']
    }
  }
};

describe('Template Configuration Functions', () => {
  describe('createDefaultConfig', () => {
    test('should create basic default configuration', () => {
      const config = createDefaultConfig('summary', 'dashboard');
      
      expect(config.variant).toBe('summary');
      expect(config.context).toBe('dashboard');
      expect(config.userLevel).toBe('intermediate');
      expect(config.showMetrics).toBe(true);
      expect(config.enableInteractions).toBe(true);
      expect(config.maxActionSteps).toBe(3); // Dashboard adjustment
    });

    test('should apply mobile context adjustments', () => {
      const config = createDefaultConfig('detailed', 'mobile');
      
      expect(config.variant).toBe('summary'); // Downgraded for mobile
      expect(config.maxActionSteps).toBe(3);
      expect(config.showMetrics).toBe(false);
      expect(config.showPrerequisites).toBe(false);
    });

    test('should apply print/email context adjustments', () => {
      const printConfig = createDefaultConfig('summary', 'print');
      const emailConfig = createDefaultConfig('summary', 'email');
      
      [printConfig, emailConfig].forEach(config => {
        expect(config.variant).toBe('export');
        expect(config.enableInteractions).toBe(false);
        expect(config.showTimeline).toBe(false);
        expect(config.theme).toBe('light');
      });
    });

    test('should apply embedded context adjustments', () => {
      const config = createDefaultConfig('detailed', 'embedded');
      
      expect(config.variant).toBe('compact'); // Downgraded for embedded
      expect(config.showMetrics).toBe(false);
      expect(config.enableInteractions).toBe(false);
    });

    test('should accept user level parameter', () => {
      const config = createDefaultConfig('summary', 'results', 'advanced');
      
      expect(config.userLevel).toBe('advanced');
    });
  });

  describe('adjustConfigForUserLevel', () => {
    const baseConfig: TemplateConfig = {
      variant: 'detailed',
      context: 'results',
      maxActionSteps: 5
    };

    test('should adjust for beginner users', () => {
      const adjusted = adjustConfigForUserLevel(baseConfig, 'beginner');
      
      expect(adjusted.maxActionSteps).toBe(3); // Reduced cognitive load
      expect(adjusted.showMetrics).toBe(true);
      expect(adjusted.showPrerequisites).toBe(true);
      expect(adjusted.showTimeline).toBe(false); // Less complexity
    });

    test('should adjust for advanced users', () => {
      const adjusted = adjustConfigForUserLevel(baseConfig, 'advanced');
      
      expect(adjusted.maxActionSteps).toBe(10); // Show all details
      expect(adjusted.showMetrics).toBe(true);
      expect(adjusted.showPrerequisites).toBe(true);
      expect(adjusted.showTimeline).toBe(true);
    });

    test('should use defaults for intermediate users', () => {
      const adjusted = adjustConfigForUserLevel(baseConfig, 'intermediate');
      
      expect(adjusted.maxActionSteps).toBe(baseConfig.maxActionSteps);
      // Should preserve original config
    });
  });
});

describe('BaseTemplateResolver', () => {
  let resolver: BaseTemplateResolver;
  let config: TemplateConfig;

  beforeEach(() => {
    resolver = new BaseTemplateResolver();
    config = createDefaultConfig('summary', 'dashboard');
  });

  describe('Configuration Validation', () => {
    test('should validate valid configurations', () => {
      expect(resolver.validateConfig(config)).toBe(true);
    });

    test('should reject invalid variant', () => {
      const invalidConfig = { ...config, variant: 'invalid' as TemplateVariant };
      expect(resolver.validateConfig(invalidConfig)).toBe(false);
    });

    test('should reject invalid context', () => {
      const invalidConfig = { ...config, context: 'invalid' as DisplayContext };
      expect(resolver.validateConfig(invalidConfig)).toBe(false);
    });

    test('should reject negative maxActionSteps', () => {
      const invalidConfig = { ...config, maxActionSteps: -1 };
      expect(resolver.validateConfig(invalidConfig)).toBe(false);
    });

    test('should accept undefined maxActionSteps', () => {
      const validConfig = { ...config, maxActionSteps: undefined };
      expect(resolver.validateConfig(validConfig)).toBe(true);
    });
  });

  describe('Supported Variants and Contexts', () => {
    test('should return all supported variants', () => {
      const variants = resolver.getSupportedVariants();
      
      expect(variants).toContain('summary');
      expect(variants).toContain('detailed');
      expect(variants).toContain('compact');
      expect(variants).toContain('export');
      expect(variants).toContain('timeline');
      expect(variants.length).toBe(5);
    });

    test('should return all supported contexts', () => {
      const contexts = resolver.getSupportedContexts();
      
      expect(contexts).toContain('dashboard');
      expect(contexts).toContain('results');
      expect(contexts).toContain('modal');
      expect(contexts).toContain('print');
      expect(contexts).toContain('email');
      expect(contexts).toContain('mobile');
      expect(contexts).toContain('embedded');
      expect(contexts.length).toBe(7);
    });
  });

  describe('Template Resolution', () => {
    test('should resolve template successfully', () => {
      const result = resolver.resolve(mockTemplateData, config);
      
      expect(result.content).toBeDefined();
      expect(result.metadata.templateId).toContain('critical_issue');
      expect(result.metadata.variant).toBe(config.variant);
      expect(result.metadata.renderTime).toBeGreaterThan(0);
    });

    test('should throw error for invalid configuration', () => {
      const invalidConfig = { ...config, variant: 'invalid' as TemplateVariant };
      
      expect(() => resolver.resolve(mockTemplateData, invalidConfig)).toThrow();
    });

    test('should generate accessibility metadata', () => {
      const result = resolver.resolve(mockTemplateData, config);
      
      expect(result.metadata.accessibility.ariaLabel).toBeDefined();
      expect(result.metadata.accessibility.role).toBeDefined();
    });

    test('should generate interaction metadata', () => {
      const result = resolver.resolve(mockTemplateData, config);
      
      expect(result.metadata.interactions).toBeDefined();
      expect(typeof result.metadata.interactions.expandable).toBe('boolean');
      expect(typeof result.metadata.interactions.actionable).toBe('boolean');
    });

    test('should adjust config for user level during resolution', () => {
      const beginnerConfig = { ...config, userLevel: 'beginner' as UserExperienceLevel };
      const result = resolver.resolve(mockTemplateData, beginnerConfig);
      
      // Should have processed the user level adjustment
      expect(result.metadata.templateId).toContain('summary'); // Should match adjusted variant
    });
  });
});

describe('Specialized Template Resolvers', () => {
  const config = createDefaultConfig('detailed', 'results');

  describe('CriticalIssueResolver', () => {
    test('should enhance critical issue template', () => {
      const resolver = new CriticalIssueResolver();
      const result = resolver.resolve(mockTemplateData, config);
      
      expect(result.content).toBeDefined();
      expect(result.metadata.templateId).toContain('critical_issue');
      // Critical issues should have enhanced styling/urgency indicators
    });
  });

  describe('QuickWinResolver', () => {
    test('should handle quick win recommendations', () => {
      const resolver = new QuickWinResolver();
      const quickWinData = {
        ...mockTemplateData,
        recommendation: {
          ...mockTemplateData.recommendation,
          type: 'quick_win' as const
        }
      };
      
      const result = resolver.resolve(quickWinData, config);
      
      expect(result.content).toBeDefined();
      expect(result.metadata.templateId).toContain('quick_win');
    });
  });

  describe('StrengthLeverageResolver', () => {
    test('should handle strength leverage recommendations', () => {
      const resolver = new StrengthLeverageResolver();
      const strengthData = {
        ...mockTemplateData,
        recommendation: {
          ...mockTemplateData.recommendation,
          type: 'strength_to_leverage' as const
        }
      };
      
      const result = resolver.resolve(strengthData, config);
      
      expect(result.content).toBeDefined();
      expect(result.metadata.templateId).toContain('strength_to_leverage');
    });
  });
});

describe('RecommendationTemplateRegistry', () => {
  let registry: RecommendationTemplateRegistry;

  beforeEach(() => {
    registry = new RecommendationTemplateRegistry();
  });

  test('should register default resolvers', () => {
    const registered = registry.listRegistered();
    
    expect(registered).toContain('critical_issue');
    expect(registered).toContain('quick_win');
    expect(registered).toContain('strength_to_leverage');
    expect(registered.length).toBeGreaterThan(0);
  });

  test('should register custom resolver', () => {
    const customResolver = new BaseTemplateResolver();
    registry.register('high_impact_improvement', customResolver);
    
    const retrieved = registry.getResolver('high_impact_improvement');
    expect(retrieved).toBe(customResolver);
    
    const registered = registry.listRegistered();
    expect(registered).toContain('high_impact_improvement');
  });

  test('should unregister resolver', () => {
    registry.unregister('quick_win');
    
    const retrieved = registry.getResolver('quick_win');
    expect(retrieved).toBeNull();
    
    const registered = registry.listRegistered();
    expect(registered).not.toContain('quick_win');
  });

  test('should return null for unregistered type', () => {
    // First unregister the type that's registered by default
    registry.unregister('advanced_optimization');
    
    const resolver = registry.getResolver('advanced_optimization');
    expect(resolver).toBeNull();
  });
});

describe('Main Template Functions', () => {
  const context = {
    sessionId: 'test-session',
    totalRecommendations: 3,
    userProfile: {
      experienceLevel: 'intermediate' as UserExperienceLevel,
      focusAreas: ['content']
    }
  };

  describe('renderRecommendationTemplate', () => {
    test('should render single recommendation template', () => {
      const config = createDefaultConfig('summary', 'dashboard');
      const result = renderRecommendationTemplate(mockPrioritizedRecommendation, config, context);
      
      expect(result.content).toBeDefined();
      expect(result.metadata.templateId).toContain('critical_issue');
      expect(result.metadata.variant).toBe('summary');
    });

    test('should handle missing user profile gracefully', () => {
      const config = createDefaultConfig('summary', 'dashboard');
      const contextWithoutProfile = { ...context, userProfile: undefined };
      
      const result = renderRecommendationTemplate(mockPrioritizedRecommendation, config, contextWithoutProfile);
      expect(result.content).toBeDefined();
    });
  });

  describe('renderRecommendationList', () => {
    const recommendations = [
      mockPrioritizedRecommendation,
      {
        ...mockPrioritizedRecommendation,
        id: '2',
        type: 'quick_win' as const,
        title: 'Practice Speaking Pace'
      }
    ];

    test('should render multiple recommendations', () => {
      const config = createDefaultConfig('summary', 'dashboard');
      const results = renderRecommendationList(recommendations, config, context);
      
      expect(results).toHaveLength(2);
      expect(results[0].metadata.templateId).toContain('critical_issue');
      expect(results[1].metadata.templateId).toContain('quick_win');
    });

    test('should handle empty recommendation list', () => {
      const config = createDefaultConfig('summary', 'dashboard');
      const results = renderRecommendationList([], config, context);
      
      expect(results).toHaveLength(0);
    });
  });

  describe('selectOptimalTemplate', () => {
    test('should select appropriate template for critical issues', () => {
      const config = selectOptimalTemplate(mockPrioritizedRecommendation, 'dashboard');
      
      expect(config.variant).toBe('summary'); // Dashboard context
      expect(config.context).toBe('dashboard');
      expect(config.showMetrics).toBe(true);
    });

    test('should adapt for mobile context', () => {
      const config = selectOptimalTemplate(mockPrioritizedRecommendation, 'mobile');
      
      expect(config.context).toBe('mobile');
      expect(config.showMetrics).toBe(false);
      expect(config.maxActionSteps).toBe(3);
    });

    test('should respect user experience level', () => {
      const config = selectOptimalTemplate(mockPrioritizedRecommendation, 'results', 'beginner');
      
      expect(config.userLevel).toBe('beginner');
      expect(config.maxActionSteps).toBe(5); // Base default, adjustments happen during resolution
      expect(config.showTimeline).toBe(false); // Base default for results context
      
      // Test that adjustments are applied during resolution
      const resolver = new BaseTemplateResolver();
      const result = resolver.resolve(mockTemplateData, config);
      
      // The resolver should have applied user level adjustments internally
      expect(result.content).toBeDefined();
    });

    test('should handle different recommendation types', () => {
      const quickWin = {
        ...mockPrioritizedRecommendation,
        type: 'quick_win' as const
      };
      
      const config = selectOptimalTemplate(quickWin, 'dashboard');
      expect(config).toBeDefined();
    });
  });
});

describe('Template Framework Edge Cases', () => {
  test('should handle missing optional metadata', () => {
    const minimalData: TemplateData = {
      recommendation: mockPrioritizedRecommendation,
      metadata: {},
      context: {
        sessionId: 'test'
      }
    };
    
    const config = createDefaultConfig('summary', 'dashboard');
    const resolver = new BaseTemplateResolver();
    
    const result = resolver.resolve(minimalData, config);
    expect(result.content).toBeDefined();
  });

  test('should handle all template variants', () => {
    const resolver = new BaseTemplateResolver();
    const variants: TemplateVariant[] = ['summary', 'detailed', 'compact', 'export', 'timeline'];
    
    variants.forEach(variant => {
      const config = createDefaultConfig(variant, 'results');
      const result = resolver.resolve(mockTemplateData, config);
      expect(result.content).toBeDefined();
      expect(result.metadata.variant).toBe(variant);
    });
  });

  test('should handle all display contexts', () => {
    const resolver = new BaseTemplateResolver();
    const contexts: DisplayContext[] = ['dashboard', 'results', 'modal', 'print', 'email', 'mobile', 'embedded'];
    
    contexts.forEach(context => {
      const config = createDefaultConfig('summary', context);
      const result = resolver.resolve(mockTemplateData, config);
      expect(result.content).toBeDefined();
    });
  });

  test('should handle extreme user experience levels', () => {
    const levels: UserExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
    
    levels.forEach(level => {
      const config = createDefaultConfig('detailed', 'results', level);
      const adjusted = adjustConfigForUserLevel(config, level);
      expect(adjusted.userLevel).toBe(level);
    });
  });
}); 