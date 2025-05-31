/**
 * Contextual Feedback Generation Demo
 * 
 * Demonstrates the contextual feedback system with sample data and integration examples
 */

import {
  ContextualFeedbackGenerator,
  ContextualFeedbackUtils,
  DEMO_USER_CONTEXT,
  AnalysisContext,
  ContextualFeedback
} from './contextual-feedback';
import { SAMPLE_RECOMMENDATIONS } from './recommendation-templates/demo';
import { FRAMEWORK_POINTS } from './scoring-framework';

// Demo analysis context
export const DEMO_ANALYSIS_CONTEXT: AnalysisContext = {
  comprehensiveScore: {
    sessionId: 'demo_session_001',
    overallScore: 6.5,
    categoryScores: {
      speech: 5.8,
      content: 7.2,
      visual: 6.1,
      overall: 6.5
    },
    individualScores: [
      {
        pointId: 'speech_pace_rhythm',
        score: 5.2,
        rationale: 'Speaking pace at 195 WPM is slightly fast for investor presentations. Strategic pauses could be better utilized.',
        improvementSuggestions: ['Slow down to 160-180 WPM', 'Add strategic pauses for emphasis'],
        confidence: 0.85
      },
      {
        pointId: 'speech_filler_words',
        score: 4.8,
        rationale: 'Filler word rate of 3.2 per minute exceeds recommended threshold. Multiple "um" and "like" instances detected.',
        improvementSuggestions: ['Practice eliminating filler words', 'Use pauses instead of fillers'],
        confidence: 0.9
      },
      {
        pointId: 'content_problem_definition',
        score: 7.8,
        rationale: 'Clear problem articulation with good market validation. Could benefit from more specific pain point examples.',
        improvementSuggestions: ['Add specific customer pain point examples', 'Quantify problem magnitude'],
        confidence: 0.8
      },
      {
        pointId: 'visual_design_quality',
        score: 6.0,
        rationale: 'Professional appearance with room for improvement in visual hierarchy and information density.',
        improvementSuggestions: ['Improve visual hierarchy', 'Reduce information density on slides'],
        confidence: 0.75
      }
    ],
    analysisTimestamp: new Date(),
    processingTime: 2500
  },
  slideAnalysis: [
    {
      frameUrl: 'demo_slide_1.jpg',
      timestamp: 15,
      analysisType: 'comprehensive',
      confidence: 0.85,
      analysis: {
        slideContent: {
          title: 'The Problem',
          bulletPoints: [
            'Small businesses struggle with complex marketing automation',
            '67% lack resources for effective customer segmentation',
            'Current solutions cost $500+ per month'
          ],
          keyMessages: ['High cost barrier', 'Resource constraints'],
          textReadability: 'medium',
          informationDensity: 'high',
          visualElements: {
            charts: false,
            images: true,
            diagrams: false,
            logos: false
          }
        },
        visualQuality: {
          designConsistency: 'high',
          colorScheme: 'professional',
          typography: 'readable',
          layout: 'cluttered',
          overallProfessionalism: 6
        }
      },
      processingTime: 1200,
      requestId: 'demo_frame_001'
    },
    {
      frameUrl: 'demo_slide_2.jpg',
      timestamp: 45,
      analysisType: 'comprehensive',
      confidence: 0.8,
      analysis: {
        slideContent: {
          title: 'Our Solution',
          bulletPoints: [
            'AI-powered marketing automation at $49/month',
            'One-click customer segmentation',
            'Drag-and-drop campaign builder'
          ],
          keyMessages: ['Affordable pricing', 'Easy to use'],
          textReadability: 'high',
          informationDensity: 'medium',
          visualElements: {
            charts: false,
            images: true,
            diagrams: true,
            logos: true
          }
        },
        visualQuality: {
          designConsistency: 'high',
          colorScheme: 'engaging',
          typography: 'clear',
          layout: 'balanced',
          overallProfessionalism: 8
        }
      },
      processingTime: 1100,
      requestId: 'demo_frame_002'
    },
    {
      frameUrl: 'demo_slide_3.jpg',
      timestamp: 75,
      analysisType: 'comprehensive',
      confidence: 0.9,
      analysis: {
        slideContent: {
          title: 'Traction & Growth',
          bulletPoints: [
            '500+ customers in 6 months',
            '$50K ARR with 15% monthly growth',
            '4.8/5 customer satisfaction score'
          ],
          keyMessages: ['Strong traction', 'Happy customers'],
          textReadability: 'high',
          informationDensity: 'medium',
          visualElements: {
            charts: true,
            images: false,
            diagrams: false,
            logos: false
          }
        },
        visualQuality: {
          designConsistency: 'high',
          colorScheme: 'professional',
          typography: 'clear',
          layout: 'balanced',
          overallProfessionalism: 9
        }
      },
      processingTime: 950,
      requestId: 'demo_frame_003'
    }
  ],
  transcriptAnalysis: {
    fullTranscript: 'Today I want to talk about a problem that affects millions of small businesses...',
    wordCount: 850,
    duration: 300, // 5 minutes
    wordsPerMinute: 170,
    fillerWordCount: 16,
    fillerWordRate: 3.2,
    pauseData: {
      totalPauses: 24,
      averagePauseLength: 1.8,
      strategicPauses: 8
    },
    volumeConsistency: 0.75,
    clarityScore: 0.82,
    confidenceIndicators: {
      vocalTremor: false,
      upspeak: 2,
      assertiveStatements: 12
    }
  },
  benchmarkData: {
    industryAverage: 6.8,
    topPerformerThreshold: 8.5,
    categoryBenchmarks: {
      speech: 6.5,
      content: 7.0,
      visual: 6.8,
      overall: 6.8
    }
  }
};

