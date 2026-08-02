# SpeakEasy

**Speak to the Codex task you are already using. Hear its real answer come back.**

SpeakEasy is a dual-mode voice companion for Codex Desktop on macOS. It
transcribes an explicit utterance locally, routes the final text to the exact
Codex task you chose, and narrates that task's real response through a
controllable native player. The same live task lanes are available from the
Mac, a browser, or an iPad on your local network.

- **No shadow conversation:** the full transcript remains in Codex.
- **No focus guessing:** the exact task ID is the routing authority.
- **Local speech boundary:** audio is captured and transcribed on your Mac.
- **One self-serve install:** Codex can verify and install the signed,
  Apple-notarized app without a source checkout or developer tools.

## Start with Codex

Paste this bounded task into Codex Desktop:

> Install SpeakEasy 0.2.18 on this Mac. Read
> https://speakeasy.arach.dev/agent.md and follow Path A. Do not build from
> source or bypass Gatekeeper. Tell me which human-only steps remain.

The current `0.2.18` build is a self-serve preview. It stays a GitHub
prerelease until the clean second-Mac and device-path acceptance run passes.
See [SpeakEasy for Codex](https://speakeasy.arach.dev/codex/) for the product
loop and [`docs/release/self-serve-mac-test.md`](docs/release/self-serve-mac-test.md)
for the promotion gate.

The TypeScript library and CLI remain available for applications and agent
hooks that need provider-independent TTS. Jump to [Library and CLI](#library-and-cli)
if that is what you are installing.

## Library and CLI

### Welcome experience

When you first run SpeakEasy CLI, you're greeted with a professional welcome screen:

```
+============================================================================+
|                                                                            |
| ███████╗██████╗ ███████╗ █████╗ ██╗  ██╗███████╗ █████╗ ███████╗██╗   ██╗ |
| ██╔════╝██╔══██╗██╔════╝██╔══██╗██║ ██╔╝██╔════╝██╔══██╗██╔════╝╚██╗ ██╔╝ |
| ███████╗██████╔╝█████╗  ███████║█████╔╝ █████╗  ███████║███████╗ ╚████╔╝  |
| ╚════██║██╔═══╝ ██╔══╝  ██╔══██║██╔═██╗ ██╔══╝  ██╔══██║╚════██║  ╚██╔╝   |
| ███████║██║     ███████╗██║  ██║██║  ██╗███████╗██║  ██║███████║   ██║    |
| ╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝    |
|                                                                            |
+============================================================================+

🎉 Welcome to SpeakEasy!

We didn't find a configuration file. Let's create one to get you started!

📦 What is SpeakEasy?
   A unified text-to-speech CLI that works with multiple providers.

   Supported Providers:
   • System Voices - macOS, Windows, Linux (no key needed)
   • ElevenLabs - Premium voices (🔑 key required)
   • OpenAI - High quality voices (🔑 key required)
   • Groq - Fast & cheap (🔑 key required)
   • Gemini - Google's advanced TTS (🔑 key required)

🚀 Quick Start:
   Try it now with built-in system voices:
   
   speakeasy "Hello! Welcome to SpeakEasy!" --provider system

🔧 Setup API Keys (optional):
   
   For ElevenLabs:
   export ELEVENLABS_API_KEY="your-api-key-here"
   Get key: https://elevenlabs.io/app/settings/api-keys
   
   For OpenAI TTS:
   export OPENAI_API_KEY="your-api-key-here"
   Get key: https://platform.openai.com/api-keys
   
   For Groq (fast & cheap):
   export GROQ_API_KEY="your-api-key-here"
   Get key: https://console.groq.com/keys
   
   For Gemini (Google's TTS):
   export GEMINI_API_KEY="your-api-key-here"
   Get key: https://aistudio.google.com/apikey

💾 Configuration:
   Create config: speakeasy --config --edit
   View settings: speakeasy --config

🩺 Need Help?
   Diagnose setup: speakeasy --doctor
   Show all options: speakeasy --help

────────────────────────────────────────────────────────────

Built with ❤️ by Arach • https://arach.dev
```

**Experience the welcome screen:** `speakeasy --welcome`  
**Get started instantly:** `speakeasy "Hello World!" --provider system`

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
- **Multiple TTS Providers**: System (macOS), OpenAI, ElevenLabs, Groq, Gemini
- **Smart Fallbacks**: Automatic provider switching on failure
- **Volume Control**: Precise control without affecting system volume
- **Queue Management**: Priority-based speech queue with interruption
- **TypeScript**: Full type safety and IntelliSense support

### 🎧 **Demo**
Listen to SpeakEasy in action: [welcome-demo.mp3](examples/welcome-demo.mp3)

*Generated with: `speakeasy "Welcome to SpeakEasy! This unified text-to-speech service makes it easy to add voice to your applications" --provider openai --voice nova --rate 185 --out welcome-demo.mp3`*

## 🤖 Give your coding agent a voice

SpeakEasy is built for agent workflows. You don't wire anything up yourself — you tell your
coding agent (Codex, Claude Code, Cursor, …) to do it. One sentence:

> **Read https://speakeasy.arach.dev/agent.md and follow it.**

The agent installs the package, speaks short summaries after each task (system voice, no
API key), and opens the deck when you ask. If you'd rather write the instructions yourself:

> Install `@arach/speakeasy` in this project and use it to speak. After finishing a
> task, use `npx @arach/speakeasy "<one-sentence summary of what you did>"` so I can
> hear it — the system provider works with no API key. When I ask you to "open the
> deck", run `npx @arach/speakeasy deck` and leave it running.

Then run the deck once:

```bash
npx @arach/speakeasy deck
```

Scan the QR code with an iPad on the same Wi-Fi, tap **Share → Add to Home Screen**, and
your agent's work becomes something you can hear from anywhere in the room — the agent
speaks its summaries through SpeakEasy, and the deck is the control surface (lane
controls, hold-to-speak, narration playback, themes) that drives it as the Mac link
comes online.

## Installation

For the complete macOS app—local dictation, exact Codex task lanes, native
narration, and the Deck—the recommended installation flow is a bounded Codex
task. Paste this into Codex:

> Install SpeakEasy 0.2.18 on this Mac. Read
> https://speakeasy.arach.dev/agent.md and follow Path A. Do not build from
> source or bypass Gatekeeper. Tell me which human-only steps remain.

Codex downloads and inspects the pinned installer, verifies the published
checksum, Gatekeeper acceptance, Developer ID, and exact version, safely
replaces the app, and opens **Settings → Deck**. You only approve the microphone
and local-network prompts that macOS requires a person to handle.

For a manual install, download the same signed and notarized release:

**[Download SpeakEasy 0.2.18 for macOS](https://github.com/arach/SpeakEasy/releases/download/v0.2.18/SpeakEasy.dmg)**

1. Drag SpeakEasy to **Applications**.
2. Open it and approve microphone and local-network access when macOS asks.
3. Open **SpeakEasy → Settings → Deck** and complete the three readiness checks.

The release is self-contained and requires an Apple silicon Mac running macOS
14 or newer. Codex Desktop is required for exact-task voice lanes; the macOS
system voice works without an API key.

For a source build or release development:

```bash
git clone https://github.com/arach/speakeasy.git
cd speakeasy
./app/install.sh
```

The source installer checks macOS, Bun, and Apple build tools; installs the pinned
dependencies; builds and signs the app; safely replaces any running copy; and
opens **SpeakEasy → Settings → Deck**. Its three-step checklist confirms the
bundled runtime, finds Codex, and starts the live bridge. The device card and QR
appear only when the bridge is genuinely ready.

There is no separate server package and Caddy is optional. SpeakEasy finds the
native Codex binary from the desktop app or the `codex` command in your login
shell. Re-running `./app/install.sh` is safe; use `--no-open` in automation.

Enable **Start the deck with SpeakEasy** after the first successful launch to
keep it ready whenever the menu-bar app runs.

Repeat the install on another Mac and it advertises itself separately. The
native iPad shell shows every available Mac in its machine menu and remembers
the last one; any laptop can use the QR/copy link from that Mac's Deck tab.

For the TypeScript library or CLI only:

```bash
bun add @arach/speakeasy
```

## Quick Start

```typescript
import { say } from '@arach/speakeasy';

await say('Hello world!');                    // system voice
await say('Hello!', 'openai');                // OpenAI TTS
await say('Hello!', 'elevenlabs');            // ElevenLabs TTS  
await say('Hello!', 'groq');                  // Groq TTS
await say('Hello!', 'gemini');                // Gemini TTS
```

## 🏃‍♂️ Performance Impact

**Caching makes a dramatic difference:**

| Provider | Without Cache | With Cache | Speedup |
|----------|---------------|------------|---------|
| OpenAI | ~800ms | ~50ms | **16x faster** |
| ElevenLabs | ~1200ms | ~50ms | **24x faster** |
| Groq | ~400ms | ~50ms | **8x faster** |
| Gemini | ~600ms | ~50ms | **12x faster** |

*Cache automatically enabled for API providers when keys are present.*

## Configuration

**Stop copying API keys everywhere.** SpeakEasy uses a single, clean configuration file:

**`~/.config/speakeasy/settings.json`**

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
      "apiKey": "sk-..."
    },
    "system": {
      "enabled": true,
      "voice": "Samantha"
    },
    "groq": {
      "enabled": true,
      "voice": "onyx",
      "model": "tts-1-hd",
      "apiKey": "gsk-..."
    },
    "gemini": {
      "enabled": true,
      "model": "gemini-2.5-flash-preview-tts",
      "apiKey": "AIza..."
    }
  },
  "defaults": {
    "provider": "groq",
    "fallbackOrder": ["groq", "openai", "elevenlabs", "gemini", "system"],
    "rate": 180,
    "volume": 0.7
  },
  "global": {
    "tempDir": "/tmp",
    "cleanup": true
  }
}
```

**✅ Configure once, use everywhere**  
**✅ No more environment variables in every project**  
**✅ Secure API key storage with proper permissions**

### Environment Variables

```bash
export OPENAI_API_KEY=your_openai_key
export ELEVENLABS_API_KEY=your_elevenlabs_key
export GROQ_API_KEY=your_groq_key
export GEMINI_API_KEY=your_gemini_key
```

## Usage

### Basic Usage

```typescript
import { say, speak } from '@arach/speakeasy';

