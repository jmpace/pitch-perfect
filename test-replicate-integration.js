// Quick test for Replicate integration
// Run with: node test-replicate-integration.js

const { ReplicateVideoProcessor } = require('./lib/replicate-video-processor');

async function testReplicateIntegration() {
  console.log('🧪 Testing Replicate Integration...\n');
  
  // Test 1: Check environment variables
  console.log('1. Checking environment variables...');
  const hasReplicateToken = !!process.env.REPLICATE_API_TOKEN;
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  
  console.log(`   REPLICATE_API_TOKEN: ${hasReplicateToken ? '✅ Set' : '❌ Missing'}`);
  console.log(`   BLOB_READ_WRITE_TOKEN: ${hasBlobToken ? '✅ Set' : '❌ Missing'}`);
  console.log(`   VIDEO_PROCESSING_SERVICE: ${process.env.VIDEO_PROCESSING_SERVICE || 'not set'}\n`);
  
  if (!hasReplicateToken) {
    console.log('❌ Cannot test without REPLICATE_API_TOKEN');
    console.log('   Please set your Replicate API token in .env.local:');
    console.log('   REPLICATE_API_TOKEN=your_token_here\n');
    return;
  }
  
  // Test 2: Test Replicate connection
  console.log('2. Testing Replicate connection...');
  try {
    const connectionTest = await ReplicateVideoProcessor.testConnection();
    console.log(`   Connection: ${connectionTest ? '✅ Success' : '❌ Failed'}\n`);
  } catch (error) {
    console.log(`   Connection: ❌ Failed - ${error.message}\n`);
    return;
  }
  
  // Test 3: Test video metadata extraction (if we have a test video URL)
  const testVideoUrl = process.env.TEST_VIDEO_URL;
  if (testVideoUrl) {
    console.log('3. Testing video metadata extraction...');
    try {
      const metadata = await ReplicateVideoProcessor.extractVideoMetadata(testVideoUrl);
      console.log('   ✅ Metadata extracted successfully:');
      console.log(`      Duration: ${metadata.duration}s`);
      console.log(`      Resolution: ${metadata.resolution}`);
      console.log(`      FPS: ${metadata.fps}`);
      console.log(`      Format: ${metadata.format}\n`);
    } catch (error) {
      console.log(`   ❌ Metadata extraction failed: ${error.message}\n`);
    }
  } else {
    console.log('3. Skipping metadata test (no TEST_VIDEO_URL provided)\n');
  }
  
  // Test 4: Configuration check
  console.log('4. Checking video processor configuration...');
  const processingService = process.env.VIDEO_PROCESSING_SERVICE || 'replicate';
  const useReplicate = processingService === 'replicate' && hasReplicateToken;
  
  console.log(`   Processing Service: ${processingService}`);
  console.log(`   Will use Replicate: ${useReplicate ? '✅ Yes' : '❌ No'}\n`);
  
  // Summary
  console.log('🎯 Integration Test Summary:');
  console.log(`   - Environment: ${hasReplicateToken && hasBlobToken ? '✅ Ready' : '⚠️  Incomplete'}`);
  console.log(`   - Replicate API: ${hasReplicateToken ? '✅ Configured' : '❌ Missing token'}`);
  console.log(`   - Blob Storage: ${hasBlobToken ? '✅ Configured' : '❌ Missing token'}`);
  console.log(`   - Integration: ${useReplicate ? '✅ Ready for testing' : '⚠️  Will use fallback'}\n`);
  
  if (useReplicate) {
    console.log('🚀 Ready to process videos with Replicate!');
    console.log('   Models used:');
    console.log('   - fofr/video-to-frames (frame extraction)');
    console.log('   - fofr/toolkit (audio extraction & metadata)');
    console.log('   Try uploading a video through the web interface.');
  } else {
    console.log('⚠️  Set up environment variables to enable Replicate processing:');
    console.log('   1. Copy .env.replicate.example to .env.local');
    console.log('   2. Add your Replicate API token');
    console.log('   3. Restart the development server');
  }
}

// Run the test
testReplicateIntegration().catch(console.error);