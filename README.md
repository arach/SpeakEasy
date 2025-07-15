# Speakeasy 🎤

A unified speech library for all your projects with support for multiple TTS providers.

## Features

- **Multiple TTS Providers**: System (macOS), OpenAI, ElevenLabs
- **Smart Fallbacks**: Automatically falls back to system voice if API fails
- **Queue Management**: Handles multiple speech requests with priority
- **Text Cleaning**: Removes emojis and normalizes text for better speech
- **TypeScript**: Full type safety

## Installation

```bash
cd /Users/arach/dev/speech-service
npm install
npm run build
```

## Global Configuration

Set up a global config file to avoid managing API keys in each project:

```bash
# Create config directory
mkdir -p ~/.config/speech

# Copy sample config
cp ~/.config/speech/config.json.sample ~/.config/speech/config.json

# Edit with your API keys
nano ~/.config/speech/config.json
```

### Global Config Format

Create `~/.config/speech/config.json`:

```json
{
  "provider": "openai",
  "openaiVoice": "nova",
  "rate": 180,
  "apiKeys": {
    "openai": "your-openai-api-key",
    "elevenlabs": "your-elevenlabs-api-key"
  }
}
```

Configuration priority (highest to lowest):
1. Constructor parameters
2. Global config file (`~/.config/speech/config.json`)
3. Environment variables
4. Built-in defaults

## Usage

### Basic Usage

```typescript
import { SpeechService, createSpeechService } from '@arach/speakeasy';

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
import { createSpeechService } from '@arach/speakeasy';

const speech = createSpeechService.forNotifications();

export async function speakNotification(message: string, project: string) {
  await speech.speak(`In ${project}, ${message}`, { priority: 'high' });
}
```

### Configuration

```typescript
const speech = new SpeechService({
  provider: 'openai',           // 'system' | 'openai' | 'elevenlabs'
  openaiVoice: 'nova',          // OpenAI voice
  elevenlabsVoiceId: 'voice_id', // ElevenLabs voice ID
  rate: 180,                    // Speech rate (words per minute)
  apiKeys: {
    openai: 'your-key',
    elevenlabs: 'your-key',
  },
});
```

### Environment Variables

```bash
export OPENAI_API_KEY=your_openai_key
export ELEVENLABS_API_KEY=your_elevenlabs_key
```

## API

### `speak(text: string, options?: SpeechOptions)`

Speak text with optional configuration:

```typescript
await speech.speak('Hello!', {
  priority: 'high',    // 'high' | 'normal' | 'low'
  interrupt: true,     // Interrupt current speech
  cleanup: true,       // Clean up temp files
});
```

### Factory Functions

- `createSpeechService.forNotifications()` - OpenAI Nova voice
- `createSpeechService.forDevelopment()` - System Samantha voice  
- `createSpeechService.forProduction()` - ElevenLabs Bella voice

## Examples

Try the built-in examples:

```bash
npm run example
```

This will demonstrate:
- Factory functions with global config
- Custom configuration
- Queue management with priorities
- Different TTS providers

## Testing

```bash
npm run build
npm test
```