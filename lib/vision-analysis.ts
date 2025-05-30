import { openai, OPENAI_CONFIG } from './openai-config';
import { generateRequestId, logError, normalizeError } from './errors/handlers';
import { VideoProcessingError } from './errors/types';
import { withRateLimit, rateLimiter } from './openai-rate-limiter';
import { costTracker } from './openai-cost-tracker';

// Analysis types for different use cases
export type AnalysisType = 
  | 'slide_content'      // Extract text and content from slides
  | 'presentation_flow'  // Analyze presentation structure and flow
  | 'visual_quality'     // Assess visual design and quality
  | 'engagement_cues'    // Identify elements that affect audience engagement
  | 'comprehensive';     // All-in-one analysis

// Input interfaces
export interface FrameAnalysisRequest {
  frameUrl: string;
  timestamp: number;
  analysisType: AnalysisType;
  context?: {
    previousFrames?: string[];
    presentationTitle?: string;
    targetAudience?: string;
    analysisGoals?: string[];
  };
}

export interface BatchAnalysisRequest {
  frames: FrameAnalysisRequest[];
  analysisType: AnalysisType;
  batchSize?: number;
  context?: {
    presentationTitle?: string;
    targetAudience?: string;
    analysisGoals?: string[];
  };
}

// Output interfaces
export interface SlideContentAnalysis {
  title?: string;
  bulletPoints: string[];
  keyMessages: string[];
  textReadability: 'high' | 'medium' | 'low';
  informationDensity: 'high' | 'medium' | 'low';
  visualElements: {
    charts: boolean;
    images: boolean;
    diagrams: boolean;
    logos: boolean;
  };
}

export interface PresentationFlowAnalysis {
  slideType: 'title' | 'agenda' | 'content' | 'transition' | 'conclusion' | 'unknown';
  narrativeFlow: 'logical' | 'unclear' | 'disjointed';
  connectionToPrevious: 'strong' | 'weak' | 'none';
  transitionQuality: 'smooth' | 'abrupt' | 'missing';
}

export interface VisualQualityAnalysis {
  designConsistency: 'high' | 'medium' | 'low';
  colorScheme: 'professional' | 'engaging' | 'distracting' | 'poor';
  typography: 'clear' | 'readable' | 'difficult';
  layout: 'balanced' | 'cluttered' | 'sparse';
  overallProfessionalism: number; // 1-10 scale
}

export interface EngagementCuesAnalysis {
  visualHierarchy: 'clear' | 'unclear' | 'confusing';
  callToAction: boolean;
  interactiveElements: boolean;
  emotionalAppeal: 'high' | 'medium' | 'low';
  memorabilityFactors: string[];
}

export interface FrameAnalysisResult {
  frameUrl: string;
  timestamp: number;
  analysisType: AnalysisType;
  confidence: number; // 0-1 scale
  analysis: {
    slideContent?: SlideContentAnalysis;
    presentationFlow?: PresentationFlowAnalysis;
    visualQuality?: VisualQualityAnalysis;
    engagementCues?: EngagementCuesAnalysis;
  };
  rawResponse?: string;
  processingTime: number;
  requestId: string;
}

export interface BatchAnalysisResult {
  totalFrames: number;
  processedFrames: number;
  failedFrames: number;
  results: FrameAnalysisResult[];
  summary?: {
    overallQuality: number;
    keyInsights: string[];
    recommendations: string[];
  };
  processingTime: number;
  requestId: string;
}

