/**
 * End-to-End Integration Test
 * 
 * Tests the complete recommendation system workflow including:
 * - Recommendation generation from framework scores
 * - Prioritization and template rendering
 * - Timeline integration and scheduling
 * - Export functionality across all formats
 * - Error handling and edge cases
 */

import {
  generatePitchRecommendations,
  RecommendationEngine
} from '../../lib/recommendation-engine';
import {
  RecommendationPrioritizer,
  PITCH_OPTIMIZATION_WEIGHTS
} from '../../lib/recommendation-prioritization';
import {
  renderRecommendationTemplate,
  createDefaultConfig
} from '../../lib/recommendation-templates/resolver';
import {
  TimelineIntegrationService
} from '../../lib/recommendation-timeline-integration';
import {
  createRecommendationExporter
} from '../../lib/recommendation-export';
import { ComprehensiveFrameworkScore, FrameworkScore } from '../../lib/scoring-framework';

// Mock framework score for testing
const mockFrameworkScore: ComprehensiveFrameworkScore = {
  sessionId: 'end-to-end-test',
  overallScore: 6.8,
  categoryScores: {
    content: 7.2,
    speech: 6.1,
    visual: 7.5,
    overall: 6.8
  },
  individualScores: [
    {
      pointId: 'content_market_opportunity',
      score: 5.5,
      rationale: 'Market size data needs more specificity',
      improvementSuggestions: ['Add TAM/SAM data', 'Include market research'],
      confidence: 0.9
    },
    {
      pointId: 'speech_pace_rhythm',
      score: 6.2,
      rationale: 'Good pace overall, could use more strategic pauses',
      improvementSuggestions: ['Add pauses for emphasis', 'Vary speaking rhythm'],
      confidence: 0.8
    },
    {
      pointId: 'visual_slide_design',
      score: 8.1,
      rationale: 'Strong visual design with consistent branding',
      improvementSuggestions: ['Consider animation timing'],
      confidence: 0.7
    }
  ],
  analysisTimestamp: new Date(),
  processingTime: 120
};

