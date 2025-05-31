/**
 * Recommendation Template Framework Demo
 * 
 * Demonstrates usage of the template system with example data
 * and various configurations for different contexts and user levels.
 */

import React from 'react';
import { 
  renderRecommendationTemplate,
  renderRecommendationList,
  selectOptimalTemplate,
  createDefaultConfig,
  SummaryTemplate,
  DetailedTemplate,
  CompactTemplate,
  ExportTemplate,
  TimelineTemplate
} from './index';
import { PrioritizedRecommendation } from '../recommendation-prioritization';

// Sample recommendation data for demonstration
export const SAMPLE_RECOMMENDATIONS: PrioritizedRecommendation[] = [
  {
    id: 'rec_001',
    type: 'critical_issue',
    category: 'speech',
    priority: 'critical',
    title: 'Improve Speaking Pace and Clarity',
    description: 'Your speaking pace is too fast, making it difficult for investors to follow your key points. This significantly impacts message retention and credibility.',
    actionableSteps: [
      'Practice speaking at 150-170 words per minute',
      'Use intentional pauses after key statements',
      'Record yourself and identify rushed sections',
      'Practice with a metronome to maintain consistent pace'
    ],
    estimatedImpact: 'high',
    estimatedEffort: 'medium',
    relatedFrameworkPoints: ['speech_pace_rhythm', 'speech_clarity_articulation'],
    confidence: 0.92,
    evidence: 'Analysis shows speaking pace of 220+ WPM, well above recommended 150-170 WPM for investor presentations',
    
    // Prioritization fields
    priorityScore: 11.2,
    impactMultiplier: 1.4,
    urgencyFactor: 0.9,
    implementationDifficulty: 4,
    investorRelevance: 8,
    timeToImplement: 8,
    prerequisiteRecommendations: []
  },
  {
    id: 'rec_002',
    type: 'quick_win',
    category: 'visual',
    priority: 'medium',
    title: 'Optimize Slide Timing and Flow',
    description: 'Simple adjustments to slide transitions and timing can significantly improve presentation flow and audience engagement.',
    actionableSteps: [
      'Spend 30-45 seconds per slide maximum',
      'Add smooth transitions between sections',
      'Practice slide advancement timing'
    ],
    estimatedImpact: 'medium',
    estimatedEffort: 'low',
    relatedFrameworkPoints: ['visual_timing_flow'],
    confidence: 0.78,
    
    // Prioritization fields
    priorityScore: 8.5,
    impactMultiplier: 1.1,
    urgencyFactor: 0.6,
    implementationDifficulty: 2,
    investorRelevance: 6,
    timeToImplement: 2,
    prerequisiteRecommendations: []
  },
  {
    id: 'rec_003',
    type: 'strength_to_leverage',
    category: 'content',
    priority: 'medium',
    title: 'Leverage Strong Market Analysis',
    description: 'Your market opportunity section is exceptionally well-researched. Use this strength to enhance other sections of your pitch.',
    actionableSteps: [
      'Reference market data throughout presentation',
      'Connect team expertise to market insights',
      'Use market analysis to support financial projections'
    ],
    estimatedImpact: 'medium',
    estimatedEffort: 'low',
    relatedFrameworkPoints: ['content_market_opportunity'],
    confidence: 0.85,
    evidence: 'Market analysis scores 9.2/10 with comprehensive data and compelling insights',
    
    // Prioritization fields
    priorityScore: 7.8,
    impactMultiplier: 1.0,
    urgencyFactor: 0.4,
    implementationDifficulty: 3,
    investorRelevance: 7,
    timeToImplement: 4,
    prerequisiteRecommendations: []
  }
];

