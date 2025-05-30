"use strict";
/**
 * PitchPerfect 15-Point Framework for Pitch Evaluation
 *
 * This framework evaluates startup pitches across four key dimensions:
 * - Speech Mechanics (5 points)
 * - Content Quality (5 points)
 * - Visual Presentation (3 points)
 * - Overall Effectiveness (2 points)
 *
 * Each point is scored 1-10 with specific evaluation criteria.
 * Updated with detailed, research-backed, measurable definitions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FRAMEWORK_POINTS = exports.FRAMEWORK_CATEGORIES = void 0;
exports.getFrameworkPointById = getFrameworkPointById;
exports.getFrameworkPointsByCategory = getFrameworkPointsByCategory;
exports.calculateCategoryScore = calculateCategoryScore;
exports.calculateOverallScore = calculateOverallScore;
exports.getScoreDescription = getScoreDescription;
exports.getScoreColor = getScoreColor;
// Framework Categories Definition
exports.FRAMEWORK_CATEGORIES = {
    speech: {
        id: 'speech',
        title: 'Speech Mechanics',
        description: 'Evaluation of speaking delivery, pace, clarity, and vocal presence',
        pointCount: 5,
        weight: 30 // 30% of total score
    },
    content: {
        id: 'content',
        title: 'Content Quality',
        description: 'Assessment of pitch narrative, problem-solution fit, and business fundamentals',
        pointCount: 5,
        weight: 40 // 40% of total score
    },
    visual: {
        id: 'visual',
        title: 'Visual Presentation',
        description: 'Analysis of slide design, data visualization, and presentation flow',
        pointCount: 3,
        weight: 20 // 20% of total score
    },
    overall: {
        id: 'overall',
        title: 'Overall Effectiveness',
        description: 'Holistic evaluation of persuasion, storytelling, and executive presence',
        pointCount: 2,
        weight: 10 // 10% of total score
    }
};
// Complete 15-Point Framework Definition with Research-Backed Metrics
exports.FRAMEWORK_POINTS = [
    // Speech Mechanics (5 Points)
    {
        id: 'speech_pace_rhythm',
        title: 'Pace and Rhythm',
        description: 'Speaking rate 160-180 WPM, strategic pauses 0.5-1.0s, natural rhythm variation',
        category: 'speech',
        evaluationCriteria: {
            excellent: {
                description: 'Speaking at 160-180 WPM with strategic pauses for emphasis, natural rhythm that keeps audience engaged, varies pace appropriately for different content sections',
                metrics: {
                    wpm: { min: 160, max: 180 },
                    pauseDuration: { min: 0.5, max: 1.0 },
                    pauseFrequency: { min: 2, max: 3 },
                    rhythmVariation: { max: 0.1 }
                }
            },
            satisfactory: {
                description: 'Generally good pacing with occasional rushed or slow sections, some strategic pausing, mostly natural rhythm with minor inconsistencies',
                metrics: {
                    wpm: { min: 140, max: 200 },
                    pauseDuration: { min: 0.3, max: 1.5 },
                    pauseFrequency: { min: 3, max: 4 },
                    rhythmVariation: { max: 0.15 }
                }
            },
            needsImprovement: {
                description: 'Too fast (>200 WPM) or too slow (<140 WPM), lacks strategic pauses, monotonous rhythm that may lose audience attention',
                metrics: {
                    wpm: { max: 140, or: { min: 200, max: 999 } },
                    pauseDuration: { max: 0.3, or: { min: 1.5, max: 999 } },
                    pauseFrequency: { min: 4, max: 999 },
                    rhythmVariation: { min: 0.15, max: 1.0 }
                }
            }
        },
        targetMetrics: {
            optimal: '160-180 words per minute, 0.5-1.0s pauses',
            minimum: '140-200 words per minute'
        },
        researchBasis: 'University of Michigan Study on optimal presentation pace',
        measurableAspects: ['Words per minute', 'Pause duration', 'Pause frequency', 'Rhythm variation']
    },
    {
        id: 'speech_volume_projection',
        title: 'Volume and Projection',
        description: 'Volume 15-20dB above ambient, <10% variation, no strain',
        category: 'speech',
        evaluationCriteria: {
            excellent: {
                description: 'Volume consistently 15-20dB above ambient noise, <5% volume variation, strong projection without strain, voice carries clearly to all audience members',
                metrics: {
                    volumeAboveAmbient: { min: 15, max: 20 },
                    volumeVariation: { max: 0.05 },
                    projectionScore: { min: 0.9 },
                    strainScore: { max: 0.1 }
                }
            },
            satisfactory: {
                description: 'Volume 10-15dB above ambient noise, 5-10% volume variation, generally good projection with minor fluctuations',
                metrics: {
                    volumeAboveAmbient: { min: 10, max: 15 },
                    volumeVariation: { min: 0.05, max: 0.1 },
                    projectionScore: { min: 0.7, max: 0.9 },
                    strainScore: { min: 0.1, max: 0.3 }
                }
            },
            needsImprovement: {
                description: 'Volume <10dB above ambient noise, >10% volume variation, voice trails off or becomes inaudible, strain or breathiness present',
                metrics: {
                    volumeAboveAmbient: { max: 10 },
                    volumeVariation: { min: 0.1 },
                    projectionScore: { max: 0.7 },
                    strainScore: { min: 0.3 }
                }
            }
        },
        targetMetrics: {
            optimal: '15-20dB above ambient noise, <5% variation',
            minimum: '10dB above ambient noise, <10% variation'
        },
        researchBasis: 'Speech Communication Journal standards',
        measurableAspects: ['Volume level', 'Volume consistency', 'Projection strength', 'Vocal strain']
    },
    {
        id: 'speech_clarity_articulation',
        title: 'Clarity and Articulation',
        description: '>95% word recognition, <5% unclear words, strong articulation',
        category: 'speech',
        evaluationCriteria: {
            excellent: {
                description: '>98% word recognition accuracy, <2% unclear words, strong consonant and vowel articulation, no mumbling or trailing off',
                metrics: {
                    wordRecognitionRate: { min: 0.98 },
                    unclearWordRate: { max: 0.02 },
                    articulationScore: { min: 0.9 },
                    trailingOffScore: { max: 0.1 }
                }
            },
            satisfactory: {
                description: '95-98% word recognition accuracy, 2-5% unclear words, generally good articulation with minor issues',
                metrics: {
                    wordRecognitionRate: { min: 0.95, max: 0.98 },
                    unclearWordRate: { min: 0.02, max: 0.05 },
                    articulationScore: { min: 0.7, max: 0.9 },
                    trailingOffScore: { min: 0.1, max: 0.3 }
                }
            },
            needsImprovement: {
                description: '<95% word recognition accuracy, >5% unclear words, frequent mumbling or trailing off, difficult to understand',
                metrics: {
                    wordRecognitionRate: { max: 0.95 },
                    unclearWordRate: { min: 0.05 },
                    articulationScore: { max: 0.7 },
                    trailingOffScore: { min: 0.3 }
                }
            }
        },
        targetMetrics: {
            optimal: '>98% word recognition, <2% unclear words',
            minimum: '>95% word recognition, <5% unclear words'
        },
        researchBasis: 'Speech Communication Journal standards',
        measurableAspects: ['Word recognition accuracy', 'Unclear word percentage', 'Articulation clarity', 'Trailing off frequency']
    },
    {
        id: 'speech_filler_words',
        title: 'Filler Words and Pauses',
        description: '<5 filler words/minute, strategic pauses 0.5-1.0s',
        category: 'speech',
        evaluationCriteria: {
            excellent: {
                description: 'Minimal filler words (<5 per minute), strategic use of silence for emphasis, confident pauses that enhance delivery',
                metrics: {
                    fillerWordsPerMinute: { max: 5 },
                    pauseDuration: { min: 0.5, max: 1.0 },
                    fillerWordDiversity: { max: 2 },
                    strategicPauseRatio: { min: 0.8 }
                }
            },
            satisfactory: {
                description: 'Moderate filler word usage (5-10 per minute), generally good pause placement with occasional awkward gaps',
                metrics: {
                    fillerWordsPerMinute: { min: 5, max: 10 },
                    pauseDuration: { min: 0.3, max: 1.5 },
                    fillerWordDiversity: { min: 2, max: 4 },
                    strategicPauseRatio: { min: 0.6, max: 0.8 }
                }
            },
            needsImprovement: {
                description: 'Excessive filler words (>10 per minute), frequent "um," "uh," "like," poor pause timing that disrupts flow',
                metrics: {
                    fillerWordsPerMinute: { min: 10 },
                    pauseDuration: { max: 0.3, or: { min: 1.5 } },
                    fillerWordDiversity: { min: 4 },
                    strategicPauseRatio: { max: 0.6 }
                }
            }
        },
        targetMetrics: {
            optimal: 'Less than 5 filler words per minute',
            minimum: 'Less than 15 filler words per minute'
        },
        researchBasis: 'Toastmasters International professional speaking standards',
        measurableAspects: ['Filler words per minute', 'Pause duration', 'Filler word diversity', 'Strategic pause ratio']
    },
    {
        id: 'speech_vocal_confidence',
        title: 'Vocal Confidence',
        description: '<5% vocal tremor, >70% assertive statements, controlled pitch variation',
        category: 'speech',
        evaluationCriteria: {
            excellent: {
                description: 'Strong, steady tone throughout, assertive delivery that commands attention, minimal vocal tremor or uncertainty',
                metrics: {
                    tremorPercentage: { max: 0.03 },
                    assertiveStatementRatio: { min: 0.8 },
                    pitchVariationRange: { min: 3, max: 5 },
                    upspeakPercentage: { max: 0.05 }
                }
            },
            satisfactory: {
                description: 'Generally confident tone with occasional uncertainty, mostly steady delivery with minor wavering',
                metrics: {
                    tremorPercentage: { min: 0.03, max: 0.05 },
                    assertiveStatementRatio: { min: 0.7, max: 0.8 },
                    pitchVariationRange: { min: 2, max: 6 },
                    upspeakPercentage: { min: 0.05, max: 0.1 }
                }
            },
            needsImprovement: {
                description: 'Shaky or uncertain tone, frequent vocal tremor, hesitant delivery that undermines credibility',
                metrics: {
                    tremorPercentage: { min: 0.05 },
                    assertiveStatementRatio: { max: 0.7 },
                    pitchVariationRange: { max: 2, or: { min: 6 } },
                    upspeakPercentage: { min: 0.1 }
                }
            }
        },
        researchBasis: 'Voice Foundation research on vocal confidence indicators',
        measurableAspects: ['Vocal tremor percentage', 'Assertive statement ratio', 'Pitch variation range', 'Upspeak frequency']
    },
    // Content Quality (5 Points)
    {
        id: 'content_problem_definition',
        title: 'Problem Definition Clarity',
        description: 'Specific metrics, clear audience, >80% relatability, data-backed urgency',
        category: 'content',
        evaluationCriteria: {
            excellent: {
                description: 'Problem is clearly defined with specific pain points, relatable and urgent for target audience, backed by compelling evidence or stories',
                metrics: {
                    metricCount: { min: 3 },
                    audienceDefinitionScore: { min: 0.9 },
                    relatabilityScore: { min: 0.9 },
                    urgencyDataPoints: { min: 2 }
                }
            },
            satisfactory: {
                description: 'Problem is generally clear with some specificity, mostly relatable with adequate supporting evidence',
                metrics: {
                    metricCount: { min: 2, max: 3 },
                    audienceDefinitionScore: { min: 0.7, max: 0.9 },
                    relatabilityScore: { min: 0.8, max: 0.9 },
                    urgencyDataPoints: { min: 1, max: 2 }
                }
            },
            needsImprovement: {
                description: 'Problem is vague or unclear, not compelling or relatable, lacks supporting evidence or context',
                metrics: {
                    metricCount: { max: 2 },
                    audienceDefinitionScore: { max: 0.7 },
                    relatabilityScore: { max: 0.8 },
                    urgencyDataPoints: { max: 1 }
                }
            }
        },
        researchBasis: 'Problem-solution fit research from startup accelerators',
        measurableAspects: ['Specific metrics count', 'Audience definition clarity', 'Relatability score', 'Urgency data points']
    },
    {
        id: 'content_solution_explanation',
        title: 'Solution Explanation',
        description: '100% problem-solution alignment, 3+ specific benefits, 2-min demonstration, clear explanation',
        category: 'content',
        evaluationCriteria: {
            excellent: {
                description: 'Solution directly addresses stated problem, clear value proposition with specific benefits, logical and credible approach',
                metrics: {
                    problemAlignmentScore: { min: 1.0 },
                    benefitCount: { min: 4 },
                    demonstrationClarity: { min: 0.9 },
                    technicalClarityScore: { min: 0.9 }
                }
            },
            satisfactory: {
                description: 'Solution generally addresses problem with mostly clear value proposition, logical with minor gaps',
                metrics: {
                    problemAlignmentScore: { min: 0.8, max: 1.0 },
                    benefitCount: { min: 3, max: 4 },
                    demonstrationClarity: { min: 0.7, max: 0.9 },
                    technicalClarityScore: { min: 0.7, max: 0.9 }
                }
            },
            needsImprovement: {
                description: 'Solution unclear or doesn\'t clearly address problem, vague value proposition, illogical or incredible approach',
                metrics: {
                    problemAlignmentScore: { max: 0.8 },
                    benefitCount: { max: 3 },
                    demonstrationClarity: { max: 0.7 },
                    technicalClarityScore: { max: 0.7 }
                }
            }
        },
        researchBasis: 'Solution clarity standards from venture capital firms',
        measurableAspects: ['Problem-solution alignment', 'Benefit count', 'Demonstration clarity', 'Technical clarity']
    },
    {
        id: 'content_market_size',
        title: 'Market Size Validation',
        description: 'Complete TAM/SAM/SOM, <12mo data, reputable sources, 2+ growth indicators',
        category: 'content',
        evaluationCriteria: {
            excellent: {
                description: 'Clear TAM/SAM/SOM breakdown with credible sources, realistic addressable market sizing, compelling market opportunity',
                metrics: {
                    breakdownCompleteness: { min: 1.0 },
                    dataAge: { max: 6 },
                    sourceQualityScore: { min: 0.9 },
                    growthDataPoints: { min: 3 }
                }
            },
            satisfactory: {
                description: 'Generally credible market sizing with adequate sources, reasonable addressable market definition',
                metrics: {
                    breakdownCompleteness: { min: 0.7, max: 1.0 },
                    dataAge: { min: 6, max: 12 },
                    sourceQualityScore: { min: 0.7, max: 0.9 },
                    growthDataPoints: { min: 2, max: 3 }
                }
            },
            needsImprovement: {
                description: 'Unrealistic or unsupported market claims, vague market definition, incredible market sizing',
                metrics: {
                    breakdownCompleteness: { max: 0.7 },
                    dataAge: { min: 12 },
                    sourceQualityScore: { max: 0.7 },
                    growthDataPoints: { max: 2 }
                }
            }
        },
        researchBasis: 'Market sizing methodology from top consulting firms',
        measurableAspects: ['TAM/SAM/SOM completeness', 'Data recency', 'Source quality', 'Growth data points']
    },
    {
        id: 'content_traction_demonstration',
        title: 'Traction Demonstration',
        description: '3+ key metrics, 2+ testimonials, >10% MoM growth, on-schedule milestones',
        category: 'content',
        evaluationCriteria: {
            excellent: {
                description: 'Strong concrete metrics showing progress, clear customer validation, compelling growth trajectory or early wins',
                metrics: {
                    metricCount: { min: 4 },
                    testimonialCount: { min: 3 },
                    growthRate: { min: 0.15 },
                    milestoneCompletion: { min: 1.0 }
                }
            },
            satisfactory: {
                description: 'Some evidence of traction with adequate metrics, reasonable customer validation or early indicators',
                metrics: {
                    metricCount: { min: 3, max: 4 },
                    testimonialCount: { min: 2, max: 3 },
                    growthRate: { min: 0.1, max: 0.15 },
                    milestoneCompletion: { min: 0.8, max: 1.0 }
                }
            },
            needsImprovement: {
                description: 'Little to no concrete traction shown, vague claims without supporting evidence, no clear customer validation',
                metrics: {
                    metricCount: { max: 3 },
                    testimonialCount: { max: 2 },
                    growthRate: { max: 0.1 },
                    milestoneCompletion: { max: 0.8 }
                }
            }
        },
        researchBasis: 'Early-stage startup traction benchmarks from accelerators',
        measurableAspects: ['Key metrics count', 'Testimonial count', 'Growth rate', 'Milestone completion']
    },
    {
        id: 'content_financial_projections',
        title: 'Financial Projections',
        description: 'Industry-benchmarked projections, clear assumptions, <24mo profitability, positive unit economics',
        category: 'content',
        evaluationCriteria: {
            excellent: {
                description: 'Realistic financial projections with clear assumptions, credible revenue model, well-defined path to profitability',
                metrics: {
                    benchmarkAlignment: { min: 0.9 },
                    assumptionClarityScore: { min: 0.9 },
                    profitabilityMonths: { max: 18 },
                    unitEconomicsScore: { min: 0.9 }
                }
            },
            satisfactory: {
                description: 'Generally realistic projections with mostly clear assumptions, reasonable revenue model with minor gaps',
                metrics: {
                    benchmarkAlignment: { min: 0.7, max: 0.9 },
                    assumptionClarityScore: { min: 0.7, max: 0.9 },
                    profitabilityMonths: { min: 18, max: 24 },
                    unitEconomicsScore: { min: 0.7, max: 0.9 }
                }
            },
            needsImprovement: {
                description: 'Unrealistic or hockey-stick projections, unclear assumptions, no clear path to profitability',
                metrics: {
                    benchmarkAlignment: { max: 0.7 },
                    assumptionClarityScore: { max: 0.7 },
                    profitabilityMonths: { min: 24 },
                    unitEconomicsScore: { max: 0.7 }
                }
            }
        },
        researchBasis: 'Financial projection standards from venture capital due diligence',
        measurableAspects: ['Benchmark alignment', 'Assumption clarity', 'Profitability timeline', 'Unit economics']
    },
    // Visual Presentation (3 Points)
    {
        id: 'visual_slide_design',
        title: 'Slide Design Effectiveness',
        description: '≥24pt fonts, ≥4.5:1 contrast, ≤40 words/slide, clear hierarchy',
        category: 'visual',
        evaluationCriteria: {
            excellent: {
                description: 'Clean, professional layout with excellent readability, appropriate font sizes and colors, strong visual hierarchy',
                metrics: {
                    minFontSize: { min: 28 },
                    contrastRatio: { min: 7.0 },
                    wordsPerSlide: { max: 30 },
                    hierarchyLevels: { min: 4 },
                    whiteSpaceRatio: { min: 0.4 }
                }
            },
            satisfactory: {
                description: 'Generally clean design with good readability, mostly appropriate fonts and colors with minor issues',
                metrics: {
                    minFontSize: { min: 24, max: 28 },
                    contrastRatio: { min: 4.5, max: 7.0 },
                    wordsPerSlide: { min: 30, max: 40 },
                    hierarchyLevels: { min: 3, max: 4 },
                    whiteSpaceRatio: { min: 0.3, max: 0.4 }
                }
            },
            needsImprovement: {
                description: 'Cluttered or unprofessional layout, poor readability, inappropriate fonts or colors that distract from content',
                metrics: {
                    minFontSize: { max: 24 },
                    contrastRatio: { max: 4.5 },
                    wordsPerSlide: { min: 40 },
                    hierarchyLevels: { max: 3 },
                    whiteSpaceRatio: { max: 0.3 }
                }
            }
        },
        researchBasis: 'Presentation Design Institute and WCAG 2.1 accessibility standards',
        measurableAspects: ['Font size', 'Color contrast ratio', 'Words per slide', 'Visual hierarchy', 'White space ratio']
    },
    {
        id: 'visual_data_visualization',
        title: 'Data Visualization Quality',
        description: '≥0.8 data-ink ratio, appropriate chart types, purposeful color, clear labels',
        category: 'visual',
        evaluationCriteria: {
            excellent: {
                description: 'Excellent charts and graphs that clearly communicate data, appropriate visualization types, easy to interpret at a glance',
                metrics: {
                    dataInkRatio: { min: 0.9 },
                    chartTypeScore: { min: 0.9 },
                    colorPurposeScore: { min: 0.9 },
                    labelCompleteness: { min: 1.0 },
                    dataPointVisibility: { min: 0.9 }
                }
            },
            satisfactory: {
                description: 'Generally clear data visualizations with mostly appropriate chart types, reasonably easy to interpret',
                metrics: {
                    dataInkRatio: { min: 0.8, max: 0.9 },
                    chartTypeScore: { min: 0.7, max: 0.9 },
                    colorPurposeScore: { min: 0.7, max: 0.9 },
                    labelCompleteness: { min: 0.8, max: 1.0 },
                    dataPointVisibility: { min: 0.7, max: 0.9 }
                }
            },
            needsImprovement: {
                description: 'Unclear or confusing charts, inappropriate visualization types, difficult to interpret or misleading data presentation',
                metrics: {
                    dataInkRatio: { max: 0.8 },
                    chartTypeScore: { max: 0.7 },
                    colorPurposeScore: { max: 0.7 },
                    labelCompleteness: { max: 0.8 },
                    dataPointVisibility: { max: 0.7 }
                }
            }
        },
        researchBasis: 'Tufte\'s principle and Cleveland\'s hierarchy for data visualization',
        measurableAspects: ['Data-ink ratio', 'Chart type appropriateness', 'Color purpose score', 'Label completeness', 'Data point visibility']
    },
    {
        id: 'visual_timing_flow',
        title: 'Timing and Flow',
        description: '1-2 min/slide, <0.5s transitions, logical sequence, progressive build',
        category: 'visual',
        evaluationCriteria: {
            excellent: {
                description: 'Perfect timing with appropriate time per slide, smooth transitions between slides, logical sequence that builds compelling narrative',
                metrics: {
                    secondsPerSlide: { min: 60, max: 90 },
                    transitionDuration: { max: 0.3 },
                    sequenceLogicScore: { min: 0.9 },
                    progressionScore: { min: 0.9 },
                    narrativeCoherence: { min: 0.9 }
                }
            },
            satisfactory: {
                description: 'Generally good timing with occasional rushed or slow slides, mostly smooth transitions with logical flow',
                metrics: {
                    secondsPerSlide: { min: 90, max: 120 },
                    transitionDuration: { min: 0.3, max: 0.5 },
                    sequenceLogicScore: { min: 0.7, max: 0.9 },
                    progressionScore: { min: 0.7, max: 0.9 },
                    narrativeCoherence: { min: 0.7, max: 0.9 }
                }
            },
            needsImprovement: {
                description: 'Poor timing with rushed or dragged slides, awkward transitions, illogical sequence that confuses narrative',
                metrics: {
                    secondsPerSlide: { max: 60, or: { min: 120 } },
                    transitionDuration: { min: 0.5 },
                    sequenceLogicScore: { max: 0.7 },
                    progressionScore: { max: 0.7 },
                    narrativeCoherence: { max: 0.7 }
                }
            }
        },
        researchBasis: 'Presentation timing research from communication studies',
        measurableAspects: ['Seconds per slide', 'Transition duration', 'Sequence logic', 'Progression score', 'Narrative coherence']
    },
    // Overall Effectiveness (2 Points)
    {
        id: 'overall_persuasion_storytelling',
        title: 'Persuasion and Storytelling',
        description: '3-act structure, emotional peaks, clear CTA, sustained engagement',
        category: 'overall',
        evaluationCriteria: {
            excellent: {
                description: 'Compelling story with clear beginning, middle, end, strong emotional engagement, persuasive narrative that motivates action',
                metrics: {
                    structureCompleteness: { min: 0.9 },
                    emotionalPeakTiming: { min: 0.9 },
                    ctaClarity: { min: 0.9 },
                    engagementScore: { min: 0.9 },
                    narrativeImpact: { min: 0.9 }
                }
            },
            satisfactory: {
                description: 'Generally compelling story with decent emotional engagement, mostly persuasive with minor weak points',
                metrics: {
                    structureCompleteness: { min: 0.7, max: 0.9 },
                    emotionalPeakTiming: { min: 0.7, max: 0.9 },
                    ctaClarity: { min: 0.7, max: 0.9 },
                    engagementScore: { min: 0.7, max: 0.9 },
                    narrativeImpact: { min: 0.7, max: 0.9 }
                }
            },
            needsImprovement: {
                description: 'Weak or unclear narrative, little emotional engagement, not persuasive or motivating for audience',
                metrics: {
                    structureCompleteness: { max: 0.7 },
                    emotionalPeakTiming: { max: 0.7 },
                    ctaClarity: { max: 0.7 },
                    engagementScore: { max: 0.7 },
                    narrativeImpact: { max: 0.7 }
                }
            }
        },
        researchBasis: 'Narrative psychology and persuasion research',
        measurableAspects: ['Story structure completeness', 'Emotional peak timing', 'CTA clarity', 'Engagement score', 'Narrative impact']
    },
    {
        id: 'overall_confidence_credibility',
        title: 'Confidence and Credibility',
        description: '60-70% eye contact, open body language, steady voice, leadership indicators',
        category: 'overall',
        evaluationCriteria: {
            excellent: {
                description: 'Strong executive presence with high trustworthiness, demonstrates clear leadership capability, highly credible and authoritative',
                metrics: {
                    eyeContactPercentage: { min: 0.65, max: 0.7 },
                    bodyLanguageScore: { min: 0.9 },
                    vocalSteadiness: { min: 0.9 },
                    leadershipIndicators: { min: 0.9 },
                    executivePresence: { min: 0.9 }
                }
            },
            satisfactory: {
                description: 'Generally confident with adequate credibility, shows reasonable leadership potential with minor concerns',
                metrics: {
                    eyeContactPercentage: { min: 0.6, max: 0.65 },
                    bodyLanguageScore: { min: 0.7, max: 0.9 },
                    vocalSteadiness: { min: 0.7, max: 0.9 },
                    leadershipIndicators: { min: 0.7, max: 0.9 },
                    executivePresence: { min: 0.7, max: 0.9 }
                }
            },
            needsImprovement: {
                description: 'Lacks confidence or credibility, poor executive presence, does not demonstrate leadership capability',
                metrics: {
                    eyeContactPercentage: { max: 0.6 },
                    bodyLanguageScore: { max: 0.7 },
                    vocalSteadiness: { max: 0.7 },
                    leadershipIndicators: { max: 0.7 },
                    executivePresence: { max: 0.7 }
                }
            }
        },
        researchBasis: 'Executive presence research and leadership assessment studies',
        measurableAspects: ['Eye contact percentage', 'Body language score', 'Vocal steadiness', 'Leadership indicators', 'Executive presence']
    }
];
// Utility functions for framework operations
function getFrameworkPointById(id) {
    return exports.FRAMEWORK_POINTS.find(point => point.id === id);
}
function getFrameworkPointsByCategory(category) {
    return exports.FRAMEWORK_POINTS.filter(point => point.category === category);
}
function calculateCategoryScore(scores, category) {
    const categoryPoints = getFrameworkPointsByCategory(category);
    const categoryScores = scores.filter(score => categoryPoints.some(point => point.id === score.pointId));
    if (categoryScores.length === 0)
        return 0;
    const total = categoryScores.reduce((sum, score) => sum + score.score, 0);
    return total / categoryScores.length;
}
function calculateOverallScore(scores) {
    const categoryScores = {
        speech: calculateCategoryScore(scores, 'speech'),
        content: calculateCategoryScore(scores, 'content'),
        visual: calculateCategoryScore(scores, 'visual'),
        overall: calculateCategoryScore(scores, 'overall')
    };
    // Apply category weights
    const weightedScore = (categoryScores.speech * (exports.FRAMEWORK_CATEGORIES.speech.weight / 100) +
        categoryScores.content * (exports.FRAMEWORK_CATEGORIES.content.weight / 100) +
        categoryScores.visual * (exports.FRAMEWORK_CATEGORIES.visual.weight / 100) +
        categoryScores.overall * (exports.FRAMEWORK_CATEGORIES.overall.weight / 100));
    return Math.round(weightedScore * 10) / 10; // Round to 1 decimal place
}
function getScoreDescription(score) {
    if (score >= 8)
        return 'Excellent';
    if (score >= 6)
        return 'Good';
    if (score >= 4)
        return 'Satisfactory';
    if (score >= 2)
        return 'Needs Improvement';
    return 'Poor';
}
function getScoreColor(score) {
    if (score >= 8)
        return 'text-green-600';
    if (score >= 6)
        return 'text-blue-600';
    if (score >= 4)
        return 'text-yellow-600';
    if (score >= 2)
        return 'text-orange-600';
    return 'text-red-600';
}
