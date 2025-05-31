# Recommendation Template Framework

A comprehensive, reusable template system for displaying recommendations with different variants, priorities, and contexts. Built with React, TypeScript, and TailwindCSS.

## Overview

The recommendation template framework provides a flexible way to render recommendation content across different UI contexts while maintaining consistency and adaptability. It supports multiple template variants, user experience levels, display contexts, and customization options.

## Features

- **Multiple Template Variants**: Summary, Detailed, Compact, Export, Timeline, and Contextual
- **Context-Aware**: Automatically adapts templates based on display context (mobile, dashboard, modal, etc.)
- **User Experience Levels**: Customizes complexity and information density for beginner, intermediate, and advanced users
- **Accessibility**: Built-in accessibility features with proper ARIA labels and semantic markup
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Responsive Design**: Mobile-first approach with responsive layouts
- **Export Support**: Special templates for print and document export
- **Customizable**: Flexible configuration system with theme support

## Architecture

### Core Components

```
lib/recommendation-templates/
├── types.ts           # TypeScript type definitions
├── components.tsx     # React template components
├── resolver.ts        # Template resolution and rendering logic
├── utils.ts          # Utility functions and helpers
├── demo.tsx          # Demo components and examples
├── index.ts          # Main entry point
└── README.md         # This documentation
```

### Key Interfaces

```typescript
interface TemplateConfig {
  variant: TemplateVariant;
  context: DisplayContext;
  userLevel?: UserExperienceLevel;
  showMetrics?: boolean;
  showTimeline?: boolean;
  showPrerequisites?: boolean;
  maxActionSteps?: number;
  enableInteractions?: boolean;
  customIcons?: Record<RecommendationType, string>;
  theme?: 'light' | 'dark' | 'auto';
}

interface TemplateData {
  recommendation: PrioritizedRecommendation;
  metadata: {
    displayIndex?: number;
    estimatedReadTime?: number;
    userProgress?: UserProgress;
    // ... other metadata
  };
  context: {
    sessionId: string;
    overallAssessment?: OverallAssessment;
    userProfile?: UserProfile;
    // ... other context
  };
}
```

## Template Variants

### 1. Summary Template
- **Use Case**: Lists, cards, overview displays
- **Characteristics**: Compact, essential information only
- **Best For**: Dashboard overviews, recommendation lists

### 2. Detailed Template
- **Use Case**: Focus views, modals, detailed exploration
- **Characteristics**: Full information, metrics, action steps
- **Best For**: Individual recommendation examination

### 3. Compact Template
- **Use Case**: Mobile, constrained spaces, embedded views
- **Characteristics**: Minimal footprint, essential elements only
- **Best For**: Mobile displays, sidebar widgets

### 4. Export Template
- **Use Case**: Print, PDF, document export
- **Characteristics**: Print-friendly, no interactions, full content
- **Best For**: Sharing, reporting, documentation

### 5. Timeline Template
- **Use Case**: Scheduling, workflow integration
- **Characteristics**: Timeline indicators, scheduling context
- **Best For**: Task management, implementation planning

### 6. Contextual Template
- **Use Case**: Dynamic selection based on context
- **Characteristics**: Adapts automatically to situation
- **Best For**: Flexible, context-aware displays

## Display Contexts

- **Dashboard**: Main overview interface
- **Results**: Results page display
- **Modal**: Modal/popup windows
- **Mobile**: Mobile-optimized display
- **Print**: Print-friendly format
- **Email**: Email sharing format
- **Embedded**: Embedded in other components

## User Experience Levels

### Beginner
- Simplified interface with reduced cognitive load
- Limited action steps (max 3)
- Essential information only
- No complex metrics or timelines

### Intermediate (Default)
- Balanced information density
- Standard feature set
- Moderate detail level
- Most configuration options available

### Advanced
- Full feature set with maximum detail
- All action steps displayed
- Complete metrics and analytics
- Advanced configuration options

## Usage Examples

### Basic Usage

```typescript
import { renderRecommendationTemplate, createDefaultConfig } from '@/lib/recommendation-templates';

const config = createDefaultConfig('detailed', 'modal', 'intermediate');
const result = renderRecommendationTemplate(recommendation, config, {
  sessionId: 'user_session_123',
  userProfile: { experienceLevel: 'intermediate' }
});

return <div>{result.content}</div>;
```

### Smart Template Selection

```typescript
import { selectOptimalTemplate, renderRecommendationTemplate } from '@/lib/recommendation-templates';

// Automatically select the best template for the context
const config = selectOptimalTemplate(recommendation, 'mobile', 'beginner');
const result = renderRecommendationTemplate(recommendation, config, context);
```

### Batch Rendering

```typescript
import { renderRecommendationList, createDefaultConfig } from '@/lib/recommendation-templates';

const config = createDefaultConfig('summary', 'dashboard');
const results = renderRecommendationList(recommendations, config, {
  sessionId: 'session_id',
  totalRecommendations: recommendations.length
});

return (
  <div className="space-y-4">
    {results.map((result, index) => (
      <div key={index}>{result.content}</div>
    ))}
  </div>
);
```