/**
 * Demo class to showcase contextual feedback generation
 */
export class ContextualFeedbackDemo {
  private generator: ContextualFeedbackGenerator;

  constructor() {
    this.generator = new ContextualFeedbackGenerator();
  }

  /**
   * Run a complete demo of the contextual feedback system
   */
  async runDemo(): Promise<void> {
    console.log('🎯 Contextual Feedback Generation Demo\n');

    try {
      // Generate contextual feedback for sample recommendations
      const feedback = await this.generator.generateContextualFeedback(
        SAMPLE_RECOMMENDATIONS,
        DEMO_ANALYSIS_CONTEXT,
        DEMO_USER_CONTEXT
      );

      console.log(`✅ Generated ${feedback.length} contextual feedback items\n`);

      // Display feedback summary
      this.displayFeedbackSummary(feedback);

      // Show different types of feedback
      this.demonstrateFeedbackTypes(feedback);

      // Show context filtering
      this.demonstrateContextFiltering(feedback);

      // Show usage examples
      this.demonstrateUsageExamples(feedback);

    } catch (error) {
      console.error('❌ Demo failed:', error);
    }
  }

  /**
   * Display summary of generated feedback
   */
  private displayFeedbackSummary(feedback: ContextualFeedback[]): void {
    const summary = ContextualFeedbackUtils.generateFeedbackSummary(feedback);
    
    console.log('📊 Feedback Summary:');
    console.log(`   Total: ${summary.totalCount} items`);
    console.log('   By Context Type:');
    Object.entries(summary.byContext).forEach(([type, count]) => {
      console.log(`     ${type}: ${count} items`);
    });
    console.log('   By Priority:');
    Object.entries(summary.byPriority).forEach(([priority, count]) => {
      console.log(`     ${priority}: ${count} items`);
    });
    console.log('\n');
  }

