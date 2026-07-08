# SpeakEasy

[![npm version](https://img.shields.io/npm/v/@arach/speakeasy.svg)](https://www.npmjs.com/package/@arach/speakeasy)
[![license](https://img.shields.io/npm/l/@arach/speakeasy.svg)](https://github.com/arach/SpeakEasy/blob/master/package.json)

Convenient TTS CLI for Mac — centralized credentials + configurable caching so all your apps and agents can speak.

**[speakeasy.arach.dev](https://speakeasy.arach.dev)** · **npm:** [@arach/speakeasy](https://www.npmjs.com/package/@arach/speakeasy) · **docs:** [quickstart](https://speakeasy.arach.dev/docs/quickstart)

## Surfaces

| Surface | What you get |
| --- | --- |
| **SDK** | `import { say } from '@arach/speakeasy'` in apps and agents |
| **CLI** | `speakeasy "hello"` from the shell |
| **macOS app** | Menu-bar settings + floating HUD (`speakeasy --app`) |
| **Docs** | [speakeasy.arach.dev/docs](https://speakeasy.arach.dev/docs) |

## Try it in 30 seconds

```bash
npm install -g @arach/speakeasy
# or: bun add -g @arach/speakeasy

speakeasy "Hello from SpeakEasy!" --provider system
speakeasy --doctor
```

No API key needed for macOS system voices. First run shows a welcome screen — replay anytime with `speakeasy --welcome`.

### SDK

```typescript
import { say } from '@arach/speakeasy';

await say('Hello world!');           // system voice (macOS)
await say('Hello!', 'openai');       // cloud providers
await say('Hello!', 'groq');
```

## macOS companion app

On macOS, SpeakEasy ships a native companion app that lives in the menu bar:

- **Settings UI** — providers, cache, HUD, and speech history
- **Floating HUD** — shows the current phrase and waveform while the CLI speaks
- **Auto-install** — `speakeasy --app` pulls the signed, notarized `SpeakEasy.dmg` from GitHub Releases into `~/.speakeasy/`

```bash
speakeasy --app          # install (if needed) and open
speakeasy --update-app   # pull the latest release build
```

Build from source: `cd app && ./build-app.sh` · release DMG: `cd app && ./Scripts/build.sh`

The CLI pushes HUD updates over `/tmp/speakeasy-hud.fifo` while audio plays. Keep the app running in the background for live feedback during agent workflows.

## Providers

| Provider | API key | Notes |
| --- | --- | --- |
| **System** | No | macOS `say` — offline, instant |
| **OpenAI** | Yes | High-quality voices (`nova`, `alloy`, …) |
| **ElevenLabs** | Yes | Premium voices |
| **Groq** | Yes | Fast, low-cost |
| **Gemini** | Yes | Google TTS |

Configure once in `~/.config/speakeasy/settings.json` or via env vars. Full setup: [providers guide](https://speakeasy.arach.dev/docs/providers).

```bash
export OPENAI_API_KEY=sk-...
export ELEVENLABS_API_KEY=...
export GROQ_API_KEY=gsk_...
export GEMINI_API_KEY=...
```

## Configuration

```json
{
  "providers": {
    "openai": { "enabled": true, "voice": "nova", "apiKey": "sk-..." },
    "groq": { "enabled": true, "voice": "tara", "apiKey": "gsk_..." },
    "system": { "enabled": true, "voice": "Samantha" }
  },
  "defaults": {
    "provider": "groq",
    "fallbackOrder": ["groq", "openai", "elevenlabs", "gemini", "system"],
    "volume": 0.7
  }
}
```

```bash
speakeasy --config --edit   # open in $EDITOR
speakeasy --config          # print current settings
```

Details: [configuration](https://speakeasy.arach.dev/docs/configuration)

## Caching

API responses are cached in SQLite (`node:sqlite` / `bun:sqlite`). Repeated text with the same voice hits disk instead of the network — typically **8–24× faster** on cache hits.

```bash
speakeasy --cache --list
speakeasy --cache --stats
```

See [cache docs](https://speakeasy.arach.dev/docs/cache).

## Claude Code hooks

Turn silent IDE notifications into spoken updates. SpeakEasy pairs well with [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) and ready-made handlers in [@arach/hooked](https://github.com/arach/hooked):

```typescript
import { SpeakEasy } from '@arach/speakeasy';

const speech = new SpeakEasy({
  provider: 'groq',
  cache: { enabled: true, ttl: '7d' },
  fallbackOrder: ['groq', 'openai', 'system'],
});

await speech.speak(payload.message);
```

Walkthrough on the site: [speakeasy.arach.dev](https://speakeasy.arach.dev)

## CLI essentials

```bash
speakeasy "Hello world"
speakeasy "Quiet" --volume 0.3 --provider openai --voice nova
speakeasy "Save this" --out welcome.mp3
speakeasy --cache --find "hello"
speakeasy --diagnose
```

Full reference: [CLI docs](https://speakeasy.arach.dev/docs/cli)

## Requirements

- **Node.js >= 22.5** or **Bun >= 1.0** (built-in SQLite)
- **macOS** for system voice, `afplay` playback, and the companion app

## Install

```bash
# library
npm install @arach/speakeasy
bun add @arach/speakeasy

# global CLI
npm install -g @arach/speakeasy
```

## Development

```bash
pnpm install
pnpm run build
pnpm test
pnpm run cli -- --doctor
```

Landing site (Bun): `cd landing && bun install && bun run dev`

## Demo audio

[examples/welcome-demo.mp3](examples/welcome-demo.mp3) — generated with OpenAI `nova`.

## Documentation

- [Overview](https://speakeasy.arach.dev/docs/index)
- [Quickstart](https://speakeasy.arach.dev/docs/quickstart)
- [SDK](https://speakeasy.arach.dev/docs/sdk)
- [Troubleshooting](https://speakeasy.arach.dev/docs/troubleshooting)

## License

MIT · [Arach](https://arach.dev)