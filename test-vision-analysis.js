// Test script for GPT-4V visual analysis API
const testVisionAnalysis = async () => {
  const baseUrl = 'http://localhost:3001';
  
  // Test 1: GET endpoint for configuration
  console.log('🔍 Testing GET /api/openai/vision...');
  try {
    const configResponse = await fetch(`${baseUrl}/api/openai/vision`);
    const configData = await configResponse.json();
    console.log('✅ Configuration endpoint working:', configData.success);
    console.log('📋 Available analysis types:', Object.keys(configData.data.analysisTypes));
  } catch (error) {
    console.error('❌ Configuration endpoint failed:', error.message);
    return;
  }

  // Test 2: Single frame analysis with a sample presentation slide image
  console.log('\n🔍 Testing POST /api/openai/vision (single frame)...');
  
  // Using a sample presentation slide image from the web
  const testImageUrl = 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&h=600&fit=crop';
  
  const singleAnalysisRequest = {
    type: 'single',
    frameUrl: testImageUrl,
    timestamp: 10,
    analysisType: 'slide_content',
    context: {
      presentationTitle: 'Test Presentation',
      targetAudience: 'Business professionals',
      analysisGoals: ['Extract key content', 'Assess readability']
    }
  };

  try {
    const analysisResponse = await fetch(`${baseUrl}/api/openai/vision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(singleAnalysisRequest)
    });

    const analysisData = await analysisResponse.json();
    
    if (analysisData.success) {
      console.log('✅ Single frame analysis successful!');
      console.log('📊 Analysis result:', {
        confidence: analysisData.data.result.confidence,
        processingTime: `${analysisData.data.result.processingTime}ms`,
        analysisType: analysisData.data.result.analysisType,
        hasAnalysis: !!analysisData.data.result.analysis
      });
      
      if (analysisData.data.result.analysis.slideContent) {
        console.log('📝 Content analysis:', {
          bulletPoints: analysisData.data.result.analysis.slideContent.bulletPoints?.length || 0,
          keyMessages: analysisData.data.result.analysis.slideContent.keyMessages?.length || 0,
          textReadability: analysisData.data.result.analysis.slideContent.textReadability,
          informationDensity: analysisData.data.result.analysis.slideContent.informationDensity
        });
      }
    } else {
      console.error('❌ Single frame analysis failed:', analysisData.error);
    }
  } catch (error) {
    console.error('❌ Single frame analysis request failed:', error.message);
  }

  console.log('\n🎉 Vision analysis test completed!');
};

// Run the test
testVisionAnalysis().catch(console.error); 