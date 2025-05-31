# Export Functionality Integration Guide

This guide shows how to integrate the newly created export functionality into your recommendation results pages.

## Quick Integration

### 1. Import the Export Component

```tsx
import ExportRecommendations from '@/components/export-recommendations';
```

### 2. Basic Usage in Results Page

```tsx
// In your results page component
export default function ResultsPage({ recommendations, context }) {
  return (
    <div className="space-y-6">
      {/* Your existing results content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Recommendations display */}
        </div>
        
        <div className="space-y-4">
          {/* Export functionality - Card variant */}
          <ExportRecommendations
            recommendations={recommendations}
            context={context}
            variant="card"
            className="sticky top-4"
          />
        </div>
      </div>
    </div>
  );
}
```

### 3. Button Variant Integration

```tsx
// Replace existing "Download Report" button
<div className="flex items-center justify-between">
  <h1>Recommendation Results</h1>
  
  {/* Replace placeholder with functional export */}
  <ExportRecommendations
    recommendations={recommendations}
    context={context}
    variant="button"
  />
</div>
```

### 4. Dropdown Variant for Compact Spaces

```tsx
// In mobile or compact layouts
<div className="flex items-center gap-2">
  <span className="text-sm text-gray-500">Export:</span>
  <ExportRecommendations
    recommendations={recommendations}
    context={context}
    variant="dropdown"
  />
</div>
```

## Component API

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `recommendations` | `PrioritizedRecommendation[]` | **required** | Array of recommendations to export |
| `context` | `object` | `undefined` | Additional context (sessionId, overallAssessment) |
| `variant` | `'card' \| 'button' \| 'dropdown'` | `'card'` | Display variant |
| `className` | `string` | `''` | Additional CSS classes |
| `showFormatDetails` | `boolean` | `true` | Show recommendation count badges |

### Context Object

```tsx
interface ExportContext {
  sessionId?: string;
  overallAssessment?: {
    competitivePosition?: string;
    primaryStrengths?: string[];
    primaryWeaknesses?: string[];
  };
}
```

## Usage Examples

### Example 1: Full Results Page Integration

```tsx
'use client';

import { useState, useEffect } from 'react';
import ExportRecommendations from '@/components/export-recommendations';

export default function RecommendationResults({ sessionId }) {
  const [recommendations, setRecommendations] = useState([]);
  const [context, setContext] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load recommendations and context
    loadRecommendations(sessionId).then(data => {
      setRecommendations(data.recommendations);
      setContext({
        sessionId,
        overallAssessment: data.overallAssessment
      });
      setLoading(false);
    });
  }, [sessionId]);

  if (loading) {
    return <div>Loading recommendations...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Your Recommendations</h1>
          <p className="text-gray-600 mt-2">
            {recommendations.length} recommendations based on your pitch analysis
          </p>
        </div>
        
        {/* Quick export button */}
        <ExportRecommendations
          recommendations={recommendations}
          context={context}
          variant="button"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          {/* Recommendation cards */}
          <div className="space-y-6">
            {recommendations.map(rec => (
              <RecommendationCard key={rec.id} recommendation={rec} />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {/* Sidebar with export options */}
          <ExportRecommendations
            recommendations={recommendations}
            context={context}
            variant="card"
            className="sticky top-4"
          />
          
          {/* Other sidebar content */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Need Help?</h3>
            <p className="text-sm text-gray-600">
              Contact our support team for personalized guidance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Example 2: Mobile-First Layout

```tsx
export default function MobileResults({ recommendations, context }) {
  return (
    <div className="max-w-md mx-auto px-4 py-6">
      {/* Header with compact export */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Results</h1>
        <ExportRecommendations
          recommendations={recommendations}
          context={context}
          variant="dropdown"
          showFormatDetails={false}
        />
      </div>

      {/* Recommendations list */}
      <div className="space-y-4">
        {recommendations.map(rec => (
          <MobileRecommendationCard key={rec.id} recommendation={rec} />
        ))}
      </div>

      {/* Bottom export section */}
      <div className="mt-8 pt-6 border-t">
        <ExportRecommendations
          recommendations={recommendations}
          context={context}
          variant="card"
          showFormatDetails={true}
        />
      </div>
    </div>
  );
}
```

## Supported Export Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| **HTML** | Rich web format with embedded styles | Web viewing, printing, sharing via browser |
| **PDF** | Portable document format | Professional reports, presentations |
| **CSV** | Spreadsheet format | Data analysis in Excel/Google Sheets |
| **JSON** | Structured data format | API integration, data processing |
| **Text** | Plain text format | Email sharing, simple documentation |

## Advanced Configuration

### Custom Export Options

```tsx
// Advanced usage with custom configuration
<ExportRecommendations
  recommendations={recommendations}
  context={{
    sessionId: 'session-123',
    overallAssessment: {
      competitivePosition: 'Strong',
      primaryStrengths: ['Clear messaging', 'Strong delivery'],
      primaryWeaknesses: ['Needs better visuals', 'Time management']
    }
  }}
  variant="card"
  className="bg-gray-50 border-2 border-blue-200"
  showFormatDetails={true}
/>
```

### Programmatic Export

```tsx
import { quickExportHandlers } from '@/lib/recommendation-export-client';

// Export programmatically (e.g., on button click)
const handleExportPDF = async () => {
  try {
    const result = await quickExportHandlers.exportAsPDF(recommendations, context);
    if (result.success) {
      console.log('Export successful:', result.metadata);
    } else {
      console.error('Export failed:', result.error);
    }
  } catch (error) {
    console.error('Export error:', error);
  }
};
```

## Error Handling

The export component includes built-in validation and error handling:

- **Empty recommendations**: Shows helpful error message
- **Network failures**: Displays retry options
- **Invalid data**: Validates recommendation structure
- **File size limits**: Warns about large exports

## Styling and Theming

The component supports dark mode and follows the existing design system:

```tsx
/* The component automatically adapts to your theme */
.dark .export-modal {
  background: theme('colors.gray.800');
  color: theme('colors.white');
}
```

## Performance Considerations

- **Lazy loading**: Component only loads export logic when needed
- **Chunked processing**: Large exports are processed in chunks
- **Memory management**: Blob URLs are properly cleaned up
- **Rate limiting**: API includes reasonable request limits

## Testing

Test the export functionality:

```tsx
import { render, fireEvent, waitFor } from '@testing-library/react';
import ExportRecommendations from '@/components/export-recommendations';

test('exports recommendations successfully', async () => {
  const mockRecommendations = [
    {
      id: '1',
      title: 'Test Recommendation',
      description: 'Test description',
      priority: 'high',
      // ... other required fields
    }
  ];

  const { getByText } = render(
    <ExportRecommendations 
      recommendations={mockRecommendations}
      variant="card"
    />
  );

  fireEvent.click(getByText('HTML'));
  
  await waitFor(() => {
    // Assert export was triggered
  });
});
```

This integration guide provides everything needed to add export functionality to your recommendation results pages. 