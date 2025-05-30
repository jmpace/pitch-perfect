/**
 * Score Normalization Algorithms for 15-Point Framework
 * 
 * This module implements various normalization techniques to ensure consistent
 * and comparable scoring across different pitches. It handles weighted score
 * calculation, scale normalization, and outlier detection.
 */

import { 
  FrameworkScore, 
  ComprehensiveFrameworkScore, 
  FRAMEWORK_CATEGORIES 
} from './scoring-framework';
import { 
  INDIVIDUAL_POINT_WEIGHTS, 
  getIndividualPointWeight,
  validateFrameworkWeights
} from './framework-weights';

// Normalization method types
export type NormalizationMethod = 'min-max' | 'z-score' | 'robust' | 'decimal' | 'weighted';

// Raw score input for normalization
export interface RawScoreInput {
  pointId: string;
  rawScore: number; // 1-10 scale from individual scoring algorithms
  confidence: number; // 0-1 confidence score
  category: string;
}

// Normalized score output
export interface NormalizedScore {
  pointId: string;
  rawScore: number;
  normalizedScore: number; // 0-100 scale
  weightedScore: number; // Score * weight for final calculation
  weight: number; // Point weight (percentage)
  confidence: number;
  category: string;
}

// Comparison metrics for multiple pitches
export interface ScoreComparison {
  sessionId: string;
  normalizedScores: NormalizedScore[];
  categoryScores: {
    speech: number;
    content: number;
    visual: number;
    overall: number;
  };
  overallScore: number; // 0-100 final score
  percentileRank?: number; // Compared to historical data
  zScore?: number; // Standard deviations from mean
}

// Statistical data for normalization
export interface NormalizationStatistics {
  mean: number;
  median: number;
  standardDeviation: number;
  min: number;
  max: number;
  q1: number; // 25th percentile
  q3: number; // 75th percentile
  outlierThreshold: {
    lower: number;
    upper: number;
  };
}

// Historical data for comparative normalization
export interface HistoricalData {
  pointId: string;
  scores: number[];
  statistics: NormalizationStatistics;
  lastUpdated: Date;
}

/**
 * Main Score Normalization Class
 */
export class ScoreNormalizer {
  private historicalData: Map<string, HistoricalData> = new Map();

  constructor(historicalData?: HistoricalData[]) {
    if (historicalData) {
      historicalData.forEach(data => {
        this.historicalData.set(data.pointId, data);
      });
    }
  }

  /**
   * Primary normalization method - converts raw scores to 0-100 scale with weights
   */
  normalizeScores(
    rawScores: RawScoreInput[],
    method: NormalizationMethod = 'weighted',
    sessionId: string
  ): ScoreComparison {
    // Validate weights first
    const weightValidation = validateFrameworkWeights();
    if (!weightValidation.isValid) {
      throw new Error(`Weight validation failed: ${weightValidation.issues.join(', ')}`);
    }

    // Apply normalization to each score
    const normalizedScores: NormalizedScore[] = rawScores.map(rawScore => {
      return this.normalizeIndividualScore(rawScore, method);
    });

    // Calculate category scores
    const categoryScores = this.calculateCategoryScores(normalizedScores);

    // Calculate overall weighted score
    const overallScore = this.calculateOverallScore(normalizedScores);

    // Calculate comparative metrics if historical data available
    const percentileRank = this.calculatePercentileRank(overallScore);
    const zScore = this.calculateZScore(overallScore);

    return {
      sessionId,
      normalizedScores,
      categoryScores,
      overallScore,
      percentileRank,
      zScore
    };
  }

  /**
   * Normalize an individual score based on the specified method
   */
  private normalizeIndividualScore(
    rawScore: RawScoreInput,
    method: NormalizationMethod
  ): NormalizedScore {
    const weight = getIndividualPointWeight(rawScore.pointId);
    let normalizedScore: number;

    switch (method) {
      case 'min-max':
        normalizedScore = this.minMaxNormalization(rawScore.rawScore, 1, 10, 0, 100);
        break;
      
      case 'z-score':
        normalizedScore = this.zScoreNormalization(rawScore.pointId, rawScore.rawScore);
        break;
      
      case 'robust':
        normalizedScore = this.robustNormalization(rawScore.pointId, rawScore.rawScore);
        break;
      
      case 'decimal':
        normalizedScore = this.decimalScaling(rawScore.rawScore, 10);
        break;
      
      case 'weighted':
      default:
        // Default weighted approach: min-max to 0-100, then apply confidence
        normalizedScore = this.minMaxNormalization(rawScore.rawScore, 1, 10, 0, 100);
        normalizedScore = normalizedScore * rawScore.confidence; // Adjust by confidence
        break;
    }

    // Ensure score is within bounds
    normalizedScore = Math.max(0, Math.min(100, normalizedScore));

    return {
      pointId: rawScore.pointId,
      rawScore: rawScore.rawScore,
      normalizedScore,
      weightedScore: (normalizedScore * weight) / 100, // Convert percentage to decimal
      weight,
      confidence: rawScore.confidence,
      category: rawScore.category
    };
  }

