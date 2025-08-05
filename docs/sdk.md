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
  rate: 220,
  apiKeys: {
    groq: process.env.GROQ_API_KEY
  }
});

await groqSpeaker.speak('Using Groq fast inference');
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