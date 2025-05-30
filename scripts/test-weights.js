const { exec } = require('child_process');
const path = require('path');

// Test the weights by building and running a simple validation
console.log('PitchPerfect Framework Weight Validation');
console.log('=======================================\n');

// Let's manually check the category weights from our framework
const FRAMEWORK_CATEGORIES = {
  speech: { weight: 30, title: 'Speech Mechanics' },
  content: { weight: 40, title: 'Content Quality' },
  visual: { weight: 20, title: 'Visual Presentation' },
  overall: { weight: 10, title: 'Overall Effectiveness' }
};

const INDIVIDUAL_POINT_WEIGHTS = {
  // Speech Mechanics (5 points - 30% total)
  speech_pace_rhythm: 6.0,
  speech_volume_projection: 6.0,
  speech_clarity_articulation: 6.0,
  speech_filler_words: 6.0,
  speech_vocal_confidence: 6.0,

  // Content Quality (5 points - 40% total)
  content_problem_definition: 10.0,
  content_solution_explanation: 10.0,
  content_market_size: 7.0,
  content_traction_demonstration: 7.0,
  content_financial_projections: 6.0,

  // Visual Presentation (3 points - 20% total)
  visual_slide_design: 8.0,
  visual_data_visualization: 6.0,
  visual_timing_flow: 6.0,

  // Overall Effectiveness (2 points - 10% total)
  overall_persuasion_storytelling: 5.0,
  overall_confidence_credibility: 5.0
};

// Validation logic
function validateWeights() {
  console.log('Category Weights:');
  let totalCategoryWeight = 0;
  Object.entries(FRAMEWORK_CATEGORIES).forEach(([id, category]) => {
    console.log(`• ${category.title}: ${category.weight}%`);
    totalCategoryWeight += category.weight;
  });

  console.log(`\nTotal Category Weight: ${totalCategoryWeight}%`);
  
  let totalPointWeight = 0;
  Object.entries(INDIVIDUAL_POINT_WEIGHTS).forEach(([pointId, weight]) => {
    totalPointWeight += weight;
  });
  
  console.log(`Total Individual Point Weight: ${totalPointWeight}%`);
  
  const categoryValid = totalCategoryWeight === 100;
  const pointValid = Math.abs(totalPointWeight - 100) < 0.1;
  const overallValid = categoryValid && pointValid;
  
  console.log(`\nValidation Results:`);
  console.log(`Category weights valid: ${categoryValid ? '✅' : '❌'}`);
  console.log(`Point weights valid: ${pointValid ? '✅' : '❌'}`);
  console.log(`Overall valid: ${overallValid ? '✅' : '❌'}`);
  
  // Check category consistency
  console.log('\nCategory-Point Consistency:');
  Object.entries(FRAMEWORK_CATEGORIES).forEach(([categoryId, category]) => {
    const categoryPoints = Object.keys(INDIVIDUAL_POINT_WEIGHTS)
      .filter(pointId => pointId.startsWith(categoryId));
    
    const actualWeight = categoryPoints
      .reduce((sum, pointId) => sum + INDIVIDUAL_POINT_WEIGHTS[pointId], 0);
    
    const isConsistent = Math.abs(actualWeight - category.weight) < 0.1;
    console.log(`• ${category.title}: ${isConsistent ? '✅' : '❌'} (${actualWeight}% vs ${category.weight}%)`);
  });
  
  if (overallValid) {
    console.log('\n🎉 All weights are properly configured and validated!');
  } else {
    console.log('\n⚠️  Weight validation failed. Please check the configuration.');
  }
  
  return overallValid;
}

validateWeights(); 