/**
 * Test Sample Data Generator
 * 
 * Generates realistic pitch data for comprehensive testing of the scoring engine.
 * Includes various performance scenarios from excellent to poor presentations.
 */

/**
 * Generate realistic transcript analysis data
 */
function generateTranscriptAnalysis(scenario = 'average') {
  const scenarios = {
    excellent: {
      wordCount: 1800,
      duration: 600, // 10 minutes
      wordsPerMinute: 170,
      fillerWordCount: 8,
      fillerWordRate: 0.8,
      pauseData: {
        totalPauses: 45,
        averagePauseLength: 1.2,
        strategicPauses: 35
      },
      volumeConsistency: 0.92,
      clarityScore: 0.95,
      confidenceIndicators: {
        vocalTremor: false,
        upspeak: 2,
        assertiveStatements: 18
      }
    },
    good: {
      wordCount: 1650,
      duration: 600,
      wordsPerMinute: 165,
      fillerWordCount: 15,
      fillerWordRate: 1.5,
      pauseData: {
        totalPauses: 40,
        averagePauseLength: 1.8,
        strategicPauses: 22
      },
      volumeConsistency: 0.78,
      clarityScore: 0.82,
      confidenceIndicators: {
        vocalTremor: false,
        upspeak: 5,
        assertiveStatements: 14
      }
    },
    average: {
      wordCount: 1500,
      duration: 600,
      wordsPerMinute: 150,
      fillerWordCount: 25,
      fillerWordRate: 2.5,
      pauseData: {
        totalPauses: 35,
        averagePauseLength: 2.2,
        strategicPauses: 15
      },
      volumeConsistency: 0.65,
      clarityScore: 0.72,
      confidenceIndicators: {
        vocalTremor: false,
        upspeak: 8,
        assertiveStatements: 10
      }
    },
    poor: {
      wordCount: 1200,
      duration: 600,
      wordsPerMinute: 120,
      fillerWordCount: 45,
      fillerWordRate: 4.5,
      pauseData: {
        totalPauses: 50,
        averagePauseLength: 3.5,
        strategicPauses: 8
      },
      volumeConsistency: 0.45,
      clarityScore: 0.55,
      confidenceIndicators: {
        vocalTremor: true,
        upspeak: 15,
        assertiveStatements: 5
      }
    }
  };

  const data = scenarios[scenario] || scenarios.average;
  
  return {
    fullTranscript: generateSampleTranscript(scenario),
    ...data
  };
}

/**
 * Generate realistic visual analysis data
 */
function generateVisualAnalysis(scenario = 'average') {
  const scenarios = {
    excellent: {
      slideCount: 12,
      averageTimePerSlide: 50,
      designQualityScore: 0.92,
      dataVisualizationScore: 0.88,
      timingAlignmentScore: 0.95,
      readabilityScore: 0.90,
      professionalismScore: 0.93
    },
    good: {
      slideCount: 14,
      averageTimePerSlide: 43,
      designQualityScore: 0.78,
      dataVisualizationScore: 0.75,
      timingAlignmentScore: 0.82,
      readabilityScore: 0.80,
      professionalismScore: 0.85
    },
    average: {
      slideCount: 16,
      averageTimePerSlide: 37,
      designQualityScore: 0.65,
      dataVisualizationScore: 0.62,
      timingAlignmentScore: 0.68,
      readabilityScore: 0.70,
      professionalismScore: 0.72
    },
    poor: {
      slideCount: 22,
      averageTimePerSlide: 27,
      designQualityScore: 0.45,
      dataVisualizationScore: 0.40,
      timingAlignmentScore: 0.48,
      readabilityScore: 0.55,
      professionalismScore: 0.50
    }
  };

  return scenarios[scenario] || scenarios.average;
}

/**
 * Generate realistic content analysis data
 */
function generateContentAnalysis(scenario = 'average') {
  const scenarios = {
    excellent: {
      problemClarity: 0.95,
      solutionClarity: 0.92,
      marketSizeCredibility: 0.88,
      tractionEvidence: 0.85,
      financialRealism: 0.90,
      persuasionElements: 0.93,
      storyStructure: 0.90,
      credibilityFactors: 0.88
    },
    good: {
      problemClarity: 0.82,
      solutionClarity: 0.78,
      marketSizeCredibility: 0.75,
      tractionEvidence: 0.70,
      financialRealism: 0.76,
      persuasionElements: 0.80,
      storyStructure: 0.78,
      credibilityFactors: 0.74
    },
    average: {
      problemClarity: 0.68,
      solutionClarity: 0.65,
      marketSizeCredibility: 0.62,
      tractionEvidence: 0.58,
      financialRealism: 0.64,
      persuasionElements: 0.66,
      storyStructure: 0.63,
      credibilityFactors: 0.60
    },
    poor: {
      problemClarity: 0.45,
      solutionClarity: 0.42,
      marketSizeCredibility: 0.38,
      tractionEvidence: 0.32,
      financialRealism: 0.40,
      persuasionElements: 0.44,
      storyStructure: 0.38,
      credibilityFactors: 0.35
    }
  };

  return scenarios[scenario] || scenarios.average;
}

