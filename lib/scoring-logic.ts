/**
 * Scoring Logic for 15-Point Framework
 * 
 * This module implements specific scoring algorithms and rules for evaluating
 * each framework point based on transcript analysis, visual analysis, and
 * multimodal data processing.
 */

import { FrameworkScore, FrameworkPoint, FRAMEWORK_POINTS } from './scoring-framework';

// Input data interfaces for scoring
export interface TranscriptAnalysis {
  fullTranscript: string;
  wordCount: number;
  duration: number; // in seconds
  wordsPerMinute: number;
  fillerWordCount: number;
  fillerWordRate: number; // per minute
  pauseData: {
    totalPauses: number;
    averagePauseLength: number;
    strategicPauses: number;
  };
  volumeConsistency: number; // 0-1 score
  clarityScore: number; // 0-1 score from audio analysis
  confidenceIndicators: {
    vocalTremor: boolean;
    upspeak: number; // frequency of uptalk
    assertiveStatements: number;
  };
}

export interface VisualAnalysis {
  slideCount: number;
  averageTimePerSlide: number;
  designQualityScore: number; // 0-1 from GPT-4V
  dataVisualizationScore: number; // 0-1 from GPT-4V
  timingAlignmentScore: number; // 0-1 correlation between speech and slides
  readabilityScore: number; // 0-1 from visual analysis
  professionalismScore: number; // 0-1 from visual analysis
}

export interface ContentAnalysis {
  problemClarity: number; // 0-1 from GPT-4 analysis
  solutionClarity: number; // 0-1 from GPT-4 analysis
  marketSizeCredibility: number; // 0-1 from GPT-4 analysis
  tractionEvidence: number; // 0-1 from GPT-4 analysis
  financialRealism: number; // 0-1 from GPT-4 analysis
  persuasionElements: number; // 0-1 from GPT-4 analysis
  storyStructure: number; // 0-1 from GPT-4 analysis
  credibilityFactors: number; // 0-1 from GPT-4 analysis
}

export interface MultimodalAnalysisInput {
  transcript: TranscriptAnalysis;
  visual: VisualAnalysis;
  content: ContentAnalysis;
  sessionId: string;
}

// Scoring algorithm implementations for each framework point
export class FrameworkScorer {
  