// Demo component showing all template variants
export function TemplateVariantsDemo() {
  const sampleRec = SAMPLE_RECOMMENDATIONS[0];
  const context = {
    sessionId: 'demo_session',
    overallAssessment: {
      primaryStrengths: ['Market Analysis', 'Team Expertise'],
      primaryWeaknesses: ['Speaking Pace', 'Financial Projections'],
      competitivePosition: 'Good - Above Average'
    },
    totalRecommendations: 3,
    userProfile: {
      experienceLevel: 'intermediate' as const,
      focusAreas: ['speech', 'content']
    }
  };

  return (
    <div className="space-y-8 p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Template Variants Demo
      </h2>
      
      {/* Summary Template */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Summary Template (for lists and cards)
        </h3>
        <SummaryTemplate
          data={{
            recommendation: sampleRec,
            metadata: { estimatedReadTime: 1 },
            context
          }}
          config={createDefaultConfig('summary', 'dashboard')}
        />
      </div>

      {/* Detailed Template */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Detailed Template (for focus views)
        </h3>
        <DetailedTemplate
          data={{
            recommendation: sampleRec,
            metadata: { estimatedReadTime: 2 },
            context
          }}
          config={createDefaultConfig('detailed', 'modal')}
        />
      </div>

      {/* Compact Template */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Compact Template (for mobile/constrained spaces)
        </h3>
        <CompactTemplate
          data={{
            recommendation: sampleRec,
            metadata: { estimatedReadTime: 1 },
            context
          }}
          config={createDefaultConfig('compact', 'mobile')}
        />
      </div>

      {/* Timeline Template */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Timeline Template (for scheduling)
        </h3>
        <TimelineTemplate
          data={{
            recommendation: sampleRec,
            metadata: { estimatedReadTime: 1 },
            context
          }}
          config={createDefaultConfig('timeline', 'dashboard')}
        />
      </div>

      {/* Export Template */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Export Template (for print/document)
        </h3>
        <ExportTemplate
          data={{
            recommendation: sampleRec,
            metadata: { estimatedReadTime: 2 },
            context
          }}
          config={createDefaultConfig('export', 'print')}
        />
      </div>
    </div>
  );
}

// Demo component showing context-based template selection
export function ContextBasedDemo() {
  const sampleRec = SAMPLE_RECOMMENDATIONS[0];
  const contexts = ['dashboard', 'results', 'modal', 'mobile', 'print'] as const;
  
  const context = {
    sessionId: 'demo_session',
    userProfile: {
      experienceLevel: 'intermediate' as const
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Context-Based Template Selection
      </h2>
      
      {contexts.map(displayContext => {
        const config = selectOptimalTemplate(sampleRec, displayContext);
        const result = renderRecommendationTemplate(sampleRec, config, context);
        
        return (
          <div key={displayContext} className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Context: {displayContext} → Variant: {config.variant}
            </h3>
            <div>{result.content}</div>
          </div>
        );
      })}
    </div>
  );
}

// Demo component showing user experience level adaptations
export function UserLevelDemo() {
  const sampleRec = SAMPLE_RECOMMENDATIONS[0];
  const userLevels = ['beginner', 'intermediate', 'advanced'] as const;
  
  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        User Experience Level Adaptations
      </h2>
      
      {userLevels.map(userLevel => {
        const config = createDefaultConfig('detailed', 'results', userLevel);
        const context = {
          sessionId: 'demo_session',
          userProfile: { experienceLevel: userLevel }
        };
        
        return (
          <div key={userLevel} className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              User Level: {userLevel}
            </h3>
            <DetailedTemplate
              data={{
                recommendation: sampleRec,
                metadata: { estimatedReadTime: 2 },
                context
              }}
              config={config}
            />
          </div>
        );
      })}
    </div>
  );
}

// Demo component showing batch rendering
export function BatchRenderingDemo() {
  const context = {
    sessionId: 'demo_session',
    overallAssessment: {
      primaryStrengths: ['Market Analysis', 'Team Expertise'],
      primaryWeaknesses: ['Speaking Pace', 'Financial Projections'],
      competitivePosition: 'Good - Above Average'
    },
    userProfile: {
      experienceLevel: 'intermediate' as const
    }
  };

  const config = createDefaultConfig('summary', 'dashboard');
  const results = renderRecommendationList(SAMPLE_RECOMMENDATIONS, config, context);

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Batch Rendering Demo
      </h2>
      <p className="text-gray-600 dark:text-gray-300">
        Rendering {SAMPLE_RECOMMENDATIONS.length} recommendations in summary format for dashboard view
      </p>
      
      <div className="space-y-4">
        {results.map((result, index) => (
          <div key={index}>
            {result.content}
          </div>
        ))}
      </div>
    </div>
  );
}

// Usage examples for documentation
export const USAGE_EXAMPLES = {
  basicUsage: `
import { renderRecommendationTemplate, createDefaultConfig } from '@/lib/recommendation-templates';

const config = createDefaultConfig('detailed', 'modal', 'intermediate');
const result = renderRecommendationTemplate(recommendation, config, {
  sessionId: 'user_session_123',
  userProfile: { experienceLevel: 'intermediate' }
});

// Render the template
return <div>{result.content}</div>;
  `,

  smartSelection: `
import { selectOptimalTemplate, renderRecommendationTemplate } from '@/lib/recommendation-templates';

// Automatically select the best template for the context
const config = selectOptimalTemplate(recommendation, 'mobile', 'beginner');
const result = renderRecommendationTemplate(recommendation, config, context);
  `,

  batchRendering: `
import { renderRecommendationList, createDefaultConfig } from '@/lib/recommendation-templates';

const config = createDefaultConfig('summary', 'dashboard');
const results = renderRecommendationList(recommendations, config, {
  sessionId: 'session_id',
  totalRecommendations: recommendations.length
});

// Render all templates
return (
  <div className="space-y-4">
    {results.map((result, index) => (
      <div key={index}>{result.content}</div>
    ))}
  </div>
);
  `,

  customConfiguration: `
import { TemplateConfig } from '@/lib/recommendation-templates';

const customConfig: TemplateConfig = {
  variant: 'detailed',
  context: 'modal',
  userLevel: 'advanced',
  showMetrics: true,
  showTimeline: true,
  showPrerequisites: true,
  maxActionSteps: 8,
  enableInteractions: true,
  customIcons: {
    'critical_issue': '⚠️',
    'quick_win': '✅'
  }
};
  `
};

// Integration example for results page
export function ResultsPageIntegration({ recommendations }: { recommendations: PrioritizedRecommendation[] }) {
  const context = {
    sessionId: 'current_session',
    totalRecommendations: recommendations.length,
    userProfile: {
      experienceLevel: 'intermediate' as const
    }
  };

  // Group recommendations by priority
  const critical = recommendations.filter(r => r.priority === 'critical');
  const high = recommendations.filter(r => r.priority === 'high');
  const medium = recommendations.filter(r => r.priority === 'medium');
  const low = recommendations.filter(r => r.priority === 'low');

  return (
    <div className="space-y-8">
      {/* Critical Issues - Always detailed */}
      {critical.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
            Critical Issues ({critical.length})
          </h2>
          <div className="space-y-4">
            {critical.map(rec => {
              const config = createDefaultConfig('detailed', 'results');
              const result = renderRecommendationTemplate(rec, config, context);
              return <div key={rec.id}>{result.content}</div>;
            })}
          </div>
        </section>
      )}

      {/* High Priority - Summary */}
      {high.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-orange-600 dark:text-orange-400 mb-4">
            High Priority ({high.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {high.map(rec => {
              const config = createDefaultConfig('summary', 'results');
              const result = renderRecommendationTemplate(rec, config, context);
              return <div key={rec.id}>{result.content}</div>;
            })}
          </div>
        </section>
      )}

      {/* Medium/Low Priority - Compact */}
      {(medium.length > 0 || low.length > 0) && (
        <section>
          <h2 className="text-xl font-bold text-gray-600 dark:text-gray-400 mb-4">
            Other Recommendations ({medium.length + low.length})
          </h2>
          <div className="space-y-2">
            {[...medium, ...low].map(rec => {
              const config = createDefaultConfig('compact', 'results');
              const result = renderRecommendationTemplate(rec, config, context);
              return <div key={rec.id}>{result.content}</div>;
            })}
          </div>
        </section>
      )}
    </div>
  );
} 