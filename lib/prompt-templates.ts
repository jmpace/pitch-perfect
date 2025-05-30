/**
 * Comprehensive Prompt Templates for GPT-4 Analysis
 * 
 * These templates guide GPT-4 to provide consistent, structured evaluations
 * of pitch content based on our detailed 15-point framework with research-backed metrics.
 */

import { FRAMEWORK_POINTS, FrameworkPoint } from './scoring-framework';

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  systemPrompt: string;
  userPrompt: string;
  expectedOutputFormat: string;
  category: 'speech' | 'content' | 'visual' | 'overall' | 'comprehensive';
  frameworkPoints: string[]; // IDs of framework points this template addresses
}

export interface AnalysisInput {
  transcript?: string;
  slideImages?: string[]; // URLs or base64 encoded images
  audioDuration?: number;
  videoMetadata?: {
    duration: number;
    frameCount: number;
    resolution: string;
  };
}

export interface GPTAnalysisRequest {
  templateId: string;
  input: AnalysisInput;
  customInstructions?: string;
}

// Core system prompt that establishes context for all analyses
const CORE_SYSTEM_PROMPT = `You are an expert pitch evaluation AI with deep knowledge of startup presentations, investor psychology, and communication best practices. You have been trained on research from:

- University of Michigan studies on optimal presentation pace
- Speech Communication Journal standards for clarity and projection
- Toastmasters International professional speaking guidelines  
- Voice Foundation research on vocal confidence indicators
- Venture capital firm evaluation criteria
- Presentation Design Institute and WCAG 2.1 accessibility standards
- Tufte's principles and Cleveland's hierarchy for data visualization
- Narrative psychology and persuasion research
- Executive presence and leadership assessment studies

Your role is to provide precise, actionable feedback based on measurable criteria. Always reference specific metrics when possible and provide concrete improvement suggestions.

IMPORTANT: Base your evaluations on the specific research-backed metrics provided in the framework. Each criterion has detailed thresholds for excellent (8-10), satisfactory (5-7), and needs improvement (1-4) performance levels.`;

// Speech Mechanics Analysis Template
export const SPEECH_ANALYSIS_TEMPLATE: PromptTemplate = {
  id: 'speech_mechanics_analysis',
  title: 'Speech Mechanics Evaluation',
  description: 'Analyzes pace, volume, clarity, filler words, and vocal confidence',
  category: 'speech',
  frameworkPoints: [
    'speech_pace_rhythm',
    'speech_volume_projection', 
    'speech_clarity_articulation',
    'speech_filler_words',
    'speech_vocal_confidence'
  ],
  systemPrompt: `${CORE_SYSTEM_PROMPT}

You are analyzing speech mechanics using these specific criteria:

1. PACE AND RHYTHM (160-180 WPM optimal, strategic pauses 0.5-1.0s)
   - Excellent: 160-180 WPM, strategic pauses, natural rhythm variation ≤10%
   - Satisfactory: 140-200 WPM, decent pauses, rhythm variation ≤15%
   - Needs Improvement: <140 or >200 WPM, poor pauses, rhythm variation >15%

2. VOLUME AND PROJECTION (15-20dB above ambient optimal)
   - Excellent: 15-20dB above ambient, <5% variation, no strain
   - Satisfactory: 10-15dB above ambient, 5-10% variation, minimal strain
   - Needs Improvement: <10dB above ambient, >10% variation, strain present

3. CLARITY AND ARTICULATION (>95% word recognition)
   - Excellent: >98% word recognition, <2% unclear words
   - Satisfactory: 95-98% word recognition, 2-5% unclear words
   - Needs Improvement: <95% word recognition, >5% unclear words

4. FILLER WORDS AND PAUSES (<5/minute optimal)
   - Excellent: <5 filler words/minute, strategic pauses
   - Satisfactory: 5-10 filler words/minute, decent pauses
   - Needs Improvement: >10 filler words/minute, poor pauses

5. VOCAL CONFIDENCE (>70% assertive statements)
   - Excellent: <3% vocal tremor, >80% assertive statements, <5% upspeak
   - Satisfactory: 3-5% vocal tremor, 70-80% assertive statements, 5-10% upspeak
   - Needs Improvement: >5% vocal tremor, <70% assertive statements, >10% upspeak`,

  userPrompt: `Analyze the following pitch transcript for speech mechanics:

TRANSCRIPT:
{transcript}

AUDIO DURATION: {duration} seconds

Please evaluate each of the 5 speech mechanics criteria and provide:

1. **Pace and Rhythm Analysis**
   - Estimated words per minute (show calculation: word count ÷ duration × 60)
   - Pause frequency and strategic placement assessment
   - Rhythm variation and naturalness

2. **Volume and Projection Analysis**
   - Volume consistency assessment
   - Energy level evaluation
   - Projection strength indicators

3. **Clarity and Articulation Analysis**
   - Word recognition accuracy estimate
   - Unclear words identification
   - Articulation quality assessment

4. **Filler Words and Pauses Analysis**
   - Count and rate of filler words (um, uh, like, you know, etc.)
   - Strategic vs. non-strategic pause ratio
   - Overall fluency assessment

5. **Vocal Confidence Analysis**
   - Vocal tremor indicators
   - Assertiveness vs. uncertainty patterns
   - Upspeak frequency assessment

For each criterion, provide:
- Score (1-10)
- Specific evidence from the transcript
- 2-3 concrete improvement suggestions
- Confidence level (0-1) in your assessment`,

  expectedOutputFormat: `{
    "speech_pace_rhythm": {
      "score": 8,
      "evidence": "Calculated 172 WPM (1,547 words ÷ 540 seconds × 60). Strategic pauses before key points at 'Our solution...' and 'The market opportunity...'",
      "suggestions": ["Slow down slightly during technical explanations", "Add more strategic pauses after statistics"],
      "confidence": 0.85,
      "metrics": {
        "wpm": 172,
        "pauseFrequency": 2.5,
        "rhythmVariation": 0.08
      }
    },
    // ... similar structure for other 4 criteria
  }`
};

