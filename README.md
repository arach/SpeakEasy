# SpeakEasy 🎤

A unified speech library for all your projects with support for multiple TTS providers and clean configuration structure.

## Features

- **Multiple TTS Providers**: System (macOS), OpenAI, ElevenLabs, Groq
- **Smart Fallbacks**: Automatically falls back to available providers
- **Queue Management**: Handles multiple speech requests with priority
- **Text Cleaning**: Removes emojis and normalizes text for better speech
- **TypeScript**: Full type safety
- **Clean Config**: Nested provider configuration

## Installation

```bash
npm install speakeasy
```

## Quick Start

```typescript
import { say } from 'speakeasy';

await say('Hello world!');                    // system voice
await say('Hello!', 'openai');                // OpenAI TTS
await say('Hello!', 'elevenlabs');            // ElevenLabs TTS  
await say('Hello!', 'groq');                  // Groq TTS
```

## Configuration

SpeakEasy uses a clean nested configuration structure in `~/.config/speech/config.json`:

```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "voice": "nova",
      "model": "tts-1"
    },
    "elevenlabs": {
      "enabled": true,
      "voiceId": "EXAVITQu4vr4xnSDxMaL"
    },
    "system": {
      "enabled": true,
      "voice": "Samantha"
    },
    "groq": {
      "enabled": false,
      "voice": "nova",
      "model": "tts-1"
    }
  },
  "defaults": {
    "provider": "openai",
    "fallbackOrder": ["openai", "elevenlabs", "system"],
    "rate": 180
  }
}
```

### Environment Variables

```bash
export OPENAI_API_KEY=your_openai_key
export ELEVENLABS_API_KEY=your_elevenlabs_key
export GROQ_API_KEY=your_groq_key
```

## Usage

### Basic Usage

```typescript
import { say, speak } from 'speakeasy';

// Quick one-liners
await say('Hello world!');                    // system voice
await say('Hello!', 'openai');                // OpenAI TTS
await say('Hello!', 'elevenlabs');            // ElevenLabs TTS
await say('Hello!', 'groq');                  // Groq TTS

// Full featured
await speak('Hello world!', { priority: 'high' });
await speak('Hello!', { provider: 'openai', priority: 'high' });

// Custom configuration
import { SpeakEasy } from 'speakeasy';
const speech = new SpeakEasy({
  provider: 'openai',
  openaiVoice: 'nova',
  rate: 180,
});
await speech.speak('Hello world!');
```

### In Your Projects

```typescript
// notifications.ts
import { say } from 'speakeasy';

export async function speakNotification(message: string, project: string) {
  await say(`In ${project}, ${message}`, { priority: 'high' });
}
```

### Convenience
- `say('text')` - One-liner with system voice
- `say('text', 'openai' | 'elevenlabs' | 'groq')` - One-liner with provider
- `speak('text', options)` - Full featured with options
- `new SpeakEasy()` - Full control

## Examples

```bash
npm run example
```

## Testing

```bash
npm run build
npm test
```