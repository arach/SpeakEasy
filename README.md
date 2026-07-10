# SpeakEasy

[![npm version](https://img.shields.io/npm/v/@arach/speakeasy.svg)](https://www.npmjs.com/package/@arach/speakeasy)
[![license](https://img.shields.io/npm/l/@arach/speakeasy.svg)](https://github.com/arach/SpeakEasy/blob/master/package.json)

Convenient TTS CLI for Mac — centralized credentials + configurable caching so all your apps and agents can speak.

**[speakeasy.arach.dev](https://speakeasy.arach.dev)** · **npm:** [@arach/speakeasy](https://www.npmjs.com/package/@arach/speakeasy) · **docs:** [quickstart](https://speakeasy.arach.dev/docs/quickstart)

## What you get

| Surface | What it does |
| --- | --- |
| **CLI** | `speakeasy "hello"` — shell control, cache, diagnostics |
| **SDK** | `import { say } from '@arach/speakeasy'` — queue, fallbacks, cache |
| **macOS app** | Menu-bar settings + floating HUD (`speakeasy --app`) |
| **Adapters** | Normalized `TTSAdapter` API — plug in bespoke providers |

Five built-in providers (system, OpenAI, ElevenLabs, Groq, Gemini). One config file. SQLite cache for API voices. macOS playback via `afplay`.

## Try it in 30 seconds

```bash
npm install -g @arach/speakeasy

speakeasy "Hello from SpeakEasy!" --provider system
speakeasy --doctor
```

No API key needed for macOS system voices. First run shows a welcome screen — replay anytime with `speakeasy --welcome`.

### SDK

```typescript
import { say, SpeakEasy } from '@arach/speakeasy';

await say('Hello world!');           // system voice (macOS)
await say('Hello!', 'openai');       // cloud providers

const speaker = new SpeakEasy({
  provider: 'groq',
  cache: { enabled: true },
});
await speaker.speak('Cached on repeat.');
```

### Custom TTS backends

Implement `TTSAdapter` (`synthesize`, `validate`, `formatError`) and use SpeakEasy's playback + cache utilities — or wire into the registry for first-class CLI support. Guide: [custom providers](https://speakeasy.arach.dev/docs/custom-providers/).

## macOS companion app

Native menu-bar app: provider settings, cache management, speech history, and a floating HUD while the CLI speaks.

```bash
speakeasy --app          # install from GitHub Releases and open
speakeasy --update-app   # pull the latest signed DMG
```

Build from source: `cd app && ./build-app.sh` · release: `cd app && ./Scripts/build.sh`

## Providers

| Provider | API key | Notes |
| --- | --- | --- |
| **System** | No | macOS `say` — offline, instant |
| **OpenAI** | Yes | Neural voices + optional steering instructions |
| **ElevenLabs** | Yes | Premium voices (voice IDs, not names) |
| **Groq** | Yes | Fast Orpheus TTS |
| **Gemini** | Yes | Google TTS |

```bash
export OPENAI_API_KEY=sk-...
export GROQ_API_KEY=gsk_...
```

Configure once in `~/.config/speakeasy/settings.json`. Details: [providers](https://speakeasy.arach.dev/docs/providers).

## Configuration

```json
{
  "defaults": {
    "provider": "groq",
    "fallbackOrder": ["groq", "openai", "elevenlabs", "gemini", "system"],
    "volume": 0.7
  },
  "providers": {
    "openai": { "enabled": true, "voice": "nova", "apiKey": "sk-..." },
    "system": { "enabled": true, "voice": "Samantha" }
  }
}
```

```bash
speakeasy --config --edit
```

## Caching

API audio is cached in SQLite. Repeated phrases hit disk instead of the network — typically **8–24× faster** on cache hits.

```bash
speakeasy --cache --list
speakeasy --cache --stats
```

## Claude Code & agents

Pair with [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) or [@arach/hooked](https://github.com/arach/hooked) so IDE events become spoken updates:

```typescript
import { SpeakEasy } from '@arach/speakeasy';

const speech = new SpeakEasy({ provider: 'groq', cache: { enabled: true } });
await speech.speak('Build completed.');
```

## Requirements

- **Node.js >= 22.12** or **Bun >= 1.0** (built-in SQLite)
- **macOS** for system voice, `afplay` playback, and the companion app

## Install

```bash
npm install @arach/speakeasy      # library
npm install -g @arach/speakeasy     # global CLI
```

## Documentation

- [Quickstart](https://speakeasy.arach.dev/docs/quickstart)
- [SDK](https://speakeasy.arach.dev/docs/sdk)
- [Custom providers](https://speakeasy.arach.dev/docs/custom-providers)
- [Cache](https://speakeasy.arach.dev/docs/cache)
- [Troubleshooting](https://speakeasy.arach.dev/docs/troubleshooting)

## Development

```bash
pnpm install && pnpm run build && pnpm test
```

## License

MIT · [Arach](https://arach.dev)