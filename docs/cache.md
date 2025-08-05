# Cache System Guide

Comprehensive documentation for SpeakEasy's intelligent caching system, including management, analytics, and optimization.

## Overview

SpeakEasy includes a sophisticated caching system that:
- **Stores generated audio** for faster repeated playback
- **Uses SQLite** for robust metadata management
- **Provides analytics** on cache usage and performance
- **Automatically manages** TTL expiration and size limits
- **Supports CLI tools** for inspection and management

## Cache Architecture

### Storage Structure

```
/tmp/speakeasy-cache/
├── cache.db                    # SQLite metadata database
├── abc123-def456.mp3          # Audio files (UUID names)
├── def789-ghi012.mp3
└── ...
```

### Cache Key Generation

Cache keys are deterministic UUID v5 hashes based on:
- **Text content** (normalized)
- **Provider** (system/openai/elevenlabs/groq)
- **Voice** (nova/samantha/voice-id)
- **Rate** (words per minute)

```typescript
// Same inputs always generate identical cache keys
const key = generateCacheKey("Hello world", "openai", "nova", 180);
// Result: "abc123-def456-789g-hij0-123456789abc"
```

### Metadata Storage

Each cache entry includes comprehensive metadata:

```typescript
interface CacheMetadata {
  cacheKey: string;           // UUID cache key
  originalText: string;       // Source text
  provider: string;           // TTS provider used
  voice: string;              // Voice configuration
  rate: number;               // Speech rate (WPM)
  timestamp: number;          // Creation time
  fileSize: number;           // Audio file size (bytes)
  filePath: string;           // Full path to audio file
  model?: string;             // Provider model (e.g., "tts-1")
  source: string;             // CLI/SDK
  sessionId: string;          // Session identifier
  processId: number;          // Process ID
  hostname: string;           // Machine hostname
  user: string;               // System user
  workingDirectory: string;   // Current working directory
  commandLine?: string;       // Full CLI command
  durationMs: number;         // Generation time
  success: boolean;           // Generation success
  errorMessage?: string;      // Error details if failed
}
```

## Automatic Caching

### When Cache is Enabled

**Automatically enabled** for API providers when API keys are present:
```typescript
// Cache automatically enabled (API key present)
const speaker = new SpeakEasy({
  provider: 'openai',
  apiKeys: { openai: process.env.OPENAI_API_KEY }
});
```

**Disabled** for system voice (no benefit):
```typescript
// Cache disabled (system voice is already fast)
const speaker = new SpeakEasy({
  provider: 'system'
});
```

### Cache Hit Example

```typescript
// First call - generates and caches audio
await speaker.speak('Hello, world!'); // ~800ms

// Second call - uses cached audio  
await speaker.speak('Hello, world!'); // ~50ms (16x faster!)
```

## Configuration

### Global Configuration

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

### SDK Configuration

```typescript
const speaker = new SpeakEasy({
  provider: 'openai',
  cache: {
    enabled: true,
    ttl: '1d',           // 1 day expiration
    maxSize: '50mb',     // 50MB size limit
    dir: '/custom/cache/path'
  }
});
```

### CLI Configuration

```bash
# Enable cache for single request
speakeasy "Hello world" --cache --provider openai

# Cache automatically enabled for API providers
speakeasy "Hello world" --provider elevenlabs  # Cache enabled
speakeasy "Hello world" --provider system      # Cache disabled
```

## TTL Configuration

### Declarative TTL Formats

```json
{
  "cache": {
    "ttl": "7d"    // 7 days
    "ttl": "1h"    // 1 hour  
    "ttl": "30m"   // 30 minutes
    "ttl": "1w"    // 1 week
    "ttl": "1M"    // 1 month
    "ttl": 3600    // 3600 seconds (1 hour)
  }
}
```

### TTL Examples

```typescript
// Short-lived cache for development
const devSpeaker = new SpeakEasy({
  cache: { ttl: '1h' }
});

// Long-lived cache for production
const prodSpeaker = new SpeakEasy({
  cache: { ttl: '30d' }
});

// Permanent cache (never expires)
const permSpeaker = new SpeakEasy({
  cache: { ttl: '100y' }
});
```

## Size Management

### Declarative Size Limits

