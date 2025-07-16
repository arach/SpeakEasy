// Error handling examples
import { SpeakEasy } from 'speakeasy';

// Safe speaking with fallbacks
const safeSpeaker = SpeakEasy.builder()
  .withProvider('openai')
  .withApiKeys({ openai: process.env.OPENAI_API_KEY })
  .build();

async function speakSafely(text) {
  try {
    await safeSpeaker.speak(text);
  } catch (error) {
    console.error('Speech failed:', error.message);
    console.log('💡 Tip: Check your API keys or try system voice');
    
    // Fallback to system voice
    const fallback = SpeakEasy.builder().withProvider('system').build();
    await fallback.speak(text);
  }
}

// Usage
await speakSafely('This will work even if API fails');