  /**
   * Min-Max Normalization: Scale values to a specific range
   * Formula: (value - min) / (max - min) * (newMax - newMin) + newMin
   */
  private minMaxNormalization(
    value: number,
    oldMin: number,
    oldMax: number,
    newMin: number,
    newMax: number
  ): number {
    return ((value - oldMin) / (oldMax - oldMin)) * (newMax - newMin) + newMin;
  }

  /**
   * Z-Score Normalization: Standardize based on mean and standard deviation
   * Formula: (value - mean) / standardDeviation, then scale to 0-100
   */
  private zScoreNormalization(pointId: string, value: number): number {
    const historicalData = this.historicalData.get(pointId);
    if (!historicalData) {
      // Fallback to min-max if no historical data
      return this.minMaxNormalization(value, 1, 10, 0, 100);
    }

    const { mean, standardDeviation } = historicalData.statistics;
    const zScore = (value - mean) / standardDeviation;
    
    // Convert z-score to 0-100 scale (assuming ±3 standard deviations covers most data)
    return Math.max(0, Math.min(100, ((zScore + 3) / 6) * 100));
  }

  /**
   * Robust Normalization: Use median and IQR to handle outliers
   * Formula: (value - median) / IQR, then scale to 0-100
   */
  private robustNormalization(pointId: string, value: number): number {
    const historicalData = this.historicalData.get(pointId);
    if (!historicalData) {
      return this.minMaxNormalization(value, 1, 10, 0, 100);
    }

    const { median, q1, q3 } = historicalData.statistics;
    const iqr = q3 - q1;
    
    if (iqr === 0) {
      return this.minMaxNormalization(value, 1, 10, 0, 100);
    }

    const robustScore = (value - median) / iqr;
    // Scale robust score to 0-100 (assuming ±2 IQR covers most data)
    return Math.max(0, Math.min(100, ((robustScore + 2) / 4) * 100));
  }

  /**
   * Decimal Scaling: Divide by power of 10 to move decimal point
   */
  private decimalScaling(value: number, maxValue: number): number {
    const powerOf10 = Math.pow(10, Math.ceil(Math.log10(maxValue)));
    return (value / powerOf10) * 100;
  }

  /**
   * Calculate category scores by averaging normalized scores within each category
   */
  private calculateCategoryScores(normalizedScores: NormalizedScore[]): {
    speech: number;
    content: number;
    visual: number;
    overall: number;
  } {
    const categoryGroups = {
      speech: normalizedScores.filter(s => s.category === 'speech'),
      content: normalizedScores.filter(s => s.category === 'content'),
      visual: normalizedScores.filter(s => s.category === 'visual'),
      overall: normalizedScores.filter(s => s.category === 'overall')
    };

    return {
      speech: this.calculateWeightedCategoryAverage(categoryGroups.speech),
      content: this.calculateWeightedCategoryAverage(categoryGroups.content),
      visual: this.calculateWeightedCategoryAverage(categoryGroups.visual),
      overall: this.calculateWeightedCategoryAverage(categoryGroups.overall)
    };
  }

  /**
   * Calculate weighted average for scores within a category
   */
  private calculateWeightedCategoryAverage(scores: NormalizedScore[]): number {
    if (scores.length === 0) return 0;

    const totalWeight = scores.reduce((sum, score) => sum + score.weight, 0);
    if (totalWeight === 0) return 0;

    const weightedSum = scores.reduce((sum, score) => 
      sum + (score.normalizedScore * score.weight), 0
    );

    return weightedSum / totalWeight;
  }

