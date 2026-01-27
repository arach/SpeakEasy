# API Reference

## Interfaces

### SpeakEasyConfig

Main configuration for SpeakEasy instances.

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `provider` | `'system' \| 'openai' \| 'elevenlabs' \| 'groq' \| 'gemini'` | No | `'system'` | TTS provider |
| `systemVoice` | `string` | No | `'Samantha'` | macOS voice name |
| `openaiVoice` | `'alloy' \| 'echo' \| 'fable' \| 'onyx' \| 'nova' \| 'shimmer'` | No | `'nova'` | OpenAI voice |
| `elevenlabsVoiceId` | `string` | No | `'EXAVITQu4vr4xnSDxMaL'` | ElevenLabs voice ID |
| `groqVoice` | `string` | No | `'tara'` | Groq Orpheus voice |
| `geminiModel` | `string` | No | `'gemini-2.5-flash-preview-tts'` | Gemini model |
| `rate` | `number` | No | `180` | Speech rate (WPM) |
| `volume` | `number` | No | `0.7` | Volume (0.0-1.0) |
| `instructions` | `string` | No | - | OpenAI-only steering instructions |
| `apiKeys` | `ApiKeys` | No | - | API keys object |
| `tempDir` | `string` | No | `'/tmp'` | Temp file directory |
| `debug` | `boolean` | No | `false` | Enable debug logging |
| `cache` | `CacheConfig` | No | - | Cache configuration |

### ApiKeys

```typescript
interface ApiKeys {
  openai?: string;
  elevenlabs?: string;
  groq?: string;
  gemini?: string;
}
```

### CacheConfig

```typescript
interface CacheConfig {
  enabled?: boolean;      // Auto-enabled for API providers
  ttl?: string | number;  // '7d', '1h', 86400000
  maxSize?: string | number; // '100mb', '1gb', 104857600
  dir?: string;           // Cache directory path
}
```

### SpeakEasyOptions

Options for individual speak calls.

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `priority` | `'high' \| 'normal' \| 'low'` | No | `'normal'` | Queue priority |
| `interrupt` | `boolean` | No | `false` | Stop current speech |
| `cleanup` | `boolean` | No | `true` | Delete temp files |
| `silent` | `boolean` | No | `false` | Generate without playing |

### Provider

Interface all TTS providers must implement.

```typescript
interface Provider {
  speak(config: ProviderConfig): Promise<void>;
  validateConfig(): boolean;
  getErrorMessage(error: any): string;
}
```

### ProviderConfig

```typescript
interface ProviderConfig {
  text: string;
  rate: number;
  tempDir: string;
  voice?: string;
  apiKey?: string;
  volume?: number;
  instructions?: string;
}
```

### GlobalConfig

Structure of `~/.config/speakeasy/settings.json`.

```typescript
interface GlobalConfig {
  providers?: {
    openai?: { enabled?: boolean; voice?: string; model?: string; apiKey?: string; instructions?: string };
    elevenlabs?: { enabled?: boolean; voiceId?: string; modelId?: string; apiKey?: string };
    system?: { enabled?: boolean; voice?: string };
    groq?: { enabled?: boolean; voice?: string; apiKey?: string };
    gemini?: { enabled?: boolean; model?: string; apiKey?: string };
  };
  defaults?: {
    provider?: string;
    fallbackOrder?: string[];
    rate?: number;
    volume?: number;
  };
  global?: {
    tempDir?: string;
    cleanup?: boolean;
  };
  cache?: CacheConfig;
}
```

## Classes

### SpeakEasy

Main class for text-to-speech.

#### Constructor

```typescript
new SpeakEasy(config?: SpeakEasyConfig)
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `speak` | `(text: string, options?: SpeakEasyOptions) => Promise<void>` | Speak text with options |
| `stopSpeaking` | `() => void` | Stop current playback |
| `getCacheStats` | `() => Promise<CacheStats>` | Get cache statistics |
| `getCacheMetadata` | `() => Promise<CacheEntry[]>` | Get all cache entries |
| `findByText` | `(text: string) => Promise<CacheEntry[]>` | Search cache by text |
| `findByProvider` | `(provider: string) => Promise<CacheEntry[]>` | Filter cache by provider |
| `clearCache` | `() => Promise<void>` | Clear all cached audio |

### TTSCache

SQLite-based audio cache.

#### Constructor

```typescript
new TTSCache(dir: string, ttl?: string | number, maxSize?: string | number)
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `(key: string) => Promise<CacheEntry \| null>` | Get cached entry |
| `set` | `(key: string, filePath: string, metadata: object) => Promise<void>` | Store entry |
| `delete` | `(key: string) => Promise<void>` | Delete entry |
| `clear` | `() => Promise<void>` | Clear all entries |
| `getStats` | `() => Promise<CacheStats>` | Get statistics |
| `cleanup` | `() => Promise<void>` | Remove expired entries |

## Convenience Functions

### say

Quick one-liner for speech.

```typescript
async function say(
  text: string,
  provider?: 'system' | 'openai' | 'elevenlabs' | 'groq' | 'gemini',
  options?: { volume?: number; cache?: boolean }
): Promise<void>
```

**Examples:**

```typescript
await say('Hello world');                     // System voice
await say('Hello', 'openai');                 // OpenAI
await say('Hello', 'groq', { volume: 0.5 });  // Groq at 50% volume
```

### speak

Full-featured speech with options.

```typescript
async function speak(
  text: string,
  options?: SpeakEasyOptions & { provider?: string; volume?: number }
): Promise<void>
```

**Examples:**

```typescript
await speak('Hello', { priority: 'high' });
await speak('Hello', { provider: 'openai', interrupt: true });
```

## Provider-Specific Notes

### OpenAI

- Voices: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`
- Models: `tts-1` (fast), `tts-1-hd` (quality)
- Supports `instructions` for voice steering

### ElevenLabs

- Requires voice ID, not voice name
- Default: `EXAVITQu4vr4xnSDxMaL` (Rachel)
- Get IDs from: https://elevenlabs.io/app/voice-library

### Groq

- Model: `canopylabs/orpheus-v1-english`
- Voices: `tara`, `leah`, `jess`, `mia`, `zoe`, `leo`, `dan`, `zac`
- Requires terms acceptance at Groq console

### Gemini

- Model: `gemini-2.5-flash-preview-tts`
- Uses Google Generative AI SDK

### System (macOS)

- Uses `say` command
- List voices: `say -v ?`
- Common: `Samantha`, `Alex`, `Victoria`, `Daniel`
