import { SpeakEasy, say, speak, CONFIG_FILE } from './index';

async function testSystem() {
  console.log('\nTesting system provider...');
  await say('Testing system voice', 'system');
}

async function testOpenAI() {
  console.log('\nTesting OpenAI provider...');
  await say('Testing OpenAI voice', 'openai');
}

async function testElevenLabs() {
  console.log('\nTesting ElevenLabs provider...');
  await say('Testing ElevenLabs voice', 'elevenlabs');
}

async function testGroq() {
  console.log('\nTesting Groq provider...');
  await say('Testing Groq voice', 'groq');
}

async function testCaching() {
  console.log('\nTesting caching system...');
  const speaker = new SpeakEasy({ provider: 'openai' }, true);
  
  console.log('📊 Cache stats:', await speaker.getCacheStats());
  
  // Test with a simple phrase
  console.log('🗣️  Speaking with cache enabled...');
  await speaker.speak('Testing caching functionality', { interrupt: false });
  
  console.log('✅ Caching test complete!');
}

async function testAll() {
  await testSystem();
  await testOpenAI();
  await testElevenLabs();
  await testGroq();
  await testCaching();
  console.log('Test complete!');
}

if (require.main === module) {
  const [, , ...args] = process.argv;
  const provider = args[0];
  (async () => {
    try {
      switch (provider) {
        case undefined:
        case 'all':
          await testAll();
          break;
        case 'system':
          await testSystem();
          break;
        case 'openai':
          await testOpenAI();
          break;
        case 'elevenlabs':
          await testElevenLabs();
          break;
        case 'groq':
          await testGroq();
          break;
        case 'cache':
          await testCaching();
          break;
        default:
          console.log('Unknown provider:', provider);
          console.log('Providers: system, openai, elevenlabs, groq, cache, all');
          process.exit(1);
      }
    } catch (err) {
      console.error('Error:', err);
      process.exit(1);
    }
  })();
}