describe('End-to-End Recommendation System Integration', () => {
  let recommendationEngine: RecommendationEngine;
  let prioritizer: RecommendationPrioritizer;
  let timelineService: TimelineIntegrationService;
  let exporter: any;

  beforeEach(() => {
    recommendationEngine = new RecommendationEngine();
    prioritizer = new RecommendationPrioritizer(PITCH_OPTIMIZATION_WEIGHTS);
    timelineService = new TimelineIntegrationService();
    exporter = createRecommendationExporter();
  });

  describe('Complete Workflow: Score → Recommendations → Export', () => {
    test('should handle complete workflow from framework score to exported report', async () => {
      // Step 1: Generate recommendations from framework score
      const recommendationSet = await generatePitchRecommendations(mockFrameworkScore, {
        includeComparison: true,
        userProfile: {
          experienceLevel: 'intermediate',
          focusAreas: ['content', 'delivery']
        }
      });

      expect(recommendationSet).toBeDefined();
      expect(recommendationSet.recommendations.length).toBeGreaterThan(0);
      expect(recommendationSet.sessionId).toBe('end-to-end-test');

      // Step 2: Prioritize recommendations
      const prioritizedRecs = prioritizer.prioritizeRecommendations(
        recommendationSet.recommendations,
        {
          userProfile: {
            experienceLevel: 'intermediate',
            focusAreas: ['content', 'delivery'],
            timeToPresentation: 7
          },
          presentationContext: {
            audienceType: 'investors',
            presentationLength: 10,
            criticality: 'high'
          },
          frameworkScore: mockFrameworkScore
        }
      );

      expect(prioritizedRecs.length).toBe(recommendationSet.recommendations.length);
      expect(prioritizedRecs[0].priorityScore).toBeGreaterThan(prioritizedRecs[prioritizedRecs.length - 1].priorityScore);

      // Step 3: Initialize timeline with recommendations
      timelineService.initializeTimeline(recommendationSet);
      const timelineRecs = timelineService.getRecommendations();
      expect(timelineRecs.length).toBeGreaterThan(0);

      // Step 4: Test template rendering
      const templateConfig = createDefaultConfig('summary', 'dashboard');
      const renderedTemplate = renderRecommendationTemplate(
        prioritizedRecs[0],
        templateConfig,
        { sessionId: 'end-to-end-test' }
      );

      expect(renderedTemplate.content).toBeDefined();
      expect(renderedTemplate.metadata.templateId).toBeDefined();

      // Step 5: Export in multiple formats
      const exportFormats = ['html', 'csv', 'json', 'text'] as const;
      const exportResults = [];

      for (const format of exportFormats) {
        const result = await exporter.exportRecommendations(
          prioritizedRecs,
          { format },
          {
            sessionId: recommendationSet.sessionId,
            overallAssessment: recommendationSet.overallAssessment
          }
        );

        expect(result.success).toBe(true);
        expect(result.content).toBeDefined();
        expect(result.metadata.format).toBe(format);
        expect(result.metadata.recommendationCount).toBe(prioritizedRecs.length);

        exportResults.push(result);
      }

      // Verify export content quality
      const htmlExport = exportResults.find(r => r.metadata.format === 'html');
      const jsonExport = exportResults.find(r => r.metadata.format === 'json');

      expect(htmlExport?.content).toContain('Pitch Perfect');
      expect(htmlExport?.content).toContain(prioritizedRecs[0].title);

      const jsonContent = JSON.parse(jsonExport?.content as string);
      expect(jsonContent.recommendations).toBeDefined();
      expect(jsonContent.metadata.sessionId).toBe('end-to-end-test');
    });

    test('should handle error scenarios gracefully', async () => {
      // Test with empty recommendations
      const emptyResult = await exporter.exportRecommendations([], { format: 'html' });
      expect(emptyResult.success).toBe(true); // Should handle empty gracefully

      // Test with invalid format (this should be caught by TypeScript, but testing runtime)
      try {
        await exporter.exportRecommendations(
          [],
          { format: 'invalid' as any }
        );
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should maintain data integrity across all transformations', async () => {
      // Generate recommendations
      const recommendationSet = await generatePitchRecommendations(mockFrameworkScore);
      const originalIds = recommendationSet.recommendations.map(r => r.id);

      // Prioritize
      const prioritizedRecs = prioritizer.prioritizeRecommendations(
        recommendationSet.recommendations,
        {
          userProfile: { experienceLevel: 'intermediate' },
          presentationContext: { 
            audienceType: 'investors',
            presentationLength: 10,
            criticality: 'high'
          },
          frameworkScore: mockFrameworkScore
        }
      );

      // Verify all original IDs are preserved
      const prioritizedIds = prioritizedRecs.map(r => r.id);
      expect(prioritizedIds.sort()).toEqual(originalIds.sort());

      // Timeline integration
      timelineService.initializeTimeline(recommendationSet);
      const timelineRecs = timelineService.getRecommendations();
      const timelineIds = timelineRecs.map(r => r.id);
      expect(timelineIds.sort()).toEqual(originalIds.sort());

      // Export and verify content preservation
      const exportResult = await exporter.exportRecommendations(
        prioritizedRecs,
        { format: 'json' }
      );

      const exportedData = JSON.parse(exportResult.content as string);
      const exportedIds = exportedData.recommendations.map((r: any) => r.id);
      expect(exportedIds.sort()).toEqual(originalIds.sort());
    });

    test('should handle large recommendation sets efficiently', async () => {
      // Create a large set of mock recommendations
      const largeRecommendationSet = Array.from({ length: 50 }, (_, i) => ({
        id: `rec-${i}`,
        type: 'high_impact_improvement' as const,
        category: 'content' as const,
        priority: 'medium' as const,
        title: `Recommendation ${i + 1}`,
        description: `Description for recommendation ${i + 1}`,
        actionableSteps: [`Step 1 for rec ${i}`, `Step 2 for rec ${i}`],
        estimatedImpact: 'medium' as const,
        estimatedEffort: 'low' as const,
        relatedFrameworkPoints: ['content_market_opportunity'],
        confidence: 0.8
      }));

      const startTime = performance.now();

      // Prioritize large set
      const prioritized = prioritizer.prioritizeRecommendations(
        largeRecommendationSet,
        {
          userProfile: { experienceLevel: 'intermediate' },
          presentationContext: { 
            audienceType: 'investors',
            presentationLength: 10,
            criticality: 'high'
          },
          frameworkScore: mockFrameworkScore
        }
      );

      const prioritizationTime = performance.now() - startTime;
      expect(prioritizationTime).toBeLessThan(1000); // Should complete within 1 second

      // Export large set
      const exportStartTime = performance.now();
      const exportResult = await exporter.exportRecommendations(
        prioritized,
        { format: 'html' }
      );

      const exportTime = performance.now() - exportStartTime;
      expect(exportTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(exportResult.success).toBe(true);
      expect(exportResult.metadata.recommendationCount).toBe(50);
    });
  });

  describe('Integration Error Handling', () => {
    test('should handle malformed framework scores', async () => {
      const malformedScore = {
        ...mockFrameworkScore,
        individualScores: null as any
      };

      try {
        await generatePitchRecommendations(malformedScore);
      } catch (error) {
        // Should handle gracefully or throw meaningful error
        expect(error).toBeDefined();
      }
    });

    test('should handle timeline service errors', () => {
      const invalidRecommendationSet = {
        sessionId: 'test',
        recommendations: null as any,
        overallAssessment: {
          primaryStrengths: [],
          primaryWeaknesses: []
        },
        categorizedRecommendations: {
          critical: [],
          high: [],
          medium: [],
          low: []
        },
        quickWins: [],
        generatedAt: new Date(),
        totalRecommendations: 0
      };

      expect(() => {
        timelineService.initializeTimeline(invalidRecommendationSet);
      }).not.toThrow(); // Should handle gracefully
    });
  });

  describe('System Performance Benchmarks', () => {
    test('should meet performance requirements for typical use cases', async () => {
      const iterations = 5;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        // Complete workflow
        const recommendationSet = await generatePitchRecommendations(mockFrameworkScore);
        const prioritized = prioritizer.prioritizeRecommendations(
          recommendationSet.recommendations,
          {
            userProfile: { experienceLevel: 'intermediate' },
            presentationContext: { 
              audienceType: 'investors',
              presentationLength: 10,
              criticality: 'high'
            },
            frameworkScore: mockFrameworkScore
          }
        );
        timelineService.initializeTimeline(recommendationSet);
        await exporter.exportRecommendations(prioritized, { format: 'html' });

        times.push(performance.now() - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(averageTime).toBeLessThan(2000); // Average under 2 seconds
      expect(maxTime).toBeLessThan(5000); // Max under 5 seconds

      console.log(`Performance: Average ${averageTime.toFixed(2)}ms, Max ${maxTime.toFixed(2)}ms`);
    });
  });
}); 