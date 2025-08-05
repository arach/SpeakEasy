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

## Installation

```bash
npm install @arach/speakeasy
```

## Quick Start

```typescript
import { say } from '@arach/speakeasy';

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

## 📚 Documentation Index

### Quick Start
- **[CLI Reference](cli.md)** - Complete command-line documentation
- **[SDK Guide](sdk.md)** - TypeScript SDK usage and examples

### Configuration
- **[Configuration Guide](configuration.md)** - Complete configuration options
- **[Providers Guide](providers.md)** - Provider-specific setup and features
- **[Cache System](cache.md)** - Cache management and optimization

### Support
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions

## 🚀 Quick Navigation

### For Developers
1. **Start here:** [SDK Guide](sdk.md) - Learn the TypeScript API
2. **Configuration:** [Configuration Guide](configuration.md) - Set up API keys and defaults
3. **Providers:** [Providers Guide](providers.md) - Choose and configure TTS providers

### For CLI Users
1. **Start here:** [CLI Reference](cli.md) - Learn command-line usage
2. **Setup:** [Configuration Guide](configuration.md) - Configure global settings
3. **Troubleshooting:** [Troubleshooting](troubleshooting.md) - Fix common issues

### For System Administrators
1. **Configuration:** [Configuration Guide](configuration.md) - Global deployment settings
2. **Cache Management:** [Cache System](cache.md) - Optimize performance and storage
3. **Provider Setup:** [Providers Guide](providers.md) - API key management

## 📖 Feature Documentation

### Core Features
- **Multi-Provider Support** - System, OpenAI, ElevenLabs, Groq
- **Smart Caching** - SQLite-based cache with metadata
- **Queue Management** - Priority-based speech queue
- **Rate Control** - Customizable speech rate (WPM)
- **Volume Control** - Precise volume without affecting system
- **Auto Fallbacks** - Intelligent provider fallback on failure

### CLI Features
- **Global Configuration** - `~/.config/speakeasy/settings.json`
- **Cache Management** - List, search, play, and clear cached audio
- **Health Diagnostics** - `--doctor` and `--diagnose` commands
- **Debug Mode** - Detailed logging with `--debug`

### SDK Features  
- **TypeScript Support** - Full type safety and IntelliSense
- **Convenience Functions** - `say()` and `speak()` for quick usage
- **Class-based API** - `SpeakEasy` class for advanced control
- **Event Handling** - Promise-based async operations
- **Error Recovery** - Graceful fallback patterns

## 🛠️ API Reference

### CLI Commands Quick Reference

| Command | Description | Example |
|---------|-------------|---------|
| `speakeasy "text"` | Basic speech | `speakeasy "Hello world"` |
| `--provider <name>` | Choose provider | `--provider openai` |
| `--voice <voice>` | Select voice | `--voice nova` |
| `--rate <wpm>` | Set speech rate | `--rate 200` |
| `--volume <0-1>` | Set volume | `--volume 0.8` |
| `--cache` | Enable caching | `--cache` |
| `--list` | List cache entries | `--list` |
| `--stats` | Cache statistics | `--stats` |
| `--doctor` | Health check | `--doctor` |

### SDK Quick Reference

```typescript
// Quick functions
await say('Hello world');                    // System voice
await say('Hello world', 'openai');          // Specific provider

// Class usage
const speaker = new SpeakEasy({
  provider: 'openai',
  openaiVoice: 'nova',
  rate: 180,
  cache: { enabled: true }
});

await speaker.speak('Hello world');
```

## 🔧 Configuration Quick Reference

### Global Configuration File
**Location:** `~/.config/speakeasy/settings.json`

```json
{
  "providers": {
    "openai": { "enabled": true, "voice": "nova", "apiKey": "sk-..." },
    "elevenlabs": { "enabled": true, "voiceId": "...", "apiKey": "..." },
    "system": { "enabled": true, "voice": "Samantha" },
    "groq": { "enabled": true, "voice": "nova", "apiKey": "gsk_..." }
  },
  "defaults": {
    "provider": "system",
    "fallbackOrder": ["system", "openai", "elevenlabs"],
    "rate": 180,
    "volume": 0.7
  },
  "cache": {
    "enabled": true,
    "ttl": "7d",
    "maxSize": "100mb"
  }
}
```

### Environment Variables
```bash
export OPENAI_API_KEY="sk-..."
export ELEVENLABS_API_KEY="..."
export GROQ_API_KEY="gsk_..."
```

## 🎯 Use Case Examples

### Development Notifications
```bash
# Build completion
speakeasy "Build completed successfully" --provider system

# Error alerts  
speakeasy "Build failed with errors" --provider openai --voice nova
```

### Claude Code Integration
```typescript
import { say } from '@arach/speakeasy';

export async function speakNotification(message: string, project: string) {
  await say(`In ${project}, ${message}`, 'openai');
}
```

### Accessibility
```typescript
const speaker = new SpeakEasy({
  provider: 'elevenlabs',
  volume: 0.8,
  cache: { enabled: true }
});

await speaker.speak('Screen reader text', { priority: 'high' });
```

## 🔍 Troubleshooting Quick Fixes

### Common Issues
```bash
# API key missing
export OPENAI_API_KEY="your-key-here"

# Cache not working
speakeasy "test" --cache --provider openai

# System voice not working (non-macOS)
speakeasy "test" --provider openai

# Network issues
speakeasy "fallback" --provider system

# Configuration errors
speakeasy --doctor
```

## 📊 Performance Guide

### Cache Performance
- **OpenAI TTS:** ~800ms → ~50ms (16x faster with cache)
- **ElevenLabs:** ~1200ms → ~50ms (24x faster with cache)
- **System Voice:** ~100ms (no cache needed)

### Best Practices
- Enable caching for API providers
- Use consistent text for better cache hits
- Choose appropriate TTL for your use case
- Monitor cache size with `--stats`

## 🤝 Contributing

See the main [README](../README.md) for contribution guidelines.

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details.

---

**Need help?** Start with the [Troubleshooting Guide](troubleshooting.md) or run `speakeasy --doctor` for diagnostics.