// Analysis prompts for different types
const ANALYSIS_PROMPTS = {
  slide_content: `Analyze this presentation slide and extract:
1. Main title or heading
2. All bullet points and key text
3. Overall message and purpose
4. Text readability assessment
5. Information density (how much content is packed in)
6. Visual elements present (charts, images, diagrams, logos)

Respond in JSON format matching the SlideContentAnalysis interface.`,

  presentation_flow: `Analyze this slide's role in the presentation flow:
1. What type of slide is this? (title, agenda, content, transition, conclusion)
2. How well does it connect to what likely came before?
3. Is the narrative flow logical and clear?
4. Quality of transitions (smooth, abrupt, missing)

Respond in JSON format matching the PresentationFlowAnalysis interface.`,

  visual_quality: `Assess the visual design quality of this slide:
1. Design consistency and professional appearance
2. Color scheme effectiveness and appropriateness
3. Typography clarity and readability
4. Layout balance and organization
5. Overall professionalism score (1-10)

Respond in JSON format matching the VisualQualityAnalysis interface.`,

  engagement_cues: `Analyze engagement factors in this slide:
1. Visual hierarchy and information organization
2. Presence of call-to-action elements
3. Interactive or engaging elements
4. Emotional appeal and impact
5. Memorable factors that would stick with audience

Respond in JSON format matching the EngagementCuesAnalysis interface.`,

  comprehensive: `Provide a comprehensive analysis of this presentation slide covering:
1. Content extraction (title, bullet points, key messages)
2. Presentation flow and narrative structure
3. Visual design quality and professionalism
4. Audience engagement factors

Respond in JSON format with all analysis types included.`
};

export class VisionAnalysisService {
  private static readonly MAX_BATCH_SIZE = 10; // GPT-4V limit
  private static readonly MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB limit
  private static readonly DEFAULT_MODEL = OPENAI_CONFIG.MODELS.VISION;