/**
 * Generate complete multimodal analysis input
 */
function generateSamplePitch(scenario = 'average', sessionId = null) {
  const id = sessionId || `test-session-${scenario}-${Date.now()}`;
  
  return {
    transcript: generateTranscriptAnalysis(scenario),
    visual: generateVisualAnalysis(scenario),
    content: generateContentAnalysis(scenario),
    sessionId: id
  };
}

/**
 * Generate sample transcript content
 */
function generateSampleTranscript(scenario = 'average') {
  const transcripts = {
    excellent: `Good morning everyone. Thank you for your time today. I'm here to present CloudFlow, a revolutionary platform that solves a critical problem in enterprise data management.

The problem is clear: 73% of enterprises struggle with data silos that cost them an average of 2.1 million dollars annually in inefficiencies. Current solutions are fragmented, expensive, and require extensive technical expertise.

Our solution, CloudFlow, is an AI-powered data integration platform that automatically connects, cleanses, and synchronizes data across enterprise systems. We've built proprietary algorithms that reduce integration time from months to hours.

The market opportunity is substantial. The global data integration market is valued at 12.3 billion dollars and growing at 14.8% annually. Our target segment represents 3.2 billion dollars of that market.

We have strong traction with 47 enterprise customers, including three Fortune 500 companies. Our monthly recurring revenue has grown 340% in the past year to 2.8 million dollars.

Our financial projections show a path to 100 million in ARR by year three, with gross margins of 82%. We're seeking 25 million in Series A funding to scale our sales team and expand internationally.

The team includes myself as CEO with 15 years in enterprise software, our CTO who led data platforms at Google, and our VP of Sales who scaled revenue at Snowflake from 10 to 100 million.

Thank you for your consideration. I'm confident CloudFlow will transform how enterprises manage their data.`,

    good: `Hi everyone, thanks for having me. I'm excited to share CloudFlow with you today.

So, the problem we're solving is that companies have their data scattered across different systems, and it's really hard to get a complete picture. This costs businesses a lot of money and time.

CloudFlow is our solution - it's a platform that uses AI to automatically connect all your data sources and keep everything in sync. What used to take our customers months now takes just hours.

The market for this is huge - over 12 billion dollars and growing fast. We're targeting medium to large enterprises who need better data integration.

We've been growing really well. We have 47 customers now, including some big names, and our revenue has grown over 300% this year.

Looking at our finances, we think we can reach 100 million in revenue in three years. We're raising 25 million to hire more salespeople and expand to Europe.

Our team has great experience - I've been in enterprise software for 15 years, our CTO worked at Google, and our sales VP helped scale Snowflake.

I think we have a real opportunity here to change how companies work with their data. Any questions?`,

    average: `Um, hi everyone. So, I'm here to, uh, talk about CloudFlow today.

So basically, companies have a problem with their data. Like, it's all over the place and, um, it's hard to, you know, get it all together. This is, uh, costing companies money.

Our solution is CloudFlow. It's like, a platform that, um, uses AI to connect data. Instead of taking months, it takes hours now.

The market is, uh, big. Really big. Like 12 billion dollars or something. We want to sell to enterprises.

We have some customers - 47 of them. And, um, our revenue is growing. Like 300% or something this year.

We think we can make 100 million in three years. We need 25 million to, uh, hire people and maybe expand.

Our team is good. I have experience, and so does our CTO and sales person.

So, um, yeah. That's CloudFlow. Do you have any questions?`,

    poor: `Um, so, hi. I guess I should, um, start. So we have this thing called CloudFlow.

Companies have data problems. Like, um, they can't, you know, get their data together. It's, uh, everywhere and stuff.

So we made CloudFlow. It's, um, it uses AI or whatever to, like, connect data. It's faster than other things, I guess.

The market is big. Really big. Like billions or something. We want to sell it to companies.

We have customers. Not sure exactly how many, but some. And we're making money. Growing and stuff.

We think we can make lots of money in the future. We need funding to, um, do things. Hire people maybe.

Our team is, um, experienced. I've done software before, and the other guys are smart too.

So, um, yeah. CloudFlow. It's good for data. Questions?`
  };

  return transcripts[scenario] || transcripts.average;
}

/**
 * Generate a batch of test scenarios
 */
