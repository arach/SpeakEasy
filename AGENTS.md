# speakeasy

> Unified text-to-speech library with multi-provider support

## Critical Context

**IMPORTANT:** Read these rules before making any changes:

- macOS only - uses `say` command and `afplay` for audio playback
- ElevenLabs requires voice IDs (e.g., EXAVITQu4vr4xnSDxMaL), NOT voice names
- Groq uses Orpheus model (canopylabs/orpheus-v1-english) with voices: tara, leah, jess, mia, zoe, leo, dan, zac
- Groq requires accepting model terms at console.groq.com before first use
- Cache is auto-enabled for API providers when keys are present
- Cache uses built-in SQLite (`node:sqlite` / `bun:sqlite`) — no native addons
- Use pnpm for package management

## Project Structure

| Component | Path | Purpose |
|-----------|------|---------|
| Source | `src/` | |
| Providers | `src/providers/` | |
| CLI | `src/bin/speakeasy-cli.ts` | |
| Types | `src/types.ts` | |
| Config | `src/cli/config.ts` | |

## Quick Navigation

- Working with **src/providers/***? → Each provider implements the Provider interface from types.ts
- Working with **src/bin/***? → CLI entry point using commander.js
- Working with ***.test.ts**? → Tests use manual testing - run npm test

## Overview

> Introduction to the project

# Overview

Welcome to **speakeasy**.

SpeakEasy - Unified text-to-speech service with provider abstraction

## What is speakeasy?

Describe what your project does and why it exists.

## Key Features

- Feature 1
- Feature 2
- Feature 3

## Quick Links

- [Quickstart](./quickstart.md) - Get started in 5 minutes
- [Configuration](./configuration.md) - Setup options
- [API Reference](./api.md) - Full API documentation

## Quickstart

> Get started in 5 minutes

# Quickstart

Get up and running with **speakeasy** in under 5 minutes.

## Prerequisites

List any requirements:

- Node.js >= 22.5 (built-in SQLite) or Bun >= 1.0
- pnpm (recommended)

## Installation

```bash
# Install via pnpm
pnpm add speakeasy

# Or npm
npm install speakeasy
```

## Basic Usage

```typescript
// Example code
import { something } from 'speakeasy'

// Use it
something()
```

## Next Steps

- Read the [Configuration](./configuration.md) guide
- Explore the [API Reference](./api.md)

## Providers

# Providers Guide

Comprehensive documentation for all SpeakEasy TTS providers, including setup, configuration, and provider-specific features.

## Overview

SpeakEasy supports five TTS providers, each with unique characteristics:

| Provider | Type | API Key Required | Voices | Quality | Speed |
|----------|------|------------------|---------|---------|-------|
| **System** | Built-in | ❌ No | macOS voices | Good | Fast |
| **OpenAI** | API | ✅ Yes | 6 voices | High | Medium |
| **ElevenLabs** | API | ✅ Yes | Custom | Very High | Medium |
| **Groq** | API | ✅ Yes | 6 voices | High | Very Fast |
| **Gemini** | API | ✅ Yes | Multiple | High | Fast |

## System Voice (macOS)

### Overview
- **Built-in**: Uses macOS `say` command
- **No API key**: Works immediately on macOS
- **Direct file generation**: Creates `.aiff` files then plays with `afplay`
- **Volume control**: Isolated from system volume

### Configuration

**Global config:**
```json
{
  "providers": {
    "system": {
      "enabled": true,
      "voice": "Samantha"
    }
  }
}
```

**SDK usage:**
```typescript
const speaker = new SpeakEasy({
  provider: 'system',
  systemVoice: 'Samantha',
  rate: 180,
  volume: 0.7
});
```

**CLI usage:**
```bash
speakeasy "Hello world" --provider system --voice Samantha --rate 200
```

### Available Voices

**Popular voices:**
- `Samantha` - Default female voice (US English)
- `Alex` - Male voice (US English)
- `Victoria` - Female voice (US English)
- `Daniel` - Male voice (British English)
- `Karen` - Female voice (Australian English)
- `Moira` - Female voice (Irish English)
- `Tessa` - Female voice (South African English)

**List all voices:**
```bash
say -v ?
```

### Rate Control

System voice uses direct WPM (words per minute) control:
- **Range**: 80-400 WPM
- **Default**: 180 WPM
- **Implementation**: Direct `say -r` parameter

```bash
# Slow speech
speakeasy "Slow speech" --provider system --rate 120

# Fast speech  
speakeasy "Fast speech" --provider system --rate 250
```

### Advantages
- ✅ **No API key** required
- ✅ **Fast response** (no network calls)
- ✅ **Reliable** (always available on macOS)
- ✅ **Good quality** built-in voices
- ✅ **No caching needed** (already fast)

### Limitations
- ❌ **macOS only** (requires `say` command)
- ❌ **Limited voices** compared to API providers
- ❌ **No custom voices**

## OpenAI TTS

### Overview
- **API-based**: Uses OpenAI TTS-1 model
- **High quality**: Neural text-to-speech
- **6 voices**: Diverse voice options
- **Caching enabled**: Automatic for repeated text

### Setup

**API key required:**
```bash
export OPENAI_API_KEY="sk-..."
```

**Global config:**
```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "voice": "nova",
      "model": "tts-1",
      "apiKey": "sk-..."
    }
  }
}
```

### Available Voices

| Voice | Description | Characteristics |
|-------|-------------|-----------------|
| `alloy` | Neutral | Balanced, professional |
| `echo` | Male | Clear, authoritative |
| `fable` | Expressive | Storytelling, engaging |
| `onyx` | Deep Male | Rich, commanding |
| `nova` | Female | Warm, friendly (default) |
| `shimmer` | Bright Female | Energetic, upbeat |

### Usage Examples

**SDK:**
```typescript
const speaker = new SpeakEasy({
  provider: 'openai',
  openaiVoice: 'nova',
  rate: 200,
  apiKeys: {
    openai: process.env.OPENAI_API_KEY
  }
});

await speaker.speak('Hello from OpenAI TTS');
```

**CLI:**
```bash
speakeasy "Hello world" --provider openai --voice nova
speakeasy "Professional voice" --provider openai --voice alloy --rate 180
```

### Rate Control

OpenAI uses a `speed` parameter (0.25-4.0), converted from WPM:

**Conversion formula:**
```
speed = rate / 200
```

**Examples:**
- 100 WPM → 0.5 speed
- 200 WPM → 1.0 speed (normal)
- 400 WPM → 2.0 speed

**Rate bounds:** 50-800 WPM (0.25-4.0 speed)

### Models

- **tts-1**: Standard quality, faster generation
- **tts-1-hd**: Higher quality, slower generation

```json
{
  "providers": {
    "openai": {
      "model": "tts-1-hd"
    }
  }
}
```

### Advantages
- ✅ **High quality** neural voices
- ✅ **Diverse voices** with distinct characteristics
- ✅ **Reliable API** with good uptime
- ✅ **Automatic caching** for repeated text
- ✅ **Wide platform support**

### Limitations
- ❌ **API key required** (paid service)
- ❌ **Network dependent** (can fail offline)
- ❌ **Rate limits** (API quotas)
- ❌ **No custom voices** (fixed set of 6)

### Error Handling

```typescript
try {
  await say('Hello', 'openai');
} catch (error) {
  if (error.message.includes('API key')) {
    console.error('Set OPENAI_API_KEY environment variable');
  } else if (error.message.includes('rate limit')) {
    console.error('API rate limit exceeded');
  }
}
```

## ElevenLabs

### Overview
- **Premium quality**: Advanced voice synthesis
- **Custom voices**: Create and clone voices
- **Emotional control**: Stability and similarity settings
- **Professional grade**: Highest quality output

### Setup

**API key required:**
```bash
export ELEVENLABS_API_KEY="..."
```

**Global config:**
```json
{
  "providers": {
    "elevenlabs": {
      "enabled": true,
      "voiceId": "EXAVITQu4vr4xnSDxMaL",
      "modelId": "eleven_monolingual_v1",
      "apiKey": "..."
    }
  }
}
```

### Voice Configuration

> **Important**: ElevenLabs requires **voice IDs**, not voice names. Using a name like `nova` will result in a 404 error. You must use the actual voice ID (e.g., `EXAVITQu4vr4xnSDxMaL`).

**Default voice ID:**
```json
{
  "providers": {
    "elevenlabs": {
      "voiceId": "EXAVITQu4vr4xnSDxMaL"
    }
  }
}
```

**Custom voice ID:**
```bash
speakeasy "Hello" --provider elevenlabs --voice "EXAVITQu4vr4xnSDxMaL"
```

### Usage Examples

**SDK:**
```typescript
const speaker = new SpeakEasy({
  provider: 'elevenlabs',
  elevenlabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
  rate: 180,
  apiKeys: {
    elevenlabs: process.env.ELEVENLABS_API_KEY
  }
});
```

**CLI:**
```bash
speakeasy "Premium voice" --provider elevenlabs
speakeasy "Custom voice" --provider elevenlabs --voice "custom-voice-id"
```

### Rate Control

ElevenLabs doesn't have a direct rate parameter. Rate control is simulated through:
- Text preprocessing
- Punctuation insertion for pacing
- Future: API-level rate control when available

### Available Models

- `eleven_monolingual_v1` - English optimized
- `eleven_multilingual_v1` - Multiple languages
- `eleven_multilingual_v2` - Latest multilingual

### Advantages
- ✅ **Highest quality** voices available
- ✅ **Custom voice cloning** capability
- ✅ **Emotional expression** controls
- ✅ **Professional results** for production use
- ✅ **Multiple languages** support

### Limitations
- ❌ **Most expensive** provider
- ❌ **Custom voice ID required** (not human-readable names)
- ❌ **Limited rate control** (no native speed parameter)
- ❌ **Higher latency** due to processing complexity

### Finding Voice IDs

**ElevenLabs Dashboard:**
1. Go to https://elevenlabs.io/app/voice-lab
2. Select voice
3. Copy voice ID from URL or settings

**Voice ID format:**
```
EXAVITQu4vr4xnSDxMaL  // Example format
```

## Groq

### Overview
- **Fast inference**: Optimized for speed using Groq's LPU hardware
- **Orpheus TTS**: Uses Canopy Labs' Orpheus model for expressive speech
- **Cost effective**: Competitive pricing ($22/1M characters)
- **High performance**: Up to 100 characters/second generation

### Setup

**API key required:**
```bash
export GROQ_API_KEY="gsk_..."
```

> **Note**: You must accept the model terms at https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english before first use.

**Global config:**
```json
{
  "providers": {
    "groq": {
      "enabled": true,
      "voice": "tara",
      "apiKey": "gsk_..."
    }
  }
}
```

### Available Voices

Groq uses Canopy Labs' Orpheus model with 8 English voices:

| Voice | Description |
|-------|-------------|
| `tara` | Default female voice (recommended) |
| `leah` | Female voice |
| `jess` | Female voice |
| `mia` | Female voice |
| `zoe` | Female voice |
| `leo` | Male voice |
| `dan` | Male voice |
| `zac` | Male voice |

### Usage Examples

**SDK:**
```typescript
const speaker = new SpeakEasy({
  provider: 'groq',
  groqVoice: 'tara',
  apiKeys: {
    groq: process.env.GROQ_API_KEY
  }
});
```

**CLI:**
```bash
speakeasy "Fast generation" --provider groq --voice tara
speakeasy "Male voice" --provider groq --voice leo
```

### Model Details

- **Model**: `canopylabs/orpheus-v1-english`
- **Character limit**: 200 characters per request
- **Output format**: Audio streamed as response

### Advantages
- ✅ **Very fast** inference on Groq LPU hardware
- ✅ **Cost effective** ($22/1M characters)
- ✅ **Expressive voices** with natural prosody
- ✅ **Good quality** output
- ✅ **8 distinct voices** to choose from

### Limitations
- ❌ **API key required**
- ❌ **Terms acceptance required** before first use
- ❌ **200 character limit** per request
- ❌ **English only** (Arabic available via separate model)

## Gemini TTS

### Overview
- **Google's TTS**: Advanced neural text-to-speech
- **Multiple voices**: Diverse voice options including Puck, Kore, Charon, and more
- **High quality**: Neural voice synthesis
- **Model options**: Flash and Pro variants available

### Setup

**API key required:**
```bash
export GEMINI_API_KEY="AIza..."
```

**Global config:**
```json
{
  "providers": {
    "gemini": {
      "enabled": true,
      "model": "gemini-2.5-flash-preview-tts",
      "apiKey": "AIza..."
    }
  }
}
```

### Available Models

| Model | Description | Notes |
|-------|-------------|-------|
| `gemini-2.5-flash-preview-tts` | Fast, efficient model | Recommended for most use cases |
| `gemini-2.5-pro-preview-tts` | Higher quality, slower | May have stricter rate limits |

### Available Voices

Gemini offers multiple voice options:
- `Puck` - Default voice, clear and friendly
- `Kore` - Alternative voice option
- `Charon` - Deeper voice variant
- Additional voices available through the API

### Usage Examples

**SDK:**
```typescript
const speaker = new SpeakEasy({
  provider: 'gemini',
  geminiModel: 'gemini-2.5-flash-preview-tts',
  rate: 180,
  apiKeys: {
    gemini: process.env.GEMINI_API_KEY
  }
});

await speaker.speak('Hello from Gemini TTS');
```

**CLI:**
```bash
speakeasy "Hello world" --provider gemini
speakeasy "Custom voice" --provider gemini --voice Puck
```

### Audio Format

Gemini returns audio in WAV format (L16 PCM), which is automatically handled by SpeakEasy. The cache system supports both WAV and MP3 formats transparently.

### Rate Control

Gemini uses the standard WPM rate control through text preprocessing and speech configuration.

### Advantages
- ✅ **Google's technology** - Backed by Google's AI infrastructure
- ✅ **Good quality** voices
- ✅ **Multiple voice options**
- ✅ **Fast generation** with Flash model
- ✅ **Automatic caching** for repeated text

### Limitations
- ❌ **API key required** (Google Cloud/AI Studio)
- ❌ **Rate limits** apply, especially for Pro model
- ❌ **Network dependent**
- ❌ **WAV format** (larger than MP3, but handled automatically)

### Error Handling

```typescript
try {
  await say('Hello', 'gemini');
} catch (error) {
  if (error.message.includes('API key')) {
    console.error('Set GEMINI_API_KEY environment variable');
  } else if (error.message.includes('Rate limit')) {
    console.error('Rate limit exceeded, try Flash model');
  }
}
```

## Provider Comparison

### Quality Ranking
1. **ElevenLabs** - Premium, custom voices
2. **OpenAI** - High quality, diverse voices
3. **Gemini** - High quality, Google's neural TTS
4. **Groq** - Good quality, fast generation
5. **System** - Good quality, built-in voices

### Speed Ranking
1. **System** - Instant (local)
2. **Groq** - Very fast API
3. **Gemini** - Fast (Flash model)
4. **OpenAI** - Medium speed API
5. **ElevenLabs** - Slower (high quality processing)

### Cost Ranking (Free to Expensive)
1. **System** - Free (built-in)
2. **Groq** - Cost effective
3. **Gemini** - Competitive pricing
4. **OpenAI** - Standard pricing
5. **ElevenLabs** - Premium pricing

## Fallback Strategy

### Automatic Fallbacks

SpeakEasy automatically falls back between providers:

```json
{
  "defaults": {
    "fallbackOrder": ["openai", "groq", "gemini", "system"]
  }
}
```

**Fallback triggers:**
- API key missing
- Network failure
- Rate limit exceeded
- Provider service down

### Custom Fallback

```typescript
async function reliableSpeech(text: string) {
  const providers = ['openai', 'elevenlabs', 'system'];
  
  for (const provider of providers) {
    try {
      await say(text, provider as any);
      return; // Success
    } catch (error) {
      console.warn(`${provider} failed, trying next...`);
    }
  }
  
  throw new Error('All providers failed');
}
```

## Provider Selection Guide

### Choose **System** when:
- ✅ macOS environment
- ✅ No API costs desired
- ✅ Fast, reliable speech needed
- ✅ Basic quality sufficient

### Choose **OpenAI** when:
- ✅ High quality needed
- ✅ Diverse voice options wanted
- ✅ Established API preferred
- ✅ Good documentation required

### Choose **ElevenLabs** when:
- ✅ Highest quality required
- ✅ Custom voices needed
- ✅ Professional production use
- ✅ Budget allows premium pricing

### Choose **Groq** when:
- ✅ Speed is critical
- ✅ Cost effectiveness important
- ✅ Good quality sufficient
- ✅ Fast iteration needed

### Choose **Gemini** when:
- ✅ Google ecosystem preferred
- ✅ High quality needed
- ✅ Multiple voice options wanted
- ✅ Fast generation with Flash model

## Troubleshooting Providers

### Common Issues

**System voice not working:**
```bash
# Check if say command exists
which say

# Test system voice directly
say "Hello world"

# Check voice availability
say -v ?
```

**API key issues:**
```bash
# Check environment variables
env | grep -i api_key

# Test API key format
echo $OPENAI_API_KEY | head -c 10  # Should show "sk-"
echo $GROQ_API_KEY | head -c 4     # Should show "gsk_"
```

**Network/API failures:**
```bash
# Test with debug mode
speakeasy "test" --provider openai --debug

# Try fallback providers
speakeasy "test" --provider system  # Always works on macOS
```

### Provider Health Check

```bash
# Run comprehensive diagnostics
speakeasy --doctor

# Provider-specific testing
speakeasy "test system" --provider system
speakeasy "test openai" --provider openai
speakeasy "test elevenlabs" --provider elevenlabs
speakeasy "test groq" --provider groq
speakeasy "test gemini" --provider gemini
```

For detailed configuration options, see [Configuration Guide](configuration.md).
For troubleshooting help, see [Troubleshooting Guide](troubleshooting.md).

## Configuration

# Configuration Guide

Complete configuration documentation for SpeakEasy, covering all available options for CLI, SDK, and global settings.

## Configuration Hierarchy

SpeakEasy uses a hierarchical configuration system with the following precedence (highest to lowest):

1. **Direct parameters** (SDK constructor, CLI flags)
2. **Environment variables** (`OPENAI_API_KEY`, etc.)
3. **Global configuration file** (`~/.config/speakeasy/settings.json`)
4. **Built-in defaults**

## Global Configuration File

### Location
- **Path**: `~/.config/speakeasy/settings.json`
- **Creation**: Auto-created on first use with API keys
- **Format**: JSON with nested structure

### Complete Configuration Schema

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
      "modelId": "eleven_monolingual_v1",
      "apiKey": "..."
    },
    "system": {
      "enabled": true,
      "voice": "Samantha"
    },
    "groq": {
      "enabled": true,
      "voice": "tara",
      "apiKey": "gsk_..."
    }
  },
  "defaults": {
    "provider": "system",
    "fallbackOrder": ["system", "openai", "elevenlabs", "groq"],
    "rate": 180,
    "volume": 0.7
  },
  "global": {
    "tempDir": "/tmp",
    "cleanup": true
  },
  "cache": {
    "enabled": true,
    "ttl": "7d",
    "maxSize": "100mb",
    "dir": "/tmp/speakeasy-cache"
  }
}
```

## Provider Configuration

### System Voice (macOS)

**Built-in voices** - No API key required

```json
{
  "providers": {
    "system": {
      "enabled": true,
      "voice": "Samantha"
    }
  }
}
```

**Available voices:**
- `Samantha` - Default female voice
- `Alex` - Male voice
- `Victoria` - Alternative female voice
- `Daniel` - British male voice
- `Karen` - Australian female voice
- `Moira` - Irish female voice
- `Tessa` - South African female voice
- And many more (use `say -v ?` to list all)

### OpenAI TTS

**API-based** - Requires OpenAI API key

```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "voice": "nova",
      "model": "tts-1",
      "apiKey": "sk-..."
    }
  }
}
```

**Configuration options:**
- `voice`: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`
- `model`: `tts-1` (fast), `tts-1-hd` (high quality)
- `apiKey`: OpenAI API key (or use `OPENAI_API_KEY` env var)

### ElevenLabs

**API-based** - Requires ElevenLabs API key

```json
{
  "providers": {
    "elevenlabs": {
      "enabled": true,
      "voiceId": "EXAVITQu4vr4xnSDxMaL",
      "modelId": "eleven_monolingual_v1",
      "apiKey": "..."
    }
  }
}
```

**Configuration options:**
- `voiceId`: Custom voice ID from ElevenLabs
- `modelId`: Model selection (see ElevenLabs docs)
- `apiKey`: ElevenLabs API key (or use `ELEVENLABS_API_KEY` env var)

### Groq

**API-based** - Requires Groq API key

```json
{
  "providers": {
    "groq": {
      "enabled": true,
      "voice": "tara",
      "apiKey": "gsk_..."
    }
  }
}
```

**Configuration options:**
- `voice`: Orpheus voice name (`tara`, `leah`, `jess`, `mia`, `zoe`, `leo`, `dan`, `zac`)
- `apiKey`: Groq API key (or use `GROQ_API_KEY` env var)

> **Note**: You must accept the model terms at Groq console before first use.

## Default Settings

### Provider Defaults

```json
{
  "defaults": {
    "provider": "system",
    "fallbackOrder": ["system", "openai", "elevenlabs", "groq"],
    "rate": 180,
    "volume": 0.7
  }
}
```

**Options:**
- `provider`: Default provider to use
- `fallbackOrder`: Provider fallback sequence on failure
- `rate`: Default speech rate in WPM (80-400)
- `volume`: Default volume level (0.0-1.0)

### Global Settings

```json
{
  "global": {
    "tempDir": "/tmp",
    "cleanup": true
  }
}
```

**Options:**
- `tempDir`: Directory for temporary audio files
- `cleanup`: Auto-delete temporary files after playback

## Cache Configuration

### Basic Cache Settings

```json
{
  "cache": {
    "enabled": true,
    "ttl": "7d",
    "maxSize": "100mb",
    "dir": "/tmp/speakeasy-cache"
  }
}
```

### Cache Options

#### TTL (Time To Live)
Automatic expiration of cache entries:

```json
{
  "cache": {
    "ttl": "7d"    // 7 days
    "ttl": "1h"    // 1 hour
    "ttl": "30m"   // 30 minutes
    "ttl": "1w"    // 1 week
    "ttl": "1M"    // 1 month
    "ttl": 86400   // 86400 seconds (1 day)
  }
}
```

#### Max Size
Cache size limits with automatic cleanup:

```json
{
  "cache": {
    "maxSize": "100mb"     // 100 megabytes
    "maxSize": "1gb"       // 1 gigabyte
    "maxSize": "500mb"     // 500 megabytes
    "maxSize": 104857600   // 100MB in bytes
  }
}
```

#### Directory
Custom cache location:

```json
{
  "cache": {
    "dir": "/tmp/speakeasy-cache",           // Default
    "dir": "~/.cache/speakeasy",             // User cache
    "dir": "/var/cache/speakeasy",           // System cache
    "dir": "/custom/path/to/cache"           // Custom path
  }
}
```

## Environment Variables

### API Keys
```bash
# OpenAI API key
export OPENAI_API_KEY="sk-..."

# ElevenLabs API key
export ELEVENLABS_API_KEY="..."

# Groq API key
export GROQ_API_KEY="gsk_..."
```

### Override Configuration
```bash
# Override temp directory
export SPEAKEASY_TEMP_DIR="/custom/temp"

# Override cache directory
export SPEAKEASY_CACHE_DIR="/custom/cache"

# Enable debug mode
export SPEAKEASY_DEBUG="true"
```

## SDK Configuration

### Constructor Configuration

```typescript
import { SpeakEasy } from '@arach/speakeasy';

const speaker = new SpeakEasy({
  // Provider selection
  provider: 'openai',
  
  // Voice configuration
  openaiVoice: 'nova',
  systemVoice: 'Samantha',
  elevenlabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
  
  // Speech parameters
  rate: 200,
  volume: 0.8,
  
  // API keys (optional if env vars set)
  apiKeys: {
    openai: process.env.OPENAI_API_KEY,
    elevenlabs: process.env.ELEVENLABS_API_KEY,
    groq: process.env.GROQ_API_KEY
  },
  
  // System settings
  tempDir: '/custom/temp',
  debug: true,
  
  // Cache configuration
  cache: {
    enabled: true,
    ttl: '1d',
    maxSize: '50mb',
    dir: '/custom/cache'
  }
});
```

### Runtime Configuration

```typescript
// Individual speech with custom options
await speaker.speak('Hello world', {
  priority: 'high',
  interrupt: true,
  cleanup: false
});
```

## CLI Configuration

### Command-line Overrides

```bash
# Override provider and voice
speakeasy "Hello" --provider openai --voice nova

# Override rate and volume
speakeasy "Hello" --rate 250 --volume 0.5

# Enable cache for this request
speakeasy "Hello" --cache --provider elevenlabs

# Debug mode
speakeasy "Hello" --debug
```

### Configuration Commands

```bash
# View current configuration
speakeasy --config

# Run configuration diagnostics
speakeasy --diagnose

# Health check with fixes
speakeasy --doctor
```

## Configuration Validation

### Automatic Validation

SpeakEasy automatically validates configuration on startup:

```bash
speakeasy --doctor
```

**Checks performed:**
- ✅ System compatibility (macOS, required commands)
- ✅ Configuration file syntax (valid JSON)
- ✅ API key presence and format
- ✅ Voice configuration validity
- ✅ Cache directory permissions
- ✅ TTL and size format validation

### Manual Validation

```typescript
import { SpeakEasy } from '@arach/speakeasy';

try {
  const speaker = new SpeakEasy({
    provider: 'openai',
    // Missing API key - will validate at runtime
  });
  
  await speaker.speak('Test');
} catch (error) {
  console.error('Configuration error:', error.message);
}
```

## Configuration Examples

### Development Setup

**File**: `~/.config/speakeasy/settings.json`
```json
{
  "providers": {
    "system": { "enabled": true, "voice": "Samantha" },
    "openai": { "enabled": true, "voice": "nova" }
  },
  "defaults": {
    "provider": "system",
    "fallbackOrder": ["system", "openai"],
    "rate": 180,
    "volume": 0.7
  },
  "cache": { "enabled": true, "ttl": "1h" }
}
```

**Environment**: `.env`
```bash
OPENAI_API_KEY=sk-your-key-here
SPEAKEASY_DEBUG=true
```

### Production Setup

```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "voice": "nova",
      "model": "tts-1-hd"
    },
    "elevenlabs": {
      "enabled": true,
      "voiceId": "professional-voice-id"
    },
    "system": {
      "enabled": true,
      "voice": "Samantha"
    }
  },
  "defaults": {
    "provider": "openai",
    "fallbackOrder": ["openai", "elevenlabs", "system"],
    "rate": 180,
    "volume": 0.8
  },
  "cache": {
    "enabled": true,
    "ttl": "7d",
    "maxSize": "500mb",
    "dir": "/var/cache/speakeasy"
  }
}
```

### Claude Code Integration

```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "voice": "nova"
    },
    "system": {
      "enabled": true,
      "voice": "Samantha"
    }
  },
  "defaults": {
    "provider": "openai",
    "fallbackOrder": ["openai", "system"],
    "rate": 180,
    "volume": 0.7
  },
  "cache": {
    "enabled": true,
    "ttl": "1d"
  }
}
```

## Troubleshooting Configuration

### Common Issues

**Configuration file not found**
```bash
# Create directory and basic config
mkdir -p ~/.config/speakeasy
echo '{"providers":{"system":{"enabled":true}}}' > ~/.config/speakeasy/settings.json
```

**Invalid JSON syntax**
```bash
# Validate JSON
speakeasy --diagnose
# Fix: Use proper JSON formatting, escape quotes
```

**API key not detected**
```bash
# Check environment variables
env | grep -i api_key

# Check configuration file
speakeasy --config

# Set environment variable
export OPENAI_API_KEY="your-key-here"
```

**Cache directory permissions**
```bash
# Fix permissions
chmod 755 ~/.cache/speakeasy
# Or use different directory
export SPEAKEASY_CACHE_DIR="/tmp/speakeasy-cache"
```

### Debug Configuration

```bash
# Enable debug mode
export SPEAKEASY_DEBUG=true
speakeasy "test configuration" --debug

# Detailed diagnostics
speakeasy --diagnose

# Health check
speakeasy --doctor
```

For provider-specific configuration details, see [Providers Guide](providers.md).
For cache-specific settings, see [Cache Guide](cache.md).

## Cli

# CLI Reference

Complete command-line interface documentation for SpeakEasy.

## Installation

```bash
npm install -g @arach/speakeasy
```

## Basic Usage

```bash
speakeasy "Hello, world!"
```

## Command Syntax

```bash
speakeasy [text] [options]
speakeasy --text "text" [options]
```

## Core Options

### Text Input
- `--text, -t "text"` - Text to speak (can also be positional argument)
- Example: `speakeasy --text "Hello world"` or `speakeasy "Hello world"`

### Provider Selection
- `--provider, -p <provider>` - Choose TTS provider
- Options: `system`, `openai`, `elevenlabs`, `groq`
- Default: `system` (or configured default)
- Example: `speakeasy "Hello" --provider openai`

### Voice Configuration
- `--voice, -v <voice>` - Select voice (provider-dependent)
- System voices: `Samantha`, `Alex`, `Victoria`, etc.
- OpenAI voices: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`
- ElevenLabs: Custom voice IDs (e.g., `EXAVITQu4vr4xnSDxMaL`) - not voice names!
- Groq voices: `tara`, `leah`, `jess`, `mia`, `zoe`, `leo`, `dan`, `zac`
- Example: `speakeasy "Hello" --provider openai --voice nova`

### Speech Control
- `--rate, -r <number>` - Speech rate in words per minute (WPM)
- Range: 80-400 WPM (provider-dependent)
- Default: 180 WPM
- Example: `speakeasy "Fast speech" --rate 250`

- `--volume <number>` - Volume level (0.0 to 1.0)
- Default: 0.7 (70%)
- Example: `speakeasy "Quiet" --volume 0.3`

- `--interrupt, -i` - Interrupt any currently playing speech
- Example: `speakeasy "Stop everything" --interrupt`

### File Output
- `--out <file>` - Save audio to file (in addition to playing)
- Automatically enables caching when used
- Example: `speakeasy "Welcome message" --out welcome.mp3`
- Example: `speakeasy "Notification" --provider openai --voice nova --out notification.mp3`

## Cache Management

### Basic Cache Operations
- `--cache, -c` - Enable caching for this request
- `--clear-cache` - Delete all cached audio files
- Example: `speakeasy "Cache this" --cache --provider openai`

### Cache Inspection
- `--list` - List all cached entries
- `--stats` - Show cache statistics
- `--recent <N>` - Show N most recent cache entries
- `--find "text"` - Search cache entries by text content
- `--id <cache-key>` - Show detailed info for specific cache entry
- `--play <cache-key>` - Play cached audio by ID

### Cache Examples
```bash
# List all cached entries
speakeasy --list

# Show cache statistics
speakeasy --stats

# Find entries containing "hello"
speakeasy --find "hello"

# Show details for specific entry
speakeasy --id abc123-def456

# Play cached audio directly
speakeasy --play abc123-def456

# Show 10 most recent entries
speakeasy --recent 10
```

## Configuration & Diagnostics

### Configuration Commands
- `--config` - Display current configuration file
- `--diagnose` - Show detailed configuration diagnostics
- `--doctor` - Run comprehensive health check

### Debug & Help
- `--debug, -d` - Enable debug logging
- `--help, -h` - Show help message

### Diagnostic Examples
```bash
# Quick health check
speakeasy --doctor

# Detailed configuration analysis
speakeasy --diagnose

# View current settings
speakeasy --config

# Debug a speech request
speakeasy "Test debug" --debug --provider openai
```

## Complete Examples

### Basic Usage
```bash
# System voice (default)
speakeasy "Hello world"

# Specific provider
speakeasy "Hello world" --provider openai

# With voice selection
speakeasy "Hello world" --provider openai --voice nova

# Custom rate and volume
speakeasy "Fast and quiet" --rate 250 --volume 0.4

# Save to file (plays AND saves)
speakeasy "Welcome message" --out welcome.mp3
speakeasy "Meeting reminder" --provider openai --voice nova --out reminder.mp3
```

### Provider-Specific Examples
```bash
# System voice with custom rate
speakeasy "macOS speech" --provider system --voice Samantha --rate 200

# OpenAI with caching
speakeasy "OpenAI speech" --provider openai --voice nova --cache

# ElevenLabs with custom voice
speakeasy "ElevenLabs speech" --provider elevenlabs --voice EXAVITQu4vr4xnSDxMaL

# Groq with high priority
speakeasy "Groq speech" --provider groq --voice tara --interrupt
```

### Cache Management Workflow
```bash
# Generate and cache audio
speakeasy "Important message" --provider openai --cache

# List to find the cache ID
speakeasy --list

# Play directly from cache
speakeasy --play abc123-def456

# Check cache statistics
speakeasy --stats

# Clean up when done
speakeasy --clear-cache
```

### Configuration Management
```bash
# Check if setup is working
speakeasy --doctor

# View current configuration
speakeasy --config

# Debug configuration issues
speakeasy --diagnose

# Test with debug output
speakeasy "Test configuration" --debug
```

## Exit Codes

- `0` - Success
- `1` - General error (missing text, invalid options, etc.)
- `2` - Configuration error (missing API keys, invalid config file)
- `3` - Provider error (API failure, network issues)

## Environment Variables

These environment variables are automatically detected:

```bash
export OPENAI_API_KEY="sk-..."
export ELEVENLABS_API_KEY="..."
export GROQ_API_KEY="gsk_..."
```

## Configuration File

The CLI uses the global configuration file at:
`~/.config/speakeasy/settings.json`

See [Configuration Guide](configuration.md) for detailed setup.

## Common Use Cases

### Development Notifications
```bash
# Build completion notification
speakeasy "Build completed successfully" --provider system

# Error alerts
speakeasy "Build failed with errors" --provider openai --voice nova --volume 0.8
```

### Claude Code Integration
```bash
# Permission requests
speakeasy "Claude needs your permission" --provider openai --voice nova

# Status updates
speakeasy "Task completed successfully" --provider system --rate 180
```

### Accessibility
```bash
# Screen reader text
speakeasy "Page loaded successfully" --provider elevenlabs --volume 0.6

# Navigation cues
speakeasy "Entering settings menu" --provider system --rate 200
```

## Troubleshooting

### Common Issues

**"No text provided to speak"**
```bash
# ❌ Missing text
speakeasy --provider openai

# ✅ Correct usage
speakeasy "Hello world" --provider openai
```

**"API key required"**
```bash
# Set environment variable
export OPENAI_API_KEY="your-key-here"

# Or use config file
speakeasy --config
```

**"Cache not enabled"**
```bash
# Enable cache explicitly
speakeasy "Text" --cache --provider openai

# Or check cache configuration
speakeasy --diagnose
```

### Getting Help

```bash
# Show help
speakeasy --help

# Run health check
speakeasy --doctor

# Debug mode
speakeasy "test" --debug
```

For more troubleshooting, see [Troubleshooting Guide](troubleshooting.md).

## Sdk

# SDK Guide

Complete TypeScript SDK documentation for SpeakEasy.

## Installation

```bash
npm install @arach/speakeasy
```

## Quick Start

```typescript
import { say, speak, SpeakEasy } from '@arach/speakeasy';

// One-liner with system voice
await say('Hello, world!');

// With specific provider
await say('Hello, world!', 'openai');

// Full configuration
const speaker = new SpeakEasy({
  provider: 'openai',
  openaiVoice: 'nova',
  rate: 180,
  cache: { enabled: true }
});

await speaker.speak('Hello, world!');
```

## Core Classes and Functions

### SpeakEasy Class

Main class for text-to-speech operations with full configuration control.

```typescript
class SpeakEasy {
  constructor(config?: SpeakEasyConfig)
  
  // Primary methods
  async speak(text: string, options?: SpeakEasyOptions): Promise<void>
  async interrupt(): Promise<void>
  
  // Queue management
  clearQueue(): void
  getQueueLength(): number
  
  // Cache operations
  async getCacheStats(): Promise<CacheStats>
}
```

#### Constructor Configuration

```typescript
interface SpeakEasyConfig {
  provider?: 'system' | 'openai' | 'elevenlabs' | 'groq';
  systemVoice?: string;
  openaiVoice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  elevenlabsVoiceId?: string;
  groqVoice?: string; // tara, leah, jess, mia, zoe, leo, dan, zac
  rate?: number;
  volume?: number;
  apiKeys?: {
    openai?: string;
    elevenlabs?: string;
    groq?: string;
  };
  tempDir?: string;
  debug?: boolean;
  cache?: {
    enabled?: boolean;
    ttl?: string | number; // '7d', '1h', 86400000, etc.
    maxSize?: string | number; // '100mb', '1gb', 104857600, etc.
    dir?: string;
  };
}
```

#### Speech Options

```typescript
interface SpeakEasyOptions {
  priority?: 'high' | 'normal' | 'low';
  interrupt?: boolean;
  cleanup?: boolean;
}
```

### Convenience Functions

#### say()
Simple one-liner function for quick text-to-speech.

```typescript
async function say(
  text: string, 
  provider?: 'system' | 'openai' | 'elevenlabs' | 'groq'
): Promise<void>
```

#### speak()
Enhanced function with full options support.

```typescript
async function speak(
  text: string,
  options?: SpeakEasyOptions & { provider?: string }
): Promise<void>
```

## Usage Examples

### Basic Usage

```typescript
import { say } from '@arach/speakeasy';

// System voice (macOS built-in)
await say('Hello from system voice');

// Specific providers
await say('Hello from OpenAI', 'openai');
await say('Hello from ElevenLabs', 'elevenlabs');
await say('Hello from Groq', 'groq');
```

### Class Instance

```typescript
import { SpeakEasy } from '@arach/speakeasy';

const speaker = new SpeakEasy({
  provider: 'openai',
  openaiVoice: 'nova',
  rate: 200,
  volume: 0.8,
  cache: { enabled: true }
});

await speaker.speak('Hello, world!');
await speaker.speak('High priority message', { priority: 'high' });
```

### Provider-Specific Configuration

#### System Voice (macOS)
```typescript
const systemSpeaker = new SpeakEasy({
  provider: 'system',
  systemVoice: 'Samantha', // or 'Alex', 'Victoria', etc.
  rate: 180,
  volume: 0.7
});

await systemSpeaker.speak('Using macOS built-in voice');
```

#### OpenAI TTS
```typescript
const openaiSpeaker = new SpeakEasy({
  provider: 'openai',
  openaiVoice: 'nova', // alloy, echo, fable, onyx, nova, shimmer
  rate: 200,
  apiKeys: {
    openai: process.env.OPENAI_API_KEY
  }
});

await openaiSpeaker.speak('Using OpenAI TTS-1 model');
```

#### ElevenLabs
```typescript
const elevenlabsSpeaker = new SpeakEasy({
  provider: 'elevenlabs',
  elevenlabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
  rate: 180,
  apiKeys: {
    elevenlabs: process.env.ELEVENLABS_API_KEY
  }
});

await elevenlabsSpeaker.speak('Using ElevenLabs voice synthesis');
```

#### Groq
```typescript
const groqSpeaker = new SpeakEasy({
  provider: 'groq',
  groqVoice: 'tara', // Options: tara, leah, jess, mia, zoe, leo, dan, zac
  apiKeys: {
    groq: process.env.GROQ_API_KEY
  }
});

await groqSpeaker.speak('Using Groq Orpheus TTS');
```

## Queue Management

SpeakEasy includes a priority-based queue system for managing multiple speech requests.

### Queue Priorities

```typescript
// High priority - plays immediately, interrupts current speech
await speaker.speak('Urgent alert!', { priority: 'high', interrupt: true });

// Normal priority - queued in order (default)
await speaker.speak('Regular message', { priority: 'normal' });

// Low priority - queued after normal priority items
await speaker.speak('Background info', { priority: 'low' });
```

### Queue Operations

```typescript
// Check queue status
const queueLength = speaker.getQueueLength();
console.log(`${queueLength} items in queue`);

// Clear all queued items
speaker.clearQueue();

// Interrupt current speech and clear queue
await speaker.interrupt();
```

## Cache System

### Automatic Caching

Cache is automatically enabled for API-based providers when API keys are present:

```typescript
const speaker = new SpeakEasy({
  provider: 'openai',
  apiKeys: { openai: process.env.OPENAI_API_KEY }
  // cache automatically enabled
});

// First call - generates and caches audio
await speaker.speak('Hello, world!');

// Second call - uses cached audio (much faster)
await speaker.speak('Hello, world!');
```

### Manual Cache Configuration

```typescript
const speaker = new SpeakEasy({
  provider: 'openai',
  cache: {
    enabled: true,
    ttl: '7d',        // 7 days
    maxSize: '100mb', // 100 megabytes
    dir: '/custom/cache/path'
  }
});
```

### Cache Operations

```typescript
// Get cache statistics
const stats = await speaker.getCacheStats();
console.log(`Cache has ${stats.totalEntries} entries`);
console.log(`Total size: ${stats.totalSize} bytes`);
console.log(`Hit rate: ${stats.hitRate * 100}%`);

// Cache is automatically managed - no manual operations needed
```

## Error Handling

### Try-Catch Pattern

```typescript
import { SpeakEasy } from '@arach/speakeasy';

const speaker = new SpeakEasy({ provider: 'openai' });

try {
  await speaker.speak('Hello, world!');
} catch (error) {
  console.error('Speech failed:', error.message);
  
  // Fallback to system voice
  const fallback = new SpeakEasy({ provider: 'system' });
  await fallback.speak('Fallback message');
}
```

### Common Error Types

```typescript
// API key missing
try {
  await say('Hello', 'openai');
} catch (error) {
  if (error.message.includes('API key')) {
    console.error('Set OPENAI_API_KEY environment variable');
  }
}

// Rate limit exceeded
try {
  await say('Hello', 'elevenlabs');
} catch (error) {
  if (error.message.includes('rate limit')) {
    console.error('Too many requests, try again later');
  }
}

// Network/provider issues
try {
  await say('Hello', 'openai');
} catch (error) {
  // Automatic fallback to system voice
  await say('Fallback message', 'system');
}
```

## Advanced Usage

### Multiple Speakers

```typescript
// Different speakers for different purposes
const alertSpeaker = new SpeakEasy({
  provider: 'openai',
  openaiVoice: 'nova',
  volume: 0.9,
  rate: 220
});

const infoSpeaker = new SpeakEasy({
  provider: 'system',
  systemVoice: 'Samantha',
  volume: 0.6,
  rate: 180
});

// Use appropriate speaker for context
await alertSpeaker.speak('Critical error occurred!', { priority: 'high' });
await infoSpeaker.speak('Process completed successfully');
```

### Notification System

```typescript
class NotificationSpeaker {
  private speaker: SpeakEasy;
  
  constructor() {
    this.speaker = new SpeakEasy({
      provider: 'openai',
      openaiVoice: 'nova',
      cache: { enabled: true }
    });
  }
  
  async success(message: string) {
    await this.speaker.speak(`Success: ${message}`, { priority: 'normal' });
  }
  
  async warning(message: string) {
    await this.speaker.speak(`Warning: ${message}`, { priority: 'high' });
  }
  
  async error(message: string) {
    await this.speaker.speak(`Error: ${message}`, { 
      priority: 'high', 
      interrupt: true 
    });
  }
}

// Usage
const notifications = new NotificationSpeaker();
await notifications.success('Build completed');
await notifications.error('Build failed');
```

### Claude Code Integration

```typescript
// Hooked notification handler
import { say } from '@arach/speakeasy';

export async function speakNotification(message: string, project: string) {
  // Customize message for speech
  const spokenMessage = `In ${project}, ${message}`;
  
  try {
    // Try OpenAI first, fallback to system
    await say(spokenMessage, 'openai');
  } catch (error) {
    await say(spokenMessage, 'system');
  }
}

// Usage in hooks
await speakNotification('Claude needs your permission', 'SpeakEasy');
await speakNotification('Build completed successfully', 'MyProject');
```

## TypeScript Types

### Complete Type Definitions

```typescript
// Main configuration interface
interface SpeakEasyConfig {
  provider?: 'system' | 'openai' | 'elevenlabs' | 'groq';
  systemVoice?: string;
  openaiVoice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  elevenlabsVoiceId?: string;
  groqVoice?: string; // tara, leah, jess, mia, zoe, leo, dan, zac
  rate?: number;
  volume?: number;
  apiKeys?: {
    openai?: string;
    elevenlabs?: string;
    groq?: string;
  };
  tempDir?: string;
  debug?: boolean;
  cache?: CacheConfig;
}

// Cache configuration
interface CacheConfig {
  enabled?: boolean;
  ttl?: string | number;
  maxSize?: string | number;
  dir?: string;
}

// Speech options
interface SpeakEasyOptions {
  priority?: 'high' | 'normal' | 'low';
  interrupt?: boolean;
  cleanup?: boolean;
}

// Cache statistics
interface CacheStats {
  totalEntries: number;
  totalSize: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  avgFileSize: number;
  dir?: string;
}
```

## Best Practices

### Configuration Management

```typescript
// Use environment variables for API keys
const speaker = new SpeakEasy({
  provider: 'openai',
  apiKeys: {
    openai: process.env.OPENAI_API_KEY,
    elevenlabs: process.env.ELEVENLABS_API_KEY
  }
});

// Use global config file for defaults
// ~/.config/speakeasy/settings.json handles fallbacks
```

### Performance Optimization

```typescript
// Enable caching for repeated text
const speaker = new SpeakEasy({
  provider: 'openai',
  cache: { enabled: true, ttl: '1d' }
});

// Reuse speaker instances
class AppNotifications {
  private static speaker = new SpeakEasy({
    provider: 'openai',
    cache: { enabled: true }
  });
  
  static async notify(message: string) {
    await this.speaker.speak(message);
  }
}
```

### Error Recovery

```typescript
// Graceful fallback pattern
async function reliableSpeech(text: string) {
  const providers = ['openai', 'elevenlabs', 'system'];
  
  for (const provider of providers) {
    try {
      await say(text, provider as any);
      return; // Success
    } catch (error) {
      console.warn(`${provider} failed:`, error.message);
      continue; // Try next provider
    }
  }
  
  throw new Error('All providers failed');
}
```

## Debugging

### Debug Mode

```typescript
const speaker = new SpeakEasy({
  provider: 'openai',
  debug: true // Enables detailed logging
});

await speaker.speak('Debug this message');
```

### Console Output in Debug Mode

```
🔍 SpeakEasy Debug: Using provider 'openai'
🔍 SpeakEasy Debug: Voice 'nova', Rate 180 WPM, Volume 70%
🔍 SpeakEasy Debug: Cache key: abc123-def456
📦 SpeakEasy Debug: Cache hit - using cached audio
🔊 SpeakEasy Debug: Playing audio from cache
```

For more advanced configuration options, see [Configuration Guide](configuration.md).

---
Generated by [Dewey](https://github.com/arach/dewey) | Last updated: 2026-01-27