// Content Quality Analysis Template
export const CONTENT_ANALYSIS_TEMPLATE: PromptTemplate = {
  id: 'content_quality_analysis',
  title: 'Content Quality Evaluation',
  description: 'Analyzes problem definition, solution explanation, market size, traction, and financials',
  category: 'content',
  frameworkPoints: [
    'content_problem_definition',
    'content_solution_explanation',
    'content_market_size', 
    'content_traction_demonstration',
    'content_financial_projections'
  ],
  systemPrompt: `${CORE_SYSTEM_PROMPT}

You are analyzing content quality using these specific criteria:

1. PROBLEM DEFINITION CLARITY (3+ specific metrics, >80% relatability)
   - Excellent: 3+ metrics, clear audience, >90% relatability, 2+ urgency data points
   - Satisfactory: 2-3 metrics, general audience, 80-90% relatability, 1-2 urgency points
   - Needs Improvement: <2 metrics, unclear audience, <80% relatability, <1 urgency point

2. SOLUTION EXPLANATION (100% problem alignment, 3+ benefits)
   - Excellent: 100% alignment, 4+ specific benefits, clear demonstration, technical clarity >90%
   - Satisfactory: 80-100% alignment, 3-4 benefits, decent demonstration, technical clarity 70-90%
   - Needs Improvement: <80% alignment, <3 benefits, unclear demonstration, technical clarity <70%

3. MARKET SIZE VALIDATION (Complete TAM/SAM/SOM, <12mo data)
   - Excellent: Complete breakdown, <6mo data, top-tier sources, 3+ growth indicators
   - Satisfactory: Partial breakdown, 6-12mo data, reputable sources, 2-3 growth indicators
   - Needs Improvement: Incomplete breakdown, >12mo data, poor sources, <2 growth indicators

4. TRACTION DEMONSTRATION (3+ metrics, >10% MoM growth)
   - Excellent: 4+ metrics, 3+ testimonials, >15% MoM growth, 100% milestone completion
   - Satisfactory: 3-4 metrics, 2 testimonials, 10-15% MoM growth, 80-100% milestones
   - Needs Improvement: <3 metrics, <2 testimonials, <10% MoM growth, <80% milestones

5. FINANCIAL PROJECTIONS (<24mo to profitability)
   - Excellent: Industry benchmarks, clear assumptions, <18mo profitability, strong unit economics
   - Satisfactory: General benchmarks, decent assumptions, 18-24mo profitability, positive economics
   - Needs Improvement: No benchmarks, unclear assumptions, >24mo profitability, poor economics`,

  userPrompt: `Analyze the following pitch transcript for content quality:

TRANSCRIPT:
{transcript}

Please evaluate each of the 5 content criteria and provide:

1. **Problem Definition Analysis**
   - Specific metrics mentioned
   - Target audience clarity
   - Relatability assessment
   - Urgency indicators

2. **Solution Explanation Analysis**
   - Problem-solution alignment percentage
   - Specific benefits count
   - Demonstration clarity
   - Technical explanation quality

3. **Market Size Analysis**
   - TAM/SAM/SOM breakdown completeness
   - Data recency assessment
   - Source quality evaluation
   - Growth indicators identification

4. **Traction Analysis**
   - Key metrics count and quality
   - Customer validation evidence
   - Growth rate indicators
   - Milestone achievement status

5. **Financial Projections Analysis**
   - Industry benchmark alignment
   - Assumption clarity
   - Path to profitability timeline
   - Unit economics viability

For each criterion, provide:
- Score (1-10)
- Specific evidence from the transcript
- 2-3 concrete improvement suggestions
- Confidence level (0-1) in your assessment`,

  expectedOutputFormat: `{
    "content_problem_definition": {
      "score": 7,
      "evidence": "Mentions 3 specific metrics: '$2B wasted annually', '47% inefficiency rate', '6 hours daily impact'. Target audience clearly defined as 'mid-market manufacturing companies'. High relatability for stated audience.",
      "suggestions": ["Add more urgency indicators with recent data", "Include customer pain point quotes"],
      "confidence": 0.9,
      "metrics": {
        "metricCount": 3,
        "audienceDefinitionScore": 0.85,
        "relatabilityScore": 0.88,
        "urgencyDataPoints": 1
      }
    },
    // ... similar structure for other 4 criteria
  }`
};