  /**
   * Demonstrate different types of contextual feedback
   */
  private demonstrateFeedbackTypes(feedback: ContextualFeedback[]): void {
    console.log('🎨 Different Feedback Types:\n');

    // Show slide-specific feedback
    const slideSpecific = ContextualFeedbackUtils.filterByContext(feedback, 'slide_specific');
    if (slideSpecific.length > 0) {
      console.log('📐 Slide-Specific Feedback:');
      console.log(`   "${slideSpecific[0].content.primaryMessage}"`);
      console.log(`   Context: ${slideSpecific[0].content.contextualExplanation}`);
      if (slideSpecific[0].content.slideReferences) {
        console.log('   Related Slides:');
        slideSpecific[0].content.slideReferences.forEach(ref => {
          console.log(`     Slide ${ref.slideIndex}: ${ref.slideTitle || 'Untitled'}`);
        });
      }
      console.log('');
    }

    // Show performance-based feedback
    const performanceBased = ContextualFeedbackUtils.filterByContext(feedback, 'performance_based');
    if (performanceBased.length > 0) {
      console.log('📈 Performance-Based Feedback:');
      console.log(`   "${performanceBased[0].content.primaryMessage}"`);
      console.log(`   Context: ${performanceBased[0].content.contextualExplanation}`);
      if (performanceBased[0].content.performanceComparisons) {
        console.log('   Performance Comparisons:');
        performanceBased[0].content.performanceComparisons.slice(0, 2).forEach(comp => {
          console.log(`     ${comp.metric}: Your ${comp.userValue} vs Benchmark ${comp.benchmarkValue}`);
        });
      }
      console.log('');
    }

    // Show timing-based feedback
    const timingBased = ContextualFeedbackUtils.filterByContext(feedback, 'timestamp_based');
    if (timingBased.length > 0) {
      console.log('⏱️ Timing-Based Feedback:');
      console.log(`   "${timingBased[0].content.primaryMessage}"`);
      console.log(`   Context: ${timingBased[0].content.contextualExplanation}`);
      if (timingBased[0].content.timingCues) {
        console.log('   Timing Cues:');
        timingBased[0].content.timingCues.slice(0, 2).forEach(cue => {
          console.log(`     ${Math.floor(cue.timestamp / 60)}:${(cue.timestamp % 60).toFixed(0).padStart(2, '0')} - ${cue.description}`);
        });
      }
      console.log('');
    }
  }

  /**
   * Demonstrate context-based filtering
   */
  private demonstrateContextFiltering(feedback: ContextualFeedback[]): void {
    console.log('🔍 Context Filtering Examples:\n');

    // Filter by current user state
    const currentState = {
      slideIndex: 1,
      timestamp: 45,
      activeRecommendations: ['rec_001', 'rec_002']
    };

    const contextFiltered = ContextualFeedbackUtils.filterByCurrentState(feedback, currentState);
    console.log(`📍 Feedback for current state (slide ${currentState.slideIndex}, ${currentState.timestamp}s):`);
    console.log(`   Found ${contextFiltered.length} relevant feedback items`);
    
    contextFiltered.slice(0, 2).forEach((f, index) => {
      console.log(`   ${index + 1}. ${f.content.primaryMessage}`);
      console.log(`      Priority: ${f.displayMetadata.priority} | Type: ${f.contextType}`);
    });
    console.log('');

    // Filter by priority
    const criticalFeedback = feedback.filter(f => f.displayMetadata.priority === 'critical');
    const highFeedback = feedback.filter(f => f.displayMetadata.priority === 'high');
    
    console.log('🚨 Priority-Based Filtering:');
    console.log(`   Critical: ${criticalFeedback.length} items`);
    console.log(`   High: ${highFeedback.length} items`);
    console.log('');
  }

