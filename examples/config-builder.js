// Config Builder Examples
import { SpeakEasy } from 'speakeasy';

// Basic fluent configuration
const speaker = SpeakEasy.builder()
  .withProvider('openai')
  .withOpenAIVoice('nova')
  .withRate(200)
  .build();

await speaker.speak('Hello from the builder pattern!');

// With API keys
const premiumSpeaker = SpeakEasy.builder()
  .withProvider('elevenlabs')
  .withElevenLabsVoice('EXAVITQu4vr4xnSDxMaL')
  .withApiKeys({ 
    elevenlabs: process.env.ELEVENLABS_API_KEY 
  })
  .withRate(160)
  .build();

await premiumSpeaker.speak('This uses ElevenLabs with a premium voice');

// System voice with custom settings
const systemSpeaker = SpeakEasy.builder()
  .withProvider('system')
  .withSystemVoice('Alex')
  .withRate(220)
  .build();

await systemSpeaker.speak('Using macOS system voice with Alex');