### Custom Configuration

```typescript
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
```

## Integration Examples

### Results Page Integration

```typescript
export function ResultsPageIntegration({ recommendations }: { recommendations: PrioritizedRecommendation[] }) {
  const context = {
    sessionId: 'current_session',
    totalRecommendations: recommendations.length,
    userProfile: { experienceLevel: 'intermediate' as const }
  };

  // Group recommendations by priority
  const critical = recommendations.filter(r => r.priority === 'critical');
  const high = recommendations.filter(r => r.priority === 'high');
  const medium = recommendations.filter(r => r.priority === 'medium');

  return (
    <div className="space-y-8">
      {/* Critical Issues - Always detailed */}
      {critical.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-red-600 mb-4">
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

      {/* High Priority - Summary format */}
      {/* ... other priority sections */}
    </div>
  );
}
```

### Mobile-Responsive Dashboard

```typescript
function MobileDashboard({ recommendations }: { recommendations: PrioritizedRecommendation[] }) {
  const isMobile = useIsMobile(); // Custom hook
  const config = createDefaultConfig(
    isMobile ? 'compact' : 'summary',
    isMobile ? 'mobile' : 'dashboard'
  );

  const results = renderRecommendationList(recommendations, config, context);

  return (
    <div className={isMobile ? 'space-y-2' : 'grid gap-4 md:grid-cols-2'}>
      {results.map((result, index) => (
        <div key={index}>{result.content}</div>
      ))}
    </div>
  );
}
```

## Customization

### Custom Icons

```typescript
const customIcons: Record<RecommendationType, string> = {
  'critical_issue': '🚨',
  'high_impact_improvement': '⚡',
  'strength_to_leverage': '💪',
  'quick_win': '🎯',
  'comparative_insight': '📊',
  'advanced_optimization': '🔧'
};

const config = createDefaultConfig('detailed', 'modal');
config.customIcons = customIcons;
```

### Theme Customization

```typescript
const customTheme: TemplateTheme = {
  name: 'custom',
  colors: {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
    success: '#10b981',
    warning: '#f59e0b',
    info: '#3b82f6'
  },
  // ... other theme properties
};
```

## Best Practices

### Performance
- Use batch rendering for multiple recommendations
- Leverage React.memo for template components when needed
- Consider virtualization for large lists

### Accessibility
- Templates include built-in ARIA labels and roles
- Proper heading hierarchy is maintained
- Interactive elements have keyboard navigation support

### Responsive Design
- Use context-aware template selection
- Consider mobile-first approach
- Test across different screen sizes

### User Experience
- Match template complexity to user experience level
- Provide progressive disclosure for detailed information
- Use consistent iconography and color coding

## API Reference

### Functions

#### `renderRecommendationTemplate`
Renders a single recommendation with the specified configuration.

```typescript
function renderRecommendationTemplate(
  recommendation: PrioritizedRecommendation,
  config: TemplateConfig,
  context: RenderContext
): TemplateRenderResult
```

#### `renderRecommendationList`
Renders multiple recommendations with batch optimization.

```typescript
function renderRecommendationList(
  recommendations: PrioritizedRecommendation[],
  config: TemplateConfig,
  context: RenderContext
): TemplateRenderResult[]
```

#### `selectOptimalTemplate`
Automatically selects the best template configuration for the given context.

```typescript
function selectOptimalTemplate(
  recommendation: PrioritizedRecommendation,
  context: DisplayContext,
  userLevel?: UserExperienceLevel
): TemplateConfig
```

#### `createDefaultConfig`
Creates a default template configuration with context-specific adjustments.

```typescript
function createDefaultConfig(
  variant: TemplateVariant,
  context: DisplayContext,
  userLevel?: UserExperienceLevel
): TemplateConfig
```

### Components

- `SummaryTemplate`: Brief overview for lists and cards
- `DetailedTemplate`: Full details for focus views
- `CompactTemplate`: Minimal display for constrained spaces
- `ExportTemplate`: Print/document friendly format
- `TimelineTemplate`: Timeline integration for scheduling

## Testing

The framework includes comprehensive demo components for testing:

- `TemplateVariantsDemo`: Shows all template variants
- `ContextBasedDemo`: Demonstrates context-based selection
- `UserLevelDemo`: Shows user experience level adaptations
- `BatchRenderingDemo`: Tests batch rendering functionality

## Future Enhancements

- [ ] Animation and transition support
- [ ] Advanced theming system
- [ ] Template caching for performance
- [ ] A/B testing support
- [ ] Analytics integration
- [ ] Custom template variants
- [ ] Internationalization support

## Dependencies

- React 18+
- TypeScript 4.9+
- TailwindCSS 3.0+
- @/components/ui (Card, Badge components)
- @/lib/utils (cn utility function)

## Contributing

When contributing to the template framework:

1. Maintain TypeScript type safety
2. Follow existing naming conventions
3. Add comprehensive documentation
4. Include demo examples for new features
5. Test across different contexts and user levels
6. Ensure accessibility compliance 