  /**
   * Calculate final overall score using individual weighted scores
   */
  private calculateOverallScore(normalizedScores: NormalizedScore[]): number {
    const totalWeightedScore = normalizedScores.reduce((sum, score) => 
      sum + score.weightedScore, 0
    );

    // Convert back to 0-100 scale
    return Math.max(0, Math.min(100, totalWeightedScore));
  }

  /**
   * Calculate percentile rank compared to historical data
   */
  private calculatePercentileRank(overallScore: number): number | undefined {
    const historicalOverallScores = Array.from(this.historicalData.values())
      .flatMap(data => data.scores);

    if (historicalOverallScores.length === 0) return undefined;

    const sortedScores = historicalOverallScores.sort((a, b) => a - b);
    const rank = sortedScores.filter(score => score <= overallScore).length;
    
    return (rank / sortedScores.length) * 100;
  }

  /**
   * Calculate z-score for overall score
   */
  private calculateZScore(overallScore: number): number | undefined {
    const historicalOverallScores = Array.from(this.historicalData.values())
      .flatMap(data => data.scores);

    if (historicalOverallScores.length === 0) return undefined;

    const stats = this.calculateStatistics(historicalOverallScores);
    return (overallScore - stats.mean) / stats.standardDeviation;
  }

  /**
   * Calculate comprehensive statistics for a dataset
   */
  public calculateStatistics(scores: number[]): NormalizationStatistics {
    if (scores.length === 0) {
      throw new Error('Cannot calculate statistics for empty dataset');
    }

    const sortedScores = [...scores].sort((a, b) => a - b);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const median = this.calculateMedian(sortedScores);
    
    const variance = scores.reduce((sum, score) => 
      sum + Math.pow(score - mean, 2), 0
    ) / scores.length;
    const standardDeviation = Math.sqrt(variance);

    const q1 = this.calculatePercentile(sortedScores, 25);
    const q3 = this.calculatePercentile(sortedScores, 75);
    const iqr = q3 - q1;

    // Outlier detection using 1.5 * IQR rule
    const outlierThreshold = {
      lower: q1 - 1.5 * iqr,
      upper: q3 + 1.5 * iqr
    };

    return {
      mean,
      median,
      standardDeviation,
      min: Math.min(...scores),
      max: Math.max(...scores),
      q1,
      q3,
      outlierThreshold
    };
  }

  /**
   * Calculate median of sorted array
   */
  private calculateMedian(sortedScores: number[]): number {
    const mid = Math.floor(sortedScores.length / 2);
    return sortedScores.length % 2 === 0
      ? (sortedScores[mid - 1] + sortedScores[mid]) / 2
      : sortedScores[mid];
  }

  /**
   * Calculate specific percentile
   */
  private calculatePercentile(sortedScores: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedScores.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedScores[lower];
    }
    
