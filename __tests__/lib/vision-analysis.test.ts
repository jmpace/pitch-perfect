import { 
  VisionAnalysisService,
  AnalysisType,
  FrameAnalysisRequest,
  FrameAnalysisResult
} from '@/lib/vision-analysis';

// Mock dependencies
jest.mock('@/lib/openai-config', () => ({
  openai: {
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  },
  OPENAI_CONFIG: {
    MODELS: {
      VISION: 'gpt-4o'
    },
    DEFAULTS: {
      TIMEOUT: 30000,
      MAX_TOKENS: 1000,
      TEMPERATURE: 0.1
    }
  }
}));

jest.mock('@/lib/openai-rate-limiter', () => ({
  withRateLimit: jest.fn(),
  rateLimiter: {
    executeWithRateLimit: jest.fn(),
    estimateTokens: jest.fn().mockReturnValue(100)
  }
}));

jest.mock('@/lib/openai-cost-tracker', () => ({
  costTracker: {
    trackVisionAnalysis: jest.fn()
  }
}));

jest.mock('@/lib/errors/handlers', () => ({
  generateRequestId: jest.fn(() => 'test-request-id'),
  logError: jest.fn(),
  normalizeError: jest.fn()
}));

import { openai } from '@/lib/openai-config';
import { withRateLimit } from '@/lib/openai-rate-limiter';
import { costTracker } from '@/lib/openai-cost-tracker';

