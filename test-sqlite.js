const { TTSCache } = require('./dist/index.js');

async function testSQLiteMetadata() {
  console.log('Testing SQLite-based metadata system...');
  
  try {
    // Create cache instance
    const cache = new TTSCache('/tmp/speakeasy-test-cache', '1h');
    
    console.log('✅ Cache initialized successfully');
    
    // Test metadata storage
    const testMetadata = {
      cacheKey: 'test-key-123',
      originalText: 'Hello world',
      provider: 'openai',
      voice: 'nova',
      rate: 180,
      timestamp: Date.now(),
      fileSize: 1024,
      filePath: '/tmp/test.mp3',
      model: 'tts-1',
      source: 'test',
      sessionId: 'test-session',
      processId: '12345',
      hostname: 'test-host',
      user: 'test-user',
      workingDirectory: '/tmp',
      commandLine: 'node test.js',
      durationMs: 1500,
      success: true
    };
    
    await cache['addMetadata'](testMetadata);
    console.log('✅ Metadata stored in SQLite');
    
    // Test search functionality
    const results = await cache.search({ text: 'Hello' });
    console.log(`✅ Search returned ${results.length} results`);
    
    // Test stats
    const stats = await cache.getStats();
    console.log('✅ Stats retrieved:', {
      totalEntries: stats.totalEntries,
      totalSize: stats.totalSize,
      providers: stats.providers
    });
    
    // Test recent items
    const recent = await cache.getRecent(5);
    console.log(`✅ Recent items: ${recent.length}`);
    
    // Test cleanup
    await cache.clear();
    console.log('✅ Cache cleared successfully');
    
    console.log('\n🎉 All SQLite metadata tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testSQLiteMetadata();