    const weight = index - lower;
    return sortedScores[lower] * (1 - weight) + sortedScores[upper] * weight;
  }

  /**
   * Update historical data with new scores
   */
  public updateHistoricalData(pointId: string, newScores: number[]): void {
    const existingData = this.historicalData.get(pointId);
    const allScores = existingData ? [...existingData.scores, ...newScores] : newScores;
    
    // Keep only last 1000 scores to prevent memory bloat
    const recentScores = allScores.slice(-1000);
    
    this.historicalData.set(pointId, {
      pointId,
      scores: recentScores,
      statistics: this.calculateStatistics(recentScores),
      lastUpdated: new Date()
    });
  }

  /**
   * Detect outliers in a score set
   */
  public detectOutliers(scores: NormalizedScore[]): {
    outliers: NormalizedScore[];
    normal: NormalizedScore[];
  } {
    const outliers: NormalizedScore[] = [];
    const normal: NormalizedScore[] = [];

    scores.forEach(score => {
      const historicalData = this.historicalData.get(score.pointId);
      if (!historicalData) {
        normal.push(score);
        return;
      }

      const { outlierThreshold } = historicalData.statistics;
      if (score.normalizedScore < outlierThreshold.lower || 
          score.normalizedScore > outlierThreshold.upper) {
        outliers.push(score);
      } else {
        normal.push(score);
      }
    });

    return { outliers, normal };
  }

  /**
   * Convert ComprehensiveFrameworkScore to ScoreComparison format
   */
  public convertToScoreComparison(
    comprehensiveScore: ComprehensiveFrameworkScore,
    method: NormalizationMethod = 'weighted'
  ): ScoreComparison {
    const rawScores: RawScoreInput[] = comprehensiveScore.individualScores.map(score => {
      // Determine category from point ID
      const category = score.pointId.split('_')[0];
      return {
        pointId: score.pointId,
        rawScore: score.score,
        confidence: score.confidence,
        category
      };
    });

    return this.normalizeScores(rawScores, method, comprehensiveScore.sessionId);
  }

  /**
   * Generate normalization report
   */
  public generateNormalizationReport(scoreComparison: ScoreComparison): string {
    let report = `Score Normalization Report\n`;
    report += `========================\n\n`;
    report += `Session ID: ${scoreComparison.sessionId}\n`;
    report += `Overall Score: ${scoreComparison.overallScore.toFixed(1)}/100\n`;
    
    if (scoreComparison.percentileRank) {
      report += `Percentile Rank: ${scoreComparison.percentileRank.toFixed(1)}%\n`;
    }
    
    if (scoreComparison.zScore) {
      report += `Z-Score: ${scoreComparison.zScore.toFixed(2)}\n`;
    }
    
    report += `\nCategory Scores:\n`;
    Object.entries(scoreComparison.categoryScores).forEach(([category, score]) => {
      const categoryInfo = FRAMEWORK_CATEGORIES[category];
      report += `• ${categoryInfo.title}: ${score.toFixed(1)}/100 (${categoryInfo.weight}% weight)\n`;
    });

    report += `\nIndividual Point Scores:\n`;
    scoreComparison.normalizedScores.forEach(score => {
      report += `• ${score.pointId}: ${score.normalizedScore.toFixed(1)}/100 `;
      report += `(raw: ${score.rawScore}/10, weight: ${score.weight}%, `;
      report += `confidence: ${(score.confidence * 100).toFixed(0)}%)\n`;
    });

    // Detect and report outliers
    const { outliers } = this.detectOutliers(scoreComparison.normalizedScores);
    if (outliers.length > 0) {
      report += `\nOutliers Detected:\n`;
      outliers.forEach(outlier => {
        report += `• ${outlier.pointId}: ${outlier.normalizedScore.toFixed(1)} (unusual score)\n`;
      });
    }

    return report;
  }
}

/**
 * Utility functions for score normalization
 */

/**
 * Quick normalization for a single ComprehensiveFrameworkScore
 */
export function normalizeFrameworkScore(
  comprehensiveScore: ComprehensiveFrameworkScore,
  method: NormalizationMethod = 'weighted',
  historicalData?: HistoricalData[]
): ScoreComparison {
  const normalizer = new ScoreNormalizer(historicalData);
  return normalizer.convertToScoreComparison(comprehensiveScore, method);
}

/**
 * Compare multiple pitch scores
 */
export function comparePitchScores(
  scores: ComprehensiveFrameworkScore[],
  method: NormalizationMethod = 'weighted',
  historicalData?: HistoricalData[]
): ScoreComparison[] {
  const normalizer = new ScoreNormalizer(historicalData);
  
  return scores.map(score => 
    normalizer.convertToScoreComparison(score, method)
  ).sort((a, b) => b.overallScore - a.overallScore); // Sort by overall score descending
}

/**
 * Generate batch normalization report for multiple pitches
 */
export function generateBatchNormalizationReport(
  scoreComparisons: ScoreComparison[]
): string {
  let report = `Batch Normalization Report\n`;
  report += `==========================\n\n`;
  report += `Total Pitches: ${scoreComparisons.length}\n`;
  
  if (scoreComparisons.length === 0) return report;

  const overallScores = scoreComparisons.map(sc => sc.overallScore);
  const avgScore = overallScores.reduce((sum, score) => sum + score, 0) / overallScores.length;
  const maxScore = Math.max(...overallScores);
  const minScore = Math.min(...overallScores);

  report += `Average Score: ${avgScore.toFixed(1)}/100\n`;
  report += `Highest Score: ${maxScore.toFixed(1)}/100\n`;
  report += `Lowest Score: ${minScore.toFixed(1)}/100\n`;
  report += `Score Range: ${(maxScore - minScore).toFixed(1)}\n\n`;

  report += `Ranking:\n`;
  scoreComparisons.forEach((comparison, index) => {
    report += `${index + 1}. ${comparison.sessionId}: ${comparison.overallScore.toFixed(1)}/100\n`;
  });

  return report;
} 