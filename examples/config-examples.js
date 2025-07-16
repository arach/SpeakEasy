// Configuration Examples
import { SpeakEasy } from 'speakeasy';

// Basic configuration
const speaker = new SpeakEasy({
  provider: 'openai',
  openaiVoice: 'nova',
  rate: 200
});

await speaker.speak('Hello from the simple config pattern!');

// With API keys
const premiumSpeaker = new SpeakEasy({
  provider: 'elevenlabs',
  elevenlabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
  apiKeys: { 
    elevenlabs: process.env.ELEVENLABS_API_KEY 
  },
  rate: 160
});

await premiumSpeaker.speak('This uses ElevenLabs with a premium voice');

// System voice with custom settings
const systemSpeaker = new SpeakEasy({
  provider: 'system',
  systemVoice: 'Alex',
  rate: 220
});

await systemSpeaker.speak('Using macOS system voice with Alex');