// Quick one-liners
await say('Hello world!');                    // system voice
await say('Hello!', 'openai');                // OpenAI TTS
await say('Hello!', 'elevenlabs');            // ElevenLabs TTS
await say('Hello!', 'groq');                  // Groq TTS
await say('Hello!', 'gemini');                // Gemini TTS

// Full featured with volume control
await speak('Hello world!', { priority: 'high', volume: 0.5 });
await speak('Hello!', { provider: 'openai', priority: 'high', volume: 0.8 });

// Custom configuration
import { SpeakEasy } from '@arach/speakeasy';
const speech = new SpeakEasy({
  provider: 'openai',
  openaiVoice: 'nova',
  rate: 180,
  volume: 0.6, // 60% volume
});
await speech.speak('Hello world!');
```

### In Your Projects

```typescript
// notifications.ts
import { say } from '@arach/speakeasy';

export async function speakNotification(message: string, project: string) {
  await say(`In ${project}, ${message}`, { priority: 'high', volume: 0.8 });
}
```

### Volume Control

SpeakEasy provides granular volume control (0.0-1.0) that only affects speech playback without changing your system volume:

```typescript
import { say, speak, SpeakEasy } from '@arach/speakeasy';

// Quick volume control
await say('Quiet message', 'openai', { volume: 0.3 });     // 30% volume
await say('Normal message', 'system', { volume: 0.7 });    // 70% volume (default)
await say('Loud message', 'elevenlabs', { volume: 1.0 });  // 100% volume

