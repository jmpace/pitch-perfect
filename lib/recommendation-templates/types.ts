/**
 * Recommendation Template Framework Types
 * 
 * Defines the structure and interfaces for dynamically rendering
 * recommendation templates based on content, context, and user preferences.
 */

import { 
  Recommendation, 
  RecommendationSet,
  RecommendationCategory,
  RecommendationType,
  RecommendationPriority 
} from '../recommendation-engine';
import { PrioritizedRecommendation } from '../recommendation-prioritization';

// Template variant types for different display contexts
export type TemplateVariant = 
  | 'summary'      // Brief overview for lists/cards
  | 'detailed'     // Full details for focus views
  | 'compact'      // Minimal display for mobile/constrained spaces
  | 'export'       // Formatted for PDF/document export
  | 'timeline'     // Integrated with timeline/scheduling
  | 'contextual';  // Dynamic based on current context

// Template display contexts
export type DisplayContext = 
  | 'dashboard'    // Main dashboard overview
  | 'results'      // Results page display
  | 'modal'        // Modal/popup display
  | 'print'        // Print-friendly format
  | 'email'        // Email sharing format
  | 'mobile'       // Mobile-optimized display
  | 'embedded';    // Embedded in other components

// User experience levels for template customization
export type UserExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

// Template configuration interface
export interface TemplateConfig {
  variant: TemplateVariant;
  context: DisplayContext;
  userLevel?: UserExperienceLevel;
  showMetrics?: boolean;
  showTimeline?: boolean;
  showProgress?: boolean;
  showPrerequisites?: boolean;
  maxActionSteps?: number;
  enableInteractions?: boolean;
  customIcons?: Record<RecommendationType, string>;
  theme?: 'light' | 'dark' | 'auto';
}

// Template data interface - extends recommendation with display metadata
export interface TemplateData {
  recommendation: PrioritizedRecommendation;
  metadata: {
    displayIndex?: number;
    grouping?: string;
    relatedRecommendations?: string[];
    estimatedReadTime?: number;
    lastUpdated?: Date;
    userProgress?: {
      started?: boolean;
      completed?: boolean;
      completedSteps?: number[];
    };
  };
  context: {
    sessionId: string;
    overallAssessment?: RecommendationSet['overallAssessment'];
    totalRecommendations?: number;
    userProfile?: {
      experienceLevel: UserExperienceLevel;
      focusAreas?: string[];
    };
  };
}

// Template rendering result
export interface TemplateRenderResult {
  content: React.ReactNode;
  metadata: {
    templateId: string;
    variant: TemplateVariant;
    renderTime: number;
    accessibility: {
      ariaLabel: string;
      role: string;
      headingLevel?: number;
    };
    interactions: {
      expandable?: boolean;
      actionable?: boolean;
      schedulable?: boolean;
    };
  };
}

// Template resolver interface
export interface TemplateResolver {
  resolve(data: TemplateData, config: TemplateConfig): TemplateRenderResult;
  getSupportedVariants(): TemplateVariant[];
  getSupportedContexts(): DisplayContext[];
  validateConfig(config: TemplateConfig): boolean;
}

// Template registry for managing different template types
export interface TemplateRegistry {
  register(type: RecommendationType, resolver: TemplateResolver): void;
  unregister(type: RecommendationType): void;
  getResolver(type: RecommendationType): TemplateResolver | null;
  listRegistered(): RecommendationType[];
}

// Template theme configuration
export interface TemplateTheme {
  name: string;
  colors: {
    critical: string;
    high: string;
    medium: string;
    low: string;
    success: string;
    warning: string;
    info: string;
  };
  spacing: {
    compact: string;
    normal: string;
    relaxed: string;
  };
  typography: {
    heading: string;
    body: string;
    caption: string;
  };
  icons: Record<RecommendationType, string>;
}

// Template analytics for tracking usage and effectiveness
export interface TemplateAnalytics {
  templateId: string;
  recommendationType: RecommendationType;
  variant: TemplateVariant;
  context: DisplayContext;
  interactions: {
    viewed: boolean;
    expanded?: boolean;
    actionsTaken?: number;
    timeSpent?: number;
  };
  timestamp: Date;
}

// Export functions and utilities interface
export interface TemplateExporter {
  exportToHTML(templates: TemplateRenderResult[]): Promise<string>;
  exportToPDF(templates: TemplateRenderResult[]): Promise<Buffer>;
  exportToJSON(data: TemplateData[]): string;
  exportToCSV(data: TemplateData[]): string;
}

// Template validation utilities
export interface TemplateValidator {
  validateData(data: TemplateData): boolean;
  validateConfig(config: TemplateConfig): boolean;
  validateTheme(theme: TemplateTheme): boolean;
  getValidationErrors(item: any): string[];
} 