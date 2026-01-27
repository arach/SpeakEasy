# API Reference (Agent)

## SpeakEasyConfig

| Property | Type | Default |
|----------|------|---------|
| provider | 'system'\|'openai'\|'elevenlabs'\|'groq'\|'gemini' | 'system' |
| systemVoice | string | 'Samantha' |
| openaiVoice | 'alloy'\|'echo'\|'fable'\|'onyx'\|'nova'\|'shimmer' | 'nova' |
| elevenlabsVoiceId | string | 'EXAVITQu4vr4xnSDxMaL' |
| groqVoice | string | 'tara' |
| geminiModel | string | 'gemini-2.5-flash-preview-tts' |
| rate | number | 180 |
| volume | number | 0.7 |
| instructions | string | undefined |
| apiKeys | {openai?, elevenlabs?, groq?, gemini?} | {} |
| tempDir | string | '/tmp' |
| debug | boolean | false |
| cache | {enabled?, ttl?, maxSize?, dir?} | auto |

## SpeakEasyOptions

| Property | Type | Default |
|----------|------|---------|
| priority | 'high'\|'normal'\|'low' | 'normal' |
| interrupt | boolean | false |
| cleanup | boolean | true |
| silent | boolean | false |

## SpeakEasy Methods

| Method | Args | Returns |
|--------|------|---------|
| speak | (text: string, options?: SpeakEasyOptions) | Promise<void> |
| stopSpeaking | () | void |
| getCacheStats | () | Promise<CacheStats> |
| getCacheMetadata | () | Promise<CacheEntry[]> |
| findByText | (text: string) | Promise<CacheEntry[]> |
| findByProvider | (provider: string) | Promise<CacheEntry[]> |
| clearCache | () | Promise<void> |

## Convenience Functions

```typescript
say(text: string, provider?: string, options?: {volume?, cache?}): Promise<void>
speak(text: string, options?: SpeakEasyOptions & {provider?, volume?}): Promise<void>
```

## Provider Interface

```typescript
interface Provider {
  speak(config: ProviderConfig): Promise<void>;
  validateConfig(): boolean;
  getErrorMessage(error: any): string;
}

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

## GlobalConfig Structure

```typescript
{
  providers: {
    openai: {enabled, voice, model, apiKey, instructions},
    elevenlabs: {enabled, voiceId, modelId, apiKey},
    system: {enabled, voice},
    groq: {enabled, voice, apiKey},
    gemini: {enabled, model, apiKey}
  },
  defaults: {provider, fallbackOrder, rate, volume},
  global: {tempDir, cleanup},
  cache: {enabled, ttl, maxSize, dir}
}
```

## TTL Formats

`'7d'` | `'1h'` | `'30m'` | `'1w'` | `'1M'` | number (ms)

## Size Formats

`'100mb'` | `'1gb'` | number (bytes)
