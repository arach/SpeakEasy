# SpeakEasy 🎤

A unified speech library for all your projects with support for multiple TTS providers and clean configuration structure.

## Features

- **Multiple TTS Providers**: System (macOS), OpenAI, ElevenLabs, Groq
- **Smart Caching**: Caches generated audio for faster subsequent requests
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

SpeakEasy uses a clean nested configuration structure in `~/.config/speakeasy/settings.json`:

```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "voice": "nova",
      "model": "tts-1",
      "apiKey": "sk-..."
    },
    "elevenlabs": {
      "enabled": true,
      "voiceId": "EXAVITQu4vr4xnSDxMaL",
      "apiKey": "sk-..."
    },
    "system": {
      "enabled": true,
      "voice": "Samantha"
    },
    "groq": {
      "enabled": true,
      "voice": "onyx",
      "model": "tts-1-hd",
      "apiKey": "gsk-..."
    }
  },
  "defaults": {
    "provider": "groq",
    "fallbackOrder": ["groq", "openai", "elevenlabs", "system"],
    "rate": 180
  },
  "global": {
    "tempDir": "/tmp",
    "cleanup": true
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

### Caching
- **Enabled by default** for OpenAI, ElevenLabs, and Groq providers
- **Declarative TTL**: Configure with simple strings like `"7d"`, `"1h"`, `"30m"`
- **Declarative max size**: Configure with strings like `"100mb"`, `"1gb"`
- **Storage location**: `/tmp/speakeasy-cache/` by default

### Convenience
- `say('text')` - One-liner with system voice and caching
- `say('text', 'openai' | 'elevenlabs' | 'groq')` - One-liner with provider and caching
- `say('text', provider, false)` - Disable caching for specific call
- `speak('text', options, false)` - Full featured with caching control

## Examples

```bash
npm run example
```

## Declarative Caching Configuration

```typescript
import { SpeakEasy } from 'speakeasy';

// Simple declarative configuration
const speaker = new SpeakEasy({
  provider: 'openai',
  cache: {
    enabled: true,        // default: true
    ttl: '7d',           // 7 days - '1h', '30m', '1w', '1M', etc.
    maxSize: '100mb',    // '1gb', '500mb', etc.
    dir: '/tmp/my-cache' // custom directory
  }
});

// Using global config
// ~/.config/speakeasy/settings.json
{
  "cache": {
    "enabled": true,
    "ttl": "1d",
    "maxSize": "500mb"
  }
}
```

## Testing

```bash
npm run build
npm test
npm test cache  # Test caching specifically
```