/**
 * Framework Weight Assignment and Validation
 * 
 * This module documents and validates the weighting strategy for the 15-point framework.
 * Weights are assigned based on investor priorities and pitch evaluation best practices.
 */

import { FRAMEWORK_CATEGORIES, FrameworkCategory } from './scoring-framework';

export interface WeightRationale {
  categoryId: string;
  weight: number;
  rationale: string;
  investorPriority: 'critical' | 'high' | 'medium' | 'supporting';
  evidenceSource: string;
  impactOnInvestmentDecision: string;
}

export interface WeightValidation {
  totalWeight: number;
  isValid: boolean;
  issues: string[];
  recommendations: string[];
}

// Weight Assignment Rationale and Justification
export const WEIGHT_RATIONALES: WeightRationale[] = [
  {
    categoryId: 'content',
    weight: 40,
    rationale: 'Content quality is the foundation of any investment decision. Investors primarily evaluate the business fundamentals: problem definition, solution viability, market opportunity, traction evidence, and financial projections. Without strong content, even perfect delivery cannot save a pitch.',
    investorPriority: 'critical',
    evidenceSource: 'First Round Capital: "We primarily invest in the idea and market opportunity. Presentation delivery is secondary to business fundamentals."',
    impactOnInvestmentDecision: 'Directly determines investment viability. Poor content = immediate rejection regardless of delivery quality.'
  },
  {
    categoryId: 'speech',
    weight: 30,
    rationale: 'Speech delivery significantly impacts investor confidence and founder credibility. Pace, clarity, and vocal confidence directly influence investor perception of leadership capability. Studies show that delivery quality affects funding likelihood even when content is identical.',
    investorPriority: 'high',
    evidenceSource: 'Harvard Business Review: "Executive presence and communication skills are key predictors of startup success and fundability."',
    impactOnInvestmentDecision: 'Strongly influences investor confidence. Affects perceived founder competence and leadership potential.'
  },
  {
    categoryId: 'visual',
    weight: 20,
    rationale: 'Visual presentation quality affects comprehension and professionalism perception. Well-designed slides enhance content clarity and demonstrate attention to detail. Poor visuals can distract from strong content, while excellent visuals support the narrative.',
    investorPriority: 'medium',
    evidenceSource: 'Sequoia Capital pitch deck guidelines emphasize clear, simple visual design that supports the narrative without overwhelming.',
    impactOnInvestmentDecision: 'Moderate impact. Enhances or detracts from content comprehension and professional perception.'
  },
  {
    categoryId: 'overall',
    weight: 10,
    rationale: 'Overall effectiveness (persuasion and credibility) represents the holistic impact beyond individual components. This captures intangible elements like charisma and storytelling that can differentiate similar pitches, but cannot overcome fundamental content or delivery issues.',
    investorPriority: 'supporting',
    evidenceSource: 'Y Combinator: "Founders who tell compelling stories and demonstrate strong personal conviction get more attention, but the business fundamentals must be solid."',
    impactOnInvestmentDecision: 'Moderate impact as a tie-breaker between comparable opportunities. Cannot overcome major content or delivery deficits.'
  }
];

// Individual point weights within categories (for future granular weighting)
export const INDIVIDUAL_POINT_WEIGHTS = {
  // Speech Mechanics: Equal weighting for foundational speaking skills
  speech_pace_rhythm: 6.0,          // 6% of total (20% of speech category)
  speech_volume_projection: 6.0,    // 6% of total
  speech_clarity_articulation: 6.0, // 6% of total  
  speech_filler_words: 6.0,         // 6% of total
  speech_vocal_confidence: 6.0,     // 6% of total

  // Content Quality: Problem/solution weighted higher than market/traction/financials
  content_problem_definition: 10.0,    // 10% of total (25% of content category)
  content_solution_explanation: 10.0,  // 10% of total
  content_market_size: 7.0,           // 7% of total (17.5% of content category)
  content_traction_demonstration: 7.0, // 7% of total
  content_financial_projections: 6.0,  // 6% of total (15% of content category)

  // Visual Presentation: Design and timing weighted higher than data viz
  visual_slide_design: 8.0,           // 8% of total (40% of visual category)
  visual_data_visualization: 6.0,     // 6% of total (30% of visual category)
  visual_timing_flow: 6.0,            // 6% of total (30% of visual category)

  // Overall Effectiveness: Equal weighting for persuasion and credibility  
  overall_persuasion_storytelling: 5.0, // 5% of total (50% of overall category)
  overall_confidence_credibility: 5.0   // 5% of total (50% of overall category)
};

