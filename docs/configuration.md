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
      "voice": "nova",
      "model": "tts-1",
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
      "voice": "nova",
      "model": "tts-1",
      "apiKey": "gsk_..."
    }
  }
}
```

**Configuration options:**
- `voice`: Compatible with OpenAI voice names
- `model`: TTS model selection
- `apiKey`: Groq API key (or use `GROQ_API_KEY` env var)

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