```json
{
  "cache": {
    "maxSize": "100mb"       // 100 megabytes
    "maxSize": "1gb"         // 1 gigabyte
    "maxSize": "500mb"       // 500 megabytes
    "maxSize": 104857600     // 100MB in bytes
  }
}
```

### Automatic Cleanup

When size limit is exceeded:
1. **Sorts by last access time** (LRU - Least Recently Used)
2. **Deletes oldest entries** first
3. **Removes both audio file and metadata**
4. **Continues until under limit**

```typescript
// Cache will auto-cleanup when >50MB
const speaker = new SpeakEasy({
  cache: { maxSize: '50mb' }
});
```

## Cache Management CLI

### List Cache Entries

```bash
# List all cached entries
speakeasy --list

# Example output:
📋 Cache Entries (3)
═══════════════════════

1. abc123-def456-789g-hij0-123456789abc
   Text: "Hello, world!"
   Provider: openai
   Voice: nova
   Rate: 180 WPM
   Size: 15.5 KB
   Created: 2025-08-05, 2:09:57 p.m.
   File: abc123-def456-789g-hij0-123456789abc.mp3
   Model: tts-1

2. def789-ghi012-345j-klm6-789012345def
   Text: "Claude needs your permission"
   Provider: openai
   Voice: nova
   Rate: 160 WPM
   Size: 32.1 KB
   Created: 2025-08-05, 1:45:32 p.m.
   File: def789-ghi012-345j-klm6-789012345def.mp3
   Model: tts-1
```

### Show Recent Entries

```bash
# Show 5 most recent entries
speakeasy --recent 5

# Show 10 most recent (default)
speakeasy --recent 10
```

### Search Cache

```bash
# Find entries containing "hello"
speakeasy --find "hello"

# Find entries containing "claude"
speakeasy --find "claude"
```

### Detailed Entry Info

```bash
# Show full details for specific entry
speakeasy --id abc123-def456-789g-hij0-123456789abc

# Example output:
🔍 Cache Entry Details
═════════════════════
ID: abc123-def456-789g-hij0-123456789abc
Text: "Hello, world!"
Provider: openai
Model: tts-1
Voice: nova
Rate: 180 WPM
Size: 15.5 KB
Created: 2025-08-05, 2:09:57 p.m.
File: /tmp/speakeasy-cache/abc123-def456-789g-hij0-123456789abc.mp3
Source: CLI
Session: sess_abc123
Directory: /Users/user/project
User: username
Duration: 756ms
Success: ✅
```

### Play Cached Audio

```bash
# Play audio directly from cache
speakeasy --play abc123-def456-789g-hij0-123456789abc

# Output:
🎵 Playing cached audio: "Hello, world!"
   Provider: openai, Voice: nova
```

### Cache Statistics

```bash
# Show comprehensive cache statistics
speakeasy --stats

# Example output:
📊 Cache Statistics
══════════════════
Total Entries: 47
Total Size: 15.63 MB
Cache Hits: 234
Cache Misses: 89
Hit Rate: 72.4%
Avg File Size: 342.1 KB
Date Range: 2025-07-28 - 2025-08-05

📈 By Provider:
  openai: 31
  elevenlabs: 12
  system: 0
  groq: 4

📈 By Model:
  tts-1: 35
  tts-1-hd: 8
  eleven_monolingual_v1: 4

📈 By Source:
  CLI: 28
  SDK: 19
```

### Clear Cache

```bash
# Clear all cached entries
speakeasy --clear-cache

# Output:
🗑️  Cache cleared successfully
```

## SDK Cache Operations

### Get Cache Statistics