// Visual Presentation Analysis Template
export const VISUAL_ANALYSIS_TEMPLATE: PromptTemplate = {
  id: 'visual_presentation_analysis',
  title: 'Visual Presentation Evaluation',
  description: 'Analyzes slide design, data visualization, and timing/flow',
  category: 'visual',
  frameworkPoints: [
    'visual_slide_design',
    'visual_data_visualization',
    'visual_timing_flow'
  ],
  systemPrompt: `${CORE_SYSTEM_PROMPT}

You are analyzing visual presentation using these specific criteria:

1. SLIDE DESIGN EFFECTIVENESS (≥24pt fonts, ≥4.5:1 contrast, ≤40 words/slide)
   - Excellent: ≥28pt fonts, ≥7:1 contrast, ≤30 words/slide, 4+ hierarchy levels, ≥40% white space
   - Satisfactory: 24-28pt fonts, 4.5-7:1 contrast, 30-40 words/slide, 3-4 hierarchy levels, 30-40% white space
   - Needs Improvement: <24pt fonts, <4.5:1 contrast, >40 words/slide, <3 hierarchy levels, <30% white space

2. DATA VISUALIZATION QUALITY (≥0.8 data-ink ratio)
   - Excellent: ≥0.9 data-ink ratio, perfect chart types, purposeful color, complete labels, high visibility
   - Satisfactory: 0.8-0.9 data-ink ratio, appropriate chart types, mostly purposeful color, good labels
   - Needs Improvement: <0.8 data-ink ratio, inappropriate chart types, decorative color, poor labels

3. TIMING AND FLOW (1-2 min/slide, <0.5s transitions)
   - Excellent: 60-90s/slide, <0.3s transitions, high sequence logic, strong progression, high coherence
   - Satisfactory: 90-120s/slide, 0.3-0.5s transitions, good sequence logic, decent progression
   - Needs Improvement: <60s or >120s/slide, >0.5s transitions, poor sequence logic, weak progression`,

  userPrompt: `Analyze the following slide images and transcript for visual presentation quality:

SLIDE IMAGES:
{slideImages}

TRANSCRIPT TIMING CUES:
{transcript}

VIDEO METADATA:
- Duration: {duration} seconds
- Frame Count: {frameCount}
- Resolution: {resolution}

Please evaluate each of the 3 visual criteria:

1. **Slide Design Analysis**
   - Font size estimation and readability
   - Color contrast assessment
   - Word count per slide
   - Visual hierarchy evaluation
   - White space utilization

2. **Data Visualization Analysis** 
   - Data-ink ratio assessment
   - Chart type appropriateness
   - Color usage purpose
   - Label completeness and clarity
   - Data point visibility

3. **Timing and Flow Analysis**
   - Time per slide calculation
   - Transition smoothness assessment
   - Logical sequence evaluation
   - Content progression quality
   - Narrative coherence

For each criterion, provide:
- Score (1-10)
- Specific evidence from slide analysis
- 2-3 concrete improvement suggestions
- Confidence level (0-1) in your assessment`,

  expectedOutputFormat: `{
    "visual_slide_design": {
      "score": 6,
      "evidence": "Font sizes appear to be 20-24pt (slightly below optimal). Good color contrast observed. Slide 3 has 45 words (above 40-word threshold). Clear 3-level hierarchy present.",
      "suggestions": ["Increase font sizes to minimum 24pt", "Reduce word count on content-heavy slides", "Add more white space for breathing room"],
      "confidence": 0.8,
      "metrics": {
        "minFontSize": 22,
        "contrastRatio": 6.2,
        "avgWordsPerSlide": 38,
        "hierarchyLevels": 3,
        "whiteSpaceRatio": 0.32
      }
    },
    // ... similar structure for other 2 criteria
  }`
};