// With speak function
await speak('Custom volume', { provider: 'groq', volume: 0.5 });

// Class instance with default volume
const quietSpeaker = new SpeakEasy({
  provider: 'openai',
  volume: 0.4  // All speech will be at 40% volume by default
});
await quietSpeaker.speak('This will be quiet');
await quietSpeaker.speak('This too', { volume: 0.9 }); // Override to 90%
```

**Volume Features:**
- ✅ **Isolated**: Only affects SpeakEasy audio, never changes system volume
- ✅ **Provider-agnostic**: Works with system voices, OpenAI, ElevenLabs, Groq, and Gemini
- ✅ **Global config**: Set default volume in `~/.config/speakeasy/settings.json`
- ✅ **Per-call override**: Specify volume for individual speech requests
- ✅ **Debug visibility**: Shows current volume percentage in debug mode

### Caching
- **Auto-enabled** when API keys are present (OpenAI, ElevenLabs, Groq, Gemini)
- **Deterministic UUID keys** - Same text+provider+voice+rate = identical cache key
- **Collision-resistant** - Uses UUID v5 with deterministic construction
- **Disabled for system voice** (macOS `say` command) - no benefit for local TTS
- **Declarative TTL**: Configure with simple strings like `"7d"`, `"1h"`, `"30m"`
- **Declarative max size**: Configure with strings like `"100mb"`, `"1gb"`
- **Storage location**: `/tmp/speakeasy-cache/` by default

**Cache Key Construction:**
```
UUID = SHA1(text|provider|voice|rate + namespace) → UUID v5
```
**Identical inputs always hit the same cache entry**

### Convenience
- `say('text')` - One-liner with system voice and caching
- `say('text', 'openai' | 'elevenlabs' | 'groq' | 'gemini')` - One-liner with provider and caching
- `say('text', provider, false)` - Disable caching for specific call
- `speak('text', options, false)` - Full featured with caching control

## Examples

```bash
bun run example
```

## Declarative Caching Configuration

```typescript
import { SpeakEasy } from '@arach/speakeasy';

