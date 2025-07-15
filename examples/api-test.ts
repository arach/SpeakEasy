#!/usr/bin/env node

/**
 * API-specific test for cloud TTS providers
 * Tests OpenAI and ElevenLabs voices with actual API calls
 */

import { SpeechService } from '../dist/index.js';

async function testCloudProviders() {
  console.log('🌐 Testing Cloud TTS Providers\n');

  // Check environment variables
  const openaiKey = process.env.OPENAI_API_KEY;
  const elevenlabsKey = process.env.ELEVENLABS_API_KEY;

  console.log('🔑 API Keys Status:');
  console.log(`   OpenAI: ${openaiKey ? '✅ Set' : '❌ Not set'}`);
  console.log(`   ElevenLabs: ${elevenlabsKey ? '✅ Set' : '❌ Not set'}`);
  console.log('');

  // Test OpenAI if key is available
  if (openaiKey) {
    console.log('🤖 Testing OpenAI TTS:');
    try {
      const openaiSpeech = new SpeechService({
        provider: 'openai',
        openaiVoice: 'nova', // Natural female voice
        rate: 180,
        apiKeys: { openai: openaiKey }
      });

      await openaiSpeech.speak('This is OpenAI\'s Nova voice. It sounds much more natural than system TTS with better pronunciation and intonation.');
      console.log('   ✅ OpenAI TTS successful');

      // Test different OpenAI voices
      const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
      for (const voice of voices) {
        const test = new SpeechService({
          provider: 'openai',
          openaiVoice: voice as any,
          rate: 180,
          apiKeys: { openai: openaiKey }
        });
        await test.speak(`This is the ${voice} voice from OpenAI.`);
      }
    } catch (error) {
      console.error('   ❌ OpenAI TTS failed:', error.message);
    }
    console.log('');
  }

  // Test ElevenLabs if key is available
  if (elevenlabsKey) {
    console.log('🎙️ Testing ElevenLabs TTS:');
    try {
      const elevenlabsSpeech = new SpeechService({
        provider: 'elevenlabs',
        elevenlabsVoiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella (professional female)
        rate: 190,
        apiKeys: { elevenlabs: elevenlabsKey }
      });

      await elevenlabsSpeech.speak('This is ElevenLabs Bella voice. It provides the most natural and expressive speech synthesis available.');
      console.log('   ✅ ElevenLabs TTS successful');

      // Test different ElevenLabs voices
      const voices = [
        { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' },
        { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
        { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni' },
        { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli' }
      ];

      for (const voice of voices) {
        try {
          const test = new SpeechService({
            provider: 'elevenlabs',
            elevenlabsVoiceId: voice.id,
            rate: 190,
            apiKeys: { elevenlabs: elevenlabsKey }
          });
          await test.speak(`This is the ${voice.name} voice from ElevenLabs.`);
        } catch (error) {
          console.warn(`   ⚠️ Voice ${voice.name} failed:`, error.message);
        }
      }
    } catch (error) {
      console.error('   ❌ ElevenLabs TTS failed:', error.message);
    }
    console.log('');
  }

  // Test fallback behavior
  if (!openaiKey && !elevenlabsKey) {
    console.log('📱 Testing fallback to system voice:');
    try {
      const fallback = new SpeechService({
        provider: 'openai', // Will fallback to system
        apiKeys: { openai: '', elevenlabs: '' } // Empty keys
      });

      await fallback.speak('Since no API keys are available, this will automatically use the system voice as fallback.');
      console.log('   ✅ System voice fallback successful');
    } catch (error) {
      console.error('   ❌ Fallback failed:', error.message);
    }
  }

  // Show setup instructions
  if (!openaiKey || !elevenlabsKey) {
    console.log('\n🔧 To test cloud providers, set these environment variables:');
    console.log('   export OPENAI_API_KEY=your_openai_key_here');
    console.log('   export ELEVENLABS_API_KEY=your_elevenlabs_key_here');
    console.log('');
    console.log('   You can get keys from:');
    console.log('   • OpenAI: https://platform.openai.com/api-keys');
    console.log('   • ElevenLabs: https://elevenlabs.io/api');
  }

  console.log('🎉 API testing completed!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testCloudProviders().catch(console.error);
}