/**
 * Validates that all framework weights sum to 100% and are logically consistent
 */
export function validateFrameworkWeights(): WeightValidation {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check category weights sum to 100%
  const totalCategoryWeight = Object.values(FRAMEWORK_CATEGORIES)
    .reduce((sum, category) => sum + category.weight, 0);

  // Check individual point weights sum to 100%
  const totalPointWeight = Object.values(INDIVIDUAL_POINT_WEIGHTS)
    .reduce((sum, weight) => sum + weight, 0);

  const isValid = totalCategoryWeight === 100 && Math.abs(totalPointWeight - 100) < 0.1;

  if (totalCategoryWeight !== 100) {
    issues.push(`Category weights sum to ${totalCategoryWeight}%, not 100%`);
    recommendations.push('Adjust category weights to sum exactly to 100%');
  }

  if (Math.abs(totalPointWeight - 100) >= 0.1) {
    issues.push(`Individual point weights sum to ${totalPointWeight.toFixed(1)}%, not 100%`);
    recommendations.push('Adjust individual point weights to sum exactly to 100%');
  }

  // Validate logical consistency
  if (FRAMEWORK_CATEGORIES.content.weight < FRAMEWORK_CATEGORIES.speech.weight) {
    issues.push('Content weight should be higher than speech weight based on investor priorities');
    recommendations.push('Increase content weight relative to speech weight');
  }

  if (FRAMEWORK_CATEGORIES.visual.weight > FRAMEWORK_CATEGORIES.speech.weight) {
    issues.push('Visual weight should not exceed speech weight based on impact studies');
    recommendations.push('Reduce visual weight relative to speech weight');
  }

  return {
    totalWeight: totalCategoryWeight,
    isValid,
    issues,
    recommendations
  };
}

/**
 * Gets weight rationale for a specific category
 */
export function getWeightRationale(categoryId: string): WeightRationale | undefined {
  return WEIGHT_RATIONALES.find(rationale => rationale.categoryId === categoryId);
}

/**
 * Calculates effective weight for an individual framework point
 */
export function getIndividualPointWeight(pointId: string): number {
  return INDIVIDUAL_POINT_WEIGHTS[pointId as keyof typeof INDIVIDUAL_POINT_WEIGHTS] || 0;
}

/**
 * Validates that individual point weights match their category weights
 */
export function validateCategoryPointConsistency(): { [categoryId: string]: { expected: number; actual: number; isConsistent: boolean } } {
  const results: { [categoryId: string]: { expected: number; actual: number; isConsistent: boolean } } = {};

  Object.values(FRAMEWORK_CATEGORIES).forEach(category => {
    const categoryPointIds = Object.keys(INDIVIDUAL_POINT_WEIGHTS)
      .filter(pointId => pointId.startsWith(category.id));
    
    const actualWeight = categoryPointIds
      .reduce((sum, pointId) => sum + getIndividualPointWeight(pointId), 0);
    
    results[category.id] = {
      expected: category.weight,
      actual: Math.round(actualWeight * 10) / 10, // Round to 1 decimal
      isConsistent: Math.abs(actualWeight - category.weight) < 0.1
    };
  });

  return results;
}

/**
 * Generates a human-readable weight summary
 */
export function generateWeightSummary(): string {
  const validation = validateFrameworkWeights();
  const consistency = validateCategoryPointConsistency();
  
  let summary = "Framework Weight Assignment Summary\n";
  summary += "=====================================\n\n";
  
  summary += "Category Weights:\n";
  Object.values(FRAMEWORK_CATEGORIES).forEach(category => {
    const rationale = getWeightRationale(category.id);
    summary += `• ${category.title}: ${category.weight}% (${rationale?.investorPriority || 'unknown'} priority)\n`;
  });
  
  summary += `\nTotal Weight: ${validation.totalWeight}%\n`;
  summary += `Valid: ${validation.isValid ? 'Yes' : 'No'}\n`;
  
  if (validation.issues.length > 0) {
    summary += "\nIssues:\n";
    validation.issues.forEach(issue => summary += `• ${issue}\n`);
  }
  
  summary += "\nCategory-Point Consistency:\n";
  Object.entries(consistency).forEach(([categoryId, data]) => {
    summary += `• ${categoryId}: ${data.isConsistent ? 'Consistent' : 'Inconsistent'} (${data.actual}% vs ${data.expected}%)\n`;
  });
  
  return summary;
}

// Export validation results for immediate verification
export const WEIGHT_VALIDATION = validateFrameworkWeights();
export const CATEGORY_CONSISTENCY = validateCategoryPointConsistency(); 