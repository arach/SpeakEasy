# SpeakEasy Skills

Pre-built skill definitions for AI agents working with SpeakEasy.

## Available Skills

### speakeasy-tts

Basic text-to-speech skill.

```yaml
name: speakeasy-tts
description: Convert text to speech using SpeakEasy
triggers:
  - "speak this"
  - "say out loud"
  - "read aloud"
  - "text to speech"
```

**Usage:**
```bash
speakeasy "Your text here"
speakeasy "Hello" --provider openai --voice nova
```

### speakeasy-notify

Voice notifications for development workflows.

```yaml
name: speakeasy-notify
description: Speak notifications for build, test, and deployment events
triggers:
  - "notify me when"
  - "speak when done"
  - "voice alert"
```

**Usage:**
```bash
# After build completes
speakeasy "Build completed successfully" --provider openai

# On test failure
speakeasy "Tests failed. Check the console." --provider system --volume 0.8
```

### speakeasy-cache

Manage the audio cache.

```yaml
name: speakeasy-cache
description: View and manage cached TTS audio
triggers:
  - "show cache"
  - "clear cache"
  - "cache stats"
```

**Commands:**
```bash
speakeasy --cache --list      # List cached entries
speakeasy --cache --stats     # Show cache statistics
speakeasy --clear-cache       # Clear all cached audio
speakeasy --cache --find "hello"  # Search cache
```

### speakeasy-diagnose

Troubleshoot SpeakEasy configuration.

```yaml
name: speakeasy-diagnose
description: Diagnose and fix SpeakEasy issues
triggers:
  - "speakeasy not working"
  - "fix speech"
  - "diagnose tts"
```

**Commands:**
```bash
speakeasy --doctor    # Full health check
speakeasy --diagnose  # Configuration diagnostics
speakeasy --config    # View current config
```

## Skill Templates

### Add Voice to Workflow

Template for adding voice notifications to any workflow.

```typescript
import { say } from '@arach/speakeasy';

// Speak on success
await say('Task completed successfully', 'openai');

// Speak on failure with higher priority
await say('Error occurred. Please check logs.', 'system', { volume: 0.9 });
```

### Multi-Provider Fallback

Template with automatic fallback.

```typescript
import { SpeakEasy } from '@arach/speakeasy';

const speaker = new SpeakEasy({
  provider: 'openai',
  // Falls back automatically if OpenAI fails
});

await speaker.speak('Message with fallback support');
```

### Cached Notifications

Template for repeated notifications (16x faster with cache).

```typescript
import { SpeakEasy } from '@arach/speakeasy';

const speaker = new SpeakEasy({
  provider: 'openai',
  cache: { enabled: true, ttl: '7d' }
});

// First call: generates and caches
await speaker.speak('Build started');

// Subsequent calls: instant from cache
await speaker.speak('Build started');
```

## Integration Examples

### Claude Code Hook

Add to `.claude/hooks.json`:

```json
{
  "onComplete": {
    "command": "speakeasy 'Task completed' --provider system"
  },
  "onError": {
    "command": "speakeasy 'An error occurred' --provider system --volume 0.8"
  }
}
```

### Git Hook

Add to `.git/hooks/post-commit`:

```bash
#!/bin/bash
speakeasy "Commit created" --provider system
```

### npm Script

Add to `package.json`:

```json
{
  "scripts": {
    "build": "tsc && speakeasy 'Build complete' --provider system",
    "test": "vitest && speakeasy 'All tests passed' --provider system"
  }
}
```

## Skill Configuration

Configure skills in `~/.config/speakeasy/settings.json`:

```json
{
  "providers": {
    "openai": { "enabled": true, "voice": "nova" },
    "system": { "enabled": true, "voice": "Samantha" }
  },
  "defaults": {
    "provider": "openai",
    "fallbackOrder": ["openai", "system"],
    "volume": 0.7
  }
}
```

## Creating Custom Skills

1. Define trigger phrases
2. Map to speakeasy commands
3. Add to your agent's skill registry

```yaml
name: my-custom-skill
description: Custom voice notification
triggers:
  - "custom trigger phrase"
command: speakeasy "{{message}}" --provider {{provider}}
parameters:
  message: string
  provider: openai | system | groq
```