```typescript
import { SpeakEasy } from '@arach/speakeasy';

const speaker = new SpeakEasy({ 
  provider: 'openai',
  cache: { enabled: true }
});

const stats = await speaker.getCacheStats();
console.log(`Cache has ${stats.totalEntries} entries`);
console.log(`Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
```

### Cache Statistics Interface

```typescript
interface CacheStats {
  totalEntries: number;         // Number of cached items
  totalSize: number;            // Total size in bytes
  cacheHits: number;            // Successful cache retrievals
  cacheMisses: number;          // Cache misses (new generations)
  hitRate: number;              // Hit rate (0.0-1.0)
  avgFileSize: number;          // Average file size in bytes
  dir?: string;                 // Cache directory path
  dateRange?: {
    earliest: Date;             // Oldest entry date
    latest: Date;               // Newest entry date
  };
  providers: Record<string, number>;  // Entries by provider
  models: Record<string, number>;     // Entries by model
  sources: Record<string, number>;    // Entries by source (CLI/SDK)
}
```

## Performance Analysis

### Cache Hit Benefits

| Operation | Without Cache | With Cache | Speedup |
|-----------|---------------|------------|---------|
| OpenAI TTS | ~800ms | ~50ms | **16x faster** |
| ElevenLabs | ~1200ms | ~50ms | **24x faster** |
| Groq TTS | ~400ms | ~50ms | **8x faster** |
| System Voice | ~100ms | N/A | (Not cached) |

### Memory Usage

```typescript
// Check cache size impact
const stats = await speaker.getCacheStats();
console.log(`Cache using ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);

// Average file sizes by provider:
// OpenAI TTS-1: ~20-40 KB per minute
// ElevenLabs: ~30-60 KB per minute  
// Groq: ~20-35 KB per minute
```

## Cache Optimization

### Best Practices

**Use consistent text:**
```typescript
// ✅ Good - consistent text gets cached
await speaker.speak('Build completed successfully');
await speaker.speak('Build completed successfully'); // Cache hit!

// ❌ Bad - variations don't hit cache
await speaker.speak('Build completed successfully');
await speaker.speak('build completed successfully'); // Cache miss (lowercase)
```

**Use consistent parameters:**
```typescript
// ✅ Good - same provider/voice/rate hits cache
await speaker.speak('Hello', { provider: 'openai', voice: 'nova', rate: 180 });
await speaker.speak('Hello', { provider: 'openai', voice: 'nova', rate: 180 }); // Hit!

// ❌ Bad - different rate misses cache
await speaker.speak('Hello', { provider: 'openai', voice: 'nova', rate: 180 });
await speaker.speak('Hello', { provider: 'openai', voice: 'nova', rate: 200 }); // Miss
```

**Normalize text for better caching:**
```typescript
function normalizeForSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

// Better cache hit rate
const normalized = normalizeForSpeech('Hello, World!');
await speaker.speak(normalized);
```

### Cache Warming

Pre-populate cache with common phrases:

```typescript
async function warmCache() {
  const commonPhrases = [
    'Build completed successfully',
    'Claude needs your permission',
    'Task completed',
    'Error occurred'
  ];
  
  for (const phrase of commonPhrases) {
    await speaker.speak(phrase);
  }
}

// Warm cache on startup
await warmCache();
```

## Advanced Cache Management

### Custom Cache Directory

```typescript
// Use project-specific cache
const projectSpeaker = new SpeakEasy({
  cache: {
    dir: '/project/cache/speakeasy',
    ttl: '30d',
    maxSize: '200mb'
  }
});
```

### Development vs Production

```typescript
// Development - short TTL, small size
const devSpeaker = new SpeakEasy({
  cache: {
    ttl: '1h',
    maxSize: '10mb'
  }
});

// Production - long TTL, large size
const prodSpeaker = new SpeakEasy({
  cache: {
    ttl: '30d', 
    maxSize: '500mb'
  }
});
```

## Troubleshooting Cache

### Common Issues

**Cache directory permissions:**
```bash
# Fix permissions
chmod 755 ~/.cache/speakeasy

# Use temporary directory
export SPEAKEASY_CACHE_DIR="/tmp/speakeasy-cache"
```

**Cache not working:**
```bash
# Check if cache is enabled
speakeasy --diagnose

# Enable cache explicitly
speakeasy "test" --cache --provider openai
```

**Cache size too large:**
```bash
# Check cache statistics
speakeasy --stats

# Clear cache
speakeasy --clear-cache

# Reduce max size in config
echo '{"cache":{"maxSize":"50mb"}}' > ~/.config/speakeasy/settings.json
```

### Debug Cache Operations

```typescript
const speaker = new SpeakEasy({
  debug: true,
  cache: { enabled: true }
});

await speaker.speak('Debug cache');
// Debug output shows cache operations:
// 🔍 SpeakEasy Debug: Cache key generated: abc123...
// 📦 SpeakEasy Debug: Cache miss - generating audio
// 💾 SpeakEasy Debug: Audio cached successfully
```

For configuration details, see [Configuration Guide](configuration.md).
For CLI usage, see [CLI Reference](cli.md).