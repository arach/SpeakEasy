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
- **Auto-enabled** when API keys are present (OpenAI, ElevenLabs, Groq)
- **Deterministic UUID keys** - Same text+provider+voice+rate = identical cache key
- **Collision-resistant** - Uses UUID v5 with deterministic construction
- **Disabled for system voice** (macOS `say` command) - no benefit for local TTS
- **Declarative TTL**: Configure with simple strings like `"7d"`, `"1h"`, `"30m"`
- **Declarative max size**: Configure with strings like `"100mb"`, `"1gb"`
- **Storage location**: `/tmp/speakeasy-cache/` by default

**Cache Key Construction:**
```
UUID = SHA1(text|provider|voice|rate + namespace) → UUID v5
```
**Identical inputs always hit the same cache entry**

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
    enabled: true,        // auto: true when API keys present, false for system
    ttl: '7d',           // 7 days - '1h', '30m', '1w', '1M', etc.
    maxSize: '100mb',    // '1gb', '500mb', etc.
    dir: '/tmp/my-cache' // custom directory
  }
});

// Using global config
// ~/.config/speakeasy/settings.json
{
  "cache": {
    "enabled": true,     // auto-enabled when API keys present
    "ttl": "1d",
    "maxSize": "500mb"
  }
}
```

## CLI Usage

Install globally for command-line access:

```bash
npm install -g speakeasy

# Basic usage
speakeasy "Hello world"
speakeasy --text "Hello from CLI" --provider openai --voice nova

# With caching
speakeasy --cache --text "Hello cached world"

# Cache management
speakeasy --cache --list
speakeasy --cache --find "hello"
speakeasy --cache --provider openai
speakeasy --clear-cache
speakeasy --config

# Diagnostics and health checks
speakeasy --diagnose          # Show configuration diagnostics
speakeasy --doctor           # Run comprehensive health check on config
speakeasy --debug "test"     # Run with debug logging

# List all available voices
speakeasy --help
```

## Cache Inspection

### Programmatic
```typescript
const speaker = new SpeakEasy({ cache: { enabled: true } });

// Get all cached entries
const metadata = await speaker.getCacheMetadata();
console.log(metadata);

// Find by text
const found = await speaker.findByText('hello world');

// Find by provider
const openaiEntries = await speaker.findByProvider('openai');
```

### CLI
```bash
# List all cached entries
speakeasy --cache --list

# Search by text
speakeasy --cache --find "hello"

# Filter by provider
speakeasy --cache --provider openai

# Show cache stats
speakeasy --cache --stats
```

## Diagnostics and Health Checks

SpeakEasy includes comprehensive diagnostic tools to help troubleshoot configuration issues:

### CLI Health Check
```bash
# Quick health check of your configuration
speakeasy --doctor

# Detailed configuration diagnostics
speakeasy --diagnose

# Debug mode with detailed logging
speakeasy --debug "test message"
```

### Health Check Features
- **System compatibility** (macOS detection, required commands)
- **Configuration file validation** (JSON syntax, permissions)
- **API key detection** (both config file and environment variables)
- **Voice configuration** (provider-specific settings)
- **Cache configuration** (directory permissions, TTL settings)
- **Actionable fixes** (specific commands to resolve issues)

### Example Output
```bash
$ speakeasy --doctor
🏥 Speakeasy Configuration Health Check

🔍 System Compatibility:
   ✅ macOS detected - system voice support available
   ✅ `say` command available
   ✅ `afplay` command available

🔧 Configuration Health:
   ✅ Config file exists
   ✅ Config file is valid JSON
   ✅ Config directory permissions OK

🔑 API Key Configuration:
   ✅ OpenAI: Configured via environment
   ❌ ElevenLabs: Not configured
   ✅ Groq: Configured in file

🎙️  Voice Configuration:
   system: Samantha
   openai: nova
   elevenlabs: EXAVITQu4vr4xnSDxMaL
   groq: nova

📦 Cache Configuration:
   ✅ Cache enabled
   📁 Cache dir: /tmp/speakeasy-cache
   ✅ Cache directory accessible

📋 Health Summary:
   🎉 All checks passed! Speakeasy is healthy.
```

## Testing

```bash
npm run build
npm test
npm test cache  # Test caching specifically
npm run cli -- --help  # Test CLI
npm run cli -- --doctor  # Test health check
```