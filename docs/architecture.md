# Architecture

## Overview

SpeakEasy is a unified text-to-speech library that abstracts multiple TTS providers behind a common interface. It runs on macOS and uses native audio playback.

## Directory Structure

```
speakeasy/
├── src/
│   ├── index.ts              # Main SpeakEasy class, exports
│   ├── types.ts              # TypeScript interfaces
│   ├── cache.ts              # SQLite-based audio cache (TTSCache)
│   ├── providers/            # TTS provider implementations
│   │   ├── system.ts         # macOS `say` command
│   │   ├── openai.ts         # OpenAI TTS API
│   │   ├── elevenlabs.ts     # ElevenLabs API
│   │   ├── groq.ts           # Groq Orpheus TTS
│   │   └── gemini.ts         # Google Gemini TTS
│   ├── bin/
│   │   └── speakeasy-cli.ts  # CLI entry point
│   └── cli/
│       ├── config.ts         # Config file management
│       ├── constants.ts      # Default values
│       ├── doctor.ts         # Health check logic
│       └── ui.ts             # CLI output formatting
├── docs/                     # Documentation
├── dist/                     # Compiled output (gitignored)
└── dewey.config.ts           # Dewey documentation config
```

## Core Components

### SpeakEasy Class (`src/index.ts`)

The main orchestrator that:
- Loads global config from `~/.config/speakeasy/settings.json`
- Initializes all provider instances
- Manages the speech queue with priority support
- Handles caching via TTSCache
- Provides fallback logic when providers fail

```
┌─────────────────────────────────────────────────────────┐
│                      SpeakEasy                          │
├─────────────────────────────────────────────────────────┤
│  config: SpeakEasyConfig                                │
│  providers: Map<string, Provider>                       │
│  cache: TTSCache                                        │
│  queue: Array<{text, options}>                          │
├─────────────────────────────────────────────────────────┤
│  speak(text, options) → Promise<void>                   │
│  stopSpeaking() → void                                  │
│  getCacheStats() → CacheStats                           │
└─────────────────────────────────────────────────────────┘
```

### Provider Interface (`src/types.ts`)

All providers implement:

```typescript
interface Provider {
  speak(config: ProviderConfig): Promise<void>;
  validateConfig(): boolean;
  getErrorMessage(error: any): string;
}
```

### Provider Flow

```
User Request
     │
     ▼
┌─────────────┐
│  SpeakEasy  │
│   .speak()  │
└──────┬──────┘
       │
       ▼
┌─────────────┐    Cache Hit?    ┌─────────────┐
│  TTSCache   │ ───────Yes────▶  │   afplay    │
│   lookup    │                  │  (playback) │
└──────┬──────┘                  └─────────────┘
       │ No
       ▼
┌─────────────┐
│  Provider   │
│ .speak() or │
│ .generate() │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Save to    │
│   Cache     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   afplay    │
│  (playback) │
└─────────────┘
```

## Provider Implementations

| Provider | API Endpoint | Model | Default Voice |
|----------|--------------|-------|---------------|
| System | macOS `say` | N/A | Samantha |
| OpenAI | `api.openai.com/v1/audio/speech` | tts-1 | nova |
| ElevenLabs | `api.elevenlabs.io/v1/text-to-speech/{voiceId}` | eleven_monolingual_v1 | EXAVITQu4vr4xnSDxMaL |
| Groq | `api.groq.com/openai/v1/audio/speech` | canopylabs/orpheus-v1-english | tara |
| Gemini | Google Generative AI SDK | gemini-2.5-flash-preview-tts | Puck |

## Caching System

The `TTSCache` class provides:
- SQLite-based metadata storage
- File-based audio storage in `/tmp/speakeasy-cache/`
- UUID v5 keys based on text + provider + voice + rate
- Configurable TTL and max size
- Automatic cleanup of expired entries

```
Cache Key = UUID5(text|provider|voice|rate)
```

## Configuration Hierarchy

```
1. Direct parameters (highest priority)
   ↓
2. Environment variables (OPENAI_API_KEY, etc.)
   ↓
3. Global config (~/.config/speakeasy/settings.json)
   ↓
4. Built-in defaults (lowest priority)
```

## CLI Architecture

The CLI (`src/bin/speakeasy-cli.ts`) uses Commander.js:

```
speakeasy "text" [options]
     │
     ▼
┌─────────────┐
│  Commander  │
│   parsing   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Build      │
│  config     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  SpeakEasy  │
│  instance   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   .speak()  │
└─────────────┘
```

## Key Design Decisions

1. **Provider abstraction**: All providers share the same interface, making it easy to add new ones
2. **Fallback chain**: If a provider fails, automatically try the next in the fallback order
3. **Cache by default**: API providers cache automatically to reduce costs and latency
4. **macOS native**: Uses `afplay` for audio playback, ensuring consistent volume control
5. **Global config**: Single config file at `~/.config/speakeasy/` prevents API key sprawl