  /**
   * Analyze a single frame using GPT-4V
   */
  static async analyzeFrame(request: FrameAnalysisRequest): Promise<FrameAnalysisResult> {
    const requestId = generateRequestId();
    const startTime = Date.now();
    let estimatedTokens = 0;

    try {
      // Validate image URL accessibility
      await this.validateImageUrl(request.frameUrl);

      // Build the prompt based on analysis type
      const prompt = this.buildPrompt(request.analysisType, request.context);

      // Estimate tokens for rate limiting
      estimatedTokens = rateLimiter.estimateTokens('vision', prompt.length, OPENAI_CONFIG.DEFAULTS.MAX_TOKENS);

      // Make GPT-4V API call with rate limiting
      const response = await withRateLimit(
        'vision',
        () => openai.chat.completions.create({
          model: this.DEFAULT_MODEL,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: request.frameUrl,
                    detail: 'high' // For detailed analysis
                  }
                }
              ]
            }
          ],
          max_tokens: OPENAI_CONFIG.DEFAULTS.MAX_TOKENS,
          temperature: OPENAI_CONFIG.DEFAULTS.TEMPERATURE,
        }),
        estimatedTokens,
        'medium' // Priority level
      );

      const rawResponse = response.choices[0]?.message?.content || '';
      const processingTime = Date.now() - startTime;

      // Calculate token usage for cost tracking
      const outputTokens = rateLimiter.estimateTokens('vision', rawResponse.length, 0);

      // Track cost for this vision analysis call
      await costTracker.trackVisionAnalysis(
        this.DEFAULT_MODEL,
        estimatedTokens,
        outputTokens,
        processingTime,
        true, // success
        1, // imageCount
        'vision_analysis',
        requestId,
        undefined,
        {
          metadata: {
            analysisType: request.analysisType,
            frameUrl: request.frameUrl,
            timestamp: request.timestamp
          }
        }
      );

      // Parse the structured response
      const analysis = this.parseAnalysisResponse(rawResponse, request.analysisType);
      
      // Calculate confidence based on response quality
      const confidence = this.calculateConfidence(rawResponse, analysis);

      return {
        frameUrl: request.frameUrl,
        timestamp: request.timestamp,
        analysisType: request.analysisType,
        confidence,
        analysis,
        rawResponse,
        processingTime,
        requestId
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const normalizedError = normalizeError(error, requestId);
      logError(normalizedError);

      // Track cost for failed vision analysis call
      const errorType = error instanceof Error ? error.name : 'unknown_error';
      await costTracker.trackVisionAnalysis(
        this.DEFAULT_MODEL,
        estimatedTokens,
        0, // no output tokens for failed call
        processingTime,
        false, // failed
        1, // imageCount
        'vision_analysis',
        requestId,
        errorType,
        {
          metadata: {
            analysisType: request.analysisType,
            frameUrl: request.frameUrl,
            timestamp: request.timestamp,
            errorMessage: error instanceof Error ? error.message : String(error)
          }
        }
      );
      
      throw new VideoProcessingError(
        `Vision analysis failed for frame at ${request.timestamp}s`,
        { 
          originalError: error instanceof Error ? error.message : String(error),
          frameUrl: request.frameUrl,
          analysisType: request.analysisType
        },
        requestId
      );
    }
  }

  /**
   * Analyze multiple frames in batches
   */
  static async analyzeBatch(request: BatchAnalysisRequest): Promise<BatchAnalysisResult> {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const batchSize = Math.min(request.batchSize || 5, this.MAX_BATCH_SIZE);
    
    const results: FrameAnalysisResult[] = [];
    let processedFrames = 0;
    let failedFrames = 0;

    try {
      // Process frames in batches
      for (let i = 0; i < request.frames.length; i += batchSize) {
        const batch = request.frames.slice(i, i + batchSize);
        
        // Process batch with rate limiting (no manual delays needed)
        const batchPromises = batch.map(frame => 
          this.analyzeFrame({
            ...frame,
            analysisType: request.analysisType,
            context: { ...frame.context, ...request.context }
          }).catch(error => {
            failedFrames++;
            console.warn(`Failed to analyze frame at ${frame.timestamp}s:`, error);
            return null;
          })
        );

        const batchResults = await Promise.all(batchPromises);
        
        // Add successful results
        batchResults.forEach(result => {
          if (result) {
            results.push(result);
            processedFrames++;
          }
        });

        // Rate limiter handles delays automatically, no manual delay needed
      }

      const processingTime = Date.now() - startTime;

      // Generate summary if we have results
      const summary = results.length > 0 ? this.generateBatchSummary(results) : undefined;

      return {
        totalFrames: request.frames.length,
        processedFrames,
        failedFrames,
        results,
        summary,
        processingTime,
        requestId
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const normalizedError = normalizeError(error, requestId);
      logError(normalizedError);
      
      throw new VideoProcessingError(
        'Batch vision analysis failed',
        { 
          originalError: error instanceof Error ? error.message : String(error),
          totalFrames: request.frames.length,
          processedFrames,
          failedFrames
        },
        requestId
      );
    }
  }

  /**
   * Validate image URL accessibility and size
   */
  private static async validateImageUrl(url: string): Promise<void> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      
      if (!response.ok) {
        throw new Error(`Image not accessible: ${response.status} ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > this.MAX_IMAGE_SIZE) {
        throw new Error(`Image too large: ${contentLength} bytes (max: ${this.MAX_IMAGE_SIZE})`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType} (expected image/*)`);
      }

    } catch (error) {
      throw new Error(`Image validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Build analysis prompt based on type and context
   */
  private static buildPrompt(analysisType: AnalysisType, context?: {
    presentationTitle?: string;
    targetAudience?: string;
    analysisGoals?: string[];
  }): string {
    let basePrompt = ANALYSIS_PROMPTS[analysisType];

    if (context) {
      if (context.presentationTitle) {
        basePrompt += `\n\nPresentation context: "${context.presentationTitle}"`;
      }
      if (context.targetAudience) {
        basePrompt += `\nTarget audience: ${context.targetAudience}`;
      }
      if (context.analysisGoals && context.analysisGoals.length > 0) {
        basePrompt += `\nSpecific analysis goals: ${context.analysisGoals.join(', ')}`;
      }
    }

    basePrompt += `\n\nIMPORTANT: Respond ONLY with valid JSON matching the specified interface. Do not include any additional text or explanations outside the JSON.`;

    return basePrompt;
  }

  /**
   * Parse GPT-4V response into structured analysis
   */
  private static parseAnalysisResponse(rawResponse: string, analysisType: AnalysisType): Record<string, unknown> {
    try {
      // Extract JSON from response (handle cases where there might be extra text)
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : rawResponse;
      
      const parsed = JSON.parse(jsonString);
      
      // Validate the structure based on analysis type
      this.validateAnalysisStructure(parsed, analysisType);
      
      return { [this.getAnalysisPropertyName(analysisType)]: parsed };
      
    } catch (error) {
      console.warn('Failed to parse vision analysis response:', error);
      console.warn('Raw response:', rawResponse);
      
      // Return a fallback structure
      return this.getFallbackAnalysis(analysisType);
    }
  }

  /**
   * Calculate confidence score based on response quality
   */
  private static calculateConfidence(rawResponse: string, analysis: Record<string, unknown>): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence if response contains structured data
    if (rawResponse.includes('{') && rawResponse.includes('}')) {
      confidence += 0.2;
    }

    // Increase confidence based on completeness of analysis
    const analysisValues = Object.values(analysis).flat();
    const nonEmptyValues = analysisValues.filter(val => 
      val !== null && val !== undefined && val !== ''
    );
    confidence += (nonEmptyValues.length / analysisValues.length) * 0.3;

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate summary for batch analysis results
   */
  private static generateBatchSummary(results: FrameAnalysisResult[]): {
    overallQuality: number;
    keyInsights: string[];
    recommendations: string[];
  } {
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    
    // Extract key insights across all frames
    const keyInsights: string[] = [];
    const recommendations: string[] = [];

    // Analyze visual quality trends
    const visualQualityResults = results
      .map(r => r.analysis.visualQuality)
      .filter(Boolean);

    if (visualQualityResults.length > 0) {
      const avgProfessionalism = visualQualityResults
        .reduce((sum, vq) => sum + (vq?.overallProfessionalism || 5), 0) / visualQualityResults.length;
      
      keyInsights.push(`Average visual professionalism score: ${avgProfessionalism.toFixed(1)}/10`);
      
      if (avgProfessionalism < 6) {
        recommendations.push('Consider improving visual design consistency and professionalism');
      }
    }

    // Analyze content patterns
    const contentResults = results
      .map(r => r.analysis.slideContent)
      .filter(Boolean);

    if (contentResults.length > 0) {
      const lowReadability = contentResults.filter(c => c?.textReadability === 'low').length;
      const highDensity = contentResults.filter(c => c?.informationDensity === 'high').length;
      
      if (lowReadability > contentResults.length * 0.3) {
        recommendations.push('Improve text readability across slides');
      }
      if (highDensity > contentResults.length * 0.4) {
        recommendations.push('Reduce information density on slides for better comprehension');
      }
    }

    return {
      overallQuality: avgConfidence * 10,
      keyInsights,
      recommendations
    };
  }

  /**
   * Helper methods for analysis structure validation
   */
  private static validateAnalysisStructure(parsed: unknown, _analysisType: AnalysisType): void {
    // Basic validation - ensure we have an object
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Invalid analysis structure: not an object');
    }
    
    // Type-specific validation could be added here
    // For now, we'll be permissive to handle variations in GPT responses
  }

  private static getAnalysisPropertyName(analysisType: AnalysisType): string {
    const mapping = {
      slide_content: 'slideContent',
      presentation_flow: 'presentationFlow',
      visual_quality: 'visualQuality',
      engagement_cues: 'engagementCues',
      comprehensive: 'comprehensive'
    };
    return mapping[analysisType] || 'analysis';
  }

  private static getFallbackAnalysis(analysisType: AnalysisType): Record<string, unknown> {
    const fallbacks = {
      slide_content: {
        slideContent: {
          bulletPoints: [],
          keyMessages: [],
          textReadability: 'medium' as const,
          informationDensity: 'medium' as const,
          visualElements: {
            charts: false,
            images: false,
            diagrams: false,
            logos: false
          }
        }
      },
      presentation_flow: {
        presentationFlow: {
          slideType: 'unknown' as const,
          narrativeFlow: 'unclear' as const,
          connectionToPrevious: 'none' as const,
          transitionQuality: 'missing' as const
        }
      },
      visual_quality: {
        visualQuality: {
          designConsistency: 'medium' as const,
          colorScheme: 'professional' as const,
          typography: 'readable' as const,
          layout: 'balanced' as const,
          overallProfessionalism: 5
        }
      },
      engagement_cues: {
        engagementCues: {
          visualHierarchy: 'unclear' as const,
          callToAction: false,
          interactiveElements: false,
          emotionalAppeal: 'medium' as const,
          memorabilityFactors: []
        }
      },
      comprehensive: {
        slideContent: {},
        presentationFlow: {},
        visualQuality: {},
        engagementCues: {}
      }
    };

    return fallbacks[analysisType] || {};
  }
}

export default VisionAnalysisService; 