// Overall Effectiveness Analysis Template
export const OVERALL_ANALYSIS_TEMPLATE: PromptTemplate = {
  id: 'overall_effectiveness_analysis',
  title: 'Overall Effectiveness Evaluation',
  description: 'Analyzes persuasion/storytelling and confidence/credibility',
  category: 'overall',
  frameworkPoints: [
    'overall_persuasion_storytelling',
    'overall_confidence_credibility'
  ],
  systemPrompt: `${CORE_SYSTEM_PROMPT}

You are analyzing overall effectiveness using these specific criteria:

1. PERSUASION AND STORYTELLING (3-act structure, emotional peaks, clear CTA)
   - Excellent: Complete 3-act structure, 3+ emotional peaks, clear CTA, high engagement, high narrative impact
   - Satisfactory: General 3-act structure, 2-3 emotional peaks, decent CTA, good engagement
   - Needs Improvement: Unclear structure, <2 emotional peaks, weak/missing CTA, low engagement

2. CONFIDENCE AND CREDIBILITY (60-70% eye contact, leadership indicators)
   - Excellent: 65-70% eye contact, strong body language, steady voice, clear leadership, high executive presence
   - Satisfactory: 60-65% eye contact, good body language, generally steady voice, some leadership indicators
   - Needs Improvement: <60% eye contact, poor body language, unsteady voice, few leadership indicators`,

  userPrompt: `Analyze the following pitch transcript and visual cues for overall effectiveness:

TRANSCRIPT:
{transcript}

SLIDE IMAGES (for visual cues):
{slideImages}

Please evaluate each of the 2 overall effectiveness criteria:

1. **Persuasion and Storytelling Analysis**
   - Story structure identification (beginning, middle, end)
   - Emotional peak identification and timing
   - Call-to-action clarity and strength
   - Audience engagement indicators
   - Narrative impact assessment

2. **Confidence and Credibility Analysis**
   - Eye contact estimation (if visible in video)
   - Body language assessment
   - Vocal steadiness evaluation
   - Leadership indicators identification
   - Executive presence demonstration

For each criterion, provide:
- Score (1-10)
- Specific evidence from content analysis
- 2-3 concrete improvement suggestions
- Confidence level (0-1) in your assessment`,

  expectedOutputFormat: `{
    "overall_persuasion_storytelling": {
      "score": 8,
      "evidence": "Clear 3-act structure: problem setup (0-2min), solution presentation (2-6min), call-to-action (6-8min). Emotional peaks at market pain point, customer success story, and growth projection. Strong CTA: 'Join us in revolutionizing...'",
      "suggestions": ["Add more customer testimonial details", "Strengthen emotional connection in opening", "Make CTA more specific with next steps"],
      "confidence": 0.85,
      "metrics": {
        "structureCompleteness": 0.9,
        "emotionalPeakTiming": 0.85,
        "ctaClarity": 0.8,
        "engagementScore": 0.85,
        "narrativeImpact": 0.88
      }
    },
    // ... similar structure for confidence_credibility
  }`
};

