#!/usr/bin/env node

// Basic usage example for the Speakeasy library
const { SpeakEasy, say, speak } = require('../dist/index.js');

async function demonstrateBasicUsage() {
  console.log('🎤 Speakeasy Library Examples\n');

  // Example 1: Simple say() function
  console.log('1️⃣  Using the say() convenience function:');
  try {
    await say('Hello from the say function!');
    console.log('   ✅ say() function worked\n');
  } catch (error) {
    console.log('   ⚠️  say() function failed:', error.message, '\n');
  }

  // Example 2: Custom configuration
  console.log('2️⃣  Custom configuration:');
  try {
    const customSpeech = new SpeakEasy({
      provider: 'system',
      systemVoice: 'Alex',
      rate: 200
    });
    await customSpeech.speak('This uses system voice with custom settings');
    console.log('   ✅ Custom config worked\n');
  } catch (error) {
    console.log('   ❌ Custom config failed:', error.message, '\n');
  }

  // Example 3: Queue and priority
  console.log('3️⃣  Queue management with priorities:');
  try {
    const queueSpeech = new SpeakEasy({ provider: 'system' });
    
    // Queue multiple messages
    await queueSpeech.speak('This is normal priority message 1');
    await queueSpeech.speak('This is high priority', { priority: 'high' });
    await queueSpeech.speak('This is normal priority message 2');
    
    console.log('   ✅ Queue management worked\n');
  } catch (error) {
    console.log('   ⚠️  Queue management failed:', error.message, '\n');
  }

  // Example 4: Different providers
  console.log('4️⃣  Testing different providers:');
  const providers = ['system', 'openai', 'elevenlabs'];
  
  for (const provider of providers) {
    try {
      const speech = new SpeakEasy({ provider });
      await speech.speak(`Testing ${provider} provider`);
      console.log(`   ✅ ${provider} provider worked`);
    } catch (error) {
      console.log(`   ⚠️  ${provider} provider failed:`, error.message);
    }
  }

  console.log('\n🎉 All examples completed!');
}

// Run if called directly
if (require.main === module) {
  demonstrateBasicUsage().catch(console.error);
}

module.exports = { demonstrateBasicUsage };