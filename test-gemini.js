#!/usr/bin/env node

const { SpeakEasy } = require('./dist/index.js');

async function testGemini() {
  console.log('🧪 Testing Gemini TTS Provider');
  console.log('================================\n');

  // Check if API key is available
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.log('❌ GEMINI_API_KEY environment variable not set');
    console.log('💡 To test Gemini provider:');
    console.log('   1. Get API key: https://makersuite.google.com/app/apikey');
    console.log('   2. Run: export GEMINI_API_KEY=your_key_here');
    console.log('   3. Run: node test-gemini.js\n');
    
    console.log('Testing fallback to system voice...\n');
    
    // Test without API key (should fallback to system)
    const speaker = new SpeakEasy({
      provider: 'gemini',
      debug: true
    });
    
    try {
      await speaker.speak('Hello from Gemini fallback test');
      console.log('✅ Fallback to system voice worked');
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
    
    return;
  }

  console.log('✅ GEMINI_API_KEY detected\n');

  // Test with API key
  const speaker = new SpeakEasy({
    provider: 'gemini',
    geminiModel: 'gemini-2.5-pro-preview-tts',
    debug: true,
    cache: {
      enabled: true
    }
  });

  const testPhrases = [
    'Hello from Gemini text to speech',
    'This is a test of the Google Gemini TTS provider',
    'The quick brown fox jumps over the lazy dog'
  ];

  for (const phrase of testPhrases) {
    console.log(`\n🗣️  Speaking: "${phrase}"`);
    try {
      await speaker.speak(phrase);
      console.log('✅ Success');
    } catch (error) {
      console.error('❌ Error:', error.message);
      
      // If error is about API format, provide more details
      if (error.message.includes('API')) {
        console.log('\n💡 Note: The Gemini TTS API endpoint might have changed.');
        console.log('   Please check the latest documentation at:');
        console.log('   https://ai.google.dev/api/rest/v1beta/models/generateAudio');
      }
    }
  }

  console.log('\n🎉 Gemini TTS testing complete!');
}

// Run the test
testGemini().catch(console.error);