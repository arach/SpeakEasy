const { SpeakEasy } = require('./dist/index.js');

async function testCaching() {
  console.log('🧪 Testing caching functionality...');
  
  const speaker = new SpeakEasy({
    provider: 'openai',
    openaiVoice: 'nova',
    rate: 180
  }, true);

  console.log('📊 Cache stats:', await speaker.getCacheStats());
  
  // Test cache key generation
  const cacheKey = speaker['cache'].generateCacheKey('Hello world', 'openai', 'nova', 180);
  console.log('🔑 Generated cache key:', cacheKey);
  
  console.log('✅ Caching system initialized successfully!');
  
  // Note: Actual audio generation would require API keys
  // This test just verifies the caching infrastructure is working
}

testCaching().catch(console.error);