// Simple declarative configuration
const speaker = new SpeakEasy({
  provider: 'openai',
  cache: {
    enabled: true,        // auto: true when API keys present, false for system
    ttl: '7d',           // 7 days - '1h', '30m', '1w', '1M', etc.
    maxSize: '100mb',    // '1gb', '500mb', etc.
    dir: '/tmp/my-cache' // custom directory
  }
});

// Using global config
// ~/.config/speakeasy/settings.json
{
  "cache": {
    "enabled": true,     // auto-enabled when API keys present
    "ttl": "1d",
    "maxSize": "500mb"
  }
}
```

## CLI Usage

Install globally for command-line access:

```bash
bun add --global @arach/speakeasy

# Basic usage
speakeasy "Hello world"
speakeasy --text "Hello from CLI" --provider openai --voice nova

# Volume control
speakeasy "Quiet message" --volume 0.3
speakeasy "Loud message" --provider openai --volume 0.9 --voice nova

# Save to file (plays audio AND saves file)
speakeasy "Welcome message" --out welcome.mp3
speakeasy "Notification" --provider openai --voice nova --out notification.mp3

# With caching
speakeasy --cache --text "Hello cached world"

# Cache management
speakeasy --cache --list
speakeasy --cache --find "hello"
speakeasy --cache --provider openai
speakeasy --clear-cache
speakeasy --config

# Diagnostics and health checks
speakeasy --diagnose          # Show configuration diagnostics
speakeasy --doctor           # Run comprehensive health check on config
speakeasy --debug "test"     # Run with debug logging

# List all available voices
speakeasy --help
```

## Cache Inspection

### Programmatic
```typescript
const speaker = new SpeakEasy({ cache: { enabled: true } });

// Get all cached entries
const metadata = await speaker.getCacheMetadata();
console.log(metadata);

// Find by text
const found = await speaker.findByText('hello world');

// Find by provider
const openaiEntries = await speaker.findByProvider('openai');
```

### CLI
```bash
# List all cached entries
speakeasy --cache --list

# Example output:
📋 Cache Entries (1)
═══════════════════════

1. 8c957870-4741-5394-a0ed-b3db062d3ec3
   Text: "Hello world"
   Provider: openai
   Voice: nova
   Size: 15.5 KB
   Created: 2025-07-26, 2:09:57 p.m.
   File: 8c957870-4741-5394-a0ed-b3db062d3ec3.mp3
   Model: tts-1

💡 Use --id KEY to see full details, --play KEY to play audio

# Search by text
speakeasy --cache --find "hello"

# Filter by provider
speakeasy --cache --provider openai

# Show cache stats
speakeasy --cache --stats
```

## Diagnostics and Health Checks

SpeakEasy includes comprehensive diagnostic tools to help troubleshoot configuration issues:

### CLI Health Check
```bash
# Quick health check of your configuration
speakeasy --doctor

# Detailed configuration diagnostics
speakeasy --diagnose

# Debug mode with detailed logging
speakeasy --debug "test message"
```

### Health Check Features
- **System compatibility** (macOS detection, required commands)
- **Configuration file validation** (JSON syntax, permissions)
- **API key detection** (both config file and environment variables)
- **Voice configuration** (provider-specific settings)
- **Cache configuration** (directory permissions, TTL settings)
- **Actionable fixes** (specific commands to resolve issues)

### Example Output
```bash
$ speakeasy --doctor
🏥 Speakeasy Configuration Health Check

🔍 System Compatibility:
   ✅ macOS detected - system voice support available
   ✅ `say` command available
   ✅ `afplay` command available

🔧 Configuration Health:
   ✅ Config file exists
   ✅ Config file is valid JSON
   ✅ Config directory permissions OK

🔑 API Key Configuration:
   ✅ OpenAI: Configured via environment
   ❌ ElevenLabs: Not configured
   ✅ Groq: Configured in file
   ✅ Gemini: Configured in file

🎙️  Voice Configuration:
   system: Samantha
   openai: nova
   elevenlabs: EXAVITQu4vr4xnSDxMaL
   groq: nova
   gemini: Puck

📦 Cache Configuration:
   ✅ Cache enabled
   📁 Cache dir: /tmp/speakeasy-cache
   ✅ Cache directory accessible

📋 Health Summary:
   🎉 All checks passed! Speakeasy is healthy.
```

## Testing

```bash
bun run build
npm test
npm test cache  # Test caching specifically
bun run cli -- --help  # Test CLI
bun run cli -- --doctor  # Test health check
```
