# SpeakEasy 🎤

A unified speech library for all your projects with support for multiple TTS providers and clean configuration structure.

## ✨ Key Features

### 🚀 **Intelligent Caching System**
- **16x faster** repeated playback with SQLite-based cache
- Automatic cache management with TTL and size limits
- Content-aware deduplication prevents redundant API calls
- Comprehensive analytics and cache inspection tools

### ⚙️ **Centralized Configuration** 
- **Single config file** at `~/.config/speakeasy/settings.json`
- **No more scattered API keys** - configure once, use everywhere
- Global defaults with per-call overrides
- Environment variable integration

### 🎯 **Core Capabilities**
- **Multiple TTS Providers**: System (macOS), OpenAI, ElevenLabs, Groq
- **Smart Fallbacks**: Automatic provider switching on failure
- **Volume Control**: Precise control without affecting system volume
- **Queue Management**: Priority-based speech queue with interruption
- **TypeScript**: Full type safety and IntelliSense support

### 🎧 **Demo**
Listen to SpeakEasy in action: [welcome-demo.mp3](examples/welcome-demo.mp3)

*Generated with: `speakeasy "Welcome to SpeakEasy! This unified text-to-speech service makes it easy to add voice to your applications" --provider openai --voice nova --rate 185 --out welcome-demo.mp3`*

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

## 🏃‍♂️ Performance Impact

**Caching makes a dramatic difference:**

| Provider | Without Cache | With Cache | Speedup |
|----------|---------------|------------|---------|
| OpenAI | ~800ms | ~50ms | **16x faster** |
| ElevenLabs | ~1200ms | ~50ms | **24x faster** |
| Groq | ~400ms | ~50ms | **8x faster** |

*Cache automatically enabled for API providers when keys are present.*

## Configuration

**Stop copying API keys everywhere.** SpeakEasy uses a single, clean configuration file:

**`~/.config/speakeasy/settings.json`**

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
    "rate": 180,
    "volume": 0.7
  },
  "global": {
    "tempDir": "/tmp",
    "cleanup": true
  }
}
```

**✅ Configure once, use everywhere**  
**✅ No more environment variables in every project**  
**✅ Secure API key storage with proper permissions**

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

// Full featured with volume control
await speak('Hello world!', { priority: 'high', volume: 0.5 });
await speak('Hello!', { provider: 'openai', priority: 'high', volume: 0.8 });

// Custom configuration
import { SpeakEasy } from 'speakeasy';
const speech = new SpeakEasy({
  provider: 'openai',
  openaiVoice: 'nova',
  rate: 180,
  volume: 0.6, // 60% volume
});
await speech.speak('Hello world!');
```

### In Your Projects

```typescript
// notifications.ts
import { say } from 'speakeasy';

export async function speakNotification(message: string, project: string) {
  await say(`In ${project}, ${message}`, { priority: 'high', volume: 0.8 });
}
```

### Volume Control

SpeakEasy provides granular volume control (0.0-1.0) that only affects speech playback without changing your system volume:

```typescript
import { say, speak, SpeakEasy } from 'speakeasy';

// Quick volume control
await say('Quiet message', 'openai', { volume: 0.3 });     // 30% volume
await say('Normal message', 'system', { volume: 0.7 });    // 70% volume (default)
await say('Loud message', 'elevenlabs', { volume: 1.0 });  // 100% volume

// With speak function
await speak('Custom volume', { provider: 'groq', volume: 0.5 });

// Class instance with default volume
const quietSpeaker = new SpeakEasy({
  provider: 'openai',
  volume: 0.4  // All speech will be at 40% volume by default
});
await quietSpeaker.speak('This will be quiet');
await quietSpeaker.speak('This too', { volume: 0.9 }); // Override to 90%
```

**Volume Features:**
- ✅ **Isolated**: Only affects SpeakEasy audio, never changes system volume
- ✅ **Provider-agnostic**: Works with system voices, OpenAI, ElevenLabs, and Groq
- ✅ **Global config**: Set default volume in `~/.config/speakeasy/settings.json`
- ✅ **Per-call override**: Specify volume for individual speech requests
- ✅ **Debug visibility**: Shows current volume percentage in debug mode

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

# Volume control
speakeasy "Quiet message" --volume 0.3
speakeasy "Loud message" --provider openai --volume 0.9 --voice nova

# Save to file (plays audio AND saves file)
speakeasy "Welcome message" --out welcome.mp3
speakeasy "Notification" --provider openai --voice nova --out notification.mp3

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

# Example output:
📋 Cache Entries (1)
═══════════════════════

1. 8c957870-4741-5394-a0ed-b3db062d3ec3
   Text: "Hello world"
   Provider: openai
   Voice: nova
   Size: 15.5 KB
   Created: 2025-07-26, 2:09:57 p.m.
   File: 8c957870-4741-5394-a0ed-b3db062d3ec3.mp3
   Model: tts-1

💡 Use --id KEY to see full details, --play KEY to play audio

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