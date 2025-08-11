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
speakeasy "Hello" --provider elevenlabs --voice "your-custom-voice-id"
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
- **Fast inference**: Optimized for speed
- **OpenAI compatible**: Same voice names and API
- **Cost effective**: Competitive pricing
- **High performance**: Excellent speed/quality balance

### Setup

**API key required:**
```bash
export GROQ_API_KEY="gsk_..."
```

**Global config:**
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

### Available Voices

Uses OpenAI-compatible voice names:
- `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`

### Usage Examples

**SDK:**
```typescript
const speaker = new SpeakEasy({
  provider: 'groq',
  rate: 220, // Groq handles fast generation well
  apiKeys: {
    groq: process.env.GROQ_API_KEY
  }
});
```

**CLI:**
```bash
speakeasy "Fast generation" --provider groq --voice nova
```

### Rate Control

Similar to OpenAI:
```
speed = rate / 200
```

### Advantages
- ✅ **Very fast** inference and generation
- ✅ **Cost effective** compared to other APIs
- ✅ **OpenAI compatible** voice names
- ✅ **Good quality** output
- ✅ **Reliable performance**

### Limitations
- ❌ **Newer provider** (less established)
- ❌ **API key required**
- ❌ **Limited voice selection** (6 voices)

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