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
import { createSpeechService } from 'speakeasy';

const speech = createSpeechService.forNotifications();
await speech.speak('Hello world!');
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
import { SpeechService, createSpeechService } from 'speakeasy';

// Use pre-configured instances
const speech = createSpeechService.forNotifications();
await speech.speak('Hello world!');

// Or create custom instance
const customSpeech = new SpeechService({
  provider: 'openai',
  openaiVoice: 'nova',
  rate: 180,
});
```

### In Your Projects

```typescript
// notifications.ts
import { createSpeechService } from 'speakeasy';

const speech = createSpeechService.forNotifications();

export async function speakNotification(message: string, project: string) {
  await speech.speak(`In ${project}, ${message}`, { priority: 'high' });
}
```

### Factory Functions

- `createSpeechService.forNotifications()` - Best available provider
- `createSpeechService.forDevelopment()` - System voice
- `createSpeechService.forProduction()` - ElevenLabs voice

## Examples

```bash
npm run example
```

## Testing

```bash
npm run build
npm test
```