  /**
   * Score: Speech Pace and Rhythm (speech_pace_rhythm)
   * Target: 160-180 WPM with strategic pauses
   */
  static scorePaceRhythm(input: MultimodalAnalysisInput): FrameworkScore {
    const { wordsPerMinute, pauseData } = input.transcript;
    
    let score = 5; // Start at middle
    let rationale = '';
    const suggestions: string[] = [];
    
    // Evaluate WPM (40% of score)
    if (wordsPerMinute >= 160 && wordsPerMinute <= 180) {
      score += 2.4; // Excellent pace
      rationale += `Excellent pace at ${wordsPerMinute} WPM (optimal range 160-180). `;
    } else if (wordsPerMinute >= 140 && wordsPerMinute <= 200) {
      score += 1.2; // Good pace with minor issues
      rationale += `Good pace at ${wordsPerMinute} WPM with room for optimization. `;
      if (wordsPerMinute < 160) {
        suggestions.push('Consider increasing speaking pace slightly to 160-180 WPM');
      } else {
        suggestions.push('Consider slowing down slightly to 160-180 WPM for better comprehension');
      }
    } else {
      score -= 1.2; // Poor pace
      rationale += `Pace needs improvement at ${wordsPerMinute} WPM (target: 160-180 WPM). `;
      if (wordsPerMinute < 140) {
        suggestions.push('Increase speaking pace significantly - currently too slow for investor presentations');
      } else {
        suggestions.push('Slow down significantly - currently too fast for audience comprehension');
      }
    }
    
    // Evaluate strategic pauses (30% of score)
    const pauseQuality = pauseData.strategicPauses / Math.max(pauseData.totalPauses, 1);
    if (pauseQuality > 0.7) {
      score += 1.8;
      rationale += `Excellent use of strategic pauses (${pauseData.strategicPauses} strategic of ${pauseData.totalPauses} total). `;
    } else if (pauseQuality > 0.4) {
      score += 0.9;
      rationale += `Good pause usage with opportunities for improvement. `;
      suggestions.push('Add more strategic pauses for emphasis at key points');
    } else {
      score -= 0.9;
      rationale += `Poor strategic pause usage. `;
      suggestions.push('Practice using pauses strategically for emphasis and audience comprehension');
    }
    
    // Evaluate rhythm consistency (30% of score)
    const rhythmScore = 1 - (pauseData.averagePauseLength / 3); // Normalize to 0-1
    if (rhythmScore > 0.8) {
      score += 1.8;
      rationale += 'Natural, engaging rhythm maintained throughout.';
    } else if (rhythmScore > 0.5) {
      score += 0.9;
      rationale += 'Generally good rhythm with minor inconsistencies.';
      suggestions.push('Work on maintaining consistent rhythm throughout the presentation');
    } else {
      score -= 0.9;
      rationale += 'Rhythm issues that may lose audience attention.';
      suggestions.push('Practice varying pace and rhythm to maintain audience engagement');
    }
    
    return {
      pointId: 'speech_pace_rhythm',
      score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)),
      rationale: rationale.trim(),
      improvementSuggestions: suggestions,
      confidence: 0.85 // High confidence for quantitative speech metrics
    };
  }
  
  /**
   * Score: Volume and Projection (speech_volume_projection)
   */
  static scoreVolumeProjection(input: MultimodalAnalysisInput): FrameworkScore {
    const { volumeConsistency } = input.transcript;
    
    let score = 5 + (volumeConsistency * 5); // 0-1 scale to 5-10 range
    const rationale = `Volume consistency score: ${(volumeConsistency * 100).toFixed(0)}%. `;
    const suggestions: string[] = [];
    
    if (volumeConsistency < 0.6) {
      suggestions.push('Practice maintaining consistent volume throughout presentation');
      suggestions.push('Consider using microphone technique training');
    } else if (volumeConsistency < 0.8) {
      suggestions.push('Minor adjustments needed for consistent projection');
    }
    
    return {
      pointId: 'speech_volume_projection',
      score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)),
      rationale: rationale + (volumeConsistency > 0.8 ? 'Excellent volume control.' : 
                            volumeConsistency > 0.6 ? 'Good volume with minor inconsistencies.' : 
                            'Needs significant improvement in volume consistency.'),
      improvementSuggestions: suggestions,
      confidence: 0.75 // Moderate confidence for audio-derived metrics
    };
  }
  
  /**
   * Score: Clarity and Articulation (speech_clarity_articulation)
   */
  static scoreClarityArticulation(input: MultimodalAnalysisInput): FrameworkScore {
    const { clarityScore } = input.transcript;
    
    let score = 1 + (clarityScore * 9); // 0-1 scale to 1-10 range
    const suggestions: string[] = [];
    
    if (clarityScore < 0.6) {
      suggestions.push('Practice enunciation exercises for clearer speech');
      suggestions.push('Consider speech coaching for articulation improvement');
    } else if (clarityScore < 0.8) {
      suggestions.push('Minor pronunciation improvements would enhance clarity');
    }
    
    return {
      pointId: 'speech_clarity_articulation',
      score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)),
      rationale: `Speech clarity score: ${(clarityScore * 100).toFixed(0)}%. ${
        clarityScore > 0.8 ? 'Crystal clear articulation.' :
        clarityScore > 0.6 ? 'Generally clear with occasional unclear words.' :
        'Significant clarity issues affecting comprehension.'
      }`,
      improvementSuggestions: suggestions,
      confidence: 0.8 // Good confidence for AI-derived clarity metrics
    };
  }
  
  /**
   * Score: Filler Words and Pauses (speech_filler_words)
   */
  static scoreFillerWords(input: MultimodalAnalysisInput): FrameworkScore {
    const { fillerWordRate } = input.transcript;
    
    let score = 10;
    let rationale = `Filler word rate: ${fillerWordRate.toFixed(1)} per minute. `;
    const suggestions: string[] = [];
    
    if (fillerWordRate < 5) {
      score = 9 + (5 - fillerWordRate) / 5; // Bonus for excellent performance
      rationale += 'Excellent control of filler words.';
    } else if (fillerWordRate <= 10) {
      score = 7 + (10 - fillerWordRate) / 5 * 2; // 7-9 range
      rationale += 'Good filler word control with room for improvement.';
      suggestions.push('Practice reducing filler words through pause training');
    } else if (fillerWordRate <= 15) {
      score = 4 + (15 - fillerWordRate) / 5 * 3; // 4-7 range
      rationale += 'Moderate filler word usage affecting flow.';
      suggestions.push('Significant practice needed to reduce filler words');
      suggestions.push('Consider recording practice sessions to identify filler word patterns');
    } else {
      score = 1 + Math.min(3, (20 - fillerWordRate) / 5 * 3); // 1-4 range
      rationale += 'Excessive filler words significantly disrupting presentation flow.';
      suggestions.push('Intensive filler word reduction training required');
      suggestions.push('Practice strategic pauses instead of filler words');
    }
    
    return {
      pointId: 'speech_filler_words',
      score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)),
      rationale,
      improvementSuggestions: suggestions,
      confidence: 0.9 // Very high confidence for quantitative filler word counting
    };
  }
  
  /**
   * Score: Vocal Confidence (speech_vocal_confidence)
   */
  static scoreVocalConfidence(input: MultimodalAnalysisInput): FrameworkScore {
    const { confidenceIndicators } = input.transcript;
    
    let score = 5;
    let rationale = '';
    const suggestions: string[] = [];
    
    // Evaluate vocal tremor (-2 points if present)
    if (confidenceIndicators.vocalTremor) {
      score -= 2;
      rationale += 'Vocal tremor detected indicating nervousness. ';
      suggestions.push('Practice breathing exercises and vocal warm-ups before presentations');
    } else {
      score += 1;
      rationale += 'Steady vocal tone maintained. ';
    }
    
    // Evaluate upspeak pattern (-1 to -3 points based on frequency)
    const upspeakPenalty = Math.min(3, confidenceIndicators.upspeak / 5);
    score -= upspeakPenalty;
    if (confidenceIndicators.upspeak > 10) {
      rationale += 'Excessive upspeak undermining authority. ';
      suggestions.push('Practice making definitive statements without rising intonation');
    } else if (confidenceIndicators.upspeak > 5) {
      rationale += 'Some upspeak patterns reducing assertiveness. ';
      suggestions.push('Reduce uptalk at the end of statements for more authority');
    }
    
    // Evaluate assertive statements (+1 to +3 points)
    const assertivenessBonus = Math.min(3, confidenceIndicators.assertiveStatements / 5);
    score += assertivenessBonus;
    if (confidenceIndicators.assertiveStatements > 10) {
      rationale += 'Strong assertive delivery commanding attention.';
    } else if (confidenceIndicators.assertiveStatements > 5) {
      rationale += 'Good assertiveness with room for improvement.';
      suggestions.push('Use more definitive language and assertive statements');
    } else {
      rationale += 'Lacks assertive delivery reducing credibility.';
      suggestions.push('Practice confident, assertive speaking patterns');
    }
    
    return {
      pointId: 'speech_vocal_confidence',
      score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)),
      rationale: rationale.trim(),
      improvementSuggestions: suggestions,
      confidence: 0.7 // Moderate confidence for subjective confidence assessment
    };
  }
  
  /**
   * Score: Problem Definition Clarity (content_problem_definition)
   */
  static scoreProblemDefinition(input: MultimodalAnalysisInput): FrameworkScore {
    const { problemClarity } = input.content;
    
    let score = 1 + (problemClarity * 9);
    const suggestions: string[] = [];
    
    if (problemClarity < 0.6) {
      suggestions.push('Clearly define the specific pain point your solution addresses');
      suggestions.push('Use concrete examples or stories to make the problem relatable');
      suggestions.push('Quantify the problem with specific data or metrics');
    } else if (problemClarity < 0.8) {
      suggestions.push('Add more specific details to strengthen problem definition');
      suggestions.push('Consider including customer quotes or pain point examples');
    }
    
    return {
      pointId: 'content_problem_definition',
      score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)),
      rationale: `Problem clarity score: ${(problemClarity * 100).toFixed(0)}%. ${
        problemClarity > 0.8 ? 'Problem clearly defined with compelling evidence.' :
        problemClarity > 0.6 ? 'Problem generally clear with adequate supporting details.' :
        'Problem definition needs significant clarification and evidence.'
      }`,
      improvementSuggestions: suggestions,
      confidence: 0.85 // High confidence for GPT-4 content analysis
    };
  }
  
  /**
   * Score: Solution Explanation (content_solution_explanation)
   */
  static scoreSolutionExplanation(input: MultimodalAnalysisInput): FrameworkScore {
    const { solutionClarity } = input.content;
    
    let score = 1 + (solutionClarity * 9);
    const suggestions: string[] = [];
    
    if (solutionClarity < 0.6) {
      suggestions.push('Clearly explain how your solution addresses the stated problem');
      suggestions.push('Define your value proposition with specific benefits');
      suggestions.push('Use simple, concrete language to explain your solution');
    } else if (solutionClarity < 0.8) {
      suggestions.push('Strengthen the connection between problem and solution');
      suggestions.push('Add more specific details about unique value proposition');
    }
    
    return {
      pointId: 'content_solution_explanation',
      score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)),
      rationale: `Solution clarity score: ${(solutionClarity * 100).toFixed(0)}%. ${
        solutionClarity > 0.8 ? 'Solution clearly explained with strong value proposition.' :
        solutionClarity > 0.6 ? 'Solution generally clear with logical approach.' :
        'Solution explanation needs significant improvement for clarity.'
      }`,
      improvementSuggestions: suggestions,
      confidence: 0.85
    };
  }
  
  /**
   * Score: Market Size Validation (content_market_size)
   */
  static scoreMarketSize(input: MultimodalAnalysisInput): FrameworkScore {
    const { marketSizeCredibility } = input.content;
    
    let score = 1 + (marketSizeCredibility * 9);
    const suggestions: string[] = [];
    
    if (marketSizeCredibility < 0.6) {
      suggestions.push('Provide credible sources for market size claims');
      suggestions.push('Break down TAM/SAM/SOM with realistic assumptions');
      suggestions.push('Focus on addressable market rather than total market');
    } else if (marketSizeCredibility < 0.8) {
      suggestions.push('Strengthen market sizing with additional credible sources');
      suggestions.push('Clarify your specific addressable market segment');
    }
    
    return {
      pointId: 'content_market_size',
      score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)),
      rationale: `Market size credibility: ${(marketSizeCredibility * 100).toFixed(0)}%. ${
        marketSizeCredibility > 0.8 ? 'Credible market sizing with strong sources.' :
        marketSizeCredibility > 0.6 ? 'Generally credible market sizing with adequate sources.' :
        'Market sizing lacks credibility or supporting evidence.'
      }`,
      improvementSuggestions: suggestions,
      confidence: 0.8
    };
  }
  
  /**
   * Score: Traction Demonstration (content_traction_demonstration)
   */
  static scoreTractionDemonstration(input: MultimodalAnalysisInput): FrameworkScore {
    const { tractionEvidence } = input.content;
    
    let score = 1 + (tractionEvidence * 9);
    const suggestions: string[] = [];
    
    if (tractionEvidence < 0.6) {
      suggestions.push('Include concrete metrics showing progress (users, revenue, partnerships)');
      suggestions.push('Share specific customer validation or testimonials');
      suggestions.push('Demonstrate growth trajectory with before/after data');
    } else if (tractionEvidence < 0.8) {
      suggestions.push('Add more specific metrics to strengthen traction story');
      suggestions.push('Include customer quotes or case studies');
    }
    
    return {
      pointId: 'content_traction_demonstration',
      score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)),
      rationale: `Traction evidence score: ${(tractionEvidence * 100).toFixed(0)}%. ${
        tractionEvidence > 0.8 ? 'Strong concrete evidence of progress and validation.' :
        tractionEvidence > 0.6 ? 'Some evidence of traction with adequate metrics.' :
        'Traction demonstration needs concrete evidence and metrics.'
      }`,
      improvementSuggestions: suggestions,
      confidence: 0.8
    };
  }
  
  /**
   * Score: Financial Projections (content_financial_projections)
   */
  static scoreFinancialProjections(input: MultimodalAnalysisInput): FrameworkScore {
    const { financialRealism } = input.content;
    
    let score = 1 + (financialRealism * 9);
    const suggestions: string[] = [];
    
    if (financialRealism < 0.6) {
      suggestions.push('Provide realistic financial projections with clear assumptions');
      suggestions.push('Show credible path to profitability');
      suggestions.push('Avoid hockey-stick projections without justification');
    } else if (financialRealism < 0.8) {
      suggestions.push('Strengthen assumptions behind financial projections');
      suggestions.push('Clarify revenue model and unit economics');
    }
    
    return {
      pointId: 'content_financial_projections',
      score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)),
      rationale: `Financial realism score: ${(financialRealism * 100).toFixed(0)}%. ${
        financialRealism > 0.8 ? 'Realistic projections with credible assumptions.' :
        financialRealism > 0.6 ? 'Generally realistic projections with minor concerns.' :
        'Financial projections lack realism or clear assumptions.'
      }`,
      improvementSuggestions: suggestions,
      confidence: 0.75
    };
  }
  
  /**
   * Score: Slide Design Effectiveness (visual_slide_design)
   */
  static scoreSlideDesign(input: MultimodalAnalysisInput): FrameworkScore {
    const { designQualityScore, readabilityScore, professionalismScore } = input.visual;
    
    const combinedScore = (designQualityScore + readabilityScore + professionalismScore) / 3;
    let score = 1 + (combinedScore * 9);
    const suggestions: string[] = [];
    
    if (combinedScore < 0.6) {
      suggestions.push('Simplify slide design for better readability');
      suggestions.push('Use consistent fonts and colors throughout');
      suggestions.push('Ensure adequate contrast for readability');
    } else if (combinedScore < 0.8) {
      suggestions.push('Minor design improvements for enhanced professionalism');
      suggestions.push('Consider visual hierarchy improvements');
    }
    
    return {
      pointId: 'visual_slide_design',
      score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)),
      rationale: `Design quality: ${(combinedScore * 100).toFixed(0)}% (design: ${(designQualityScore * 100).toFixed(0)}%, readability: ${(readabilityScore * 100).toFixed(0)}%, professionalism: ${(professionalismScore * 100).toFixed(0)}%). ${
        combinedScore > 0.8 ? 'Professional, well-designed slides with excellent readability.' :
        combinedScore > 0.6 ? 'Generally good design with room for improvement.' :
        'Slide design needs significant improvement for professionalism.'
      }`,
      improvementSuggestions: suggestions,
      confidence: 0.85
    };
  }
  
  /**
   * Score: Data Visualization Quality (visual_data_visualization)
   */
  static scoreDataVisualization(input: MultimodalAnalysisInput): FrameworkScore {
    const { dataVisualizationScore } = input.visual;
    
    let score = 1 + (dataVisualizationScore * 9);
    const suggestions: string[] = [];
    
    if (dataVisualizationScore < 0.6) {
      suggestions.push('Use appropriate chart types for your data');
      suggestions.push('Ensure charts are easy to interpret at a glance');
      suggestions.push('Add clear labels and legends to all visualizations');
    } else if (dataVisualizationScore < 0.8) {
      suggestions.push('Improve chart clarity with better labeling');
      suggestions.push('Consider more effective visualization types');
    }
    
    return {
      pointId: 'visual_data_visualization',
      score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)),
      rationale: `Data visualization quality: ${(dataVisualizationScore * 100).toFixed(0)}%. ${
        dataVisualizationScore > 0.8 ? 'Excellent charts that clearly communicate data.' :
        dataVisualizationScore > 0.6 ? 'Generally clear visualizations with minor issues.' :
        'Data visualizations need significant improvement for clarity.'
      }`,
      improvementSuggestions: suggestions,
      confidence: 0.8
    };
  }
  
  /**
   * Score: Timing and Flow (visual_timing_flow)
   */
  static scoreTimingFlow(input: MultimodalAnalysisInput): FrameworkScore {
    const { timingAlignmentScore, averageTimePerSlide } = input.visual;
    
    // Evaluate slide timing (target: 30-60 seconds per slide)
    let timingScore = 0.5;
    if (averageTimePerSlide >= 30 && averageTimePerSlide <= 60) {
      timingScore = 1.0;
    } else if (averageTimePerSlide >= 20 && averageTimePerSlide <= 90) {
      timingScore = 0.7;
    }
    
    const combinedScore = (timingAlignmentScore + timingScore) / 2;
    let score = 1 + (combinedScore * 9);
    const suggestions: string[] = [];
    
    if (combinedScore < 0.6) {
      suggestions.push('Better align slide content with spoken narrative');
      suggestions.push('Adjust timing to spend appropriate time per slide');
      suggestions.push('Create smoother transitions between slides');
    } else if (combinedScore < 0.8) {
      suggestions.push('Minor timing adjustments for better flow');
      suggestions.push('Improve slide transition smoothness');
    }
    
    return {
      pointId: 'visual_timing_flow',
      score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)),
      rationale: `Timing and flow score: ${(combinedScore * 100).toFixed(0)}% (alignment: ${(timingAlignmentScore * 100).toFixed(0)}%, timing: ${averageTimePerSlide.toFixed(0)}s/slide). ${
        combinedScore > 0.8 ? 'Excellent timing with smooth transitions and good alignment.' :
        combinedScore > 0.6 ? 'Generally good timing with minor flow issues.' :
        'Timing and flow need significant improvement.'
      }`,
      improvementSuggestions: suggestions,
      confidence: 0.75
    };
  }
  
  /**
   * Score: Persuasion and Storytelling (overall_persuasion_storytelling)
   */
  static scorePersuasionStorytelling(input: MultimodalAnalysisInput): FrameworkScore {
    const { persuasionElements, storyStructure } = input.content;
    
    const combinedScore = (persuasionElements + storyStructure) / 2;
    let score = 1 + (combinedScore * 9);
    const suggestions: string[] = [];
    
    if (combinedScore < 0.6) {
      suggestions.push('Develop a clear narrative arc with beginning, middle, and end');
      suggestions.push('Include emotional elements to engage investors');
      suggestions.push('Use storytelling techniques to make your pitch memorable');
    } else if (combinedScore < 0.8) {
      suggestions.push('Strengthen emotional engagement in your narrative');
      suggestions.push('Add more compelling story elements');
    }
    
    return {
      pointId: 'overall_persuasion_storytelling',
      score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)),
      rationale: `Persuasion and storytelling score: ${(combinedScore * 100).toFixed(0)}% (persuasion: ${(persuasionElements * 100).toFixed(0)}%, story: ${(storyStructure * 100).toFixed(0)}%). ${
        combinedScore > 0.8 ? 'Compelling narrative with strong emotional engagement.' :
        combinedScore > 0.6 ? 'Generally compelling story with decent engagement.' :
        'Narrative lacks persuasive elements and emotional engagement.'
      }`,
      improvementSuggestions: suggestions,
      confidence: 0.75
    };
  }
  
  /**
   * Score: Confidence and Credibility (overall_confidence_credibility)
   */
  static scoreConfidenceCredibility(input: MultimodalAnalysisInput): FrameworkScore {
    const { credibilityFactors } = input.content;
    const { confidenceIndicators } = input.transcript;
    
    // Combine content credibility with vocal confidence indicators
    const vocalConfidenceScore = confidenceIndicators.vocalTremor ? 0.3 : 
                                 confidenceIndicators.upspeak > 10 ? 0.5 : 
                                 confidenceIndicators.assertiveStatements > 5 ? 0.9 : 0.7;
    
    const combinedScore = (credibilityFactors + vocalConfidenceScore) / 2;
    let score = 1 + (combinedScore * 9);
    const suggestions: string[] = [];
    
    if (combinedScore < 0.6) {
      suggestions.push('Demonstrate executive presence through confident delivery');
      suggestions.push('Include credentials and experience that build credibility');
      suggestions.push('Use authoritative language and avoid uncertainty');
    } else if (combinedScore < 0.8) {
      suggestions.push('Strengthen leadership demonstration in presentation');
      suggestions.push('Add more credibility-building elements');
    }
    
    return {
      pointId: 'overall_confidence_credibility',
      score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)),
      rationale: `Confidence and credibility score: ${(combinedScore * 100).toFixed(0)}% (content credibility: ${(credibilityFactors * 100).toFixed(0)}%, vocal confidence: ${(vocalConfidenceScore * 100).toFixed(0)}%). ${
        combinedScore > 0.8 ? 'Strong executive presence with high credibility.' :
        combinedScore > 0.6 ? 'Generally confident with adequate credibility.' :
        'Lacks confidence and credibility markers for leadership.'
      }`,
      improvementSuggestions: suggestions,
      confidence: 0.7
    };
  }
  
  /**
   * Main scoring function that evaluates all 15 framework points
   */
  static scoreAllFrameworkPoints(input: MultimodalAnalysisInput): FrameworkScore[] {
    return [
      // Speech Mechanics
      this.scorePaceRhythm(input),
      this.scoreVolumeProjection(input),
      this.scoreClarityArticulation(input),
      this.scoreFillerWords(input),
      this.scoreVocalConfidence(input),
      
      // Content Quality
      this.scoreProblemDefinition(input),
      this.scoreSolutionExplanation(input),
      this.scoreMarketSize(input),
      this.scoreTractionDemonstration(input),
      this.scoreFinancialProjections(input),
      
      // Visual Presentation
      this.scoreSlideDesign(input),
      this.scoreDataVisualization(input),
      this.scoreTimingFlow(input),
      
      // Overall Effectiveness
      this.scorePersuasionStorytelling(input),
      this.scoreConfidenceCredibility(input)
    ];
  }
}