// Comprehensive Analysis Template (combines all categories)
export const COMPREHENSIVE_ANALYSIS_TEMPLATE: PromptTemplate = {
  id: 'comprehensive_pitch_analysis',
  title: 'Comprehensive Pitch Evaluation',
  description: 'Complete evaluation of all 15 framework points with prioritized recommendations',
  category: 'comprehensive',
  frameworkPoints: FRAMEWORK_POINTS.map(point => point.id),
  systemPrompt: `${CORE_SYSTEM_PROMPT}

You are conducting a comprehensive evaluation of all 15 framework points across 4 categories:
- Speech Mechanics (30% weight): 5 points
- Content Quality (40% weight): 5 points  
- Visual Presentation (20% weight): 3 points
- Overall Effectiveness (10% weight): 2 points

Use the detailed criteria provided for each framework point. Provide scores, evidence, and improvement suggestions for all 15 points, then synthesize into a comprehensive assessment with prioritized recommendations.`,

  userPrompt: `Conduct a comprehensive analysis of this pitch:

TRANSCRIPT:
{transcript}

SLIDE IMAGES:
{slideImages}

AUDIO DURATION: {duration} seconds

VIDEO METADATA:
- Frame Count: {frameCount}
- Resolution: {resolution}

Provide a complete evaluation covering all 15 framework points organized by category. For each point, include score, evidence, and suggestions. Then provide:

1. **Overall Assessment Summary**
   - Weighted overall score
   - Category strengths and weaknesses
   - Key improvement areas

2. **Prioritized Recommendations**
   - Top 5 highest-impact improvements
   - Quick wins (easy to implement)
   - Long-term development areas

3. **Benchmarking**
   - Comparison to typical early-stage pitches
   - Investor readiness assessment
   - Specific areas above/below industry benchmarks`,

  expectedOutputFormat: `{
    "categoryScores": {
      "speech": 7.2,
      "content": 6.8,
      "visual": 5.9,
      "overall": 7.5
    },
    "overallScore": 6.9,
    "individualScores": [
      // All 15 framework point evaluations
    ],
    "summary": {
      "strengths": ["Strong vocal confidence", "Clear problem definition"],
      "weaknesses": ["Slide design needs improvement", "Limited traction data"],
      "readinessLevel": "Pre-seed ready with improvements needed for Series A"
    },
    "prioritizedRecommendations": [
      {
        "priority": 1,
        "category": "visual",
        "description": "Redesign slides with larger fonts and better contrast",
        "impact": "high",
        "effort": "medium",
        "timeline": "1-2 weeks"
      }
      // ... more recommendations
    ]
  }`
};

// Template registry for easy access
export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  speech_analysis: SPEECH_ANALYSIS_TEMPLATE,
  content_analysis: CONTENT_ANALYSIS_TEMPLATE,
  visual_analysis: VISUAL_ANALYSIS_TEMPLATE,
  overall_analysis: OVERALL_ANALYSIS_TEMPLATE,
  comprehensive_analysis: COMPREHENSIVE_ANALYSIS_TEMPLATE
};

// Utility functions for template management
export function getTemplateById(id: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES[id];
}

export function getTemplatesByCategory(category: string): PromptTemplate[] {
  return Object.values(PROMPT_TEMPLATES).filter(template => template.category === category);
}

export function buildPrompt(templateId: string, input: AnalysisInput, customInstructions?: string): { system: string; user: string } | null {
  const template = getTemplateById(templateId);
  if (!template) return null;

  const systemPrompt = template.systemPrompt + (customInstructions ? `\n\nADDITIONAL INSTRUCTIONS:\n${customInstructions}` : '');
  
  let userPrompt = template.userPrompt
    .replace('{transcript}', input.transcript || '[No transcript provided]')
    .replace('{duration}', (input.audioDuration || 0).toString())
    .replace('{slideImages}', input.slideImages?.join('\n') || '[No slide images provided]')
    .replace('{frameCount}', input.videoMetadata?.frameCount?.toString() || 'Unknown')
    .replace('{resolution}', input.videoMetadata?.resolution || 'Unknown');

  return {
    system: systemPrompt,
    user: userPrompt
  };
}

export function validateTemplateOutput(templateId: string, output: any): boolean {
  // Basic validation - could be expanded with JSON schema validation
  if (!output || typeof output !== 'object') return false;
  
  const template = getTemplateById(templateId);
  if (!template) return false;

  // Check if output contains expected framework point evaluations
  const requiredPoints = template.frameworkPoints;
  return requiredPoints.every(pointId => 
    output[pointId] && 
    typeof output[pointId].score === 'number' &&
    typeof output[pointId].evidence === 'string' &&
    Array.isArray(output[pointId].suggestions)
  );
} 