  /**
   * Demonstrate practical usage examples
   */
  private demonstrateUsageExamples(feedback: ContextualFeedback[]): void {
    console.log('💡 Usage Examples:\n');

    if (feedback.length > 0) {
      const exampleFeedback = feedback[0];
      
      console.log('📋 Example Feedback Structure:');
      console.log(`   ID: ${exampleFeedback.id}`);
      console.log(`   Recommendation: ${exampleFeedback.recommendationId}`);
      console.log(`   Type: ${exampleFeedback.contextType}`);
      console.log(`   Personalization: ${exampleFeedback.personalizationLevel}`);
      console.log(`   Priority: ${exampleFeedback.displayMetadata.priority}`);
      console.log(`   Interaction Required: ${exampleFeedback.displayMetadata.interactionRequired}`);
      console.log(`   Placement: ${exampleFeedback.displayMetadata.placement.context}`);
      console.log('');

      console.log('🎯 Actionable Insights:');
      exampleFeedback.content.actionableInsights.forEach((insight, index) => {
        console.log(`   ${index + 1}. ${insight}`);
      });
      console.log('');

      console.log('📝 Next Steps:');
      exampleFeedback.content.nextSteps.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step.action}`);
        console.log(`      Time: ${step.estimatedTimeMinutes} min | Difficulty: ${step.difficulty} | Impact: ${step.expectedImpact}`);
      });
      console.log('');
    }

    // Integration example
    console.log('🔗 Integration Examples:');
    console.log('   1. Timeline View: Show timing-based feedback at specific timestamps');
    console.log('   2. Slide Overlay: Display slide-specific feedback when reviewing slides');
    console.log('   3. Progress Sidebar: Show performance trends and improvement suggestions');
    console.log('   4. Practice Mode: Contextual hints based on user behavior and progress');
    console.log('   5. Export Reports: Include personalized feedback in recommendation exports');
    console.log('');
  }

  /**
   * Test specific contextual feedback scenarios
   */
  async testSpecificScenarios(): Promise<void> {
    console.log('🧪 Testing Specific Scenarios:\n');

    // Test with beginner user
    const beginnerContext = {
      ...DEMO_USER_CONTEXT,
      userProfile: {
        ...DEMO_USER_CONTEXT.userProfile,
        experienceLevel: 'beginner' as const
      }
    };

    const beginnerFeedback = await this.generator.generateContextualFeedback(
      SAMPLE_RECOMMENDATIONS.slice(0, 2),
      DEMO_ANALYSIS_CONTEXT,
      beginnerContext
    );

    console.log(`👶 Beginner User Feedback: ${beginnerFeedback.length} items generated`);
    if (beginnerFeedback.length > 0) {
      console.log(`   Sample: "${beginnerFeedback[0].content.primaryMessage}"`);
    }
    console.log('');

    // Test with advanced user
    const advancedContext = {
      ...DEMO_USER_CONTEXT,
      userProfile: {
        ...DEMO_USER_CONTEXT.userProfile,
        experienceLevel: 'advanced' as const
      }
    };

    const advancedFeedback = await this.generator.generateContextualFeedback(
      SAMPLE_RECOMMENDATIONS.slice(0, 2),
      DEMO_ANALYSIS_CONTEXT,
      advancedContext
    );

    console.log(`🎓 Advanced User Feedback: ${advancedFeedback.length} items generated`);
    if (advancedFeedback.length > 0) {
      console.log(`   Sample: "${advancedFeedback[0].content.primaryMessage}"`);
    }
    console.log('');

    // Test with critical stakes
    const criticalContext = {
      ...DEMO_USER_CONTEXT,
      userProfile: {
        ...DEMO_USER_CONTEXT.userProfile,
        presentationContext: {
          ...DEMO_USER_CONTEXT.userProfile.presentationContext,
          stakesLevel: 'critical' as const,
          timeToPresentation: 1 // 1 day until presentation
        }
      }
    };

    const criticalFeedback = await this.generator.generateContextualFeedback(
      SAMPLE_RECOMMENDATIONS.slice(0, 2),
      DEMO_ANALYSIS_CONTEXT,
      criticalContext
    );

    console.log(`🚨 Critical Stakes Feedback: ${criticalFeedback.length} items generated`);
    console.log('   Priority distribution:');
    const priorityCounts = criticalFeedback.reduce((acc, f) => {
      acc[f.displayMetadata.priority] = (acc[f.displayMetadata.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    Object.entries(priorityCounts).forEach(([priority, count]) => {
      console.log(`     ${priority}: ${count} items`);
    });
    console.log('');
  }
}

// Export demo functions for easy testing
export async function runContextualFeedbackDemo(): Promise<void> {
  const demo = new ContextualFeedbackDemo();
  await demo.runDemo();
  await demo.testSpecificScenarios();
} 