/**
 * Utility functions for scoring logic validation and testing
 */
export function validateScoringLogic(): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check that all framework points have corresponding scoring methods
  const scoringMethods = [
    'scorePaceRhythm', 'scoreVolumeProjection', 'scoreClarityArticulation', 
    'scoreFillerWords', 'scoreVocalConfidence', 'scoreProblemDefinition',
    'scoreSolutionExplanation', 'scoreMarketSize', 'scoreTractionDemonstration',
    'scoreFinancialProjections', 'scoreSlideDesign', 'scoreDataVisualization',
    'scoreTimingFlow', 'scorePersuasionStorytelling', 'scoreConfidenceCredibility'
  ];
  
  if (scoringMethods.length !== FRAMEWORK_POINTS.length) {
    issues.push(`Mismatch: ${scoringMethods.length} scoring methods for ${FRAMEWORK_POINTS.length} framework points`);
  }
  
  // Validate that scoreAllFrameworkPoints returns correct number of scores
  const mockInput: MultimodalAnalysisInput = {
    transcript: {
      fullTranscript: '',
      wordCount: 100,
      duration: 300,
      wordsPerMinute: 170,
      fillerWordCount: 8,
      fillerWordRate: 1.6,
      pauseData: { totalPauses: 10, averagePauseLength: 1.5, strategicPauses: 7 },
      volumeConsistency: 0.8,
      clarityScore: 0.8,
      confidenceIndicators: { vocalTremor: false, upspeak: 3, assertiveStatements: 12 }
    },
    visual: {
      slideCount: 10,
      averageTimePerSlide: 45,
      designQualityScore: 0.8,
      dataVisualizationScore: 0.7,
      timingAlignmentScore: 0.8,
      readabilityScore: 0.9,
      professionalismScore: 0.8
    },
    content: {
      problemClarity: 0.8,
      solutionClarity: 0.9,
      marketSizeCredibility: 0.7,
      tractionEvidence: 0.6,
      financialRealism: 0.7,
      persuasionElements: 0.8,
      storyStructure: 0.7,
      credibilityFactors: 0.8
    },
    sessionId: 'test'
  };
  
  try {
    const scores = FrameworkScorer.scoreAllFrameworkPoints(mockInput);
    if (scores.length !== 15) {
      issues.push(`scoreAllFrameworkPoints returned ${scores.length} scores instead of 15`);
    }
    
    // Validate score ranges
    scores.forEach((score, index) => {
      if (score.score < 1 || score.score > 10) {
        issues.push(`Score ${index} out of range: ${score.score} (should be 1-10)`);
      }
      if (score.confidence < 0 || score.confidence > 1) {
        issues.push(`Confidence ${index} out of range: ${score.confidence} (should be 0-1)`);
      }
    });
  } catch (error) {
    issues.push(`Error in scoreAllFrameworkPoints: ${error}`);
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
} 