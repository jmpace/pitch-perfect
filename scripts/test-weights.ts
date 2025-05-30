#!/usr/bin/env ts-node

import { generateWeightSummary, WEIGHT_VALIDATION, CATEGORY_CONSISTENCY } from '../lib/framework-weights';

console.log('PitchPerfect Framework Weight Validation');
console.log('=======================================\n');

console.log(generateWeightSummary());

console.log('\nDetailed Validation Results:');
console.log('----------------------------');
console.log('Weight Validation:', WEIGHT_VALIDATION);
console.log('\nCategory Consistency:', CATEGORY_CONSISTENCY);

if (WEIGHT_VALIDATION.isValid) {
  console.log('\n✅ All weights are properly configured and validated!');
} else {
  console.log('\n❌ Weight validation failed. Issues found:');
  WEIGHT_VALIDATION.issues.forEach(issue => console.log(`   - ${issue}`));
  console.log('\nRecommendations:');
  WEIGHT_VALIDATION.recommendations.forEach(rec => console.log(`   - ${rec}`));
} 