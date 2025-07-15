# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this Speakeasy repository.

## Overview

A TypeScript-based speech service that provides unified text-to-speech across multiple providers (macOS system, OpenAI, ElevenLabs) with queue management and smart fallbacks.

## Architecture

The service follows a provider-agnostic pattern with three main TTS engines:
- **SystemVoice**: Uses macOS `say` command via `child_process.execSync`
- **OpenAI TTS**: REST API calls to OpenAI's TTS-1 model
- **ElevenLabs**: REST API calls to ElevenLabs API

Each provider has automatic fallback to system voice if API keys are missing or calls fail.

## Key Components

### Core Classes
- `SpeechService` (src/index.ts:25-211): Main service with queue management
- Factory functions (src/index.ts:214-232): Pre-configured instances for common use cases

### Queue System
- Priority-based queue (`high`, `normal`, `low`)
- Interrupt capability via process killing (`pkill -f "say|afplay"`)
- Automatic cleanup of temp audio files

### Text Processing
- Emoji removal via Unicode ranges (src/index.ts:97-103)
- Text normalization for speech compatibility
- Rate limiting via words-per-minute configuration

## Development Commands

```bash
# Build TypeScript
npm run build

# Development with watch mode
npm run dev

# Run tests
npm test

# Manual testing
npm run build && node dist/test.js
```

## Environment Setup

Required environment variables for API providers:
```bash
export OPENAI_API_KEY=your_key
export ELEVENLABS_API_KEY=your_key
```

## Usage Patterns

### Quick Start
```typescript
import { createSpeechService } from '@arach/speech-service';

const speech = createSpeechService.forNotifications();
await speech.speak('Hello world');
```

### Custom Configuration
```typescript
const speech = new SpeechService({
  provider: 'openai',
  openaiVoice: 'nova',
  rate: 180,
  apiKeys: { openai: 'key' }
});
```

## Testing Strategy

- Test file: `src/test.ts` - Tests all three providers and queue functionality
- Manual testing requires API keys for OpenAI/ElevenLabs
- System voice works without external dependencies on macOS

## Platform Notes

- **macOS-only**: Uses `say` command and `afplay` for audio playback
- **Temp files**: Stored in `/tmp` directory, auto-cleanup enabled
- **Dependencies**: `node-fetch` for HTTP requests, native Node.js modules for system integration