function generateTestBatch() {
  const scenarios = ['excellent', 'good', 'average', 'poor'];
  return scenarios.map((scenario, index) => ({
    scenario,
    data: generateSamplePitch(scenario, `batch-test-${index + 1}`),
    expectedScoreRange: getExpectedScoreRange(scenario)
  }));
}

/**
 * Get expected score ranges for validation
 */
function getExpectedScoreRange(scenario) {
  const ranges = {
    excellent: { min: 8.5, max: 10.0 },
    good: { min: 7.0, max: 8.4 },
    average: { min: 5.0, max: 6.9 },
    poor: { min: 1.0, max: 4.9 }
  };
  
  return ranges[scenario] || ranges.average;
}

/**
 * Generate edge case scenarios for stress testing
 */
function generateEdgeCases() {
  return [
    {
      name: 'Very Fast Speaker',
      data: generateSamplePitch('average', 'edge-fast-speaker'),
      modifications: {
        'transcript.wordsPerMinute': 250,
        'transcript.fillerWordRate': 0.5
      }
    },
    {
      name: 'Very Slow Speaker',
      data: generateSamplePitch('average', 'edge-slow-speaker'),
      modifications: {
        'transcript.wordsPerMinute': 80,
        'transcript.pauseData.averagePauseLength': 5.0
      }
    },
    {
      name: 'Perfect Technical Scores, Poor Content',
      data: generateSamplePitch('average', 'edge-tech-good-content-poor'),
      modifications: {
        'transcript.wordsPerMinute': 170,
        'transcript.clarityScore': 0.95,
        'content.problemClarity': 0.2,
        'content.solutionClarity': 0.15
      }
    },
    {
      name: 'Great Content, Poor Delivery',
      data: generateSamplePitch('average', 'edge-content-good-delivery-poor'),
      modifications: {
        'content.problemClarity': 0.95,
        'content.solutionClarity': 0.92,
        'transcript.wordsPerMinute': 95,
        'transcript.fillerWordRate': 8.0
      }
    },
    {
      name: 'Minimal Data',
      data: {
        transcript: {
          fullTranscript: 'Short pitch.',
          wordCount: 2,
          duration: 30,
          wordsPerMinute: 4,
          fillerWordCount: 0,
          fillerWordRate: 0,
          pauseData: { totalPauses: 1, averagePauseLength: 2, strategicPauses: 0 },
          volumeConsistency: 0.5,
          clarityScore: 0.5,
          confidenceIndicators: { vocalTremor: false, upspeak: 0, assertiveStatements: 0 }
        },
        visual: generateVisualAnalysis('average'),
        content: generateContentAnalysis('average'),
        sessionId: 'edge-minimal-data'
      }
    }
  ];
}

/**
 * Apply modifications to sample data for edge cases
 */
function applyModifications(data, modifications) {
  const modifiedData = JSON.parse(JSON.stringify(data)); // Deep clone
  
  Object.entries(modifications).forEach(([path, value]) => {
    const keys = path.split('.');
    let current = modifiedData;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  });
  
  return modifiedData;
}

/**
 * Export all generators
 */
module.exports = {
  generateSamplePitch,
  generateTranscriptAnalysis,
  generateVisualAnalysis,
  generateContentAnalysis,
  generateTestBatch,
  generateEdgeCases,
  getExpectedScoreRange,
  applyModifications
};

/**
 * For direct execution - generate and display sample data
 */
if (require.main === module) {
  console.log('=== SAMPLE PITCH DATA GENERATOR ===\n');
  
  console.log('1. Standard Scenarios:');
  ['excellent', 'good', 'average', 'poor'].forEach(scenario => {
    const sample = generateSamplePitch(scenario);
    console.log(`\n${scenario.toUpperCase()} Scenario:`);
    console.log(`- WPM: ${sample.transcript.wordsPerMinute}`);
    console.log(`- Filler Rate: ${sample.transcript.fillerWordRate}/min`);
    console.log(`- Clarity: ${(sample.transcript.clarityScore * 100).toFixed(0)}%`);
    console.log(`- Design Quality: ${(sample.visual.designQualityScore * 100).toFixed(0)}%`);
    console.log(`- Problem Clarity: ${(sample.content.problemClarity * 100).toFixed(0)}%`);
  });
  
  console.log('\n\n2. Test Batch (4 scenarios):');
  const batch = generateTestBatch();
  batch.forEach((test, index) => {
    console.log(`Batch ${index + 1}: ${test.scenario} (expected score: ${test.expectedScoreRange.min}-${test.expectedScoreRange.max})`);
  });
  
  console.log('\n\n3. Edge Cases:');
  const edgeCases = generateEdgeCases();
  edgeCases.forEach(edge => {
    console.log(`- ${edge.name}`);
  });
  
  console.log('\nSample data generation complete!');
} 