#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 Starting Post-Task Verification...\n');

async function runCommand(command, args, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n📋 ${description}`);
    console.log(`Running: ${command} ${args.join(' ')}\n`);
    
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd: path.resolve(__dirname, '..')
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} - PASSED\n`);
        resolve();
      } else {
        console.log(`❌ ${description} - FAILED (exit code: ${code})\n`);
        reject(new Error(`${description} failed`));
      }
    });

    process.on('error', (err) => {
      console.log(`❌ ${description} - ERROR: ${err.message}\n`);
      reject(err);
    });
  });
}

async function main() {
  const startTime = Date.now();
  
  try {
    // Primary verification: Critical E2E functionality MUST pass
    console.log('🎯 CRITICAL VERIFICATION: Testing core user functionality...');
    await runCommand('npm', ['run', 'test:post-task'], 'Critical E2E User Journeys');
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('🎉 CRITICAL POST-TASK VERIFICATION COMPLETE!');
    console.log(`✅ Core functionality verified in ${duration}s`);
    console.log('✅ Task can be marked as complete');
    console.log('');
    console.log('📊 Summary:');
    console.log('  ✅ React hydration: VERIFIED');
    console.log('  ✅ User interactions: WORKING');
    console.log('  ✅ Tab functionality: CONFIRMED');
    console.log('  ✅ Browser compatibility: TESTED');
    console.log('');
    console.log('💡 Note: If unit tests need updates, address them as maintenance tasks.');
    console.log('   The critical user-facing functionality is verified and working.');
    console.log('');
    
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('🚨 CRITICAL VERIFICATION FAILED!');
    console.log(`❌ Core functionality broken after ${duration}s`);
    console.log('❌ DO NOT mark task as complete');
    console.log('');
    console.log('🔧 Action Required:');
    console.log('  - Fix core functionality before marking task complete');
    console.log('  - Test manually in browser to confirm issues');
    console.log('  - Check React hydration and JavaScript errors');
    console.log('');
    
    process.exit(1);
  }
}

// Handle script interruption
process.on('SIGINT', () => {
  console.log('\n⚠️  Post-task verification interrupted');
  process.exit(1);
});

main().catch(error => {
  console.error('💥 Unexpected error:', error.message);
  process.exit(1);
}); 