describe('Vision Analysis Service', () => {
  const mockImageUrl = 'https://example.com/test-image.jpg';
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'sk-test-key-12345';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('analyzeFrame', () => {
    it('should successfully analyze frame with slide_content type', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              slideContent: {
                title: 'Project Overview',
                bulletPoints: ['Goal 1', 'Goal 2', 'Goal 3'],
                keyMessages: ['Clear structure', 'Good visual hierarchy'],
                textReadability: 'high',
                informationDensity: 'medium'
              }
            })
          }
        }],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 200,
          total_tokens: 350
        }
      };

      (withRateLimit as jest.Mock).mockImplementation(async (endpoint, operation) => {
        return await operation();
      });

      const mockCreate = jest.fn().mockResolvedValue(mockResponse);
      (openai.chat.completions.create as jest.Mock) = mockCreate;

      const request: FrameAnalysisRequest = {
        frameUrl: mockImageUrl,
        timestamp: 1000,
        analysisType: 'slide_content',
        context: {
          presentationTitle: 'Business presentation analysis'
        }
      };

      const result = await VisionAnalysisService.analyzeFrame(request);

      expect(result.success).toBe(true);
      expect(result.frameUrl).toBe(mockImageUrl);
      expect(result.timestamp).toBe(1000);
      expect(result.analysisType).toBe('slide_content');
      expect(result.error).toBeUndefined();

      // Verify dependencies were called correctly
      expect(withRateLimit).toHaveBeenCalled();
      expect(costTracker.trackVisionAnalysis).toHaveBeenCalled();
    });

    it('should successfully analyze frame with presentation_flow type', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              presentationFlow: {
                slideType: 'content',
                narrativeFlow: 'logical',
                connectionToPrevious: 'strong',
                transitionQuality: 'smooth'
              }
            })
          }
        }],
        usage: {
          prompt_tokens: 140,
          completion_tokens: 180,
          total_tokens: 320
        }
      };

      (withRateLimit as jest.Mock).mockImplementation(async (endpoint, operation) => {
        return await operation();
      });

      (openai.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const request: FrameAnalysisRequest = {
        frameUrl: mockImageUrl,
        timestamp: 2000,
        analysisType: 'presentation_flow',
        context: {
          presentationTitle: 'Slide sequence analysis'
        }
      };

      const result = await VisionAnalysisService.analyzeFrame(request);

      expect(result.success).toBe(true);
      expect(result.analysisType).toBe('presentation_flow');
      expect(result.timestamp).toBe(2000);
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('OpenAI API Error: Rate limit exceeded');
      (withRateLimit as jest.Mock).mockRejectedValue(apiError);

      const request: FrameAnalysisRequest = {
        frameUrl: mockImageUrl,
        timestamp: 1000,
        analysisType: 'slide_content'
      };

      const result = await VisionAnalysisService.analyzeFrame(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
      expect(result.analysis).toBeUndefined();

      // Verify error tracking
      expect(costTracker.trackVisionAnalysis).toHaveBeenCalledWith(
        expect.any(String), // model
        expect.any(Number), // inputTokens
        0, // outputTokens
        expect.any(Number), // processingTime
        false, // success
        1, // imageCount
        expect.stringContaining('Rate limit exceeded'), // error
        expect.any(String) // requestId
      );
    });

    it('should handle malformed JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      };

      (withRateLimit as jest.Mock).mockImplementation(async (endpoint, operation) => {
        return await operation();
      });

      (openai.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const request: FrameAnalysisRequest = {
        frameUrl: mockImageUrl,
        timestamp: 1000,
        analysisType: 'slide_content'
      };

      const result = await VisionAnalysisService.analyzeFrame(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('analysis failed');
    });

    it('should validate image URL', async () => {
      // Mock URL validation to fail
      jest.spyOn(VisionAnalysisService, 'validateImageUrl' as any).mockRejectedValue(new Error('Invalid URL'));

      const request: FrameAnalysisRequest = {
        frameUrl: 'invalid-url',
        timestamp: 1000,
        analysisType: 'slide_content'
      };

      const result = await VisionAnalysisService.analyzeFrame(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should handle empty response from OpenAI', async () => {
      const mockResponse = {
        choices: [],
        usage: { prompt_tokens: 100, completion_tokens: 0, total_tokens: 100 }
      };

      (withRateLimit as jest.Mock).mockImplementation(async (endpoint, operation) => {
        return await operation();
      });

      (openai.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const request: FrameAnalysisRequest = {
        frameUrl: mockImageUrl,
        timestamp: 1000,
        analysisType: 'slide_content'
      };

      const result = await VisionAnalysisService.analyzeFrame(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No response');
    });
  });

  describe('analyzeBatch', () => {
    it('should successfully analyze multiple frames', async () => {
      const mockFrames = [
        { frameUrl: 'https://example.com/slide1.jpg', timestamp: 1000, analysisType: 'slide_content' as AnalysisType },
        { frameUrl: 'https://example.com/slide2.jpg', timestamp: 2000, analysisType: 'slide_content' as AnalysisType }
      ];

      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              slideContent: {
                title: 'Analysis Result',
                bulletPoints: ['Point 1', 'Point 2'],
                keyMessages: ['Message 1'],
                textReadability: 'high',
                informationDensity: 'medium'
              }
            })
          }
        }],
        usage: { prompt_tokens: 200, completion_tokens: 300, total_tokens: 500 }
      };

      (withRateLimit as jest.Mock).mockImplementation(async (endpoint, operation) => {
        return await operation();
      });

      (openai.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const request = {
        frames: mockFrames,
        analysisType: 'slide_content' as AnalysisType,
        context: {
          presentationTitle: 'Full presentation analysis'
        }
      };

      const result = await VisionAnalysisService.analyzeBatch(request);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results?.[0].success).toBe(true);
      expect(result.results?.[1].success).toBe(true);
    });

    it('should handle batch size limits', async () => {
      const tooManyFrames = Array.from({ length: 15 }, (_, i) => ({
        frameUrl: `https://example.com/slide${i}.jpg`,
        timestamp: i * 1000,
        analysisType: 'slide_content' as AnalysisType
      }));

      const request = {
        frames: tooManyFrames,
        analysisType: 'slide_content' as AnalysisType
      };

      const result = await VisionAnalysisService.analyzeBatch(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('batch size');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      (withRateLimit as jest.Mock).mockRejectedValue(timeoutError);

      const request: FrameAnalysisRequest = {
        frameUrl: mockImageUrl,
        timestamp: 1000,
        analysisType: 'slide_content'
      };

      const result = await VisionAnalysisService.analyzeFrame(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle various analysis types', async () => {
      const analysisTypes: AnalysisType[] = ['slide_content', 'presentation_flow', 'visual_quality', 'engagement_cues', 'comprehensive'];

      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({ test: 'result' })
          }
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      };

      (withRateLimit as jest.Mock).mockImplementation(async (endpoint, operation) => {
        return await operation();
      });

      (openai.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      for (const analysisType of analysisTypes) {
        const request: FrameAnalysisRequest = {
          frameUrl: mockImageUrl,
          timestamp: 1000,
          analysisType
        };

        const result = await VisionAnalysisService.analyzeFrame(request);

        expect(result.analysisType).toBe(analysisType);
      }
    });
  });
}); 