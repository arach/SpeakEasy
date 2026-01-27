# CLI Reference (Agent)

## Basic Syntax

```
speakeasy <text> [options]
speakeasy --text <text> [options]
```

## Flags

| Flag | Short | Type | Description |
|------|-------|------|-------------|
| --text | -t | string | Text to speak |
| --provider | -p | string | TTS provider |
| --voice | -v | string | Voice name/ID |
| --rate | -r | number | Speech rate (WPM) |
| --volume | | number | Volume (0.0-1.0) |
| --interrupt | -i | boolean | Stop current speech |
| --cache | -c | boolean | Enable caching |
| --out | -o | string | Save audio to file |
| --debug | | boolean | Debug mode |

## Management Flags

| Flag | Description |
|------|-------------|
| --config | View configuration |
| --diagnose | Configuration diagnostics |
| --doctor | Health check |
| --set-key <provider> <key> | Save API key |
| --welcome | Show welcome screen |
| --help | Show help |

## Cache Flags

| Flag | Description |
|------|-------------|
| --cache --list | List cache entries |
| --cache --stats | Cache statistics |
| --cache --find <text> | Search cache |
| --cache --provider <name> | Filter by provider |
| --cache --id <uuid> | Show entry details |
| --cache --play <uuid> | Play cached audio |
| --clear-cache | Clear all cache |

## Examples

```bash
# Basic
speakeasy "Hello world"

# With provider
speakeasy "Hello" --provider openai --voice nova

# Save to file
speakeasy "Message" --out output.mp3

# With caching
speakeasy "Cached" --cache --provider openai

# Debug mode
speakeasy "Debug" --debug

# Set API key
speakeasy --set-key openai sk-xxx
```

## Provider + Voice Combinations

| Provider | Voice Flag Examples |
|----------|---------------------|
| system | --voice Samantha, --voice Alex |
| openai | --voice nova, --voice alloy |
| elevenlabs | --voice EXAVITQu4vr4xnSDxMaL |
| groq | --voice tara, --voice leo |

## Environment Variables

```
OPENAI_API_KEY
ELEVENLABS_API_KEY
GROQ_API_KEY
GEMINI_API_KEY
```

## Config File

`~/.config/speakeasy/settings.json`

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Config error |
| 3 | Provider error |
